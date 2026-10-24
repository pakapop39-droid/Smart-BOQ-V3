import {selectedCostActive} from './cost-line-policy.mjs';
// Reuse the existing editor and submit handler; no parallel edit state or price formula.
export function createRateDrawer({api,render,showDraft,clearDraft,catalogEditor,onAction}){
 let session=null,timer,sequence=0,permitClick=false;
 const dialog=()=>document.querySelector('#editor'),form=()=>document.querySelector('#editor-form');
 const value=()=>JSON.stringify([...new FormData(form())]);
 const dirty=()=>!!session&&dialog().open&&value()!==session.baseline;
 async function leave(){
  if(!dirty())return true;
  const choice=await new Promise(resolve=>{const d=document.createElement('dialog');d.className='rate-unsaved';d.innerHTML='<h3>มีข้อมูลที่ยังไม่ได้บันทึก</h3><p>ต้องการจัดการค่าที่แก้ไว้ก่อนออกจากรายการนี้อย่างไร?</p><div class="rate-toolbar"><button data-choice="save" class="primary">บันทึกแล้วไปต่อ</button><button data-choice="discard">ทิ้งการแก้ไข</button><button data-choice="stay">อยู่แก้ต่อ</button></div>';document.body.append(d);d.oncancel=e=>{e.preventDefault();d.close();d.remove();resolve('stay');};d.onclick=e=>{const c=e.target.closest('[data-choice]');if(c){d.close();d.remove();resolve(c.dataset.choice);}};d.showModal();});
  if(choice==='stay')return false;
  if(choice==='save'){if(!form().reportValidity())return false;await form().onsubmit({preventDefault(){},fromGuard:true});return !dialog().open;}
  session.baseline=value();clearTimeout(timer);sequence++;clearDraft();render();return true;
 }
 function cleanup(){clearTimeout(timer);sequence++;session=null;clearDraft();form()._rateDrawerCleanup?.();document.querySelector('#app').classList.remove('rate-drawer-open');dialog().classList.remove('rate-editor-drawer');}
 function init(){
  const d=dialog();d.addEventListener('close',()=>{cleanup();render();});
  form().addEventListener('invalid',e=>{if(!session)return;const extra=e.target.closest('details');if(extra)extra.open=true;if(document.querySelector('#editor-fields')?.hidden)document.querySelector('[data-catalog-inspector-tab="main"]')?.click();},true);
  d.addEventListener('cancel',e=>{if(!session)return;e.preventDefault();close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&session&&d.open&&!document.querySelector('dialog[open]:not(#editor)')){e.preventDefault();close();}});
  document.querySelector('#editor-close').onclick=document.querySelector('#editor-cancel').onclick=()=>close();
  window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
  document.addEventListener('click',async e=>{
   if(permitClick||!session||!d.open||e.target.closest('dialog:not(#editor)'))return;
   const target=e.target.closest('button,input[type=file],[data-rate-open],[data-rate-line-open],[data-rate-drill],[data-rate-drill-line],[data-rate-leaf],[data-catalog-open]');if(!target)return;
   if(e.target.closest('#editor')&&!target.matches('[data-edit],[data-add],[data-delete]'))return;
   e.preventDefault();e.stopImmediatePropagation();
   const attrs=[...target.attributes].filter(a=>a.name==='id'||a.name.startsWith('data-')).map(a=>[a.name,a.value]);
   const allowed=await leave();if(!allowed)return;
   const keep=target.matches('[data-edit^="rate_"],[data-add^="rate_"],[data-rate-line-open],[data-rate-leaf],[data-catalog-open]')||['cost_resources','resource_bundle_items','modular_products'].includes(target.dataset.edit??target.dataset.add);
   if(!keep&&d.open){d.close();await new Promise(resolve=>d.addEventListener('close',resolve,{once:true}));}
   const fresh=target.isConnected?target:[...document.querySelectorAll(target.tagName.toLowerCase())].find(el=>attrs.length&&attrs.every(([k,v])=>el.getAttribute(k)===v));
   if(fresh){permitClick=true;fresh.click();permitClick=false;}else onAction?.(target.dataset);
  },true);
 }
 async function close(){if(!session){dialog().close();return;}if(await leave()){if(dialog().open)dialog().close();}}
 function open({table,initial}){
  clearTimeout(timer);sequence++;session={table,initial,baseline:value()};
  const d=dialog(),f=form();d.classList.add('rate-editor-drawer');document.querySelector('#app').classList.add('rate-drawer-open');
  if(!f.querySelector('.rate-editor-actions')){const actions=document.createElement('div');actions.className='rate-editor-actions';const save=f.querySelector('[type=submit]'),cancel=document.querySelector('#editor-cancel');save.before(actions);actions.append(save,cancel);}
  const fields=document.querySelector('#editor-fields'),extra=document.createElement('details');extra.className='rate-editor-extra';extra.innerHTML='<summary>รายละเอียดเพิ่มเติม</summary><div class="form-grid"></div>';
  const isCatalog=['cost_resources','resource_bundle_items','modular_products'].includes(table);
  const optional=isCatalog?[]:table==='rate_template_cost_lines'?['line_role','additional_reason','additional_location','notes',...(initial.snapshot?.type!=='LABOR'?['labor_phase']:[])]:['quotation_description','notes'];
  if(table==='rate_template_cost_lines'){document.querySelector('#editor-title').textContent=initial.snapshot?[initial.snapshot.code,initial.snapshot.name].join(' · '):'เพิ่มต้นทุนต่อ 1 หน่วยขาย';document.querySelector('#editor-note').textContent='แก้ต้นแบบคลัง · ผลคำนวณระหว่างกรอกยังไม่บันทึก';}
  for(const name of ['resource_id','numerator','price','quantity_source','is_active'])f.elements[name]?.closest('label')?.classList.add('rate-field-wide');
  for(const name of optional){const input=f.elements[name];if(input)extra.querySelector('.form-grid').append(input.closest('label'));}if(extra.querySelector('label'))fields.after(extra);
  const preview=document.querySelector('#rate-line-preview');if(preview)fields.after(preview);
  if(isCatalog)catalogEditor.prepare({table,initial,form:f,fields});
  let update=()=>{
   if(!session||session.table!==table)return;
   clearTimeout(timer);const version=++sequence;if(isCatalog)catalogEditor.updateFields(f);
   document.querySelector('#editor-save-state')?.remove();const note=document.createElement('p');note.id='editor-save-state';note.className='hint';note.textContent=dirty()?'มีการแก้ไข · ยังไม่บันทึก':'ข้อมูลที่บันทึกแล้ว';document.querySelector('#editor-note').after(note);
   if(isCatalog){if(table==='cost_resources')timer=setTimeout(async()=>{try{const data={...initial,...Object.fromEntries(new FormData(f)),is_active:selectedCostActive(table,f)},preview=await api('/catalog-draft-preview',data);if(session&&version===sequence)catalogEditor.showPreview(preview);}catch(error){if(session&&version===sequence)catalogEditor.showPreview({error:error.message});}},140);return;}
   timer=setTimeout(async()=>{try{const data={...initial,...Object.fromEntries(new FormData(f)),is_active:selectedCostActive(table,f)};const preview=await api('/rate-draft-preview',{table,data});if(session&&version===sequence)showDraft(preview,table,data);}catch(error){if(session&&version===sequence)showDraft({errors:[{error:error.message}]},table,{...initial,...Object.fromEntries(new FormData(f))});}},140);
  };
  // Replace only listeners belonging to this drawer session.
  f._rateDrawerCleanup?.();f.addEventListener('input',update);f.addEventListener('change',update);f._rateDrawerCleanup=()=>{f.removeEventListener('input',update);f.removeEventListener('change',update);};
  session.baseline=value();if(!d.open)d.show();
 }
 return {init,open,close};
}
