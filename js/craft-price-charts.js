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

const CRAFT_CHART_COLORS = [
  '#56a3f1',
  '#4ade80',
  '#f6c15a',
  '#f472b6',
  '#a78bfa',
  '#fb923c'
]

const CraftPriceCharts = {
  chartInstance: null,
  days: 90,
  mounted: false,

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

  buildDatasets(history) {
    const byName = new Map()
    CRAFT_CHART_NAMES.forEach((name) => byName.set(name, []))

    history.forEach((row) => {
      const name = row.craft_name
      if (!byName.has(name)) return
      const y =
        row.current_price != null && row.current_price > 0
          ? Number(row.current_price)
          : Number(row.price) || 0
      byName.get(name).push({
        x: row.recorded_at,
        y
      })
    })

    return CRAFT_CHART_NAMES.map((name, idx) => ({
      label: name,
      data: byName.get(name) || [],
      borderColor: CRAFT_CHART_COLORS[idx % CRAFT_CHART_COLORS.length],
      backgroundColor: CRAFT_CHART_COLORS[idx % CRAFT_CHART_COLORS.length] + '33',
      tension: 0.25,
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: true
    })).filter((ds) => ds.data.length > 0)
  },

  async render(container) {
    if (!container || !window.Chart) return

    const wrap = document.getElementById('craftPriceHistoryWrap')
    const canvas = document.getElementById('craftPriceHistoryChart')
    const note = document.getElementById('craftPriceHistoryNote')
    if (!wrap || !canvas) return

    if (note) note.textContent = '이력 불러오는 중…'

    try {
      const history = await this.fetchHistory(this.days)
      const datasets = this.buildDatasets(history)

      if (this.chartInstance) {
        this.chartInstance.destroy()
        this.chartInstance = null
      }

      if (!datasets.length) {
        if (note) {
          note.textContent =
            '아직 기록된 가격 이력이 없습니다. admin에서 공예품을 저장하면 그래프가 쌓입니다.'
        }
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
              labels: { color: '#bbb', boxWidth: 12, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y
                  return (ctx.dataset.label || '') + ': ' + (Number(v) || 0).toLocaleString() + 'G'
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                tooltipFormat: 'yyyy-MM-dd HH:mm',
                displayFormats: { day: 'MM/dd', week: 'MM/dd', month: 'yyyy-MM' }
              },
              ticks: { color: '#888', maxRotation: 0 },
              grid: { color: 'rgba(255,255,255,0.06)' }
            },
            y: {
              ticks: {
                color: '#888',
                callback: (v) => Number(v).toLocaleString() + 'G'
              },
              grid: { color: 'rgba(255,255,255,0.06)' }
            }
          }
        }
      })

      if (note) {
        note.textContent =
          '저장 ' +
          history.length +
          '건 · 최근 ' +
          this.days +
          '일 · admin 저장 시마다 자동 누적'
      }
    } catch (err) {
      if (note) note.textContent = String(err.message || err)
      console.warn('[craft-price-charts]', err)
    }
  },

  ensureSection(parent) {
    let wrap = document.getElementById('craftPriceHistoryWrap')
    if (wrap) return wrap

    wrap = document.createElement('div')
    wrap.id = 'craftPriceHistoryWrap'
    wrap.className = 'panel-card'
    wrap.style.cssText = 'margin-top:16px;padding:14px 16px;'
    wrap.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:900;color:#e5e5e5;">공예품 가격 추이</div>
        <label style="font-size:12px;color:#9d9d9d;display:flex;align-items:center;gap:8px;">
          <span>기간</span>
          <select id="craftHistoryDays" style="background:#151515;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 8px;font-size:12px;">
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="90" selected>90일</option>
            <option value="180">180일</option>
            <option value="365">1년</option>
          </select>
        </label>
      </div>
      <p id="craftPriceHistoryNote" style="font-size:11px;color:#888;margin-bottom:10px;"></p>
      <div style="position:relative;height:320px;width:100%;">
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
