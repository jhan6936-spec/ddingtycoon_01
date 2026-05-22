/**
 * 브라우저 Tesseract OCR → 공예품 파싱
 * - 시세 변동 화면: 현재가·최고가만 갱신 (레시피·제작 판매가 고정)
 * - 제작 화면: 재료 OCR (선택)
 */
const CRAFT_NAME_ORDER = [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

const CRAFT_RECIPE_DEFAULTS = () => window.CRAFT_RECIPE_DEFAULTS || {}

const MATERIAL_HINTS = [
  '깨진 조개껍데기', '노란빛 진주', '푸른빛 진주', '청록빛 진주', '분홍빛 진주', '보라빛 진주', '흑진주',
  '금속 재활용품', '합금 재활용품', '합성수지 재활용품', '플라스틱 재활용품', '섬유 재활용품',
  '거미줄', '양동이', '유리판', '대나무', '분홍 꽃잎', '막대기', '자수정 조각', '흑요석', '시계'
]

const getDefaultCraft = (name) => {
  const d = CRAFT_RECIPE_DEFAULTS[name]
  if (!d) return null
  return {
    name,
    price: d.price,
    timeMinutes: d.timeMinutes,
    time: d.timeMinutes,
    inputs: d.inputs.map((i) => ({ ...i })),
    group: 'craft'
  }
}

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
  const pos = compact.indexOf(compactName, Math.floor(fromIndex / 2))
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

const detectScreenType = (text) => {
  const t = String(text || '')
  if (/시세|변동|최고가의|최고가\s*의/i.test(t)) return 'market'
  const matHits = MATERIAL_HINTS.filter((m) => fuzzyIncludes(t, m)).length
  if (matHits >= 4) return 'recipe'
  return 'market'
}

const extractPercentFromSegment = (segment) => {
  const labeled = segment.match(/최고가\s*의?\s*(\d{1,3})\s*%/i)
  if (labeled) return Math.min(100, Math.max(1, parseInt(labeled[1], 10)))
  const percents = []
  const re = /(\d{1,3})\s*%/g
  let m
  while ((m = re.exec(segment))) {
    const p = parseInt(m[1], 10)
    if (p >= 1 && p <= 100) percents.push(p)
  }
  return percents.length ? percents[percents.length - 1] : 0
}

const extractMarketPrices = (segment) => {
  const rawNums =
    String(segment || '').match(/\d{1,3}(?:[,\s]\d{3})+|\d{4,7}/g)?.map(parseGoldNumber) || []
  const big = rawNums.filter((n) => n >= 5000)
  const small = rawNums.filter((n) => n >= 1 && n <= 100)

  let currentPrice = 0
  if (big.length) {
    currentPrice = Math.max(...big)
  }

  let percent = extractPercentFromSegment(segment)
  if (!percent && small.length) {
    percent = small[small.length - 1]
  }

  let maxPrice = 0
  if (currentPrice > 0 && percent > 0) {
    maxPrice = Math.round(currentPrice / (percent / 100))
  }

  return { currentPrice, maxPrice, percent }
}

const parseInputsNear = (segment) => {
  const inputs = []
  for (const mat of MATERIAL_HINTS) {
    if (!fuzzyIncludes(segment, mat)) continue
    const escaped = mat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const countMatch = segment.match(new RegExp(escaped + '\\s*[x×X*]?\\s*(\\d+)', 'i'))
    const count = countMatch ? Math.max(1, parseInt(countMatch[1], 10)) : 1
    if (count > 500) continue
    inputs.push({ name: mat, count })
  }
  return inputs
}

const buildCraftFromDefaults = (name, overrides) => {
  const base = getDefaultCraft(name)
  if (!base) return null
  return {
    ...base,
    ...overrides,
    name,
    inputs: base.inputs,
    price: base.price,
    group: 'craft'
  }
}

const parseMarketScreen = (text, baseCatalog) => {
  const baseMap = new Map((baseCatalog?.crafts || []).map((c) => [c.name, c]))
  const segments = splitSegmentsByCraftOrder(text)
  const crafts = []

  for (const name of CRAFT_NAME_ORDER) {
    const segment = segments[name]
    if (!segment) continue

    const { currentPrice, maxPrice } = extractMarketPrices(segment)
    if (!currentPrice) continue

    const existing = baseMap.get(name) || {}
    const craft = buildCraftFromDefaults(name, {
      currentPrice,
      maxPrice: maxPrice || existing.maxPrice || 0,
      timeMinutes: existing.timeMinutes || 1,
      time: existing.time || 1
    })
    if (craft) crafts.push(craft)
  }

  return { crafts, screenType: 'market' }
}

const parseRecipeScreen = (text, baseCatalog) => {
  const baseMap = new Map((baseCatalog?.crafts || []).map((c) => [c.name, c]))
  const segments = splitSegmentsByCraftOrder(text)
  const crafts = []

  for (const name of CRAFT_NAME_ORDER) {
    const segment = segments[name]
    if (!segment) continue

    const inputs = parseInputsNear(segment)
    if (inputs.length < 2) continue

    const existing = baseMap.get(name) || {}
    const bigNums = (segment.match(/\d{4,7}/g) || []).map(parseGoldNumber).filter((n) => n >= 1000)
    const price = bigNums.length ? Math.max(...bigNums) : existing.price || getDefaultCraft(name)?.price

    crafts.push(
      buildCraftFromDefaults(name, {
        inputs,
        price: price || getDefaultCraft(name)?.price,
        currentPrice: existing.currentPrice,
        maxPrice: existing.maxPrice,
        timeMinutes: existing.timeMinutes || 1,
        time: existing.time || 1
      })
    )
  }

  return { crafts, screenType: 'recipe' }
}

const parseCraftsFromOcrText = (text, baseCatalog) => {
  const fullText = String(text || '')
  const screenType = detectScreenType(fullText)

  if (screenType === 'recipe') {
    return parseRecipeScreen(fullText, baseCatalog)
  }
  return parseMarketScreen(fullText, baseCatalog)
}

const mergeParsedWithDefaults = (parsedCrafts) => {
  return (parsedCrafts || []).map((craft) => {
    const base = getDefaultCraft(craft.name)
    if (!base) return craft
    return {
      name: craft.name,
      price: base.price,
      inputs: base.inputs.map((i) => ({ ...i })),
      timeMinutes: craft.timeMinutes || base.timeMinutes,
      time: craft.time || base.timeMinutes,
      group: 'craft',
      currentPrice: craft.currentPrice != null ? craft.currentPrice : undefined,
      maxPrice: craft.maxPrice != null ? craft.maxPrice : undefined
    }
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
  CRAFT_RECIPE_DEFAULTS,
  getDefaultCraft,
  parseCraftsFromOcrText,
  mergeParsedWithDefaults,
  runTesseractOnFile
}
