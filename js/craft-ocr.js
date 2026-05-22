/**
 * 공예품 시세 변동 OCR 파싱
 * - 노란 숫자+Gold = 현재 시세 (OCR: 큰 숫자 Gold 앞)
 * - ▲/▼ 뒤 숫자 = 전회 대비 변동
 * - 최고가의 N% = 최고가 도달률 (최고가 = 현재시세 / N% * 100)
 * 레시피는 craft-recipe-defaults.js 고정값만 사용
 */
const CRAFT_NAME_ORDER = [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

const parseGoldNumber = (raw) => {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}

const normalizeOcrLine = (line) =>
  String(line || '')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const fuzzyIncludes = (haystack, needle) => {
  const h = haystack.replace(/\s/g, '')
  const n = needle.replace(/\s/g, '')
  return h.includes(n)
}

const findNameIndex = (text, name, fromIndex) => {
  const direct = text.indexOf(name, fromIndex)
  if (direct >= 0) return direct
  const compact = text.replace(/\s/g, '')
  const compactName = name.replace(/\s/g, '')
  const pos = compact.indexOf(compactName, Math.max(0, Math.floor(fromIndex / 2)))
  if (pos < 0) return -1
  return Math.max(0, pos - 10)
}

const splitSegmentsByCraftOrder = (fullText) => {
  const segments = {}
  let searchFrom = 0
  for (let i = 0; i < CRAFT_NAME_ORDER.length; i++) {
    const name = CRAFT_NAME_ORDER[i]
    const nextName = CRAFT_NAME_ORDER[i + 1]
    const start = findNameIndex(fullText, name, searchFrom)
    if (start < 0) continue
    const end = nextName ? findNameIndex(fullText, nextName, start + name.length) : fullText.length
    segments[name] = fullText.slice(start, end < 0 ? fullText.length : end)
    searchFrom = start + name.length
  }
  return segments
}

const extractMaxPricePercent = (segment) => {
  const m = String(segment || '').match(/최고\s*가\s*의?\s*(\d{1,3})\s*%/i)
  if (!m) return 0
  const p = parseInt(m[1], 10)
  if (!Number.isFinite(p) || p < 1 || p > 100) return 0
  return p
}

const extractMarketPrices = (segment) => {
  const text = String(segment || '')

  let currentPrice = 0
  const goldMatch = text.match(/(\d{1,3}(?:[,\s]\d{3})+|\d{4,7})\s*(?:Gold|GOLD|gold|골드)/i)
  if (goldMatch) {
    currentPrice = parseGoldNumber(goldMatch[1])
  }

  if (!currentPrice) {
    const nums = (text.match(/\d{1,3}(?:[,\s]\d{3})+|\d{4,7}/g) || []).map(parseGoldNumber)
    const big = nums.filter((n) => n >= 10000)
    if (big.length) currentPrice = Math.max(...big)
  }

  let priceChange = 0
  const upMatch = text.match(/(?:▲|△|↑)\s*(\d[\d,.\s]{2,})/)
  const downMatch = text.match(/(?:▼|▽|↓)\s*(\d[\d,.\s]{2,})/)
  if (upMatch) {
    priceChange = parseGoldNumber(upMatch[1])
  } else if (downMatch) {
    priceChange = -parseGoldNumber(downMatch[1])
  }

  const maxPricePercent = extractMaxPricePercent(text)

  let maxPrice = 0
  if (currentPrice > 0 && maxPricePercent > 0) {
    maxPrice = Math.round(currentPrice / (maxPricePercent / 100))
  }

  return { currentPrice, priceChange, maxPrice, maxPricePercent }
}

const getDefaultCraft = (name) =>
  typeof window.getDefaultCraftRecipe === 'function' ? window.getDefaultCraftRecipe(name) : null

const buildCraftFromDefaults = (name, overrides) => {
  const base = getDefaultCraft(name)
  if (!base) return null
  return {
    name: base.name,
    price: base.price,
    inputs: base.inputs.map((i) => ({ ...i })),
    timeMinutes: base.timeMinutes,
    time: base.timeMinutes,
    group: 'craft',
    currentPrice: overrides.currentPrice,
    priceChange: overrides.priceChange,
    maxPrice: overrides.maxPrice,
    maxPricePercent: overrides.maxPricePercent
  }
}

const parseMarketScreen = (text, baseCatalog) => {
  const segments = splitSegmentsByCraftOrder(text)
  const crafts = []

  for (const name of CRAFT_NAME_ORDER) {
    const segment = segments[name]
    if (!segment) continue

    const { currentPrice, priceChange, maxPrice, maxPricePercent } = extractMarketPrices(segment)
    if (!currentPrice || currentPrice < 5000) continue

    const craft = buildCraftFromDefaults(name, {
      currentPrice,
      priceChange: priceChange || 0,
      maxPrice: maxPrice || 0,
      maxPricePercent: maxPricePercent || 0
    })
    if (craft) crafts.push(craft)
  }

  return { crafts, screenType: 'market' }
}

const parseCraftsFromOcrText = (text, baseCatalog) => {
  return parseMarketScreen(text, baseCatalog)
}

const mergeParsedWithDefaults = (parsedCrafts) => {
  return (parsedCrafts || []).map((craft) => {
    const base = getDefaultCraft(craft.name)
    if (!base) return craft
    const out = {
      name: craft.name,
      price: base.price,
      inputs: base.inputs.map((i) => ({ ...i })),
      timeMinutes: base.timeMinutes,
      time: base.timeMinutes,
      group: 'craft'
    }
    if (craft.currentPrice > 0) out.currentPrice = craft.currentPrice
    if (craft.priceChange) out.priceChange = craft.priceChange
    if (craft.maxPrice > 0) out.maxPrice = craft.maxPrice
    if (craft.maxPricePercent > 0) out.maxPricePercent = craft.maxPricePercent
    return out
  })
}

const runTesseractOnFile = async (file, onProgress) => {
  if (!window.Tesseract) {
    throw new Error('OCR 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.')
  }

  const imageUrl = URL.createObjectURL(file)
  try {
    const worker = await Tesseract.createWorker('kor+eng', 1, {
      logger: (m) => {
        if (typeof onProgress === 'function' && m.status === 'recognizing text') {
          onProgress(Math.round((m.progress || 0) * 100))
        }
      }
    })

    const result = await worker.recognize(imageUrl)
    await worker.terminate()
    return String(result?.data?.text || '')
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

window.CraftOcr = {
  CRAFT_NAME_ORDER,
  getDefaultCraft,
  parseCraftsFromOcrText,
  mergeParsedWithDefaults,
  runTesseractOnFile,
  extractMarketPrices
}
