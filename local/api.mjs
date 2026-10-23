import {LocalStore,LocalError} from './store.mjs';
import {catalogExport,catalogPreview,catalogCommit} from './catalog.mjs';
export function localApi(path){
 const store=new LocalStore(path);
 async function handler(req,res,next){
  const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  try{
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw new LocalError('อนุญาตเฉพาะแอปในเครื่องเดียวกัน',403);
   const url=new URL(req.url,'http://127.0.0.1'),route=url.pathname.replace(/^\/api\/local/,'')||'/';
   if(req.method==='GET'&&route==='/state')return send(200,store.state());
   if(req.method==='GET'&&route==='/calculate')return send(200,store.calculate(url.searchParams.get('project')));
   if(req.method==='GET'&&route==='/backup')return send(200,{format:'SMART_BOQ_LOCAL_22_V1',exported_at:new Date().toISOString(),...store.state()});
   if(req.method==='GET'&&route==='/catalog-export')return send(200,catalogExport(store));
   if(!['POST','DELETE'].includes(req.method))return send(404,{error:'ไม่พบคำสั่งในเครื่อง'});
   const chunks=[];let size=0;for await(const chunk of req){chunks.push(chunk);size+=chunk.length;if(size>20*1024*1024)throw new LocalError('ข้อมูลเกินขนาด 20 MB',413);}const raw=Buffer.concat(chunks).toString('utf8');let body;try{body=JSON.parse(raw||'{}');}catch{throw new LocalError('รูปแบบ JSON ไม่ถูกต้อง');}
   if(route==='/rate-reference'&&req.method==='POST')return send(200,store.resolveRateReference(body));
   if(route==='/rate-preview'&&req.method==='POST')return send(200,store.previewRate(body.id));
   if(route==='/rate-publish'&&req.method==='POST')return send(200,store.publishRate(body.id,body.version));
   if(route==='/rate-retire'&&req.method==='POST')return send(200,store.retireRate(body.id,body.version));
   if(route==='/rate-revise'&&req.method==='POST')return send(200,store.reviseRate(body.id,body.version));
   if(route==='/rate-import'&&req.method==='POST')return send(200,store.importRate(body));
   if(route==='/restore'&&req.method==='POST')return send(200,store.restore(body));
   if(route==='/sample'&&req.method==='POST')return send(200,store.sampleProject());
   if(route==='/catalog-preview'&&req.method==='POST')return send(200,catalogPreview(store,body.rows));
   if(route==='/catalog-commit'&&req.method==='POST')return send(200,catalogCommit(store,body.rows));
   if(route==='/select-resource'&&req.method==='POST')return send(200,store.tx(()=>{store.context('project_resources',{project_id:body.project_id},body.project_version);const pr=store.selectResource(body.project_id,store.get('cost_resources',body.resource_id));const p=store.get('projects',body.project_id);store.put('projects',p,p.id);return pr;}));
   if(route==='/resolve-reference'&&req.method==='POST')return send(200,store.resolveReference(body.id,body.decision,body.project_version));
   const match=route.match(/^\/records\/([a-z_]+)(?:\/([^/]+))?$/);
   if(match&&req.method==='POST'&&!match[2])return send(200,store.save(match[1],body));
   if(match&&req.method==='DELETE'&&match[2])return send(200,store.remove(match[1],match[2],body.version,body.project_version));
   return send(404,{error:'ไม่พบคำสั่งในเครื่อง'});
  }catch(e){send(e.status??400,{error:e.code?.startsWith('ERR_SQLITE')?'ข้อมูลอ้างอิงไม่ถูกต้องหรือมีรายการซ้ำ':e.message});}
 }
 return {store,handler};
}
