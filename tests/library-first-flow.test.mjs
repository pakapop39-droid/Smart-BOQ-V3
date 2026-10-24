import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import Decimal from 'decimal.js';
import {localApi} from '../local/api.mjs';

const D=Decimal.clone({precision:80,rounding:Decimal.ROUND_HALF_UP});
async function setup(t){
 const api=localApi(':memory:'),server=createServer(api.handler);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{await new Promise(resolve=>server.close(resolve));api.store.close();});
 const base='http://127.0.0.1:'+server.address().port+'/api/local';
 const response=async(path,body)=>{const res=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
 const call=async(path,body)=>{const result=await response(path,body);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};
 const sample=await call('/sample',{}),state=await call('/state');
 const project=await call('/records/projects',{company_id:state.company_id,member_id:state.member_id,code:'LIBRARY-FIRST-QA',name:'โครงการตรวจ flow จากคลัง SAMPLE'});
 const area=await call('/records/areas',{project_id:project.id,name:'ห้องครัว',project_version:project.version});
 const work=await call('/records/work_items',{project_id:project.id,area_id:area.id,code:'B01',name:'เคาน์เตอร์ครัว SAMPLE',project_version:api.store.get('projects',project.id).version});
 return {api,call,response,sample,state,project,work};
}
const specifications=[
 // These are isolated QA costs, not approved construction recipes or prices.
 {name:'ตู้เตี้ย SAMPLE สำหรับตรวจหน่วยเมตร',category:'BUILTIN',unit:'เมตร',quantity:'3.50',next:'4.25',lines:[['WD01','8'],['PLY01','1'],['LM01','1'],['LB01','1','PRODUCTION']]},
 {name:'ท็อปหิน SAMPLE',category:'STONE',unit:'ตร.ม.',quantity:'2.10',next:'2.55',lines:[['ST01','1']]},
 {name:'ผนังกรุ SAMPLE',category:'WALL',unit:'ตร.ม.',quantity:'6',next:'6.125',lines:[['LM01','1'],['LB03','1','PRODUCTION']]},
 {name:'ซิงก์พร้อมอุปกรณ์ SAMPLE',category:'PLUMBING',unit:'ชุด',quantity:'1',next:'2',lines:[['SK01','1'],['FA01','1'],['DR01','1'],['LB05','1','INSTALLATION']]}
];
async function draft(ctx,spec){
 const {call,state}=ctx;
 const root=await call('/records/rate_templates',{company_id:state.company_id,category_id:state.tables.work_categories.find(c=>c.code===spec.category).id,unit_id:state.tables.units.find(u=>u.name===spec.unit).id,name:spec.name,margin:'40',is_active:true});
 for(const [code,numerator,labor_phase='']of spec.lines)await call('/records/rate_template_cost_lines',{template_id:root.id,resource_id:state.tables.cost_resources.find(r=>r.code===code).id,numerator,denominator:'1',waste:'0',line_role:'OTHER',quantity_source:'MANUAL',labor_phase});
 return ctx.api.store.get('rate_templates',root.id);
}
const sameUnitCost=(a,b)=>assert.equal(new D(a.cost_per_unit).toDecimalPlaces(12).toFixed(12),new D(b.cost_per_unit).toDecimalPlaces(12).toFixed(12));

