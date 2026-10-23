import {resolveGroupLine} from './group-quantity.mjs';
import Decimal from 'decimal.js';
const D=Decimal.clone({precision:80,rounding:Decimal.ROUND_HALF_UP});
const num=(v,label,positive=false,scale=8)=>{if(!new RegExp('^\\d+(?:\\.\\d{1,'+scale+'})?$').test(String(v)))throw Error(`กรอก ${label} เป็นตัวเลขไม่ติดลบ`);const n=new D(v);if(positive&&n.lte(0))throw Error(`${label} ต้องมากกว่า 0`);return n;};
const money=n=>n.toFixed(2);
export function calculateLive(payload){
 const resources=new Map(payload.resources.map(r=>[r.code,{...r}]));
 // Reference-only contents may have no standalone price or purchase conversion.
 const purchaseData=r=>{if(!r.p){r.p=num(r.price,`ราคาอ้างอิง ${r.code}`);r.y=num(r.yield,`ตัวแปลง ${r.code}`,true,12);r.inc=num(r.increment,`ขั้นซื้อ ${r.code}`,true);}return r;};
 const usage=new Map(),usageSources=new Map();let cost=new D(0),sale=new D(0),labor=new D(0),budget=new D(0);
 const components=payload.components.map(c=>{
  const q=num(c.quantity,'ปริมาณขาย',true),margin=num(c.margin,'กำไร');if(margin.gte(100))throw Error('กำไรต้องต่ำกว่า 100%');let raw=new D(0),directCost=new D(0);const breakdown=new Map(),groupLabor=new Map(),groupCosts=new Map(),computed=new Map();
  const eligible=c.lines.filter(l=>{if(!l.componentGroupId)return true;const g=c.groups?.find(g=>g.id===l.componentGroupId);if(!g||g.componentId!==c.code||l.componentId!==c.code)throw Error('บรรทัดวัสดุอ้างกลุ่มคนละงาน');return g.active&&!(g.lamSides==='0'&&l.quantitySource==='LAMINATE_AREA');});
  function charged(l){const resource=resources.get(l.code);if(!resource)throw Error(`ไม่พบรายการ ${l.code}`);const r=purchaseData(resource);if(!['TOTAL','PER_UNIT'].includes(l.basis))throw Error('เลือกฐานปริมาณให้ครบ');
   const g=l.componentGroupId?c.groups.find(g=>g.id===l.componentGroupId):null;
   let source=null;if(g&&l.quantitySource==='GROUP_QUANTITY')source={area:num(g.quantity,'จำนวนชุด',true).toString()};else if(g&&l.quantitySource&&l.quantitySource!=='MANUAL')source=resolveGroupLine(l,g);
   const used=(source?num(source.area,'พื้นที่หรือจำนวนชุด'):new D(1)).mul(num(l.numerator,`ปริมาณ ${l.code}`)).div(num(l.denominator,`จำนวนหาร ${l.code}`,true)).mul(num(l.waste,`เผื่อเศษ ${l.code}`).div(100).plus(1)).mul(l.basis==='PER_UNIT'?q:1);
   if(l.bundleSnapshot&&(l.basis!=='TOTAL'||!used.isInteger()||used.lte(0)))throw Error('สินค้าชุดต้องกรอกจำนวนเต็มรวมทั้งรายการมากกว่า 0');
   const price=l.priceSnapshot===undefined?r.p:num(l.priceSnapshot,'ราคาบรรทัด '+l.code),y=l.yieldSnapshot===undefined?r.y:num(l.yieldSnapshot,'ตัวแปลงบรรทัด '+l.code,true,12);
   if(l.usageUnitSnapshot!==undefined&&(l.usageUnitSnapshot!==r.usage_unit||l.purchaseUnitSnapshot!==r.purchase_unit||!y.eq(r.y)||l.typeSnapshot!==r.type))throw Error('หน่วยหรือขนาดบรรจุของวัสดุไม่ตรง snapshot '+l.code);
   const rate=price.div(y),lineCost=used.mul(rate);const key=g?.id??'direct',parts=breakdown.get(key)??{material_raw:new D(0),production_labor_raw:new D(0),installation_labor_raw:new D(0),unclassified_labor_raw:new D(0)};const category=r.type!=='LABOR'?'material_raw':l.laborPhase==='PRODUCTION'?'production_labor_raw':l.laborPhase==='INSTALLATION'?'installation_labor_raw':'unclassified_labor_raw';parts[category]=parts[category].plus(lineCost);breakdown.set(key,parts);raw=raw.plus(lineCost);if(g)groupCosts.set(g.id,(groupCosts.get(g.id)||new D(0)).plus(lineCost));else directCost=directCost.plus(lineCost);
   usage.set(l.code,(usage.get(l.code)||new D(0)).plus(used));usageSources.set(l.code,[...(usageSources.get(l.code)||[]),{component:c.code,componentGroupId:l.componentGroupId??null,costLineId:l.costLineId??null,additionalReason:l.additionalReason??null,additionalLocation:l.additionalLocation??null,additionalConfirmation:l.additionalConfirmation??null,usage_total:used.toString()}]);if(r.type==='LABOR'){labor=labor.plus(lineCost);if(g)groupLabor.set(g.id,(groupLabor.get(g.id)||new D(0)).plus(lineCost));}
   return {costLineId:l.costLineId??null,componentGroupId:l.componentGroupId??null,lineRole:l.lineRole??'OTHER',lineKind:'CHARGEABLE',additionalReason:l.additionalReason??null,additionalLocation:l.additionalLocation??null,additionalConfirmation:l.additionalConfirmation??null,name:l.nameSnapshot??r.name,price_snapshot:price.toString(),yield_snapshot:y.toString(),quantity_source:l.quantitySource??'MANUAL',code:l.code,usage_total:used.toString(),unit_cost:rate.toString(),cost_total:money(lineCost),usage_unit:r.usage_unit};
  }
  for(const l of eligible.filter(l=>!l.lineKind||l.lineKind==='CHARGEABLE'))computed.set(l.costLineId??l,charged(l));
  const lines=eligible.map(l=>{if(!l.lineKind||l.lineKind==='CHARGEABLE')return computed.get(l.costLineId??l);
   const parent=eligible.find(x=>x.costLineId===l.parentBundleCostLineId),parentResult=parent?computed.get(parent.costLineId):null,r=resources.get(l.code);
   if(!parentResult||!parent.bundleSnapshot||parent.componentGroupId!==l.componentGroupId||parent.componentId!==l.componentId||!r)throw Error('ส่วนประกอบอ้างชุดแม่ผิด');
   if(!['INCLUDED_REFERENCE','EXCLUDED_REFERENCE'].includes(l.lineKind)||l.priceSnapshot!==null)throw Error('ประเภทหรือราคาของรายละเอียดชุดไม่ถูกต้อง');
   const quantity=l.quantityPerParent===null?null:new D(parentResult.usage_total).mul(num(l.quantityPerParent,'จำนวนต่อชุด',true)).toString();
   return {costLineId:l.costLineId,componentGroupId:l.componentGroupId,lineRole:l.lineRole,lineKind:l.lineKind,parentBundleCostLineId:l.parentBundleCostLineId,name:l.nameSnapshot??r.name,price_snapshot:null,yield_snapshot:null,quantity_source:'PARENT_BUNDLE_USAGE',code:l.code,usage_total:quantity,unit_cost:null,cost_total:null,usage_unit:r.usage_unit};
  });
  const unit=raw.div(q),unitSale=unit.div(new D(1).minus(margin.div(100))).toDecimalPlaces(2),total=raw.toDecimalPlaces(2),sold=q.mul(unitSale).toDecimalPlaces(2);cost=cost.plus(total);sale=sale.plus(sold);
  const partsFor=id=>Object.fromEntries(Object.entries(breakdown.get(id)??{material_raw:new D(0),production_labor_raw:new D(0),installation_labor_raw:new D(0),unclassified_labor_raw:new D(0)}).map(([key,value])=>[key,value.toString()]));
  return {...c,lines,direct_breakdown:partsFor('direct'),direct_cost_raw:directCost.toString(),direct_cost_total:money(directCost),group_totals:(c.groups||[]).map(g=>({id:g.id,name:g.name,active:g.active,...(g.active?partsFor(g.id):{}),labor_raw:g.active?(groupLabor.get(g.id)||new D(0)).toString():null,cost_raw:g.active?(groupCosts.get(g.id)||new D(0)).toString():null,cost_total:g.active?money(groupCosts.get(g.id)||new D(0)):null})),cost_per_unit:unit.toString(),cost_total:money(total),sale_per_unit:money(unitSale),sale_total:money(sold),difference:money(sold.minus(total))};
 });
 const purchases=[];for(const r0 of resources.values()){if(r0.type==='LABOR'||!usage.has(r0.code))continue;const r=purchaseData(r0),used=usage.get(r.code),qty=used.div(r.y).div(r.inc).ceil().mul(r.inc),b=qty.mul(r.p).toDecimalPlaces(2);budget=budget.plus(b);purchases.push({...r,sources:usageSources.get(r.code),usage_total:used.toString(),purchase_quantity:qty.toString(),purchase_budget:money(b),theoretical_remainder:qty.mul(r.y).minus(used).toString()});}
 labor=labor.toDecimalPlaces(2);return {components,purchases,cost_total:money(cost),sale_total:money(sale),difference:money(sale.minus(cost)),material_purchase_budget:money(budget),labor_total:money(labor),combined_budget:money(budget.plus(labor)),cash_difference:money(sale.minus(budget).minus(labor)),data_status:'SAMPLE',persisted:false};
}
