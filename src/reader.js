import { createIcons, Maximize2, Minimize2, X, FileText, TextSelect, ListStart, FolderOpen, Settings2, SkipBack, Play, Pause, Square, SkipForward, ListTree, Headphones, ZoomIn, ZoomOut, Trash2 } from 'lucide';
import { readFile, renderPdf, buildQueue, selectionQueue, viewportRectangle } from '../vendor/web/src/documents.js';
import { capturePdfSelection } from '../vendor/web/src/pdf-selection.js';
import { SpeechPlayer } from './speech.js';
import { ApiPlayer } from './api-player.js';
import chunker from '../vendor/mobile/sentence-chunker.js';
const icons = { Maximize2, Minimize2, X, FileText, TextSelect, ListStart, FolderOpen, Settings2, SkipBack, Play, Pause, Square, SkipForward, ListTree, Headphones, ZoomIn, ZoomOut, Trash2 };
const $ = id => document.getElementById(id);
const refresh = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
const post = data => parent.postMessage({ cozy: true, ...data }, '*');
const settings = { academic: true, mathMode: 'smart', mathLanguage: 'auto', skipHeaders: true, footnoteMode: 'body' };
let doc = null, snapshot = null, loading = null, expanded = false, suspendedUntil = 0, sourceKind = '', currentItem = null;
let player, requestedDocument = true;
const notify = text => { $('notice').textContent = text; $('notice').hidden = !text; };
function voices() { return speechSynthesis.getVoices().filter(v => v.localService === true || $('remote-voices').checked); }
function updateVoices() {
  const before = $('voice').value;
  $('voice').replaceChildren(new Option('自动匹配语言', ''));
  for (const voice of voices()) $('voice').append(new Option(`${voice.name} · ${voice.lang}${voice.localService ? '' : ' · 联网'}`, voice.voiceURI));
  if ([...$('voice').options].some(o => o.value === before)) $('voice').value = before;
}
function chooseVoice(text) {
  const list = voices(), lang = /[\u3400-\u9fff]/.test(text) ? 'zh' : 'en';
  return list.find(v => v.voiceURI === $('voice').value) || list.find(v => v.lang.toLowerCase().startsWith(lang)) || list[0];
}
function clearHighlight() {
  doc?.root.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
  doc?.root.querySelectorAll('.pdf-overlay').forEach(el => el.replaceChildren());
  post({ type: 'clear' });
}
function highlight(item, scroll = true) {
  clearHighlight();
  if (!doc || !item) return;
  const block = doc.blocks[item.block];
  if (!block) return;
  const follow = $('follow').checked && Date.now() >= suspendedUntil && scroll;
  if (doc.kind === 'pdf') {
    const p = block.pageData;
    if (p?.overlay && p.viewport) {
      for (const rect of item.rects || block.rects || []) {
        const [x1,y1,x2,y2] = viewportRectangle(p.viewport, rect);
        const el = document.createElement('div');
        Object.assign(el.style, { left: `${Math.min(x1,x2)}px`, top: `${Math.min(y1,y2)}px`, width: `${Math.abs(x2-x1)}px`, height: `${Math.abs(y2-y1)}px` });
        p.overlay.append(el);
      }
    }
    if (follow) (p?.overlay?.firstElementChild || block.el).scrollIntoView({ block: 'center' });
  } else {
    block.el.classList.add('active');
    if (follow) block.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (sourceKind === 'web') post({ type: 'highlight', index: block.source, follow });
  }
}
function renderPlayer(p) {
  if (p !== player) return;
  const running = p.state === 'playing' || p.state === 'paused';
  $('play').disabled = p.state === 'loading' || !!loading;
  $('play').ariaLabel = p.state === 'playing' ? '暂停' : p.state === 'paused' ? '继续' : '播放';
  $('play').title = $('play').ariaLabel;
  $('play').innerHTML = `<i data-lucide="${p.state === 'playing' ? 'pause' : 'play'}"></i>`;
  $('status').textContent = ({idle:'已就绪',loading:'合成中',playing:'朗读中',paused:'已暂停',ended:'已读完'})[p.state];
  $('progress').max = String(Math.max(1, p.queue.length - 1));
  $('progress').value = String(Math.min(p.index, p.queue.length - 1));
  $('progress').disabled = !p.queue.length || !!loading;
  $('previous').disabled = !p.queue.length || p.index <= 0 || !!loading;
  $('next').disabled = !p.queue.length || p.index >= p.queue.length - 1 || !!loading;
  $('count').textContent = p.queue.length ? `${Math.min(p.index + 1, p.queue.length)} / ${p.queue.length}` : '';
  currentItem = running ? p.queue[p.index] : null;
  if (running) highlight(currentItem); else clearHighlight();
  refresh();
}
const nativePlayer = new SpeechPlayer({ synth:speechSynthesis,Utterance:SpeechSynthesisUtterance,voice:chooseVoice,rate:()=>Number($('rate').value),onerror:notify,onchange:renderPlayer });
const apiPlayer = new ApiPlayer({settings:()=>($('engine').value==='mimo'
  ? {engine:'mimo',key:$('mimo-key').value,model:'mimo-v2.5-tts',voice:$('mimo-voice').value,consent:$('mimo-consent').checked}
  : {engine:'openrouter',key:$('api-key').value,model:$('api-model').value.trim(),voice:$('api-voice').value.trim(),consent:$('api-consent').checked}),rate:()=>Number($('rate').value),onchange:renderPlayer,onerror:notify});
