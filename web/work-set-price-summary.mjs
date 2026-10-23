import Decimal from 'decimal.js';
const D=Decimal.clone({precision:80,rounding:Decimal.ROUND_HALF_UP});
// Display uses the parent's selling quantity, never the panel area or purchase units.
export function workSetPriceSummary(component,groupId){
 if(!component)return null;
 const group=component.group_totals?.find(g=>g.id===groupId);
 const raw=groupId==='direct'?component.direct_cost_raw:group?.active?group.cost_raw:null;
 if(raw===null||raw===undefined)return null;
 const quantity=new D(component.quantity);
 if(!quantity.isFinite()||quantity.lte(0))return null;
 return {laborTotal:group?.labor_raw===undefined?null:new D(group.labor_raw??0).toFixed(2),quantity:quantity.toString(),unit:component.unit,total:new D(raw).toFixed(2),perUnit:new D(raw).div(quantity).toFixed(2),componentTotal:component.cost_total,componentPerUnit:new D(component.cost_per_unit).toFixed(2),salePerUnit:component.sale_per_unit};
}
