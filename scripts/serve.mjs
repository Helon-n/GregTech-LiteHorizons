import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('src');
const server=http.createServer(async(req,res)=>{try{const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}const file=target===root?path.join(root,'index.html'):target;const contents=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(contents);}catch{res.writeHead(404).end('Not found');}});
server.listen(4173,'127.0.0.1',()=>console.log('GregTech-LiteHorizons: http://127.0.0.1:4173'));
