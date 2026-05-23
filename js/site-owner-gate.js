/**
 * 사이트 오너(shaco40)만 F12·개발자 도구·숨김 관리 패널 사용 가능.
 * 어패류 시세 담당·Supabase profiles.role=admin 과는 별개입니다.
 */
;(function initSiteOwnerGate() {
  const STORAGE_OWNER_UNLOCK = 'ddingtahe_site_owner_unlock'
  const DEFAULT_OWNER_DISCORD_NAMES = ['shaco40']

  const normalizeDiscordName = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/#\d+$/, '')

  const getOwnerDiscordNames = () => {
    const cfg = window.SUPABASE_CONFIG || {}
    const fromCfg = cfg.siteOwnerDiscordUsernames
    if (Array.isArray(fromCfg) && fromCfg.length) {
      return fromCfg.map(normalizeDiscordName).filter(Boolean)
    }
    return DEFAULT_OWNER_DISCORD_NAMES.map(normalizeDiscordName)
  }

  const readDiscordUsername = (user) => {
    if (!user) return ''
    const meta = user.user_metadata || {}
    const identities = user.identities || []
    const discordIdentity = identities.find((i) => i.provider === 'discord')
    const idData =
      discordIdentity && discordIdentity.identity_data ? discordIdentity.identity_data : {}
    const candidates = [
      idData.username,
      idData.global_name,
      meta.preferred_username,
      meta.user_name,
      meta.custom_claims?.username,
      meta.full_name,
      meta.name
    ]
    for (const c of candidates) {
      const n = normalizeDiscordName(c)
      if (n) return n
    }
    return ''
  }

  let ownerUnlocked = false
  let discordOwnerMatch = false

  const syncOwnerFlag = () => {
    ownerUnlocked = discordOwnerMatch
    try {
      if (ownerUnlocked) sessionStorage.setItem(STORAGE_OWNER_UNLOCK, '1')
      else sessionStorage.removeItem(STORAGE_OWNER_UNLOCK)
    } catch (_) {}
    applyOwnerOnlyVisibility()
  }

  const setOwnerUnlockedFromAdminLogin = (isOwner) => {
    if (isOwner) {
      discordOwnerMatch = true
      syncOwnerFlag()
      return
    }
    try {
      sessionStorage.removeItem(STORAGE_OWNER_UNLOCK)
    } catch (_) {}
    if (!discordOwnerMatch) {
      ownerUnlocked = false
      applyOwnerOnlyVisibility()
    }
  }

  const refreshFromDiscordUser = (user) => {
    if (!user) {
      discordOwnerMatch = false
      try {
        const saved = sessionStorage.getItem(STORAGE_OWNER_UNLOCK) === '1'
        ownerUnlocked = saved
      } catch (_) {
        ownerUnlocked = false
      }
      applyOwnerOnlyVisibility()
      return
    }
    const name = readDiscordUsername(user)
    const owners = getOwnerDiscordNames()
    discordOwnerMatch = Boolean(name && owners.includes(name))
    syncOwnerFlag()
  }

  const isSiteOwner = () => Boolean(ownerUnlocked)

  const PANEL_SELECTORS = [
    '#siteOwnerAdminPanel',
    '#siteOwnerDevPanel',
    '[data-f12-admin-panel]',
    '.site-owner-admin-panel'
  ]

  const closeOwnerAdminPanels = () => {
    PANEL_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((node) => {
        node.hidden = true
        node.setAttribute('aria-hidden', 'true')
        node.classList.remove('open', 'is-open', 'active')
      })
    })
  }

  const applyOwnerOnlyVisibility = () => {
    const allowed = isSiteOwner()
    document.querySelectorAll('[data-site-owner-only]').forEach((node) => {
      if (allowed) {
        node.removeAttribute('hidden')
        node.removeAttribute('aria-hidden')
        node.classList.remove('site-owner-blocked')
      } else {
        node.hidden = true
        node.setAttribute('aria-hidden', 'true')
        node.classList.add('site-owner-blocked')
      }
    })
    if (!allowed) closeOwnerAdminPanels()
  }

  const isBlockedDevToolsKey = (e) => {
    if (!e) return false
    if (e.key === 'F12') return true
    if (e.key === 'F11' && e.ctrlKey) return true
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) return true
    if (e.ctrlKey && !e.shiftKey && e.key === 'U') return true
    return false
  }

  const blockDevToolsForGuests = (e) => {
    if (isSiteOwner()) return
    if (!isBlockedDevToolsKey(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    closeOwnerAdminPanels()
    return false
  }

  const onContextMenu = (e) => {
    if (isSiteOwner()) return
    e.preventDefault()
  }

  const install = () => {
    document.addEventListener('keydown', blockDevToolsForGuests, true)
    document.addEventListener('keyup', blockDevToolsForGuests, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    try {
      const saved = sessionStorage.getItem(STORAGE_OWNER_UNLOCK) === '1'
      if (saved) ownerUnlocked = true
    } catch (_) {}
    applyOwnerOnlyVisibility()
  }

  window.SiteOwnerGate = {
    isSiteOwner,
    refreshFromDiscordUser,
    setOwnerUnlockedFromAdminLogin,
    closeOwnerAdminPanels,
    applyOwnerOnlyVisibility
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install)
  } else {
    install()
  }
})()
