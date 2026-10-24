import test from 'node:test';import assert from 'node:assert/strict';
import {LocalStore} from '../local/store.mjs';import {lengthUnitYield} from '../lib/length-units.mjs';
import {previewCatalogDraft} from '../local/catalog-draft.mjs';import {catalogUnitPreview} from '../web/local-catalog-editor.mjs';
import {catalogExport,catalogPreview,catalogCommit} from '../local/catalog.mjs';import {exportCatalog,parseCatalog} from '../lib/catalog-excel.mjs';
const data=(s,unit,price)=>({company_id:s.company.id,cost_type_id:s.all('cost_types').find(t=>t.code==='MATERIAL').id,code:'LENGTH-'+unit,name:'วัสดุความยาว SAMPLE',resource_kind:'ITEM',price,conversion_method:'LENGTH_UNIT',purchase_unit_id:s.all('units').find(u=>u.name===unit).id,usage_unit_id:s.all('units').find(u=>u.name==='เมตร').id,increment:'1',pack_count:'',length_m:'',width_m:'',volume_l:'',notes:'',tags:'',scope_key:'OTHER',covered_scopes:'',is_active:true});
test('length factors are exact international definitions and reject area or incompatible units',()=>{
 assert.equal(lengthUnitYield('ฟุต','เมตร'),'0.3048');assert.equal(lengthUnitYield('หลา','เมตร'),'0.9144');
 for(const pair of [['ฟุต','ตร.ม.'],['ตร.ฟุต','เมตร'],['เมตร','ฟุต'],['หลา','ลิตร']])assert.throws(()=>lengthUnitYield(...pair));
});
test('selecting length conversion calculates price through existing core and never persists preview inputs',t=>{
 const s=new LocalStore(':memory:');t.after(()=>s.close());const before=s.state();s.ensureAreaUnits();assert.deepEqual(s.state(),before);
 for(const [unit,price,factor]of [['ฟุต','30.48','0.3048'],['หลา','91.44','0.9144']]){
  const p=previewCatalogDraft(s,data(s,unit,price));assert.equal(p.resource.yield,factor);assert.equal(catalogUnitPreview(p.snapshot).result.unit_cost,'100');assert.deepEqual(s.state(),before);
 }
 const invalid={...data(s,'ฟุต','100'),usage_unit_id:s.all('units').find(u=>u.name==='ตร.ม.').id};assert.throws(()=>s.save('cost_resources',invalid));assert.deepEqual(s.state(),before);
});
test('length units round-trip in Excel and backup, retaining project and frozen rate snapshots',async t=>{
 const s=new LocalStore(':memory:');t.after(()=>s.close());const project=s.sampleProject(),old=s.calculate(project.id);
 const foot=s.save('cost_resources',data(s,'ฟุต','30.48'));s.save('cost_resources',data(s,'หลา','91.44'));
 const parsed=await parseCatalog(await exportCatalog(catalogExport(s),{templateVersion:'3'}));assert.ok(catalogPreview(s,parsed.rows).every(r=>r.status==='UNCHANGED'));catalogCommit(s,parsed.rows);
 const restore=new LocalStore(':memory:');t.after(()=>restore.close());restore.restore({format:'SMART_BOQ_LOCAL_24_V1',...s.state()});assert.equal(restore.get('cost_resources',foot.id).yield,'0.3048');assert.equal(restore.all('units').filter(u=>u.name==='ฟุต').length,1);
 const rate=s.save('rate_templates',{company_id:s.company.id,category_id:s.all('work_categories').find(c=>c.code==='GENERAL').id,unit_id:foot.usage_unit_id,name:'งานเมตร SAMPLE',margin:'40'});
 s.save('rate_template_cost_lines',{template_id:rate.id,resource_id:foot.id,numerator:'2',denominator:'1',waste:'0',line_role:'OTHER',quantity_source:'MANUAL'});
 const base=s.previewRate(rate.id).result.components[0];assert.equal(base.cost_total,'200.00');assert.equal(base.sale_per_unit,'333.33');
 s.save('cost_resources',{...s.get('cost_resources',foot.id),price:'60.96'});assert.equal(s.previewRate(rate.id).result.components[0].cost_total,base.cost_total);assert.deepEqual(s.calculate(project.id),old);
});
