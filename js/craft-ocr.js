/**
 * 브라우저 Tesseract OCR → 공예품 데이터 파싱 (OpenAI 불필요)
 */
const CRAFT_NAME_ORDER = [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

const MATERIAL_HINTS = [
  '깨진 조개껍데기', '노란빛 진주', '푸른빛 진주', '청록빛 진주', '분홍빛 진주', '보라빛 진주', '흑진주',
  '금속 재활용품', '합금 재활용품', '합성수지 재활용품', '플라스틱 재활용품', '섬유 재활용품',
  '거미줄', '양동이', '유리판', '대나무', '분홍 꽃잎', '막대기', '자수정 조각', '흑요석', '시계'
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

const extractNumbersFromSegment = (segment) => {
  const matches = String(segment || '').match(/\d[\d,.\s]{1,12}\d|\d{4,}/g) || []
  const nums = matches.map(parseGoldNumber).filter((n) => n >= 100)
  return [...new Set(nums)]
}

const pickPricesFromNumbers = (nums, existing) => {
  const sorted = [...nums].sort((a, b) => a - b)
  let currentPrice = existing?.currentPrice || 0
  let maxPrice = existing?.maxPrice || 0
  let price = existing?.price || 0

  if (sorted.length >= 2) {
    currentPrice = sorted[0]
    maxPrice = sorted[sorted.length - 1]
    if (maxPrice < currentPrice) {
      const t = currentPrice
      currentPrice = maxPrice
      maxPrice = t
    }
  } else if (sorted.length === 1) {
    currentPrice = sorted[0]
    maxPrice = existing?.maxPrice || sorted[0]
  }

  if (!price && currentPrice) price = currentPrice
  return { price, currentPrice, maxPrice }
}

const parseInputsNear = (segment) => {
  const inputs = []
  for (const mat of MATERIAL_HINTS) {
    if (!fuzzyIncludes(segment, mat)) continue
    const escaped = mat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const countMatch = segment.match(new RegExp(escaped + '\\s*[x×X\\*]?\\s*(\\d+)', 'i'))
    const count = countMatch ? Math.max(1, parseInt(countMatch[1], 10)) : 1
    inputs.push({ name: mat, count })
  }
  return inputs
}

const parseCraftsFromOcrText = (text, baseCatalog) => {
  const baseMap = new Map((baseCatalog?.crafts || []).map((c) => [c.name, c]))
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(normalizeOcrLine)
    .filter(Boolean)
  const fullText = lines.join('\n')

  const crafts = []

  for (const name of CRAFT_NAME_ORDER) {
    let lineIdx = lines.findIndex((line) => fuzzyIncludes(line, name) || line.includes(name))
    let segment = ''
    if (lineIdx >= 0) {
      segment = lines.slice(lineIdx, lineIdx + 8).join(' ')
    } else if (fuzzyIncludes(fullText, name)) {
      const compact = fullText.replace(/\s/g, '')
      const compactName = name.replace(/\s/g, '')
      const pos = compact.indexOf(compactName)
      if (pos >= 0) {
        segment = fullText.slice(Math.max(0, pos - 20), pos + 220)
      }
    }

    if (!segment) continue

    const existing = baseMap.get(name) || {}
    const nums = extractNumbersFromSegment(segment)
    const labeledCurrent = segment.match(/현재[^0-9]*(\d[\d,.\s]*\d|\d{3,})/i)
    const labeledMax = segment.match(/최고[^0-9]*(\d[\d,.\s]*\d|\d{3,})/i)

    let currentPrice = labeledCurrent ? parseGoldNumber(labeledCurrent[1]) : 0
    let maxPrice = labeledMax ? parseGoldNumber(labeledMax[1]) : 0
    const picked = pickPricesFromNumbers(nums, existing)

    if (!currentPrice) currentPrice = picked.currentPrice
    if (!maxPrice) maxPrice = picked.maxPrice
    const price = picked.price || existing.price || currentPrice || 0

    const inputs = parseInputsNear(segment)
    const craft = {
      name,
      price: price || 0,
      timeMinutes: existing.timeMinutes || existing.time || 1,
      time: existing.timeMinutes || existing.time || 1,
      group: 'craft',
      inputs: inputs.length ? inputs : existing.inputs || []
    }
    if (currentPrice) craft.currentPrice = currentPrice
    if (maxPrice) craft.maxPrice = maxPrice

    crafts.push(craft)
  }

  return { crafts }
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
  parseCraftsFromOcrText,
  runTesseractOnFile
}
