// Trial-only examples. These are not supplier specifications or verified prices.
export const assemblyResources=[
 {code:'H01-SAMPLE',name:'บานพับตัวอย่าง SAMPLE',price:'100',yield:'1',increment:'1',purchase_unit:'ตัว',usage_unit:'ตัว',type:'MATERIAL',resourceKind:'ITEM',scopeKey:'HINGE'},
 {code:'SLIDE-SAMPLE',name:'รางเลื่อนตัวอย่าง SAMPLE',price:'300',yield:'1',increment:'1',purchase_unit:'ชุด',usage_unit:'ชุด',type:'MATERIAL',resourceKind:'ITEM',scopeKey:'SLIDE'},
 {code:'DOOR-KIT-SAMPLE',name:'หน้าบานปิดผิวพร้อมบานพับ SAMPLE',price:'1000',yield:'1',increment:'1',purchase_unit:'ชุด',usage_unit:'ชุด',type:'MATERIAL',resourceKind:'BUNDLE',scopeKey:'DOOR_CORE'},
 {code:'DOOR-BARE-SAMPLE',name:'หน้าบานพร้อมบานพับ ไม่รวมผิว SAMPLE',price:'800',yield:'1',increment:'1',purchase_unit:'ชุด',usage_unit:'ชุด',type:'MATERIAL',resourceKind:'BUNDLE',scopeKey:'DOOR_CORE'},
 {code:'DRAWER-KIT-SAMPLE',name:'ชุดลิ้นชักพร้อมราง SAMPLE',price:'1500',yield:'1',increment:'1',purchase_unit:'ชุด',usage_unit:'ชุด',type:'MATERIAL',resourceKind:'BUNDLE',scopeKey:'DRAWER_CORE'}
];
const item=(id,childCode,inclusionStatus,quantity,scopeKey)=>({id,childCode,inclusionStatus,quantity,scopeKey,sourceReference:'ตัวอย่างสมมติสำหรับตรวจสูตร ไม่ใช่ Index จริง'});
export function bundleDefinition(code){
 if(code==='DOOR-KIT-SAMPLE')return {code,version:'2',scopeConfirmed:true,laborCoverage:{PRODUCTION:'INCLUDED',INSTALLATION:'EXCLUDED'},detailStatus:'PARTIAL',coveredScopes:['DOOR_CORE','HINGE','LAMINATE','PRODUCTION_LABOR'],items:[item('door-hinge','H01-SAMPLE','INCLUDED','2','HINGE')],sourceReference:'SAMPLE หน้าบานปิดผิว รวมบานพับ 2 ตัว/ชุด รวมแรงผลิต ไม่รวมแรงติดตั้ง' };
 if(code==='DOOR-BARE-SAMPLE')return {code,version:'2',scopeConfirmed:true,laborCoverage:{PRODUCTION:'INCLUDED',INSTALLATION:'EXCLUDED'},detailStatus:'PARTIAL',coveredScopes:['DOOR_CORE','HINGE','PRODUCTION_LABOR'],items:[item('bare-hinge','H01-SAMPLE','INCLUDED','2','HINGE'),item('bare-surface','LM01','EXCLUDED',null,'LAMINATE')],sourceReference:'SAMPLE แกนหน้าบานรวมบานพับ ไม่รวมผิวปิด รวมแรงผลิต ไม่รวมแรงติดตั้ง'};
 if(code==='DRAWER-KIT-SAMPLE')return {code,version:'2',scopeConfirmed:true,laborCoverage:{PRODUCTION:'INCLUDED',INSTALLATION:'EXCLUDED'},detailStatus:'PARTIAL',coveredScopes:['DRAWER_CORE','SLIDE','PRODUCTION_LABOR'],items:[item('drawer-slide','SLIDE-SAMPLE','INCLUDED','1','SLIDE')],sourceReference:'SAMPLE ชุดลิ้นชักรวมราง 1 ชุด/ชุดลิ้นชัก รวมแรงผลิต ไม่รวมแรงติดตั้ง'};
 if(code.startsWith('b-'))return {code,version:'2',scopeConfirmed:true,laborCoverage:{PRODUCTION:'INCLUDED',INSTALLATION:'EXCLUDED'},detailStatus:'PARTIAL',coveredScopes:['CARCASS','FRAME','PLYWOOD','CARCASS_LABOR','PRODUCTION_LABOR'],items:[],sourceReference:'ขอบเขต SAMPLE โครงรวมแรงผลิต ต้องตรวจ Index จริงก่อนใช้จริง'};
 if(code==='FD01')return {code,version:'1',scopeConfirmed:false,detailStatus:'PARTIAL',coveredScopes:[],items:[],sourceReference:'ชื่อเดิมระบุพร้อมบานพับ แต่ยังไม่ยืนยันรุ่น จำนวน และขอบเขตจริง'};
 return null;
}
export function scopeOf(resource){if(resource.scopeKey)return resource.scopeKey;const c=resource.code;if(c==='HW01')return 'HARDWARE';if(c.startsWith('LM'))return 'LAMINATE';if(c.startsWith('PLY'))return 'PLYWOOD';if(c==='WD01')return 'FRAME';if(c==='GL01')return 'GLUE';if(c==='LB01')return 'CARCASS_LABOR';return resource.type==='LABOR'?'LABOR':'OTHER';}
