/**
 * 공예품 시세 변동 OCR
 * - 최고가의 N% 블록 분리 + 공예품 이름 앵커 보조
 * - 시세 상한·% 교차 검증으로 숫자 후보 선택
 */
const CRAFT_NAME_ORDER = window.CRAFT_NAME_ORDER || [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

const CRAFT_NAME_ALIASES = {
  '조개껍데기 브로치': ['조개껍데기', '브로치'],
  '푸른 향수병': ['향수병', '푸른 향수'],
  '자개 손거울': ['손거울', '자개 손'],
  '분홍 헤어핀': ['헤어핀', '분홍 헤'],
  '자개 부채': ['자개부채', '부채'],
  '흑진주 시계': ['흑진주', '시계']
}

const getCeiling = (name) =>
  typeof window.getCraftMaxPrice === 'function' ? window.getCraftMaxPrice(name) : 0

const parseGoldNumber = (raw) => {
  let s = String(raw || '')
  s = s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}

/** OCR에서 끊긴 숫자: "14, 776" "235 913" → 붙이기 */
const normalizeOcrText = (text) => {
  let t = String(text || '').replace(/\r/g, '')
  t = t.replace(/[|｜]/g, '1')
  t = t.replace(/최\s*고\s*가?\s*의?/gi, '최고가의')
  t = t.replace(/골\s*드/gi, 'Gold')
  t = t.replace(/G\s*0\s*l\s*d/gi, 'Gold')
  t = t.replace(/6old/gi, 'Gold')
  t = t.replace(/GOLD/g, 'Gold')
  for (let i = 0; i < 3; i++) {
    t = t.replace(/(\d)[\s.,]+(\d{3}\b)/g, '$1$2')
  }
  return t
}

const extractMaxPricePercent = (segment) => {
  const patterns = [
    /최고가의\s*(\d{1,3})\s*%/i,
    /최고\s*가\s*의?\s*(\d{1,3})\s*%/i,
    /(\d{1,3})\s*%\s*(?:도달|까지|상한)?/
  ]
  for (const re of patterns) {
    const m = String(segment || '').match(re)
    if (!m) continue
    const p = parseInt(m[1], 10)
    if (p >= 1 && p <= 100) return p
  }
  return 0
}

const extractPriceChange = (text) => {
  const t = String(text || '')
  const patterns = [
    /(?:▲|△|↑|＋|\+)\s*([\dOo,\s.]{3,})/,
    /(?:▼|▽|↓|－|-)\s*([\dOo,\s.]{3,})/,
    /(?:▲|▼)\s*([\dOo,\s.]{3,})/
  ]
  for (const re of patterns) {
    const up = t.match(new RegExp('(?:▲|△|↑|＋|\\+)\\s*([\\dOo,\\s.]{3,})'))
    if (up) return parseGoldNumber(up[1])
    const down = t.match(/(?:▼|▽|↓|－|-)\s*([\dOo,\s.]{3,})/)
    if (down) return -parseGoldNumber(down[1])
  }
  return 0
}

const collectNumberCandidates = (text, excludeAbs, percent) => {
  const found = []
  const seen = new Set()
  const push = (n, priority) => {
    if (!n || n < 1000 || n > 2000000) return
    if (excludeAbs && n === excludeAbs) return
    if (percent >= 1 && percent <= 100 && n === percent) return
    if (seen.has(n)) return
    seen.add(n)
    found.push({ n, priority })
  }

  const goldRe = /([\dOo,\s.]{4,})\s*(?:Gold|골드)/gi
  let gm
  while ((gm = goldRe.exec(text))) {
    push(parseGoldNumber(gm[1]), 10)
  }

  const re = /\d{1,3}(?:[,\s.]?\d{3})+|\d{4,7}/g
  let m
  while ((m = re.exec(text))) {
    const n = parseGoldNumber(m[0])
    if (n >= 1000 && n <= 100) continue
    push(n, 1)
  }

  return found
}

const pickCurrentPrice = (name, chunk, percent, changeAbs) => {
  const ceiling = getCeiling(name)
  const candidates = collectNumberCandidates(chunk, changeAbs)

  if (!candidates.length) return 0

  if (percent >= 1 && percent <= 100 && ceiling) {
    const target = (ceiling * percent) / 100
    let best = candidates[0]
    let bestDiff = Infinity
    candidates.forEach((c) => {
      const diff = Math.abs(c.n - target)
      const score = diff + (10 - c.priority) * 5000
      if (score < bestDiff) {
        bestDiff = score
        best = c
      }
    })
    if (best && Math.abs(best.n - target) / Math.max(target, 1) <= 0.35) {
      return best.n
    }
  }

  const goldFirst = candidates.filter((c) => c.priority >= 10).sort((a, b) => b.n - a.n)
  if (goldFirst.length) {
    const underCeiling = goldFirst.find((c) => !ceiling || c.n <= ceiling * 1.05)
    return (underCeiling || goldFirst[0]).n
  }

  const sorted = [...candidates].sort((a, b) => b.priority - a.priority || a.n - b.n)
  const reasonable = sorted.filter((c) => !ceiling || (c.n >= 1000 && c.n <= ceiling * 1.05))
  return (reasonable[0] || sorted[0]).n
}

const extractMarketPricesFromChunk = (name, chunk) => {
  const text = String(chunk || '')
  const maxPricePercent = extractMaxPricePercent(text)
  const priceChange = extractPriceChange(text)
  const changeAbs = Math.abs(priceChange)
  let currentPrice = pickCurrentPrice(name, text, maxPricePercent, changeAbs)

  if (currentPrice && typeof window.repairCraftCurrentPrice === 'function') {
    currentPrice = window.repairCraftCurrentPrice(name, currentPrice)
  }

  return { currentPrice, priceChange, maxPricePercent }
}

const findPercentMarkers = (text) => {
  const markers = []
  const re = /최고가의\s*(\d{1,3})\s*%/gi
  let m
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 320), m.index)
    if (!/\d{3,}/.test(before)) continue
    markers.push({
      index: m.index,
      percent: parseInt(m[1], 10),
      end: m.index + m[0].length
    })
  }
  return markers
}

