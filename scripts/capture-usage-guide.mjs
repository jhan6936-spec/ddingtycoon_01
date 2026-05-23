/**
 * 이용 가이드용 화면 스크린샷 캡처 (선택 실행)
 *
 * 주의: 가이드/ug-*.png 는 사용자 제공 일러스트입니다.
 * 이 스크립트를 실행하면 일러스트가 스크린샷으로 덮어씌워집니다.
 *
 * 사용: npm run guide:capture
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, '가이드')
const INDEX = path.join(ROOT, 'index.html')

const TARGETS = [
  { id: 'ug-start', fn: async (page) => page.$('.platform-hero') },
  { id: 'ug-warehouse', fn: async (page) => {
    await page.evaluate(() => window.switchSection('warehouse', null))
    await page.waitForSelector('#warehouse .warehouse-toolbar', { timeout: 8000 })
    return page.$('#warehouse .warehouse-toolbar')
  }},
  { id: 'ug-settings', fn: async (page) => {
    await page.evaluate(() => window.switchSection('settings', null))
    await page.waitForSelector('#settings .header', { timeout: 8000 })
    return page.$('#settings .header')
  }},
  { id: 'ug-alchemy', fn: async (page) => {
    await page.evaluate(() => window.openEfficiencySub('alchemy', null))
    await page.waitForSelector('#effAlchemyPane .eff-alchemy-pane-head', { timeout: 8000 })
    return page.$('#effAlchemyPane .eff-alchemy-pane-head')
  }},
  { id: 'ug-craftprice', fn: async (page) => {
    await page.evaluate(() => window.openEfficiencySub('craftPrice', null))
    await page.waitForSelector('#efficiencyContainerCraftPrice', { timeout: 12000 })
    const el = await page.$('#efficiencyContainerCraftPrice .craft-price-header')
    return el || page.$('#effCraftPricePane')
  }},
  { id: 'ug-stamina', fn: async (page) => {
    await page.evaluate(() => window.openEfficiencySub('stamina', null))
    await page.waitForSelector('#effStaminaPane', { timeout: 8000 })
    return page.$('#effStaminaPane')
  }},
  { id: 'ug-recipes', fn: async (page) => {
    await page.evaluate(() => window.switchSection('craft', null))
    await page.waitForSelector('#craft .recipes-grid .recipe-card', { timeout: 12000 })
    return page.$('#craft .recipes-grid')
  }},
]

async function main() {
  if (!fs.existsSync(INDEX)) {
    console.error('index.html not found:', INDEX)
    process.exit(1)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1400, height: 900 } })
  const page = await browser.newPage()
  const fileUrl = 'file:///' + INDEX.replace(/\\/g, '/')
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 })
  await page.waitForFunction(() => typeof window.switchSection === 'function', { timeout: 30000 })
  await page.evaluate(() => window.switchSection('main', null))
  await new Promise((r) => setTimeout(r, 800))

  for (const t of TARGETS) {
    try {
      const el = await t.fn(page)
      if (!el) {
        console.warn('skip (no element):', t.id)
        continue
      }
      const outPath = path.join(OUT_DIR, `${t.id}.png`)
      await el.screenshot({ path: outPath, type: 'png' })
      console.log('saved', outPath)
    } catch (e) {
      console.warn('failed', t.id, e.message)
    }
  }

  await browser.close()
  console.log('done ->', OUT_DIR)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
