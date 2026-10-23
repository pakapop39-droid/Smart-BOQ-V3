import ExcelJS from 'exceljs';
import {Buffer} from 'buffer';

export const TEMPLATE_VERSION='2';
const base=[['resource_id','รหัสภายใน'],['version','รุ่นข้อมูล'],['resource_code','รหัสรายการ'],['resource_name','ชื่อรายการ'],['specification','สเปก'],['cost_type_code','ประเภทต้นทุน'],['purchase_unit_code','หน่วยซื้อ'],['usage_unit_code','หน่วยใช้'],['purchase_unit_price','ราคาซื้อต่อหน่วยซื้อ'],['conversion_method','วิธีแปลงหน่วย'],['pack_count','จำนวนบรรจุ'],['length_m','ยาว (เมตร)'],['width_m','กว้าง (เมตร)'],['volume_l','ปริมาตร (ลิตร)'],['purchase_increment','ขั้นซื้อ'],['coverage_area_per_purchase','พื้นที่ครอบคลุมต่อหน่วยซื้อ'],['coverage_note','หมายเหตุครอบคลุม'],['price_updated_at','วันที่ราคา'],['is_active','เปิดใช้งาน']];
const extra=[['function_code','รหัสฟังก์ชัน'],['width_mm','กว้าง (มม.)'],['height_mm','สูง (มม.)'],['depth_mm','ลึก (มม.)'],['led_code','รหัส LED'],['included_scope','สิ่งที่รวม'],['excluded_scope','สิ่งที่ไม่รวม'],['index_reference','อ้างอิง Index']];
const sheets={MATERIAL:'วัสดุ',LABOR:'ค่าแรง',VS_MODULAR:'VS Modular'};
const decimals=new Set(['purchase_unit_price','pack_count','length_m','width_m','volume_l','purchase_increment','coverage_area_per_purchase']);
const integers=new Set(['version','width_mm','height_mm','depth_mm']);
const columns=(kind,version=TEMPLATE_VERSION)=>[...(kind==='VS_MODULAR'?[...base,...extra]:base),...(version==='1'?[]:[['tags','แท็กงาน']])];
const header=([key,label])=>`${label} [${key}]`;
const fail=(sheet,row,key,msg)=>{throw Error(`${sheet} แถว ${row} ช่อง ${key}: ${msg}`);};

export async function exportCatalog(rows,{templateVersion=TEMPLATE_VERSION}={}){
 if(!['1','2'].includes(templateVersion))throw Error('รุ่นแม่แบบไม่รองรับ');
 const wb=new ExcelJS.Workbook();wb.creator='Smart BOQ';
 const notes=wb.addWorksheet('คำแนะนำ');
 notes.addRows([['template_version',templateVersion],['master_version','1.8'],['วิธีใช้','แก้เฉพาะข้อมูลคลัง แถวเดิมเก็บรหัสภายใน รุ่นข้อมูล และรหัสรายการไว้ แถวใหม่เว้นรหัสภายในและรุ่นข้อมูล'],['ช่องว่าง','ช่องเลือกกรอกว่างจะล้างค่า ช่องบังคับห้ามว่าง แถวหายไม่ลบข้อมูลในระบบ'],['ตัวเลข','รหัสและทศนิยมส่งออกเป็นข้อความเพื่อรักษาศูนย์นำหน้าและความแม่นยำ ห้ามใช้สูตร'],['วันที่ราคา','เก็บข้อความวันเวลา ISO ที่ export มาได้ หรือกรอก YYYY-MM-DD'],['สถานะ','TRUE เปิดใช้ / FALSE หยุดใช้ การนำเข้าไม่ยืนยันว่าราคาหรือขอบเขตตรวจแล้ว'],['VS Modular','หนึ่งแถวต่อสินค้าหนึ่งรหัส ไม่เพิ่มซ้ำในชีตวัสดุ'],['หน่วย','M เมตร, M2 ตร.ม., SET ชุด, SHEET แผ่น, BUNDLE มัด, CAN ปี๊บ, L ลิตร, ITEM ใบ'],['แปลงหน่วย','DIRECT, COUNT, COUNT_LENGTH, AREA, VOLUME ตามมาสเตอร์'],['สำคัญ','ไฟล์นี้แก้คลังเท่านั้น ไม่แก้ราคา snapshot ของโครงการเดิม'],['แท็กงาน','เวอร์ชัน 2 แยกชื่อแท็กด้วยขึ้นบรรทัดใหม่ในเซลล์ ช่องว่างล้างแท็ก เวอร์ชัน 1 ไม่มีช่องแท็กจึงคงแท็กเดิม ระบบทดลองในเครื่องเท่านั้น']]);
 notes.columns=[{width:22},{width:110}];
 for(const [kind,name]of Object.entries(sheets)){
  const cols=columns(kind,templateVersion),ws=wb.addWorksheet(name);ws.addRow(cols.map(header));ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:cols.length}};
  ws.columns=cols.map(([key])=>({width:key.includes('scope')||key.includes('name')?36:24,style:{numFmt:'@'}}));
  for(const row of rows.filter(x=>x.kind===kind))ws.addRow(cols.map(([key])=>row[key]===null||row[key]===undefined?null:typeof row[key]==='boolean'?(row[key]?'TRUE':'FALSE'):String(row[key])));
  if(templateVersion==='2'){const col=ws.getColumn(cols.length);col.width=45;col.alignment={wrapText:true,vertical:'top'};}
  ws.getRow(1).font={bold:true};ws.getRow(1).height=28;
 }
 return Buffer.from(await wb.xlsx.writeBuffer());
}

