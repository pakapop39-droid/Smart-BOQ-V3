import Decimal from 'decimal.js';
const D=Decimal.clone({precision:80});
export const panelCodes=['WD01','PLY01','LM01','GL01'];
export const defaultPanel=()=>({enabled:true,area:'10',plySides:'2',lamSides:'2',woodRate:'',glueCoverage:''});
export function panelQuantities(p,{rates=true}={}){
 const number=(v,label)=>{if(!/^\d+(?:\.\d{1,6})?$/.test(String(v))||new D(v).lte(0))throw Error('กรอก '+label+' มากกว่า 0 (ทศนิยมไม่เกิน 6 ตำแหน่ง)');return new D(v);};
 const area=number(p.area,'พื้นที่แผงด้านเดียว');
 if(!['1','2'].includes(p.plySides)||!['0','1','2'].includes(p.lamSides)||Number(p.lamSides)>Number(p.plySides))throw Error('จำนวนด้านปิดลามิเนตต้องไม่เกินด้านบุไม้อัด');
 const ply=area.mul(p.plySides),lam=area.mul(p.lamSides);
 const out={area:area.toString(),ply:ply.toString(),lam:lam.toString()};
 if(rates){out.wood=area.mul(number(p.woodRate,'อัตราไม้โครงต่อ ตร.ม.')).toString();out.glueNumerator=lam.toString();out.glueDenominator=lam.isZero()?'1':number(p.glueCoverage,'พื้นที่ครอบคลุมกาวต่อหนึ่งลิตร').toString();}
 return out;
}
export function installPanelRows(rows){
 const rest=rows.filter(l=>!['PN01','ED01',...panelCodes].includes(l.code));
 return [...panelCodes.map(code=>({code,numerator:'0',denominator:'1',basis:'TOTAL',waste:rows.find(l=>l.code===code)?.waste??'0'})),...rest];
}
export function applyPanel(payload,p){
 const q=panelQuantities(p),cabinet=payload.components.find(c=>c.code==='S001');
 if(cabinet.lines.some(l=>['PN01','ED01'].includes(l.code))||panelCodes.some(code=>!cabinet.lines.some(l=>l.code===code)))throw Error('รายการวัสดุแผงตู้ไม่ครบ กรุณากดคืนวัสดุแผงตู้');
 const amounts={WD01:q.wood,PLY01:q.ply,LM01:q.lam,GL01:q.glueNumerator};
 cabinet.lines=cabinet.lines.map(l=>panelCodes.includes(l.code)?{...l,numerator:amounts[l.code],denominator:l.code==='GL01'?q.glueDenominator:'1',basis:'TOTAL'}:l);
 return payload;
}
