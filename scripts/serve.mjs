import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const args=process.argv.slice(2);const arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const port=Number(arg('--port',3000)),host=arg('--host','0.0.0.0'),root=resolve('.');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.zip':'application/zip','.yaml':'text/yaml; charset=utf-8'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end();}if((await stat(path)).isDirectory())path=resolve(path,'index.html');const bytes=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,host,()=>console.log(`Serving Mightora Analytics on ${host}:${port}`));
