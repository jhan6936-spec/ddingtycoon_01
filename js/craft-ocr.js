/**
 * 공예품 시세 변동 OCR — 6종 항상 반환, 레시피는 위키 고정값만
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

const extractMarketPrices = (segment) => {
  const text = String(segment || '')

  let currentPrice = 0
  const goldMatch = text.match(/(\d{1,3}(?:[,\s]\d{3})+|\d{4,7})\s*(?:Gold|GOLD|gold|골드|G\b)/i)
  if (goldMatch) {
    currentPrice = parseGoldNumber(goldMatch[1])
  }

  if (!currentPrice) {
    const nums = (text.match(/\d{1,3}(?:[,\s]\d{3})+|\d{4,7}/g) || []).map(parseGoldNumber)
    const big = nums.filter((n) => n >= 10000)
    if (big.length) currentPrice = Math.max(...big)
  }

  let priceChange = 0
  const upMatch = text.match(/(?:▲|△|↑|\+)\s*(\d[\d,.\s]{2,})/)
  const downMatch = text.match(/(?:▼|▽|↓|-)\s*(\d[\d,.\s]{2,})/)
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

const parseMarketScreenByPercentBlocks = (text) => {
  const markers = []
  const re = /최고\s*가\s*의?\s*(\d{1,3})\s*%/gi
  let m
  while ((m = re.exec(text)) !== null) {
    markers.push({ index: m.index, percent: parseInt(m[1], 10) })
  }
  if (markers.length < 5) return null

  return markers.slice(0, CRAFT_NAME_ORDER.length).map((marker, i) => {
    const prevIdx = i > 0 ? markers[i - 1].index : 0
    const chunk = text.slice(Math.max(0, prevIdx - 30), marker.index + 40)
    const prices = extractMarketPrices(chunk)
    if (!prices.maxPricePercent) prices.maxPricePercent = marker.percent
    if (!prices.maxPrice && prices.currentPrice && prices.maxPricePercent) {
      prices.maxPrice = Math.round(prices.currentPrice / (prices.maxPricePercent / 100))
    }
    return { name: CRAFT_NAME_ORDER[i], ...prices }
  })
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
  const cur = o.currentPrice > 0 ? o.currentPrice : p.currentPrice > 0 ? p.currentPrice : 0
  if (cur > 0) craft.currentPrice = cur
  const ch = o.priceChange !== 0 ? o.priceChange : p.priceChange
  if (ch) craft.priceChange = ch
  const max = o.maxPrice > 0 ? o.maxPrice : p.maxPrice > 0 ? p.maxPrice : 0
  if (max > 0) craft.maxPrice = max
  const pct = o.maxPricePercent > 0 ? o.maxPricePercent : p.maxPricePercent > 0 ? p.maxPricePercent : 0
  if (pct > 0) craft.maxPricePercent = pct
  return craft
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

    if (prices.currentPrice >= 5000) priceUpdated += 1

    const craft = buildCraftFromDefaults(name, prices, prev)
    if (craft) crafts.push(craft)
  }

  return { crafts, screenType: 'market', priceUpdatedCount: priceUpdated }
}

const parseCraftsFromOcrText = (text, baseCatalog) => parseMarketScreen(text, baseCatalog)

const mergeParsedWithDefaults = (parsedCrafts) => {
  const byName = new Map((parsedCrafts || []).map((c) => [c.name, c]))
  return CRAFT_NAME_ORDER.map((name) => {
    const craft = byName.get(name)
    const base = getDefaultCraft(name)
    if (!base) return craft
    const out = {
      name: craft?.name || name,
      price: base.price,
      inputs: base.inputs.map((i) => ({ ...i })),
      timeMinutes: base.timeMinutes,
      time: base.timeMinutes,
      group: 'craft'
    }
    if (craft?.currentPrice > 0) out.currentPrice = craft.currentPrice
    if (craft?.priceChange) out.priceChange = craft.priceChange
    if (craft?.maxPrice > 0) out.maxPrice = craft.maxPrice
    if (craft?.maxPricePercent > 0) out.maxPricePercent = craft.maxPricePercent
    return typeof window.applyFixedCraftRecipe === 'function'
      ? window.applyFixedCraftRecipe(out)
      : out
  }).filter(Boolean)
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
