import {randomUUID} from 'node:crypto';
import Decimal from 'decimal.js';
import {entities} from './schema.mjs';
const D=Decimal.clone({precision:80});
const fail=m=>{throw Error(m);};
const decimal=(v,label,positive=false)=>{if(typeof v!=='string'||!/^\d+(\.\d{1,8})?$/.test(v)||positive&&new D(v).lte(0))fail('กรอก '+label+' เป็นตัวเลข'+(positive?'มากกว่า 0':''));return new D(v);};
const product=(a,b)=>{const n=new D(a).mul(b);if(n.decimalPlaces()>6)fail('พื้นที่/จำนวนรวมมีทศนิยมเกิน 6 ตำแหน่ง กรุณาปรับอัตราหรือปริมาณ');return n.toFixed();};
const children=['rate_template_groups','rate_template_cost_lines','rate_template_coverages'];
export const rateMethods={
 cloneRate({id,version,name}){return this.tx(()=>{
  const old=this.get('rate_templates',id);
  if(old.company_id!==this.company.id||old.version!==version)fail('ต้นแบบเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด');
  name=String(name??'').normalize('NFC').trim();if(!name||name.length>200)fail('กรอกชื่อรายการใหม่ไม่เกิน 200 ตัวอักษร');
  const {id:ignored,version:ignoredVersion,created_at,updated_at,unit_cost,unit_sale,...data}=old;
  const root=this.put('rate_templates',{...data,code:this.nextRateCode(),name,revision:'1',status:'DRAFT',is_active:true,cloned_from_template_id:id});
  this.validateRate('rate_templates',root);
  const gm=new Map(),lm=new Map();
  for(const g of this.all('rate_template_groups').filter(g=>g.template_id===id)){
   const copy=this.put('rate_template_groups',{...g,id:undefined,template_id:root.id});gm.set(g.id,copy.id);
  }
  const lines=this.all('rate_template_cost_lines').filter(l=>l.template_id===id);
  for(const l of lines)lm.set(l.id,randomUUID());
  let pending=[...lines];const written=new Set();
  while(pending.length){const batch=pending.filter(l=>!l.parent_id||written.has(l.parent_id));if(!batch.length)fail('ความสัมพันธ์ส่วนประกอบไม่ครบ ไม่สามารถทำสำเนาได้');
   for(const l of batch){if(l.group_id&&!gm.has(l.group_id)||l.origin_excluded_id&&!lm.has(l.origin_excluded_id))fail('บรรทัดต้นทุนอ้างอิงอยู่นอกต้นแบบ');
    this.put('rate_template_cost_lines',{...l,template_id:root.id,group_id:gm.get(l.group_id)||null,parent_id:lm.get(l.parent_id)||null,origin_excluded_id:lm.get(l.origin_excluded_id)||null},lm.get(l.id));written.add(l.id);
   }pending=pending.filter(l=>!written.has(l.id));
  }
  for(const v of this.all('rate_template_coverages').filter(v=>v.template_id===id)){
   if(!lm.has(v.cost_line_id)||v.group_id&&!gm.has(v.group_id))fail('ขอบเขตต้นทุนอ้างอิงไม่ครบ');
   this.put('rate_template_coverages',{...v,id:undefined,template_id:root.id,cost_line_id:lm.get(v.cost_line_id),group_id:gm.get(v.group_id)||null});
  }
  return root;
 });},
 deleteRateCosts({template_id,template_version,group_id=null,lines}){return this.tx(()=>{
  const t=this.get('rate_templates',template_id);if(t.company_id!==this.company.id||t.status!=='DRAFT'||t.version!==template_version)fail('ต้นแบบเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด');
  if(!Array.isArray(lines)||!lines.length||new Set(lines.map(l=>l.id)).size!==lines.length)fail('เลือกรายการต้นทุนก่อน');
  const roots=lines.map(l=>{const row=this.get('rate_template_cost_lines',l.id);if(row.template_id!==t.id||(row.group_id||null)!==(group_id||null)||row.version!==l.version||row.line_kind!=='CHARGEABLE'||row.parent_id||group_id&&row.variant!==this.get('rate_template_groups',group_id).sourcing_method)fail('รายการที่เลือกเปลี่ยนแล้วหรืออยู่คนละกลุ่ม');return row;});
  const ids=new Set(roots.map(l=>l.id)),deleted=this.all('rate_template_cost_lines').filter(l=>ids.has(l.id)||ids.has(l.parent_id)),allIds=new Set(deleted.map(l=>l.id)),coverages=this.all('rate_template_coverages').filter(c=>allIds.has(c.cost_line_id));
  const affected=this.all('rate_template_cost_lines').filter(l=>l.template_id===t.id&&!allIds.has(l.id)&&(roots.some(r=>r.origin_excluded_id===l.id)||allIds.has(l.origin_excluded_id)));
  for(const l of affected)this.put('rate_template_cost_lines',{...l,...(l.line_kind==='EXCLUDED_REFERENCE'?{resolution:'PENDING'}:{origin_excluded_id:null})},l.id);
  for(const c of coverages)this.db.prepare('DELETE FROM rate_template_coverages WHERE id=?').run(c.id);
  for(const l of [...deleted.filter(l=>l.parent_id),...roots])this.db.prepare('DELETE FROM rate_template_cost_lines WHERE id=?').run(l.id);
  const owner=this.put('rate_templates',t,t.id),company=this.get('companies',this.company.id),journal=company.rate_cost_undo??[];
  this.put('companies',{...company,rate_cost_undo:[...journal.slice(-19),{id:randomUUID(),template_id:t.id,company_id:company.id,expected_version:owner.version,lines:deleted,coverages,affected,used:false,label:'ลบต้นทุน '+roots.length+' รายการ'}]},company.id);return {ok:true,deleted:roots.length};
 });},
 undoRateCosts({template_id,template_version}){return this.tx(()=>{
  const t=this.get('rate_templates',template_id),company=this.get('companies',this.company.id),journal=company.rate_cost_undo??[],command=journal.findLast(c=>c.template_id===t.id&&!c.used);
  if(t.company_id!==company.id||t.status!=='DRAFT'||t.version!==template_version||!command||command.company_id!==company.id||command.expected_version!==t.version)fail('ข้อมูลเปลี่ยนหลังลบแล้ว ไม่สามารถเลิกทำทับข้อมูลใหม่ได้');
  if(!Array.isArray(command.lines)||!Array.isArray(command.coverages)||!Array.isArray(command.affected))fail('ประวัติเลิกทำไม่ครบ');
  const ids=new Set(command.lines.map(l=>l.id));for(const l of [...command.lines,...command.affected]){if(l.template_id!==t.id||l.group_id&&this.get('rate_template_groups',l.group_id).template_id!==t.id||l.parent_id&&!ids.has(l.parent_id))fail('ประวัติเลิกทำอยู่คนละต้นแบบ');}
  for(const c of command.coverages)if(c.template_id!==t.id||!ids.has(c.cost_line_id))fail('ประวัติขอบเขตไม่ตรงต้นแบบ');
  for(const l of [...command.lines.filter(l=>!l.parent_id),...command.lines.filter(l=>l.parent_id)])this.restoreDeletedRow('rate_template_cost_lines',{...l,is_active:true});
  for(const c of command.coverages)this.restoreDeletedRow('rate_template_coverages',c);
  for(const l of command.affected)this.put('rate_template_cost_lines',l,l.id);
  for(const l of command.lines)this.validateRate('rate_template_cost_lines',this.get('rate_template_cost_lines',l.id),l);
  for(const c of command.coverages)this.validateRate('rate_template_coverages',this.get('rate_template_coverages',c.id),c);
  this.put('rate_templates',t,t.id);this.put('companies',{...company,rate_cost_undo:journal.map(c=>c.id===command.id?{...c,used:true}:c)},company.id);return {ok:true};
 });},
 previewRateDraft({table,data}){return this.tx(()=>{if(!['rate_templates','rate_template_groups','rate_template_cost_lines','rate_template_coverages'].includes(table))fail('ชนิดรายการตรวจร่างไม่ถูกต้อง');this.db.exec('SAVEPOINT ui_rate_draft');try{const saved=this.saveRate(table,data),owner=this.rateOwner(table,saved);return this.previewRate(owner.id);}finally{this.db.exec('ROLLBACK TO ui_rate_draft; RELEASE ui_rate_draft');}});},
 rateOwner(t,r){return t==='rate_templates'?r:this.get('rate_templates',r.template_id);},
 validateRate(t,r,old){
  const owner=this.rateOwner(t,r);if(owner.company_id!==this.company.id)fail('ต้นแบบอยู่คนละบริษัท');
  if(old&&t!=='rate_templates'&&r.template_id!==old.template_id)fail('ไม่ย้ายรายการข้ามต้นแบบ');
  if(t==='rate_templates'){if(!/^\d+$/.test(r.revision)||Number(r.revision)<1)fail('รุ่นต้องเป็นจำนวนเต็มมากกว่า 0');if(decimal(r.margin,'กำไร').gte(100))fail('กำไรต้องต่ำกว่า 100%');if(this.all('rate_templates').some(t=>t.id!==r.id&&t.company_id===r.company_id&&t.code===r.code&&t.status==='READY'&&t.unit_id!==r.unit_id))fail('เปลี่ยนหน่วยให้สร้างรหัสคลังใหม่');if(this.get('work_categories',r.category_id).company_id!==r.company_id)fail('หมวดงานคนละบริษัท');}
  if(r.group_id&&this.get('rate_template_groups',r.group_id).template_id!==owner.id)fail('กลุ่มอยู่คนละต้นแบบ');
  if(t==='rate_template_groups'){if(r.area!=='')decimal(r.area,'พื้นที่แผง');if(Number(r.lamSides??0)>Number(r.plySides??2))fail('ด้านปิดผิวต้องไม่เกินด้านบุไม้อัด');if(r.quantity!=='')decimal(r.quantity,'จำนวนชุด');}
  if(t==='rate_template_cost_lines'){
   if(this.get('cost_resources',r.resource_id).company_id!==owner.company_id)fail('วัสดุคนละบริษัท');
   if(r.parent_id){const p=this.get(t,r.parent_id);if(p.template_id!==owner.id||p.group_id!==r.group_id||p.snapshot?.resourceKind!=='BUNDLE'||p.line_kind!=='CHARGEABLE')fail('ชุดแม่ไม่ถูกต้อง');}
   if(r.numerator!=='')decimal(r.numerator,'อัตรา');decimal(r.denominator,'ตัวหาร',true);decimal(r.waste,'เผื่อเศษ');if(r.price!==''&&r.price!=null)decimal(r.price,'ราคา');
   if(!r.snapshot||!r.line_kind)fail('ต้นทุนขาด snapshot');
  }
  if(t==='rate_template_coverages'){const l=this.get('rate_template_cost_lines',r.cost_line_id);if(l.template_id!==owner.id||l.line_kind!=='CHARGEABLE'||(l.group_id??null)!==(r.group_id||null))fail('ขอบเขตไม่ตรงบรรทัดต้นแบบ');if(this.get('cost_groups',r.cost_group_id).company_id!==owner.company_id)fail('ขอบเขตคนละบริษัท');}
 },
 nextRateCode(){
  const company=this.get('companies',this.company.id);let highest=Number(company.rate_code_sequence??0);
  for(const t of this.all('rate_templates').filter(t=>t.company_id===company.id)){const match=/^RT(\d+)$/.exec(t.code??'');if(match)highest=Math.max(highest,Number(match[1]));}
  const next=highest+1;if(!Number.isSafeInteger(next))fail('ลำดับรหัสต้นแบบเกินขอบเขตที่รองรับ');
  this.put('companies',{...company,rate_code_sequence:next},company.id);return 'RT'+String(next).padStart(3,'0');
 },
 saveRate(t,input){return this.tx(()=>{
  const old=input.id?this.get(t,input.id):null;if(old&&old.version!==input.version)fail('รายการเปลี่ยนแล้ว กรุณาโหลดใหม่');
  const allowed=[...Object.keys(entities[t].fields),...Object.keys(entities[t].refs??{}),'is_active'];
  const r={...(old??{}),...Object.fromEntries(Object.entries(input).filter(([k])=>allowed.includes(k))),id:old?.id??randomUUID()};
  for(const k of ['group_id','parent_id'])if(k in r&&!r[k])r[k]=null;for(const k of ['name','code'])if(typeof r[k]==='string')r[k]=r[k].normalize('NFC').trim();
  const owner=t==='rate_templates'?old:this.rateOwner(t,r);if(owner&&owner.status!=='DRAFT')fail('รุ่นนี้พร้อมใช้แล้ว ให้สร้างรุ่นใหม่ก่อนแก้ไข');
  if(t==='rate_templates'){r.code=old?old.code:this.nextRateCode();r.revision=old?old.revision:'1';r.status='DRAFT';r.is_active=r.is_active!==false;}
  if(t==='rate_template_cost_lines'){
   if(old?.line_kind!=='CHARGEABLE'&&old)fail('รายละเอียดรวมในชุดแก้ราคาแยกไม่ได้');
   if(old&&(old.resource_id!==r.resource_id||(old.group_id||null)!==(r.group_id||null)||(old.parent_id||null)!==(r.parent_id||null)))fail('เปลี่ยนเจ้าของ/วัสดุเดิมไม่ได้ ให้เพิ่มบรรทัดใหม่');
   const resource=this.get('cost_resources',r.resource_id);r.snapshot=old?.snapshot??this.snapshot(resource);r.price=r.price??r.snapshot.price??'';r.line_kind='CHARGEABLE';r.basis=r.quantity_source==='MANUAL'?'PER_UNIT':'TOTAL';r.variant=r.group_id?this.get('rate_template_groups',r.group_id).sourcing_method:null;
  }
  if(t==='rate_template_cost_lines')r.is_active=true;
  if(t==='rate_template_groups')this.prepareGroupCode(t,r,old);this.validate(t,r,old);const saved=this.put(t,r,r.id);
  if(t==='rate_template_cost_lines'&&!old&&r.snapshot.resourceKind==='BUNDLE')this.expandRateBundle(saved);
  if(t!=='rate_templates'){const root=this.get('rate_templates',r.template_id);this.put('rate_templates',root,root.id);}return saved;
 });},
 expandRateBundle(root){
  const resource=this.get('cost_resources',root.resource_id),parts=this.all('resource_bundle_items').filter(x=>x.bundle_resource_id===resource.id&&x.is_active!==false);
  const snapshot={resourceId:resource.id,version:resource.version,coveredScopes:(resource.covered_scopes??'').split(',').map(s=>s.trim()).filter(Boolean),items:parts.map(p=>({childCode:this.get('cost_resources',p.child_resource_id).code,inclusionStatus:p.inclusion_status,quantity:p.quantity||null,scopeKey:p.scope_key})),sourceReference:resource.notes??''};
  this.put('rate_template_cost_lines',{...root,bundle_snapshot:snapshot},root.id);
  for(const part of parts){const child=this.get('cost_resources',part.child_resource_id);this.put('rate_template_cost_lines',{...root,id:undefined,resource_id:child.id,parent_id:root.id,line_kind:part.inclusion_status==='INCLUDED'?'INCLUDED_REFERENCE':'EXCLUDED_REFERENCE',snapshot:this.snapshot(child),bundle_snapshot:null,price:null,numerator:'',quantity_source:'PARENT_BUNDLE_USAGE',quantity_per_parent:part.quantity||null,inclusion:part.inclusion_status,resolution:'PENDING',line_role:'OTHER'});}
  for(const scope of snapshot.coveredScopes){let g=this.all('cost_groups').find(x=>x.company_id===this.company.id&&x.code===scope);if(!g)g=this.put('cost_groups',{company_id:this.company.id,code:scope,name:scope,is_active:true});this.put('rate_template_coverages',{template_id:root.template_id,cost_line_id:root.id,group_id:root.group_id||null,cost_group_id:g.id,scope_key:scope,mode:'BUNDLED'});}
 },
 importRate(input,preview=false){return this.tx(()=>{
  const template=this.get('rate_templates',input.template_id);if(template.company_id!==this.company.id||!preview&&(template.status!=='READY'||template.is_active===false))fail('เลือกต้นแบบที่พร้อมใช้เท่านั้น');
  if(input.template_version!==template.version)fail('ต้นแบบเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด');
  const work=this.get('work_items',input.work_item_id);this.context('work_items',work,input.project_version);decimal(input.quantity,'ปริมาณขาย',true);
  const c=this.save('work_components',{work_item_id:work.id,category_id:template.category_id,unit_id:template.unit_id,name:template.name,quantity:input.quantity,margin:template.margin,is_active:true,project_version:input.project_version});
  this.put('work_components',{...c,source_template_id:template.id,source_template_code:template.code,source_template_revision:template.revision,source_template_version:template.version,quotation_description:template.quotation_description??'',is_customized:false,imported_at:new Date().toISOString()},c.id);
  const gm=new Map(),lm=new Map();
  for(const g of this.all('rate_template_groups').filter(g=>g.template_id===template.id)){const x=this.put('component_groups',{...g,id:undefined,template_id:undefined,component_id:c.id,source_template_group_id:g.id,rate_area:g.area,rate_quantity:g.quantity,rate_basis:true,area:g.area?product(g.area,input.quantity):'',quantity:g.quantity?product(g.quantity,input.quantity):'',});gm.set(g.id,x.id);}
  const source=this.all('rate_template_cost_lines').filter(l=>l.template_id===template.id);
  for(const l of source)lm.set(l.id,randomUUID());
  // Parents first; the referenced snapshot is the saved template revision, not today's catalog bundle.
  for(const l of [...source.filter(l=>!l.parent_id),...source.filter(l=>l.parent_id)]){const pr=this.selectResource(work.project_id,this.get('cost_resources',l.resource_id));this.put('component_cost_lines',{...l,id:lm.get(l.id),template_id:undefined,resource_id:undefined,component_id:c.id,project_resource_id:pr.id,group_id:gm.get(l.group_id)||null,parent_id:lm.get(l.parent_id)||null,source_template_line_id:l.id,origin_excluded_id:lm.get(l.origin_excluded_id)||null,additional_confirmation:null,...(l.line_kind==='CHARGEABLE'&&l.snapshot.resourceKind==='BUNDLE'&&l.quantity_source==='MANUAL'?{basis:'TOTAL',rate_numerator:l.numerator,numerator:product(l.numerator,input.quantity)}:{})},lm.get(l.id));}
  for(const v of this.all('rate_template_coverages').filter(v=>v.template_id===template.id))this.put('cost_line_coverages',{...v,id:undefined,template_id:undefined,cost_line_id:lm.get(v.cost_line_id),group_id:gm.get(v.group_id)||null,source_template_coverage_id:v.id});
  for(const l of this.all('component_cost_lines').filter(l=>l.component_id===c.id&&l.additional_reason?.trim()&&l.additional_location?.trim()))if(preview)this.put('component_cost_lines',{...l,additional_confirmation:{at:new Date().toISOString(),actor:this.member.id,signature:this.extraSignature(l)}},l.id);
  return this.get('work_components',c.id);
 });},
 previewRate(id){return this.tx(()=>{this.db.exec('SAVEPOINT rate_preview');try{
  const t=this.get('rate_templates',id),p=this.put('projects',{company_id:this.company.id,member_id:this.member.id,code:'PREVIEW-'+randomUUID(),name:'ตรวจต้นแบบ',status:'DRAFT'}),a=this.put('areas',{project_id:p.id,code:'PREVIEW',name:'ตรวจ'}),w=this.put('work_items',{project_id:p.id,area_id:a.id,code:'PREVIEW',name:'ตรวจ'});
  this.importRate({template_id:t.id,template_version:t.version,work_item_id:w.id,quantity:'1',project_version:p.version},true);const result=this.calculate(p.id);const sources=new Map(this.all('component_cost_lines').map(l=>[l.id,l.source_template_line_id]));const groups=new Map(this.all('component_groups').map(g=>[g.id,g.source_template_group_id]));for(const c of [...result.components,...(result.result?.components??[])]){for(const l of c.lines)l.templateLineId=sources.get(l.costLineId);for(const g of c.group_totals??[])g.templateGroupId=groups.get(g.id);}return result;
 }finally{this.db.exec('ROLLBACK TO rate_preview; RELEASE rate_preview');}});},
 resolveRateReference(input){return this.tx(()=>{const l=this.get('rate_template_cost_lines',input.id),t=this.get('rate_templates',l.template_id);if(t.status!=='DRAFT'||t.version!==input.template_version)fail('ต้นแบบเปลี่ยนแล้ว หรือพร้อมใช้แล้ว');if(l.line_kind!=='EXCLUDED_REFERENCE'||l.inclusion==='UNKNOWN')fail('ขอบเขตยังไม่ทราบ ต้องตรวจข้อมูลสินค้าชุดก่อน');if(input.decision==='NOT_REQUIRED')this.put('rate_template_cost_lines',{...l,resolution:'NOT_REQUIRED'},l.id);else if(input.decision==='ADD'){if(this.all('rate_template_cost_lines').some(x=>x.origin_excluded_id===l.id))fail('เพิ่มบรรทัดจริงแล้ว');this.put('rate_template_cost_lines',{...l,id:undefined,parent_id:null,line_kind:'CHARGEABLE',quantity_source:'MANUAL',basis:'PER_UNIT',numerator:'',price:l.snapshot.price??'',origin_excluded_id:l.id,resolution:null});this.put('rate_template_cost_lines',{...l,resolution:'ADDED'},l.id);}else fail('เลือกเพิ่มหรือไม่ต้องใช้');this.put('rate_templates',t,t.id);return {ok:true};});},
 publishRate(id,version){return this.tx(()=>{const t=this.get('rate_templates',id);if(t.status!=='DRAFT'||t.version!==version)fail('ต้นแบบเปลี่ยนแล้ว หรือพร้อมใช้แล้ว');const checked=this.previewRate(id);if(!checked.result)fail(checked.errors.map(e=>e.error).join(' / ')||'ต้นทุนไม่ครบ');return this.put('rate_templates',{...t,status:'READY',unit_cost:checked.result.components[0].cost_total,unit_sale:checked.result.components[0].sale_per_unit},id);});},
 captureRate(input){return this.tx(()=>{
  const c=this.get('work_components',input.component_id);this.context('work_components',c,input.project_version);if(c.version!==input.component_version)fail('รายการเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด');
  decimal(c.quantity,'ปริมาณขายต้นทาง',true);const name=String(input.name??c.name).trim();
  const root=this.saveRate('rate_templates',{company_id:this.company.id,category_id:c.category_id,unit_id:c.unit_id,name,revision:'1',margin:c.margin,quotation_description:c.quotation_description??'',is_active:true});
  const notes=[];const divide=(value,label)=>{if(value===''||value==null)return '';const exact=new D(value).div(c.quantity),rounded=exact.toDecimalPlaces(6,D.ROUND_HALF_UP);if(!exact.eq(rounded))notes.push(label+' หารด้วย '+c.quantity+' และปัดอัตรา 6 ตำแหน่ง กรุณาตรวจ');return rounded.toFixed();};
  const gm=new Map(),lm=new Map();
  for(const g of this.all('component_groups').filter(g=>g.component_id===c.id)){
   const fields=Object.keys(entities.rate_template_groups.fields);const r=Object.fromEntries(fields.map(k=>[k,g[k]]));const n=this.put('rate_template_groups',{...r,template_id:root.id,area:divide(g.area,g.name+' พื้นที่แผง'),quantity:divide(g.quantity,g.name+' จำนวนชุด'),is_active:g.is_active!==false});gm.set(g.id,n.id);
  }
  const lines=this.all('component_cost_lines').filter(l=>l.component_id===c.id);for(const l of lines)lm.set(l.id,randomUUID());
  for(const l of [...lines.filter(l=>!l.parent_id),...lines.filter(l=>l.parent_id)]){
   const pr=this.get('project_resources',l.project_resource_id),fields=Object.keys(entities.rate_template_cost_lines.fields),r=Object.fromEntries(fields.map(k=>[k,l[k]]));
   if(l.line_kind==='CHARGEABLE'&&l.quantity_source==='MANUAL'&&l.basis==='TOTAL'){
    const denominator=new D(l.denominator).mul(c.quantity);if(denominator.decimalPlaces()>8)fail('ตัวหารอัตราเกิน 8 ตำแหน่ง กรุณาปรับตัวหารต้นทางก่อน');r.denominator=denominator.toFixed();
   }
   this.put('rate_template_cost_lines',{...r,template_id:root.id,resource_id:pr.resource_id,group_id:gm.get(l.group_id)||null,parent_id:lm.get(l.parent_id)||null,origin_excluded_id:lm.get(l.origin_excluded_id)||null,line_kind:l.line_kind,variant:l.variant,snapshot:structuredClone(l.snapshot),bundle_snapshot:l.bundle_snapshot?structuredClone(l.bundle_snapshot):null,quantity_per_parent:l.quantity_per_parent??null,inclusion:l.inclusion??null,resolution:l.resolution??null,basis:l.quantity_source==='MANUAL'?'PER_UNIT':'TOTAL',is_active:l.is_active!==false},lm.get(l.id));
  }
  for(const v of this.all('cost_line_coverages').filter(v=>lm.has(v.cost_line_id)))this.put('rate_template_coverages',{template_id:root.id,cost_line_id:lm.get(v.cost_line_id),group_id:gm.get(v.group_id)||null,cost_group_id:v.cost_group_id,scope_key:v.scope_key,mode:v.mode,notes:v.notes??'',is_active:v.is_active!==false});
  return this.put('rate_templates',{...this.get('rate_templates',root.id),captured_from_component_id:c.id,captured_from_component_version:c.version,captured_quantity:c.quantity,normalization_notes:notes,notes:'สำเนาจากโครงการเป็นร่าง ต้องตรวจอัตรา ยอดเหมา จำนวนชุด และตำแหน่งเพิ่มนอกชุดก่อนตั้งพร้อมใช้'},root.id);
 });},
 retireRate(id,version){return this.tx(()=>{const t=this.get('rate_templates',id);if(t.version!==version||t.status!=='READY')fail('รายการเปลี่ยนแล้ว');return this.put('rate_templates',{...t,status:'RETIRED',is_active:false},id);});},
 reviseRate(id,version){return this.tx(()=>{const old=this.get('rate_templates',id);if(old.version!==version)fail('ต้นแบบเปลี่ยนแล้ว');const revision=String(Math.max(...this.all('rate_templates').filter(t=>t.company_id===old.company_id&&t.code===old.code).map(t=>Number(t.revision)))+1);const root=this.put('rate_templates',{...old,id:undefined,revision,status:'DRAFT'}),gm=new Map(),lm=new Map();for(const g of this.all('rate_template_groups').filter(g=>g.template_id===id)){const n=this.put('rate_template_groups',{...g,id:undefined,template_id:root.id});gm.set(g.id,n.id);}const lines=this.all('rate_template_cost_lines').filter(l=>l.template_id===id);for(const l of lines)lm.set(l.id,randomUUID());for(const l of [...lines.filter(l=>!l.parent_id),...lines.filter(l=>l.parent_id)])this.put('rate_template_cost_lines',{...l,template_id:root.id,group_id:gm.get(l.group_id)||null,parent_id:lm.get(l.parent_id)||null,origin_excluded_id:lm.get(l.origin_excluded_id)||null},lm.get(l.id));for(const v of this.all('rate_template_coverages').filter(v=>v.template_id===id))this.put('rate_template_coverages',{...v,id:undefined,template_id:root.id,cost_line_id:lm.get(v.cost_line_id),group_id:gm.get(v.group_id)||null});return root;});},
 removeRate(t,id,version){return this.tx(()=>{const r=this.get(t,id),owner=this.rateOwner(t,r);if(r.version!==version||owner.status!=='DRAFT')fail('ลบได้เฉพาะร่างรุ่นล่าสุด');if(owner.company_id!==this.company.id)fail('ต้นแบบอยู่คนละบริษัท');if(t==='rate_template_groups')this.retainGroupCodeSequence(t,r);if(t==='rate_templates'){const company=this.get('companies',this.company.id),match=/^RT(\d+)$/.exec(r.code??'');if(match&&Number(match[1])>Number(company.rate_code_sequence??0))this.put('companies',{...company,rate_code_sequence:Number(match[1])},company.id);}if(t==='rate_template_cost_lines'){if(r.parent_id)fail('ลบที่บรรทัดชุดแม่');this.db.prepare('DELETE FROM rate_template_coverages WHERE cost_line_id=?').run(id);this.db.prepare('DELETE FROM rate_template_cost_lines WHERE parent_id=?').run(id);}this.db.prepare('DELETE FROM '+t+' WHERE id=?').run(id);if(t!=='rate_templates')this.put('rate_templates',this.get('rate_templates',owner.id),owner.id);return {ok:true};});},
 syncRateGroups(r,old){if(!old||!r.source_template_id||r.quantity===old.quantity)return;for(const l of this.all('component_cost_lines').filter(l=>l.component_id===r.id&&l.rate_numerator!==undefined))this.put('component_cost_lines',{...l,numerator:product(l.rate_numerator,r.quantity)},l.id);for(const g of this.all('component_groups').filter(g=>g.component_id===r.id&&g.rate_basis)){this.put('component_groups',{...g,area:g.rate_area?product(g.rate_area,r.quantity):'',quantity:g.rate_quantity?product(g.rate_quantity,r.quantity):''},g.id);}},
};
