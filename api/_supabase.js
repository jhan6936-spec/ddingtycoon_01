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
  return (
    process.env.PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    req.headers.origin ||
    'https://ddingtycoon-01.vercel.app'
  ).replace(/\/$/, '');
}

module.exports = {
  handleCors,
  sendJson,
  readJson,
  supabaseRest,
  getSupabaseUser,
  randomCode,
  randomToken,
  hashToken,
  siteOrigin
};
