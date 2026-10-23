import {defaultPanels,installGroupRows,relationPanel,snapshotResource,newLineId} from './panel-groups.mjs';
import {assemblyResources,bundleDefinition,scopeOf} from './bundle-samples.mjs';
export const setNames={body:'งานโครงตัวตู้',door:'งานชุดหน้าบาน',drawer:'งานชุดลิ้นชัก'};
export const lineKindNames={CHARGEABLE:'คิดต้นทุน / จัดหา',INCLUDED_REFERENCE:'รวมในชุดแล้ว',EXCLUDED_REFERENCE:'ชุดไม่รวม — ต้องพิจารณา'};
export function ensureAssemblyResources(resources){for(const r of assemblyResources)if(!resources.some(x=>x.code===r.code))resources.push(structuredClone(r));return resources;}
const refId=()=>newLineId();
export function chargeLine(resource,groupId,variant,quantity='1'){
 return {...snapshotResource({costLineId:refId(),componentId:'S001',componentGroupId:groupId,sourcingVariant:variant,lineKind:'CHARGEABLE',lineRole:'OTHER',quantitySource:'MANUAL',numerator:quantity,denominator:'1',basis:'TOTAL',waste:'0'},resource),scopeKey:scopeOf(resource)};
}
export function addBundle(state,resources,groupId,code,quantity='1'){
 const resource=resources.find(r=>r.code===code),definition=bundleDefinition(code);if(!definition||!resource)throw Error('เลือกสินค้าชุดที่มีขอบเขตให้ตรวจ');
 if(state.lines.some(l=>l.componentGroupId===groupId&&l.sourcingVariant==='BUY'&&l.bundleSnapshot&&l.code===code))throw Error('มีสินค้าชุดรุ่นนี้แล้ว แก้จำนวนในแถวเดิมได้');
 const root=chargeLine(resource,groupId,'BUY',quantity);root.bundleSnapshot=structuredClone(definition);state.lines.push(root);
 for(const i of definition.items){const child=resources.find(r=>r.code===i.childCode);if(!child)throw Error('ไม่พบวัสดุที่รวมในชุด');state.lines.push({...chargeLine(child,groupId,'BUY'),lineKind:i.inclusionStatus==='INCLUDED'?'INCLUDED_REFERENCE':'EXCLUDED_REFERENCE',parentBundleCostLineId:root.costLineId,sourceBundleItemId:i.id,bundleVersionSnapshot:definition.version,quantitySource:'PARENT_BUNDLE_USAGE',quantityPerParent:i.quantity,inclusionSnapshot:i.inclusionStatus,scopeKey:i.scopeKey,priceSnapshot:null,yieldSnapshot:null,purchaseUnitSnapshot:null,needResolution:i.inclusionStatus==='EXCLUDED'?'PENDING':null});}
 return root;
}
function baseGroups(){return ['body','door','drawer'].map((id,i)=>({id,componentId:'S001',name:setNames[id],groupType:'WORK_SET',assemblyKind:['CARCASS','DOOR','DRAWER'][i],active:i<2,sourcingMethod:i===2?'MAKE':'BUY',area:'',plySides:'2',lamSides:'2',quantity:'1',calculationMethod:i===2?'MANUAL':'PANEL_AREA'}));}
function installMakeTemplates(state,resources,panel=null,oldRows=null){
 const p=panel??defaultPanels();const rows=oldRows??installGroupRows([],p,resources);
 for(const g of state.groups.filter(g=>g.id!=='drawer')){const old=p.groups.find(x=>x.id===g.id);if(old){g.area=old.area;g.plySides=old.plySides;g.lamSides=old.lamSides;}
  for(const l of rows.filter(l=>l.componentGroupId===g.id))state.lines.push({...structuredClone(l),lineKind:'CHARGEABLE',sourcingVariant:'MAKE',scopeKey:scopeOf(resources.find(r=>r.code===l.code)),panelLinked:true});
 }
 const ply=resources.find(r=>r.code==='PLY01'),rail=resources.find(r=>r.code==='SLIDE-SAMPLE');state.lines.push(chargeLine(ply,'drawer','MAKE',''),chargeLine(rail,'drawer','MAKE',''));
}
export function createWorkSets(resources){ensureAssemblyResources(resources);const state={relationVersion:3,groups:baseGroups(),lines:[],viewGroup:null};installMakeTemplates(state,resources);addBundle(state,resources,'body','b-0800-0750-0600-0');addBundle(state,resources,'door','DOOR-KIT-SAMPLE','2');addBundle(state,resources,'drawer','DRAWER-KIT-SAMPLE');return state;}
export function previewWorkSetMigration({panel,rows,resources,method}){
 const state=createWorkSets(resources),notes=['เก็บวิธีเดิมและรายการเดิมไว้ก่อน เปลี่ยนแต่ละชุดได้ภายหลัง ไม่สรุปจากชื่อว่าผู้ขายรวมอะไรแล้ว'];
 if(panel?.relationVersion===2&&method==='CUSTOM'){
  state.lines=state.lines.filter(l=>l.sourcingVariant!=='MAKE'||l.componentGroupId==='drawer');
  for(const g of state.groups.filter(g=>g.id!=='drawer')){const old=panel.groups.find(x=>x.id===g.id);Object.assign(g,{active:old.active,sourcingMethod:'MAKE',area:old.area,plySides:old.plySides,lamSides:old.lamSides});}
  state.lines.push(...rows.map(l=>({...structuredClone(l),lineKind:'CHARGEABLE',sourcingVariant:l.componentGroupId?'MAKE':null,scopeKey:scopeOf(resources.find(r=>r.code===l.code))})));
 }else if(method==='VS_MODULAR'){
  state.lines=state.lines.filter(l=>l.sourcingVariant!=='BUY'||l.componentGroupId==='drawer');
  for(const old of rows){const code=old.code,g=code.startsWith('b-')?'body':['FD01','LM01','GL01','LB06'].includes(code)?'door':null;let l={...chargeLine(resources.find(r=>r.code===code),g,g?'BUY':null),...structuredClone(old),componentGroupId:g,sourcingVariant:g?'BUY':null,lineKind:'CHARGEABLE'};if(bundleDefinition(code)){l.bundleSnapshot={...bundleDefinition(code),scopeConfirmed:false};notes.push('ตรวจขอบเขตเดิมของ '+code+' ก่อนใช้ยอดชุดใหม่ ไม่เติมส่วนประกอบที่ไม่ทราบ');}state.lines.push(l);}
 }else{notes.push('ร่างรุ่นเก่ายังไม่มีข้อมูลแยกชุดครบ แสดงแบบ SAMPLE เพื่อเลือกและตรวจใหม่ สำเนาเดิมยังเก็บไว้');}
 return {state,notes:[...new Set(notes)]};
}
export function activeSetLines(state){return state.lines.filter(l=>!l.componentGroupId||state.groups.some(g=>g.id===l.componentGroupId&&g.active&&g.sourcingMethod===l.sourcingVariant));}
export function groupLines(state,id){const g=state.groups.find(g=>g.id===id);return state.lines.filter(l=>(l.componentGroupId??'direct')===id&&(!g||l.sourcingVariant===g.sourcingMethod));}
export function switchSetMethod(state,id,method){if(!['BUY','MAKE'].includes(method))throw Error('เลือกซื้อสำเร็จรูปหรือผลิตเอง');const next=structuredClone(state),g=next.groups.find(g=>g.id===id);if(!g)throw Error('ไม่พบชุด');g.sourcingMethod=method;return next;}
export function replaceBundle(state,resources,id,code){const parent=state.lines.find(l=>l.costLineId===id);if(!parent?.bundleSnapshot)throw Error('ไม่พบชุดแม่');const index=state.lines.indexOf(parent),next=structuredClone(state);next.lines=next.lines.filter(l=>l.costLineId!==id&&l.parentBundleCostLineId!==id);const kept=next.lines.length;const root=addBundle(next,resources,parent.componentGroupId,code,parent.numerator);root.denominator=parent.denominator;root.waste=parent.waste;const inserted=next.lines.splice(kept);next.lines.splice(Math.min(index,next.lines.length),0,...inserted);next.lines.forEach(l=>{if(l.additionalDeclaration&&(!l.componentGroupId||l.componentGroupId===parent.componentGroupId))delete l.additionalDeclaration;});return next;}
const sameScope=(a,b)=>a==='OTHER'||a==='LABOR'&&b.endsWith('_LABOR')||a===b||a==='HARDWARE'&&['HINGE','SLIDE'].includes(b)||b==='HARDWARE'&&['HINGE','SLIDE'].includes(a);
export function coveredParents(state,line){if(line.bundleSnapshot||line.lineKind!=='CHARGEABLE')return [];return activeSetLines(state).filter(p=>p.bundleSnapshot&&(!line.componentGroupId||p.componentGroupId===line.componentGroupId)&&(p.bundleSnapshot.coveredScopes.some(s=>sameScope(line.scopeKey,s))||p.bundleSnapshot.items.some(i=>i.inclusionStatus==='INCLUDED'&&i.childCode===line.code)));}
export function additionalParents(state,line){
 if(!line||line.bundleSnapshot||line.lineKind!=='CHARGEABLE')return [];
 const group=state.groups.find(g=>g.id===line.componentGroupId);
 return group?.active&&group.sourcingMethod==='BUY'?activeSetLines(state).filter(p=>p.bundleSnapshot&&p.componentGroupId===line.componentGroupId):coveredParents(state,line);
}
export function additionalDetailsError(line){
 if(typeof line.additionalReason!=='string'||!line.additionalReason.trim())return 'กรอกเหตุผลของรายการเพิ่มนอกชุด';
 if(line.additionalReason.trim().length>1000)return 'เหตุผลต้องไม่เกิน 1,000 ตัวอักษร';
 if(typeof line.additionalLocation!=='string'||!line.additionalLocation.trim())return 'กรอกตำแหน่งที่ใช้ของรายการเพิ่มนอกชุด';
 if(line.additionalLocation.trim().length>500)return 'ตำแหน่งต้องไม่เกิน 500 ตัวอักษร';
 return null;
}
function declarationSignature(line,parents){return JSON.stringify({version:2,lineId:line.costLineId,component:line.componentId,group:line.componentGroupId??null,variant:line.sourcingVariant,code:line.code,phase:line.laborPhase,scope:line.scopeKey,reason:line.additionalReason?.trim(),location:line.additionalLocation?.trim(),quantity:[line.numerator,line.denominator,line.basis,line.waste],parents:parents.map(p=>[p.costLineId,p.numerator,p.denominator,p.waste,p.bundleSnapshot]).sort((a,b)=>a[0].localeCompare(b[0]))});}
export function additionalIsConfirmed(state,line){const parents=additionalParents(state,line);return !parents.length||!!(!additionalDetailsError(line)&&line.additionalConfirmation?.version===2&&line.additionalConfirmation.actor==='LOCAL_TRIAL'&&Number.isFinite(Date.parse(line.additionalConfirmation.confirmedAt))&&line.additionalConfirmation.signature===declarationSignature(line,parents)&&line.additionalDeclaration===line.additionalConfirmation.signature);}
export function confirmAdditional(state,id){const l=state.lines.find(l=>l.costLineId===id),parents=additionalParents(state,l);if(!parents.length)throw Error('ไม่มีชุดที่ต้องตรวจรายการเพิ่มนอกชุด');const error=additionalDetailsError(l);if(error)throw Error(error);l.additionalReason=l.additionalReason.trim();l.additionalLocation=l.additionalLocation.trim();l.additionalDeclaration=declarationSignature(l,parents);l.additionalConfirmation={version:2,signature:l.additionalDeclaration,confirmedAt:new Date().toISOString(),actor:'LOCAL_TRIAL'};}
export function resolveExcluded(state,resources,id,decision){const r=state.lines.find(l=>l.costLineId===id);if(r?.lineKind!=='EXCLUDED_REFERENCE')throw Error('ไม่พบขอบเขตที่ชุดไม่รวม');if(decision==='NOT_REQUIRED'){r.needResolution='NOT_REQUIRED';r.resolutionNote='ผู้ใช้ยืนยันไม่ต้องใช้ในงานนี้';return null;}if(r.resolvedChargeLineId&&state.lines.some(l=>l.costLineId===r.resolvedChargeLineId))return state.lines.find(l=>l.costLineId===r.resolvedChargeLineId);const extra=chargeLine(resources.find(x=>x.code===r.code),r.componentGroupId,r.sourcingVariant,'');extra.excludedOriginParentId=r.parentBundleCostLineId;state.lines.push(extra);r.needResolution='ADDED_AS_CHARGE';r.resolvedChargeLineId=extra.costLineId;return extra;}
export function validateWorkSets(state,resources){
 if(state?.relationVersion!==3||!Array.isArray(state.groups)||!Array.isArray(state.lines))throw Error('ข้อมูลรายการงาน/ชุดไม่ครบ');
 const ids=new Set();for(const l of state.lines){if(!l.costLineId||ids.has(l.costLineId))throw Error('รหัสบรรทัดซ้ำ');ids.add(l.costLineId);if(!['CHARGEABLE','INCLUDED_REFERENCE','EXCLUDED_REFERENCE'].includes(l.lineKind))throw Error('ประเภทบรรทัดต้นทุนไม่ถูกต้อง');if(l.componentId!=='S001'||l.componentGroupId&&!state.groups.some(g=>g.id===l.componentGroupId))throw Error('บรรทัดอ้างชุดคนละงาน');if(!resources.some(r=>r.code===l.code))throw Error('ไม่พบทรัพยากร '+l.code);}
 const active=activeSetLines(state),roots=active.filter(l=>l.bundleSnapshot);
 for(const g of state.groups.filter(g=>g.active)){if(!['BUY','MAKE'].includes(g.sourcingMethod))throw Error(g.name+': เลือกวิธีจัดหา');if(!groupLines(state,g.id).some(l=>l.lineKind==='CHARGEABLE'))throw Error(g.name+': ยังไม่มีรายการต้นทุน');if(g.sourcingMethod==='MAKE'&&g.calculationMethod==='PANEL_AREA'){for(const role of ['FRAME','PLYWOOD',...(g.lamSides==='0'?[]:['LAMINATE','ADHESIVE'])])if(!groupLines(state,g.id).some(l=>l.lineKind==='CHARGEABLE'&&l.lineRole===role))throw Error(g.name+': วัสดุแผงไม่ครบ '+role);}if(g.sourcingMethod==='BUY'&&!roots.some(l=>l.componentGroupId===g.id))throw Error(g.name+': ยังไม่ได้เลือกสินค้าชุด');}
 for(const root of roots){if(!root.bundleSnapshot.scopeConfirmed)throw Error(root.code+': ขอบเขตชุดยังไม่ยืนยัน กรุณาตรวจหรือเลือกชุด SAMPLE ที่ระบุขอบเขต');if(root.lineKind!=='CHARGEABLE')throw Error('แม่ของชุดต้องเป็นรายการคิดเงิน');
  for(const item of root.bundleSnapshot.items){const matches=active.filter(l=>l.parentBundleCostLineId===root.costLineId&&l.sourceBundleItemId===item.id);if(matches.length!==1)throw Error(root.code+': รายละเอียดส่วนประกอบไม่ครบหรือซ้ำ');const ref=matches[0];if(ref.lineKind!==(item.inclusionStatus==='INCLUDED'?'INCLUDED_REFERENCE':'EXCLUDED_REFERENCE')||ref.bundleVersionSnapshot!==root.bundleSnapshot.version||ref.code!==item.childCode||ref.quantityPerParent!==item.quantity||ref.inclusionSnapshot!==item.inclusionStatus)throw Error('รายละเอียดชุดไม่ตรง snapshot ที่เลือก');}
 }
 for(const l of active){if(l.lineKind!=='CHARGEABLE'){
   const p=roots.find(p=>p.costLineId===l.parentBundleCostLineId);if(!p||p.componentGroupId!==l.componentGroupId||p.componentId!==l.componentId||!p.bundleSnapshot.items.some(i=>i.id===l.sourceBundleItemId))throw Error('ส่วนประกอบอ้างชุดแม่ผิด');
   if(l.priceSnapshot!==null)throw Error('ของอ้างอิงที่รวม/ไม่รวมต้องไม่เก็บราคาเพื่อคิดเงิน');
   if(l.inclusionSnapshot==='UNKNOWN')throw Error('ยังไม่ทราบว่าสินค้าชุดรวมรายการนี้หรือไม่');
   if(l.lineKind==='EXCLUDED_REFERENCE'&&l.needResolution!=='NOT_REQUIRED'&&!(l.needResolution==='ADDED_AS_CHARGE'&&active.some(x=>x.costLineId===l.resolvedChargeLineId&&x.lineKind==='CHARGEABLE'&&x.code===l.code&&x.componentGroupId===l.componentGroupId&&x.excludedOriginParentId===l.parentBundleCostLineId)))throw Error(l.code+': ชุดไม่รวม กรุณาเพิ่มรายการหรือยืนยันว่าไม่ต้องใช้');
  }else{if(l.componentGroupId&&resources.find(r=>r.code===l.code)?.type==='LABOR'&&!['PRODUCTION','INSTALLATION'].includes(l.laborPhase))throw Error(l.code+': เลือกประเภทค่าแรงผลิตหรือติดตั้ง');if(l.laborPhase&&resources.find(r=>r.code===l.code)?.type==='LABOR'){for(const p of roots.filter(p=>p.componentGroupId===l.componentGroupId)){if(!p.bundleSnapshot.laborCoverage)throw Error(p.code+': ยังไม่ยืนยันขอบเขตค่าแรง กรุณาตรวจชุดเวอร์ชันล่าสุด');}}const covered=coveredParents(state,l),parents=additionalParents(state,l);if(parents.length&&!additionalIsConfirmed(state,l))throw Error(l.code+': '+(covered.length?'ชุดรวมส่วนนี้แล้ว — ':'')+(additionalDetailsError(l)??'ตรวจและยืนยันเหตุผล ตำแหน่ง และจำนวนเพิ่มนอกชุดอีกครั้ง'));}
 }
 return state;
}
export function applyWorkSets(payload,state){validateWorkSets(state,payload.resources);const c=payload.components.find(c=>c.code==='S001');c.groups=structuredClone(state.groups);c.lines=structuredClone(activeSetLines(state));c.workSetVersion=3;return payload;}

