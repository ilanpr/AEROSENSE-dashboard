import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root=fileURLToPath(new URL('../dist-demo/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.ico':'image/x-icon','.ttf':'font/ttf','.woff2':'font/woff2','.woff':'font/woff'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let p;
  try { p=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end();return;}
  if(p.startsWith('/api/')||p.includes('\0')){res.writeHead(404);res.end();return;}
  let file=resolve(root,'.'+p);
  if(file!==resolve(root)&&!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  if(!extname(file))file=resolve(root,'index.html');
  const contentType=mime[extname(file)];
  if(!contentType){res.writeHead(404);res.end();return;}
  try {const body=await readFile(file);res.writeHead(200,{'Content-Type':contentType});res.end(req.method==='HEAD'?undefined:body);}
  catch {res.writeHead(404);res.end();}
});
server.listen(Number(process.env.DEMO_PORT||4174),'127.0.0.1',()=>console.log('AEROSENSE SIMULATION ONLY: http://127.0.0.1:'+server.address().port));
