import {resolveGroupLine,number} from '../lib/group-quantity.mjs';
export {resolveGroupLine} from '../lib/group-quantity.mjs';
import Decimal from 'decimal.js';
import {defaultPanel,panelCodes} from './panel-model.mjs';
import {resources as initialResources} from './fixtures.mjs';
const D=Decimal.clone({precision:80});
export const groupNames={body:'แผงตัวตู้',door:'แผงหน้าบาน'};
export const roleNames={FRAME:'ไม้โครง',PLYWOOD:'ไม้อัด',LAMINATE:'ลามิเนต',ADHESIVE:'กาว'};
const roles=Object.keys(roleNames);
const sources={FRAME:'PANEL_AREA',PLYWOOD:'PLYWOOD_AREA',LAMINATE:'LAMINATE_AREA',ADHESIVE:'LAMINATE_AREA'};
export const newLineId=()=>crypto.randomUUID();
export function normalizePanels(saved){
 const old={...defaultPanel(),...saved};if(saved?.groups)return structuredClone(saved);
 return {enabled:old.enabled,groups:[{...old,id:'body',active:true,plyCode:'PLY01',lamCode:'LM01'},
 {...defaultPanel(),id:'door',active:false,area:'',plyCode:'PLY01',lamCode:'LM01'}]};
}
export const defaultPanels=()=>normalizePanels();
export function materialOptions(resources,role){return resources.filter(r=>r.type==='MATERIAL'&&r.usage_unit==='ตร.ม.'&&(role==='ply'?r.code.startsWith('PLY')||r.name.includes('ไม้อัด'):r.code.startsWith('LM')||r.name.includes('ลามิเนต')));}
export function snapshotResource(row,resource){if(!resource)throw Error('ไม่พบสเปกวัสดุในร่าง');return {...row,code:resource.code,projectResourceId:resource.code,priceSnapshot:resource.price,yieldSnapshot:resource.yield,purchaseUnitSnapshot:resource.purchase_unit,usageUnitSnapshot:resource.usage_unit,typeSnapshot:resource.type,nameSnapshot:resource.name};}
export function roleLine(rows,groupId,role){return rows.find(l=>l.componentGroupId===groupId&&l.lineRole===role);}
export function groupView(group,rows){
 const frame=roleLine(rows,group.id,'FRAME'),glue=roleLine(rows,group.id,'ADHESIVE');
 return {...group,plyCode:roleLine(rows,group.id,'PLYWOOD')?.code??group.plyCode??'PLY01',lamCode:roleLine(rows,group.id,'LAMINATE')?.code??group.lamCode??'LM01',woodRate:frame?.numerator??group.woodRate??'',glueCoverage:glue?.denominator??group.glueCoverage??''};
}
export function linkedCodes(p,rows=[]){return [...new Set(p.groups.flatMap(g=>{const v=groupView(g,rows);return ['WD01',v.plyCode,v.lamCode,'GL01'];}))];}
export function installGroupRows(rows,p,resources=initialResources){
 const relation=rows.some(l=>l.componentGroupId),legacyCodes=new Set([...panelCodes,...linkedCodes(p,rows)]);
 const result=[];
 for(const g of p.groups){const v=groupView(g,rows);for(const role of roles){
  const old=roleLine(rows,g.id,role);if(old){result.push(old);continue;}
  const code={FRAME:'WD01',PLYWOOD:v.plyCode,LAMINATE:v.lamCode,ADHESIVE:'GL01'}[role];
  const row={costLineId:newLineId(),componentId:'S001',componentGroupId:g.id,lineRole:role,quantitySource:sources[role],code,numerator:role==='FRAME'?v.woodRate:'1',denominator:role==='ADHESIVE'?v.glueCoverage:'1',basis:'TOTAL',waste:'0',panelLinked:true};
  result.push(snapshotResource(row,resources.find(r=>r.code===code)));
 }}
 const rest=rows.filter(l=>!l.componentGroupId&&!l.panelLinked&&(relation||!legacyCodes.has(l.code))&&!['PN01','ED01'].includes(l.code));
 return [...result,...rest.map(l=>({...l,costLineId:l.costLineId??newLineId(),componentId:'S001',componentGroupId:null,lineRole:'OTHER',quantitySource:'MANUAL'}))];
}
export function relationPanel(p){return {enabled:p.enabled,relationVersion:2,groups:p.groups.map(g=>({id:g.id,componentId:'S001',name:groupNames[g.id],groupType:'PANEL',active:g.active,area:g.area,plySides:g.plySides,lamSides:g.lamSides}))};}
export function previewGroupMigration(p,rows,resources){
 const next=installGroupRows(rows,p,resources),notes=[];
 for(const l of next.filter(l=>l.componentGroupId)){
  const old=rows.find(r=>r.code===l.code),count=next.filter(r=>r.componentGroupId&&r.code===l.code&&p.groups.find(g=>g.id===r.componentGroupId)?.active).length;
  if(old){l.waste=count>1&&old.waste!=='0'?'':old.waste;if(l.waste==='')notes.push(l.code+': เผื่อเศษเดิมเป็นแถวรวม กรุณากรอกแยกกลุ่มใหม่');}
 }
 return {panel:{...relationPanel(p),enabled:true},rows:next,notes:[...new Set(notes)],priceSource:'ราคาและตัวแปลงอ้างอิงวัสดุในร่างเดิม ไม่แบ่งต้นทุนรวมเก่า'};
}
export function groupRows(p,resources,{strict=true,rows=installGroupRows([],p,resources)}={}){
 const result=[];if(!p.groups.some(g=>g.active))throw Error('เลือกใช้อย่างน้อยหนึ่งกลุ่มแผง');
 for(const g of p.groups.filter(g=>g.active))for(const line of rows.filter(l=>l.componentGroupId===g.id)){
  try{const q=resolveGroupLine(line,{...g,componentId:'S001'});if(!q)continue;
   const role=line.lineRole;if(role==='PLYWOOD'||role==='LAMINATE'){if(!materialOptions(resources,role==='PLYWOOD'?'ply':'lam').some(r=>r.code===line.code))throw Error('เลือกสเปก'+(role==='PLYWOOD'?'ไม้อัด':'ลามิเนต')+'ที่ใช้หน่วย ตร.ม.');}
   if(!strict&&(!/^\d+(?:\.\d{1,8})?$/.test(line.numerator)||!/^\d+(?:\.\d{1,8})?$/.test(line.denominator)))continue;
   const amount=number(q.area,'พื้นที่').mul(number(q.numerator,'อัตราใช้')).div(number(q.denominator,'จำนวนหาร',true));
   result.push({...line,usageBeforeWaste:amount.toString()});
  }catch(e){throw Error(groupNames[g.id]+': '+e.message);}
 }
 return result;
}
export function applyGroups(payload,p){
 const c=payload.components.find(c=>c.code==='S001');if(p.relationVersion!==2)throw Error('กรุณาตรวจและแปลงร่างเป็นวัสดุแยกกลุ่มก่อนคำนวณ');
 if(c.lines.some(l=>['PN01','ED01'].includes(l.code)))throw Error('ยังมีต้นทุนแผงเหมารวมเดิม กรุณาตรวจรายการ');
 if(new Set(c.lines.map(l=>l.costLineId)).size!==c.lines.length||c.lines.some(l=>!l.costLineId))throw Error('รหัสบรรทัดต้นทุนซ้ำหรือไม่ครบ');
 for(const l of c.lines.filter(l=>l.componentGroupId))if(!p.groups.some(g=>g.id===l.componentGroupId&&g.componentId===l.componentId))throw Error('บรรทัดวัสดุอ้างกลุ่มคนละงาน');
 for(const g of p.groups.filter(g=>g.active))for(const role of roles){if(g.lamSides==='0'&&['LAMINATE','ADHESIVE'].includes(role))continue;if(c.lines.filter(l=>l.componentGroupId===g.id&&l.lineRole===role).length!==1)throw Error(groupNames[g.id]+': วัสดุไม่ครบหรือซ้ำ กรุณาเลิกทำการลบหรือคืนวัสดุ');}
 groupRows(p,payload.resources,{rows:c.lines});
 c.groups=structuredClone(p.groups);
 c.lines=c.lines.filter(l=>!l.componentGroupId||p.groups.find(g=>g.id===l.componentGroupId)?.active).filter(l=>!l.componentGroupId||!(p.groups.find(g=>g.id===l.componentGroupId)?.lamSides==='0'&&['LAMINATE','ADHESIVE'].includes(l.lineRole)));
 return payload;
}
