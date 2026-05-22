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
    if (craft.priceChange != null && craft.priceChange !== 0) {
      merged.priceChange = craft.priceChange
    } else if (prev.priceChange) {
      merged.priceChange = prev.priceChange
    }
    if (craft.maxPrice != null && craft.maxPrice > 0) {
      merged.maxPrice = craft.maxPrice
    } else if (prev.maxPrice) {
      merged.maxPrice = prev.maxPrice
    }
    if (craft.maxPricePercent != null && craft.maxPricePercent > 0) {
      merged.maxPricePercent = craft.maxPricePercent
    } else if (prev.maxPricePercent) {
      merged.maxPricePercent = prev.maxPricePercent
    }
    if (typeof window.applyFixedCraftRecipe === 'function') {
      byName.set(craft.name, window.applyFixedCraftRecipe(merged))
    } else {
      byName.set(craft.name, merged)
    }
  })

  const order =
    window.CRAFT_NAME_ORDER ||
    (window.CraftOcr && window.CraftOcr.CRAFT_NAME_ORDER) ||
    []
  const crafts = order
    .map((name) => {
      let item = byName.get(name)
      if (!item && typeof window.getDefaultCraftRecipe === 'function') {
        item = window.getDefaultCraftRecipe(name)
      }
      if (!item) return null
      return typeof window.applyFixedCraftRecipe === 'function'
        ? window.applyFixedCraftRecipe(item)
        : item
    })
    .filter(Boolean)

  return {
    version: baseCatalog.version || incomingCatalog.version || 1,
    updatedAt: new Date().toISOString(),
    crafts
  }
}

const CRAFT_CACHE_KEY = 'ddingtahe_craft_catalog_v1'

const saveCraftCatalogCache = (catalog) => {
  try {
    if (!catalog || !Array.isArray(catalog.crafts)) return
    localStorage.setItem(
      CRAFT_CACHE_KEY,
      JSON.stringify({
        updatedAt: catalog.updatedAt || new Date().toISOString(),
        crafts: catalog.crafts
      })
    )
  } catch (_) {}
}

