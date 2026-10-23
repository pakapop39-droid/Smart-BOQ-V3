import fs from 'node:fs';import assert from 'node:assert/strict';import {createClient} from '@insforge/sdk';
import {backendUrl,anonKey} from '../web/public-config.mjs';import {resources,buildB01Payload} from '../web/fixtures.mjs';
if(backendUrl!=='https://vtqfp9z6.ap-southeast.insforge.app')throw Error('Wrong target');
const client=createClient({baseUrl:backendUrl,anonKey});const results=[];
for(const [method,cost,sale,budget]of [['CUSTOM','45623.47','76039.10','31380.00'],['VS_MODULAR','55748.47','92914.10','43180.00']]){
 const payload=buildB01Payload({method,area:'5.04',quantity:'3.50',margin:'40',stoneQuantity:'2.10',stoneMargin:'40',wallQuantity:'6',wallMargin:'40',sinkQuantity:'1',sinkMargin:'40'});
 const {data,error}=await client.database.rpc('boq_trial_calculate',{payload});if(error)throw Error(error.message);assert.equal(data.cost_total,cost);assert.equal(data.sale_total,sale);assert.equal(data.material_purchase_budget,budget);assert.equal(data.persisted,false);assert.equal(data.components.length,4);assert.equal(data.components[1].code,'S002');assert.equal(data.components[1].unit,'ตร.ม.');assert.equal(data.components[1].cost_total,'6300.00');assert.equal(data.components[1].sale_total,'10500.00');assert.equal(data.components[0].sale_total,method==='CUSTOM'?'30333.35':'47208.35');results.push({method,cost:data.cost_total,sale:data.sale_total,budget:data.material_purchase_budget,status:'PASS'});
 payload.components[0].margin='100';const bad=await client.database.rpc('boq_trial_calculate',{payload});assert.ok(bad.error);results.push({test:'reject margin 100',method,status:'PASS'});
}
fs.writeFileSync('artifacts/trial-api-tests.json',JSON.stringify({tests:results,status:'PASS',authenticatedImportEnabled:false},null,2));console.log(JSON.stringify(results));
