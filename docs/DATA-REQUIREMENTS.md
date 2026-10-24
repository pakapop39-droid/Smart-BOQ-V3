# ข้อกำหนดข้อมูลรายช่องที่ยังต้องรักษา

อ้าง MASTER 2.0 · เป็นสัญญาความสามารถ/ข้อมูล ไม่ใช่ประกาศว่า SQLite มีคอลัมน์ชื่อเดียวกันครบแล้ว ชื่อเดิมเช่น company_id/company_name เป็น logical fields ส่วน local ใช้ id/name และ JSON metadata ต้องทำ mapping ตาม L08

กำหนด required ก่อนใช้ข้อมูลจริงตามตารางต่อไป ข้อมูล local ร่างบางส่วนยังกรอกไม่ครบได้ จึงยังไม่ผ่าน VERIFIED/LOCKED ไม่ยกเลิก requirement เดิมเพราะ UI มีช่องน้อยกว่า

## ขอบเขตทศนิยมเป้าหมาย

ราคา/มิติ 20,6; quantity 18,6; margin/waste 9,4; snapshot yield 28,12; ตัวตั้ง/ตัวหาร 20,8 ตัวหารและขั้นซื้อ >0 ค่าเงิน/จำนวนไม่ติดลบ margin <100; NULL ของ reference ไม่ใช่ศูนย์ การบังคับ precision ทุกช่อง/หน่วยและสถานะยังต้องตรวจ L08/L09 โค้ด local ใช้ Decimal text ไม่ได้อ้างว่ามี PostgreSQL NUMERIC จริง

## 1 บริษัท companies

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| company_id | PK | รหัสบริษัท |
| company_name | บังคับ | ชื่อบริษัทผู้เสนอราคา |
| address, phone | บังคับ | ที่อยู่และเบอร์ติดต่อ |
| email, tax_id, logo_file_ref | เลือกกรอก | อีเมล เลขผู้เสียภาษี และไฟล์โลโก้ |
| is_active | บังคับ | สถานะบริษัท |

## 2 ผู้ใช้งาน members

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| member_id | PK | รหัสผู้ใช้ |
| auth_subject | บังคับและไม่ซ้ำ | รหัสจากระบบเข้าสู่ระบบ ไม่ใช่รหัสผ่าน |
| display_name, email | บังคับ | ชื่อที่ใช้แสดงเป็นผู้จัดทำและอีเมล |
| phone | เลือกกรอก | เบอร์ติดต่อ |
| is_active | บังคับ | สถานะผู้ใช้ |

## 3 การผูกบัญชีกับบริษัท company_memberships

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| membership_id | PK | รหัสความเป็นสมาชิก |
| company_id, member_id | FK บังคับ | บริษัทและผู้ใช้ |
| role | ค่าระบบคงที่ OWNER | ไม่มีหน้าเลือกบทบาทหรือทีม บัญชีบริษัทเดียวทำงานของบริษัทตนเมื่อผ่านกฎข้อมูล |
| is_active | บังคับ | สถานะสิทธิ์ในบริษัทนี้ |

## 4 โครงการ projects

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| project_id | PK | รหัสภายใน |
| company_id | FK บังคับ | บริษัทผู้เสนอราคา |
| project_code, project_name | บังคับ | รหัสและชื่อโครงการ |
| owner_name | บังคับ | ชื่อเจ้าของโครงการหรือผู้ว่าจ้าง |
| contact_name, contact_phone | เลือกกรอก | ผู้ติดต่อของโครงการ |
| location_text, map_url | เลือกกรอก | ที่ตั้งและลิงก์แผนที่ |
| pricing_conditions, description | เลือกกรอก | เงื่อนไขที่กระทบราคาและข้อมูลทั่วไป |
| start_date | เลือกกรอก | วันที่เริ่มโครงการ |
| prepared_by_membership_id | FK บังคับ | ผู้จัดทำหลักซึ่งอยู่บริษัทเดียวกัน |
| pricing_status, locked_at | บังคับ / ตามสถานะ | DRAFT หรือ LOCKED และเวลาล็อก |
| version, is_archived | บังคับ | ควบคุมการแก้พร้อมกันและซ่อนโครงการเก่า |

