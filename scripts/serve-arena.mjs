// Local-only multiplayer server. State is disposable and never used in production.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {arenaService,newSession} from '../server/transfer-arena/service.js';
import {arenaData} from '../server/transfer-arena/data.js';
const root=path.resolve('dist'),records=new Map();
const store={transaction:async(key,update)=>{const value=update(structuredClone(records.get(key)||null));records.set(key,value);return structuredClone(value);}};
const service=arenaService({store,data:await arenaData()});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  if(req.url==='/api/transfer-arena'){
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   if(req.method!=='POST'||req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end(JSON.stringify({error:'Geçersiz kaynak'}));}
   let text='';for await(const chunk of req){text+=chunk;if(text.length>4096){res.writeHead(413);return res.end('{}');}}
   let token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('arena_dev='))?.slice(10);
   if(!token){token=newSession();res.setHeader('Set-Cookie',`arena_dev=${token}; Path=/; HttpOnly; SameSite=Strict`);}
   try{const result=await service.handle({token,ip:req.socket.remoteAddress,action:JSON.parse(text)});res.end(JSON.stringify(result));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}));}return;
  }
  const url=new URL(req.url,'http://localhost');let relative=decodeURIComponent(url.pathname);if(relative.endsWith('/'))relative+='index.html';let file=path.resolve(root,'.'+relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  if((await stat(file)).isDirectory())file=path.join(file,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4174,'127.0.0.1',()=>console.log('Development arena: http://127.0.0.1:4174/games/transfer-arenasi/ (disposable rooms)'));
