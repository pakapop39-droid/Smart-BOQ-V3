import fs from 'node:fs';import assert from 'node:assert/strict';import {createClient} from '@insforge/sdk';import {parse} from 'dotenv';
const env=parse(fs.readFileSync('.env.local'));const url=env.NEXT_PUBLIC_INSFORGE_URL;
if(url!=='https://vtqfp9z6.ap-southeast.insforge.app')throw Error('Refusing non-test endpoint');
const client=createClient({baseUrl:url,anonKey:env.NEXT_PUBLIC_INSFORGE_ANON_KEY});
const result=[];
for(const [name,fn]of [
 ['anonymous catalog read',()=>client.database.from('cost_resources').select('resource_id').limit(1)],
 ['anonymous export',()=>client.database.rpc('boq_catalog_export')],
 ['anonymous private tenant helper',()=>client.database.rpc('boq_catalog_preview_for',{tenant:'11111111-1111-4111-8111-111111111111',rows_data:[]})],
 ['anonymous test harness',()=>client.database.rpc('boq_test_catalog')]
]){const r=await fn();assert.ok(r.error,`${name} must be rejected`);result.push({test:name,rejected:true,code:r.error.code??null});}
fs.writeFileSync('artifacts/anonymous-check.json',JSON.stringify({endpoint:url,tests:result,status:'PASS'},null,2));console.log(JSON.stringify(result));
