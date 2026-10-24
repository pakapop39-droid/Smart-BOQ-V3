import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalStore} from '../local/store.mjs';

const setup=t=>{const s=new LocalStore(':memory:');t.after(()=>s.close());const p=s.sampleProject();return {s,p};};
const defaults={name:'กลุ่มวัตถุดิบต้นทุน',assembly_kind:'OTHER',sourcing_method:'MAKE',calculation_method:'MANUAL',area:'',quantity:'1',plySides:'2',lamSides:'2',is_active:true};
const projectGroup=(s,p,c,patch={})=>s.save('component_groups',{...defaults,component_id:c.id,...patch,project_version:s.get('projects',p.id).version});
const template=s=>s.save('rate_templates',{company_id:s.company.id,category_id:s.all('work_categories')[0].id,unit_id:s.all('units')[0].id,name:'รายการกลาง',margin:'40'});
const rateGroup=(s,t,patch={})=>s.save('rate_template_groups',{...defaults,template_id:t.id,...patch});

test('project group codes are automatic per component, ignore supplied new codes and preserve existing codes on rename',t=>{
 const {s,p}=setup(t),components=s.all('work_components'),c=components.find(c=>c.code==='S004'),other=components.find(c=>c.code==='S003');
 const a=projectGroup(s,p,c,{code:'USER-CODE',name:'โครงตู้'}),b=projectGroup(s,p,c,{name:'หน้าบาน'});
 assert.equal(a.code,'G001');assert.equal(b.code,'G002');assert.equal(projectGroup(s,p,other).code,'G001');
 const edited=projectGroup(s,p,c,{...a,code:'RENUMBER',name:'โครงตู้ใหม่'});assert.equal(edited.code,'G001');assert.equal(edited.name,'โครงตู้ใหม่');
 const legacy=s.all('component_groups').find(g=>g.code==='BODY'),owner=s.get('work_components',legacy.component_id);assert.equal(projectGroup(s,p,owner,{...legacy,code:'G999',name:'กลุ่มเดิมเปลี่ยนชื่อ'}).code,'BODY');
 const before=s.state();assert.throws(()=>projectGroup(s,p,c,{...a,name:'stale'}),/ข้อมูลใหม่/);assert.deepEqual(s.state(),before);
});

test('project group sequence scans inactive legacy codes and persists the highest code before deleting it',t=>{
 const {s,p}=setup(t),c=s.all('work_components').find(c=>c.code==='S004');
 const legacy=s.put('component_groups',{...defaults,component_id:c.id,code:'G088',is_active:false});
 s.remove('component_groups',legacy.id,legacy.version,s.get('projects',p.id).version);
 assert.equal(s.get('work_components',c.id).group_code_sequence,88);assert.equal(projectGroup(s,p,c).code,'G089');
 const last=projectGroup(s,p,c);s.remove('component_groups',last.id,last.version,s.get('projects',p.id).version);assert.equal(projectGroup(s,p,c).code,'G091');
});

test('template group codes are automatic per template, edits preserve identity, and delete does not reset the counter',t=>{
 const {s}=setup(t),a=template(s),b=template(s),first=rateGroup(s,a,{code:'BODY'}),second=rateGroup(s,a);
 assert.equal(first.code,'G001');assert.equal(second.code,'G002');assert.equal(rateGroup(s,b).code,'G001');
 assert.equal(rateGroup(s,a,{...first,code:'G999',name:'แก้ชื่อ'}).code,'G001');assert.equal(s.get('rate_templates',a.id).group_code_sequence,2);
 const legacy=s.put('rate_template_groups',{...defaults,template_id:a.id,code:'G050',is_active:false});s.remove('rate_template_groups',legacy.id,legacy.version);
 assert.equal(s.get('rate_templates',a.id).group_code_sequence,50);assert.equal(rateGroup(s,a).code,'G051');
});