## 5 พื้นที่และห้อง areas

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| area_id | PK | รหัสพื้นที่ |
| project_id | FK บังคับ | โครงการ |
| parent_area_id | FK เลือกกรอก | พื้นที่แม่ในโครงการเดียวกัน |
| area_code, area_name | บังคับ | รหัสและชื่อพื้นที่ |
| area_type | บังคับ | BUILDING / FLOOR / ROOM / ZONE |
| pricing_note | เลือกกรอก | ข้อจำกัดของพื้นที่ที่มีผลต่อราคา |
| sort_order | บังคับ | ลำดับแสดงผล |

## 6 รายการงาน Keyplan work_items

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| work_item_id | PK | รหัสภายใน |
| project_id, area_id | FK บังคับ | โครงการและพื้นที่ติดตั้ง |
| keyplan_code, work_name | บังคับ | รหัสตามแบบและชื่อรายการงาน |
| description | เลือกกรอก | รายละเอียดรวม |
| sort_order | บังคับ | ลำดับแสดงผล |

## 7 งานย่อยที่คิดราคา work_components

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| component_id | PK | รหัสงานย่อย |
| work_item_id, category_id | FK บังคับ | Keyplan และหมวดงานในบริษัทเดียวกัน |
| component_code | บังคับตามกติกาปัจจุบัน | รหัสรายการภายใน Keyplan เช่น S001–S004; UNIQUE(work_item_id, component_code) หลัง normalize; FK ยังอ้าง component_id ไม่อ้างรหัสข้อความ |
| component_name | บังคับ | ชื่องานย่อย |
| specification, note | เลือกกรอก | สเปก ขอบเขตและหมายเหตุ |
| quantity, selling_unit_id | จำนวนและ FK บังคับ | ปริมาณจริงและหน่วยขาย |
| target_margin_percent | บังคับ | กำไรเป้าหมายของราคาขาย ตั้งแต่ 0 แต่ต่ำกว่า 100 |
| sort_order | บังคับ | ลำดับแสดงผล |

## 8 หมวดงาน work_categories

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| category_id | PK | รหัสหมวด |
| company_id | FK บังคับ | บริษัทเจ้าของหมวด |
| category_code, category_name | บังคับ | รหัสและชื่อ เช่น พื้น ผนัง ฝ้า เฟอร์นิเจอร์ ประปา |
| sort_order, is_active | บังคับ | ลำดับและสถานะ |

## 9 หน่วยนับ units

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| unit_id | PK | รหัสหน่วย |
| unit_code, unit_name, symbol | บังคับ | รหัส ชื่อ และสัญลักษณ์ |
| dimension | บังคับ | LENGTH / AREA / VOLUME / COUNT |
| allowed_for_sale, is_active | บังคับ | ใช้เป็นหน่วยขายได้หรือไม่ และสถานะ |

## 10 ประเภทต้นทุน cost_types

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| cost_type_id | PK | รหัสประเภท |
| type_code, type_name | บังคับ | MATERIAL วัสดุ / EQUIPMENT อุปกรณ์ / LABOR ค่าแรง / OTHER อื่น ๆ |
| is_active | บังคับ | สถานะ |

