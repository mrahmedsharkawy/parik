import http from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {extname,resolve,sep} from 'node:path';

const root=resolve(new URL('../',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
http.createServer((request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/bot-training.html':pathname));
    if(file!==root&&!file.startsWith(root+sep))throw new Error('invalid path');
    const stat=statSync(file);if(!stat.isFile())throw new Error('not a file');
    response.writeHead(200,{'content-type':types[extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    createReadStream(file).pipe(response);
  }catch(_error){response.writeHead(404,{'content-type':'text/plain; charset=utf-8'});response.end('Not found');}
}).listen(8080,'127.0.0.1',()=>console.log('Bariq Bot: http://127.0.0.1:8080/bot-training.html'));
