export const ENDPOINT = 'https://openrouter.ai/api/v1/audio/speech';
export const MIMO_ENDPOINT = 'https://api.xiaomimimo.com/v1/chat/completions';
export const MIMO_VOICES = ['白桦','苏打','冰糖','茉莉','Mia','Chloe','Milo','Dean'];
export const MAX_SCOPE = 20000;
export function requestBody(text, settings) {
  if (!settings.consent || !settings.key?.trim()) throw Error('请填写会话密钥，并确认在线处理授权。');
  if (!text?.trim() || text.length > 500) throw Error('单段文字超出 500 字符上限，请缩小朗读范围。');
  if(settings.engine==='mimo') {
    if(!MIMO_VOICES.includes(settings.voice))throw Error('请选择受支持的 MiMo 音色。');
    return {model:'mimo-v2.5-tts',messages:[{role:'user',content:'Read the supplied text faithfully in a calm, natural voice. Do not summarize or add words.'},{role:'assistant',content:text}],audio:{format:'wav',voice:settings.voice},stream:false};
  }
  if (!/^[\w.:-]+\/[\w.:-]+$/.test(settings.model || '') || !settings.voice?.trim() || settings.voice.length > 160)
    throw Error('请检查 OpenRouter 模型 ID 和音色 ID。');
  return {model:settings.model,input:text,voice:settings.voice.trim(),response_format:'mp3',provider:{zdr:true,data_collection:'deny'}};
}
export async function requestAudio(text, settings, signal, fetcher = fetch) {
  const body = requestBody(text,settings);
  const mimo=settings.engine==='mimo',name=mimo?'MiMo':'OpenRouter';
  let response;
  try {
    response = await fetcher(mimo?MIMO_ENDPOINT:ENDPOINT,{method:'POST',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal,
      headers:{...(mimo?{'api-key':settings.key.trim()}:{Authorization:`Bearer ${settings.key.trim()}`}), 'Content-Type':'application/json'},body:JSON.stringify(body)});
  } catch(error) {
    if(signal.aborted) throw error;
    throw Error(`无法连接 ${name}：请检查网络、浏览器跨域限制或网站安全策略。未重试、未切换服务。`);
  }
  if(!response.ok) {
    // Do not display provider bodies: they can echo private input or credentials.
    const messages={400:'服务方拒绝此段，请检查模型、音色或文本格式；不代表额度不足。',401:'密钥未通过验证。',402:'服务方报告额度或支付问题。',403:mimo?'访问被拒绝，请检查权限。':'访问被拒绝，请检查权限和 ZDR 路由。',404:'模型或接口不可用。',429:'请求过于频繁，请稍后再试。'};
    throw Error(`${name} HTTP ${response.status}。${messages[response.status]||'服务暂不可用。'}未自动重试${mimo?'。':'，ZDR 要求保持不变。'}`);
  }
  const type=response.headers.get('content-type')||'';
  if(!(mimo ? /^application\/json(;|$)/i.test(type) : /^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|mp4)(;|$)/i.test(type))) throw Error('服务没有返回受支持的音频响应。');
  const limit=(mimo?24:16)*1024*1024;
  if(Number(response.headers.get('content-length'))>limit) {await response.body?.cancel();throw Error('音频超过 16 MiB 限制。');}
  if(!response.body?.getReader) throw Error('浏览器不支持有界音频下载。');
  const reader=response.body.getReader(),parts=[];
  let size=0;
  try {
    for(;;){
      const {value,done}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();throw Error('音频超过 16 MiB 限制。');}
      parts.push(value);
    }
  } finally {reader.releaseLock();}
  if(!size) throw Error('服务返回了空音频。');
  const blob=new Blob(parts,{type});
  if(!mimo)return blob;
  return decodeMimo(await blob.text());
}
export function decodeMimo(source) {
  let response;
  try{response=JSON.parse(source);}catch{throw Error('MiMo 音频响应格式无效。');}
  const choice=response.choices?.[0],data=choice?.message?.audio?.data;
  if(response.error || choice?.finish_reason!=='stop')throw Error('MiMo 未确认本段完整生成，已停止，不会自动跳过或重试。请缩短选区后重试。');
  if(typeof data!=='string'||!data.length||data.length%4||data.length>23*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('MiMo 返回了无效或过大的音频。');
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const view=new DataView(bytes.buffer),ascii=(a,b)=>String.fromCharCode(...bytes.subarray(a,b));
  if(bytes.length<44||bytes.length>16*1024*1024||ascii(0,4)!=='RIFF'||ascii(8,12)!=='WAVE'||view.getUint32(4,true)+8!==bytes.length)throw Error('MiMo WAV 音频不完整，已停止。');
  let position=12,format=false,audio=false;
  while(position+8<=bytes.length){
    const id=ascii(position,position+4),size=view.getUint32(position+4,true),end=position+8+size;
    if(end>bytes.length)throw Error('MiMo WAV 音频不完整，已停止。');
    if(id==='fmt ')format=size>=16;
    if(id==='data')audio=size>0;
    position=end+(size%2);
  }
  if(!format||!audio||position!==bytes.length)throw Error('MiMo WAV 音频结构无效。');
  return new Blob([bytes],{type:'audio/wav'});
}
export class ApiPlayer {
  constructor({settings,rate,onchange,onerror,fetcher=fetch,AudioClass=Audio,urls=URL,timeout=60000}) {
    Object.assign(this,{settings,rate,onchange,onerror,fetcher,AudioClass,urls,timeout});
    this.queue=[];this.index=0;this.state='idle';this.epoch=0;this.cache=new Map();
  }
  release() {
    this.controller?.abort();this.controller=null;
    clearTimeout(this.timer);
    if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}
    if(this.url)this.urls.revokeObjectURL(this.url);
    this.url=null;
  }
  stop() {this.epoch++;this.pendingEnd=false;this.release();this.state='idle';this.onchange(this);}
  clearCache() {this.queue=[];this.index=0;this.stop();this.cache.clear();}
  start(queue,index=0) {
    this.queue=[];this.index=0;
    this.stop();
    const total=queue.reduce((n,item)=>n+item.text.length,0);
    if(total>MAX_SCOPE) {this.onerror(`本次朗读范围超过 ${MAX_SCOPE.toLocaleString('en-US')} 字符，请选择较小范围以控制费用。`);return;}
    try {if(queue.length)requestBody(queue[0].text,this.settings());}catch(error){this.onerror(error.message);return;}
    this.queue=queue;this.index=Math.max(0,Math.min(queue.length-1,index));
    if(queue.length)void this.speak();
  }
  async speak() {
    const token=++this.epoch;this.pendingEnd=false;this.release();
    const item=this.queue[this.index];if(!item)return this.stop();
    const s=this.settings();
    try {requestBody(item.text,s);}catch(error){this.stop();this.onerror(error.message);return;}
    this.state='loading';this.onchange(this);
    const key=JSON.stringify([s.engine,s.model,s.voice,item.text]);
    let timedOut=false;
    try {
      let blob=this.cache.get(key);
      if(!blob){
        const controller=this.controller=new AbortController();
        this.timer=setTimeout(()=>{timedOut=true;controller.abort();},this.timeout);
        blob=await requestAudio(item.text,s,controller.signal,this.fetcher);
        if(token!==this.epoch || controller.signal.aborted)return;
        clearTimeout(this.timer);this.controller=null;
        this.cache.set(key,blob);
        while(this.cache.size>8 || [...this.cache.values()].reduce((n,b)=>n+b.size,0)>16*1024*1024)this.cache.delete(this.cache.keys().next().value);
      } else {this.cache.delete(key);this.cache.set(key,blob);}
      if(token!==this.epoch)return;
      this.url=this.urls.createObjectURL(blob);
      const audio=this.audio=new this.AudioClass(this.url);
      audio.playbackRate=this.rate();
      let ended=false;
      audio.onended=()=>{
        if(token!==this.epoch||ended)return;ended=true;
        if(this.state==='paused'){this.pendingEnd=true;return;}
        this.advance();
      };
      audio.onerror=()=>{if(token!==this.epoch)return;this.stop();this.onerror('音频无法播放，请更换音色或重试当前段。');};
      await audio.play();
      if(token!==this.epoch)return;
      this.state='playing';this.onchange(this);
    } catch(error) {
      if(token!==this.epoch)return;
      this.stop();this.onerror(timedOut?'合成超时，未自动重试。已发出的请求仍可能计费。':error.name==='NotAllowedError'?'浏览器暂时阻止播放，请点击播放重试；已合成音频会从会话缓存复用。':error.message);
    }
  }
  toggle() {
    if(this.state==='playing'){this.audio.pause();this.state='paused';this.onchange(this);}
    else if(this.state==='paused'){
      if(this.pendingEnd){this.advance();return;}
      const token=this.epoch;
      this.audio.play().then(()=>{if(token===this.epoch){this.state='playing';this.onchange(this);}}).catch(()=>{if(token===this.epoch){this.stop();this.onerror('浏览器无法恢复音频，请点击播放重试。');}});
    }
  }
  advance(){this.pendingEnd=false;if(++this.index<this.queue.length)void this.speak();else{this.release();this.state='ended';this.onchange(this);}}
  seek(index) {if(!this.queue.length)return;this.index=Math.max(0,Math.min(this.queue.length-1,index));void this.speak();}
  updateRate() {if(this.audio)this.audio.playbackRate=this.rate();}
}