test('invalid project and template groups roll back allocated numbers and parent versions',t=>{
 const {s,p}=setup(t),c=s.all('work_components').find(c=>c.code==='S004'),r=template(s);
 const before=s.state();assert.throws(()=>projectGroup(s,p,c,{name:''}),/ให้ครบ/);assert.deepEqual(s.state(),before);assert.equal(projectGroup(s,p,c).code,'G001');
 const rateBefore=s.state();assert.throws(()=>rateGroup(s,r,{area:'bad'}),/ตัวเลข/);assert.deepEqual(s.state(),rateBefore);assert.equal(rateGroup(s,r).code,'G001');
 const other=template(s),group=rateGroup(s,r),snapshot=s.state();assert.throws(()=>rateGroup(s,other,{...group,template_id:other.id}),/ข้ามต้นแบบ/);assert.deepEqual(s.state(),snapshot);
 const ready=s.put('rate_templates',{...s.get('rate_templates',r.id),status:'READY'},r.id),locked=s.state();assert.throws(()=>rateGroup(s,ready),/รุ่นใหม่/);assert.deepEqual(s.state(),locked);
});

test('failed group deletions with child rows roll back sequence metadata as well as the deletion',t=>{
 const {s,p}=setup(t),group=s.all('component_groups').find(g=>g.code==='BODY'),legacy=s.put('component_groups',{...group,code:'G100'},group.id),before=s.state();
 assert.throws(()=>s.remove('component_groups',legacy.id,legacy.version,s.get('projects',p.id).version));assert.deepEqual(s.state(),before);
 const r=template(s),g=rateGroup(s,r),resource=s.all('cost_resources').find(r=>r.code==='LM01');
 s.save('rate_template_cost_lines',{template_id:r.id,group_id:g.id,resource_id:resource.id,numerator:'1',denominator:'1',waste:'0',line_role:'OTHER',quantity_source:'MANUAL'});
 const legacyRate=s.put('rate_template_groups',{...g,code:'G200'},g.id),snapshot=s.state();assert.throws(()=>s.remove('rate_template_groups',legacyRate.id,legacyRate.version));assert.deepEqual(s.state(),snapshot);
});

test('project and template group sequence survives reopening and 24-table backup restore without a new table',t=>{
 const dir=mkdtempSync(join(tmpdir(),'smart-boq-group-codes-')),path=join(dir,'local.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));let s=new LocalStore(path),p=s.sampleProject(),c=s.all('work_components').find(c=>c.code==='S004'),r=template(s),g=projectGroup(s,p,c),rg=rateGroup(s,r);
 s.remove('component_groups',g.id,g.version,s.get('projects',p.id).version);s.remove('rate_template_groups',rg.id,rg.version);s.close();
 s=new LocalStore(path);assert.equal(projectGroup(s,p,c).code,'G002');assert.equal(rateGroup(s,r).code,'G002');
 const backup={format:'SMART_BOQ_LOCAL_24_V1',...s.state()},copy=new LocalStore(':memory:');copy.restore(backup);assert.equal(projectGroup(copy,p,c).code,'G003');assert.equal(rateGroup(copy,r).code,'G003');assert.equal(Object.keys(copy.state().tables).length,24);copy.close();s.close();
});

test('oversized counters and foreign company group owners reject atomically',t=>{
 const {s,p}=setup(t),c=s.all('work_components').find(c=>c.code==='S004');s.put('work_components',{...c,group_code_sequence:Number.MAX_SAFE_INTEGER},c.id);const before=s.state();assert.throws(()=>projectGroup(s,p,c),/เกินขอบเขต/);assert.deepEqual(s.state(),before);
 const otherCompany=s.put('companies',{code:'FOREIGN',name:'นอกบริษัท'}),foreign=s.put('rate_templates',{...template(s),id:undefined,company_id:otherCompany.id,code:'FOREIGN-RATE'}),snapshot=s.state();assert.throws(()=>rateGroup(s,foreign),/คนละบริษัท/);assert.deepEqual(s.state(),snapshot);
});
