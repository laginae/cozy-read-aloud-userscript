import { build } from 'esbuild';
import { readFile, readdir, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const { version } = JSON.parse(await readFile('package.json','utf8'));
await mkdir('dist', { recursive:true });
const sources = JSON.parse(await readFile('vendor/SOURCES.json','utf8'));
for (const record of sources.files) {
  const digest = createHash('sha256').update(await readFile(record.target)).digest('hex');
  if (digest !== record.sha256) throw Error('Shared source changed: ' + record.target);
}
const pdfAssets = {};
for (const dir of ['cmaps','standard_fonts']) {
  for (const file of await readdir(`node_modules/pdfjs-dist/${dir}`)) {
    if (!/\.(bcmap|pfb|ttf)$/.test(file)) continue;
    pdfAssets[`${dir}/${file}`] = (await readFile(`node_modules/pdfjs-dist/${dir}/${file}`)).toString('base64');
  }
}
const shared = { name:'shared-source', setup(b) {
  b.onResolve({ filter:/^\.\.\/vendor\// }, args => ({path:path.resolve(root,'vendor',args.path.slice('../vendor/'.length))}));
  b.onResolve({ filter:/^\.\/pdf-runtime\.js$/ }, () => ({path:path.resolve(root,'src/pdf-runtime.js')}));
  b.onLoad({ filter:/[\\/]vendor[\\/]web[\\/]src[\\/]documents\.js$/ }, async args => {
    let source = await readFile(args.path,'utf8');
    for (const dir of ['cmaps','standard_fonts','wasm']) {
      const original = `new URL("./${dir}/", location.href).href`;
      if (!source.includes(original)) throw Error('Upstream asset URL changed: '+dir);
      source = source.replace(original,'undefined');
    }
    return {contents:source,loader:'js'};
  });
} };
const common = {bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,write:false,legalComments:'inline'};
const reader = await build({...common,entryPoints:['src/reader.js'],plugins:[shared],define:{
  __PDF_WORKER__:JSON.stringify(await readFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','utf8')),
  __PDF_ASSETS__:JSON.stringify(pdfAssets),
}});
const css = (await readFile('src/reader.css','utf8'))+'\n'+(await readFile('vendor/web/public/pdf-text-layer.css','utf8'));
const logo = 'data:image/png;base64,'+(await readFile('vendor/web/public/assets/cozy-cat.png')).toString('base64');
const html = (await readFile('src/reader.html','utf8')).replace('__CSS__',()=>css).replace('__LOGO__',()=>logo).replace('__JS__',()=>reader.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
const result = await build({...common,entryPoints:['src/userscript.js'],define:{__READER_HTML__:JSON.stringify(html)}});
const header = `// ==UserScript==
// @name         Cozy Read Aloud - Web and PDF
// @name:zh-CN   Cozy 朗读 - 网页与 PDF
// @namespace    https://github.com/laginae
// @version      ${version}
// @description  Read webpages and local PDFs with system voices, or optional OpenRouter and MiMo API voices.
// @description:zh-CN  网页正文、选区和本地 PDF 朗读；默认本机语音，可选 OpenRouter 和 MiMo API 音色。
// @homepageURL  https://github.com/laginae/cozy-read-aloud-userscript
// @supportURL   https://github.com/laginae/cozy-read-aloud-userscript/issues
// @author       laginae
// @license      MIT
// @match        https://*/*
// @match        http://*/*
// @match        file:///*
// @exclude      https://laginae.github.io/cozy-read-aloud-web/*
// @run-at       document-idle
// @noframes
// @sandbox      DOM
// @grant        GM_registerMenuCommand
// ==/UserScript==
`;
const output = header + result.outputFiles[0].text;
await writeFile('dist/cozy-read-aloud.user.js',output);
await writeFile('dist/reader.html',html);
await cp('public/demo.html','dist/demo.html');
for(const file of ['README.md','README.zh-CN.md','TESTING.md','RELEASE_NOTES.md','LICENSE'])await cp(file,'dist/'+file);
const licenseFiles = ['vendor/web/LICENSE','vendor/core/LICENSE','node_modules/@mozilla/readability/LICENSE.md','node_modules/pdfjs-dist/LICENSE','node_modules/lucide/LICENSE','node_modules/marked/LICENSE.md','node_modules/dompurify/LICENSE'];
let notices = '# Third-party notices\n\nThis bundle includes unchanged public reading algorithms from Cozy Read Aloud Web; provenance is recorded in vendor/SOURCES.json.\n';
for(const file of licenseFiles) { notices += `\n## ${file}\n\n` + await readFile(file,'utf8'); }
await writeFile('dist/THIRD-PARTY-NOTICES.txt',notices);
await writeFile('dist/SHA256SUMS.txt',createHash('sha256').update(output).digest('hex')+'  cozy-read-aloud.user.js\n');
console.log(`Built userscript: ${(Buffer.byteLength(output)/1024/1024).toFixed(2)} MiB. PDF libraries, CMaps and fonts bundled; no runtime downloads.`);
