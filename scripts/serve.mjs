import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist'), port=Number(process.env.PORT||5199);
http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/demo.html':pathname));
    if (!file.startsWith(root+path.sep)) throw Error('Invalid path');
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    res.end(content);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/`));
