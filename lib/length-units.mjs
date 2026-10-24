// Exact international units, NIST SP 811 Appendix B (not U.S. survey feet).
// https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors
export const lengthUnits=Object.freeze({'ฟุต':'0.3048','หลา':'0.9144'});
export function lengthUnitYield(purchaseUnit,usageUnit){
 if(usageUnit!=='เมตร'||!Object.hasOwn(lengthUnits,purchaseUnit))throw Error('แปลงหน่วยความยาว: เลือกซื้อเป็น ฟุต หรือ หลา และใช้เป็น เมตร');
 return lengthUnits[purchaseUnit];
}
