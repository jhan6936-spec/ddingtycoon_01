const STORAGE_ADMIN_SECRET = 'ddingtahe_admin_secret'
const CRAFTS_BROADCAST_CHANNEL = 'ddingtahe-crafts-updated'

const state = {
  catalog: { version: 1, updatedAt: null, crafts: [] },
  pipelineRunning: false,
  authenticated: false,
  lastOcrText: '',
  lastSaveSource: 'ocr'
}

const el = (id) => document.getElementById(id)

const getAdminSecret = () => {
  const input = el('adminSecret')
  return input ? String(input.value || '').trim() : ''
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAdminSecret()}`
})

const mergeCraftsByName = (baseCatalog, incomingCatalog) => {
  const byName = new Map()
  ;(baseCatalog.crafts || []).forEach((craft) => {
    if (craft && craft.name) byName.set(craft.name, { ...craft })
  })
  ;(incomingCatalog.crafts || []).forEach((craft) => {
    if (!craft || !craft.name) return
    const defaults =
      window.CraftOcr && typeof window.CraftOcr.getDefaultCraft === 'function'
        ? window.CraftOcr.getDefaultCraft(craft.name)
        : null
    const prev = byName.get(craft.name) || {}
    const merged = {
      ...prev,
      name: craft.name,
      group: 'craft',
      price: defaults ? defaults.price : prev.price || craft.price,
      inputs: defaults
        ? defaults.inputs.map((i) => ({ ...i }))
        : prev.inputs && prev.inputs.length
          ? prev.inputs
          : craft.inputs || [],
      timeMinutes: prev.timeMinutes || craft.timeMinutes || 1,
      time: prev.time || craft.time || 1
    }
    if (craft.currentPrice != null && craft.currentPrice > 0) {
      merged.currentPrice = craft.currentPrice
    } else if (prev.currentPrice) {
      merged.currentPrice = prev.currentPrice
    }
    if (craft.maxPrice != null && craft.maxPrice > 0) {
      merged.maxPrice = craft.maxPrice
    } else if (prev.maxPrice) {
      merged.maxPrice = prev.maxPrice
    }
    byName.set(craft.name, merged)
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
  if (overlay) overlay.classList.toggle('hidden', !busy)
}

const setStatus = (message, isError) => {
  const status = el('statusMessage')
  if (!status) return
  status.textContent = message || ''
  status.className = isError ? 'text-sm text-rose-400' : 'text-sm text-emerald-400'
}

const setAuthMessage = (message, isError) => {
  const auth = el('authMessage')
  if (!auth) return
  auth.textContent = message || ''
  auth.className = isError ? 'text-sm text-rose-400' : 'text-sm text-emerald-400'
}

const setUploadEnabled = (enabled) => {
  const fileInput = el('imageInput')
  const dropZone = el('dropZone')
  const title = el('dropZoneTitle')
  if (fileInput) fileInput.disabled = !enabled
  if (dropZone) {
    dropZone.classList.toggle('opacity-50', !enabled)
    dropZone.classList.toggle('cursor-not-allowed', !enabled)
  }
  if (title) {
    title.textContent = enabled
      ? '공예 UI 스크린샷을 드래그하거나 클릭 (무료 OCR)'
      : '로그인 후 스크린샷을 드래그하거나 클릭'
  }
}

const setPipelineStep = (text) => {
  const step = el('pipelineStep')
  if (step) step.textContent = text || ''
}

const setOcrPreview = (text, crafts, screenType) => {
  const pre = el('ocrTextPreview')
  const summary = el('ocrParseSummary')
  if (pre) pre.textContent = text || '(인식된 텍스트 없음)'
  if (summary) {
    const mode =
      screenType === 'market'
        ? '시세 변동 화면 — 현재가·최고가만 갱신 (레시피 고정)'
        : screenType === 'recipe'
          ? '제작 화면 — 재료 인식'
          : ''
    summary.textContent = crafts.length
      ? `${mode} · ${crafts.map((c) => c.name).join(', ')}`
      : '공예품 이름을 찾지 못했습니다. 시세 변동 전체 화면을 올리거나 아래에서 수동 입력하세요.'
  }
}

const renderManualTable = (catalog) => {
  const tbody = el('manualTableBody')
  if (!tbody || !window.CraftOcr) return
  tbody.innerHTML = ''
  const names = window.CraftOcr.CRAFT_NAME_ORDER
  const map = new Map((catalog.crafts || []).map((c) => [c.name, c]))

  names.forEach((name, index) => {
    const craft = map.get(name) || { name, price: 0, currentPrice: 0, maxPrice: 0, timeMinutes: 1, inputs: [] }
    const tr = document.createElement('tr')
    tr.className = 'border-b border-slate-700/60'
    tr.innerHTML = `
      <td class="px-2 py-2 text-slate-300">${name}</td>
      <td class="px-2 py-2"><input data-field="price" data-index="${index}" type="number" class="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${Number(craft.price) || 0}" /></td>
      <td class="px-2 py-2"><input data-field="currentPrice" data-index="${index}" type="number" class="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${Number(craft.currentPrice) || 0}" /></td>
      <td class="px-2 py-2"><input data-field="maxPrice" data-index="${index}" type="number" class="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${Number(craft.maxPrice) || 0}" /></td>
    `
    tbody.appendChild(tr)
  })
}

const syncManualTableToCatalog = () => {
  if (!window.CraftOcr) return
  const names = window.CraftOcr.CRAFT_NAME_ORDER
  const tbody = el('manualTableBody')
  if (!tbody) return

  const byName = new Map((state.catalog.crafts || []).map((c) => [c.name, { ...c }]))
  tbody.querySelectorAll('input[data-field]').forEach((input) => {
    const index = Number(input.getAttribute('data-index'))
    const field = input.getAttribute('data-field')
    const name = names[index]
    if (!name) return
    const craft = byName.get(name) || { name, group: 'craft', inputs: [], timeMinutes: 1, time: 1 }
    craft[field] = Math.max(0, parseInt(input.value || '0', 10))
    if (field === 'price' && !craft.currentPrice) craft.currentPrice = craft.price
    craft.group = 'craft'
    byName.set(name, craft)
  })

  state.catalog.crafts = names.map((name) => byName.get(name)).filter(Boolean)
}

const fetchApiErrorMessage = (error) => {
  const msg = String(error?.message || error || '')
  if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return 'API 연결 실패. Vercel 배포 URL(https://…vercel.app/admin.html)에서 열었는지, 최신 코드가 배포됐는지 확인하세요.'
  }
  return msg
}

const loadCatalogFromApi = async () => {
  const response = await fetch('/api/crafts', { cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || body.error || '공예품 데이터 로드 실패')
  }
  state.catalog = await response.json()
  renderManualTable(state.catalog)
}

const runClientOcr = async (file) => {
  if (!window.CraftOcr) throw new Error('OCR 모듈이 로드되지 않았습니다.')
  let progress = 0
  const text = await window.CraftOcr.runTesseractOnFile(file, (pct) => {
    progress = pct
    setPipelineStep(`② OCR 인식 중… ${pct}%`)
  })
  state.lastOcrText = text
  const parsed = window.CraftOcr.parseCraftsFromOcrText(text, state.catalog)
  return parsed
}

const runSaveApi = async () => {
  syncManualTableToCatalog()
  state.catalog.updatedAt = new Date().toISOString()
  const response = await fetch('/api/admin/crafts', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      ...state.catalog,
      source: state.lastSaveSource || 'ocr'
    })
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || body.message || body.hint || '저장 실패')
  return body
}

const handleLogin = async () => {
  const secret = getAdminSecret()
  if (!secret) {
    setAuthMessage('비밀번호를 입력하세요.', true)
    state.authenticated = false
    setUploadEnabled(false)
    return
  }

  const btn = el('loginBtn')
  if (btn) {
    btn.disabled = true
    btn.textContent = '확인 중…'
  }
  setAuthMessage('비밀번호 확인 중…', false)

  try {
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: authHeaders(),
      body: '{}'
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.ok) {
      state.authenticated = false
      setUploadEnabled(false)
      try {
        localStorage.removeItem(STORAGE_ADMIN_SECRET)
      } catch (_) {}
      setAuthMessage(body.message || '비밀번호가 올바르지 않습니다.', true)
      return
    }

    state.authenticated = true
    try {
      localStorage.setItem(STORAGE_ADMIN_SECRET, secret)
    } catch (_) {}
    setAuthMessage('인증되었습니다.', false)
    setUploadEnabled(true)
    await loadCatalogFromApi()
    setStatus('사진 업로드 시 무료 OCR로 분석 후 Supabase에 저장됩니다. (OpenAI 불필요)', false)
  } catch (error) {
    state.authenticated = false
    setUploadEnabled(false)
    setAuthMessage(fetchApiErrorMessage(error), true)
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = '로그인'
    }
  }
}

const tryAutoLogin = async () => {
  try {
    const saved = localStorage.getItem(STORAGE_ADMIN_SECRET)
    if (!saved) return
    const input = el('adminSecret')
    if (input) input.value = saved
    await handleLogin()
  } catch (_) {}
}

const runAutoPipeline = async (file) => {
  if (state.pipelineRunning) return
  if (!state.authenticated) {
    setStatus('먼저 로그인하세요.', true)
    return
  }
  if (!file || !file.type.startsWith('image/')) {
    setStatus('이미지 파일만 업로드할 수 있습니다.', true)
    return
  }

  state.pipelineRunning = true
  setPipelineBusy(true)

  try {
    setPipelineStep('① 이미지 준비…')
    setStatus('자동 처리 시작 (Tesseract OCR)…', false)

    const preview = el('imagePreview')
    if (preview) {
      preview.src = URL.createObjectURL(file)
      preview.classList.remove('hidden')
    }

    await loadCatalogFromApi()
    const baseBeforeAnalyze = {
      version: state.catalog.version,
      crafts: (state.catalog.crafts || []).map((c) => ({ ...c }))
    }

    setPipelineStep('② OCR 인식 중… (한글, 무료)')
    const extracted = await runClientOcr(file)
    setOcrPreview(state.lastOcrText, extracted.crafts || [])

    if (!extracted.crafts || !extracted.crafts.length) {
      renderManualTable(state.catalog)
      throw new Error(
        'OCR로 공예품을 찾지 못했습니다. 글자가 선명한 스크린샷을 올리거나, 아래 표에서 가격을 직접 입력한 뒤 「수동 저장」을 누르세요.'
      )
    }

    state.catalog = mergeCraftsByName(baseBeforeAnalyze, extracted)
    renderManualTable(state.catalog)

    setPipelineStep('③ Supabase에 저장 중…')
    state.lastSaveSource = 'ocr'
    const saveResult = await runSaveApi()
    state.catalog = saveResult.catalog || state.catalog
    renderManualTable(state.catalog)

    notifyMainSiteCraftsUpdated(state.catalog.updatedAt)

    setPipelineStep('')
    setStatus(
      `완료! 공예품 ${extracted.crafts.length}건 반영됨. index.html에서 확인하세요.`,
      false
    )
  } catch (error) {
    setPipelineStep('')
    setStatus(fetchApiErrorMessage(error), true)
    renderManualTable(state.catalog)
  } finally {
    state.pipelineRunning = false
    setPipelineBusy(false)
    const fileInput = el('imageInput')
    if (fileInput) fileInput.value = ''
  }
}

const handleManualSave = async () => {
  if (!state.authenticated) {
    setStatus('먼저 로그인하세요.', true)
    return
  }
  setPipelineBusy(true)
  setStatus('수동 입력 저장 중…', false)
  try {
    syncManualTableToCatalog()
    state.lastSaveSource = 'manual'
    const saveResult = await runSaveApi()
    state.catalog = saveResult.catalog || state.catalog
    notifyMainSiteCraftsUpdated(state.catalog.updatedAt)
    setStatus('수동 저장 완료. 메인 사이트에 반영되었습니다.', false)
  } catch (error) {
    setStatus(fetchApiErrorMessage(error), true)
  } finally {
    setPipelineBusy(false)
  }
}

const handleFileSelected = async (file) => {
  await runAutoPipeline(file)
}

const bindEvents = () => {
  el('loginBtn')?.addEventListener('click', handleLogin)
  el('adminSecret')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
  el('manualSaveBtn')?.addEventListener('click', handleManualSave)

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
      if (!state.pipelineRunning && state.authenticated) {
        dropZone.classList.add('ring-2', 'ring-sky-400')
      }
    })
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('ring-2', 'ring-sky-400')
    })
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault()
      dropZone.classList.remove('ring-2', 'ring-sky-400')
      if (state.pipelineRunning || !state.authenticated) return
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) handleFileSelected(file)
    })
    dropZone.addEventListener('click', () => {
      if (!state.pipelineRunning && state.authenticated && fileInput) fileInput.click()
    })
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!state.pipelineRunning && state.authenticated && fileInput) fileInput.click()
      }
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents()
  setUploadEnabled(false)
  tryAutoLogin()
})
