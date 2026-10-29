import { createElement, Volume2 } from 'lucide';
import { extract, captureSelection } from './extract.js';

if (window.top === window && !document.querySelector('[data-cozy-host]')) {
  const host = document.createElement('div');
  host.dataset.cozyHost = '';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host{all:initial!important;position:fixed!important;inset:auto 16px 24px auto!important;z-index:2147483647!important;color-scheme:light!important}button{width:46px;height:46px;border:1px solid #b7d7d1;border-radius:50%;background:#147d73;color:white;box-shadow:0 3px 14px #0003;cursor:pointer;display:grid;place-items:center}button:focus-visible{outline:3px solid #e6ac38;outline-offset:3px}svg{width:22px;height:22px}iframe{position:fixed;right:12px;bottom:12px;width:min(440px,calc(100vw - 24px));height:min(740px,calc(100dvh - 24px));border:1px solid #b8c9c6;border-radius:8px;box-shadow:0 6px 32px #0003;background:white}iframe.wide{width:min(980px,calc(100vw - 24px));height:calc(100dvh - 24px)}[hidden]{display:none!important}.failure{font:14px/1.5 system-ui;background:white;color:#782424;max-width:300px;padding:12px;border:1px solid #c88;border-radius:6px}`;
  const launcher = document.createElement('button');
  launcher.title = 'Cozy Read Aloud';
  launcher.setAttribute('aria-label', '打开 Cozy 朗读');
  launcher.append(createElement(Volume2));
  root.append(style, launcher);
  document.documentElement.append(host);
  let frame, ready = false, pending, blocks = [], selected = null, highlightStyle, timeout;
  let scrollUntil = 0;
  const highlightName = 'cozy-' + crypto.getRandomValues(new Uint32Array(3)).join('');
  const remember = () => { const range = captureSelection(); if (range) selected = range; };
  document.addEventListener('pointerup', remember, true);
  document.addEventListener('keyup', remember, true);
  window.addEventListener('wheel', () => { scrollUntil = Date.now() + 4000; }, { passive: true });
  const clear = () => { CSS.highlights?.delete(highlightName); };
  function post(data) { frame?.contentWindow?.postMessage({ cozy: true, ...data }, '*'); }
  function load(mode) {
    clear();
    try {
      blocks = extract(mode, selected);
      post({ type: 'document', title: document.title || '网页', blocks: blocks.map((b, index) => ({ text: b.text, source: index, heading: b.heading })) });
    } catch (error) { post({ type: 'error', message: error.message }); }
  }
  function show(mode) {
    remember();
    pending = mode;
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = 'Cozy Read Aloud 阅读面板';
      // Opaque-origin sandbox: imported PDF bytes and text never return to the host page.
      frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
      frame.setAttribute('allow', 'autoplay');
      frame.referrerPolicy = 'no-referrer';
      frame.srcdoc = __READER_HTML__;
      root.append(frame);
      timeout = setTimeout(() => {
        if (ready) return;
        frame.remove(); frame = null;
        launcher.hidden = false;
        const note = document.createElement('p');
        note.className = 'failure';
        note.textContent = '此网站的安全策略阻止了阅读面板。请在随附的 demo.html 或普通可信网页打开面板，再导入 PDF。';
        root.append(note);
        setTimeout(() => note.remove(), 15000);
      }, 6000);
    }
    frame.hidden = false;
    launcher.hidden = true;
    if (ready && mode) load(mode);
  }
  launcher.addEventListener('pointerdown', remember);
  launcher.addEventListener('click', () => show(selected ? 'selected' : 'article'));
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== 'null' || event.data?.cozy !== true) return;
    const data = event.data;
    if (data.type === 'ready') {
      clearTimeout(timeout); ready = true;
      if (pending) load(pending);
    } else if (data.type === 'request' && ['article', 'selected', 'from'].includes(data.mode)) load(data.mode);
    else if (data.type === 'close') { frame.hidden = true; launcher.hidden = false; clear(); launcher.focus(); }
    else if (data.type === 'expand') frame.classList.toggle('wide', data.value === true);
    else if (data.type === 'clear') clear();
    else if (data.type === 'highlight' && Number.isInteger(data.index) && blocks[data.index]) {
      clear();
      const block = blocks[data.index];
      if (!block.el?.isConnected) return;
      if (CSS.highlights && typeof Highlight !== 'undefined') {
        if (!highlightStyle) {
          highlightStyle = document.createElement('style');
          highlightStyle.textContent = `::highlight(${highlightName}){background:#ffe3a0;color:inherit}`;
          document.head.append(highlightStyle);
        }
        const range = block.range?.cloneRange() || document.createRange();
        if (!block.range) range.selectNodeContents(block.el);
        CSS.highlights.set(highlightName, new Highlight(range));
      }
      if (data.follow === true && Date.now() >= scrollUntil) {
        const rect = block.el.getBoundingClientRect();
        if (rect.top < 70 || rect.bottom > innerHeight - 100) block.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  });
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Cozy：朗读网页正文', () => show('article'));
    GM_registerMenuCommand('Cozy：朗读选中文字', () => show('selected'));
    GM_registerMenuCommand('Cozy：从选区继续', () => show('from'));
    GM_registerMenuCommand('Cozy：打开 PDF 阅读面板', () => show());
  }
  window.addEventListener('pagehide', () => { clear(); frame?.remove(); });
}
