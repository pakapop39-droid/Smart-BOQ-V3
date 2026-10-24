import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {exportCatalog,parseCatalog,previewExcel} from '../lib/catalog-excel.mjs';

const item={kind:'MATERIAL',resource_id:'11111111-1111-4111-8111-111111111111',version:'2',resource_code:'KIT-001',resource_name:'ชุดซิงก์',cost_type_code:'MATERIAL',purchase_unit_code:'ชุด',usage_unit_code:'ชุด',purchase_unit_price:'1250.125',conversion_method:'DIRECT',purchase_increment:'1',is_active:true,resource_kind:'BUNDLE',scope_key:'SINK',covered_scopes:'SINK,TAP',tags:'งานตู้\nงานผนัง',bundle_items_json:JSON.stringify([{child_resource_id:'22222222-2222-4222-8222-222222222222',child_code:'TAP-001',inclusion_status:'INCLUDED',quantity:'1',scope_key:'TAP',source_reference:'ใบราคา SAMPLE'}])};

test('local XLSX v3 preserves tag names and complete kit references without creating duplicate material sheets',async()=>{
 const bytes=await exportCatalog([item],{templateVersion:'3'}),parsed=await parseCatalog(bytes);
 assert.equal(parsed.template_version,'3');assert.equal(parsed.rows.length,1);
 for(const key of ['resource_id','version','resource_code','purchase_unit_price','resource_kind','scope_key','covered_scopes','tags','bundle_items_json'])assert.equal(parsed.rows[0][key],item[key]);
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);assert.equal(wb.worksheets.length,4);assert.equal(wb.getWorksheet('คำแนะนำ').getCell('B2').value,'2.2');
});

test('v1 and v2 retain original headers and cannot implicitly clear newer kit details',async()=>{
 for(const version of ['1','2']){const parsed=await parseCatalog(await exportCatalog([item],{templateVersion:version}));assert.equal(Object.hasOwn(parsed.rows[0],'bundle_items_json'),false);assert.equal(Object.hasOwn(parsed.rows[0],'resource_kind'),false);assert.equal(Object.hasOwn(parsed.rows[0],'tags'),version==='2');}
});

test('new local Excel is refused by online importer before any external request',async()=>{
 let calls=0;const client={database:{rpc(){calls++;throw Error('must not call');}}};
 await assert.rejects(previewExcel(client,await exportCatalog([item],{templateVersion:'3'})),/เฉพาะระบบทดลองในเครื่อง/);assert.equal(calls,0);
});
