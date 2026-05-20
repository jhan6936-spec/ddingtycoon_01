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
    <div class="sage-rod-stat-card" title="${sub || ''}">
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
    <div class="sage-rod-engrave-card" title="${meta.desc}">
      <div class="sage-rod-engrave-row">
        <div class="sage-rod-engrave-meta">
          <span class="sage-rod-engrave-name">${meta.label}</span>
          <span class="sage-rod-engrave-lv">${lv}/${maxLv}</span>
        </div>
        <span class="sage-rod-engrave-effect">${val}${unit}</span>
        <div class="sage-rod-engrave-controls">
          <button type="button" class="expert-tree-btn" aria-label="${meta.label} 레벨 내리기" onclick="changeSageEngravingDelta('${key}', -1)" ${lv <= 0 ? 'disabled' : ''}>−</button>
          <button type="button" class="expert-tree-btn" aria-label="${meta.label} 레벨 올리기" onclick="changeSageEngravingDelta('${key}', 1)" ${lv >= maxLv ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>
  `;
}

function renderSageRodBonusChip(label, value) {
  return `
    <span class="sage-rod-bonus-chip">
      <span class="sage-rod-bonus-chip-k">${label}</span>
      <span class="sage-rod-bonus-chip-v">${value}</span>
    </span>
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
    renderSageRodStatCard('시간 감소', `${timeReduce}%`, null),
    renderSageRodStatCard('조개 등장', `${finalShellChance}%`, `+각인 ${engraving.shellSearchChance}%`),
    renderSageRodStatCard('어패 드롭', `${shellDrop}개`, null),
    renderSageRodStatCard('어획력', `${finalPower}`, `+각인 ${engraving.fishingPowerBoost}%`)
  ].join('');

  if (summaryEl) {
    summaryEl.innerHTML = [
      renderSageRodBonusChip('어패 추가', `+${(engraving.shellLuckChance / 100).toFixed(2)}/회`),
      renderSageRodBonusChip('룰렛 어패', `+${engraving.rouletteShellExpected.toFixed(2)}/회`),
      renderSageRodBonusChip('물고기 행운', `${engraving.fishLuckChance}%`),
      renderSageRodBonusChip('정령 고래', `${engraving.spiritWhaleChance}%`),
      renderSageRodBonusChip('가오리 인도', `${engraving.rayGuideChance}%`)
    ].join('');
  }

  const allEngravings = [
    'fishingPower',
    'shellSearch',
    'shellLuck',
    'fishLuck',
    'spiritWhale',
    'rayGuide',
    'fisherRoulette'
  ];
  engraveEl.innerHTML = allEngravings.map(renderSageEngravingCard).join('');

  const minusBtn = document.getElementById('sageRodLevelMinus');
  const plusBtn = document.getElementById('sageRodLevelPlus');
  if (minusBtn) minusBtn.disabled = sageRodLevel <= 0;
  if (plusBtn) plusBtn.disabled = sageRodLevel >= 15;
}
