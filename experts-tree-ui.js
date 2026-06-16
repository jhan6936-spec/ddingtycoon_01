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
  const v = Math.max(0, Number(n) || 0);
  if (v === 0) return '0';
  return `+${v.toLocaleString()}`;
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
  const iconMarkup = renderExpertIconMarkup(meta.key, meta.name);
  const lockHint = unlocked ? '' : getExpertLockHint(meta.key);
  const layout = getExpertTreeLayout(meta.key);
  const spanPart = layout.colSpan ? ` / span ${layout.colSpan}` : '';
  const offsetPart = layout.offsetX ? `;transform:translateX(${layout.offsetX}px)` : '';
  const gridStyle = `grid-row:${layout.row};grid-column:${layout.col}${spanPart}${offsetPart}`;
  const canIncrease = unlocked && lv < meta.maxLevel;
  const canDecrease = lv > 0;

  return `
    <div class="expert-tree-node-slot" style="${gridStyle}">
      <div class="expert-tree-node${dirty ? ' is-dirty' : ''}${unlocked ? '' : ' is-locked'}${active ? ' is-active' : ''}" data-expert-key="${meta.key}"${lockHint ? ` title="${lockHint}"` : ''}>
        <div class="expert-tree-node-lv">${lv}/${meta.maxLevel}</div>
        <div class="expert-tree-node-icon-outer">
          <div class="expert-tree-node-icon-hit" data-expert-key="${meta.key}" tabindex="0" aria-label="${meta.name} 효과 보기">
            <div class="expert-tree-node-icon-frame">
              <div class="expert-tree-node-icon">${iconMarkup}</div>
            </div>
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

  bindExpertTreeTooltips(board);

  requestAnimationFrame(() => {
    drawExpertTreeConnectors();
  });
}

function ensureExpertTreeTooltipEl() {
  let el = document.getElementById('expertTreeTooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'expertTreeTooltip';
    el.className = 'expert-tree-tooltip';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function positionExpertTreeTooltip(tip, anchorRect) {
  const margin = 10;
  const gap = 8;
  let left = anchorRect.right + gap;
  let top = anchorRect.top;
  tip.hidden = false;
  const tipRect = tip.getBoundingClientRect();
  if (left + tipRect.width > window.innerWidth - margin) {
    left = anchorRect.left - tipRect.width - gap;
  }
  if (left < margin) left = margin;
  if (top + tipRect.height > window.innerHeight - margin) {
    top = window.innerHeight - tipRect.height - margin;
  }
  if (top < margin) top = margin;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideExpertTreeTooltip() {
  const tip = document.getElementById('expertTreeTooltip');
  if (tip) tip.hidden = true;
}

function showExpertTreeTooltip(key, anchorEl) {
  const meta = expertMeta[key];
  if (!meta) return;
  const tip = ensureExpertTreeTooltipEl();
  const currentLv = expertDraftState[key] || 0;
  tip.innerHTML = buildExpertTooltipHtml(meta, currentLv);
  positionExpertTreeTooltip(tip, anchorEl.getBoundingClientRect());
}

function bindExpertTreeTooltips(board) {
  const tip = ensureExpertTreeTooltipEl();
  board.querySelectorAll('.expert-tree-node-icon-hit').forEach((hit) => {
    if (hit.dataset.tooltipBound) return;
    hit.dataset.tooltipBound = '1';
    const key = hit.getAttribute('data-expert-key');
    hit.addEventListener('mouseenter', () => showExpertTreeTooltip(key, hit));
    hit.addEventListener('focus', () => showExpertTreeTooltip(key, hit));
    hit.addEventListener('mouseleave', hideExpertTreeTooltip);
    hit.addEventListener('blur', hideExpertTreeTooltip);
  });
  if (!tip.dataset.globalBound) {
    tip.dataset.globalBound = '1';
    board.addEventListener('scroll', hideExpertTreeTooltip, { passive: true });
    window.addEventListener('scroll', hideExpertTreeTooltip, { passive: true });
  }
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

  const childrenByParent = {};
  Object.entries(EXPERT_TREE_PARENTS).forEach(([childKey, parentKey]) => {
    if (!childrenByParent[parentKey]) childrenByParent[parentKey] = [];
    childrenByParent[parentKey].push(childKey);
  });

  const getAnchor = (key, part) => {
    const el = wrap.querySelector(`[data-expert-key="${key}"] .expert-tree-node-icon-frame`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - wrapRect.left + scrollLeft;
    if (part === 'bottom') {
      return { x, y: r.bottom - wrapRect.top + scrollTop + 2 };
    }
    return { x, y: r.top - wrapRect.top + scrollTop - 2 };
  };

  const appendPath = (pathD, parentKey) => {
    const parentLv = expertDraftState[parentKey] || 0;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', parentLv > 0 ? '#5a8ab5' : '#383838');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('opacity', parentLv > 0 ? '0.9' : '0.4');
    path.setAttribute('class', 'expert-tree-connector');
    svg.appendChild(path);
  };

  Object.entries(childrenByParent).forEach(([parentKey, childKeys]) => {
    const parentBottom = getAnchor(parentKey, 'bottom');
    if (!parentBottom) return;

    const childTops = childKeys
      .map((childKey) => {
        const top = getAnchor(childKey, 'top');
        return top ? { childKey, ...top } : null;
      })
      .filter(Boolean);
    if (!childTops.length) return;

    if (childTops.length >= 2) {
      const minX = Math.min(...childTops.map((c) => c.x));
      const maxX = Math.max(...childTops.map((c) => c.x));
      const forkY = parentBottom.y + (childTops[0].y - parentBottom.y) * 0.45;
      let pathD = `M ${parentBottom.x} ${parentBottom.y} L ${parentBottom.x} ${forkY}`;
      if (Math.abs(maxX - minX) > 12) {
        pathD += ` L ${minX} ${forkY} L ${maxX} ${forkY}`;
      }
      childTops.forEach((child) => {
        pathD += ` M ${child.x} ${forkY} L ${child.x} ${child.y}`;
      });
      appendPath(pathD, parentKey);
      return;
    }

    const child = childTops[0];
    const sameColumn = Math.abs(parentBottom.x - child.x) < 12;
    const midY = parentBottom.y + (child.y - parentBottom.y) * 0.5;
    const pathD = sameColumn
      ? `M ${parentBottom.x} ${parentBottom.y} L ${child.x} ${child.y}`
      : `M ${parentBottom.x} ${parentBottom.y} L ${parentBottom.x} ${midY} L ${child.x} ${midY} L ${child.x} ${child.y}`;
    appendPath(pathD, parentKey);
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
      <h3 class="expert-tree-panel-title">추가 소모 재화</h3>
      <p class="expert-tree-panel-sub">마지막 「설정 저장」 이후 새로 올린 레벨에 필요한 비용</p>
      <ul class="expert-cost-list">
        <li class="expert-cost-row">
          <span class="expert-cost-icon" aria-hidden="true">${renderExpertCostIconMarkup('gold')}</span>
          <span class="expert-cost-label">필요 골드</span>
          <span class="expert-cost-value">${formatExpertCostValue(costs.gold)}</span>
        </li>
        <li class="expert-cost-row">
          <span class="expert-cost-icon" aria-hidden="true">${renderExpertCostIconMarkup('stone')}</span>
          <span class="expert-cost-label">어빌리티 스톤</span>
          <span class="expert-cost-value">${formatExpertCostValue(costs.stone)}</span>
        </li>
        <li class="expert-cost-row">
          <span class="expert-cost-icon" aria-hidden="true">${renderExpertCostIconMarkup('sp')}</span>
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

let expertScreenshotPrepRestore = null;

function prepareExpertTreeForScreenshot(expand) {
  const pane = document.getElementById('expertTreeScreenshotPane');
  const wrap = document.getElementById('expertTreeBoardWrap');
  if (!pane || !wrap) return;
  if (expand) {
    expertScreenshotPrepRestore = {
      wrapOverflow: wrap.style.overflow,
      wrapHeight: wrap.style.height,
      wrapMinHeight: wrap.style.minHeight,
      paneOverflow: pane.style.overflow
    };
    wrap.style.overflow = 'visible';
    wrap.style.height = `${wrap.scrollHeight}px`;
    wrap.style.minHeight = '0';
    pane.style.overflow = 'visible';
    drawExpertTreeConnectors();
    return;
  }
  if (!expertScreenshotPrepRestore) return;
  wrap.style.overflow = expertScreenshotPrepRestore.wrapOverflow;
  wrap.style.height = expertScreenshotPrepRestore.wrapHeight;
  wrap.style.minHeight = expertScreenshotPrepRestore.wrapMinHeight;
  pane.style.overflow = expertScreenshotPrepRestore.paneOverflow;
  expertScreenshotPrepRestore = null;
  drawExpertTreeConnectors();
}

async function downloadExpertTreeScreenshot() {
  const pane = document.getElementById('expertTreeScreenshotPane');
  if (!pane) return;
  if (typeof html2canvas !== 'function') {
    alert('이미지 생성 라이브러리를 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.');
    return;
  }
  const btn = document.getElementById('expertScreenshotBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '생성 중…';
  }
  try {
    prepareExpertTreeForScreenshot(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await html2canvas(pane, {
      scale: Math.min(2, window.devicePixelRatio || 2),
      backgroundColor: '#121212',
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: pane.scrollWidth,
      height: pane.scrollHeight,
      ignoreElements: (node) => !!(node.classList && node.classList.contains('expert-screenshot-exclude'))
    });
    await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve();
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `띵타해_해양전문가스킬_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    });
  } catch (e) {
    console.error(e);
    alert('이미지를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    prepareExpertTreeForScreenshot(false);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '사진으로 다운';
    }
  }
}
