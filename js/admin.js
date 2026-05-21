const STORAGE_ADMIN_SECRET = 'ddingtahe_admin_secret'
const CRAFTS_BROADCAST_CHANNEL = 'ddingtahe-crafts-updated'

const state = {
  catalog: { version: 1, updatedAt: null, crafts: [] },
  imageBase64: '',
  mimeType: 'image/png',
  pipelineRunning: false
}

const el = (id) => document.getElementById(id)

const getAdminSecret = () => {
  const input = el('adminSecret')
  const fromInput = input ? String(input.value || '').trim() : ''
  if (fromInput) return fromInput
  try {
    return String(localStorage.getItem(STORAGE_ADMIN_SECRET) || '').trim()
  } catch (_) {
    return ''
  }
}

const persistAdminSecret = () => {
  const secret = getAdminSecret()
  if (!secret) return
  try {
    localStorage.setItem(STORAGE_ADMIN_SECRET, secret)
  } catch (_) {}
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAdminSecret()}`
})

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const comma = dataUrl.indexOf(',')
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const mergeCraftsByName = (baseCatalog, incomingCatalog) => {
  const byName = new Map()
  ;(baseCatalog.crafts || []).forEach((craft) => {
    if (craft && craft.name) byName.set(craft.name, craft)
  })
  ;(incomingCatalog.crafts || []).forEach((craft) => {
    if (craft && craft.name) {
      byName.set(craft.name, {
        ...byName.get(craft.name),
        ...craft,
        group: 'craft'
      })
    }
  })
  return {
    version: baseCatalog.version || incomingCatalog.version || 1,
    updatedAt: new Date().toISOString(),
    crafts: Array.from(byName.values())
  }
}

const notifyMainSiteCraftsUpdated = (updatedAt) => {
  try {
    const channel = new BroadcastChannel(CRAFTS_BROADCAST_CHANNEL)
    channel.postMessage({ updatedAt: updatedAt || new Date().toISOString() })
    channel.close()
  } catch (_) {}
}

const setPipelineBusy = (busy) => {
  state.pipelineRunning = busy
  const dropZone = el('dropZone')
  const fileInput = el('imageInput')
  const overlay = el('pipelineOverlay')
  if (dropZone) {
    dropZone.classList.toggle('pointer-events-none', busy)
    dropZone.classList.toggle('opacity-60', busy)
  }
  if (fileInput) fileInput.disabled = busy
  if (overlay) overlay.classList.toggle('hidden', !busy)
  ;['analyzeBtn', 'saveBtn', 'loadBtn', 'addRowBtn', 'downloadBtn'].forEach((id) => {
    const btn = el(id)
    if (btn) btn.disabled = busy
  })
}

const renderCraftTable = () => {
  const tbody = el('craftTableBody')
  if (!tbody) return
  tbody.innerHTML = ''
  state.catalog.crafts.forEach((craft, index) => {
    const tr = document.createElement('tr')
    tr.className = 'border-b border-slate-700/60'
    const inputsText = (craft.inputs || [])
      .map((inp) => `${inp.name} x${inp.count}`)
      .join(', ')
    tr.innerHTML = `
      <td class="px-2 py-2"><input data-field="name" data-index="${index}" class="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${escapeHtml(craft.name)}" /></td>
      <td class="px-2 py-2"><input data-field="price" data-index="${index}" type="number" class="w-24 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${Number(craft.price) || 0}" /></td>
      <td class="px-2 py-2"><input data-field="timeMinutes" data-index="${index}" type="number" min="1" class="w-20 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${Number(craft.timeMinutes || craft.time) || 1}" /></td>
      <td class="px-2 py-2"><input data-field="inputs" data-index="${index}" class="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${escapeHtml(inputsText)}" title="재료1 x1, 재료2 x2 형식" /></td>
      <td class="px-2 py-2 text-center"><button type="button" data-remove="${index}" class="text-rose-400 hover:text-rose-300 text-sm" aria-label="행 삭제">삭제</button></td>
    `
    tbody.appendChild(tr)
  })
  updateJsonPreview()
}

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const parseInputsField = (text) => {
  const raw = String(text || '').trim()
  if (!raw) return []
  return raw.split(',').map((part) => {
    const piece = part.trim()
    const match = piece.match(/^(.+?)\s*x\s*(\d+)\s*$/i)
    if (match) {
      return { name: match[1].trim(), count: Math.max(1, parseInt(match[2], 10)) }
    }
    return { name: piece, count: 1 }
  }).filter((inp) => inp.name)
}

const syncCraftFromTable = () => {
  const tbody = el('craftTableBody')
  if (!tbody) return
  tbody.querySelectorAll('input[data-field]').forEach((input) => {
    const index = Number(input.getAttribute('data-index'))
    const field = input.getAttribute('data-field')
    if (!Number.isFinite(index) || !state.catalog.crafts[index]) return
    const craft = state.catalog.crafts[index]
    if (field === 'name') craft.name = String(input.value || '').trim()
    if (field === 'price') craft.price = Math.max(0, parseInt(input.value || '0', 10))
    if (field === 'timeMinutes') {
      const minutes = Math.max(1, parseInt(input.value || '1', 10))
      craft.timeMinutes = minutes
      craft.time = minutes
    }
    if (field === 'inputs') craft.inputs = parseInputsField(input.value)
    craft.group = 'craft'
  })
}

const updateJsonPreview = () => {
  const preview = el('jsonPreview')
  if (!preview) return
  preview.textContent = JSON.stringify(state.catalog, null, 2)
}

const setStatus = (message, isError) => {
  const status = el('statusMessage')
  if (!status) return
  status.textContent = message || ''
  status.className = isError
    ? 'text-sm text-rose-400'
    : 'text-sm text-emerald-400'
}

const setPipelineStep = (text) => {
  const step = el('pipelineStep')
  if (step) step.textContent = text || ''
}

const runAnalyzeApi = async () => {
  const response = await fetch('/api/admin/analyze', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      imageBase64: state.imageBase64,
      mimeType: state.mimeType
    })
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || body.detail || '분석 실패')
  return body.catalog || { crafts: [] }
}

const runSaveApi = async () => {
  syncCraftFromTable()
  state.catalog.updatedAt = new Date().toISOString()
  const response = await fetch('/api/admin/crafts', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(state.catalog)
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || body.message || '저장 실패')
  return body
}

const runAutoPipeline = async (file) => {
  if (state.pipelineRunning) return
  if (!file || !file.type.startsWith('image/')) {
    setStatus('이미지 파일만 업로드할 수 있습니다.', true)
    return
  }

  persistAdminSecret()
  const secret = getAdminSecret()
  if (!secret) {
    setStatus('먼저 ADMIN_SECRET을 입력한 뒤 다시 업로드하세요.', true)
    return
  }

  state.pipelineRunning = true
  setPipelineBusy(true)

  try {
    setPipelineStep('① 이미지 읽는 중…')
    setStatus('자동 처리 시작…', false)
    state.mimeType = file.type || 'image/png'
    state.imageBase64 = await fileToBase64(file)

    const preview = el('imagePreview')
    if (preview) {
      preview.src = URL.createObjectURL(file)
      preview.classList.remove('hidden')
    }

    const baseBeforeAnalyze = {
      version: state.catalog.version,
      crafts: (state.catalog.crafts || []).map((c) => ({ ...c }))
    }

    setPipelineStep('② GPT Vision으로 공예품 추출 중…')
    const extracted = await runAnalyzeApi()
    if (!extracted.crafts || !extracted.crafts.length) {
      throw new Error('이미지에서 공예품을 찾지 못했습니다. 더 넓은 UI 스크린샷을 올려주세요.')
    }

    state.catalog = mergeCraftsByName(baseBeforeAnalyze, extracted)
    renderCraftTable()

    setPipelineStep('③ 띵타해 웹에 저장 중…')
    const saveResult = await runSaveApi()
    state.catalog = saveResult.catalog || state.catalog
    updateJsonPreview()

    notifyMainSiteCraftsUpdated(state.catalog.updatedAt)

    setPipelineStep('')
    setStatus(
      `완료! 공예품 ${extracted.crafts.length}건 반영 → 메인 사이트(index.html)에 적용됨. 열린 탭은 즉시 갱신됩니다.`,
      false
    )
  } catch (error) {
    setPipelineStep('')
    setStatus(String(error.message || error), true)
  } finally {
    state.pipelineRunning = false
    setPipelineBusy(false)
    const fileInput = el('imageInput')
    if (fileInput) fileInput.value = ''
  }
}

const handleFileSelected = async (file) => {
  await runAutoPipeline(file)
}

const handleAnalyze = async () => {
  if (!state.imageBase64) {
    setStatus('먼저 스크린샷을 업로드하세요.', true)
    return
  }
  persistAdminSecret()
  if (!getAdminSecret()) {
    setStatus('관리자 비밀키(ADMIN_SECRET)를 입력하세요.', true)
    return
  }
  setPipelineBusy(true)
  setStatus('GPT Vision으로 레시피 추출 중…', false)
  try {
    const extracted = await runAnalyzeApi()
    state.catalog = mergeCraftsByName(state.catalog, extracted)
    renderCraftTable()
    setStatus(`추출 완료 (${extracted.crafts.length}개 병합)`, false)
  } catch (error) {
    setStatus(String(error.message || error), true)
  } finally {
    setPipelineBusy(false)
  }
}

const handleSave = async () => {
  persistAdminSecret()
  if (!getAdminSecret()) {
    setStatus('관리자 비밀키를 입력하세요.', true)
    return
  }
  if (!state.catalog.crafts.length) {
    setStatus('저장할 공예품 데이터가 없습니다.', true)
    return
  }
  setPipelineBusy(true)
  setStatus('저장 중…', false)
  try {
    const body = await runSaveApi()
    state.catalog = body.catalog || state.catalog
    updateJsonPreview()
    notifyMainSiteCraftsUpdated(state.catalog.updatedAt)
    setStatus('저장 완료. 메인 사이트에 반영됨.', false)
  } catch (error) {
    setStatus(String(error.message || error), true)
  } finally {
    setPipelineBusy(false)
  }
}

const handleDownloadJson = () => {
  syncCraftFromTable()
  state.catalog.updatedAt = new Date().toISOString()
  const blob = new Blob([JSON.stringify(state.catalog, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'crafts.json'
  a.click()
  URL.revokeObjectURL(url)
  setStatus('crafts.json 파일을 다운로드했습니다.', false)
}

const handleLoadCurrent = async () => {
  try {
    const response = await fetch('/api/crafts', { cache: 'no-store' })
    if (!response.ok) throw new Error('카탈로그 로드 실패')
    state.catalog = await response.json()
    renderCraftTable()
    setStatus(`현재 카탈로그 ${state.catalog.crafts.length}개 로드`, false)
  } catch (error) {
    setStatus(String(error.message || error), true)
  }
}

const handleAddRow = () => {
  state.catalog.crafts.push({
    name: '새 공예품',
    price: 0,
    time: 1,
    timeMinutes: 1,
    inputs: [],
    group: 'craft'
  })
  renderCraftTable()
}

const bindEvents = () => {
  const secretInput = el('adminSecret')
  if (secretInput) {
    try {
      secretInput.value = localStorage.getItem(STORAGE_ADMIN_SECRET) || ''
    } catch (_) {}
    secretInput.addEventListener('change', persistAdminSecret)
  }

  const fileInput = el('imageInput')
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0]
      if (file) handleFileSelected(file)
    })
  }

  const dropZone = el('dropZone')
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (!state.pipelineRunning) dropZone.classList.add('ring-2', 'ring-sky-400')
    })
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('ring-2', 'ring-sky-400')
    })
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault()
      dropZone.classList.remove('ring-2', 'ring-sky-400')
      if (state.pipelineRunning) return
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) handleFileSelected(file)
    })
    dropZone.addEventListener('click', () => {
      if (!state.pipelineRunning && fileInput) fileInput.click()
    })
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!state.pipelineRunning && fileInput) fileInput.click()
      }
    })
  }

  el('analyzeBtn')?.addEventListener('click', handleAnalyze)
  el('saveBtn')?.addEventListener('click', handleSave)
  el('downloadBtn')?.addEventListener('click', handleDownloadJson)
  el('loadBtn')?.addEventListener('click', handleLoadCurrent)
  el('addRowBtn')?.addEventListener('click', handleAddRow)

  el('craftTableBody')?.addEventListener('click', (e) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    const removeIdx = target.getAttribute('data-remove')
    if (removeIdx == null) return
    syncCraftFromTable()
    state.catalog.crafts.splice(Number(removeIdx), 1)
    renderCraftTable()
  })

  el('craftTableBody')?.addEventListener('input', () => {
    syncCraftFromTable()
    updateJsonPreview()
  })
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents()
  handleLoadCurrent()
})
