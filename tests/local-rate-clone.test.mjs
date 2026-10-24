import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../local/store.mjs';
function setup(t){const s=new LocalStore(':memory:');t.after(()=>s.close());const project=s.sampleProject();const rate=s.save('rate_templates',{company_id:s.company.id,category_id:s.all('work_categories')[0].id,unit_id:s.all('units').find(u=>u.name==='เมตร').id,name:'ตู้ต้นแบบ',margin:'40',is_active:true});
 const group=(name,kind,method)=>s.save('rate_template_groups',{template_id:rate.id,name,assembly_kind:kind,sourcing_method:method,calculation_method:'MANUAL',area:'',quantity:'1',plySides:'2',lamSides:'2',is_active:true});
 const body=group('ตัวตู้','CARCASS','MAKE'),door=group('หน้าบาน','DOOR','BUY');
 for(const [g,code,numerator]of [[body,'WD01','8'],[door,'DOOR-KIT-SAMPLE','1']])s.save('rate_template_cost_lines',{template_id:rate.id,group_id:g.id,resource_id:s.all('cost_resources').find(r=>r.code===code).id,numerator,denominator:'1',waste:'0',line_role:'OTHER',quantity_source:'MANUAL'});
 return {s,rate,project};}
test('clone READY copies groups, bundle contents and coverages into independent IDs; source, catalog and projects stay unchanged',t=>{
 const {s,rate,project}=setup(t),ready=s.publishRate(rate.id,s.get('rate_templates',rate.id).version),before=s.state(),calc=s.calculate(project.id),base=s.previewRate(rate.id).result.components[0];
 const copy=s.cloneRate({id:ready.id,version:ready.version,name:' ตู้ผิวใหม่ '});
 assert.notEqual(copy.code,ready.code);assert.notEqual(copy.id,ready.id);assert.equal(copy.name,'ตู้ผิวใหม่');assert.equal(copy.revision,'1');assert.equal(copy.status,'DRAFT');assert.equal(copy.unit_sale,undefined);
 for(const table of ['rate_templates','rate_template_groups','rate_template_cost_lines','rate_template_coverages'])for(const old of before.tables[table])assert.deepEqual(s.get(table,old.id),old);
 assert.deepEqual(s.all('cost_resources'),before.tables.cost_resources);assert.deepEqual(s.calculate(project.id),calc);
 const groups=s.all('rate_template_groups').filter(g=>g.template_id===copy.id),lines=s.all('rate_template_cost_lines').filter(l=>l.template_id===copy.id),ids=new Set(lines.map(l=>l.id));
 assert.equal(groups.length,2);assert.ok(lines.some(l=>l.parent_id));
 for(const l of lines){assert.ok(groups.some(g=>g.id===l.group_id));if(l.parent_id)assert.ok(ids.has(l.parent_id));if(l.origin_excluded_id)assert.ok(ids.has(l.origin_excluded_id));}
 for(const c of s.all('rate_template_coverages').filter(c=>c.template_id===copy.id)){assert.ok(ids.has(c.cost_line_id));assert.ok(groups.some(g=>g.id===c.group_id));}
 const result=s.previewRate(copy.id).result.components[0];assert.equal(result.cost_total,base.cost_total);assert.equal(result.sale_per_unit,base.sale_per_unit);
 const wood=lines.find(l=>l.snapshot.code==='WD01');s.save('rate_template_cost_lines',{...wood,numerator:'10'});assert.equal(s.previewRate(rate.id).result.components[0].cost_total,base.cost_total);
 const second=s.cloneRate({id:copy.id,version:s.get('rate_templates',copy.id).version,name:'อีกทางเลือก'});assert.notEqual(second.code,copy.code);assert.equal(second.revision,'1');
});
test('clone draft remaps an added excluded-reference link and preserves incomplete inputs',t=>{
 const {s,rate}=setup(t);const source=s.all('rate_template_cost_lines').find(l=>l.template_id===rate.id&&!l.parent_id);
 const reference=s.put('rate_template_cost_lines',{...source,parent_id:source.id,line_kind:'EXCLUDED_REFERENCE',inclusion:'EXCLUDED',resolution:'ADDED',numerator:''});
 const added=s.put('rate_template_cost_lines',{...source,parent_id:null,origin_excluded_id:reference.id,numerator:''});
 const copy=s.cloneRate({id:rate.id,version:s.get('rate_templates',rate.id).version,name:'ร่างใหม่'}),lines=s.all('rate_template_cost_lines').filter(l=>l.template_id===copy.id),a=lines.find(l=>l.origin_excluded_id);
 assert.notEqual(a.id,added.id);assert.notEqual(a.origin_excluded_id,reference.id);assert.ok(lines.some(l=>l.id===a.origin_excluded_id&&l.resolution==='ADDED'));assert.equal(a.numerator,'');assert.equal(s.previewRate(copy.id).result,null);
});
test('stale, blank and corrupt clone requests roll back without consuming a code or leaving partial copies',t=>{
 const {s,rate}=setup(t);let before=s.state();assert.throws(()=>s.cloneRate({id:rate.id,version:0,name:'ใหม่'}));assert.throws(()=>s.cloneRate({id:rate.id,version:s.get('rate_templates',rate.id).version,name:'  '}));assert.deepEqual(s.state(),before);
 const l=s.all('rate_template_cost_lines').find(l=>l.template_id===rate.id&&!l.parent_id);s.put('rate_template_cost_lines',{...l,parent_id:l.id},l.id);before=s.state();assert.throws(()=>s.cloneRate({id:rate.id,version:s.get('rate_templates',rate.id).version,name:'เสีย'}));assert.deepEqual(s.state(),before);
});
