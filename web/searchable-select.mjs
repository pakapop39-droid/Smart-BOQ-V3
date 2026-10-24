export function filterSelectOptions(options,query='',selected=''){
 const term=query.trim().normalize('NFC').toLocaleLowerCase();
 const matches=options.filter(o=>o.value&&o.text.normalize('NFC').toLocaleLowerCase().includes(term));
 const chosen=options.find(o=>o.value&&o.value===selected);
 return {matches,retained:chosen&&!matches.some(o=>o.value===selected)?chosen:null};
}

// Keep the original select and change handlers. Search never changes its value,
// participates in FormData, or writes to the database.
export function installCostResourceSearch(form){
 const select=form.elements.resource_id??form.elements.catalog_resource_id??form.elements.project_resource_id;
 if(!select||select.tagName!=='SELECT'||form.querySelector('[data-cost-resource-search]'))return;
 const choices=[...select.options].map(o=>({value:o.value,text:o.textContent,disabled:o.disabled}));
 const wrapper=document.createElement('label');wrapper.className='rate-field-wide';
 wrapper.textContent='ค้นหาวัสดุ / ค่าแรงในคลัง';
 const input=document.createElement('input');input.type='search';input.placeholder='พิมพ์รหัสหรือชื่อ เช่น LM01 หรือ ลามิเนต';
 input.autocomplete='off';input.dataset.costResourceSearch='1';
 const count=document.createElement('small');count.setAttribute('aria-live','polite');
 wrapper.append(input,count);select.closest('label').before(wrapper);
 function update(){
  const selected=select.value,{matches,retained}=filterSelectOptions(choices,input.value,selected);
  const option=(value,text,disabled=false)=>{const o=document.createElement('option');o.value=value;o.textContent=text;o.disabled=disabled;return o;};
  const placeholder=choices.find(o=>!o.value);
  select.replaceChildren(option('',placeholder?.text??'— เลือก —'),...matches.map(o=>option(o.value,o.text,o.disabled)),...(retained?[option(retained.value,retained.text+' · เลือกไว้',retained.disabled)]:[]));
  select.value=selected;
  count.textContent=matches.length?'พบ '+matches.length+' รายการ'+(retained?' · คงรายการที่เลือกไว้':''):'ไม่พบรายการ ลองเปลี่ยนคำค้น'+(retained?' · คงรายการที่เลือกไว้':'');
 }
 input.addEventListener('input',e=>{e.stopPropagation();update();});
 input.addEventListener('change',e=>e.stopPropagation());
 update();
}
