/**
 * 공예품 시세 변동 OCR
 * - Gold 앞 숫자 = 현재 시세 (1만 미만도 허용)
 * - ▲/▼ = 변동폭
 * - 최고가의 N% = 도달률 (최고가 = 현재 ÷ N% × 100)
 * - 레시피는 OCR/DB 무시, 위키 고정값만
 */
const CRAFT_NAME_ORDER = window.CRAFT_NAME_ORDER || [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

const OCR_NAME_ALIASES = [
  ['조개껍데기\\s*브로치', '조개껍데기 브로치'],
  ['조개\\s*브로치', '조개껍데기 브로치'],
  ['푸른\\s*향수병', '푸른 향수병'],
  ['자개\\s*손거울', '자개 손거울'],
  ['분홍\\s*헤어핀', '분홍 헤어핀'],
  ['자개\\s*부채', '자개 부채'],
  ['흑진주\\s*시계', '흑진주 시계']
]

const parseGoldNumber = (raw) => {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}

const normalizeCraftNamesInText = (text) => {
  let t = String(text || '')
  OCR_NAME_ALIASES.forEach(([pat, repl]) => {
    t = t.replace(new RegExp(pat, 'gi'), repl)
  })
  CRAFT_NAME_ORDER.forEach((name) => {
    const compact = name.replace(/\s/g, '')
    if (compact.length >= 4 && t.replace(/\s/g, '').includes(compact)) {
      t = t.replace(new RegExp(compact.split('').join('\\s*'), 'gi'), name)
    }
  })
  return t
}

const findNameIndex = (text, name, fromIndex) => {
  const direct = text.indexOf(name, fromIndex)
  if (direct >= 0) return direct
  const compact = text.replace(/\s/g, '')
  const compactName = name.replace(/\s/g, '')
  const pos = compact.indexOf(compactName, Math.max(0, fromIndex))
  if (pos < 0) return -1
  return Math.max(0, pos - 8)
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

const extractOrderedNumbers = (text) => {
  const ordered = []
  const re = /\d{1,3}(?:[,\s]\d{3})+|\d{4,7}/g
  let m
  while ((m = re.exec(String(text || '')))) {
    ordered.push({ n: parseGoldNumber(m[0]), index: m.index })
  }
  return ordered
}

const extractMarketPrices = (segment) => {
  const text = String(segment || '')

  let priceChange = 0
  const upMatch = text.match(/(?:▲|△|↑)\s*(\d[\d,.\s]{2,})/)
  const downMatch = text.match(/(?:▼|▽|↓)\s*(\d[\d,.\s]{2,})/)
  if (upMatch) {
    priceChange = parseGoldNumber(upMatch[1])
  } else if (downMatch) {
    priceChange = -parseGoldNumber(downMatch[1])
  }

  const maxPricePercent = extractMaxPricePercent(text)
  const changeAbs = Math.abs(priceChange)

  let currentPrice = 0
  const goldRe = /(\d{1,3}(?:[,\s]\d{3})+|\d{3,7})\s*(?:Gold|GOLD|gold|골드)/gi
  const goldHits = []
  let gm
  while ((gm = goldRe.exec(text))) {
    goldHits.push(parseGoldNumber(gm[1]))
  }
  if (goldHits.length) {
    currentPrice = goldHits[0]
  }

  if (!currentPrice) {
    for (const { n } of extractOrderedNumbers(text)) {
      if (n < 1000) continue
      if (changeAbs && n === changeAbs) continue
      if (maxPricePercent >= 1 && maxPricePercent <= 100 && n === maxPricePercent) continue
      if (n <= 100) continue
      currentPrice = n
      break
    }
  }

  return { currentPrice, priceChange, maxPricePercent }
}

const parseMarketScreenByPercentBlocks = (text) => {
  const markers = []
  const re = /최고\s*가\s*의?\s*(\d{1,3})\s*%/gi
  let m
  while ((m = re.exec(text)) !== null) {
    markers.push({
      index: m.index,
      percent: parseInt(m[1], 10),
      end: m.index + m[0].length
    })
  }
  if (markers.length < 5) return null

  const count = Math.min(markers.length, CRAFT_NAME_ORDER.length)
  const rows = []
  for (let i = 0; i < count; i++) {
    const name = CRAFT_NAME_ORDER[i]
    const marker = markers[i]
    const searchFrom = i > 0 ? markers[i - 1].end : 0
    const nameIdx = findNameIndex(text, name, searchFrom)
    const start = nameIdx >= 0 ? nameIdx : searchFrom
    const chunk = text.slice(start, marker.end + 24)
    const prices = extractMarketPrices(chunk)
    prices.maxPricePercent = marker.percent
    rows.push({ name, ...prices })
  }
  return rows
}

const getDefaultCraft = (name) =>
  typeof window.getDefaultCraftRecipe === 'function' ? window.getDefaultCraftRecipe(name) : null

const getPrevCraft = (baseCatalog, name) =>
  (baseCatalog?.crafts || []).find((c) => c && c.name === name) || null

const buildCraftFromDefaults = (name, overrides, prev) => {
  const base = getDefaultCraft(name)
  if (!base) return null
  const o = overrides || {}
  const p = prev || {}
  const craft = {
    name: base.name,
    price: base.price,
    inputs: base.inputs.map((i) => ({ ...i })),
    timeMinutes: base.timeMinutes,
    time: base.timeMinutes,
    group: 'craft'
  }

  const ocrCurrent = o.currentPrice > 0 ? o.currentPrice : 0
  const cur = ocrCurrent > 0 ? ocrCurrent : p.currentPrice > 0 ? p.currentPrice : 0
  if (cur > 0) craft.currentPrice = cur

  if (o.priceChange !== 0) craft.priceChange = o.priceChange
  else if (p.priceChange) craft.priceChange = p.priceChange

  const pct = o.maxPricePercent > 0 ? o.maxPricePercent : p.maxPricePercent > 0 ? p.maxPricePercent : 0
  if (pct > 0) craft.maxPricePercent = pct

  return typeof window.applyFixedCraftRecipe === 'function'
    ? window.applyFixedCraftRecipe(craft)
    : craft
}

const parseMarketScreen = (text, baseCatalog) => {
  const normalized = normalizeCraftNamesInText(text)
  const blockRows = parseMarketScreenByPercentBlocks(normalized)
  const blockByName = new Map((blockRows || []).map((r) => [r.name, r]))
  const segments = splitSegmentsByCraftOrder(normalized)
  const crafts = []
  let priceUpdated = 0

  for (const name of CRAFT_NAME_ORDER) {
    const prev = getPrevCraft(baseCatalog, name)
    let prices = { currentPrice: 0, priceChange: 0, maxPrice: 0, maxPricePercent: 0 }

    if (blockByName.has(name)) {
      const b = blockByName.get(name)
      prices = {
        currentPrice: b.currentPrice,
        priceChange: b.priceChange,
        maxPrice: b.maxPrice,
        maxPricePercent: b.maxPricePercent
      }
    } else if (segments[name]) {
      prices = extractMarketPrices(segments[name])
    }

    if (prices.currentPrice >= 1000) priceUpdated += 1

    const craft = buildCraftFromDefaults(name, prices, prev)
    if (craft) crafts.push(craft)
  }

  return { crafts, screenType: 'market', priceUpdatedCount: priceUpdated }
}

const parseCraftsFromOcrText = (text, baseCatalog) => parseMarketScreen(text, baseCatalog)

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
  runTesseractOnFile,
  extractMarketPrices
}
