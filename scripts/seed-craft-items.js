#!/usr/bin/env node
/**
 * data/crafts.json → Supabase craft_items upsert (최초 1회 시드)
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-craft-items.js
 */
const fs = require('fs')
const path = require('path')
const { upsertCraftItems, normalizeCraftsPayload } = require('../lib/crafts-store')
const { supabaseRest } = require('../api/_supabase')

async function main() {
  const filePath = path.join(process.cwd(), 'data', 'crafts.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const payload = normalizeCraftsPayload(JSON.parse(raw))
  const saved = await upsertCraftItems(supabaseRest, payload)
  console.log('Seeded craft_items:', saved.crafts.length, 'rows')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
