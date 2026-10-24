import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {localApi} from '../local/api.mjs';

test('HTTP tag, bulk cost and persistent undo endpoints enforce versions and restore preview tokens',async t=>{
 const api=localApi(':memory:'),server=createServer(api.handler);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{await new Promise(resolve=>server.close(resolve));api.store.close();});const base='http://127.0.0.1:'+server.address().port+'/api/local',call=async(path,body,method='POST')=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};};
 const p=(await call('/sample',{})).data,state=(await call('/state',undefined,'GET')).data,r=state.tables.cost_resources[0];
 const tag=(await call('/tags',{name:'งานทดสอบ HTTP'})).data;assert.ok(tag.id);
 assert.equal((await call('/tags/bulk',{resource_ids:[r.id],tag_ids:[tag.id],action:'ADD',versions:{[r.id]:r.version,[tag.id]:tag.version}})).status,200);
 const rename=await call('/tags/'+tag.id,{name:'ชื่อใหม่',version:tag.version},'PATCH');assert.equal(rename.status,200);
 assert.equal((await call('/tags/'+tag.id,{version:tag.version},'DELETE')).status,409);
 assert.equal((await call('/tags/'+tag.id,{version:rename.data.version},'DELETE')).status,200);
 const latest=(await call('/undo/latest?scope=catalog',undefined,'GET')).data.command;assert.ok(latest.id);
 assert.equal((await call('/undo/'+latest.id,{})).status,200);
 const backup=(await call('/backup',undefined,'GET')).data;assert.equal(backup.format,'SMART_BOQ_LOCAL_24_V1');
 assert.equal((await call('/restore',backup)).status,400);
 const review=(await call('/restore-preview',{backup})).data;assert.ok(review.token);
 assert.equal((await call('/restore',{backup,token:'bad'})).status,409);
 assert.equal((await call('/restore',{backup,token:review.token})).status,200);
 const component=api.store.all('work_components').find(c=>c.code==='S004'),resource=api.store.all('cost_resources').find(r=>r.code==='LM01');
 const added=await call('/cost-lines/bulk-add',{project_id:p.id,component_id:component.id,group_id:null,project_version:api.store.get('projects',p.id).version,resource_ids:[resource.id],resource_versions:{[resource.id]:resource.version}});assert.equal(added.status,200);
 const line=added.data.added[0];const removed=await call('/cost-lines/bulk-delete',{component_id:component.id,group_id:null,project_version:added.data.project_version,lines:[{id:line.id,version:line.version}]});assert.equal(removed.status,200);
 assert.equal((await call('/undo/'+removed.data.command_id,{project_version:removed.data.project_version})).status,200);
 assert.equal((await call('/records/resource_tags',{company_id:state.company_id,name:'bypass',normalized_name:'bypass'})).status,400);
});
