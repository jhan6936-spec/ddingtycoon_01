/**
 * 어패류 매입가 admin — admin.js 와 전역 식별자 충돌 방지를 위해 IIFE로 격리
 */
;(function initDdingtaeShellfishAdmin() {
  const STORAGE_SHELLFISH_ADMIN_SECRET = 'ddingtahe_shellfish_admin_secret'
  const SHELLFISH_BROADCAST_CHANNEL = 'ddingtahe-shellfish-prices-updated'
  const SHELLFISH_CACHE_KEY = 'ddingtahe_shellfish_prices_v1'

  const SHELLFISH_ITEM_ORDER = [
    '굴 ★', '굴 ★★', '굴 ★★★',
    '소라 ★', '소라 ★★', '소라 ★★★',
    '문어 ★', '문어 ★★', '문어 ★★★',
    '미역 ★', '미역 ★★', '미역 ★★★',
    '성게 ★', '성게 ★★', '성게 ★★★'
  ]

  window.SHELLFISH_ADMIN_ITEM_ORDER = SHELLFISH_ITEM_ORDER

  const shellfishState = {
    catalog: { version: 1, updatedAt: null, items: [] },
    previousPrices: {},
    authenticated: false,
    saving: false,
    editor: null
  }

  const sfEl = (id) => document.getElementById(id)

  const getShellfishSecret = () => {
    const input = sfEl('shellfishAdminSecret')
    return input ? String(input.value || '').trim() : ''
  }

  const shellfishAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getShellfishSecret()}`
  })

  const fetchShellfishApiErrorMessage = (error) => {
    const msg = String(error?.message || error || '')
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return '서버에 연결할 수 없습니다. 배포 후 /api/admin/shellfish-prices 가 동작하는지 확인하세요.'
    }
    return msg || '요청 실패'
  }

  const setShellfishAuthMessage = (message, isError) => {
    const node = sfEl('shellfishAuthMessage')
    if (!node) return
    node.textContent = message || ''
    node.className = isError ? 'text-sm text-rose-400' : 'text-sm text-emerald-400'
  }

  const setShellfishStatus = (message, isError) => {
    const node = sfEl('shellfishStatusMessage')
    if (!node) return
    node.textContent = message || ''
    node.className = isError ? 'text-sm text-rose-400' : 'text-sm text-emerald-400'
  }

  const setShellfishFormEnabled = (enabled) => {
    const saveBtn = sfEl('shellfishSaveBtn')
    if (saveBtn) saveBtn.disabled = !enabled
    document.querySelectorAll('[data-shellfish-price-input]').forEach((input) => {
      input.disabled = !enabled
    })
  }

  const rememberShellfishPreviousPrices = (catalog) => {
    shellfishState.previousPrices = {}
    ;(catalog.items || []).forEach((item) => {
      if (item && item.itemName && Number(item.buyPrice) > 0) {
        shellfishState.previousPrices[item.itemName] = Number(item.buyPrice)
      }
    })
  }

  const formatShellfishPreviewChange = (name, currentPrice) => {
    const prev = shellfishState.previousPrices[name]
    if (prev == null || prev <= 0) {
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

  const updateShellfishChangeCell = (index) => {
    const name = SHELLFISH_ITEM_ORDER[index]
    if (!name) return
    const input = sfEl('shellfishPriceTableBody')?.querySelector(`input[data-shellfish-index="${index}"]`)
    const chgCell = sfEl('shellfishPriceTableBody')?.querySelector(`[data-shellfish-change-index="${index}"]`)
    const current = input ? Number(input.value) || 0 : 0
    if (chgCell) chgCell.innerHTML = formatShellfishPreviewChange(name, current)
  }

  const renderShellfishPriceTable = (catalog) => {
    const tbody = sfEl('shellfishPriceTableBody')
    if (!tbody) return
    tbody.innerHTML = ''
    const map = new Map((catalog.items || []).map((i) => [i.itemName, i]))

    SHELLFISH_ITEM_ORDER.forEach((name, index) => {
      const item = map.get(name) || { itemName: name, buyPrice: 0 }
      const current = Number(item.buyPrice) || 0
      const tr = document.createElement('tr')
      tr.className = 'border-b border-slate-700/60'
      tr.innerHTML = `
      <td class="px-2 py-2 text-slate-300 font-medium">${name}</td>
      <td class="px-2 py-2">
        <input
          data-shellfish-index="${index}"
          data-shellfish-price-input
          type="number"
          min="0"
          disabled
          class="w-full min-w-[100px] rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-amber-100 disabled:opacity-40"
          value="${current > 0 ? current : ''}"
          placeholder="매입가"
          aria-label="${name} 매입가"
        />
      </td>
      <td class="px-2 py-2 text-sm whitespace-nowrap" data-shellfish-change-index="${index}">${formatShellfishPreviewChange(name, current)}</td>
    `
      tbody.appendChild(tr)
      tr.querySelector('input')?.addEventListener('input', () => updateShellfishChangeCell(index))
    })
    setShellfishFormEnabled(shellfishState.authenticated)
  }

  const syncShellfishTableToCatalog = () => {
    const tbody = sfEl('shellfishPriceTableBody')
    if (!tbody) return
    const items = SHELLFISH_ITEM_ORDER.map((name, index) => {
      const input = tbody.querySelector(`input[data-shellfish-index="${index}"]`)
      const val = input ? Math.max(0, parseInt(input.value || '0', 10) || 0) : 0
      return { itemName: name, buyPrice: val }
    })
    shellfishState.catalog = {
      version: 1,
      updatedAt: new Date().toISOString(),
      items
    }
  }

  const saveShellfishCatalogCache = (catalog) => {
    try {
      localStorage.setItem(SHELLFISH_CACHE_KEY, JSON.stringify(catalog))
    } catch (_) {}
  }

  const notifyMainSiteShellfishUpdated = (catalog) => {
    saveShellfishCatalogCache(catalog)
    try {
      const channel = new BroadcastChannel(SHELLFISH_BROADCAST_CHANNEL)
      channel.postMessage({ updatedAt: catalog.updatedAt || new Date().toISOString(), catalog })
      channel.close()
    } catch (_) {}
  }

  const loadShellfishPricesFromApi = async () => {
    const response = await fetch('/api/admin/shellfish-prices', {
      headers: shellfishState.authenticated ? shellfishAuthHeaders() : {}
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const hint = body.hint ? ` ${body.hint}` : ''
      throw new Error((body.message || body.error || '시세 불러오기 실패') + hint)
    }
    shellfishState.catalog = body
    rememberShellfishPreviousPrices(body)
    renderShellfishPriceTable(body)
  }

  const handleShellfishLogin = async () => {
    const secret = getShellfishSecret()
    if (!secret) {
      setShellfishAuthMessage('비밀번호를 입력하세요.', true)
      shellfishState.authenticated = false
      setShellfishFormEnabled(false)
      return
    }

    const btn = sfEl('shellfishLoginBtn')
    if (btn) {
      btn.disabled = true
      btn.textContent = '확인 중…'
    }

    try {
      const response = await fetch('/api/admin/shellfish-prices?action=verify', {
        method: 'POST',
        headers: shellfishAuthHeaders(),
        body: '{}'
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        shellfishState.authenticated = false
        setShellfishFormEnabled(false)
        try {
          localStorage.removeItem(STORAGE_SHELLFISH_ADMIN_SECRET)
        } catch (_) {}
        setShellfishAuthMessage(body.message || body.error || '비밀번호가 올바르지 않습니다.', true)
        return
      }

      shellfishState.authenticated = true
      shellfishState.editor = body.editor || null
      try {
        localStorage.setItem(STORAGE_SHELLFISH_ADMIN_SECRET, secret)
      } catch (_) {}
      const editorNote = body.editor ? ` (${body.editor})` : ''
      setShellfishAuthMessage(`인증되었습니다.${editorNote}`, false)
      setShellfishFormEnabled(true)
      try {
        await loadShellfishPricesFromApi()
        setShellfishStatus('15종 매입가를 입력한 뒤 「어패류 매입가 저장」을 누르세요.', false)
      } catch (loadErr) {
        renderShellfishPriceTable({ version: 1, items: SHELLFISH_ITEM_ORDER.map((itemName) => ({ itemName, buyPrice: 0 })) })
        setShellfishStatus(
          '인증은 되었으나 시세를 불러오지 못했습니다. Supabase에 supabase_shellfish_buy_prices.sql 을 실행했는지 확인하세요. (' +
            fetchShellfishApiErrorMessage(loadErr) +
            ')',
          true
        )
      }
    } catch (error) {
      shellfishState.authenticated = false
      setShellfishFormEnabled(false)
      setShellfishAuthMessage(fetchShellfishApiErrorMessage(error), true)
    } finally {
      if (btn) {
        btn.disabled = false
        btn.textContent = '로그인'
      }
    }
  }

  const tryAutoLoginShellfish = async () => {
    try {
      const saved = localStorage.getItem(STORAGE_SHELLFISH_ADMIN_SECRET)
      if (!saved) return
      const input = sfEl('shellfishAdminSecret')
      if (input) input.value = saved
      await handleShellfishLogin()
    } catch (_) {}
  }

  const handleShellfishSave = async () => {
    if (!shellfishState.authenticated) {
      setShellfishStatus('먼저 로그인하세요.', true)
      return
    }
    if (shellfishState.saving) return

    syncShellfishTableToCatalog()
    const filled = shellfishState.catalog.items.filter((i) => Number(i.buyPrice) > 0).length
    if (filled < 1) {
      setShellfishStatus('최소 1종 이상 매입가를 입력하세요.', true)
      return
    }

    shellfishState.saving = true
    const btn = sfEl('shellfishSaveBtn')
    if (btn) {
      btn.disabled = true
      btn.textContent = '저장 중…'
    }
    setShellfishStatus('Supabase에 저장 중…', false)

    try {
      const response = await fetch('/api/admin/shellfish-prices', {
        method: 'PUT',
        headers: shellfishAuthHeaders(),
        body: JSON.stringify(shellfishState.catalog)
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || body.error || '저장 실패')
      if (body.catalog) {
        shellfishState.catalog = body.catalog
        rememberShellfishPreviousPrices(body.catalog)
        renderShellfishPriceTable(body.catalog)
        notifyMainSiteShellfishUpdated(body.catalog)
      }
      setShellfishStatus('어패류 매입가가 저장되었습니다. 메인 계산기를 새로고침하면 반영됩니다.', false)
    } catch (error) {
      setShellfishStatus(fetchShellfishApiErrorMessage(error), true)
    } finally {
      shellfishState.saving = false
      if (btn) {
        btn.disabled = !shellfishState.authenticated
        btn.textContent = '어패류 매입가 저장'
      }
    }
  }

  const bindShellfishAdmin = () => {
    const loginBtn = sfEl('shellfishLoginBtn')
    const saveBtn = sfEl('shellfishSaveBtn')
    const secretInput = sfEl('shellfishAdminSecret')

    if (!loginBtn || !secretInput) {
      console.error('[admin-shellfish] shellfishLoginBtn 또는 shellfishAdminSecret 요소를 찾을 수 없습니다.')
      return
    }

    loginBtn.addEventListener('click', () => {
      void handleShellfishLogin()
    })
    saveBtn?.addEventListener('click', () => {
      void handleShellfishSave()
    })
    secretInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void handleShellfishLogin()
    })
    setShellfishFormEnabled(false)
    void tryAutoLoginShellfish()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindShellfishAdmin)
  } else {
    bindShellfishAdmin()
  }
})()
