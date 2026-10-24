import {previewRateLine} from './local-rate-line-preview.mjs';
import {lengthUnits} from '../lib/length-units.mjs';
import {areaUnits} from '../lib/area-units.mjs';

export function catalogUnitPreview(snapshot){
 return previewRateLine({snapshot,template:{name:'หน่วยใช้'},sellingUnit:snapshot?.usage_unit??'',line:{resource_id:'catalog-draft',numerator:'1',denominator:'1',waste:'0',price:snapshot?.price,quantity_source:'MANUAL',line_role:'OTHER',is_active:true}});
}

export function createCatalogEditor({rows,record,esc,btn}){
 const $=s=>document.querySelector(s);
 const number=v=>Number(v).toLocaleString('th-TH',{maximumFractionDigits:8});
 const money=v=>Number(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:8});
 function conversion(preview){
  const panel=$('#catalog-unit-preview');if(!panel)return;
  if(preview.error){panel.innerHTML='<p class="catalog-preview-pending">รอแก้ข้อมูล: '+esc(preview.error)+'</p>';return;}
  const p=catalogUnitPreview(preview.snapshot),s=preview.snapshot;
  if(p.status!=='READY'){panel.innerHTML='<p class="catalog-preview-pending">รอข้อมูล: '+esc(p.reason)+'</p>';return;}
  panel.innerHTML=`<h3>แปลงราคาต่อหน่วยใช้</h3><p>1 ${esc(s.purchase_unit)} = ${number(s.yield)} ${esc(s.usage_unit)}</p><p>${money(p.result.price_snapshot)} บาท ÷ ${number(s.yield)} = <strong>${money(p.result.unit_cost)} บาท/${esc(s.usage_unit)}</strong></p><small>ราคาในคลัง · ไม่เปลี่ยน snapshot โครงการ · ค่าที่แก้ยังไม่บันทึก</small>`;
 }
 function fieldsForMethod(form){const method=form.elements.conversion_method?.value;if(!method)return;const visible={DIRECT:[],COUNT:['pack_count'],COUNT_LENGTH:['pack_count','length_m'],AREA:['width_m','length_m'],VOLUME:['volume_l'],AREA_UNIT:[],LENGTH_UNIT:[]}[method]??[];for(const key of ['pack_count','length_m','width_m','volume_l']){const label=form.elements[key]?.closest('label');if(label)label.hidden=!visible.includes(key);}const note=$('#catalog-area-unit-note');if(note){const unit=record('units',form.elements.purchase_unit_id.value)?.name;const length=method==='LENGTH_UNIT',factors=length?lengthUnits:areaUnits,target=length?'เมตร':'ตร.ม.';note.hidden=!['AREA_UNIT','LENGTH_UNIT'].includes(method);note.textContent=factors[unit]?'1 '+unit+' = '+factors[unit]+' '+target+' · อัตรามาตรฐาน ไม่ต้องกรอกตัวคูณ':length?'เลือกหน่วยซื้อ ฟุต หรือ หลา และหน่วยใช้ เมตร':'เลือกหน่วยซื้อ ตร.หลา หรือ ตร.ฟุต และหน่วยใช้ ตร.ม.';}}
 function prepare({table,initial,form,fields}){
  $('#editor-note').textContent='คลังกลาง · บันทึกเฉพาะรายการนี้ · ราคาในโครงการเดิมคงเดิม';
  if(table==='cost_resources'){
   $('#editor-title').textContent=initial.id?[initial.code,initial.name].join(' · '):'เพิ่มรายการคลัง';
   for(const key of ['code','name','price','conversion_method','is_active'])form.elements[key]?.closest('label')?.classList.add('rate-field-wide');
   for(const [key,text]of [['purchase_unit_id','หน่วยซื้อ *'],['usage_unit_id','หน่วยใช้ *']])if(form.elements[key])form.elements[key].closest('label').firstChild.textContent=text;
   for(const key of ['code','name','price','purchase_unit_id','usage_unit_id','conversion_method','pack_count','length_m','width_m','volume_l','is_active'])if(form.elements[key])fields.append(form.elements[key].closest('label'));
   const extra=document.createElement('details');extra.className='rate-editor-extra catalog-editor-extra';extra.innerHTML='<summary>ประเภท / ขอบเขต / ขั้นซื้อ / หมายเหตุ</summary><div class="form-grid"></div>';
   for(const key of ['cost_type_id','resource_kind','increment','scope_key','covered_scopes','notes'])if(form.elements[key])extra.querySelector('.form-grid').append(form.elements[key].closest('label'));fields.after(extra);
   const panel=document.createElement('div');panel.id='catalog-unit-preview';panel.className='catalog-unit-preview';panel.setAttribute('aria-live','polite');fields.after(panel);
   const areaNote=document.createElement('p');areaNote.id='catalog-area-unit-note';areaNote.className='hint';areaNote.setAttribute('aria-live','polite');panel.before(areaNote);
   const purchase=form.elements.purchase_unit_id,method=form.elements.conversion_method,usage=form.elements.usage_unit_id;
   const setUsage=name=>{const unit=rows('units').find(u=>u.name===name);if(unit)usage.value=unit.id;};
   purchase.addEventListener('change',()=>{const unit=record('units',purchase.value)?.name??'';if(Object.hasOwn(areaUnits,unit)){method.value='AREA_UNIT';setUsage('ตร.ม.');}else if(Object.hasOwn(lengthUnits,unit)){method.value='LENGTH_UNIT';setUsage('เมตร');}fieldsForMethod(form);});
   method.addEventListener('change',()=>{if(method.value==='AREA_UNIT')setUsage('ตร.ม.');else if(method.value==='LENGTH_UNIT')setUsage('เมตร');fieldsForMethod(form);});
   if(initial.id){const resource=record('cost_resources',initial.id),unit=k=>record('units',resource[k])?.name,type=record('cost_types',resource.cost_type_id);conversion({snapshot:{code:resource.code,name:resource.name,price:resource.price===''?null:resource.price,yield:resource.yield,increment:resource.increment,purchase_unit:unit('purchase_unit_id'),usage_unit:unit('usage_unit_id'),type:type?.code==='LABOR'?'LABOR':'MATERIAL',resourceKind:resource.resource_kind}});}
   else panel.innerHTML='<p class="hint">กรอกหน่วย ราคา และข้อมูลบรรจุ เพื่อดูการแปลงราคา · ยังไม่บันทึก</p>';
   fieldsForMethod(form);
   if(initial.id&&(initial.resource_kind==='BUNDLE'||rows('modular_products').some(x=>x.resource_id===initial.id)))related(initial,fields,panel,extra);
  }else{
   const root=record('cost_resources',initial.bundle_resource_id??initial.resource_id);
   $('#editor-title').textContent=(table==='modular_products'?'สเปก VS Modular':'ส่วนประกอบในชุด')+' · '+(root?.code??'');
   for(const key of ['child_resource_id','notes','source_reference','is_active'])form.elements[key]?.closest('label')?.classList.add('rate-field-wide');
   if(table==='modular_products')$('#editor-note').textContent='ขนาดเป็นมิลลิเมตร · บันทึกสเปกแล้วรายการจะแสดงในแท็บ VS Modular · คงสูตรราคาเดิม';
  }
 }
 function related(resource,fields,panel,extra){
  const tabs=document.createElement('div');tabs.id='catalog-editor-tabs';tabs.className='catalog-editor-tabs';tabs.innerHTML='<button type="button" data-catalog-inspector-tab="main" aria-pressed="true">ข้อมูลหลัก</button><button type="button" data-catalog-inspector-tab="related" aria-pressed="false">ของในชุด / VS Modular</button>';fields.before(tabs);
  const content=document.createElement('div');content.id='catalog-related';content.hidden=true;
  const parts=rows('resource_bundle_items').filter(x=>x.bundle_resource_id===resource.id),specs=rows('modular_products').filter(x=>x.resource_id===resource.id);
  const action=(text,attrs)=>btn(text,'type="button" '+attrs);
  content.innerHTML=`<div class="catalog-related-heading"><h3>ส่วนประกอบในชุด</h3>${action('+ ส่วนประกอบ','data-add="resource_bundle_items"')}</div><p class="hint">กำหนดของรวม/ไม่รวมตามข้อมูลจริง ไม่บวกต้นทุนซ้ำ</p><div class="catalog-related-list">${parts.map(x=>{const r=record('cost_resources',x.child_resource_id);return `<div><strong>${esc(r?.code)} · ${esc(r?.name)}</strong><small>${esc({INCLUDED:'รวมในชุด',EXCLUDED:'ไม่รวมในชุด',UNKNOWN:'รอตรวจขอบเขต'}[x.inclusion_status])} · ${esc(x.quantity||'รอจำนวน')}</small><span>${action('แก้',`data-edit="resource_bundle_items" data-id="${x.id}"`)}${action('ลบ',`data-delete="resource_bundle_items" data-id="${x.id}"`)}</span></div>`;}).join('')||'<p class="hint">ยังไม่มีส่วนประกอบในชุด</p>'}</div><div class="catalog-related-heading"><h3>สเปก VS Modular</h3>${specs.length?'':action('+ เพิ่มสเปก','data-add="modular_products"')}</div>${specs.map(x=>`<div class="catalog-spec"><strong>${esc(x.width_mm||'—')} × ${esc(x.height_mm||'—')} × ${esc(x.depth_mm||'—')} มม.</strong><p>${esc(x.notes??'')}</p>${action('แก้สเปก',`data-edit="modular_products" data-id="${x.id}"`)}${action('ลบสเปก',`data-delete="modular_products" data-id="${x.id}"`)}</div>`).join('')||'<p class="hint">ยังไม่มีสเปก VS Modular</p>'}`;
  extra.after(content);
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{const related=b.dataset.catalogInspectorTab==='related';fields.hidden=panel.hidden=extra.hidden=related;content.hidden=!related;tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 }
 function clear(){document.querySelector('#editor-fields').hidden=false;document.querySelectorAll('#catalog-editor-tabs,#catalog-related,#catalog-unit-preview,#catalog-area-unit-note').forEach(el=>el.remove());}
 return {prepare,clear,updateFields:fieldsForMethod,showPreview:conversion,openRelated:()=>document.querySelector('[data-catalog-inspector-tab="related"]')?.click()};
}
