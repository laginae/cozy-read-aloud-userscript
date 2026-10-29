import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiPlayer, requestBody, requestAudio, decodeMimo, ENDPOINT, MIMO_ENDPOINT, MIMO_VOICES } from '../src/api-player.js';
const settings={engine:'openrouter',key:'public-test-placeholder',model:'elevenlabs/eleven-multilingual-v2',voice:'sarah',consent:true};
function wave(){const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;}
const audio=()=>new Response(wave(),{headers:{'content-type':'audio/wav'}});
const signal=()=>new AbortController().signal;
test('OpenRouter requires consent and always requests ZDR',()=>{
  assert.throws(()=>requestBody('Public text.',{...settings,consent:false}));
  const body=requestBody('Public text.',settings);assert.deepEqual(body.provider,{zdr:true,data_collection:'deny'});assert.equal(body.response_format,'mp3');assert.ok(!JSON.stringify(body).includes(settings.key));
});
test('fixed endpoints, omitted cookies, no referrer or redirect',async()=>{
  await requestAudio('Public text.',settings,signal(),async(url,options)=>{
    assert.equal(url,ENDPOINT);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+settings.key);return audio();
  });
});
test('MiMo uses a separate key header, assistant text, and eight documented voices',async()=>{
  for(const voice of MIMO_VOICES){const body=requestBody('Public text.',{...settings,engine:'mimo',voice});assert.equal(body.model,'mimo-v2.5-tts');assert.equal(body.messages.at(-1).role,'assistant');assert.equal(body.messages.at(-1).content,'Public text.');assert.equal(body.audio.voice,voice);assert.equal(body.provider,undefined);}
  await requestAudio('Public text.',{...settings,engine:'mimo',voice:'白桦'},signal(),async(url,options)=>{
    assert.equal(url,MIMO_ENDPOINT);assert.equal(options.headers['api-key'],settings.key);assert.equal(options.headers.Authorization,undefined);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{audio:{data:wave().toString('base64')}}}]}),{headers:{'content-type':'application/json'}});
  });
});
test('MiMo rejects truncation, abnormal finish, and malformed audio',()=>{
  const wrap=(data,reason='stop')=>JSON.stringify({choices:[{finish_reason:reason,message:{audio:{data}}}]});
  assert.equal(decodeMimo(wrap(wave().toString('base64'))).type,'audio/wav');
  assert.throws(()=>decodeMimo(wrap(wave().toString('base64'),'length')));
  assert.throws(()=>decodeMimo(wrap('invalid')));
  const truncated=wave();truncated.writeUInt32LE(100,4);assert.throws(()=>decodeMimo(wrap(truncated.toString('base64'))));
});
test('HTTP failures never echo response text, never retry, and distinguish 400 from 402',async()=>{
  for(const status of [400,401,402,403,429,500]) {
    let requests=0;
    await assert.rejects(requestAudio('Public text.',settings,signal(),async()=>{requests++;return new Response('PRIVATE_RESPONSE_SENTINEL '+settings.key,{status});}),error=>{
      assert.ok(!error.message.includes('PRIVATE_RESPONSE_SENTINEL'));assert.ok(!error.message.includes(settings.key));
      if(status===400)assert.match(error.message,/不代表额度不足/);if(status===402)assert.match(error.message,/额度或支付/);return true;
    });assert.equal(requests,1);
  }
});
test('response validation is bounded and rejects HTML and oversized audio',async()=>{
  await assert.rejects(requestAudio('Public text.',settings,signal(),async()=>new Response('html',{headers:{'content-type':'text/html'}})));
  await assert.rejects(requestAudio('Public text.',settings,signal(),async()=>new Response('x',{headers:{'content-type':'audio/wav','content-length':String(20*1024*1024)}})));
  await assert.rejects(requestAudio('Public text.',settings,signal(),async()=>new Response(new Uint8Array(17*1024*1024),{headers:{'content-type':'audio/wav'}})));
});
function setup(fetcher=async()=>audio(),timeout=60000){
  const audios=[],errors=[],revoked=[];
  class AudioMock{constructor(url){this.src=url;audios.push(this);}play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){}}
  const p=new ApiPlayer({settings:()=>settings,rate:()=>1.5,onchange(){},onerror:e=>errors.push(e),fetcher,AudioClass:AudioMock,urls:{createObjectURL:()=>`blob:${audios.length}`,revokeObjectURL:u=>revoked.push(u)},timeout});
  return {p,audios,errors,revoked};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const q=['First public sentence.','Second public sentence.','Third public sentence.'].map(text=>({text}));
test('API pause, resume, jump and stale callbacks do not replay old segments',async()=>{
  let count=0;const {p,audios,revoked}=setup(async()=>{count++;return audio();});
  p.start(q);await tick();const first=audios[0];p.toggle();p.toggle();await tick();assert.equal(count,1);p.seek(1);await tick();first.onended();assert.equal(p.index,1);assert.equal(count,2);
  p.seek(0);await tick();assert.equal(count,2);p.stop();assert.ok(revoked.length>=3);assert.equal(p.audio,null);
});
test('API end while paused stays paused until resume',async()=>{
  const {p,audios}=setup();p.start(q);await tick();p.toggle();audios[0].onended();assert.equal(p.state,'paused');assert.equal(p.index,0);p.toggle();await tick();assert.equal(p.index,1);p.stop();
});
test('stop aborts a pending request and late response cannot start playback',async()=>{
  let finish,requestSignal;const {p,audios}=setup(async(url,options)=>{requestSignal=options.signal;return new Promise(resolve=>finish=resolve);});
  p.start(q);await tick();p.stop();assert.equal(requestSignal.aborted,true);finish(audio());await tick();assert.equal(audios.length,0);assert.equal(p.cache.size,0);
});
test('timeout stops without retry and clearing cache releases blobs',async()=>{
  let count=0;const {p,errors}=setup(async(url,{signal})=>{count++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Aborted'))));},5);
  p.start(q);await tick();assert.equal(p.state,'idle');assert.equal(count,1);assert.match(errors[0],/超时/);p.clearCache();assert.equal(p.cache.size,0);
});
test('API scope cap prevents accidental large requests',async()=>{
  let count=0;const {p,errors}=setup(async()=>{count++;return audio();});p.start([{text:'a'.repeat(20001)}]);await tick();assert.equal(count,0);assert.match(errors[0],/20,000/);
});

test('clearing credentials or rejecting a new scope removes the previous queue',async()=>{
  let count=0;const {p}=setup(async()=>{count++;return audio();});
  p.start(q);await tick();p.clearCache();p.seek(1);await tick();
  assert.equal(p.queue.length,0);assert.equal(count,1);
  p.start(q);await tick();p.start([{text:'a'.repeat(20001)}]);p.seek(1);await tick();
  assert.equal(p.queue.length,0);assert.equal(count,2);p.stop();
});
