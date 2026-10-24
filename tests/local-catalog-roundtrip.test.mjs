import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../local/store.mjs';
import {catalogExport,catalogPreview,catalogCommit} from '../local/catalog.mjs';
import {exportCatalog,parseCatalog} from '../lib/catalog-excel.mjs';

test('main SQLite catalog XLSX v3 no-op roundtrip retains every kit, Modular field and project snapshot',async t=>{
 const s=new LocalStore(':memory:');t.after(()=>s.close());const p=s.sampleProject();
 const mod=s.all('modular_products')[0],r=s.get('cost_resources',mod.resource_id);
 s.put('cost_resources',{...r,coverage_area_per_purchase:'28.80',coverage_note:'SAMPLE ตรวจจากใบราคา',price_updated_at:'2026-10-23'},r.id);
 s.put('modular_products',{...mod,function_code:'0001',led_code:'00',excluded_scope:'SAMPLE ไม่รวมขนส่ง'},mod.id);
 const before=s.state(),total=s.calculate(p.id),exported=catalogExport(s);
 const parsed=await parseCatalog(await exportCatalog(exported,{templateVersion:'3'}));
 const preview=catalogPreview(s,parsed.rows);assert.equal(preview.every(x=>x.status==='UNCHANGED'),true,JSON.stringify(preview));
 catalogCommit(s,parsed.rows);
 for(const table of ['cost_resources','modular_products','resource_bundle_items','project_resources','component_cost_lines','cost_line_coverages'])assert.deepEqual(s.all(table),before.tables[table],table);
 assert.deepEqual(s.calculate(p.id),total);
 const checked=parsed.rows.find(x=>x.resource_id===r.id);assert.equal(checked.led_code,'00');assert.equal(checked.function_code,'0001');assert.equal(checked.excluded_scope,'SAMPLE ไม่รวมขนส่ง');assert.equal(checked.coverage_area_per_purchase,'28.80');
 assert.equal(parsed.rows.filter(x=>x.resource_kind==='BUNDLE').every(x=>Array.isArray(JSON.parse(x.bundle_items_json))),true);
});

test('main v3 kit changes reject a stale file and malformed child references atomically',async t=>{
 const s=new LocalStore(':memory:');t.after(()=>s.close());s.sampleProject();
 const exported=catalogExport(s),kit=exported.find(x=>JSON.parse(x.bundle_items_json??'[]').length),before=s.state();assert.ok(kit);
 const parts=JSON.parse(kit.bundle_items_json);parts[0].scope_key='QA_CHANGE';const changed={...kit,bundle_items_json:JSON.stringify(parts)};
 catalogCommit(s,[changed]);const next=s.get('cost_resources',kit.resource_id);assert.ok(next.version>Number(kit.version));
 assert.throws(()=>catalogCommit(s,[{...kit,resource_name:kit.resource_name+' stale'}]),/version|รุ่น|ขัดแย้ง/i);
 const bad={...catalogExport(s).find(x=>x.resource_id===kit.resource_id),bundle_items_json:JSON.stringify([{...parts[0],child_resource_id:kit.resource_id,child_code:kit.resource_code}])};
 const snapshot=s.state();assert.throws(()=>catalogCommit(s,[bad]));assert.deepEqual(s.state(),snapshot);
 assert.deepEqual(s.all('component_cost_lines'),before.tables.component_cost_lines);
});
