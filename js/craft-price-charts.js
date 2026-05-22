/**
 * 공예품 가격 이력 그래프 (Supabase craft_price_history)
 */
const CRAFT_CHART_NAMES = [
  '조개껍데기 브로치',
  '푸른 향수병',
  '자개 손거울',
  '분홍 헤어핀',
  '자개 부채',
  '흑진주 시계'
]

const CHART_Y_MAX_GOLD = 1000000
const CHART_Y_MAX_SQRT = Math.sqrt(CHART_Y_MAX_GOLD)

/** Y축 눈금(실제 Gold) — √ 스케일로 표시해 저가 품목(브로치 등)도 잘 보이게 */
const CHART_Y_TICK_GOLD = [0, 25000, 50000, 100000, 200000, 400000, 600000, 800000, 1000000]

const CRAFT_CHART_STYLES = {
  '조개껍데기 브로치': {
    borderColor: '#facc15',
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
    pointBackgroundColor: '#facc15',
    pointBorderColor: '#fef08a'
  },
  '푸른 향수병': {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    pointBackgroundColor: '#3b82f6',
    pointBorderColor: '#93c5fd'
  },
  '자개 손거울': {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    pointBackgroundColor: '#38bdf8',
    pointBorderColor: '#bae6fd'
  },
  '분홍 헤어핀': {
    borderColor: '#f472b6',
    backgroundColor: 'rgba(244, 114, 182, 0.2)',
    pointBackgroundColor: '#f472b6',
    pointBorderColor: '#fbcfe8'
  },
  '자개 부채': {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    pointBackgroundColor: '#a78bfa',
    pointBorderColor: '#ddd6fe'
  },
  '흑진주 시계': {
    borderColor: '#94a3b8',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    pointBackgroundColor: '#0f172a',
    pointBorderColor: '#f8fafc',
    borderWidth: 3,
    pointBorderWidth: 2.5,
    pointRadius: 5,
    outlineColor: 'rgba(255, 255, 255, 0.88)',
    outlineWidth: 7
  }
}

const goldToChartY = (gold) => {
  const g = Math.max(0, Math.min(CHART_Y_MAX_GOLD, Number(gold) || 0))
  return Math.sqrt(g)
}

const chartYToGold = (ySqrt) => Math.round((Number(ySqrt) || 0) ** 2)

const formatChartDateLabel = (value) => {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(d)
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return m && day ? `${m}/${day}` : ''
}

