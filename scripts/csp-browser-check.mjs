import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('dist/cozy-read-aloud.user.js','utf8');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const html='<!doctype html><html lang="en"><title>Public CSP sample</title><main><article><h1>A quiet morning</h1><p>The sun rises above the trees. This public sample tests reading under a restrictive site policy.</p><p>A quiet path follows the river. The second paragraph is available for selection and continuation.</p><p>The small garden welcomes visitors. The last paragraph completes this public reading sample.</p></article></main><script>window.inlineMarker=true;</script></html>';
const policies=[
  {name:'github-like',csp:"default-src 'none'; script-src https://github.githubassets.com; style-src 'unsafe-inline'; img-src data:; frame-src https://viewscreen.githubusercontent.com; connect-src 'self'; worker-src https://github.githubassets.com"},
  {name:'trusted-types',csp:"default-src 'none'; script-src https://example.com; style-src 'unsafe-inline'; require-trusted-types-for 'script'; trusted-types 'none'"},
];
const results=[];
await mkdir('output',{recursive:true});
try{
  for(const {name,csp} of policies){
    const context=await browser.newContext({viewport:{width:1280,height:900}}),requests=[],errors=[];
    await context.route('**/*',route=>{
      if(route.request().url()==='https://public-reading.test/')return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':csp},body:html});
      requests.push(route.request().url());return route.abort();
    });
    await context.addInitScript(()=>{
      window.__spoken=[];window.__cancels=0;
      const local={name:'Public local voice',voiceURI:'local',lang:'en-US',localService:true};
      const remote={name:'Remote excluded voice',voiceURI:'remote',lang:'en-US',localService:false};
      Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[local,remote],addEventListener(){},removeEventListener(){},speak(u){__spoken.push(u);},cancel(){__cancels++;},pause(){},resume(){}}});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}}});
    });
    // Simulate extension execution while keeping the page/iframe CSP enforced.
    await context.addInitScript({content:`window.addEventListener('DOMContentLoaded',()=>{\n${source}\n},{once:true});`});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://public-reading.test/');
    assert.equal(await page.evaluate(()=>window.inlineMarker),undefined);
    await page.getByRole('button',{name:'打开 Cozy 朗读',exact:true}).click();
    const panel=page.getByRole('region',{name:'兼容朗读面板'});
    await panel.waitFor({timeout:15000});
    assert.match(await panel.locator('.compat-preview').innerText(),/quiet morning|sun rises/i);
    assert.equal(await page.locator('iframe').count(),0);
    assert.equal(await panel.locator('input[type=password],input[type=file]').count(),0);
    assert.equal(await panel.getByRole('combobox',{name:'本机音色',exact:true}).locator('option').count(),2);
    await panel.getByRole('button',{name:'播放',exact:true}).evaluate(el=>el.click());
    assert.equal(await page.evaluate(()=>__spoken.length),0,'Synthetic host click must not start speech');
    await panel.getByRole('button',{name:'播放',exact:true}).click();
    await panel.getByRole('button',{name:'暂停',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>__spoken.at(-1).voice.localService),true);
    await panel.getByRole('button',{name:'暂停',exact:true}).click();
    await panel.getByRole('button',{name:'继续',exact:true}).click();
    assert.equal(await page.evaluate(()=>__spoken.length),1);
    await panel.getByRole('button',{name:'下一段',exact:true}).click();
    await page.evaluate(()=>__spoken[0].onend());assert.equal(await page.evaluate(()=>__spoken.length),2);
    await panel.getByRole('button',{name:'停止',exact:true}).click();
    await panel.getByRole('button',{name:'关闭并停止',exact:true}).click();
    await page.evaluate(()=>{const el=document.querySelector('article p:nth-of-type(2)');const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);});
    await page.getByRole('button',{name:'打开 Cozy 朗读',exact:true}).click();
    assert.match(await panel.locator('.compat-preview').innerText(),/^A quiet path/);
    await panel.getByRole('button',{name:'从选区继续',exact:true}).click();
    await panel.getByRole('button',{name:'下一段',exact:true}).click();
    assert.match(await page.evaluate(()=>__spoken.at(-1).text),/small garden/);
    await panel.getByRole('button',{name:'停止',exact:true}).click();
    const layouts=[];
    for(const width of [768,390,320]){
      await page.setViewportSize({width,height:780});
      const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0);
      assert.equal(await panel.evaluate(el=>el.scrollWidth>el.clientWidth),false);
      await page.screenshot({path:`output/csp-${name}-${width}.png`});layouts.push(width);
    }
    const cancels=await page.evaluate(()=>__cancels);
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    assert.ok(await page.evaluate(()=>__cancels)>cancels);
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    results.push({name,passed:true,localOnly:true,noKeyOrFileInput:true,noNetwork:true,hostSyntheticClickRejected:true,pauseResume:true,selection:true,continuation:true,pageHideStops:true,layouts});
    await context.close();
  }
  await writeFile('output/csp-browser-check.json',JSON.stringify({results,realSpeech:false},null,2));
  console.log('CSP compatibility checks passed: local-only playback, selection, continuation, no keys/files/network and responsive layouts.');
}finally{await browser.close();}
