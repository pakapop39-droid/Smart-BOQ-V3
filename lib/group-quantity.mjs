import Decimal from 'decimal.js';
const D=Decimal.clone({precision:80});
const sources={FRAME:'PANEL_AREA',PLYWOOD:'PLYWOOD_AREA',LAMINATE:'LAMINATE_AREA',ADHESIVE:'LAMINATE_AREA'};
export const number=(value,label,positive=false)=>{if(!/^\d+(?:\.\d{1,8})?$/.test(String(value))||(positive&&new D(value).lte(0)))throw Error('กรอก '+label+(positive?' มากกว่า 0':' ให้ครบ'));return new D(value);};
export function resolveGroupLine(line,group){
 if(!group||line.componentId!==group.componentId||line.componentGroupId!==group.id)throw Error('บรรทัดวัสดุอ้างกลุ่มคนละงาน');
 if(line.basis!=='TOTAL'||line.quantitySource!==sources[line.lineRole])throw Error('ฐานปริมาณวัสดุแผงไม่ตรงบทบาท');
 if(['PLYWOOD','LAMINATE'].includes(line.lineRole)&&(line.numerator!=='1'||line.denominator!=='1')||line.lineRole==='FRAME'&&line.denominator!=='1'||line.lineRole==='ADHESIVE'&&line.numerator!=='1')throw Error('อัตราวัสดุไม่ตรงบทบาท');
 const a=number(group.area,'พื้นที่แผงด้านเดียว',true);
 if(!['1','2'].includes(group.plySides)||!['0','1','2'].includes(group.lamSides)||Number(group.lamSides)>Number(group.plySides))throw Error('จำนวนด้านปิดผิวต้องไม่เกินด้านบุไม้อัด');
 if(['LAMINATE','ADHESIVE'].includes(line.lineRole)&&group.lamSides==='0')return null;
 const factor=line.quantitySource==='PANEL_AREA'?1:line.quantitySource==='PLYWOOD_AREA'?group.plySides:group.lamSides;
 return {area:a.mul(factor).toString(),numerator:line.numerator,denominator:line.denominator};
}
