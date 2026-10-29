import { createElement, Play, Pause, Square, SkipBack, SkipForward, X, FileText, TextSelect, ListStart, ExternalLink } from 'lucide';
import { SpeechPlayer } from './speech.js';
import chunker from '../vendor/mobile/sentence-chunker.js';
import speechText from '../vendor/mobile/speech-text.js';

// This panel belongs to the host DOM: it must never collect keys or import files.
export function createCompatReader(root, { read, highlight, clear, close }) {
  const panel=document.createElement('section');panel.className='compat';panel.setAttribute('aria-label','兼容朗读面板');
  const style=document.createElement('style');
  style.textContent=`.compat{position:fixed;right:12px;bottom:12px;width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;box-sizing:border-box;background:#fff;color:#232d2b;border:1px solid #b8c9c6;border-radius:8px;box-shadow:0 6px 32px #0003;font:14px/1.5 system-ui,sans-serif;letter-spacing:0;padding:12px}.compat *{box-sizing:border-box}.compat header{display:flex;gap:8px;align-items:center}.compat h2{font-size:16px;margin:0;flex:1}.compat button{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:auto;min-height:36px;height:auto;padding:6px;border:1px solid #cbd7d2;border-radius:5px;background:white;color:inherit;box-shadow:none;font:inherit}.compat button:disabled{opacity:.45;cursor:default}.compat button:hover{background:#eef5f3}.compat .icon{width:36px;height:36px;flex:0 0 36px;padding:7px}.compat svg{width:18px;height:18px}.compat .compat-sources{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.compat .compat-sources button:last-child{grid-column:1/-1}.compat .compat-transport{display:flex;gap:8px;align-items:center}.compat .compat-state{flex:1;font-size:12px;min-width:0}.compat .compat-preview{max-height:180px;overflow:auto;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.8;border-block:1px solid #dde3e1;padding:10px 0;margin:10px 0}.compat .compat-note{font-size:12px;color:#5e6965;margin:8px 0}.compat .compat-error{font-size:13px;background:#fff3e6;color:#8a3b17;padding:8px;overflow-wrap:anywhere}.compat label{display:block;margin-top:8px;font-size:13px}.compat select{width:100%;min-height:36px;font:inherit;background:white;color:inherit;border:1px solid #cbd7d2;border-radius:4px;padding:5px}.compat input[type=range]{width:100%;accent-color:#147d73;margin:10px 0}.compat a{color:#147d73;display:inline-flex;align-items:center;gap:6px}.compat [hidden]{display:none!important}@media(max-width:350px){.compat{padding:8px}.compat .compat-transport{gap:5px}}`;
  root.append(style,panel);
  function element(tag,parent,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;}
  function button(parent,label,icon,action,iconOnly=false){
    const el=element('button',parent);el.type='button';el.title=label;el.ariaLabel=label;
    el.append(createElement(icon));if(iconOnly)el.className='icon';else el.append(document.createTextNode(label));
    el.onclick=event=>{if(event.isTrusted)action();};return el;
  }
  const header=element('header',panel);element('h2',header,'Cozy · 本机语音');
  button(header,'关闭并停止',X,()=>{player.stop();panel.hidden=true;close();},true);
  element('p',panel,'兼容模式：隔离面板未能启动。在线音色和 PDF 请在独立阅读页使用。').className='compat-note';
  const sources=element('div',panel);sources.className='compat-sources';
  button(sources,'网页正文',FileText,()=>load('article'));
  button(sources,'网页选区',TextSelect,()=>load('selected'));
  button(sources,'从选区继续',ListStart,()=>load('from'));
  const transport=element('div',panel);transport.className='compat-transport';
  const previous=button(transport,'上一段',SkipBack,()=>player.seek(player.index-1),true);
  const play=button(transport,'播放',Play,()=>{
    error.hidden=true;
    if(player.state==='playing'||player.state==='paused')player.toggle();
    else if(queue.length)player.start(queue);
  },true);
  button(transport,'停止',Square,()=>player.stop(),true);
  const next=button(transport,'下一段',SkipForward,()=>player.seek(player.index+1),true);
  const status=element('span',transport,'已就绪');status.className='compat-state';status.setAttribute('role','status');
  const progress=element('input',panel);progress.type='range';progress.min='0';progress.max='1';progress.value='0';progress.ariaLabel='分段进度';
  progress.onchange=event=>{if(event.isTrusted)player.seek(Number(progress.value));};
  const error=element('p',panel);error.className='compat-error';error.hidden=true;error.setAttribute('role','status');
  const preview=element('div',panel);preview.className='compat-preview';
  const voiceLabel=element('label',panel,'本机音色');const voice=element('select',voiceLabel);voice.ariaLabel='本机音色';
  const rateLabel=element('label',panel,'倍速');const rate=element('select',rateLabel);rate.ariaLabel='倍速';rate.title='新倍速从下一段生效';
  for(const n of [.75,1,1.25,1.5,1.75,2])rate.append(new Option(n+'x',String(n),false,n===1));
  const link=element('a',panel,'独立阅读页');link.href='https://laginae.github.io/cozy-read-aloud-web/';link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.append(createElement(ExternalLink));
  let queue=[],player;
  const voices=()=>speechSynthesis.getVoices().filter(v=>v.localService===true);
  const updateVoices=()=>{
    const before=voice.value;voice.replaceChildren(new Option('自动匹配语言',''));
    for(const v of voices())voice.append(new Option(v.name+' · '+v.lang,v.voiceURI));
    if([...voice.options].some(v=>v.value===before))voice.value=before;
  };
  const notify=text=>{error.textContent=text;error.hidden=false;};
  const render=p=>{
    const active=p.state==='playing'||p.state==='paused';
    play.ariaLabel=play.title=p.state==='playing'?'暂停':p.state==='paused'?'继续':'播放';
    play.replaceChildren(createElement(p.state==='playing'?Pause:Play));play.disabled=!queue.length;
    status.textContent=({idle:'已就绪',playing:'朗读中',paused:'已暂停',ended:'已读完'})[p.state]+(queue.length?` · ${Math.min(p.index+1,queue.length)}/${queue.length}`:'');
    previous.disabled=!queue.length||p.index<=0;next.disabled=!queue.length||p.index>=queue.length-1;
    progress.max=String(Math.max(1,queue.length-1));progress.value=String(Math.max(0,Math.min(p.index,queue.length-1)));progress.disabled=!queue.length;
    preview.textContent=queue[p.index]?.text||queue[0]?.text||'';
    if(active)highlight(queue[p.index]?.source,true);else clear();
  };
  player=new SpeechPlayer({synth:speechSynthesis,Utterance:SpeechSynthesisUtterance,rate:()=>Number(rate.value),
    voice:text=>{const list=voices(),lang=/[\u3400-\u9fff]/.test(text)?'zh':'en';return list.find(v=>v.voiceURI===voice.value)||list.find(v=>v.lang.toLowerCase().startsWith(lang))||list[0];},
    onchange:render,onerror:text=>notify(voices().length?text:'浏览器没有提供本机音色。请安装系统语音，或在独立阅读页选择在线音色。')});
  voice.onchange=event=>{if(event.isTrusted)player.stop();};
  function load(mode){
    player.stop();queue=[];player.queue=[];player.index=0;error.hidden=true;
    try{
      const blocks=read(mode);
      queue=blocks.flatMap((block,source)=>{
        const text=speechText.sanitizeAcademicTextForSpeech(block.text,{academicMathMode:'smart',academicMathStyle:'concise',academicSkipNotice:true,mathReadingLanguage:/[\u3400-\u9fff]/.test(block.text)?'chinese':'english'});
        return chunker.splitTextForSpeechChunks(text,[240]).map(text=>({text,source}));
      });
      if(!queue.length)throw Error('没有可朗读的文字，请重新选择范围。');
      player.queue=queue;
    }catch(e){notify(e.message||'无法读取网页文字。');}
    render(player);
  }
  speechSynthesis.addEventListener('voiceschanged',updateVoices);updateVoices();render(player);
  return {
    open(mode){panel.hidden=false;if(mode||!queue.length)load(mode||'article');},
    dispose(){player.stop();queue=[];speechSynthesis.removeEventListener('voiceschanged',updateVoices);panel.remove();style.remove();},
  };
}
