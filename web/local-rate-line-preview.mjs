import {calculateLive} from '../lib/live-calculator.mjs';
let previousCleanup=null;
export function clearRateLinePreview(){if(previousCleanup)previousCleanup();previousCleanup=null;document.querySelector('#rate-line-preview')?.remove();document.querySelector('#rate-line-usage-unit')?.remove();}

export function catalogPreviewSnapshot(resource,tables) {
 if(!resource)return null;
 const type=tables.cost_types?.find(t=>t.id===resource.cost_type_id);
 return {code:resource.code,name:resource.name,price:resource.price===''?null:resource.price,yield:resource.yield,increment:resource.increment,purchase_unit:tables.units?.find(u=>u.id===resource.purchase_unit_id)?.name,usage_unit:tables.units?.find(u=>u.id===resource.usage_unit_id)?.name,type:type?(type.code==='LABOR'?'LABOR':'MATERIAL'):undefined,resourceKind:resource.resource_kind};
}

// A one-line, one-selling-unit calculation using the same core as previewRate.
// It does not assert that the full group/template is complete, and never writes data.
export function previewRateLine({line,oldLine=null,snapshot,group=null,template,sellingUnit=''}) {
 const frozen=oldLine?oldLine.snapshot:snapshot,base={snapshot:frozen,template,sellingUnit,line,group};
 const pending=reason=>({...base,status:'PENDING',reason});
 if(!template)return pending('เลือกต้นแบบราคาขายก่อน');
 if(!sellingUnit)return pending('หน่วยขายของต้นแบบยังไม่ครบ');
 if(!frozen)return pending(oldLine?'snapshot ของบรรทัดเดิมยังไม่ครบ':'เลือกวัสดุหรือค่าแรงจากคลังก่อน');
 if(oldLine&&line.resource_id!==oldLine.resource_id)return pending('บรรทัดเดิมเก็บ snapshot แล้ว เปลี่ยนวัสดุให้เพิ่มบรรทัดใหม่');
 if(line.is_active===false)return pending('บรรทัดนี้ปิดใช้งาน ยังไม่รวมต้นทุน');
 if(!frozen.purchase_unit||!frozen.usage_unit)return pending('ข้อมูลหน่วยซื้อหรือหน่วยใช้ยังไม่ครบ');
 if(!['MATERIAL','LABOR'].includes(frozen.type))return pending('ประเภทวัสดุหรือค่าแรงยังไม่ครบ');
 if(line.price===''||line.price===undefined||line.price===null)return pending('กรอกราคาต่อหน่วยซื้อก่อน');
 if(line.numerator===''||line.numerator===undefined||line.numerator===null)return pending('กรอกปริมาณใช้ต่อ 1 หน่วยขายก่อน');
 if(frozen.yield===''||frozen.yield===null||frozen.yield===undefined)return pending('ตัวแปลงหน่วย / ปริมาณที่ได้ต่อหน่วยซื้อยังไม่ครบ');
 const source=line.quantity_source??'MANUAL';
 if(line.group_id&&!group)return pending('ไม่พบกลุ่มวัตถุดิบต้นทุนของบรรทัดนี้');
 if(group?.is_active===false)return pending('กลุ่มวัตถุดิบต้นทุนนี้ปิดใช้งาน');
 if(source!=='MANUAL'&&!group)return pending('ฐานปริมาณนี้ต้องมีกลุ่มวัตถุดิบต้นทุน');
 if(source==='LAMINATE_AREA'&&group?.lamSides==='0')return pending('กลุ่มนี้กำหนดปิดผิว 0 ด้าน บรรทัดนี้จึงยังไม่ถูกนำมาคิด');
 try {
  const code='draft-line-resource',componentId='draft-line-component',groupId=group?.id??'draft-line-group';
  const resources=[{...frozen,code,price:line.price}];
  const groups=group?[{...group,id:groupId,componentId,active:true,sourcingMethod:group.sourcing_method,area:group.area??'',plySides:group.plySides??'2',lamSides:group.lamSides??'2',quantity:group.quantity??'1'}]:[];
  const bundle=frozen.resourceKind==='BUNDLE'?(oldLine?.bundle_snapshot??{items:[]}):null;
  const candidate={costLineId:'draft-line',componentId,componentGroupId:group?groupId:null,code,numerator:line.numerator,denominator:line.denominator,waste:line.waste,basis:source==='MANUAL'?(bundle?'TOTAL':'PER_UNIT'):'TOTAL',lineKind:'CHARGEABLE',lineRole:line.line_role??'OTHER',quantitySource:source,laborPhase:line.labor_phase,priceSnapshot:line.price,yieldSnapshot:frozen.yield,purchaseUnitSnapshot:frozen.purchase_unit,usageUnitSnapshot:frozen.usage_unit,typeSnapshot:frozen.type,nameSnapshot:frozen.name,bundleSnapshot:bundle};
  const result=calculateLive({resources,components:[{code:componentId,name:template.name,quantity:'1',margin:'0',unit:sellingUnit,groups,lines:[candidate]}]}).components[0].lines[0];
  if(!result)return pending('ฐานปริมาณหรือกลุ่มนี้ยังไม่ได้นำบรรทัดมาคำนวณ');
  return {...base,status:'READY',result,basis:candidate.basis,bundle:!!bundle};
 } catch(error) {return pending(error.message.replaceAll('draft-line-resource',frozen.name??frozen.code??'วัสดุที่เลือก'));}
}

