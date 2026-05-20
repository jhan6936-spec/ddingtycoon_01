/** 해양 전문가 스킬 트리 UI (draft → 저장) */
let expertDraftState = createDefaultExpertState();
let expertTreeResizeTimer = null;

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

function cascadeResetExpertDescendants(parentKey, state) {
  Object.keys(EXPERT_TREE_PARENTS).forEach((childKey) => {
    if (EXPERT_TREE_PARENTS[childKey] !== parentKey) return;
    state[childKey] = 0;
    cascadeResetExpertDescendants(childKey, state);
  });
}

function renderExpertTreeNode(meta) {
  const lv = expertDraftState[meta.key] || 0;
  const savedLv = expertState[meta.key] || 0;
  const dirty = lv !== savedLv;
  const unlocked = isExpertSkillUnlocked(meta.key, expertDraftState);
  const active = unlocked && lv > 0;
  const icon = EXPERT_ICONS[meta.key] || '✦';
  const lockHint = unlocked ? '' : getExpertLockHint(meta.key);
  const layout = getExpertTreeLayout(meta.key);
  const spanPart = layout.colSpan ? ` / span ${layout.colSpan}` : '';
  const gridStyle = `grid-row:${layout.row};grid-column:${layout.col}${spanPart}`;
  const canIncrease = unlocked && lv < meta.maxLevel;
  const canDecrease = lv > 0;

  return `
    <div class="expert-tree-node-slot" style="${gridStyle}">
      <div class="expert-tree-node${dirty ? ' is-dirty' : ''}${unlocked ? '' : ' is-locked'}${active ? ' is-active' : ''}" data-expert-key="${meta.key}"${lockHint ? ` title="${lockHint}"` : ''}>
        <div class="expert-tree-node-lv">${lv}/${meta.maxLevel}</div>
        <div class="expert-tree-node-icon-outer" aria-hidden="true">
          <div class="expert-tree-node-icon-frame">
            <div class="expert-tree-node-icon">${icon}</div>
          </div>
        </div>
        <div class="expert-tree-node-name">[${meta.tag}] ${meta.name}</div>
        ${!unlocked ? '<div class="expert-tree-node-lock" aria-hidden="true">🔒</div>' : ''}
        <div class="expert-tree-node-controls">
          <button type="button" class="expert-tree-btn" data-expert="${meta.key}" data-delta="-1" aria-label="${meta.name} 레벨 내리기" ${canDecrease ? '' : 'disabled'}>−</button>
          <button type="button" class="expert-tree-btn" data-expert="${meta.key}" data-delta="1" aria-label="${meta.name} 레벨 올리기" ${canIncrease ? '' : 'disabled'}>+</button>
        </div>
      </div>
    </div>
  `;
}

function renderExpertTreeBoard() {
  const board = document.getElementById('expertTreeBoard');
  if (!board) return;

  const nodesHtml = Object.values(expertMeta)
    .sort((a, b) => {
      const la = getExpertTreeLayout(a.key);
      const lb = getExpertTreeLayout(b.key);
      return la.row - lb.row || la.col - lb.col;
    })
    .map((meta) => renderExpertTreeNode(meta))
    .join('');

  board.innerHTML = nodesHtml;

  board.querySelectorAll('button[data-expert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-expert');
      const delta = parseInt(btn.getAttribute('data-delta'), 10) || 0;
      changeExpertDraftLevel(key, delta);
    });
  });

  requestAnimationFrame(() => {
    drawExpertTreeConnectors();
  });
}

function drawExpertTreeConnectors() {
  const wrap = document.getElementById('expertTreeBoardWrap');
  const svg = document.getElementById('expertTreeConnectorsSvg');
  if (!wrap || !svg) return;

  const w = wrap.scrollWidth;
  const h = wrap.scrollHeight;
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = '';

  const wrapRect = wrap.getBoundingClientRect();
  const scrollLeft = wrap.scrollLeft;
  const scrollTop = wrap.scrollTop;

  Object.entries(EXPERT_TREE_PARENTS).forEach(([childKey, parentKey]) => {
    const parentEl = wrap.querySelector(`[data-expert-key="${parentKey}"] .expert-tree-node-icon-frame`);
    const childEl = wrap.querySelector(`[data-expert-key="${childKey}"] .expert-tree-node-icon-frame`);
    if (!parentEl || !childEl) return;

    const p = parentEl.getBoundingClientRect();
    const c = childEl.getBoundingClientRect();
    const x1 = p.left + p.width / 2 - wrapRect.left + scrollLeft;
    const y1 = p.bottom - wrapRect.top + scrollTop + 2;
    const x2 = c.left + c.width / 2 - wrapRect.left + scrollLeft;
    const y2 = c.top - wrapRect.top + scrollTop - 2;
    const sameColumn = Math.abs(x1 - x2) < 12;
    const midY = y1 + (y2 - y1) * 0.5;
    const pathD = sameColumn
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

    const parentLv = expertDraftState[parentKey] || 0;
    const stroke = parentLv > 0 ? '#5a8ab5' : '#383838';
    const opacity = parentLv > 0 ? '0.9' : '0.4';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('opacity', opacity);
    path.setAttribute('class', 'expert-tree-connector');
    svg.appendChild(path);
  });
}

function scheduleExpertTreeConnectorRedraw() {
  if (expertTreeResizeTimer) clearTimeout(expertTreeResizeTimer);
  expertTreeResizeTimer = setTimeout(() => drawExpertTreeConnectors(), 80);
}

function renderExpertTreeSidebar() {
  const sidebar = document.getElementById('expertTreeSidebar');
  if (!sidebar) return;

  const costs = computeExpertDraftCosts(expertState, expertDraftState);
  const dirty = isExpertDraftDirty();
  const effects = listActiveExpertEffects(expertDraftState).filter((e) => isExpertSkillUnlocked(e.key, expertDraftState));

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
  const cur = expertDraftState[key] || 0;
  if (delta > 0 && !isExpertSkillUnlocked(key, expertDraftState)) return;
  const next = Math.max(0, Math.min(meta.maxLevel, cur + delta));
  if (next === cur) return;
  expertDraftState[key] = next;
  if (next === 0) cascadeResetExpertDescendants(key, expertDraftState);
  renderExpertSkillTree();
}

function handleExpertTreeReset() {
  expertDraftState = createDefaultExpertState();
  renderExpertSkillTree();
}

function handleExpertTreeSave() {
  if (!isExpertDraftDirty()) return;
  expertState = sanitizeExpertState({ ...expertDraftState });
  expertDraftState = { ...expertState };
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
  const wrap = document.getElementById('expertTreeBoardWrap');
  if (wrap) {
    wrap.addEventListener('scroll', scheduleExpertTreeConnectorRedraw);
  }
  window.addEventListener('resize', scheduleExpertTreeConnectorRedraw);
}

function renderExperts() {
  bindExpertTreeControlsOnce();
  renderExpertSkillTree();
}
