// Library-first workflow. All pricing and snapshots remain owned by the existing local API.
export function filterReadyRates(rates,search='') {
 const query=search.trim().toLocaleLowerCase('th-TH');
 return rates.filter(t=>t.status==='READY'&&t.is_active!==false)
  .filter(t=>!query||`${t.code} ${t.name}`.toLocaleLowerCase('th-TH').includes(query));
}
export function validWorkContext(tables,context) {
 return !!context&&(tables.projects??[]).some(p=>p.id===context.project_id)
  &&(tables.work_items??[]).some(w=>w.id===context.work_id&&w.project_id===context.project_id);
}
export function createRateFlow(ctx) {
 const {esc,btn,grid,money,api,refresh,message,run,rows,record,label}=ctx,$=s=>document.querySelector(s);
 let returnContext=null,quantityBusy=false;
 const context=()=>({project_id:ctx.projectId(),work_id:ctx.workId()});
 const valid=c=>validWorkContext(ctx.db().tables,c);
 function returnBanner() {
  if(!returnContext)return '';
  if(!valid(returnContext)){returnContext=null;return '';}
  return `<div class="library-flow-return"><span>กำลังเตรียมราคาขายให้ ${esc(label('projects',returnContext.project_id))} → ${esc(label('work_items',returnContext.work_id))}</span>${btn('กลับ Keyplan เพื่อเลือกราคาขาย','id="return-keyplan"',true)}</div>`;
 }
 async function goToLibrary(c,create=false) {
  if(!valid(c))throw Error('ไม่พบ Keyplan ในโครงการนี้ กรุณาเปิดงานใหม่');returnContext={...c};
  await ctx.openRates();if(create)ctx.edit('rate_templates');message('เตรียมกลุ่มวัตถุดิบ ต้นทุน กำไร และราคาขายต่อหน่วยในคลังก่อน แล้วตั้งพร้อมใช้เพื่อเลือกเข้า Keyplan');
 }
 function wire() {
  if($('#return-keyplan'))$('#return-keyplan').onclick=()=>run(async()=>{const c=returnContext;if(!valid(c)){returnContext=null;throw Error('Keyplan ต้นทางไม่อยู่แล้ว กรุณาเลือกโครงการใหม่');}await ctx.openProject(c);openPicker();});
  const inputs=[...document.querySelectorAll('[data-actual-quantity]')];inputs.forEach(input=>{
   input.disabled=quantityBusy;
   input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}};
   input.onchange=()=>run(async()=>{
    if(quantityBusy)return;const id=input.dataset.actualQuantity,c=record('work_components',id),p=ctx.project(),w=record('work_items',c?.work_item_id),value=input.value.trim();
    if(!c||!p||w?.project_id!==p.id)throw Error('รายการนี้ไม่อยู่ในโครงการที่เปิด');if(value===String(c.quantity))return;
    quantityBusy=true;document.querySelectorAll('[data-actual-quantity]').forEach(i=>i.disabled=true);message('กำลังบันทึกปริมาณจริงและคำนวณ…');
    try{await api('/records/work_components',{...c,quantity:value,version:c.version,project_version:p.version});await refresh();message('บันทึกปริมาณจริงและคำนวณราคาจากสำเนาโครงการแล้ว');}
    catch(e){await refresh();const current=document.querySelector(`[data-actual-quantity="${id}"]`);if(current){current.value=value;current.setAttribute('aria-invalid','true');const hint=document.createElement('small');hint.className='error';hint.textContent='ยังไม่บันทึก: '+e.message;current.after(hint);}message('ยังไม่บันทึกปริมาณ: '+e.message,true);}
    finally{quantityBusy=false;document.querySelectorAll('[data-actual-quantity]').forEach(i=>i.disabled=false);}
   });
  });
 }
 function openPicker() {
  const scope=context();if(!valid(scope))throw Error('เลือก Keyplan ภายในโครงการก่อน');
  let dialog=$('#sale-rate-picker');if(!dialog){dialog=document.createElement('dialog');dialog.id='sale-rate-picker';document.body.append(dialog);}
  let search='',selected=null,quantity='1';
  function render() {
   const list=filterReadyRates(rows('rate_templates'),search),ready=filterReadyRates(rows('rate_templates')),t=list.find(t=>t.id===selected);if(!t)selected=null;
   dialog.innerHTML=`<form id="sale-rate-picker-form"><div class="toolbar"><h2>เลือกรายการราคาขายจากคลัง</h2><button type="button" id="sale-picker-close">ปิด</button></div><p>Keyplan ${esc(label('work_items',scope.work_id))} · เลือกราคาที่เตรียมไว้ แล้วกรอกปริมาณจริงตามแบบ</p><label>ค้นหารหัสหรือชื่อรายการ<input id="sale-rate-search" value="${esc(search)}" placeholder="เช่น ตู้เตี้ย ท็อปหิน"></label>${ready.length?grid(['เลือก','รหัส / รายการ','รุ่น','หน่วยขาย','ต้นทุน/หน่วย','ราคาขาย/หน่วย'],list.map(r=>`<tr class="${r.id===selected?'selected-row':''}"><td><input type="radio" name="rate_id" data-sale-rate="${r.id}" value="${r.id}" ${r.id===selected?'checked':''} aria-label="เลือก ${esc(r.code+' '+r.name)}"></td><td>${esc(r.code)}<small>${esc(r.name)}</small></td><td>${esc(r.revision)}</td><td>${esc(label('units',r.unit_id))}</td><td class="num">${money(r.unit_cost)}</td><td class="num">${money(r.unit_sale)}</td></tr>`).join('')):'<div class="library-empty"><h3>ยังไม่มีรายการราคาขายที่พร้อมเลือก</h3><p>สร้างรายการในคลัง ใส่กลุ่มวัตถุดิบต้นทุน วัสดุ ค่าแรง และกำไร ตรวจราคาแล้วตั้งพร้อมใช้ จากนั้นกลับมาเลือกเข้า Keyplan นี้ได้</p><button type="button" id="create-library-rate" class="primary">สร้างรายการราคาขายในคลัง</button></div>'}<div class="sale-picker-quantity"><label>ปริมาณจริงตามแบบ<input name="quantity" id="sale-actual-quantity" value="${esc(quantity)}" required inputmode="decimal" autocomplete="off"></label><strong>${t?esc(label('units',t.unit_id)):'เลือกหน่วยจากรายการในคลัง'}</strong></div><p class="hint">ระบบเก็บสเปกและราคาของรุ่นที่เลือกเป็นสำเนาโครงการ การแก้คลังภายหลังไม่เปลี่ยนงานนี้ · หน้ารายการ Keyplan จะคำนวณยอดหลังเพิ่ม</p><p id="sale-picker-error" class="error"></p><div class="toolbar"><button type="submit" id="sale-picker-import" class="primary" ${selected?'':'disabled'}>เพิ่มเข้ารายการ Keyplan และคำนวณ</button><button type="button" id="prepare-library-rate">ไปคลังเพื่อเตรียมหรือแก้ราคาก่อน</button></div></form>`;
   $('#sale-picker-close').onclick=()=>dialog.close();$('#sale-rate-search').oninput=e=>{const pos=e.target.selectionStart;search=e.target.value;selected=null;render();$('#sale-rate-search').focus();$('#sale-rate-search').setSelectionRange(pos,pos);};
   $('#sale-actual-quantity').oninput=e=>quantity=e.target.value;
   dialog.querySelectorAll('[data-sale-rate]').forEach(input=>input.onchange=()=>{selected=input.dataset.saleRate;render();$('#sale-actual-quantity').focus();});
   $('#prepare-library-rate').onclick=()=>run(async()=>{dialog.close();await goToLibrary(scope);});
   if($('#create-library-rate'))$('#create-library-rate').onclick=()=>run(async()=>{dialog.close();await goToLibrary(scope,true);});
   $('#sale-rate-picker-form').onsubmit=async e=>{e.preventDefault();const button=$('#sale-picker-import');button.disabled=true;try{
    if(!valid(scope)||ctx.projectId()!==scope.project_id||ctx.workId()!==scope.work_id)throw Error('บริบท Keyplan เปลี่ยน กรุณาปิดแล้วเลือกใหม่');
    const t=record('rate_templates',selected);if(!t||t.status!=='READY'||t.is_active===false)throw Error('เลือกรายการพร้อมใช้ก่อน');
    await api('/rate-import',{template_id:t.id,template_version:t.version,work_item_id:scope.work_id,quantity,project_version:ctx.project().version});dialog.close();returnContext=null;await ctx.openProject(scope);message('เพิ่มราคาจากคลัง เก็บสำเนาโครงการ และคำนวณปริมาณจริงแล้ว');
   }catch(error){$('#sale-picker-error').textContent=error.message;button.disabled=!selected;}};
  }
  render();dialog.showModal();
 }
 return {returnBanner,wire,openPicker,goToLibrary};
}
