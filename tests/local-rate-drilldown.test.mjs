import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../local/store.mjs';
import {rateComposition,rateParts} from '../web/local-rate-workspace.mjs';

test('legacy empty relation strings remain visible beside null roots without rewriting stored rows',()=>{
 const tables={rate_template_groups:[],rate_template_cost_lines:[
  {id:'legacy',template_id:'r',group_id:'',parent_id:''},
  {id:'new',template_id:'r',group_id:null,parent_id:null},
  {id:'child',template_id:'r',group_id:'',parent_id:'legacy'},
  {id:'other',template_id:'another',group_id:'',parent_id:''}
 ]};
 const before=structuredClone(tables);
 assert.deepEqual(rateComposition(tables,'r').map(l=>l.id),['legacy','new']);
 assert.deepEqual(rateComposition(tables,'r','').map(l=>l.id),['legacy','new']);
 assert.deepEqual(rateComposition(tables,'r',null,'legacy').map(l=>l.id),['child']);
 assert.equal(rateParts(tables,'r')[0].count,2);
 assert.deepEqual(tables,before);
});

test('composition tables isolate template, group, chosen sourcing method and parent; never show children twice',()=>{
 const tables={rate_template_groups:[{id:'g',template_id:'r',name:'ตัวตู้',sourcing_method:'MAKE'}],rate_template_cost_lines:[
  {id:'direct',template_id:'r'},
  {id:'wood',template_id:'r',group_id:'g',variant:'MAKE'},
  {id:'old-buy',template_id:'r',group_id:'g',variant:'BUY'},
  {id:'child',template_id:'r',group_id:'g',variant:'MAKE',parent_id:'wood'},
  {id:'other',template_id:'other',group_id:'g',variant:'MAKE'}]};
 const before=JSON.stringify(tables);assert.deepEqual(rateParts(tables,'r').map(p=>[p.id,p.count]),[['g',1],['direct',1]]);
 assert.deepEqual(rateComposition(tables,'r','g').map(l=>l.id),['wood']);assert.deepEqual(rateComposition(tables,'r','g','wood').map(l=>l.id),['child']);assert.deepEqual(rateComposition(tables,'r').map(l=>l.id),['direct']);assert.equal(JSON.stringify(tables),before);
});
test('ungrouped and empty legacy rates remain accessible without creating new database groups',()=>{
 const tables={rate_template_groups:[],rate_template_cost_lines:[{id:'one',template_id:'r'}]};
 assert.equal(rateParts(tables,'r')[0].kind,'direct');assert.equal(rateParts(tables,'r')[0].count,1);assert.equal(rateParts(tables,'empty')[0].count,0);assert.equal(tables.rate_template_groups.length,0);
});
test('group mapping in preview reports saved group IDs and exact core subtotals without leaving preview data',t=>{
 const s=new LocalStore(':memory:');t.after(()=>s.close());s.sampleProject();
 const r=s.save('rate_templates',{company_id:s.company.id,category_id:s.all('work_categories').find(c=>c.code==='BUILTIN').id,unit_id:s.all('units').find(u=>u.name==='เมตร').id,name:'ตู้เตี้ย QA',margin:'40'});
 const make=s.save('rate_template_groups',{template_id:r.id,name:'ตัวตู้',sourcing_method:'MAKE',assembly_kind:'CARCASS',calculation_method:'MANUAL',area:'',quantity:'1',plySides:'2',lamSides:'2'}),buy=s.save('rate_template_groups',{template_id:r.id,name:'หน้าบาน',sourcing_method:'BUY',assembly_kind:'DOOR',calculation_method:'MANUAL',area:'',quantity:'1',plySides:'2',lamSides:'2'});
 const add=(code,group,numerator)=>s.save('rate_template_cost_lines',{template_id:r.id,group_id:group,resource_id:s.all('cost_resources').find(x=>x.code===code).id,numerator,denominator:'1',waste:'0',quantity_source:'MANUAL',line_role:'OTHER'});
 add('WD01',make.id,'8');add('DOOR-KIT-SAMPLE',buy.id,'1');const before=s.state(),p=s.previewRate(r.id),result=p.result.components[0];
 assert.equal(result.cost_total,'1092.80');assert.deepEqual(result.group_totals.map(g=>[g.templateGroupId,g.cost_total]),[[make.id,'92.80'],[buy.id,'1000.00']]);assert.deepEqual(s.state(),before);
 const parts=rateParts(s.state().tables,r.id);assert.equal(parts.length,2);assert.equal(parts.find(p=>p.id===buy.id).count,1);const root=rateComposition(s.state().tables,r.id,buy.id)[0],children=rateComposition(s.state().tables,r.id,buy.id,root.id);assert.ok(children.length>0);assert.ok(children.every(c=>c.parent_id===root.id&&c.line_kind!=='CHARGEABLE'));
});
