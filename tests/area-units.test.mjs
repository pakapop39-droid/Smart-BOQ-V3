import test from 'node:test';import assert from 'node:assert/strict';
import {LocalStore} from '../local/store.mjs';import {areaUnitYield} from '../lib/area-units.mjs';
import {previewCatalogDraft} from '../local/catalog-draft.mjs';import {catalogUnitPreview} from '../web/local-catalog-editor.mjs';
import {catalogExport,catalogPreview,catalogCommit} from '../local/catalog.mjs';import {exportCatalog,parseCatalog} from '../lib/catalog-excel.mjs';
const make=(s,unit,price)=>({company_id:s.company.id,cost_type_id:s.all('cost_types').find(x=>x.code==='MATERIAL').id,code:'AREA-'+unit,name:'วัสดุพื้นที่ SAMPLE',resource_kind:'ITEM',price,conversion_method:'AREA_UNIT',purchase_unit_id:s.all('units').find(u=>u.name===unit).id,usage_unit_id:s.all('units').find(u=>u.name==='ตร.ม.').id,increment:'1',is_active:true});
test('exact international area factors and mismatched units are validated',()=>{
 assert.equal(areaUnitYield('ตร.หลา','ตร.ม.'),'0.83612736');assert.equal(areaUnitYield('ตร.ฟุต','ตร.ม.'),'0.09290304');
 for(const pair of [['เมตร','ตร.ม.'],['ตร.ฟุต','เมตร'],['ตร.ม.','ตร.ฟุต']])assert.throws(()=>areaUnitYield(...pair));
});
test('area conversion previews exact yields, does not persist, and seeds units once',t=>{
 const s=new LocalStore(':memory:');t.after(()=>s.close());const before=s.state();s.ensureAreaUnits();assert.deepEqual(s.state(),before);
 for(const [unit,price,yieldValue,cost]of [['ตร.หลา','900','0.83612736','1076.39104167'],['ตร.ฟุต','100','0.09290304','1076.39104167']]){
  const p=previewCatalogDraft(s,make(s,unit,price)),v=catalogUnitPreview(p.snapshot);assert.equal(p.resource.yield,yieldValue);assert.equal(v.status,'READY');assert.ok(v.result.unit_cost.startsWith(cost.slice(0,10)));assert.deepEqual(s.state(),before);
 }
 const invalid={...make(s,'ตร.หลา','900'),usage_unit_id:s.all('units').find(u=>u.name==='เมตร').id};assert.throws(()=>s.save('cost_resources',invalid));assert.deepEqual(s.state(),before);
});
test('catalog Excel v3 and backup preserve area conversion without duplicates or old snapshot changes',async t=>{
 const s=new LocalStore(':memory:');t.after(()=>s.close());const p=s.sampleProject(),base=s.calculate(p.id);
 const complete=unit=>({...make(s,unit,unit==='ตร.หลา'?'900':'100'),pack_count:'',length_m:'',width_m:'',volume_l:'',notes:'',tags:'',scope_key:'OTHER',covered_scopes:''});
 const a=s.save('cost_resources',complete('ตร.หลา'));s.save('cost_resources',complete('ตร.ฟุต'));
 const parsed=await parseCatalog(await exportCatalog(catalogExport(s),{templateVersion:'3'})),preview=catalogPreview(s,parsed.rows);assert.ok(preview.every(r=>r.status==='UNCHANGED'));
 catalogCommit(s,parsed.rows);assert.deepEqual(s.calculate(p.id),base);
 const copy=new LocalStore(':memory:');t.after(()=>copy.close());copy.restore({format:'SMART_BOQ_LOCAL_24_V1',...s.state()});assert.equal(copy.get('cost_resources',a.id).yield,'0.83612736');assert.equal(copy.all('units').filter(u=>u.name==='ตร.หลา').length,1);
 const rate=s.save('rate_templates',{company_id:s.company.id,category_id:s.all('work_categories').find(c=>c.code==='WALL').id,unit_id:a.usage_unit_id,name:'ผิว SAMPLE',margin:'40'});
 s.save('rate_template_cost_lines',{template_id:rate.id,resource_id:a.id,numerator:'1',denominator:'1',waste:'0',line_role:'OTHER',quantity_source:'MANUAL'});
 assert.equal(s.previewRate(rate.id).result.components[0].cost_total,'1076.39');
});
