/**
 * 공예품 시세 변동 OCR — 6줄(최고가의 N% 6개) 기준으로만 파싱
 */
const CRAFT_NAME_ORDER = window.CRAFT_NAME_ORDER || [
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

const normalizeCraftNamesInText = (text) => String(text || '').replace(/\r/g, '')

const extractMaxPricePercent = (segment) => {
  const m = String(segment || '').match(/최고\s*가\s*의?\s*(\d{1,3})\s*%/i)
  if (!m) return 0
  const p = parseInt(m[1], 10)
  if (!Number.isFinite(p) || p < 1 || p > 100) return 0
  return p
}

const extractMarketPricesFromChunk = (chunk) => {
  const text = String(chunk || '')

  let priceChange = 0
  const upMatch = text.match(/(?:▲|△|↑|\+)\s*(\d[\d,.\s]{2,})/)
  const downMatch = text.match(/(?:▼|▽|↓|-)\s*(\d[\d,.\s]{2,})/)
  if (upMatch) {
    priceChange = parseGoldNumber(upMatch[1])
  } else if (downMatch) {
    priceChange = -parseGoldNumber(downMatch[1])
  }

  const maxPricePercent = extractMaxPricePercent(text)
  const changeAbs = Math.abs(priceChange)

  let currentPrice = 0
  const goldRe = /(\d{1,3}(?:[,\s]\d{3})+|\d{3,7})\s*(?:Gold|GOLD|gold|골드)/gi
  let gm
  while ((gm = goldRe.exec(text))) {
    const n = parseGoldNumber(gm[1])
    if (n >= 1000 && n !== changeAbs) {
      currentPrice = n
      break
    }
  }

  if (!currentPrice) {
    const re = /\d{1,3}(?:[,\s]\d{3})+|\d{4,7}/g
    let m
    while ((m = re.exec(text))) {
      const n = parseGoldNumber(m[0])
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

/** 화면 위→아래 순서 = CRAFT_NAME_ORDER (최고가의 N% 마커 6개 필수) */
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
  if (markers.length < 6) return null

  return markers.slice(0, 6).map((marker, i) => {
    const start = i === 0 ? 0 : markers[i - 1].end
    const end = marker.end
    const chunk = text.slice(start, end)
    const prices = extractMarketPricesFromChunk(chunk)
    if (!prices.maxPricePercent) prices.maxPricePercent = marker.percent
    return {
      name: CRAFT_NAME_ORDER[i],
      ...prices
    }
  })
}

const getDefaultCraft = (name) =>
  typeof window.getDefaultCraftRecipe === 'function' ? window.getDefaultCraftRecipe(name) : null

const buildCraftFromOcrRow = (name, row) => {
  const base = getDefaultCraft(name)
  if (!base) return null
  const craft = {
    name: base.name,
    price: base.price,
    inputs: base.inputs.map((i) => ({ ...i })),
    timeMinutes: base.timeMinutes,
    time: base.timeMinutes,
    group: 'craft'
  }
  if (row.currentPrice >= 1000) craft.currentPrice = row.currentPrice
  if (row.priceChange) craft.priceChange = row.priceChange
  if (row.maxPricePercent >= 1 && row.maxPricePercent <= 100) {
    craft.maxPricePercent = row.maxPricePercent
  }
  return typeof window.applyFixedCraftRecipe === 'function'
    ? window.applyFixedCraftRecipe(craft)
    : craft
}

const parseMarketScreen = (text) => {
  const normalized = normalizeCraftNamesInText(text)
  const blockRows = parseMarketScreenByPercentBlocks(normalized)

  if (!blockRows || blockRows.length < 6) {
    return {
      crafts: [],
      screenType: 'market',
      priceUpdatedCount: 0,
      markerCount: blockRows ? blockRows.length : 0
    }
  }

  const crafts = blockRows.map((row) => buildCraftFromOcrRow(row.name, row)).filter(Boolean)
  const priceUpdated = crafts.filter((c) => c.currentPrice >= 1000).length

  return {
    crafts,
    screenType: 'market',
    priceUpdatedCount: priceUpdated,
    markerCount: 6
  }
}

const parseCraftsFromOcrText = (text) => parseMarketScreen(text)

const runTesseractOnFile = async (file, onProgress) => {
  if (!window.Tesseract) {
    throw new Error('OCR 엔진을 불러오지 않았습니다. 새로고침 후 다시 시도하세요.')
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
    await worker.worker.terminate()
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
  extractMarketPricesFromChunk
}
