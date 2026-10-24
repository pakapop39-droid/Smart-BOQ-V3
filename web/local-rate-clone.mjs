export function openRateCloneDialog({template,api,onCloned}){
 if(document.querySelector('#rate-clone-dialog'))return;
 const dialog=document.createElement('dialog');dialog.id='rate-clone-dialog';
 dialog.innerHTML='<form><h3>ทำสำเนาเป็นรายการราคาใหม่</h3><p>คัดลอกส่วนประกอบ วัสดุ ค่าแรง และของในชุดทุกชั้น สร้างรหัสใหม่เป็นร่าง โดยไม่เปลี่ยนต้นแบบเดิม</p><label>ชื่อรายการราคาใหม่<input name="name" required maxlength="200" autocomplete="off"></label><p class="error" role="status"></p><div class="toolbar"><button type="submit" class="primary">สร้างสำเนาร่าง</button><button type="button" data-cancel>ยกเลิก</button></div></form>';
 const form=dialog.querySelector('form'),input=form.elements.name,error=dialog.querySelector('.error');input.value=template.name+' — สำเนา';
 const close=()=>{dialog.close();dialog.remove();};dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();if(!form.querySelector('[type=submit]').disabled)close();};
 form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);error.textContent='';
  let copy;try{copy=await api('/rate-clone',{id:template.id,version:template.version,name:input.value});}catch(err){error.textContent=err.message;buttons.forEach(b=>b.disabled=false);return;}
  close();await onCloned(copy);
 };document.body.append(dialog);dialog.showModal();input.focus();input.select();
}
