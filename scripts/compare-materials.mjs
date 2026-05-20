import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(webRoot, 'index.html'), 'utf8')

const folders = ['재료', '재료 1'].map((f) => path.join(webRoot, f))
const fileNames = new Set()
for (const folder of folders) {
  for (const entry of fs.readdirSync(folder)) {
    if (entry.endsWith('.png')) fileNames.add(path.basename(entry, '.png'))
  }
}

const DISPLAY_ALIASES = { '조개껍데기': '깨진 조개껍데기' }
const imageMapMatch = html.match(/const imageMap = \{([\s\S]*?)\};/)
const imageMap = {}
if (imageMapMatch) {
  const re = /'([^']+)':\s*'[^']+\/([^']+)\.png'/g
  let m
  while ((m = re.exec(imageMapMatch[1]))) imageMap[m[1]] = m[2]
}

function resolveFileName(displayName) {
  if (DISPLAY_ALIASES[displayName]) return DISPLAY_ALIASES[displayName]
  if (imageMap[displayName]) return imageMap[displayName]
  return displayName.replace(/\s*★+/g, '').trim()
}

function hasFile(displayName) {
  return fileNames.has(resolveFileName(displayName))
}

const dataStart = html.indexOf('const data = {')
const dataEnd = html.indexOf('\n};\n\n\n\n// 카테고리 매핑')
const dataStr = html.slice(dataStart, dataEnd)

const materialNames = new Set()
const matBlock = dataStr.match(/materials:\s*\{([\s\S]*?)\n  \},/)?.[1] || ''
for (const m of matBlock.matchAll(/"([^"]+)":\s*\{/g)) materialNames.add(m[1])
for (const m of dataStr.matchAll(/name:\s*"([^"]+)"/g)) materialNames.add(m[1])

const catMatch = html.match(/const categoryMap = \{([\s\S]*?)\};/)
if (catMatch) {
  for (const m of catMatch[1].matchAll(/'([^']+)'/g)) materialNames.add(m[1])
}

const dataMaterialNames = new Set(materialNames)
for (const k of Object.keys(imageMap)) materialNames.add(k)

const missing = [...dataMaterialNames]
  .filter((n) => !['synthesis', 'alchemy1', 'alchemy2', 'alchemy3'].includes(n))
  .filter((n) => !hasFile(n))
  .sort()

console.log('=== Materials in code without PNG in 재료/재료 1 ===')
missing.forEach((n) => console.log(`  ${n}  (resolved: ${resolveFileName(n)})`))
console.log(`Total: ${missing.length}`)

const referencedFiles = new Set([...dataMaterialNames].map(resolveFileName))
const inFilesNotCode = [...fileNames].filter((f) => !referencedFiles.has(f)).sort()

console.log('\n=== PNG files not referenced by any code material ===')
inFilesNotCode.forEach((f) => console.log(`  ${f}`))
console.log(`Total: ${inFilesNotCode.length}`)

const imageMapKeys = Object.keys(imageMap)
const unusedImageMap = imageMapKeys.filter((k) => !dataMaterialNames.has(k)).sort()
console.log('\n=== imageMap keys not in data/materials/recipes ===')
unusedImageMap.forEach((k) => console.log(`  ${k}`))
console.log(`Total: ${unusedImageMap.length}`)

const aliases = {
  '조개껍데기': '깨진 조개껍데기',
  '해구 파동의 코어': '해구의 파동 코어'
}
const strictMissing = [...dataMaterialNames]
  .filter((n) => !['synthesis', 'alchemy1', 'alchemy2', 'alchemy3'].includes(n))
  .filter((n) => {
    const exact = n.replace(/\s*★+/g, '').trim()
    const target = aliases[n] || aliases[exact] || exact
    return !fileNames.has(target)
  })
  .sort()

console.log('\n=== Data materials with no matching PNG (strict) ===')
strictMissing.forEach((n) => console.log(`  ${n}`))
console.log(`Total: ${strictMissing.length}`)
