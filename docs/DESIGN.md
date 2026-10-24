# Smart BOQ V3 — แบบระบบปัจจุบัน
วันที่ 23 ตุลาคม 2569 · อ้าง [MASTER 2.2](MASTER.md)

## สถานะที่สร้างจริง
แอปหลัก / ใช้ Vite + local HTTP API + SQLite 24 ตาราง เก็บข้อมูลใน data/smart-boq-local.sqlite คำนวณด้วย Decimal module เดิม ไม่เชื่อมฐานออนไลน์ /trial.html เป็นหน้าต้นแบบก่อนหน้า มีข้อมูลเบราว์เซอร์แยกจาก SQLite

ลำดับข้อมูล: companies → projects → areas/work_items → work_components → component_groups ถ้ามี → component_cost_lines; ราคาคลังผ่าน project_resources และ snapshot; ต้นแบบ rate_templates พร้อมลูก 3 ตารางสำเนาเข้า work_components ไม่อ่านสดย้อนหลัง

## แหล่งอ้างอิง
- [คลังราคาขายแบบ A — แนวทางล่าสุด](UI-RATE-DRILLDOWN-A-20261024.md) เปิดตารางส่วนประกอบทีละชั้น มีเส้นทางและย้อนกลับ ใช้แทนการสลับกลุ่มด้วยแท็บ แผงขวาใช้แก้ข้อมูล
- [กติกาดีไซน์ UX/UI ที่ยืนยันแล้ว](UX-UI-GUIDELINES.md) — ตารางหลักกับแผงแก้ไขด้านขวา; เริ่มใช้ที่คลังรายการทำราคาในเครื่อง ดู [ผลส่งทดลอง](UI-RATE-WORKSPACE-20261024.md)
- [คลังวัสดุ/ค่าแรง/VS Modular แบบตารางและแผงขวา](UI-CATALOG-WORKSPACE-20261024.md) — ใช้ drawer ร่วม คงแท็ก/bulk/undo/Excel เดิมในเครื่อง
- [ความสัมพันธ์ 22 ตารางที่ใช้อยู่](RELATION-22-RATE-TEMPLATES.md)
- [พจนานุกรม fields/refs ที่ประกาศจริง](DATA-CURRENT.md)
- [สัญญาข้อมูลที่ต้องตามต่อ](DATA-REQUIREMENTS.md)
- [คู่มือแอปหลัก](LOCAL-APP-22-GUIDE.md)
- [งานค้างทั้งหมด](BACKLOG.md)
- [แผนแท็กและเลิกทำ](TAG-UNDO-PLAN.md)

## ช่องว่างที่ห้ามตีความว่าเสร็จแล้ว
READY ของต้นแบบไม่ใช่ VERIFIED/LOCKED; auth/RLS ยังไม่มีใน local; field contracts และรายงาน/Excel/ข้อมูล Modular จริงยังต้องตรวจ; benchmark D10 ยังไม่วัดครบ

ทะเบียนแท็ก resource_tags และ resource_tag_links เพิ่มตามคำอนุมัติขั้นที่ 3 รวม 24 ตาราง หน้าหลักใช้ local/tags-undo.mjs และ web/local-library.mjs; undo journal อยู่ใน metadata ของบริษัท แก้เฉพาะคำสั่ง ไม่คืนบริษัททั้งแถวทับข้อมูลใหม่

## รอบพัฒนาขั้นที่ 3
เปลี่ยนเฉพาะ local schema/API, คลัง/ตัวเลือกต้นทุน, Excel และการสำรองตามที่อนุมัติ ใช้แกนคำนวณเดิม ไม่มี cloud/deploy/push GitHub ดู [วิธีทดลอง](TRY-STEP3.md), [บันทึกส่งมอบ](STEP3-DELIVERY.md) และ [ประวัติ](MASTER-HISTORY.md)

## เส้นทางหลักที่ยืนยัน 24 ตุลาคม
คลังรายการทำราคาจัดต้นทุน/กำไร/ราคาต่อหน่วย → Keyplan เลือก READY และกรอกปริมาณจริง; โครงการเก็บ snapshot เปิดต้นทุนอ่านอย่างเดียวก่อน เปิดปรับเฉพาะโครงการเป็นทางรอง ไม่เปลี่ยน 24 ตารางหรือสูตร ดู LIBRARY-FIRST-20261024.md
