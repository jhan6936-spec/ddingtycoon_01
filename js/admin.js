const STORAGE_ADMIN_SECRET = 'ddingtahe_admin_secret'
const CRAFTS_BROADCAST_CHANNEL = 'ddingtahe-crafts-updated'

const state = {
  catalog: { version: 1, updatedAt: null, crafts: [] },
  imageBase64: '',
  mimeType: 'image/png',
  pipelineRunning: false,
  authenticated: false
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
      ? '공예 UI 스크린샷을 드래그하거나 클릭'
      : '로그인 후 스크린샷을 드래그하거나 클릭'
  }
}

const setPipelineStep = (text) => {
  const step = el('pipelineStep')
  if (step) step.textContent = text || ''
}

const loadCatalogFromApi = async () => {
  try {
    const response = await fetch('/api/crafts', { cache: 'no-store' })
    if (!response.ok) return
    state.catalog = await response.json()
  } catch (_) {}
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
      headers: authHeaders()
    })
    const body = await response.json()
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
    setStatus('사진을 올리면 공예품 데이터가 자동으로 메인 사이트에 반영됩니다.', false)
  } catch (error) {
    state.authenticated = false
    setUploadEnabled(false)
    setAuthMessage(String(error.message || error), true)
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
    setPipelineStep('① 이미지 읽는 중…')
    setStatus('자동 처리 시작…', false)
    state.mimeType = file.type || 'image/png'
    state.imageBase64 = await fileToBase64(file)

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

    setPipelineStep('② GPT Vision으로 공예품 추출 중…')
    const extracted = await runAnalyzeApi()
    if (!extracted.crafts || !extracted.crafts.length) {
      throw new Error('이미지에서 공예품을 찾지 못했습니다. 공예 가격/목록 화면 전체가 보이게 다시 올려주세요.')
    }

    state.catalog = mergeCraftsByName(baseBeforeAnalyze, extracted)

    setPipelineStep('③ 띵타해 웹에 저장 중…')
    const saveResult = await runSaveApi()
    state.catalog = saveResult.catalog || state.catalog

    notifyMainSiteCraftsUpdated(state.catalog.updatedAt)

    setPipelineStep('')
    setStatus(
      `완료! 공예품 ${extracted.crafts.length}건 반영됨. index.html 공예품 가격 탭을 확인하세요.`,
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

const bindEvents = () => {
  el('loginBtn')?.addEventListener('click', handleLogin)
  el('adminSecret')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })

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
