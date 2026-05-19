const { handleCors, sendJson, readJson, supabaseRest } = require('../_supabase');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function aggregatePrices(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const item = String(row.item_name || '').trim();
    const price = Number(row.price || 0);
    if (!item || !Number.isFinite(price) || price <= 0) return;
    if (!grouped.has(item)) grouped.set(item, []);
    grouped.get(item).push(price);
  });

  const prices = {};
  grouped.forEach((values, item) => {
    const med = median(values);
    const filtered = values.length >= 4
      ? values.filter((value) => Math.abs(value - med) <= Math.max(500, med * 0.35))
      : values;
    const finalValues = filtered.length ? filtered : values;
    prices[item] = median(finalValues);
  });
  return prices;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const date = url.searchParams.get('date') || todayDate();
      const server = url.searchParams.get('server') || 'ddingtycoon';
      const rows = await supabaseRest(
        `/npc_market_price_samples?price_date=eq.${encodeURIComponent(date)}&server=eq.${encodeURIComponent(server)}&select=item_name,price`
      );
      const list = Array.isArray(rows) ? rows : [];
      return sendJson(res, 200, {
        date,
        server,
        prices: aggregatePrices(list),
        sampleCount: list.length
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const samples = Array.isArray(body.samples) ? body.samples : [];
      if (!samples.length) {
        return sendJson(res, 400, { error: 'samples_required' });
      }

      const payload = samples
        .map((sample) => ({
          item_name: String(sample.item || '').trim(),
          price: Number(sample.price || 0),
          price_date: String(sample.date || todayDate()),
          server: String(sample.server || 'ddingtycoon').trim() || 'ddingtycoon',
          submitted_at: new Date().toISOString()
        }))
        .filter((sample) => sample.item_name && Number.isFinite(sample.price) && sample.price > 0);

      if (!payload.length) {
        return sendJson(res, 400, { error: 'valid_samples_required' });
      }

      await supabaseRest('/npc_market_price_samples', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload)
      });

      return sendJson(res, 200, { saved: payload.length });
    }

    return sendJson(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    console.error('[minecraft/market-prices]', error);
    return sendJson(res, 500, { error: 'market_price_failed' });
  }
};
