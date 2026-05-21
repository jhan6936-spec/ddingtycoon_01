#!/usr/bin/env node
/**
 * stdin JSON → data/crafts.json (Git 커밋용 로컬 저장)
 * Usage: node scripts/save-crafts-local.js < crafts-export.json
 */
const fs = require('fs')
const path = require('path')
const { normalizeCraftsPayload } = require('../lib/crafts-store')

async function main() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    console.error('stdin에 JSON이 필요합니다.')
    process.exit(1)
  }
  const parsed = normalizeCraftsPayload(JSON.parse(raw))
  const outPath = path.join(process.cwd(), 'data', 'crafts.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf8')
  console.log('Wrote', outPath, `(${parsed.crafts.length} crafts)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
