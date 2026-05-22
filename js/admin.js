const STORAGE_ADMIN_SECRET = 'ddingtahe_admin_secret'
const CRAFTS_BROADCAST_CHANNEL = 'ddingtahe-crafts-updated'
const CRAFT_CACHE_KEY = 'ddingtahe_craft_catalog_v1'

const state = {
  catalog: { version: 1, updatedAt: null, crafts: [] },
  previousPrices: {},
  authenticated: false,
  saving: false
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

const getCraftNames = () => window.CRAFT_NAME_ORDER || []

const getCraftPercent = (name, currentPrice) => {
  const ceiling = typeof window.getCraftMaxPrice === 'function' ? window.getCraftMaxPrice(name) : 0
  const current = Number(currentPrice) || 0
  if (!ceiling || !current) return 0
  return Math.min(100, Math.max(1, Math.round((current / ceiling) * 100)))
}

const formatPreviewChange = (name, currentPrice) => {
  const prev = state.previousPrices[name]
  if (prev == null || prev < 500) {
    return '<span class="text-slate-500" title="DB에 저장된 이전 시세 없음">—</span>'
  }
  const cur = Number(currentPrice) || 0
  if (!cur) return '<span class="text-slate-500">—</span>'
  const delta = cur - prev
  const prevLabel = prev.toLocaleString() + 'G'
  if (!delta) {
    return `<span class="text-slate-500" title="이전 저장 ${prevLabel}">변동 없음</span>`
  }
  const abs = Math.abs(delta).toLocaleString()
  return delta > 0
    ? `<span class="text-rose-400" title="이전 저장 ${prevLabel}">▲ ${abs}G</span>`
    : `<span class="text-sky-400" title="이전 저장 ${prevLabel}">▼ ${abs}G</span>`
}

const formatRecipeList = (inputs) =>
  (inputs || [])
    .map((i) => `${i.name}×${i.count}`)
    .join(', ')

const rememberPreviousPrices = (catalog) => {
  state.previousPrices = {}
  ;(catalog.crafts || []).forEach((c) => {
    if (c && c.name && c.currentPrice != null && Number(c.currentPrice) >= 500) {
      state.previousPrices[c.name] = Number(c.currentPrice)
    }
  })
}

const updatePercentAndChangeCells = (index) => {
  const names = getCraftNames()
  const name = names[index]
  if (!name) return
  const input = el('priceTableBody')?.querySelector(`input[data-index="${index}"]`)
  const pctCell = el('priceTableBody')?.querySelector(`[data-pct-index="${index}"]`)
  const chgCell = el('priceTableBody')?.querySelector(`[data-change-index="${index}"]`)
  const current = input ? Number(input.value) || 0 : 0
  if (pctCell) {
    const pct = getCraftPercent(name, current)
    pctCell.textContent = pct ? `${pct}%` : '—'
  }
  if (chgCell) chgCell.innerHTML = formatPreviewChange(name, current)
}

const renderPriceTable = (catalog) => {
  const tbody = el('priceTableBody')
  if (!tbody) return
  tbody.innerHTML = ''
  const names = getCraftNames()
  const map = new Map((catalog.crafts || []).map((c) => [c.name, c]))

  names.forEach((name, index) => {
    const defaults =
      typeof window.getDefaultCraftRecipe === 'function' ? window.getDefaultCraftRecipe(name) : null
    let craft = map.get(name) || defaults || { name }
    if (typeof window.applyFixedCraftRecipe === 'function') {
      craft = window.applyFixedCraftRecipe(craft)
    }
    const current = Number(craft.currentPrice) || 0
    const pct = getCraftPercent(name, current)
    const maxFixed =
      typeof window.getCraftMaxPrice === 'function' ? window.getCraftMaxPrice(name) : 0
    const recipeText = formatRecipeList(defaults?.inputs || craft.inputs)

    const tr = document.createElement('tr')
    tr.className = 'border-b border-slate-700/60'
    tr.innerHTML = `
      <td class="px-2 py-2 text-slate-300">
        <div class="font-medium">${name}</div>
        <div class="text-[10px] text-slate-500 mt-1 leading-snug">${recipeText}</div>
      </td>
      <td class="px-2 py-2">
        <input
          data-index="${index}"
          type="number"
          min="0"
          class="w-full min-w-[100px] rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-amber-100"
          value="${current || ''}"
          placeholder="현재 판매가"
          aria-label="${name} 현재 판매가"
        />
      </td>
      <td class="px-2 py-2 text-amber-200/90 text-sm whitespace-nowrap" data-pct-index="${index}">${pct ? pct + '%' : '—'}</td>
      <td class="px-2 py-2 text-sm whitespace-nowrap" data-change-index="${index}">${formatPreviewChange(name, current)}</td>
      <td class="px-2 py-2 text-slate-400 text-sm whitespace-nowrap">${maxFixed > 0 ? maxFixed.toLocaleString() + 'G' : '—'}</td>
    `
    tbody.appendChild(tr)
    const input = tr.querySelector('input')
    input?.addEventListener('input', () => updatePercentAndChangeCells(index))
  })
}

const syncTableToCatalog = () => {
  const names = getCraftNames()
  const tbody = el('priceTableBody')
  if (!tbody) return

  const byName = new Map((state.catalog.crafts || []).map((c) => [c.name, { ...c }]))
  tbody.querySelectorAll('input[data-index]').forEach((input) => {
    const index = Number(input.getAttribute('data-index'))
    const name = names[index]
    if (!name) return
    const defaults =
      typeof window.getDefaultCraftRecipe === 'function' ? window.getDefaultCraftRecipe(name) : null
    const craft = byName.get(name) || defaults || { name, group: 'craft', inputs: [], timeMinutes: 1, time: 1 }
    const val = parseInt(input.value || '0', 10)
    if (val >= 500) craft.currentPrice = val
    else delete craft.currentPrice
    if (defaults) {
      craft.price = defaults.price
      craft.inputs = defaults.inputs.map((i) => ({ ...i }))
    }
    craft.group = 'craft'
    delete craft.priceChange
    delete craft.maxPricePercent
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

const setFormEnabled = (enabled) => {
  const saveBtn = el('dailySaveBtn')
  const fixBtn = el('fixRecipesBtn')
  const clearBtn = el('clearHistoryBtn')
  const resetBtn = el('resetMarketBtn')
  if (saveBtn) saveBtn.disabled = !enabled
  if (fixBtn) fixBtn.disabled = !enabled
  if (clearBtn) clearBtn.disabled = !enabled
  if (resetBtn) resetBtn.disabled = !enabled
}

const fetchApiErrorMessage = (error) => {
  const msg = String(error?.message || error || '')
  if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return 'API 연결 실패. Vercel 배포 URL에서 admin.html을 열었는지 확인하세요.'
  }
  return msg
}

const loadCatalogFromApi = async () => {
  const response = await fetch('/api/admin/crafts', {
    cache: 'no-store',
    headers: authHeaders()
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || body.error || '공예품 데이터 로드 실패')
  }
  state.catalog = await response.json()
  const order = getCraftNames()
  if (order.length && state.catalog.crafts) {
    const byName = new Map(state.catalog.crafts.map((c) => [c.name, c]))
    state.catalog.crafts = order
      .map((name) => {
        const item =
          byName.get(name) ||
          (typeof window.getDefaultCraftRecipe === 'function'
            ? window.getDefaultCraftRecipe(name)
            : null)
        if (!item) return null
        return typeof window.applyFixedCraftRecipe === 'function'
          ? window.applyFixedCraftRecipe(item)
          : item
      })
      .filter(Boolean)
  }
  rememberPreviousPrices(state.catalog)
  renderPriceTable(state.catalog)
}

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

const notifyMainSiteCraftsUpdated = (catalog) => {
  saveCraftCatalogCache(catalog)
  try {
    const channel = new BroadcastChannel(CRAFTS_BROADCAST_CHANNEL)
    channel.postMessage({
      updatedAt: catalog.updatedAt || new Date().toISOString(),
      catalog
    })
    channel.close()
  } catch (_) {}
}

const handleLogin = async () => {
  const secret = getAdminSecret()
  if (!secret) {
    setAuthMessage('비밀번호를 입력하세요.', true)
    state.authenticated = false
    setFormEnabled(false)
    return
  }

  const btn = el('loginBtn')
  if (btn) {
    btn.disabled = true
    btn.textContent = '확인 중…'
  }

  try {
    const response = await fetch('/api/admin/crafts?action=verify', {
      method: 'POST',
      headers: authHeaders(),
      body: '{}'
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.ok) {
      state.authenticated = false
      setFormEnabled(false)
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
    setFormEnabled(true)
    await loadCatalogFromApi()
    setStatus('6종 현재 판매가를 입력한 뒤 「오늘 시세 저장」을 누르세요.', false)
  } catch (error) {
    state.authenticated = false
    setFormEnabled(false)
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

const handleDailySave = async () => {
  if (!state.authenticated) {
    setStatus('먼저 로그인하세요.', true)
    return
  }
  if (state.saving) return

  syncTableToCatalog()
  const filled = state.catalog.crafts.filter((c) => c.currentPrice >= 500).length
  if (filled < 6) {
    setStatus(`6종 모두 현재 판매가를 입력하세요 (${filled}/6).`, true)
    return
  }

  state.saving = true
  const btn = el('dailySaveBtn')
  if (btn) {
    btn.disabled = true
    btn.textContent = '저장 중…'
  }
  setStatus('Supabase에 저장 중…', false)

  try {
    state.catalog.updatedAt = new Date().toISOString()
    const response = await fetch('/api/admin/crafts', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        ...state.catalog,
        source: 'daily'
      })
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || body.message || body.hint || '저장 실패')

    state.catalog = body.catalog || state.catalog
    rememberPreviousPrices(state.catalog)
    renderPriceTable(state.catalog)
    notifyMainSiteCraftsUpdated(state.catalog)
    setStatus('오늘 시세 저장 완료. 메인 사이트(index.html)를 새로고침하세요.', false)
  } catch (error) {
    setStatus(fetchApiErrorMessage(error), true)
  } finally {
    state.saving = false
    if (btn) {
      btn.disabled = false
      btn.textContent = '오늘 시세 저장'
    }
  }
}

const handleClearHistory = async () => {
  if (!state.authenticated) return
  if (!window.confirm('그래프 이력(craft_price_history)만 삭제할까요?\n(현재 시세·메인 표시는 유지됩니다)')) return
  try {
    const res = await fetch('/api/admin/crafts?action=clear-history', {
      method: 'POST',
      headers: authHeaders(),
      body: '{}'
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message || body.error || '삭제 실패')
    setStatus(body.message || '그래프 이력만 삭제했습니다.', false)
  } catch (err) {
    setStatus(String(err.message || err), true)
  }
}

const handleResetMarket = async () => {
  if (!state.authenticated) return
  const ok = window.confirm(
    '공예품 시세·이력을 모두 초기화할까요?\n\n' +
      '· craft_items: 현재 시세·변동 삭제\n' +
      '· craft_price_history: 전체 삭제\n' +
      '· 레시피·제작 판매가는 유지\n\n' +
      '이후 Supabase에 과거 이력을 넣고, 마지막에 오늘 시세를 저장하세요.'
  )
  if (!ok) return

  const btn = el('resetMarketBtn')
  if (btn) {
    btn.disabled = true
    btn.textContent = '초기화 중…'
  }
  setStatus('시세·이력 초기화 중…', false)

  try {
    const res = await fetch('/api/admin/crafts?action=reset-market', {
      method: 'POST',
      headers: authHeaders(),
      body: '{}'
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message || body.error || body.hint || '초기화 실패')

    state.catalog = body.catalog || state.catalog
    state.previousPrices = {}
    renderPriceTable(state.catalog)
    notifyMainSiteCraftsUpdated(state.catalog)
    setStatus(
      body.message ||
        '초기화 완료. 과거 이력 INSERT 후 오늘 시세를 저장하세요. index.html을 새로고침하세요.',
      false
    )
  } catch (err) {
    setStatus(String(err.message || err), true)
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = '공예품 시세·이력 전체 초기화'
    }
  }
}

const handleFixRecipes = async () => {
  if (!state.authenticated) return
  try {
    setStatus('위키 레시피 복구 중…', false)
    const res = await fetch('/api/admin/crafts?action=fix-recipes', {
      method: 'POST',
      headers: authHeaders()
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message || body.error || '복구 실패')
    await loadCatalogFromApi()
    if (body.catalog) {
      state.catalog = body.catalog
      notifyMainSiteCraftsUpdated(state.catalog)
    }
    setStatus(body.message || '레시피 복구 완료', false)
  } catch (err) {
    setStatus(String(err.message || err), true)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  el('loginBtn')?.addEventListener('click', handleLogin)
  el('dailySaveBtn')?.addEventListener('click', handleDailySave)
  el('fixRecipesBtn')?.addEventListener('click', handleFixRecipes)
  el('clearHistoryBtn')?.addEventListener('click', handleClearHistory)
  el('resetMarketBtn')?.addEventListener('click', handleResetMarket)
  el('adminSecret')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
  setFormEnabled(false)
  tryAutoLogin()
})
