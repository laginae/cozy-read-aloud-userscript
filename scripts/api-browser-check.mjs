import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5199/';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const requests=[],blocked=[],errors=[];
function wave(){const b=Buffer.alloc(44+8000*12*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;}
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,api-key,content-type','access-control-allow-methods':'POST,OPTIONS'};
let fail=false,hold=false,release;
try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route('**/*',async route=>{
    const req=route.request(),url=req.url();
    if(url.startsWith(base)||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();
    const mimo=url==='https://api.xiaomimimo.com/v1/chat/completions';
    if(!mimo&&url!=='https://openrouter.ai/api/v1/audio/speech'){blocked.push(url);return route.abort();}
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    const body=req.postDataJSON();
    requests.push({provider:mimo?'mimo':'openrouter',body});
    assert.equal(req.headers()[mimo?'api-key':'authorization'],mimo?'public-mimo-placeholder':'Bearer public-openrouter-placeholder');
    assert.ok(!req.headers().referer);assert.ok(!req.headers().cookie);
    if(mimo){assert.equal(body.model,'mimo-v2.5-tts');assert.equal(body.audio.voice,'冰糖');assert.equal(body.provider,undefined);}
    else assert.deepEqual(body.provider,{zdr:true,data_collection:'deny'});
    if(hold)await new Promise(resolve=>release=resolve);
    if(fail)return route.fulfill({status:400,headers,contentType:'application/json',body:JSON.stringify({error:'PRIVATE_RESPONSE_SENTINEL public-openrouter-placeholder'})});
    const result=mimo?{status:200,headers,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{audio:{data:wave().toString('base64')}}}]})}:{status:200,headers,contentType:'audio/wav',body:wave()};
    await route.fulfill(result).catch(()=>{});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.getByRole('button',{name:'打开 Cozy 朗读',exact:true}).click();
  const frame=await (await page.locator('iframe').elementHandle()).contentFrame();
  await frame.locator('.prose').waitFor();
  await frame.getByRole('button',{name:'语音设置',exact:true}).click();
  await frame.locator('#engine').selectOption('openrouter');
  await frame.locator('#api-key').fill('public-openrouter-placeholder');
  await frame.getByRole('button',{name:'播放',exact:true}).click();
  await frame.locator('#notice').filter({hasText:'授权'}).waitFor();assert.equal(requests.length,0);
  await frame.locator('#api-consent').check();
  const original=await frame.locator('.prose').innerText();
  await page.evaluate(()=>{
    const f=document.querySelector('[data-cozy-host]').shadowRoot.querySelector('iframe');
    f.contentWindow.postMessage({cozy:true,type:'document',blocks:[{text:'MALICIOUS_PUBLIC_SENTINEL',source:0}]},'*');
    f.contentWindow.postMessage({cozy:true,type:'play'},'*');
  });
  await frame.waitForTimeout(100);assert.equal(await frame.locator('.prose').innerText(),original);assert.equal(requests.length,0);
  assert.equal(await page.evaluate(()=>{const f=document.querySelector('[data-cozy-host]').shadowRoot.querySelector('iframe');try{return !!f.contentDocument;}catch{return false;}}),false);
  assert.ok(!(await page.content()).includes('public-openrouter-placeholder'));
  await frame.getByRole('button',{name:'播放',exact:true}).click();await frame.getByRole('button',{name:'暂停',exact:true}).waitFor();
  await frame.getByRole('button',{name:'暂停',exact:true}).click();await frame.getByRole('button',{name:'继续',exact:true}).click();
  await frame.getByRole('button',{name:'停止',exact:true}).click();
  await frame.getByRole('button',{name:'播放',exact:true}).click();await frame.getByRole('button',{name:'暂停',exact:true}).waitFor();assert.equal(requests.length,1);
  await frame.getByRole('button',{name:'停止',exact:true}).click();
  await frame.locator('#engine').selectOption('mimo');
  await frame.locator('#mimo-key').fill('public-mimo-placeholder');await frame.locator('#mimo-voice').selectOption('冰糖');
  await frame.getByRole('button',{name:'播放',exact:true}).click();assert.equal(requests.length,1);
  await frame.locator('#mimo-consent').check();await frame.getByRole('button',{name:'播放',exact:true}).click();await frame.getByRole('button',{name:'暂停',exact:true}).waitFor();
  assert.equal(requests.at(-1).provider,'mimo');
  await frame.getByRole('button',{name:'停止',exact:true}).click();
  await frame.locator('#engine').selectOption('openrouter');await frame.locator('#api-consent').check();
  fail=true;await frame.getByRole('button',{name:'播放',exact:true}).click();await frame.locator('#notice').filter({hasText:'HTTP 400'}).waitFor();
  assert.doesNotMatch(await frame.locator('#notice').innerText(),/PRIVATE_RESPONSE|placeholder/);assert.match(await frame.locator('#notice').innerText(),/不代表额度不足/);
  fail=false;hold=true;await frame.getByRole('button',{name:'播放',exact:true}).click();
  await frame.locator('#status').filter({hasText:'合成中'}).waitFor();
  for(let n=0;n<100&&!release;n++)await frame.waitForTimeout(20);
  assert.ok(release);await frame.getByRole('button',{name:'停止',exact:true}).click();release();await frame.waitForTimeout(150);assert.equal(await frame.locator('#status').innerText(),'已就绪');
  await frame.getByRole('button',{name:'关闭并停止',exact:true}).click();
  await page.getByRole('button',{name:'打开 Cozy 朗读',exact:true}).click();
  assert.equal(await frame.locator('#api-key').inputValue(),'');assert.equal(await frame.locator('#mimo-key').inputValue(),'');assert.equal(await frame.locator('#engine').inputValue(),'system');
  assert.equal(await frame.locator('#api-consent').isChecked(),false);assert.equal(await frame.locator('#mimo-consent').isChecked(),false);
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
  await mkdir('output',{recursive:true});await writeFile('output/api-browser-check.json',JSON.stringify({passed:true,openrouter:true,mimo:true,requestCount:requests.length,forcedZdrForOpenRouter:true,perProviderConsent:true,noHostAccessToKey:true,unsolicitedDocumentBlocked:true,clearOnClose:true,cancellation:true,cacheReused:true,paidRequests:0,errors},null,2)+'\n');
  console.log('API browser checks passed with mock audio only; both providers, consent, isolation, cache and cancellation verified.');
}finally{await browser.close();}