test('library-first HTTP flow publishes four SAMPLE rates, fills B01 with correct units, and recalculates fractional project quantities without changing old work',async t=>{
 const ctx=await setup(t),{api,call,sample,project,work}=ctx,oldComponents=api.store.all('work_components').filter(c=>api.store.projectOf('work_components',c)===sample.id),oldLines=api.store.all('component_cost_lines').filter(l=>oldComponents.some(c=>c.id===l.component_id)),oldTotal=api.store.calculate(sample.id),selected=[];
 for(const spec of specifications){
  const root=await draft(ctx,spec),before=api.store.state(),preview=await call('/rate-preview',{id:root.id});assert.deepEqual(api.store.state(),before);assert.equal(preview.errors.length,0);assert.equal(preview.result.components[0].unit,spec.unit);
  const ready=await call('/rate-publish',{id:root.id,version:root.version});assert.equal(ready.status,'READY');
  const component=await call('/rate-import',{template_id:ready.id,template_version:ready.version,work_item_id:work.id,project_version:api.store.get('projects',project.id).version,quantity:spec.quantity});
  assert.equal(component.unit_id,ready.unit_id);assert.equal(component.source_template_id,ready.id);selected.push({spec,component,preview:preview.result.components[0]});
 }
 const calculated=await call('/calculate?project='+project.id);assert.equal(calculated.errors.length,0);assert.equal(calculated.components.length,4);assert.deepEqual(selected.map(x=>x.component.code),['S001','S002','S003','S004']);
 for(const {spec,component,preview}of selected){
  const priced=calculated.components.find(c=>c.code===component.id);sameUnitCost(priced,preview);assert.equal(priced.sale_per_unit,preview.sale_per_unit);assert.equal(priced.sale_total,new D(preview.sale_per_unit).mul(spec.quantity).toFixed(2));
  const lines=api.store.all('component_cost_lines').filter(l=>l.component_id===component.id);
  await call('/records/work_components',{...api.store.get('work_components',component.id),quantity:spec.next,project_version:api.store.get('projects',project.id).version});
  const changed=(await call('/calculate?project='+project.id)).components.find(c=>c.code===component.id);sameUnitCost(changed,preview);assert.equal(changed.sale_total,new D(preview.sale_per_unit).mul(spec.next).toFixed(2));assert.deepEqual(api.store.all('component_cost_lines').filter(l=>l.component_id===component.id),lines);
 }
 assert.deepEqual(api.store.all('work_components').filter(c=>oldComponents.some(old=>old.id===c.id)),oldComponents);assert.deepEqual(api.store.all('component_cost_lines').filter(l=>oldLines.some(old=>old.id===l.id)),oldLines);assert.deepEqual(api.store.calculate(sample.id),oldTotal);
});

test('a subsequent catalog price update preserves the chosen project snapshots, while editing a new draft changes its preview immediately',async t=>{
 const ctx=await setup(t),{api,call,project,work}=ctx,spec=specifications[1],root=await draft(ctx,spec),ready=await call('/rate-publish',{id:root.id,version:root.version}),component=await call('/rate-import',{template_id:ready.id,template_version:ready.version,work_item_id:work.id,project_version:api.store.get('projects',project.id).version,quantity:'2.10'}),before=await call('/calculate?project='+project.id),lines=api.store.all('component_cost_lines').filter(l=>l.component_id===component.id),resource=api.store.all('cost_resources').find(r=>r.code==='ST01');
 await call('/records/cost_resources',{...resource,price:'9999'});assert.deepEqual(await call('/calculate?project='+project.id),before);assert.deepEqual(api.store.all('component_cost_lines').filter(l=>l.component_id===component.id),lines);
 const revised=await call('/rate-revise',{id:ready.id,version:ready.version}),originalPreview=await call('/rate-preview',{id:revised.id}),line=api.store.all('rate_template_cost_lines').find(l=>l.template_id===revised.id&&l.line_kind==='CHARGEABLE');assert.equal(originalPreview.result.cost_total,'3000.00');
 await call('/records/rate_template_cost_lines',{...line,price:'3300'});const snapshot=api.store.state(),changedPreview=await call('/rate-preview',{id:revised.id});assert.equal(changedPreview.result.cost_total,'3300.00');assert.deepEqual(api.store.state(),snapshot);assert.deepEqual(await call('/calculate?project='+project.id),before);assert.equal(api.store.get('rate_templates',ready.id).unit_cost,'3000.00');
});

test('project unit changes, invalid quantities and stale template selection fail without replacing the existing project item',async t=>{
 const ctx=await setup(t),{api,call,response,project,work,state}=ctx,root=await draft(ctx,specifications[1]),ready=await call('/rate-publish',{id:root.id,version:root.version}),component=await call('/rate-import',{template_id:ready.id,template_version:ready.version,work_item_id:work.id,project_version:api.store.get('projects',project.id).version,quantity:'2.10'});
 for(const patch of [{unit_id:state.tables.units.find(u=>u.name==='เมตร').id},{quantity:'-1'},{quantity:'1.1234567'}]){const before=api.store.state(),result=await response('/records/work_components',{...api.store.get('work_components',component.id),...patch,project_version:api.store.get('projects',project.id).version});assert.notEqual(result.status,200);assert.deepEqual(api.store.state(),before);}
 const before=api.store.state(),stale=await response('/rate-import',{template_id:ready.id,template_version:0,work_item_id:work.id,project_version:api.store.get('projects',project.id).version,quantity:'1'});assert.notEqual(stale.status,200);assert.deepEqual(api.store.state(),before);assert.equal((await call('/calculate?project='+project.id)).components[0].quantity,'2.10');
});