export function installRateLinePreview({form,oldLine=null,template,group,rows,record,esc,compact=false}) {
 clearRateLinePreview();
 const section=document.createElement('section');section.id='rate-line-preview';section.className='rate-line-preview';section.setAttribute('aria-live','polite');
 document.querySelector('#editor-fields').before(section);
 const numerator=form.elements.numerator,unitNote=document.createElement('small');unitNote.id='rate-line-usage-unit';if(numerator)numerator.after(unitNote);
 const number=v=>Number(v).toLocaleString('th-TH',{maximumFractionDigits:8}),money=v=>Number(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:8});
 function update() {
  if(!section.isConnected)return;
  const line={...Object.fromEntries(new FormData(form)),group_id:oldLine?.group_id??group?.id??null,is_active:form.elements.is_active?.checked!==false};
  const resource=record('cost_resources',line.resource_id),snapshot=catalogPreviewSnapshot(resource,{units:rows('units'),cost_types:rows('cost_types')}),sellingUnit=record('units',template?.unit_id)?.name??'';
  const preview=previewRateLine({line,oldLine,snapshot,group,template,sellingUnit}),frozen=preview.snapshot;
  unitNote.textContent=frozen?.usage_unit?'หน่วยใช้: '+frozen.usage_unit+' ต่อ 1 '+sellingUnit+' ของรายการราคาขาย':'เลือกวัสดุเพื่อแสดงหน่วยใช้';
  const title='<h3>ต้นทุนบรรทัดนี้ต่อ 1 หน่วยขาย</h3><p class="hint">คำนวณตัวอย่างจากช่องที่กำลังกรอก ยังไม่บันทึก · ไม่ใช่ต้นทุนทั้งงานหรือราคาขายของงานจริง</p>';
  if(preview.status!=='READY'){section.innerHTML=title+'<p class="rate-line-pending">รอข้อมูล: '+esc(preview.reason)+'</p>';return;}
  const result=preview.result,source=line.quantity_source??'MANUAL';
  const factor=source==='GROUP_QUANTITY'?'จำนวนกลุ่ม '+esc(group.quantity)+' × ':source==='PANEL_AREA'?'พื้นที่แผง '+esc(group.area)+' ตร.ม. × ':source==='PLYWOOD_AREA'?'พื้นที่แผง '+esc(group.area)+' ตร.ม. × บุไม้อัด '+esc(group.plySides)+' ด้าน × ':source==='LAMINATE_AREA'?'พื้นที่แผง '+esc(group.area)+' ตร.ม. × ปิดผิว '+esc(group.lamSides)+' ด้าน × ':'';
  if(compact){section.innerHTML=`<h3>แปลงหน่วยและต้นทุนบรรทัดนี้</h3><p class="rate-line-meaning">${esc(frozen.name)} · <strong>${number(result.usage_total)} ${esc(frozen.usage_unit)} ต่อ 1 ${esc(sellingUnit)}</strong></p><p>1 ${esc(frozen.purchase_unit)} = ${number(result.yield_snapshot)} ${esc(frozen.usage_unit)}</p><p>${money(result.price_snapshot)} ÷ ${number(result.yield_snapshot)} = <strong>${money(result.unit_cost)} บาท/${esc(frozen.usage_unit)}</strong></p>${source!=='MANUAL'||line.denominator!=='1'||line.waste!=='0'?'<p class="hint">'+factor+esc(line.numerator)+' ÷ '+esc(line.denominator)+' × (1 + เผื่อเศษ '+esc(line.waste)+'%)</p>':''}<p class="rate-compact-total">${number(result.usage_total)} ${esc(frozen.usage_unit)} × ${money(result.unit_cost)} = <strong>${money(result.cost_total)} บาท</strong></p><small>ใช้ค่าจริงก่อนปัด · ยังไม่บันทึก</small>`;return;}
  section.innerHTML=title+`<p class="rate-line-meaning"><strong>${esc(frozen.name)} ${number(result.usage_total)} ${esc(frozen.usage_unit)} ต่อ ${esc(template.name)} 1 ${esc(sellingUnit)}</strong></p><dl class="rate-line-formula"><div><dt>ซื้อ / ได้ปริมาณใช้</dt><dd>${money(result.price_snapshot)} บาท / ${esc(frozen.purchase_unit)} · 1 ${esc(frozen.purchase_unit)} = ${number(result.yield_snapshot)} ${esc(frozen.usage_unit)}</dd></div><div><dt>แปลงราคาต่อหน่วยใช้</dt><dd>${money(result.price_snapshot)} ÷ ${number(result.yield_snapshot)} = <strong>${money(result.unit_cost)} บาท/${esc(frozen.usage_unit)}</strong></dd></div><div><dt>ปริมาณใช้จริงในบรรทัด</dt><dd>${factor}${esc(line.numerator)} ÷ ${esc(line.denominator)} × (1 + เผื่อเศษ ${esc(line.waste)}%) = <strong>${number(result.usage_total)} ${esc(frozen.usage_unit)}</strong></dd></div><div class="rate-line-cost"><dt>ต้นทุนต่อ 1 ${esc(sellingUnit)} ของ ${esc(template.name)}</dt><dd>${number(result.usage_total)} ${esc(frozen.usage_unit)} × ${money(result.unit_cost)} บาท/${esc(frozen.usage_unit)} = <strong>${money(result.cost_total)} บาท</strong></dd></div></dl><p class="hint">คำนวณค่าจริงก่อนปัด ไม่คูณจากราคาแสดงที่ปัดไว้ · ราคาแปลงแสดงไม่เกิน 8 ตำแหน่ง · ${source==='MANUAL'?'ตัวตั้งคือปริมาณก่อนหารและเผื่อเศษ':'ตัวตั้งเป็นอัตราที่ต้องคูณฐานพื้นที่/จำนวนข้างต้นอีกครั้ง'}${oldLine?' · ใช้หน่วยและขนาดบรรจุจาก snapshot เดิม':''}${group?.sourcing_method==='BUY'||preview.bundle?' · คำนวณเฉพาะบรรทัด ยังไม่ยืนยันขอบเขตทั้งชุด':''}</p>`;
 }
 // Add listeners after existing resource/role onchange callbacks; do not replace them.
 form.addEventListener('input',update);form.addEventListener('change',update);previousCleanup=()=>{form.removeEventListener('input',update);form.removeEventListener('change',update);};update();
}
