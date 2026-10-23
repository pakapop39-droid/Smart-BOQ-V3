import test from 'node:test';
import assert from 'node:assert/strict';
import {workSetPriceSummary} from '../web/work-set-price-summary.mjs';
const component={quantity:'3.50',unit:'เมตร',cost_total:'15133.56',cost_per_unit:'4323.873015873',sale_per_unit:'7206.46',direct_cost_raw:'0',group_totals:[{id:'body',active:true,cost_raw:'13133.55555555555555555555'}]};
test('group selling-unit cost uses raw group cost and S001 meters, separate from whole-cabinet sale',()=>{
 const s=workSetPriceSummary(component,'body');
 assert.equal(s.total,'13133.56');assert.equal(s.perUnit,'3752.44');assert.equal(s.salePerUnit,'7206.46');
 assert.equal(workSetPriceSummary({...component,quantity:'7'},'body').perUnit,'1876.22');
 assert.equal(workSetPriceSummary({...component,quantity:'3',group_totals:[{id:'body',active:true,cost_raw:'1.004'}]},'body').perUnit,'0.33');
});
test('pending or disabled group has no misleading zero unit price; valid direct zero is retained',()=>{
 assert.equal(workSetPriceSummary(null,'body'),null);
 assert.equal(workSetPriceSummary({...component,group_totals:[{id:'body',active:false,cost_raw:null}]},'body'),null);
 assert.equal(workSetPriceSummary(component,'direct').perUnit,'0.00');
});
