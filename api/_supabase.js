const crypto = require('crypto');

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function sendJson(res, status, payload) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(payload));
}

function handleCors(req, res) {
  if (req.method !== 'OPTIONS') return false;
  res.writeHead(204, jsonHeaders);
  res.end();
  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function decodeJwtRole(jwt) {
  if (!jwt || typeof jwt !== 'string') return 'unknown';
  const parts = jwt.split('.');
  if (parts.length < 2) return 'unknown';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return String(payload.role || 'unknown');
  } catch (_) {
    return 'unknown';
  }
}

function getSupabaseConfigStatus() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const serviceKeyRole = decodeJwtRole(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return {
    ok: missing.length === 0,
    missing,
    serviceKeyRole
  };
}

function classifySupabaseError(error) {
  const message = String(error && error.message ? error.message : error);
  if (message.includes('Missing env:')) {
    return { code: 'config_missing', hint: 'Vercel 환경 변수를 확인한 뒤 재배포하세요.' };
  }
  if (message.includes('PGRST205') || message.includes('does not exist')) {
    return {
      code: 'table_missing',
      hint: 'Supabase SQL Editor에서 supabase_minecraft_link.sql 을 실행하세요.'
    };
  }
  if (message.includes('42501') || message.toLowerCase().includes('permission denied')) {
    return {
      code: 'permission_denied',
      hint: 'SUPABASE_SERVICE_ROLE_KEY 가 service_role 인지, SQL 권한/RLS 설정을 확인하세요.'
    };
  }
  if (message.includes('401') || message.includes('403')) {
    return {
      code: 'supabase_auth_failed',
      hint: 'SUPABASE_SERVICE_ROLE_KEY 값이 올바른지 확인하세요.'
    };
  }
  return { code: 'supabase_error', hint: message.slice(0, 240) };
}

async function supabaseRest(path, options = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '') + '/rest/v1' + path;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = text;
    }
  }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Supabase REST ${response.status}: ${detail}`);
  }
  return body;
}

async function probeSupabaseTables() {
  const result = {
    linkCodesReadable: false,
    dashboardReadable: false,
    linkInsertOk: false
  };

  try {
    await supabaseRest('/minecraft_link_codes?select=code&limit=1');
    result.linkCodesReadable = true;
  } catch (_) {}

  try {
    await supabaseRest('/minecraft_dashboard_snapshots?select=user_id&limit=1');
    result.dashboardReadable = true;
  } catch (_) {}

  try {
    const probeCode = `ZZ${randomCode()}`;
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await supabaseRest('/minecraft_link_codes', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        code: probeCode,
        minecraft_uuid: '00000000-0000-0000-0000-000000000099',
        minecraft_name: 'ddingtae_health_probe',
        expires_at: expiresAt
      })
    });
    result.linkInsertOk = true;
    await supabaseRest(`/minecraft_link_codes?code=eq.${encodeURIComponent(probeCode)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    });
  } catch (_) {}

  return result;
}

async function getSupabaseUser(authorization) {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const anonKey = env('SUPABASE_ANON_KEY');
  const response = await fetch(env('SUPABASE_URL').replace(/\/$/, '') + '/auth/v1/user', {
    headers: {
      apikey: anonKey,
      Authorization: authorization
    }
  });
  if (!response.ok) return null;
  return response.json();
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

function randomToken() {
  return 'dtm_' + crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function siteOrigin(req) {
  if (process.env.PUBLIC_SITE_URL) {
    return String(process.env.PUBLIC_SITE_URL).replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, '');
  }
  if (req.headers.origin) {
    return String(req.headers.origin).replace(/\/$/, '');
  }
  return 'https://ddingtycoon-01.vercel.app';
}

module.exports = {
  handleCors,
  sendJson,
  readJson,
  supabaseRest,
  getSupabaseUser,
  getSupabaseConfigStatus,
  classifySupabaseError,
  probeSupabaseTables,
  randomCode,
  randomToken,
  hashToken,
  siteOrigin
};