## 11 ทะเบียนต้นทุนกลาง cost_resources

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| resource_id | PK | รหัสภายใน |
| company_id | FK บังคับ | บริษัทเจ้าของรายการ |
| resource_code, resource_name | บังคับ | รหัส เช่น LM01 และชื่อรายการ |
| resource_kind | บังคับตามข้อกำหนด | ITEM / BUNDLE / SERVICE แยกชนิดสินค้ารายชิ้น สินค้าชุด และบริการ ไม่ใช่ cost_type |
| bundle_detail_status, bundle_scope_review_status | เฉพาะ BUNDLE | PARTIAL/COMPLETE และ PENDING/CONFIRMED พร้อมแหล่งยืนยันของที่รวม/ไม่รวม สำเนาไปโครงการ |
| specification | เลือกกรอก | ยี่ห้อ รุ่น สี ขนาด |
| cost_type_id | FK บังคับ | ประเภทต้นทุน |
| purchase_unit_id, usage_unit_id | FK บังคับ | หน่วยซื้อและหน่วยที่ใช้คำนวณ |
| purchase_unit_price | บังคับก่อนใช้คิดเงิน/ซื้อแยก | ราคาซื้อต่อหนึ่งหน่วยซื้อ; ลูกที่ใช้อ้างอิงว่ารวมในชุดอย่างเดียวและยังไม่มีราคาเดี่ยว ใช้ NULL ตามแบบ 18 ไม่แทน 0 |
| conversion_method | บังคับ | DIRECT / COUNT / COUNT_LENGTH / AREA / VOLUME |
| pack_count, length_m, width_m, volume_l | ตามวิธีแปลง | จำนวนบรรจุ ความยาว ความกว้าง หรือปริมาตร |
| purchase_increment | บังคับ > 0 | ขั้นการซื้อ เช่น 1 แผ่น หรือ 0.01 ตร.ม. |
| coverage_area_per_purchase | เลือกกรอก > 0 | พื้นที่งานที่หนึ่งหน่วยซื้อทำได้ เช่น กาว 28.80 ตร.ม. |
| coverage_note | เลือกกรอก | ขอบเขตอัตราครอบคลุม เช่น รวมทาสองพื้นผิวแล้ว |
| price_updated_at, is_active | บังคับ | วันที่ยืนยันราคาและสถานะ |
| version | BIGINT บังคับ > 0 ระบบกำหนด | ตรวจไฟล์ Excel เก่าและการแก้พร้อมกัน รายละเอียดโมดูลาร์ใช้รุ่นของแม่ร่วมกัน |
| created_at, updated_at | TIMESTAMPTZ ระบบกำหนด | เวลาสร้างและแก้ ไม่ใช้แทน version |