const notifyMainSiteCraftsUpdated = (catalogOrAt) => {
  const payload =
    catalogOrAt && catalogOrAt.crafts
      ? catalogOrAt
      : { updatedAt: catalogOrAt || new Date().toISOString(), crafts: state.catalog.crafts }
  saveCraftCatalogCache(payload.crafts ? payload : state.catalog)
  try {
    const channel = new BroadcastChannel(CRAFTS_BROADCAST_CHANNEL)
    channel.postMessage({
      updatedAt: payload.updatedAt || new Date().toISOString(),
      catalog: payload.crafts ? payload : state.catalog
    })
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
  const fixBtn = el('fixRecipesBtn')
  const manualBtn = el('manualSaveBtn')
  if (fixBtn) fixBtn.disabled = !enabled
  if (manualBtn) manualBtn.disabled = !enabled
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
        ? '시세 변동 화면 — 시세·변동폭·최고가 갱신 (레시피 고정)'
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
    const defaults = window.CraftOcr.getDefaultCraft(name)
    const craft = map.get(name) || defaults || { name, price: 0, currentPrice: 0, maxPrice: 0 }
    const fixedPrice = defaults ? defaults.price : Number(craft.price) || 0
    const tr = document.createElement('tr')
    tr.className = 'border-b border-slate-700/60'
    tr.innerHTML = `
      <td class="px-2 py-2 text-slate-300">${name}</td>
      <td class="px-2 py-2 text-slate-400 text-sm">${fixedPrice.toLocaleString()} <span class="text-xs text-slate-600">(고정)</span></td>
      <td class="px-2 py-2"><input data-field="currentPrice" data-index="${index}" type="number" class="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${Number(craft.currentPrice) || 0}" title="NPC 현재 시세" /></td>
      <td class="px-2 py-2"><input data-field="priceChange" data-index="${index}" type="number" class="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" value="${Number(craft.priceChange) || 0}" title="▲ 양수, ▼ 음수" /></td>
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
    const defaults = window.CraftOcr.getDefaultCraft(name)
    const craft = byName.get(name) || defaults || { name, group: 'craft', inputs: [], timeMinutes: 1, time: 1 }
    if (field === 'currentPrice' || field === 'maxPrice') {
      craft[field] = Math.max(0, parseInt(input.value || '0', 10))
    }
    if (field === 'priceChange') {
      craft.priceChange = parseInt(input.value || '0', 10)
    }
    if (defaults) {
      craft.price = defaults.price
      craft.inputs = defaults.inputs.map((i) => ({ ...i }))
    }
    craft.group = 'craft'
    byName.set(name, craft)
  })

  state.catalog.crafts = names
    .map((name) => {
      const craft = byName.get(name)
      if (!craft) return null
      return typeof window.applyFixedCraftRecipe === 'function'
        ? window.applyFixedCraftRecipe(craft)
        : craft
    })
    .filter(Boolean)
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
  if (typeof window.applyFixedCraftRecipe === 'function' && state.catalog.crafts) {
    state.catalog.crafts = state.catalog.crafts.map((c) => window.applyFixedCraftRecipe(c))
  }
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
  return window.CraftOcr.parseCraftsFromOcrText(text, state.catalog)
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

    setPipelineStep('② OCR 인식 중… (시세 변동 화면 권장)')
    const extracted = await runClientOcr(file)
    setOcrPreview(state.lastOcrText, extracted.crafts || [], extracted.screenType)

    if (!extracted.crafts || extracted.crafts.length < 6) {
      renderManualTable(state.catalog)
      throw new Error(
        'OCR로 공예품 6종을 모두 읽지 못했습니다. 「공예품 시세 변동」전체 화면을 선명하게 올리거나, 아래 표에서 직접 입력 후 「수동 저장」하세요.'
      )
    }

    state.catalog = mergeCraftsByName(baseBeforeAnalyze, extracted)
    renderManualTable(state.catalog)

    setPipelineStep('③ Supabase에 저장 중…')
    state.lastSaveSource = 'ocr'
    const saveResult = await runSaveApi()
    state.catalog = saveResult.catalog || state.catalog
    renderManualTable(state.catalog)

    saveCraftCatalogCache(state.catalog)
    notifyMainSiteCraftsUpdated(state.catalog)

    setPipelineStep('')
    const n = extracted.priceUpdatedCount || 0
    setStatus(
      `완료! 공예품 6종 저장 (시세 OCR 반영 ${n}건). index.html을 새로고침하세요.`,
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
    saveCraftCatalogCache(state.catalog)
    notifyMainSiteCraftsUpdated(state.catalog)
    setStatus('수동 저장 완료 (6종). index.html을 새로고침하세요.', false)
  } catch (error) {
    setStatus(fetchApiErrorMessage(error), true)
  } finally {
    setPipelineBusy(false)
  }
}

const handleFileSelected = async (file) => {
  await runAutoPipeline(file)
}

const handleFixRecipes = async () => {
  if (!state.authenticated) {
    setStatus('먼저 로그인하세요.', true)
    return
  }
  try {
    setStatus('위키 레시피 복구 중…', false)
    const res = await fetch('/api/admin/fix-recipes', {
      method: 'POST',
      headers: authHeaders()
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message || body.error || '복구 실패')
    await loadCatalogFromApi()
    renderManualTable(state.catalog)
    if (body.catalog) {
      state.catalog = body.catalog
      saveCraftCatalogCache(state.catalog)
      notifyMainSiteCraftsUpdated(state.catalog)
    }
    setStatus(body.message || '레시피 복구 완료 (6종)', false)
  } catch (err) {
    setStatus(String(err.message || err), true)
  }
}

const bindEvents = () => {
  el('loginBtn')?.addEventListener('click', handleLogin)
  el('fixRecipesBtn')?.addEventListener('click', handleFixRecipes)
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