export function addGroupLabor(state,resources,groupId,phase,code,basis='PER_UNIT'){
 const g=state.groups.find(g=>g.id===groupId),r=resources.find(r=>r.code===code);
 if(!g||!['PRODUCTION','INSTALLATION'].includes(phase)||r?.type!=='LABOR'||!['PER_UNIT','TOTAL'].includes(basis))throw Error('เลือกกลุ่ม ประเภทค่าแรง และฐานปริมาณให้ครบ');
 if(state.lines.some(l=>l.componentGroupId===groupId&&l.sourcingVariant===g.sourcingMethod&&l.code===code&&l.laborPhase===phase))throw Error('มีค่าแรงนี้แล้ว แก้ปริมาณแถวเดิมได้');
 const l=chargeLine(r,groupId,g.sourcingMethod,'1');Object.assign(l,{laborPhase:phase,lineRole:phase+'_LABOR',scopeKey:phase+'_LABOR',basis});state.lines.push(l);return l;
}
export function assignLaborGroup(state,resources,id,groupId){
 const l=state.lines.find(l=>l.costLineId===id),g=state.groups.find(g=>g.id===groupId);
 if(!g||!l||l.lineKind!=='CHARGEABLE'||resources.find(r=>r.code===l.code)?.type!=='LABOR')throw Error('เลือกเฉพาะค่าแรงคิดเงินจริงและกลุ่มปลายทาง');
 l.componentGroupId=g.id;l.sourcingVariant=g.sourcingMethod;delete l.additionalDeclaration;return l;
}