## 12 รายละเอียดต้นทุนต่อหน่วย component_cost_lines

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| cost_line_id | PK | รหัสบรรทัด |
| component_id | FK บังคับ | งานย่อย |
| component_group_id | FK เลือกกรอก → component_groups | NULL สำหรับต้นทุนตรง; ถ้ามีค่าต้องเป็นกลุ่มของ component เดียวกัน |
| line_role | บังคับตามข้อกำหนด | หน้าที่ในรายการงาน/ชุด เช่น FRAME / PLYWOOD / LAMINATE / ADHESIVE / OTHER ไม่บังคับอย่างละหนึ่งต่อกลุ่มทั่วไป |
| quantity_source | บังคับตามข้อกำหนด | MANUAL / GROUP_QUANTITY / PANEL_AREA / PLYWOOD_AREA / LAMINATE_AREA / PARENT_BUNDLE_USAGE ไม่คูณฐานซ้ำ |
| line_kind | บังคับตามกติกาสินค้าชุด | CHARGEABLE / INCLUDED_REFERENCE / EXCLUDED_REFERENCE; มีแต่ CHARGEABLE ที่รวมเงินและซื้อ |
| parent_bundle_cost_line_id | self-FK สำหรับ reference | ชุดแม่ CHARGEABLE ชนิด BUNDLE ใน component/group เดียวกัน ไม่ชี้ข้ามงานหรือวงวน |
| source_bundle_item_id, bundle_resource_version_snapshot | ที่มาและฉบับที่ใช้ | อ้างตาราง 18 ถ้ามี เก็บ snapshot จำนวนต่อชุด หน่วย สถานะรวม/ไม่รวม ขอบเขตและหลักฐาน ไม่อ่านคลังใหม่ย้อนหลัง |
| need_resolution, resolved_charge_line_id | เฉพาะของที่ไม่รวม | รอพิจารณา / เพิ่มแล้ว / ไม่ต้องใช้ พร้อมบรรทัดที่รับผิดชอบจริงและเหตุผล |
| project_resource_id | FK บังคับ | รายการต้นทุนประจำโครงการ ไม่อ้างทะเบียนกลางซ้ำอีกช่อง |
| description_snapshot | บังคับ | ชื่อและสเปกที่ใช้กับงานครั้งนี้ |
| cost_type_id, purchase_unit_id, usage_unit_id | ประเภท/หน่วยใช้บังคับ; หน่วยซื้อบังคับสำหรับ CHARGEABLE | reference ที่ไม่ทราบข้อมูลซื้อเดี่ยวไม่สมมติหน่วยซื้อ ต้องใช้หน่วยชิ้นส่วนที่ระบุได้จริง |
| purchase_price_snapshot | บังคับสำหรับ CHARGEABLE | ราคาซื้อที่ใช้คำนวณครั้งนี้; reference ใช้ NULL พร้อมสถานะว่ารวมแล้ว/ยังไม่รวม ไม่ใช้ราคา 0 แทน |
| yield_per_purchase_snapshot | บังคับ > 0 สำหรับ CHARGEABLE | เช่น 2.88 ตร.ม./แผ่น; reference ที่ยังไม่ทราบบรรจุใช้ NULL และคำนวณจากจำนวนต่อชุดแม่แทน |
| usage_numerator, usage_denominator | บังคับ / ตัวหาร > 0 | สูตรอัตราใช้ต่อหนึ่งหน่วยขาย เช่น 15 ÷ 28.80 ลิตร/ตร.ม. |
| waste_percent | บังคับ >= 0 | เผื่อวัสดุ ตัวอย่างใช้ 0 ไม่เพิ่มเผื่อเอง |
| quantity_basis | บังคับ | PER_UNIT = อัตราใช้ต่อหนึ่งหน่วยขาย / TOTAL = จำนวนรวมของงานย่อยนี้ |
| cost_group_id | FK บังคับ → cost_groups | กลุ่มหลักของต้นทุนบรรทัดนี้ ใช้จัดหมวด ไม่ได้ยืนยันว่าทุกรายการในกลุ่มซ้ำกัน |
| scope_review_status | บังคับ | PENDING / CONFIRMED ตรวจขอบเขตรวมและไม่รวมแล้วหรือยัง |
| pricing_data_status | บังคับ | SAMPLE / UNVERIFIED / VERIFIED แยกราคาสมมติ ราคาที่ยังไม่ตรวจ และราคาจริงที่ยืนยันแล้ว |
| note, sort_order | เลือกกรอก / บังคับ | เหตุผลปรับเฉพาะงานและลำดับ |

## 13 รายการต้นทุนประจำโครงการ project_resources

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
| --- | --- | --- |
| project_resource_id | PK | รหัสตัวเชื่อมวัสดุกับโครงการ |
| project_id, resource_id | FK บังคับ | โครงการและทะเบียนกลางของบริษัทเดียวกัน |
| name_snapshot, specification_snapshot | บังคับ / เลือกกรอก | ชื่อและสเปกที่กำหนดใช้ในโครงการ |
| cost_type_id, purchase_unit_id, usage_unit_id | FK บังคับ | ประเภทและหน่วยของโครงการ |
| purchase_unit_price | บังคับ | ราคาซื้ออ้างอิงของโครงการ |
| conversion_method, pack_count, length_m, width_m, volume_l | ตามวิธีแปลง | สำเนาวิธีแปลงและค่าที่ใช้กับโครงการ |
| purchase_increment | บังคับ > 0 | ขั้นซื้อที่ใช้สรุปจัดซื้อ |
| coverage_area_per_purchase, coverage_note | เลือกกรอก | อัตราครอบคลุมและขอบเขตที่ใช้กับโครงการ |
| note, is_active | เลือกกรอก / บังคับ | หมายเหตุและสถานะ |

