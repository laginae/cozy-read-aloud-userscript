import { Readability } from '@mozilla/readability';

const excluded = 'script,style,noscript,template,iframe,object,embed,svg,canvas,input,textarea,select,button,[contenteditable="true"],[contenteditable=""],[role="textbox"],[hidden],[aria-hidden="true"],[data-cozy-host]';
const blockTags = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th,div,section,article';
function visible(el) {
  if (el.closest(excluded)) return false;
  const css = getComputedStyle(el);
  return css.display !== 'none' && css.visibility !== 'hidden' && el.getClientRects().length > 0;
}
function visibleText(el, range) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!visible(node.parentElement) || (range && !range.intersectsNode(node))) continue;
    const start = range?.startContainer === node ? range.startOffset : 0;
    const end = range?.endContainer === node ? range.endOffset : node.length;
    parts.push(node.textContent.slice(start, end));
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}
function rangePart(el, range, from) {
  const part = document.createRange();
  part.selectNodeContents(el);
  if (el.contains(range.startContainer)) part.setStart(range.startContainer, range.startOffset);
  if (!from && el.contains(range.endContainer)) part.setEnd(range.endContainer, range.endOffset);
  return { text: visibleText(el, part), range: part };
}
export function captureSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed || !selection.toString().trim()) return null;
  const range = selection.getRangeAt(0).cloneRange();
  const start = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const end = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
  if (start?.closest(excluded) || end?.closest(excluded)) return null;
  return range;
}
export function extract(mode, selection) {
  if (mode !== 'article' && (!selection || !selection.startContainer.isConnected)) throw Error('请先在网页正文中选中文字。');
  const elements = [...document.body.querySelectorAll(blockTags)].filter(visible);
  const elementSet = new Set(elements);
  if (elements.length > 30000) throw Error('页面过大，请缩小选区或使用阅读模式。');
  let allowed = null;
  if (mode === 'article') {
    const clone = document.cloneNode(true);
    const originals = [...document.querySelectorAll('*')];
    const copies = [...clone.querySelectorAll('*')];
    const ids = new Map(elements.map((el, index) => [el, String(index)]));
    copies.forEach((el, index) => {
      const original = originals[index];
      if (ids.has(original)) el.setAttribute('data-cozy-source', ids.get(original));
      if (original && (original.matches(excluded) || (original.parentElement && !visible(original)))) el.remove();
    });
    const article = new Readability(clone, { charThreshold: 80, maxElemsToParse: 50000, disableJSONLD: true, serializer: el => el }).parse();
    if (article?.content) allowed = new Set([...article.content.querySelectorAll('[data-cozy-source]')].map(el => elements[Number(el.getAttribute('data-cozy-source'))]));
    if (!allowed?.size) {
      const root = document.querySelector('article,main,[role="main"]');
      allowed = new Set(root ? elements.filter(el => root.contains(el)) : elements);
    }
  }
  const startElement = selection?.startContainer.nodeType === 1 ? selection.startContainer : selection?.startContainer.parentElement;
  const fromRoot = startElement?.closest('article,main,[role="main"]');
  const candidates = elements.filter(el => (mode !== 'article' || allowed.has(el)) && (mode !== 'from' || !fromRoot || fromRoot.contains(el)) && ![...el.querySelectorAll(blockTags)].some(child => elementSet.has(child) && (mode !== 'article' || allowed.has(child))));
  const blocks = [];
  let reached = false;
  for (const el of candidates) {
    if (mode !== 'article') {
      const intersects = selection.intersectsNode(el);
      if (!intersects && !(mode === 'from' && reached)) continue;
      reached ||= intersects;
    }
    let value = visibleText(el), range;
    if (mode !== 'article' && selection.intersectsNode(el)) {
      ({ text: value, range } = rangePart(el, selection, mode === 'from'));
    }
    if (!value) continue;
    blocks.push({ text: value, el, range, heading: /^H[1-6]$/.test(el.tagName) });
  }
  if (!blocks.length && mode === 'selected') {
    const ancestor = selection.commonAncestorContainer.nodeType === 1 ? selection.commonAncestorContainer : selection.commonAncestorContainer.parentElement;
    const value = visibleText(ancestor, selection);
    if (value) blocks.push({ text: value, el: selection.commonAncestorContainer.parentElement, range: selection });
  }
  if (!blocks.length) throw Error('未找到可朗读的正文，请选中需要的文字后再试。');
  if (blocks.reduce((n, b) => n + b.text.length, 0) > 250000) throw Error('正文超过 250,000 字符，请选取较小范围。');
  return blocks;
}
