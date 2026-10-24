import test from 'node:test';
import assert from 'node:assert/strict';
import {previewRateLine,catalogPreviewSnapshot} from '../web/local-rate-line-preview.mjs';

const template={id:'rt',name:'ผนังกรุลามิเนต',unit_id:'sqm'};
const wood={code:'WD01',name:'ไม้โครงผนัง',price:'290',yield:'25',increment:'1',purchase_unit:'มัด',usage_unit:'เมตร',type:'MATERIAL',resourceKind:'ITEM'};
const line={resource_id:'wd',numerator:'8',denominator:'1',waste:'0',price:'290',quantity_source:'MANUAL',line_role:'OTHER',is_active:true};
const options=(extra={})=>({snapshot:wood,template,sellingUnit:'ตร.ม.',...extra,line:{...line,...extra.line}});

test('manual wood shows 8 metres per 1 square metre, 290/25 => 11.60 and 92.80',()=>{
 const r=previewRateLine(options());assert.equal(r.status,'READY');assert.equal(r.result.usage_total,'8');assert.equal(r.result.unit_cost,'11.6');assert.equal(r.result.cost_total,'92.80');assert.equal(r.basis,'PER_UNIT');
});
test('unsaved numerator, denominator and waste use the core result',()=>{
 assert.equal(previewRateLine(options({line:{numerator:'10'}})).result.cost_total,'116.00');
 const r=previewRateLine(options({line:{numerator:'8',denominator:'2',waste:'10'}}));assert.equal(r.result.usage_total,'4.4');assert.equal(r.result.cost_total,'51.04');
});
test('area purchase conversion retains exact repeating rate before rounding the line',()=>{
 const r=previewRateLine(options({snapshot:{...wood,code:'LM01',name:'ลามิเนต',price:'1200',yield:'2.88',purchase_unit:'แผ่น',usage_unit:'ตร.ม.'},line:{numerator:'3',price:'1200'}}));assert.equal(r.status,'READY');assert.match(r.result.unit_cost,/^416\.666666/);assert.equal(r.result.cost_total,'1250.00');
});
test('DIRECT labor and explicit zero price are valid, blank price is pending',()=>{
 const r=previewRateLine(options({snapshot:{...wood,yield:'1',type:'LABOR',purchase_unit:'ตร.ม.',usage_unit:'ตร.ม.'},line:{numerator:'1',price:'600',labor_phase:'INSTALLATION'}}));assert.equal(r.result.cost_total,'600.00');
 assert.equal(previewRateLine(options({line:{price:'0'}})).result.cost_total,'0.00');assert.equal(previewRateLine(options({line:{price:''}})).status,'PENDING');
});
test('editing uses frozen yield and units with the current draft price',()=>{
 const oldLine={resource_id:'wd',snapshot:wood},changedCatalog={...wood,yield:'100',usage_unit:'ลิตร'};
 const r=previewRateLine(options({oldLine,snapshot:changedCatalog,line:{price:'300'}}));assert.equal(r.result.unit_cost,'12');assert.equal(r.result.usage_unit,'เมตร');assert.equal(r.result.cost_total,'96.00');
 assert.equal(previewRateLine(options({oldLine,line:{resource_id:'other'}})).status,'PENDING');
 assert.equal(previewRateLine(options({oldLine:{resource_id:'wd'},snapshot:changedCatalog})).status,'PENDING');
});
const group={id:'g',template_id:'rt',sourcing_method:'MAKE',is_active:true,area:'3',plySides:'2',lamSides:'2',quantity:'4'};
test('PANEL_AREA, PLYWOOD_AREA, LAMINATE_AREA and GROUP_QUANTITY use existing group rules',()=>{
 const frame=previewRateLine(options({group,line:{group_id:'g',quantity_source:'PANEL_AREA',line_role:'FRAME'}}));assert.equal(frame.result.usage_total,'24');assert.equal(frame.result.cost_total,'278.40');
 const ply=previewRateLine(options({group,line:{group_id:'g',numerator:'1',quantity_source:'PLYWOOD_AREA',line_role:'PLYWOOD'}}));assert.equal(ply.result.usage_total,'6');
 const lam=previewRateLine(options({group,line:{group_id:'g',numerator:'1',quantity_source:'LAMINATE_AREA',line_role:'LAMINATE'}}));assert.equal(lam.result.usage_total,'6');
 const count=previewRateLine(options({group,line:{group_id:'g',numerator:'2',quantity_source:'GROUP_QUANTITY'}}));assert.equal(count.result.usage_total,'8');assert.equal(count.basis,'TOTAL');
});
test('missing group, inactive group, zero laminate sides and role mismatch stay pending',()=>{
 assert.equal(previewRateLine(options({line:{quantity_source:'PANEL_AREA'}})).status,'PENDING');
 assert.equal(previewRateLine(options({group:{...group,is_active:false},line:{group_id:'g'}})).status,'PENDING');
 assert.equal(previewRateLine(options({group:{...group,lamSides:'0'},line:{group_id:'g',quantity_source:'LAMINATE_AREA',line_role:'LAMINATE',numerator:'1'}})).status,'PENDING');
 assert.equal(previewRateLine(options({group,line:{group_id:'g',quantity_source:'PLYWOOD_AREA',line_role:'PLYWOOD',numerator:'2'}})).status,'PENDING');
});
test('MANUAL BUNDLE uses TOTAL at quantity one and rejects fractional set quantities',()=>{
 const snapshot={...wood,resourceKind:'BUNDLE',yield:'1',purchase_unit:'ชุด',usage_unit:'ชุด'};
 const r=previewRateLine(options({snapshot,line:{numerator:'2'}}));assert.equal(r.status,'READY');assert.equal(r.basis,'TOTAL');assert.equal(r.result.cost_total,'580.00');
 assert.equal(previewRateLine(options({snapshot,line:{numerator:'0.5'}})).status,'PENDING');
});
test('invalid or incomplete draft quantities and yield never become a false zero',()=>{
 for(const extra of [{line:{numerator:''}},{line:{numerator:'-1'}},{line:{denominator:'0'}},{line:{denominator:''}},{line:{waste:''}},{snapshot:{...wood,yield:''}},{snapshot:{...wood,yield:'0'}},{line:{is_active:false}}]){
  const r=previewRateLine(options(extra));assert.equal(r.status,'PENDING');assert.equal(r.result,undefined);assert.ok(r.reason);
 }
});
test('catalog snapshot reads actual units and cost type without mutating source',()=>{
 const resource={code:'L',name:'ค่าแรง',price:'',yield:'1',increment:'1',purchase_unit_id:'u',usage_unit_id:'u',cost_type_id:'labor',resource_kind:'SERVICE'},original=JSON.stringify(resource);
 const snapshot=catalogPreviewSnapshot(resource,{units:[{id:'u',name:'เมตร'}],cost_types:[{id:'labor',code:'LABOR'}]});assert.equal(snapshot.price,null);assert.equal(snapshot.type,'LABOR');assert.equal(snapshot.usage_unit,'เมตร');assert.equal(JSON.stringify(resource),original);
});