## 14 รายละเอียดสินค้า VS Modular modular_products

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
|---|---|---|
| resource_id | PK และ FK → cost_resources | สินค้าหนึ่งรหัสมีรายละเอียดโมดูลาร์ได้หนึ่งแถว |
| function_code | บังคับ | รหัสฟังก์ชัน เช่น b รอชื่อจริงจาก Index ไม่คาดเดาความหมาย |
| width_mm, height_mm, depth_mm | บังคับ > 0 | ขนาดสินค้าเป็นมิลลิเมตร |
| led_code | บังคับ | 0 ไม่มีไฟ / 1 แนวตั้ง / 2 แนวนอน ตามที่ยืนยัน |
| included_scope | บังคับก่อนใช้ราคา | รายการแผง อุปกรณ์ และ LED ที่โรงงานรวมให้จริง |
| excluded_scope | บังคับก่อนใช้ราคา | ส่วนที่ต้องเพิ่ม เช่น หน้าบาน ท็อป ขนส่ง หรือติดตั้ง |
| index_reference | เลือกกรอก | เลขหรือไฟล์อ้างอิง Index ของโรงงาน |
| created_at, updated_at | ระบบกำหนด | วันเวลาสร้างและแก้ไข |

## 15 กลุ่มต้นทุน cost_groups

| ช่องข้อมูล | ชนิดและข้อกำหนด | ความหมาย |
|---|---|---|
| cost_group_id | PK ใช้ชนิดเดียวกับ PK ตารางหลัก | รหัสกลุ่ม |
| group_code | VARCHAR(40) UNIQUE NOT NULL | รหัสกลุ่มคงที่ตามหัวข้อ 14.1 |
| group_name | TEXT NOT NULL | ชื่อภาษาไทย |
| sort_order | INTEGER NOT NULL DEFAULT 0 CHECK >= 0 | ลำดับ |
| is_active | BOOLEAN NOT NULL DEFAULT true | เปิดใช้ |
| created_at, updated_at | TIMESTAMPTZ NOT NULL | เวลาที่ระบบกำหนด |

## 16 ขอบเขตต้นทุนที่ครอบคลุม cost_line_coverages

| ช่องข้อมูล | ชนิดและข้อกำหนด | ความหมาย |
|---|---|---|
| coverage_id | PK ใช้ชนิดเดียวกับ PK ตารางหลัก | รหัสแถวขอบเขต |
| cost_line_id | FK → component_cost_lines NOT NULL | บรรทัดที่รับผิดชอบต้นทุน |
| cost_group_id | FK → cost_groups NOT NULL | กลุ่มที่ราคาบรรทัดนี้ครอบคลุม อาจต่างจากกลุ่มหลักของบรรทัด |
| scope_key | VARCHAR(120) NOT NULL | ส่วนงานจริงที่ใช้เทียบซ้ำภายใน component |
| component_group_id, bundle_owner_cost_line_id | FK เพิ่มตามกติกาสินค้าชุด ตาม scope | ระบุกลุ่มและบรรทัดชุดเจ้าของขอบเขต ตรวจตรงกับ component/บริษัท ไม่ใช้เปลี่ยนข้อความ scope เพื่อหลบการตรวจซ้ำ |
| coverage_mode | VARCHAR(10) NOT NULL CHECK IN ('BUNDLED','DETAIL') | ครอบคลุมเต็ม scope หรือเป็นรายการย่อย |
| note | TEXT NULL | คำอธิบายหรือแหล่งยืนยันขอบเขต |
| created_at, updated_at | TIMESTAMPTZ NOT NULL | เวลา |

## 17 รายการงาน/ชุด component_groups — ขยายแบบกลุ่มแผงเดิม

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
|---|---|---|
| component_group_id / component_id | UUID PK / FK → work_components | รายการงาน/ชุดของงานย่อยหนึ่งงาน |
| group_code / group_name | ไม่ว่าง; UNIQUE(component_id, group_code) | เช่น BODY งานโครง, DOOR ชุดหน้าบาน, DRAWER ชุดลิ้นชัก |
| assembly_kind | CARCASS / DOOR / DRAWER / OTHER | หน้าที่ของชุด ไม่เดาจากชื่อ |
| sourcing_method | BUY / MAKE; ร่างยังไม่เลือกเป็น NULL ได้ | เลือกซื้อ/ผลิตเฉพาะชุด ไม่บังคับทั้ง S001 |
| calculation_method | MANUAL / PANEL_AREA | วิธีถอดปริมาณ ไม่ใช่วิธีจัดหา |
| group_quantity / group_unit_id | จำนวนและ FK หน่วยตามฐานที่ใช้ | ไม่คูณเมตรขายซ้ำ |
| panel_area_m2 / plywood_sides / laminate_sides | ใช้เฉพาะสูตรพื้นที่ | คงความหมายพื้นที่ด้านเดียวตามที่ยืนยัน |
| is_active / sort_order / note / created_at / updated_at | กติกาเดิม | เปิดใช้ ลำดับ และบันทึก |

