# ขั้นที่ 3 — บันทึกอนุมัติและส่งมอบในเครื่อง

วันที่เริ่ม 23 ตุลาคม 2569 · Risk T3 (schema, migration, persisted data, API)

## ขอบเขตที่อนุมัติ
- approval_level: Scope + Implementation
- approved_by: คุณต๋อง
- approval_text_or_reference: คำขอล่าสุดให้ทำต่อเนื่องทั้ง 5 ข้อระหว่างพักผ่อน แล้วตรวจตอนเช้า
- scope_document_version: MASTER 2.0 / TAG-UNDO-PLAN 23 ตุลาคม 2569
- environment: Local เท่านั้น
- data_migration_authorized: Yes เฉพาะเพิ่มทะเบียนแท็ก 2 ตารางเป็น 24 และแปลงข้อความแท็กเดิมโดย preview/ยืนยันหลังสำรอง ไม่ลบข้อมูลเดิม ไม่ย้ายระบบเก่า
- production_allowed: No; ไม่เรียก InsForge ไม่ deploy Vercel ไม่ push GitHub รอบนี้
- approved_at: 2026-10-23 (Asia/Bangkok)

## สภาพก่อนเริ่ม
branch main; HEAD 616c70a; มีงานเดิมแก้ค้าง local/api.mjs, local/rates.mjs, tests/local-rates.test.mjs, web/local-app.mjs ต้องรักษาไว้

สำเนา source และ SQLite ก่อนเริ่ม: artifacts/step3-before-20261024 (ไม่เผยแพร่)

## การแบ่งงาน
Lead บันทึกขอบเขต ประสานสัญญาและรวมงาน; Architect ตรวจ schema/API/transaction/undo ก่อนพัฒนา; Builder backend ดู local และ tests ที่เกี่ยวข้อง; Builder UI ดู web; QA ตรวจ candidate หลังรวมงานและเส้นทางหน้าหลักจริง แยกจากผู้พัฒนา

เกณฑ์จบ: ตาม TAG-UNDO-PLAN ทั้ง 6 ลำดับส่งมอบ โดยแกนคำนวณเดิมต้องไม่เปลี่ยน ย้ายข้อมูลผ่าน preview/ยืนยัน Excel/backup รองรับเก่าและใหม่ ไม่มีการสมมติกติกาธุรกิจที่ค้าง

## ผลส่งมอบ
พัฒนาแล้วและพร้อมให้เจ้าของทดลองในเครื่องที่ http://127.0.0.1:5177/ ดู TRY-STEP3.md ยังไม่ถือว่าคุณต๋องตรวจรับรูปแบบหรือรับรองข้อมูลจริงแล้ว

- เพิ่ม schema เป็น 24 ตารางเฉพาะในเครื่อง มีสำเนาใน data/backups ก่อนเพิ่มตาราง และ artifacts/step3-before-20261024 ก่อนเริ่ม
- ไม่มีข้อความแท็กเดิมในฐานที่ใช้อยู่ จึงไม่มีการแปลงหรือกำหนดแท็กให้วัสดุแทนเจ้าของ; ฐานเก่าที่มีข้อความจะรอ preview/ยืนยัน
- npm test ผ่าน 147/147: artifacts/step3-final-tests.txt
- npm run build ผ่าน (Vite8.3.5)
- QA อิสระ 6/6: artifacts/independent-architect-qa.json (tempDB เท่านั้น)
- ตรวจ main migration 24 ตาราง และผล/ข้อค้าง 4 โครงการตรงก่อนเริ่ม: artifacts/step3-main-migration-check.json
- ตรวจ UI บนสำเนาแยก port5188: เพิ่ม3แท็กให้ไม้อัดเดียว, ลบแท็ก/refresh/undo, เลือกทั้งหมดเฉพาะค้นหาและล้างselectionเมื่อเปลี่ยนfilter, ลบ2ต้นทุน 5600→3800→undo5600, เพิ่ม2ต้นทุนครั้งเดียวแล้วคำนวณ6190.28, ป้องกันรายการเพิ่มซ้ำ
- ภาพ UI: artifacts/step3-library-qa.png; ปรับช่องcheckboxแท็กที่พบล้นคอลัมน์แล้ว
- Excel1/2/3 และ backup18/22/24 ตรวจผ่าน integration/API/ไฟล์จริงใน tempDB; การเลือกไฟล์ผ่านกล่องของเบราว์เซอร์ยังรอเจ้าของลองบนเครื่อง (เครื่องมือตรวจUIรอfilechooserไม่สำเร็จ ไม่มีข้อมูลนำเข้าผ่านวิธีนั้น)
- ไม่เปลี่ยน lib แกนคำนวณ ไม่เชื่อม InsForge ไม่ deploy Vercel ไม่ commit/push รอบนี้

ข้อจำกัด: undo คืนการลบล่าสุดในขอบเขตเดียวกัน หากมีการแก้โครงการหรือรายการที่เกี่ยวข้องภายหลังจน version ไม่ตรง จะบล็อกทั้งชุดแทนการทับงานใหม่ ไม่ใช่ Ctrl+Z ทุกรายการแก้ไข การระบุหินจริงอาศัย scope STONE/COUNTERTOP (และ ST01 เฉพาะตัวอย่าง) ต้องจัดข้อมูลคลังจริงให้ถูก ข้อมูลราคา/ขอบเขต/Index และงาน L07–L12 ที่ค้างยังต้องตรวจตาม BACKLOG

ขั้นที่เหลือเพื่อรับรูปแบบรอบนี้: คุณต๋องทดลองหนึ่งโครงการตาม TRY-STEP3 แล้วแจ้งจุดที่ต้องปรับ ส่วนออนไลน์แยกอนุมัติภายหลัง
