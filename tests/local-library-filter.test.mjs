import test from 'node:test';
import assert from 'node:assert/strict';
import {filterResources,resourceKind} from '../web/local-library.mjs';

test('main catalog tags use OR intersected with search and correct three-library membership',()=>{
 const tables={cost_types:[{id:'mat',code:'MATERIAL'},{id:'lab',code:'LABOR'}],cost_resources:[
  {id:'ply',code:'PLY-01',name:'ไม้อัด',cost_type_id:'mat'},
  {id:'kit',code:'KIT-01',name:'ชุดซิงก์',resource_kind:'BUNDLE',cost_type_id:'mat'},
  {id:'vs',code:'CUSTOM-CODE',name:'VS Modular',resource_kind:'BUNDLE',cost_type_id:'mat'},
  {id:'labor',code:'LAB-01',name:'แรงกรุผนัง',cost_type_id:'lab'}],
  modular_products:[{resource_id:'vs'}],resource_tag_links:[{resource_id:'ply',tag_id:'cabinet'},{resource_id:'ply',tag_id:'wall'},{resource_id:'kit',tag_id:'cabinet'},{resource_id:'labor',tag_id:'wall'}]};
 assert.equal(resourceKind(tables.cost_resources[1],tables),'MATERIAL');assert.equal(resourceKind(tables.cost_resources[2],tables),'VS_MODULAR');
 assert.deepEqual(filterResources(tables,{tags:['wall','cabinet'],search:'ply'}).map(r=>r.id),['ply']);
 assert.deepEqual(filterResources(tables,{tags:['wall','cabinet']}).map(r=>r.id),['ply','kit']);
 assert.deepEqual(filterResources(tables,{kind:'LABOR',tags:['wall']}).map(r=>r.id),['labor']);
 assert.deepEqual(filterResources(tables,{kind:'VS_MODULAR',untagged:true}).map(r=>r.id),['vs']);
 assert.deepEqual(filterResources(tables,{kind:'MATERIAL',untagged:true}),[]);
});
