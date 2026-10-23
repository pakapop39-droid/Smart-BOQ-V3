export const sameCostLine=(a,b)=>a.costLineId&&b.costLineId?a.costLineId===b.costLineId:a.code===b.code&&(a.componentGroupId??null)===(b.componentGroupId??null);
// Edits affect only the selected component, never the shared resource catalog.
export function addCostLine(rows,resource,component){
 if(!resource)throw Error('เลือกรายการจากคลังตัวอย่างก่อน');
 if(component==='S001'&&resource.code==='ST01')throw Error('ท็อปหินอยู่ S002 แยกจากต้นทุนตู้');
 if(rows.some(l=>l.code===resource.code&&!l.componentGroupId))throw Error('มีรายการนี้แล้ว แก้ปริมาณในแถวเดิมได้');
 const modular=resource.code.startsWith('b-');
 const row={costLineId:crypto.randomUUID(),componentId:component,componentGroupId:null,lineRole:'OTHER',quantitySource:'MANUAL',code:resource.code,numerator:'1',denominator:'1',basis:modular?'TOTAL':'PER_UNIT',waste:'0'};
 if(component==='S001'&&resource.code==='LM01'){row.numerator='5.04';row.basis='TOTAL';}
 rows.push(row);return row;
}
export function removeCostLine(rows,index){if(!Number.isInteger(index)||index<0||index>=rows.length)throw Error('ไม่พบแถวต้นทุน');return {index,line:rows.splice(index,1)[0]};}
export function restoreCostLine(rows,entry){
 if(rows.some(l=>sameCostLine(l,entry.line)))throw Error('รายการนี้ถูกเพิ่มกลับแล้ว หากต้องการคืนค่าเดิมให้ลบแถวที่เพิ่มก่อน');
 rows.splice(Math.min(entry.index,rows.length),0,entry.line);
}
export function removeCostBatch(rows,indices){
 const ordered=[...new Set(indices)].sort((a,b)=>b-a);
 if(ordered.some(i=>!Number.isInteger(i)||i<0||i>=rows.length))throw Error('ไม่พบแถวต้นทุน');
 return {entries:ordered.map(i=>removeCostLine(rows,i))};
}
export function restoreCostBatch(rows,batch){
 if(batch.entries.some(e=>rows.some(l=>sameCostLine(l,e.line))))throw Error('มีรายการที่ถูกเพิ่มกลับแล้ว กรุณาลบแถวใหม่ก่อนเลิกทำชุดเดิม');
 for(const entry of [...batch.entries].sort((a,b)=>a.index-b.index))restoreCostLine(rows,entry);
}
