import test from 'node:test';
import assert from 'node:assert/strict';
import {filterReadyRates,validWorkContext} from '../web/local-rate-flow.mjs';

test('sales picker shows active READY entries and preserves the correct project/Keyplan return scope',()=>{
 const rates=[{id:'a',code:'RT001',name:'ตู้เตี้ย',status:'READY'},{id:'b',code:'RT002',name:'ตู้สูง',status:'DRAFT'},{id:'c',code:'RT003',name:'ตู้เตี้ยเก่า',status:'READY',is_active:false},{id:'d',code:'RT004',name:'ท็อปหิน',status:'RETIRED'}];
 assert.deepEqual(filterReadyRates(rates,'  rT001 ').map(r=>r.id),['a']);
 assert.deepEqual(filterReadyRates(rates,'ตู้').map(r=>r.id),['a']);
 assert.deepEqual(filterReadyRates(rates,'ไม่มี'),[]);
 const tables={projects:[{id:'p1'},{id:'p2'}],work_items:[{id:'B01',project_id:'p1'}]};
 assert.equal(validWorkContext(tables,{project_id:'p1',work_id:'B01'}),true);
 assert.equal(validWorkContext(tables,{project_id:'p2',work_id:'B01'}),false);
 assert.equal(validWorkContext({...tables,work_items:[]},{project_id:'p1',work_id:'B01'}),false);
 assert.equal(validWorkContext(tables,null),false);
});
