// Isolated, persistent owner trial. Never opens the main application database.
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {localApi} from '../local/api.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const database=fileURLToPath(new URL('../data/cabinet-a-sample.sqlite',import.meta.url));
const api=localApi(database),store=api.store;
// A seed marker lives with this isolated company; auto-generated RT codes are retained.
if(store.company.cabinet_a_seeded!==true&&!store.all('rate_templates').some(r=>r.name==='ตู้เตี้ย SAMPLE — ตัวตู้และหน้าบาน')){
 store.tx(()=>{
  const unit=name=>store.all('units').find(u=>u.name===name).id;
  const resource=(code,name,price,buy,use,yieldQty,labor=false)=>store.save('cost_resources',{
   company_id:store.company.id,code,name:name+' · SAMPLE',
   cost_type_id:store.all('cost_types').find(t=>t.code===(labor?'LABOR':'MATERIAL')).id,
   purchase_unit_id:unit(buy),usage_unit_id:unit(use),resource_kind:labor?'SERVICE':'ITEM',
   price,yield:yieldQty,increment:'1',conversion_method:yieldQty==='2.88'?'AREA':code==='WD-CAB-SAMPLE'?'COUNT_LENGTH':'DIRECT',
   pack_count:code==='WD-CAB-SAMPLE'?'10':'',length_m:yieldQty==='2.88'?'2.40':code==='WD-CAB-SAMPLE'?'2.50':'',
   width_m:yieldQty==='2.88'?'1.20':'',volume_l:'',scope_key:'OTHER',covered_scopes:'',
   notes:'SAMPLE สำหรับทดลองแบบ A ไม่ใช่ราคา สเปก หรืออัตราการใช้จริง',is_active:true
  });
  const wood=resource('WD-CAB-SAMPLE','ไม้โครงตู้','290','มัด','เมตร','25');
  const ply=resource('PLY-CAB-SAMPLE','ไม้อัด','500','แผ่น','ตร.ม.','2.88');
  const lam=resource('LM-CAB-SAMPLE','ลามิเนต','1200','แผ่น','ตร.ม.','2.88');
  const hinge=resource('HINGE-CAB-SAMPLE','บานพับ','100','ตัว','ตัว','1');
  const bodyLabor=resource('LB-BODY-SAMPLE','ค่าแรงผลิตตัวตู้','1400','เมตร','เมตร','1',true);
  const doorLabor=resource('LB-DOOR-SAMPLE','ค่าแรงประกอบหน้าบาน','400','เมตร','เมตร','1',true);
  const install=resource('LB-INSTALL-SAMPLE','ค่าแรงติดตั้งตู้','600','เมตร','เมตร','1',true);
  const rate=store.save('rate_templates',{company_id:store.company.id,
   category_id:store.all('work_categories').find(c=>c.code==='BUILTIN').id,unit_id:unit('เมตร'),
   name:'ตู้เตี้ย SAMPLE — ตัวตู้และหน้าบาน',margin:'40',is_active:true,
   notes:'ฐาน 1 เมตรขาย อัตราตัวอย่างเพื่อทดลองเปิดตารางทีละชั้น ไม่รวมท็อปหิน'});
  const group=(name,kind)=>store.save('rate_template_groups',{template_id:rate.id,name,
   assembly_kind:kind,sourcing_method:'MAKE',calculation_method:'MANUAL',quantity:'1',
   area:'',plySides:'2',lamSides:'2',is_active:true});
  const body=group('ตัวตู้','CARCASS'),door=group('หน้าบาน','DOOR');
  for(const [g,r,quantity,phase]of [
   [body,wood,'8',''],[body,ply,'1',''],[body,lam,'1',''],
   [body,bodyLabor,'1','PRODUCTION'],[body,install,'1','INSTALLATION'],
   [door,ply,'0.5',''],[door,lam,'1',''],[door,hinge,'2',''],[door,doorLabor,'1','PRODUCTION']
  ])store.save('rate_template_cost_lines',{template_id:rate.id,group_id:g.id,resource_id:r.id,
   numerator:quantity,denominator:'1',waste:'0',line_role:'OTHER',quantity_source:'MANUAL',labor_phase:phase,is_active:true});
  store.publishRate(rate.id,store.get('rate_templates',rate.id).version);
 });
}
if(!store.get('companies',store.company.id).cabinet_a_seeded)
 store.put('companies',{...store.get('companies',store.company.id),cabinet_a_seeded:true},store.company.id);
const banner='ตัวอย่างตู้เตี้ย SAMPLE · ฐานทดลองแยก · ไม่กระทบข้อมูลเดิม · บันทึกเฉพาะในเครื่อง';
const server=await createServer({configFile:false,root,plugins:[{
 name:'cabinet-a-isolated-trial',
 transformIndexHtml(html){return html.replace('</head>',`<style>#app .local-banner{font-size:12px!important;background:#fff2ce;color:#705011;height:auto!important;padding:5px 10px!important}#app .local-banner:after{display:none!important}</style></head>`).replace(/<title>.*?<\/title>/,'<title>Smart BOQ V3 — ตู้เตี้ย SAMPLE แยกฐาน</title>');},
 transform(code,id){if(id.replaceAll('\\','/').endsWith('/web/local-app.mjs'))return code.replace('LOCAL · ฐานข้อมูลในเครื่อง 24 ตาราง · ข้อมูลตัวอย่างเป็น SAMPLE · ใช้สูตรคำนวณเดิม',banner);},
 configureServer(s){s.middlewares.use('/api/local',api.handler);s.httpServer?.once('close',()=>store.close());}
}],server:{host:'127.0.0.1',port:5188,strictPort:true,hmr:false,
 watch:{ignored:['**/data/**','**/artifacts/**']},fs:{deny:['**/.env*','**/.insforge/**','**/data/**']}}});
await server.listen();
console.log('Smart BOQ V3 cabinet SAMPLE: http://127.0.0.1:5188/#rates');
console.log('Separate database: data/cabinet-a-sample.sqlite (existing edits are retained on restart)');
