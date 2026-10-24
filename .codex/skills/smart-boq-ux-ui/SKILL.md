---
name: smart-boq-ux-ui
description: Design, review, prototype, and implement authorized Smart BOQ UX/UI changes using this checkout's agreed design rules and acceptance evidence. Preserve its Master and pricing rules.
---

# Smart BOQ V3 UX/UI — project entrypoint

ตอบภาษาไทยสำหรับเจ้าของที่ไม่ใช่โปรแกรมเมอร์ ใช้ checkout ที่มีไฟล์นี้ ไม่อาศัย absolute path ของเครื่องผู้พัฒนา

ก่อนงานหน้าจออ่าน `AGENTS.md`, `docs/MASTER.md`, `docs/UX-UI-GUIDELINES.md`, `docs/UX-UI-ACCEPTANCE.md` จากราก repository นี้ แล้วอ่าน `docs/DESIGN.md`/`docs/BACKLOG.md` เฉพาะส่วนที่เกี่ยวข้อง ไฟล์ใน docs เป็นฉบับกติกากลาง ไม่ทำสำเนาทั้งฉบับในสกิล

ใช้แบบ A เปิดตารางหลักทีละชั้นในคลังราคาขาย แผงขวาใช้เพิ่ม/แก้ข้อมูลตามขอบเขตที่ยืนยัน รักษาความหมายของคำสั่ง หน่วย snapshot และสูตรตามมาสเตอร์ ไม่ออกแบบ flow ใหม่แทนโดยพลการหรือถามข้อตกลงเดิมซ้ำ หากเสนอเปลี่ยนแนวทางหลักให้อธิบายและให้เจ้าของตัดสินใจก่อน

ก่อนส่งงานตรวจ UX01–UX10 เฉพาะข้อที่ได้รับผลกระทบ ระบุ ผ่าน/ไม่ผ่าน/ยังไม่ได้ตรวจ/ไม่เกี่ยวข้อง พร้อมหลักฐานตามจริง ไม่ถือภาพ SAMPLE หรือผลเก่าว่าคืองานจริงผ่านทั้งหมด เมื่อมีคำยืนยันใหม่ให้อัปเดตเอกสารกลางพร้อมขอบเขต/หลักฐาน

งานอธิบาย ภาพร่าง หรือบันทึกเอกสารไม่ใช่คำสั่งแก้แอป/ฐาน/ออนไลน์ ไม่เปลี่ยนสูตร margin/Decimal/การปัด สิทธิ์ schema หรือข้อมูลย้อนหลังเพราะปรับ UX ใช้ component/style เดิมและรักษางานค้าง ไม่สร้างทีม/ส่งข้อความไปแชตอื่นโดยอัตโนมัติ