player = nativePlayer;
function stop() { const importing = !!loading; loading?.abort(); loading = null; player.stop(); $('play').disabled = false; if(importing) notify('已取消 PDF 解析。'); }
function reset() {
  stop(); player.queue = []; player.index = 0; snapshot = null; currentItem = null;
  nativePlayer.queue=[];nativePlayer.index=0;
  apiPlayer.clearCache();$('api-consent').checked=false;$('mimo-consent').checked=false;
  doc?.dispose?.(); doc = null;
  $('reader').replaceChildren(); $('outline').replaceChildren(); $('title').textContent = ''; $('count').textContent = '';
  $('scope').value = 'all';
  $('pdf-tools').hidden = true;
}
function showDocument(next, kind) {
  doc = next; sourceKind = kind;
  $('reader').replaceChildren(doc.root);
  $('title').textContent = doc.name;
  $('pdf-tools').hidden = doc.kind !== 'pdf';
  $('zoom-label').textContent = '100%';
  $('outline').replaceChildren();
  for (const item of doc.outline || []) {
    const button = document.createElement('button'); button.textContent = item.title;
    button.style.paddingLeft = `${Math.min(4, item.level || 1) * 6}px`;
    button.onclick = () => { item.el.scrollIntoView({ block:'start' }); $('outline').hidden = true; $('outline-toggle').ariaExpanded = 'false'; };
    $('outline').append(button);
  }
  if (doc.kind === 'pdf') renderPdf(doc, $('reader'), () => { if(currentItem) highlight(currentItem, false); }, notify);
}
async function importPdf(file) {
  if (!file) return;
  reset(); const controller = new AbortController(); loading = controller;
  $('play').disabled = true; notify('正在本机解析 PDF…');
  try {
    const next = await readFile(file, controller.signal, (n, total) => notify(`正在本机解析 PDF：${n} / ${total}`));
    if (controller.signal.aborted) { next.dispose(); return; }
    showDocument(next, 'pdf'); notify('');
  } catch(error) {
    if (!controller.signal.aborted) notify(error.message || 'PDF 无法打开。');
  } finally { if (loading === controller) { loading = null; $('play').disabled = false; } }
}
function saveSelection() {
  const selection = getSelection();
  if (!doc || !selection.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  if (!doc.root.contains(range.startContainer) || !doc.root.contains(range.endContainer)) return;
  snapshot = { text: selection.toString(), range: range.cloneRange() };
  if (doc.kind === 'pdf') {
    try { snapshot = { ...snapshot, ...capturePdfSelection(doc, range) }; }
    catch { snapshot = null; }
  }
}
document.addEventListener('selectionchange', saveSelection);
document.addEventListener('pointerup', saveSelection);
$('play').onclick = event => {
  if (!event.isTrusted) return;
  if (player.state === 'playing' || player.state === 'paused') { player.toggle(); return; }
  if (!doc) { notify('请载入网页正文，或打开 PDF。'); return; }
  notify('');
  try {
    const scope = $('scope').value;
    let queue = scope === 'all' ? buildQueue(doc, settings) : selectionQueue(doc, snapshot, settings, scope === 'from');
    if($('engine').value==='mimo')queue=queue.flatMap(item=>chunker.splitTextForSpeechChunks(item.text,[200]).map(text=>({...item,text})));
    if (!queue.length) throw Error('没有可朗读的文字。扫描 PDF 需要先进行 OCR。');
    player.start(queue);
  } catch (error) { notify(error.message); }
};
$('stop').onclick = stop;
$('previous').onclick = () => player.seek(player.index - 1);
$('next').onclick = () => player.seek(player.index + 1);
$('progress').onchange = () => player.seek(Number($('progress').value));
$('rate').onchange = () => { if(player===apiPlayer)apiPlayer.updateRate();else if (player.state === 'playing' || player.state === 'paused') notify('新倍速从下一段开始生效。'); };
$('scope').onchange = () => player.stop();
$('academic').onchange = () => { settings.academic = $('academic').checked; player.stop(); };
$('remote-voices').onchange = () => { player.stop(); updateVoices(); };
$('voice').onchange = () => player.stop();
function selectEngine() {
  player.stop();
  apiPlayer.clearCache();
  player = $('engine').value==='system' ? nativePlayer : apiPlayer;
  $('api-options').hidden=$('engine').value!=='openrouter';
  $('mimo-options').hidden=$('engine').value!=='mimo';
  $('system-options').hidden=player===apiPlayer;
  $('api-consent').checked=false;
  $('mimo-consent').checked=false;
  player.stop();
}
function clearApi() {
  apiPlayer.clearCache();$('api-key').value='';$('api-consent').checked=false;$('mimo-key').value='';$('mimo-consent').checked=false;
}
$('engine').onchange=selectEngine;
$('clear-key').onclick=()=>{clearApi();notify('已清除会话密钥和音频缓存。');};
$('clear-mimo').onclick=$('clear-key').onclick;
$('api-preset').onchange=()=>{
  apiPlayer.clearCache();$('api-consent').checked=false;
  const custom=$('api-preset').value==='custom';$('custom-model').hidden=!custom;
  if(!custom)$('api-model').value=$('api-preset').value;
};
for(const id of ['api-key','api-model','api-voice']) $(id).addEventListener('input',()=>{apiPlayer.clearCache();$('api-consent').checked=false;});
for(const id of ['mimo-key','mimo-voice']) $(id).addEventListener('input',()=>{apiPlayer.clearCache();$('mimo-consent').checked=false;});
$('api-consent').onchange=()=>{if(!$('api-consent').checked)apiPlayer.stop();};
$('mimo-consent').onchange=()=>{if(!$('mimo-consent').checked)apiPlayer.stop();};
$('follow').onchange = () => { if (currentItem) highlight(currentItem); };
function zoom(value) {
  if (doc?.kind !== 'pdf') return;
  doc.zoom = Math.max(.75,Math.min(2.5,value));
  $('zoom-label').textContent = `${Math.round(doc.zoom*100)}%`;
  renderPdf(doc, $('reader'), () => { if(currentItem) highlight(currentItem,false); }, notify);
}
$('zoom-out').onclick = () => zoom((doc?.zoom||1)-.25);
$('zoom-in').onclick = () => zoom((doc?.zoom||1)+.25);
$('zoom-fit').onclick = () => zoom(1);
$('settings-toggle').onclick = () => { $('settings').hidden = !$('settings').hidden; $('settings-toggle').ariaExpanded = String(!$('settings').hidden); };
$('outline-toggle').onclick = () => { $('outline').hidden = !$('outline').hidden; $('outline-toggle').ariaExpanded = String(!$('outline').hidden); };
$('open-pdf').onclick = () => $('pdf-file').click();
$('pdf-file').onchange = () => { const file = $('pdf-file').files[0]; $('pdf-file').value = ''; void importPdf(file); };
$('close').onclick = () => { stop();clearApi();$('engine').value='system';selectEngine();$('remote-voices').checked=false;updateVoices();post({type:'close'}); };
$('expand').onclick = () => { expanded = !expanded; post({type:'expand',value:expanded}); $('expand').innerHTML = `<i data-lucide="${expanded?'minimize-2':'maximize-2'}"></i>`; $('expand').title = $('expand').ariaLabel = expanded ? '缩小阅读面板' : '展开阅读面板'; refresh(); };
for (const [id, mode] of [['article','article'],['web-selected','selected'],['web-from','from']]) $(id).onclick = () => {requestedDocument=true;post({type:'request',mode});};
$('reader').addEventListener('wheel', () => { suspendedUntil = Date.now() + 4000; }, {passive:true});
addEventListener('resize', () => { if(doc?.kind==='pdf') renderPdf(doc, $('reader'), () => { if(currentItem) highlight(currentItem,false); }, notify); });
addEventListener('message', event => {
  if (event.source !== parent || event.data?.cozy !== true) return;
  const data = event.data;
  if (data.type === 'error') notify(String(data.message).slice(0,500));
  if (data.type !== 'document') return;
  // Messages carry text only, never configuration or playback commands. Once a key
  // is entered, unsolicited host document changes cannot replace the approved text.
  if (($('api-key').value || $('mimo-key').value) && !requestedDocument) return;
  if (!Array.isArray(data.blocks) || data.blocks.length > 10000 || data.blocks.some(b => !b || typeof b.text !== 'string' || b.text.length > 250000) || data.blocks.reduce((n,b)=>n+b.text.length,0)>250000) return;
  requestedDocument=false;
  reset(); notify('');
  const root = document.createElement('article'); root.className='prose';
  const blocks = data.blocks.map(b => {
    const el = document.createElement(b.heading ? 'h2' : 'p'); el.className='read-block'; el.textContent=b.text; root.append(el);
    return {raw:b.text,el,source:b.source,kind:'text'};
  });
  showDocument({kind:'web', name:String(data.title||'网页').slice(0,300), root, blocks,
    outline:blocks.flatMap((b,i)=>data.blocks[i].heading?[{title:b.raw,level:1,el:b.el,block:i}]:[]), dispose(){root.remove();}}, 'web');
});
addEventListener('pagehide', () => {stop();clearApi();});
speechSynthesis.addEventListener('voiceschanged', updateVoices);
updateVoices(); refresh(); post({ type:'ready' });
