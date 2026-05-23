const STORAGE_ADMIN_TAB = 'ddingtahe_admin_active_tab_v1'

const switchAdminTab = (tabId) => {
  const tabs = document.querySelectorAll('[data-admin-tab]')
  const panels = document.querySelectorAll('[data-admin-panel]')
  tabs.forEach((btn) => {
    const active = btn.getAttribute('data-admin-tab') === tabId
    btn.classList.toggle('admin-tab-active', active)
    btn.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  panels.forEach((panel) => {
    const show = panel.getAttribute('data-admin-panel') === tabId
    panel.classList.toggle('hidden', !show)
  })
  try {
    localStorage.setItem(STORAGE_ADMIN_TAB, tabId)
  } catch (_) {}
}

const initAdminTabs = () => {
  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-admin-tab')
      if (tabId) switchAdminTab(tabId)
    })
  })
  let initial = 'craft'
  try {
    const saved = localStorage.getItem(STORAGE_ADMIN_TAB)
    if (saved === 'craft' || saved === 'shellfish') initial = saved
  } catch (_) {}
  switchAdminTab(initial)
}

document.addEventListener('DOMContentLoaded', initAdminTabs)
