/** 해양 전문가 스킬 트리 UI (draft → 저장) */
let expertDraftState = createDefaultExpertState();

function syncExpertDraftFromSaved() {
  expertDraftState = { ...expertState };
}

function isExpertDraftDirty() {
  return Object.keys(expertMeta).some((key) => (expertDraftState[key] || 0) !== (expertState[key] || 0));
}

function formatExpertCostValue(n) {
  const v = Number(n) || 0;
  if (v === 0) return '0';
  const prefix = v > 0 ? '+' : '';
  return `${prefix}${v.toLocaleString()}`;
}

function renderExpertTreeNode(meta) {
  const lv = expertDraftState[meta.key] || 0;
  const savedLv = expertState[meta.key] || 0;
  const dirty = lv !== savedLv;
  const icon = EXPERT_ICONS[meta.key] || '✦';
  return `
    <div class="expert-tree-node${dirty ? ' is-dirty' : ''}" data-expert-key="${meta.key}">
      <div class="expert-tree-node-lv">${lv}/${meta.maxLevel}</div>
      <div class="expert-tree-node-icon" aria-hidden="true">${icon}</div>
      <div class="expert-tree-node-name">[${meta.tag}] ${meta.name}</div>
      <div class="expert-tree-node-controls">
        <button type="button" class="expert-tree-btn" data-expert="${meta.key}" data-delta="-1" aria-label="${meta.name} 레벨 내리기" ${lv <= 0 ? 'disabled' : ''}>−</button>
        <button type="button" class="expert-tree-btn" data-expert="${meta.key}" data-delta="1" aria-label="${meta.name} 레벨 올리기" ${lv >= meta.maxLevel ? 'disabled' : ''}>+</button>
      </div>
    </div>
  `;
}

function renderExpertTreeBoard() {
  const board = document.getElementById('expertTreeBoard');
  if (!board) return;
  board.innerHTML = EXPERT_TREE_TIERS.map((tier, tierIdx) => {
    const nodes = tier
      .map((key) => expertMeta[key])
      .filter(Boolean)
      .map((meta) => renderExpertTreeNode(meta))
      .join('');
    return `<div class="expert-tree-tier" data-tier="${tierIdx}">${nodes}</div>`;
  }).join('');

  board.querySelectorAll('button[data-expert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-expert');
      const delta = parseInt(btn.getAttribute('data-delta'), 10) || 0;
      changeExpertDraftLevel(key, delta);
    });
  });
}

function renderExpertTreeSidebar() {
  const sidebar = document.getElementById('expertTreeSidebar');
  if (!sidebar) return;

  const costs = computeExpertDraftCosts(expertState, expertDraftState);
  const dirty = isExpertDraftDirty();
  const effects = listActiveExpertEffects(expertDraftState);

  const effectsHtml = effects.length
    ? `<ul class="expert-effect-list">${effects.map((e) => `
        <li class="expert-effect-item">
          <span class="expert-effect-name">[${e.tag}] ${e.name}</span>
          <span class="expert-effect-val">Lv.${e.lv} · ${e.label}</span>
        </li>
      `).join('')}</ul>`
    : '<p class="expert-effect-empty">활성화된 스킬이 없습니다.</p>';

  sidebar.innerHTML = `
    <section class="expert-tree-panel expert-tree-cost-panel">
      <h3 class="expert-tree-panel-title">추가 요구 재화</h3>
      <p class="expert-tree-panel-sub">저장 시점 대비 소모 예상 비용</p>
      <ul class="expert-cost-list">
        <li class="expert-cost-row">
          <span class="expert-cost-icon expert-cost-icon-gold" aria-hidden="true">🪙</span>
          <span class="expert-cost-label">필요 골드</span>
          <span class="expert-cost-value">${formatExpertCostValue(costs.gold)}</span>
        </li>
        <li class="expert-cost-row">
          <span class="expert-cost-icon expert-cost-icon-stone" aria-hidden="true">💠</span>
          <span class="expert-cost-label">어빌리티 스톤</span>
          <span class="expert-cost-value">${formatExpertCostValue(costs.stone)}</span>
        </li>
        <li class="expert-cost-row">
          <span class="expert-cost-icon expert-cost-icon-sp" aria-hidden="true">🛡️</span>
          <span class="expert-cost-label">스킬 포인트</span>
          <span class="expert-cost-value">${formatExpertCostValue(costs.sp)}</span>
        </li>
      </ul>
    </section>
    <button type="button" class="expert-tree-save-btn" id="expertTreeSaveBtn" ${dirty ? '' : 'disabled'}>
      설정 저장하기
    </button>
    <section class="expert-tree-panel expert-tree-effects-panel">
      <h3 class="expert-tree-panel-title">
        <span class="expert-tree-check" aria-hidden="true">✓</span> 활성 효과 요약
      </h3>
      <div class="expert-effect-list-wrap">${effectsHtml}</div>
    </section>
  `;

}

function bindExpertTreeSaveBtn() {
  const saveBtn = document.getElementById('expertTreeSaveBtn');
  if (!saveBtn || saveBtn.dataset.bound) return;
  saveBtn.dataset.bound = '1';
  saveBtn.addEventListener('click', handleExpertTreeSave);
}

function renderExpertSkillTree() {
  renderExpertTreeBoard();
  renderExpertTreeSidebar();
  bindExpertTreeSaveBtn();
}

function changeExpertDraftLevel(key, delta) {
  const meta = expertMeta[key];
  if (!meta) return;
  const next = Math.max(0, Math.min(meta.maxLevel, (expertDraftState[key] || 0) + delta));
  if (next === expertDraftState[key]) return;
  expertDraftState[key] = next;
  renderExpertSkillTree();
}

function handleExpertTreeReset() {
  expertDraftState = createDefaultExpertState();
  renderExpertSkillTree();
}

function handleExpertTreeSave() {
  if (!isExpertDraftDirty()) return;
  expertState = { ...expertDraftState };
  saveExpertState();
  renderExpertSkillTree();
  if (typeof handleEfficiencyInputChanged === 'function') handleEfficiencyInputChanged();
  if (typeof renderRecipes === 'function') renderRecipes();
}

let expertTreeUiBound = false;

function bindExpertTreeControlsOnce() {
  if (expertTreeUiBound) return;
  expertTreeUiBound = true;
  const resetBtn = document.getElementById('expertTreeResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleExpertTreeReset);
  }
}

function renderExperts() {
  bindExpertTreeControlsOnce();
  renderExpertSkillTree();
}
