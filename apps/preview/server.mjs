import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('./index.html',import.meta.url));
const port=Number(process.env.PORT||4173);
createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
 const path=new URL(req.url||'/',`http://localhost:${port}`).pathname;
 if(path==='/favicon.ico'){res.writeHead(204);res.end();return}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end(req.method==='HEAD'?undefined:html);
}).listen(port,'127.0.0.1',()=>console.log(`Learn local preview: http://127.0.0.1:${port}`));
