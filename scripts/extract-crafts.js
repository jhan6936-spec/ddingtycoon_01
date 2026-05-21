const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const re = /\{\s*name:\s*"([^"]+)",\s*inputs:\s*(\[[\s\S]*?\]),\s*time:\s*(\d+),\s*price:\s*(\d+),\s*group:\s*"craft"\s*\}/g
const crafts = []
let m
while ((m = re.exec(html))) {
  let inputs = []
  try {
    inputs = Function(`return ${m[2]}`)()
  } catch (_) {}
  crafts.push({
    name: m[1],
    inputs,
    time: Number(m[3]),
    timeMinutes: Number(m[3]),
    price: Number(m[4]),
    group: 'craft'
  })
}

const out = {
  version: 1,
  updatedAt: new Date().toISOString(),
  crafts
}

const outDir = path.join(root, 'data')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'crafts.json'), JSON.stringify(out, null, 2), 'utf8')
console.log(`Extracted ${crafts.length} crafts -> data/crafts.json`)