const selectSixMarkers = (markers) => {
  if (markers.length === 6) return markers
  if (markers.length > 6) return markers.slice(-6)
  return markers
}

const parseMarketScreenByPercentBlocks = (text) => {
  const markers = selectSixMarkers(findPercentMarkers(text))
  if (markers.length < 6) return null

  return markers.map((marker, i) => {
    const start = i === 0 ? 0 : markers[i - 1].end
    const end = marker.end
    const chunk = text.slice(start, end)
    const prices = extractMarketPricesFromChunk(CRAFT_NAME_ORDER[i], chunk)
    if (!prices.maxPricePercent) prices.maxPricePercent = marker.percent
    return {
      name: CRAFT_NAME_ORDER[i],
      ...prices
    }
  })
}

const findNameIndex = (text, name) => {
  const full = text.indexOf(name)
  if (full >= 0) return full
  const aliases = CRAFT_NAME_ALIASES[name] || []
  for (const alias of aliases) {
    const idx = text.indexOf(alias)
    if (idx >= 0) return idx
  }
  return -1
}

const parseMarketScreenByNameAnchors = (text) => {
  const indices = CRAFT_NAME_ORDER.map((name) => ({
    name,
    index: findNameIndex(text, name)
  }))

  const found = indices.filter((x) => x.index >= 0).sort((a, b) => a.index - b.index)
  if (found.length < 4) return null

  return CRAFT_NAME_ORDER.map((name) => {
    const pos = indices.find((x) => x.name === name)
    if (!pos || pos.index < 0) {
      return { name, currentPrice: 0, priceChange: 0, maxPricePercent: 0 }
    }
    const next = found.find((x) => x.index > pos.index)
    const end = next ? next.index : text.length
    const chunk = text.slice(pos.index, end)
    return { name, ...extractMarketPricesFromChunk(name, chunk) }
  })
}