## 18 ส่วนประกอบสินค้าชุด resource_bundle_items — ตารางเพิ่มในแบบล่าสุด

| ช่องข้อมูล | ข้อกำหนด | ความหมาย |
|---|---|---|
| bundle_item_id | UUID PK | รายการส่วนประกอบในคลังชุด |
| bundle_resource_id / child_resource_id | FK → cost_resources บริษัทเดียวกัน | สินค้าแม่ชนิด BUNDLE กับชิ้นส่วนที่ระบุจริง |
| inclusion_status | INCLUDED / EXCLUDED / UNKNOWN | รวม/ไม่รวม/ยังไม่ทราบ |
| quantity_per_parent_usage_unit / child_usage_unit_id | จำนวนและหน่วยใช้ลูก | NULL ถ้ายังไม่ทราบจำนวน ไม่แทนด้วย 0 |
| scope_code / description / source_reference / review_status | ขอบเขตและหลักฐาน | ตรวจจาก Index/เอกสารผู้ขาย ไม่เดาจากชื่อ |
| is_active / sort_order / created_at / updated_at | กติกาเดิม | สถานะและเวลา |

## ชื่อเดิมที่ถูกแทน ไม่เพิ่มซ้ำ

construction_method ระดับ work_components ถูกแทนด้วย sourcing_method ใน component_groups; facade_area_m2 ระดับทั้งรายการถูกแทนด้วยปริมาณ/พื้นที่ของกลุ่มและแหล่งปริมาณบรรทัดตาม MASTER 4 ไม่บังคับมีช่องเก่าคู่ช่องใหม่แล้ว sync ซ้ำ

## ข้อมูลต้นแบบสี่ตารางที่เพิ่มแล้ว

rate_templates ต้องมีรหัส/ชื่อ/หน่วย/หมวด/กำไร/รุ่น/สถานะและบริษัท; groups มีอัตราพื้นที่หรือจำนวนและ BUY/MAKE; lines มีอัตรา/ราคา snapshot/บทบาท/แหล่งปริมาณ; coverages ระบุขอบเขตของบรรทัด เก็บต้นทางและรุ่นใน snapshot โครงการ ดู RELATION-22-RATE-TEMPLATES.md และ DATA-CURRENT.md

## งานที่ต้องตรวจเพิ่มก่อนอ้างว่าครบ

ชื่อบริษัท/ที่อยู่/โทรศัพท์/ผู้จัดทำและความสัมพันธ์บริษัท, ข้อมูลผู้ว่าจ้าง, unit dimensions/allowed_for_sale, ราคาและวันที่ยืนยัน/สถานะ VERIFIED, ขอบเขต CONFIRMED/lock, สเปก Modular ฟังก์ชัน LED และ Index, version ของแม่/ลูก/Excel, audit/sort_order และการส่งออกครบถ้วน ต้องระบุ alias/implemented/pending ตามแต่ละช่อง ห้ามลบข้อกำหนดเหล่านี้เพราะยังไม่มีในฟอร์ม local

## ทะเบียนแท็กที่อนุมัติและสร้างเพิ่มในขั้นที่ 3

resource_tags: UUID, company_id, name/normalized_name NFC+trim, sort_order, version และเวลา; unique บริษัท/ชื่อมาตรฐาน

resource_tag_links: UUID, company_id, tag_id, resource_id, version และเวลา; unique tag/resource และ FK บริษัทเดียวกัน

undo_journal ใน companies.data เป็น metadata ไม่เป็นตารางธุรกิจใหม่ ไม่เปิดฟอร์มให้แก้ ห้ามคืนบริษัททั้งแถวทับลำดับรหัสล่าสุด
