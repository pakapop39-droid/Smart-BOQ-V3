# Smart BOQ V3 — แบบระบบปัจจุบัน
วันที่ 23 ตุลาคม 2569 · อ้าง [MASTER 2.0](MASTER.md)

## สถานะที่สร้างจริง
แอปหลัก / ใช้ Vite + local HTTP API + SQLite 22 ตาราง เก็บข้อมูลใน data/smart-boq-local.sqlite คำนวณด้วย Decimal module เดิม ไม่เชื่อมฐานออนไลน์ /trial.html เป็นหน้าต้นแบบก่อนหน้า มีข้อมูลเบราว์เซอร์แยกจาก SQLite

ลำดับข้อมูล: companies → projects → areas/work_items → work_components → component_groups ถ้ามี → component_cost_lines; ราคาคลังผ่าน project_resources และ snapshot; ต้นแบบ rate_templates พร้อมลูก 3 ตารางสำเนาเข้า work_components ไม่อ่านสดย้อนหลัง

## แหล่งอ้างอิง
- [ความสัมพันธ์ 22 ตารางที่ใช้อยู่](RELATION-22-RATE-TEMPLATES.md)
- [พจนานุกรม fields/refs ที่ประกาศจริง](DATA-CURRENT.md)
- [สัญญาข้อมูลที่ต้องตามต่อ](DATA-REQUIREMENTS.md)
- [คู่มือแอปหลัก](LOCAL-APP-22-GUIDE.md)
- [งานค้างทั้งหมด](BACKLOG.md)
- [แผนแท็กและเลิกทำ](TAG-UNDO-PLAN.md)

## ช่องว่างที่ห้ามตีความว่าเสร็จแล้ว
แท็กหลักยังเป็นข้อความ ไม่มีทะเบียนและ bulk/undo ครบแบบต้นแบบ; READY ของต้นแบบไม่ใช่ VERIFIED/LOCKED; auth/RLS ยังไม่มีใน local; field contracts และรายงาน/Excel/ข้อมูล Modular จริงยังต้องตรวจ; benchmark D10 ยังไม่วัดครบ

แผนเสนอทะเบียนแท็ก 2 ตารางทำให้เป้าหมายรอบถัดไปเป็น 24 หากอนุมัติ ยังไม่สร้างจริง ไม่เพิ่มจำนวนตามเอกสารเสนอโดยอัตโนมัติ ประวัติ undo วางใน metadata ของบริษัทใน JSON data ของ SQLite ที่มีอยู่ ไม่เพิ่มเป็นตารางธุรกิจใหม่

## สิ่งที่ไม่เปลี่ยนในรอบจัดเอกสาร
โค้ด สูตร ตาราง/ข้อมูล SQLite ฟังก์ชัน API cloud และไฟล์โครงการเดิมไม่ถูกแก้ ไม่มี commit/push/deploy รอบนี้ แบบเก่าที่เคยสะสมดู [ดัชนีประวัติ](MASTER-HISTORY.md)