const CraftPriceCharts = {
  chartInstance: null,
  days: 90,
  mounted: false,

  reset() {
    if (this.chartInstance) {
      this.chartInstance.destroy()
      this.chartInstance = null
    }
    const canvas = document.getElementById('craftPriceHistoryChart')
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  },

  setNoteError(message) {
    const note = document.getElementById('craftPriceHistoryNote')
    if (!note) return
    if (message) {
      note.hidden = false
      note.textContent = message
    } else {
      note.hidden = true
      note.textContent = ''
    }
  },

  async fetchHistory(days) {
    const cfg = window.SUPABASE_CONFIG
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    if (cfg && cfg.url && cfg.anonKey) {
      const base = String(cfg.url).replace(/\/$/, '')
      const url =
        base +
        '/rest/v1/craft_price_history?select=craft_name,price,current_price,max_price,recorded_at' +
        '&recorded_at=gte.' +
        encodeURIComponent(since) +
        '&order=recorded_at.asc'

      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          apikey: cfg.anonKey,
          Authorization: 'Bearer ' + cfg.anonKey,
          Accept: 'application/json'
        }
      })
      if (response.ok) {
        const rows = await response.json()
        if (Array.isArray(rows)) return rows
      }
      const text = await response.text().catch(() => '')
      throw new Error('craft_price_history 조회 실패: ' + response.status + ' ' + text.slice(0, 120))
    }

    throw new Error('supabase-config.js에 SUPABASE_CONFIG(url, anonKey)가 필요합니다.')
  },

  normalizeHistoryPoint(name, row) {
    const raw =
      row.current_price != null && row.current_price > 0
        ? Number(row.current_price)
        : Number(row.price) || 0
    if (!raw) return null

    const ceiling =
      typeof window.getCraftMaxPrice === 'function' ? window.getCraftMaxPrice(name) : 0
    let gold =
      typeof window.repairCraftCurrentPrice === 'function'
        ? window.repairCraftCurrentPrice(name, raw)
        : raw

    if (ceiling && gold > ceiling * 1.15) return null
    if (gold < 500) return null

    gold = Math.min(CHART_Y_MAX_GOLD, gold)

    return {
      x: row.recorded_at,
      y: goldToChartY(gold),
      gold
    }
  },

  buildDatasets(history) {
    const byName = new Map()
    CRAFT_CHART_NAMES.forEach((name) => byName.set(name, []))

    history.forEach((row) => {
      const name = row.craft_name
      if (!byName.has(name)) return
      const point = this.normalizeHistoryPoint(name, row)
      if (point) byName.get(name).push(point)
    })

    const datasets = []

    CRAFT_CHART_NAMES.forEach((name) => {
      const style = CRAFT_CHART_STYLES[name] || {
        borderColor: '#94a3b8',
        backgroundColor: 'rgba(148, 163, 184, 0.2)',
        pointBackgroundColor: '#94a3b8',
        pointBorderColor: '#e2e8f0'
      }
      const data = byName.get(name) || []
      if (!data.length) return

      if (style.outlineColor) {
        datasets.push({
          label: '',
          data: [...data],
          borderColor: style.outlineColor,
          backgroundColor: 'transparent',
          borderWidth: style.outlineWidth || 5,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.25,
          spanGaps: true,
          order: 0
        })
      }

      datasets.push({
        label: name,
        data,
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
        pointBackgroundColor: style.pointBackgroundColor,
        pointBorderColor: style.pointBorderColor,
        borderWidth: style.borderWidth || 2,
        pointBorderWidth: style.pointBorderWidth || 1,
        tension: 0.25,
        pointRadius: style.pointRadius || 4,
        pointHoverRadius: 6,
        spanGaps: true,
        order: style.outlineColor ? 1 : 0
      })
    })

    return datasets
  },

  async render(container) {
    if (!container || !window.Chart) return

    const wrap = document.getElementById('craftPriceHistoryWrap')
    const canvas = document.getElementById('craftPriceHistoryChart')
    if (!wrap || !canvas) return

    this.reset()
    this.setNoteError('')

    try {
      const history = await this.fetchHistory(this.days)
      const datasets = this.buildDatasets(history)

      if (!datasets.length) {
        this.setNoteError('아직 기록된 가격 이력이 없습니다. admin에서 공예품을 저장하면 그래프가 쌓입니다.')
        return
      }

      this.chartInstance = new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#c8d0d8',
                boxWidth: 14,
                padding: 18,
                font: { size: 12, lineHeight: 1.65 },
                usePointStyle: true,
                pointStyleWidth: 10,
                filter: (item) => Boolean(item.text)
              }
            },
            tooltip: {
              filter: (item) => Boolean(item.dataset.label),
              callbacks: {
                title: (items) => {
                  if (!items.length) return ''
                  const raw = items[0].parsed.x
                  const d = raw instanceof Date ? raw : new Date(raw)
                  if (Number.isNaN(d.getTime())) return ''
                  return new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  }).format(d)
                },
                label: (ctx) => {
                  const gold =
                    ctx.raw && ctx.raw.gold != null
                      ? ctx.raw.gold
                      : chartYToGold(ctx.parsed.y)
                  return (ctx.dataset.label || '') + ': ' + gold.toLocaleString() + 'G'
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                tooltipFormat: 'yyyy-MM-dd',
                displayFormats: {
                  millisecond: 'M/d',
                  second: 'M/d',
                  minute: 'M/d',
                  hour: 'M/d',
                  day: 'M/d',
                  week: 'M/d',
                  month: 'yyyy-MM',
                  quarter: 'yyyy-MM',
                  year: 'yyyy'
                }
              },
              ticks: {
                color: '#9aa8b8',
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 14,
                padding: 12,
                font: { size: 11 },
                callback: (value) => formatChartDateLabel(value)
              },
              grid: { color: 'rgba(255,255,255,0.06)' }
            },
            y: {
              min: 0,
              max: CHART_Y_MAX_SQRT,
              ticks: {
                color: '#9aa8b8',
                padding: 14,
                font: { size: 11 },
                values: CHART_Y_TICK_GOLD.map((g) => goldToChartY(g)),
                callback: (v) => chartYToGold(v).toLocaleString() + 'G'
              },
              grid: { color: 'rgba(255,255,255,0.06)' }
            }
          }
        }
      })
    } catch (err) {
      this.setNoteError(String(err.message || err))
      console.warn('[craft-price-charts]', err)
    }
  },

  ensureSection(parent) {
    let wrap = document.getElementById('craftPriceHistoryWrap')
    if (wrap) return wrap

    wrap = document.createElement('div')
    wrap.id = 'craftPriceHistoryWrap'
    wrap.className = 'panel-card craft-price-chart-section'
    wrap.innerHTML = `
      <div class="craft-price-chart-head">
        <div class="craft-price-chart-title">공예품 가격 추이</div>
        <label class="craft-price-chart-period">
          <span>기간</span>
          <select id="craftHistoryDays" aria-label="가격 추이 기간">
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="90" selected>90일</option>
            <option value="180">180일</option>
            <option value="365">1년</option>
          </select>
        </label>
      </div>
      <p id="craftPriceHistoryNote" class="craft-price-chart-error" hidden></p>
      <div class="craft-price-chart-canvas-wrap">
        <canvas id="craftPriceHistoryChart" aria-label="공예품 가격 추이 차트"></canvas>
      </div>
    `
    parent.appendChild(wrap)

    const select = document.getElementById('craftHistoryDays')
    if (select) {
      select.addEventListener('change', () => {
        CraftPriceCharts.days = Math.max(1, parseInt(select.value, 10) || 90)
        CraftPriceCharts.render(parent)
      })
    }

    return wrap
  },

  mount(parent) {
    if (!parent) return
    this.ensureSection(parent)
    this.render(parent)
    this.mounted = true
  },

  refresh(parent) {
    const container = parent || document.getElementById('efficiencyContainerCraftPrice')
    if (!container) return
    if (!this.mounted) this.mount(container)
    else this.render(container)
  }
}

window.CraftPriceCharts = CraftPriceCharts