const scoreRow = (name, row) => {
  const ceiling = getCeiling(name)
  const cur = Number(row.currentPrice) || 0
  const pct = Number(row.maxPricePercent) || 0
  let score = 0
  if (cur >= 1000) score += 40
  if (row.priceChange) score += 10
  if (pct >= 1 && pct <= 100) score += 20
  if (ceiling && cur && pct) {
    const expected = (ceiling * pct) / 100
    const diff = Math.abs(cur - expected) / Math.max(expected, 1)
    if (diff <= 0.12) score += 30
    else if (diff <= 0.25) score += 15
    else score -= 20
  }
  if (ceiling && cur > ceiling * 1.08) score -= 30
  return score
}

const mergeParseRows = (blockRows, anchorRows) => {
  const blockMap = new Map((blockRows || []).map((r) => [r.name, r]))
  const anchorMap = new Map((anchorRows || []).map((r) => [r.name, r]))

  return CRAFT_NAME_ORDER.map((name) => {
    const block = blockMap.get(name)
    const anchor = anchorMap.get(name)
    if (!block && !anchor) return null
    if (!block) return anchor
    if (!anchor) return block

    const blockScore = scoreRow(name, block)
    const anchorScore = scoreRow(name, anchor)
    const pick = blockScore >= anchorScore ? block : anchor

    const merged = { name, ...pick }
    if (!merged.maxPricePercent && block.maxPricePercent) {
      merged.maxPricePercent = block.maxPricePercent
    }
    if (!merged.maxPricePercent && anchor.maxPricePercent) {
      merged.maxPricePercent = anchor.maxPricePercent
    }
    if (!merged.currentPrice && block.currentPrice) merged.currentPrice = block.currentPrice
    if (!merged.currentPrice && anchor.currentPrice) merged.currentPrice = anchor.currentPrice
    if (!merged.priceChange && block.priceChange) merged.priceChange = block.priceChange
    if (!merged.priceChange && anchor.priceChange) merged.priceChange = anchor.priceChange

    return merged
  }).filter(Boolean)
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

const validateParsedRows = (rows) => {
  const issues = []
  ;(rows || []).forEach((row) => {
    const ceiling = getCeiling(row.name)
    const cur = Number(row.currentPrice) || 0
    const pct = Number(row.maxPricePercent) || 0
    if (cur < 1000) {
      issues.push(`${row.name}: 현재 시세 미인식`)
      return
    }
    if (ceiling && pct && cur) {
      const expected = Math.round((ceiling * pct) / 100)
      const diff = Math.abs(cur - expected) / Math.max(expected, 1)
      if (diff > 0.28) {
        issues.push(
          `${row.name}: ${cur.toLocaleString()}G ↔ 최고가 ${pct}% (약 ${expected.toLocaleString()}G 예상)`
        )
      }
    }
  })
  return issues
}

const parseMarketScreen = (text) => {
  const normalized = normalizeOcrText(text)
  const blockRows = parseMarketScreenByPercentBlocks(normalized)
  const anchorRows = parseMarketScreenByNameAnchors(normalized)
  const markerCount = findPercentMarkers(normalized).length

  let merged = null
  if (blockRows && blockRows.length >= 6) {
    merged = anchorRows ? mergeParseRows(blockRows, anchorRows) : blockRows
  } else if (anchorRows) {
    merged = anchorRows
  }

  if (!merged || merged.length < 6) {
    return {
      crafts: [],
      screenType: 'market',
      priceUpdatedCount: 0,
      markerCount,
      validationIssues: ['「최고가의 N%」6줄 또는 공예품 이름 4개 이상이 필요합니다.']
    }
  }

  const crafts = merged.map((row) => buildCraftFromOcrRow(row.name, row)).filter(Boolean)
  const priceUpdated = crafts.filter((c) => c.currentPrice >= 1000).length
  const validationIssues = validateParsedRows(merged)

  return {
    crafts,
    screenType: 'market',
    priceUpdatedCount: priceUpdated,
    markerCount,
    validationIssues,
    confidenceOk: validationIssues.length === 0 && priceUpdated >= 6
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

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: '6'
      })
    } catch (_) {}

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
  extractMarketPricesFromChunk,
  normalizeOcrText,
  validateParsedRows
}