// No calculation or merging happens here. The database plans and commits.
export async function parseCatalog(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length>20*1024*1024)throw Error('ไฟล์ต้องไม่เกิน 20 MB');
 // Inspect the ZIP central directory before decompression. XLSX is a ZIP file.
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('ไฟล์ไม่ใช่ XLSX ที่รองรับ');
 const entries=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16),expanded=0;
 if(entries>500||buffer.readUInt16LE(end+4)!==0||buffer.readUInt16LE(end+6)!==0)throw Error('โครงสร้างไฟล์ ZIP ไม่รองรับ');
 for(let i=0;i<entries;i++){
  if(offset+46>buffer.length||buffer.readUInt32LE(offset)!==0x02014b50)throw Error('ไฟล์ ZIP เสียหาย');
  if(buffer.readUInt16LE(offset+8)&1)throw Error('ไม่รับไฟล์เข้ารหัส');
  const unpacked=buffer.readUInt32LE(offset+24);expanded+=unpacked;if(expanded>64*1024*1024)throw Error('ข้อมูลหลังคลายไฟล์เกิน 64 MB');
  const nameLength=buffer.readUInt16LE(offset+28),extraLength=buffer.readUInt16LE(offset+30),commentLength=buffer.readUInt16LE(offset+32);
  const name=buffer.subarray(offset+46,offset+46+nameLength).toString('utf8');
  if(/vbaProject|externalLinks/i.test(name))throw Error('ไม่รับ macros หรือลิงก์ภายนอก');
  offset+=46+nameLength+extraLength+commentLength;
 }
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);
 if(wb.worksheets.length!==4||wb.worksheets.some(ws=>!['คำแนะนำ',...Object.values(sheets)].includes(ws.name)))throw Error('ต้องใช้แม่แบบ Excel ของระบบ');
 const notes=wb.getWorksheet('คำแนะนำ');if(notes?.getCell('A1').value!=='template_version'||!['1','2'].includes(String(notes.getCell('B1').value)))throw Error('รุ่นแม่แบบไม่รองรับ');
 for(const ws of wb.worksheets)ws.eachRow(row=>row.eachCell(cell=>{if(cell.type===ExcelJS.ValueType.Formula||cell.type===ExcelJS.ValueType.Hyperlink||cell.value&&typeof cell.value==='object'&&('formula'in cell.value||'sharedFormula'in cell.value))fail(ws.name,row.number,cell.address,'ไม่รับสูตรหรือลิงก์');}));
 const templateVersion=String(notes.getCell('B1').value);
 const rows=[],sources=[];
 for(const [kind,name]of Object.entries(sheets)){
  const ws=wb.getWorksheet(name),cols=columns(kind,templateVersion);
  if(!ws||ws.columnCount>cols.length||ws.rowCount>10001)throw Error(`${name}: คอลัมน์หรือจำนวนแถวไม่ถูกต้อง`);
  for(let c=0;c<cols.length;c++)if(ws.getCell(1,c+1).value!==header(cols[c]))fail(name,1,cols[c][0],'หัวคอลัมน์ไม่ตรงแม่แบบ');
  for(let n=2;n<=ws.rowCount;n++){
   const cells=ws.getRow(n);if(!cells.values.some(x=>x!==null&&x!==undefined&&x!==''))continue;
   const row={kind};
   for(let c=0;c<cols.length;c++){
    const key=cols[c][0];let v=cells.getCell(c+1).value;
    if(v===null||v===undefined||v===''){row[key]=null;continue;}
    if(typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')fail(name,n,key,'ต้องเป็นข้อความ ตัวเลข หรือ TRUE/FALSE');
    if(typeof v==='string'&&v.length>20000)fail(name,n,key,'ข้อความยาวเกินกำหนด');
    if(key==='is_active'){if(v===true||v==='TRUE')v=true;else if(v===false||v==='FALSE')v=false;else fail(name,n,key,'ใช้ TRUE หรือ FALSE');}
    else if(decimals.has(key)||integers.has(key)){
     // Excel numeric cells have at most 15 significant decimal digits.
     if(typeof v==='number'&&(!Number.isFinite(v)||String(v).replace(/[-.0]/g,'').length>15))fail(name,n,key,'ใช้ข้อความตัวเลขเพื่อรักษาความแม่นยำ');
     v=String(v).trim();if(!(integers.has(key)?/^\d+$/:/^\d+(?:\.\d+)?$/).test(v))fail(name,n,key,'รูปแบบตัวเลขไม่ถูกต้อง');
     const [,fraction='']=v.split('.');if(fraction.length>6)fail(name,n,key,'ทศนิยมเกิน 6 ตำแหน่ง');
    }else if(key==='price_updated_at'){
     v=String(v);if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(v)||!Number.isFinite(Date.parse(v)))fail(name,n,key,'ใช้ YYYY-MM-DD หรือวันเวลา ISO');
    }else{if(typeof v!=='string')fail(name,n,key,'ช่องรหัส/ข้อความต้องเป็นข้อความเพื่อรักษาศูนย์นำหน้า');v=v.normalize('NFC').trim();}
    row[key]=v;
   }
   rows.push(row);sources.push({sheet:name,row:n});if(rows.length>10000)throw Error('รวมไม่เกิน 10,000 รายการต่อไฟล์');
  }
 }
 const digest=await globalThis.crypto.subtle.digest('SHA-256',buffer);
 return {template_version:templateVersion,rows,sources,file_hash:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')};
}

export async function previewExcel(client,buffer){
 const parsed=await parseCatalog(buffer);if(parsed.template_version==='2')throw Error('แม่แบบแท็กเวอร์ชัน 2 ใช้เฉพาะระบบทดลองในเครื่อง ยังไม่รองรับ Import เข้าฐาน');const {data,error}=await client.database.rpc('boq_catalog_preview',{rows_data:parsed.rows});if(error)throw error;
 return {...parsed,preview:data,display_rows:data.rows.map((r,i)=>({...r,...parsed.sources[i]}))};
}
export async function commitExcel(client,review){
 if(review.template_version==='2')throw Error('ยังไม่เปิด Import แท็กเข้าฐาน');
 if(!review.preview.valid)throw Error('ต้องแก้รายการที่ผิดหรือขัดแย้งก่อน');
 const {data,error}=await client.database.rpc('boq_catalog_commit',{rows_data:review.rows,preview_token:review.preview.preview_token});if(error)throw error;return data;
}
