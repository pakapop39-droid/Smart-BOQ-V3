// Only this isolated trial's draft is stored. No keys, tokens or computed totals.
export const DRAFT_KEY='smart-boq-new-test:local-draft:v1';
export const INPUT_IDS=['quantity','area','margin','stone-quantity','stone-margin','wall-quantity','wall-margin','sink-quantity','sink-margin'];
export function draftFingerprint(d){const {page,detailOpen,selected,panelGroupView,...editor}=d.editor;if(editor.workSets){const {viewGroup,...data}=editor.workSets;editor.workSets=data;}return JSON.stringify({editor,catalog:d.catalog});}
const string=v=>typeof v==='string';
const unique=xs=>new Set(xs).size===xs.length;
const line=l=>l&&['code','numerator','denominator','basis','waste'].every(k=>string(l[k]))&&['PER_UNIT','TOTAL'].includes(l.basis);
const kinds=['MATERIAL','LABOR','VS_MODULAR'];
export function validateDraft(d){
 if(![1,2,3].includes(d?.schemaVersion))throw Error('รุ่นข้อมูลที่บันทึกไว้ไม่รองรับ');
 const e=d.editor,c=d.catalog;
 if(e?.panel){const p=e.panel,fields=p.relationVersion===2?['area','plySides','lamSides']:['area','plySides','lamSides','woodRate','glueCoverage'];if(typeof p.enabled!=='boolean'||(p.groups?(!Array.isArray(p.groups)||p.groups.length!==2||p.groups.some((g,i)=>g.id!==['body','door'][i]||typeof g.active!=='boolean'||![...fields,...(p.relationVersion===2?[]:['plyCode','lamCode'])].every(k=>string(g[k]))||p.relationVersion===2&&(g.componentId!=='S001'||g.groupType!=='PANEL'))):!fields.every(k=>string(p[k]))))throw Error('ข้อมูลแผงตู้ที่บันทึกไม่ครบ');}
 if(!e||!c||!['CUSTOM','VS_MODULAR'].includes(e.method)||!Array.isArray(e.resources)||!Array.isArray(c.records)||!Array.isArray(c.tags)||!Array.isArray(c.tagUndo)||!Number.isSafeInteger(c.nextTag)||c.nextTag<1||!Number.isSafeInteger(c.revision)||c.revision<0)throw Error('รูปแบบข้อมูลที่บันทึกไว้ไม่ครบ');
 if(!e.inputs||INPUT_IDS.some(id=>!string(e.inputs[id]))||!['S001','S002','S003','S004'].includes(e.selected))throw Error('ข้อมูลช่องกรอกไม่ครบ');
 if(!e.resources.every(r=>r&&['code','name','usage_unit','type'].every(k=>string(r[k]))&&['price','yield','increment','purchase_unit'].every(k=>string(r[k])||d.schemaVersion===3&&r[k]===null))||!unique(e.resources.map(r=>r.code)))throw Error('ข้อมูลต้นทุนที่บันทึกไว้ไม่ถูกต้อง');
 for(const code of ['S001','S002','S003','S004'])if(!Array.isArray(e.tables?.[code])||!e.tables[code].every(l=>line(l)&&e.resources.some(r=>r.code===l.code))||!Array.isArray(e.deleted?.[code])||!e.deleted[code].every(b=>Array.isArray(b.entries)&&b.entries.every(x=>Number.isInteger(x.index)&&x.index>=0&&line(x.line))))throw Error('ตารางต้นทุนที่บันทึกไว้ไม่ครบ');
 if(d.schemaVersion===2&&e.panel?.relationVersion===2){
  const active=e.method==='CUSTOM'?e.tables.S001:[];const cached=e.customCabinetRows??[];if(!Array.isArray(cached)||!cached.every(l=>line(l)&&e.resources.some(r=>r.code===l.code)))throw Error('ร่างวัสดุผลิตเองไม่ครบ');const all=[...active,...cached,...e.deleted.S001.flatMap(b=>b.entries.map(e=>e.line))];
  if(!unique(active.map(l=>l.costLineId))||!unique(cached.map(l=>l.costLineId))||[...active,...cached].some(l=>!string(l.costLineId)||!l.costLineId))throw Error('รหัสบรรทัดต้นทุนไม่ครบหรือซ้ำ');
  for(const l of all.filter(l=>l.componentGroupId)){
   if(l.componentId!=='S001'||!e.panel.groups.some(g=>g.id===l.componentGroupId)||!['FRAME','PLYWOOD','LAMINATE','ADHESIVE'].includes(l.lineRole)||!['PANEL_AREA','PLYWOOD_AREA','LAMINATE_AREA'].includes(l.quantitySource)||!['priceSnapshot','yieldSnapshot','purchaseUnitSnapshot','usageUnitSnapshot','typeSnapshot','nameSnapshot'].every(k=>string(l[k]))||l.projectResourceId!==l.code)throw Error('ตัวเชื่อมกลุ่มหรือ snapshot วัสดุไม่ถูกต้อง');
  }
  const grouped=active.filter(l=>l.componentGroupId),cachedGroups=cached.filter(l=>l.componentGroupId);if(!unique(grouped.map(l=>l.componentGroupId+':'+l.lineRole))||!unique(cachedGroups.map(l=>l.componentGroupId+':'+l.lineRole)))throw Error('บทบาทวัสดุซ้ำในกลุ่มเดียวกัน');
 }
 if(d.schemaVersion===3){const w=e.workSets;if(w?.relationVersion!==3||!Array.isArray(w.groups)||w.groups.length!==3||!unique(w.groups.map(g=>g.id))||!Array.isArray(w.lines)||!unique(w.lines.map(l=>l.costLineId)))throw Error('รูปแบบรายการงาน/ชุดไม่ครบ');
  if(w.groups.some(g=>!['body','door','drawer'].includes(g.id)||g.componentId!=='S001'||typeof g.active!=='boolean'||!['BUY','MAKE'].includes(g.sourcingMethod)||!['area','plySides','lamSides'].every(k=>string(g[k]))))throw Error('กลุ่มงานหรือวิธีจัดหาไม่ถูกต้อง');
  for(const l of w.lines){if(['additionalReason','additionalLocation'].some(k=>l[k]!==undefined&&!string(l[k])))throw Error('เหตุผลหรือตำแหน่งรายการเพิ่มไม่ใช่ข้อความ');if(l.additionalConfirmation!==undefined&&(!l.additionalConfirmation||l.additionalConfirmation.version!==2||!string(l.additionalConfirmation.signature)||!string(l.additionalConfirmation.confirmedAt)||Number.isNaN(Date.parse(l.additionalConfirmation.confirmedAt))||l.additionalConfirmation.actor!=='LOCAL_TRIAL'))throw Error('รูปแบบการยืนยันรายการเพิ่มไม่ครบ');if(!line(l)||!string(l.costLineId)||!l.costLineId||l.componentId!=='S001'||l.componentGroupId&&!w.groups.some(g=>g.id===l.componentGroupId)||!['CHARGEABLE','INCLUDED_REFERENCE','EXCLUDED_REFERENCE'].includes(l.lineKind)||!e.resources.some(r=>r.code===l.code))throw Error('ตัวเชื่อมบรรทัดงาน/ชุดไม่ถูกต้อง');if(l.componentGroupId&&!['BUY','MAKE'].includes(l.sourcingVariant))throw Error('วิธีจัดหาของบรรทัดไม่ถูกต้อง');if(l.lineKind!=='CHARGEABLE'&&(l.priceSnapshot!==null||!w.lines.some(p=>p.costLineId===l.parentBundleCostLineId&&p.componentGroupId===l.componentGroupId&&p.bundleSnapshot&&p.lineKind==='CHARGEABLE')))throw Error('รายละเอียดอ้างชุดแม่ผิด');}
  if(JSON.stringify(e.tables.S001)!==JSON.stringify(w.lines))throw Error('ตาราง S001 กับรายการงานชุดไม่ตรงกัน');
 }
 if(!c.tags.every(t=>t&&string(t.id)&&string(t.name)&&t.name.trim())||!unique(c.tags.map(t=>t.id))||!unique(c.tags.map(t=>t.name)))throw Error('ข้อมูลแท็กไม่ถูกต้อง');
 if(!c.records.every(r=>r&&string(r.resource_id)&&/^\d+$/.test(r.version)&&BigInt(r.version)>0n&&string(r.resource_code)&&string(r.resource_name)&&kinds.includes(r.kind)&&string(r.purchase_unit_price)&&string(r.purchase_unit_code)&&string(r.usage_unit_code)&&string(r.conversion_method))||!unique(c.records.map(r=>r.resource_id))||!unique(c.records.map(r=>r.resource_code)))throw Error('ข้อมูลคลังที่บันทึกไว้ไม่ถูกต้อง');
 if(!c.links||!c.records.every(r=>Array.isArray(c.links[r.resource_code])&&c.links[r.resource_code].every(id=>c.tags.some(t=>t.id===id))))throw Error('ความสัมพันธ์แท็กที่บันทึกไว้ไม่ครบ');
 if(!c.tagUndo.every(u=>u?.tag&&string(u.tag.id)&&string(u.tag.name)&&Number.isInteger(u.index)&&u.index>=0&&Array.isArray(u.codes)&&u.codes.every(string)))throw Error('ประวัติแท็กที่บันทึกไว้ไม่ถูกต้อง');
 return d;
}
export function readDraft(getStorage=()=>window.localStorage){
 try{const raw=getStorage().getItem(DRAFT_KEY);const data=raw?validateDraft(JSON.parse(raw)):null;if(data)data.catalog.links=Object.assign(Object.create(null),data.catalog.links);return {data,error:null};}
 catch(e){return {data:null,error:e instanceof SyntaxError?'อ่านข้อมูลที่บันทึกไว้ไม่ได้ ข้อมูลเดิมยังเก็บอยู่':e.message};}
}
export function writeDraft(data,getStorage=()=>window.localStorage){
 try{validateDraft(data);getStorage().setItem(DRAFT_KEY,JSON.stringify(data));return {ok:true};}
 catch(e){return {ok:false,error:e.message};}
}
export function clearDraft(getStorage=()=>window.localStorage){
 try{getStorage().removeItem(DRAFT_KEY);return {ok:true};}catch(e){return {ok:false,error:e.message};}
}

export const LEGACY_DRAFT_KEY='smart-boq-new-test:before-panel-relation-v2';
export function backupLegacyDraft(d,getStorage=()=>window.localStorage){try{const storage=getStorage();if(!storage.getItem(LEGACY_DRAFT_KEY))storage.setItem(LEGACY_DRAFT_KEY,JSON.stringify(d));return {ok:true};}catch(e){return {ok:false,error:e.message};}}

export const ASSEMBLY_BACKUP_KEY='smart-boq-new-test:before-work-sets-v3';
export function backupAssemblyDraft(d,getStorage=()=>window.localStorage){try{const storage=getStorage();if(!storage.getItem(ASSEMBLY_BACKUP_KEY))storage.setItem(ASSEMBLY_BACKUP_KEY,JSON.stringify(d));return {ok:true};}catch(e){return {ok:false,error:e.message};}}
