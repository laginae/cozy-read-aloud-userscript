import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = await readFile('dist/cozy-read-aloud.user.js', 'utf8');
const rows = Array.from({ length: 8 }, (_, i) => `<tr><td>R${i}</td><td>${i}</td><td>${i + 10}</td></tr>`).join('');
const html = `<!doctype html><html lang="en"><title>Public table sample</title><main><article><h1>Fruit counts</h1>
<p>This public example checks table reading. The values are fictional, and every visible row belongs to this short article. A quiet morning is a good time to compare fruit counts and listen to their column names.</p>
<table><caption>Public fruit</caption><thead><tr><th>Fruit</th><th>Count</th></tr></thead><tbody><tr><td>Apples</td><td><span hidden>PRIVATE_SENTINEL</span>0</td></tr><tr><td id="selected-cell">Pears</td><td>3</td></tr></tbody></table>
<h2>Large numeric table</h2><table><tr><th>Item</th><th>A</th><th>B</th></tr>${rows}</table>
<p>The article ends after the tables. No content or credentials are sent to any outside service.</p></article></main></html>`;
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const results = [];
await mkdir('output', { recursive: true });
try {
  for (const compatibility of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 950 } }), external = [], errors = [];
    await context.route('**/*', route => {
      if (route.request().url() === 'https://public-table.test/') return route.fulfill({ contentType: 'text/html', body: html,
        headers: compatibility ? { 'Content-Security-Policy': "default-src 'none'; script-src https://example.com; style-src 'unsafe-inline'; frame-src https://example.com" } : {} });
      external.push(route.request().url()); return route.abort();
    });
    await context.addInitScript(() => {
      window.__spoken = [];
      const voice = { name: 'Public local voice', voiceURI: 'local', lang: 'en-US', localService: true };
      Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [voice], addEventListener() {}, removeEventListener() {}, speak(u) { __spoken.push(u); }, cancel() {}, pause() {}, resume() {} } });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
    });
    await context.addInitScript({ content: `window.addEventListener('DOMContentLoaded',()=>{\n${source}\n},{once:true});` });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://public-table.test/');
    await page.getByRole('button', { name: '打开 Cozy 朗读', exact: true }).click();
    let panel;
    if (compatibility) {
      panel = page.getByRole('region', { name: '兼容朗读面板' }); await panel.waitFor({ timeout: 15000 });
    } else {
      const handle = await page.locator('iframe[title="Cozy Read Aloud 阅读面板"]').elementHandle();
      panel = await handle.contentFrame(); await panel.locator('.prose').waitFor();
      await panel.getByRole('button', { name: '语音设置', exact: true }).click();
    }
    const runtime = compatibility ? page : panel;
    const repeat = panel.getByLabel('每行重复表头', { exact: true });
    await panel.getByText('实际读法预览（本地文字）',{exact:true}).click();
    const before=await panel.locator('details dd').allTextContents();
    for(const name of ['简单函数读法','区间读法']){
      const select=panel.getByLabel(name,{exact:true});await select.focus();await select.press('End');
    }
    const after=await panel.locator('details dd').allTextContents();
    assert.equal(after.length,3);assert.notEqual(after[0],before[0]);assert.notEqual(after[1],before[1]);
    assert.equal(await runtime.evaluate(()=>__spoken.length),0);
    await panel.getByText('实际读法预览（本地文字）',{exact:true}).click();
    assert.equal(await repeat.isChecked(), true);
    if (!compatibility) await panel.getByRole('button', { name: '语音设置', exact: true }).click();
    async function readAll() {
      const start = await runtime.evaluate(() => __spoken.length);
      await panel.getByRole('button', { name: '播放', exact: true }).click();
      return runtime.evaluate(start => {
        let previous;
        for (let n = 0; n < 100; n++) {
          const current = __spoken.at(-1); if (!current || current === previous) break;
          previous = current; current.onend?.();
        }
        return __spoken.slice(start).map(u => u.text).join(' ');
      }, start);
    }
    const normal = await readAll();
    assert.match(normal, /Fruit: Apples; Count: 0/); assert.doesNotMatch(normal, /PRIVATE_SENTINEL|R7/);
    if (!compatibility) await panel.getByRole('button', { name: '语音设置', exact: true }).click();
    await repeat.uncheck();
    if (!compatibility) await panel.getByRole('button', { name: '语音设置', exact: true }).click();
    const once = await readAll();
    assert.match(once, /Table columns: Fruit; Count/); assert.match(once, /Row 1\. Apples; 0/);
    assert.equal((once.match(/Table columns: Fruit; Count/g) || []).length, 1, once);
    assert.doesNotMatch(once, /Count: 0|PRIVATE_SENTINEL|R7/);
    if (!compatibility) await panel.getByRole('button', { name: '语音设置', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await (compatibility ? panel : panel.locator('body')).evaluate(el => el.scrollWidth > el.clientWidth), false);
    await page.screenshot({ path: `output/table-${compatibility ? 'compat' : 'isolated'}-390.png` });
    await panel.getByRole('button', { name: '关闭并停止', exact: true }).click();
    await page.evaluate(() => {
      const range = document.createRange(); range.selectNodeContents(document.getElementById('selected-cell'));
      getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await page.getByRole('button', { name: '打开 Cozy 朗读', exact: true }).click();
    if (!compatibility) await panel.waitForFunction(() => document.querySelector('.prose')?.textContent.trim() === 'Pears');
    const selected = await readAll(); assert.equal(selected.trim(), 'Pears');
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    results.push({ compatibility, defaultOn: true, headerOnce: true, smartSkipPreserved: true, hiddenTextExcluded: true, boundedSelection: true, mobileLayout: true });
    await context.close();
  }
  await writeFile('output/table-browser-check.json', JSON.stringify({ results, externalRequests: 0, realSpeech: false }, null, 2) + '\n');
  console.log('Table browser checks passed in isolated and restrictive-CSP panels; no external requests.');
} finally { await browser.close(); }
