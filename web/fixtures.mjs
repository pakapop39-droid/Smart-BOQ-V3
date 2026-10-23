export const resources=[
 ['PN01','ไม้โครงและแผ่นตู้','1000','1','1','แผ่น','แผ่น'],['LM01','ลามิเนตรุ่น A','1200','2.88','1','แผ่น','ตร.ม.'],['ST01','ท็อปหิน','3000','1','0.01','ตร.ม.','ตร.ม.'],['HW01','บานพับและอุปกรณ์','800','1','1','ชุด','ชุด'],['ED01','กาวและขอบ (รอตรวจขอบเขต)','300','1','1','ชุด','ชุด'],['PLY01','ไม้อัด','500','2.88','1','แผ่น','ตร.ม.'],['WD01','ไม้โครงผนัง','290','25','1','มัด','เมตร'],['GL01','กาวยาง','3000','15','1','ปี๊บ','ลิตร'],['SK01','ซิงค์','3000','1','1','ใบ','ใบ'],['FA01','ก๊อกน้ำ','1200','1','1','ชุด','ชุด'],['DR01','สะดือและท่อ','600','1','1','ชุด','ชุด'],['b-0800-0750-0600-0','โครงตู้ 800','4000','1','1','ใบ','ใบ'],['b-0600-0750-0600-0','โครงตู้ 600','3200','1','1','ใบ','ใบ'],['b-0700-0750-0600-0','โครงตู้ 700','3600','1','1','ใบ','ใบ'],['FD01','แกนหน้าบานพร้อมบานพับ','4200','1','1','ชุด','ชุด'],['LB01','แรงผลิตตู้','1400','1','1','เมตร','เมตร','LABOR'],['LB02','แรงติดตั้งตู้','600','1','1','เมตร','เมตร','LABOR'],['LB03','แรงช่างไม้ผนัง','1000','1','1','ตร.ม.','ตร.ม.','LABOR'],['LB04','แรงช่างสี','800','1','1','ตร.ม.','ตร.ม.','LABOR'],['LB05','แรงติดตั้งซิงค์','800','1','1','ชุด','ชุด','LABOR'],['LB06','แรงประกอบหน้าบาน','400','1','1','เมตร','เมตร','LABOR'],['PLY02','ไม้อัดสเปก B (SAMPLE)','650','2.88','1','แผ่น','ตร.ม.'],['LM02','ลามิเนตสเปก B (SAMPLE)','1500','2.88','1','แผ่น','ตร.ม.']
].map(([code,name,price,yieldQty,increment,purchase_unit,usage_unit,type='MATERIAL'])=>({code,name,price,yield:yieldQty,increment,purchase_unit,usage_unit,type}));
const line=(code,numerator,denominator='1',basis='PER_UNIT')=>({code,numerator:String(numerator),denominator:String(denominator),basis,waste:'0'});
export function sampleLines(method){return method==='CUSTOM'?[line('PN01','1.5'),line('LM01','5.04','1','TOTAL'),line('HW01','1'),line('ED01','1'),line('LB01','1'),line('LB02','1')]:[line('b-0800-0750-0600-0','2','1','TOTAL'),line('b-0600-0750-0600-0','2','1','TOTAL'),line('b-0700-0750-0600-0','1','1','TOTAL'),line('FD01','1','1','TOTAL'),line('LM01','5.04','1','TOTAL'),line('GL01','75.6','28.8','TOTAL'),line('LB06','1'),line('LB02','1')];}
export const stone=[line('ST01','1')];
export function costTables(method='CUSTOM'){return {S001:sampleLines(method),S002:structuredClone(stone),S003:structuredClone(wall),S004:structuredClone(sink)};}
export function buildB01Payload(values,resourceRows=resources,tables=costTables(values.method)){
 const cabinet=tables.S001.map(l=>!values.panelGroups&&l.code==='LM01'?{...l,numerator:values.area}:!values.panelGroups&&l.code==='GL01'?{...l,numerator:timesInteger(values.area,15),denominator:'28.8',basis:'TOTAL'}:{...l});
 if(cabinet.some(l=>l.code==='ST01'))throw Error('ท็อปหินต้องอยู่ S002 แยกจากตู้');
 if(values.method==='VS_MODULAR'&&cabinet.some(l=>l.code.startsWith('b-')&&(l.basis!=='TOTAL'||!/^\d+$/.test(l.numerator)||l.denominator!=='1')))throw Error('โครงตู้ VS Modular ใช้จำนวนใบเต็ม ตัวหาร 1 และฐาน TOTAL เท่านั้น');
 return {resources:resourceRows,components:[
 {code:'S001',name:'ตู้เตี้ย',quantity:values.quantity,margin:values.margin,unit:'เมตร',lines:cabinet},
 {code:'S002',name:'ท็อปหิน',quantity:values.stoneQuantity,margin:values.stoneMargin,unit:'ตร.ม.',lines:tables.S002},
 {code:'S003',name:'ผนังกรุลามิเนต',quantity:values.wallQuantity,margin:values.wallMargin,unit:'ตร.ม.',lines:tables.S003},
 {code:'S004',name:'ซิงก์พร้อมอุปกรณ์',quantity:values.sinkQuantity,margin:values.sinkMargin,unit:'ชุด',lines:tables.S004}]};
}
export const wall=[line('WD01','8'),line('LM01','1'),line('PLY01','1'),line('GL01','15','28.8'),line('LB03','1'),line('LB04','1')];
export const sink=[line('SK01','1'),line('FA01','1'),line('DR01','1'),line('LB05','1')];
// Exact decimal multiplication for copying manual area into the glue ratio.
export function timesInteger(decimal,factor){if(!/^\d+(?:\.\d{1,6})?$/.test(decimal))throw Error('กรอกพื้นที่เป็นตัวเลขไม่เกิน 6 ตำแหน่ง');const [a,b='']=decimal.split('.');const n=BigInt(a+b)*BigInt(factor);const s=n.toString().padStart(b.length+1,'0');return b.length?s.slice(0,-b.length)+'.'+s.slice(-b.length):s;}
