// Exact international yard/foot factors, NIST HB44 Appendix C.
// https://www.nist.gov/system/files/documents/2021/11/30/2022-HB44-Section-Appendix-C.pdf
export const areaUnits=Object.freeze({'ตร.หลา':'0.83612736','ตร.ฟุต':'0.09290304'});
export function areaUnitYield(purchaseUnit,usageUnit){
 if(usageUnit!=='ตร.ม.'||!Object.hasOwn(areaUnits,purchaseUnit))throw Error('แปลงหน่วยพื้นที่: เลือกซื้อเป็น ตร.หลา หรือ ตร.ฟุต และใช้เป็น ตร.ม.');
 return areaUnits[purchaseUnit];
}
