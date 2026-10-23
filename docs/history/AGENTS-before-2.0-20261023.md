# Smart BOQ ใหม่

- เจ้าของยืนยันวันที่ 23 ตุลาคม 2569: ทำงานและแก้ไขไฟล์เฉพาะ C:\codex\Smart BOQ V2\smart-boq-new เท่านั้น ห้ามแก้ไขโฟลเดอร์หลักหรือโครงการอื่นนอกโฟลเดอร์นี้

- คำยืนยันล่าสุด 23 ตุลาคม 2569: ทำแอปและฐาน SQLite ในเครื่องครบ 22 ตาราง รวมคลังรายการทำราคาต่อหน่วย เพื่อทดลองกรอกข้อมูล ใช้สูตรคำนวณเดิม ไม่เชื่อมฐานออนไลน์ โหมดปัจจุบันคือ localhost:5177 และ data/smart-boq-local.sqlite ดู docs/LOCAL-APP-22-GUIDE.md ห้ามใช้คำอนุมัติเฟสก่อนเป็นเหตุเรียก InsForge ในรอบ local นี้

- ตอบภาษาไทย ให้คนไม่ใช่โปรแกรมเมอร์เข้าใจ
- อ่าน docs/MASTER.md และ docs/DESIGN.md ก่อนทำงาน; นี้คือระบบใหม่แยกจาก Smart BOQ V2 เก่า
- Vercel หน้าบ้าน InsForge หลังบ้าน หนึ่งบัญชีต่อหนึ่งบริษัท ไม่มีทีม/สลับบริษัท/Option หลายชุด
- เจ้าของอนุมัติเฟส 2 และขอลิงก์ทดลองแล้ว: สร้างเว็บทดลองบน Vercel เชื่อมเฉพาะ InsForge ใหม่ได้ ห้ามแก้/เชื่อม/ย้าย/ลบระบบเดิม ยังไม่ใช่ production สำหรับข้อมูลจริง
- ห้ามคัดลอก .env, credentials, schema/migrations/functions, ข้อมูล QA หรือคลังเก่าทั้งชุดเข้าโครงการนี้
- ส่วนที่ Master ยังไม่ครบต้องอธิบายและถามก่อนทำ ห้ามสมมติกฎราคา พื้นที่ เศษ ขนส่ง หรือ VAT
- ตัวอย่างใช้ SAMPLE/PENDING และห้ามอ้างว่าพร้อมใช้จริงหรือล็อกได้ ข้อมูลจริงไม่แทนด้วยศูนย์
- การพัฒนาต่อใช้ skill ของ stack ที่เกี่ยวข้องและตรวจเป้าหมายใหม่ชัดเจน ห้ามเชื่อมกลับฐานเดิม

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **smart-boq-new-test** (API base `https://vtqfp9z6.ap-southeast.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->

- คำยืนยันล่าสุด: พัฒนา SQLite ในเครื่อง 22 ตาราง เพิ่มคลังรายการทำราคาต่อหน่วยและสำเนาเข้า Keyplan ตาม docs/LOCAL-APP-22-GUIDE.md คงราคาโครงการเดิมและสูตรเดิม ไม่เชื่อมฐานออนไลน์ ข้อความขอบเขต 18 ตารางก่อนหน้าเป็นประวัติ
