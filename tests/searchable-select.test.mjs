import test from 'node:test';
import assert from 'node:assert/strict';
import {filterSelectOptions} from '../web/searchable-select.mjs';
const choices=[{value:'',text:'— เลือก —'},{value:'lm',text:'LM01 · ลามิเนต A'},{value:'ply',text:'PLY01 · ไม้อัด'},{value:'lb',text:'LB01 · ค่าแรงผลิตตู้'}];
test('resource search matches code and Thai name, trims input and preserves original options',()=>{
 const before=structuredClone(choices);
 assert.deepEqual(filterSelectOptions(choices,' lm01 ').matches.map(o=>o.value),['lm']);
 assert.deepEqual(filterSelectOptions(choices,'ค่าแรง').matches.map(o=>o.value),['lb']);
 assert.equal(filterSelectOptions(choices,'').matches.length,3);
 assert.deepEqual(choices,before);
});
test('no results or a different search never discards the chosen cost resource',()=>{
 const result=filterSelectOptions(choices,'ไม่มี','lm');
 assert.equal(result.matches.length,0);assert.equal(result.retained.value,'lm');
 assert.equal(filterSelectOptions(choices,'ลามิเนต','lm').retained,null);
 assert.equal(filterSelectOptions(choices,'ไม่มี','').retained,null);
});
