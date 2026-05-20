/** 세이지 낚싯대 설정 UI */

function changeSageEngravingDelta(key, delta) {
  const meta = sageEngravingMeta[key];
  if (!meta) return;
  const next = (sageEngravingState[key] || 0) + (parseInt(delta, 10) || 0);
  changeSageEngravingLevel(key, next);
}

function renderSageRodStatCard(label, value, sub) {
  const subHtml = sub ? `<div class="sage-rod-stat-sub">${sub}</div>` : '';
  return `
    <div class="sage-rod-stat-card">
      <div class="sage-rod-stat-label">${label}</div>
      <div class="sage-rod-stat-value">${value}</div>
      ${subHtml}
    </div>
  `;
}

function renderSageEngravingCard(key) {
  const meta = sageEngravingMeta[key];
  if (!meta) return '';
  const lv = sageEngravingState[key] || 0;
  const maxLv = meta.values.length - 1;
  const val = meta.values[lv] ?? 0;
  const unit = meta.unit || '';
  return `
    <div class="sage-rod-engrave-card">
      <div class="sage-rod-engrave-head">
        <span class="sage-rod-engrave-name">${meta.label}</span>
        <span class="sage-rod-engrave-lv">${lv}/${maxLv}</span>
      </div>
      <p class="sage-rod-engrave-desc">${meta.desc}</p>
      <div class="sage-rod-engrave-effect">${val}${unit}</div>
      <div class="sage-rod-engrave-controls">
        <button type="button" class="expert-tree-btn" aria-label="${meta.label} 레벨 내리기" onclick="changeSageEngravingDelta('${key}', -1)" ${lv <= 0 ? 'disabled' : ''}>−</button>
        <button type="button" class="expert-tree-btn" aria-label="${meta.label} 레벨 올리기" onclick="changeSageEngravingDelta('${key}', 1)" ${lv >= maxLv ? 'disabled' : ''}>+</button>
      </div>
    </div>
  `;
}

function renderSageRod() {
  const lvEl = document.getElementById('sageRodLevel');
  const statEl = document.getElementById('sageRodStats');
  const summaryEl = document.getElementById('sageRodSummary');
  const visEl = document.getElementById('sageRodVisual');
  const engraveEl = document.getElementById('sageRodEngravings');
  if (!lvEl || !statEl || !visEl || !engraveEl) return;

  const engraving = getSageEngravingEffects();
  const basePower = sageRodStats.power[sageRodLevel] || 0;
  const baseShell = sageRodStats.shellChance[sageRodLevel] || 0;
  const finalPower = Math.round(basePower * (1 + engraving.fishingPowerBoost / 100));
  const finalShellChance = baseShell + engraving.shellSearchChance;
  const shellDrop = sageRodStats.shellDrop[sageRodLevel] || 0;
  const timeReduce = sageRodStats.timeReduce[sageRodLevel] || 0;

  lvEl.textContent = `${sageRodLevel}강`;
  visEl.innerHTML = `<img class="sage-rod-visual-img" src="${sageRodVisualSrc(sageRodLevel)}" alt="세이지 낚싯대 ${sageRodLevel}강" loading="lazy" decoding="async" draggable="false">`;

  statEl.innerHTML = [
    renderSageRodStatCard('제작 시간 감소', `${timeReduce}%`, '낚싯대 강화 보너스'),
    renderSageRodStatCard('조개 등장', `${finalShellChance}%`, `기본 ${baseShell}% + 각인 ${engraving.shellSearchChance}%`),
    renderSageRodStatCard('어패류 드롭', `${shellDrop}개`, '1회 수중 어획 기준'),
    renderSageRodStatCard('수중 어획력', `${finalPower}`, `기본 ${basePower} · 각인 +${engraving.fishingPowerBoost}%`)
  ].join('');

  if (summaryEl) {
    summaryEl.innerHTML = `
      <ul class="sage-rod-summary-list">
        <li><span class="sage-rod-summary-k">어패 추가 기대</span><span class="sage-rod-summary-v">+${(engraving.shellLuckChance / 100).toFixed(2)} / 회</span></li>
        <li><span class="sage-rod-summary-k">룰렛 어패 기대</span><span class="sage-rod-summary-v">+${engraving.rouletteShellExpected.toFixed(2)} / 회</span></li>
        <li><span class="sage-rod-summary-k">물고기 행운</span><span class="sage-rod-summary-v">${engraving.fishLuckChance}%</span></li>
        <li><span class="sage-rod-summary-k">정령 고래 · 가오리</span><span class="sage-rod-summary-v">${engraving.spiritWhaleChance}% · ${engraving.rayGuideChance}%</span></li>
      </ul>
    `;
  }

  const engraveCore = ['fishingPower', 'shellSearch', 'shellLuck', 'fishLuck'];
  const engraveEvent = ['spiritWhale', 'rayGuide', 'fisherRoulette'];

  engraveEl.innerHTML = `
    <section class="sage-rod-engrave-group">
      <h4 class="sage-rod-engrave-group-title">채집 · 어획 각인</h4>
      <div class="sage-rod-engrave-grid">${engraveCore.map(renderSageEngravingCard).join('')}</div>
    </section>
    <section class="sage-rod-engrave-group">
      <h4 class="sage-rod-engrave-group-title">이벤트 각인</h4>
      <div class="sage-rod-engrave-grid">${engraveEvent.map(renderSageEngravingCard).join('')}</div>
    </section>
  `;

  const minusBtn = document.getElementById('sageRodLevelMinus');
  const plusBtn = document.getElementById('sageRodLevelPlus');
  if (minusBtn) minusBtn.disabled = sageRodLevel <= 0;
  if (plusBtn) plusBtn.disabled = sageRodLevel >= 15;
}
