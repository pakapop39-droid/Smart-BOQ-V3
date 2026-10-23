# พจนานุกรมข้อมูลที่ประกาศใน local/schema.mjs

วันที่ 23 ตุลาคม 2569 · 22 ตารางที่สร้างจริง · อ้าง MASTER 2.0

เอกสารนี้ดึงจาก entities.fields/refs/required สำหรับฟอร์ม local ไม่ใช่ inventory ของ JSON snapshot ทุกคีย์ ไม่รับรองว่าข้อกำหนดข้อมูลเป้าหมายครบแล้ว ดู DATA-REQUIREMENTS.md และ BACKLOG L08

ทุกตารางมี id/code/name ตามการสร้างใน local/store.mjs และเก็บ data JSON, version, created_at, updated_at; field รหัสเฉพาะและ refs จริงต่างกันในแต่ละตาราง ชื่อ field ของฟอร์มไม่ใช่ทุกคอลัมน์ SQL

## companies — บริษัท

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัส | ใช่ |
| name | ชื่อบริษัท | ใช่ |
| address | ที่อยู่ | ไม่ |
| phone | โทรศัพท์ | ไม่ |

## members — ผู้จัดทำในเครื่อง

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| name | ชื่อผู้จัดทำ | ใช่ |
| email | อีเมล | ไม่ |

## company_memberships — บัญชีกับบริษัท

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| company_id | FK → companies | ใช่ |
| member_id | FK → members | ใช่ |

## projects — โครงการ

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสโครงการ | ใช่ |
| name | ชื่อโครงการ | ใช่ |
| client | ผู้ว่าจ้าง | ไม่ |
| address | สถานที่โครงการ | ไม่ |
| notes | หมายเหตุ | ไม่ |
| company_id | FK → companies | ใช่ |
| member_id | FK → members | ใช่ |

## areas — พื้นที่ / ห้อง

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสพื้นที่ | ใช่ |
| floor_name | ชั้น / โซน | ไม่ |
| name | ชื่อพื้นที่ / ห้อง | ใช่ |
| project_id | FK → projects | ใช่ |
| parent_id | FK → areas | ไม่ |

## work_items — งาน Keyplan

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัส Keyplan ตามแบบ | ใช่ |
| name | ชื่อ Keyplan | ใช่ |
| quotation_description | รายละเอียดสำหรับใบเสนอราคา (ภายหลัง) | ไม่ |
| project_id | FK → projects | ใช่ |
| area_id | FK → areas | ใช่ |

## work_categories — หมวดงาน

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสหมวด | ใช่ |
| name | ชื่อหมวด | ใช่ |
| company_id | FK → companies | ใช่ |

## units — หน่วยนับ

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสหน่วย | ใช่ |
| name | ชื่อหน่วย | ใช่ |

## cost_types — ประเภทต้นทุน

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสประเภท | ใช่ |
| name | ชื่อประเภท | ใช่ |

## cost_resources — คลังต้นทุน

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสต้นทุน | ใช่ |
| name | ชื่อวัสดุ / ค่าแรง / สินค้าชุด | ใช่ |
| resource_kind | ชนิดรายการ | ใช่ |
| price | ราคาต่อหน่วยซื้อ | ไม่ |
| conversion_method | วิธีแปลงหน่วย | ใช่ |
| pack_count | จำนวนต่อบรรจุ | ไม่ |
| length_m | ยาว (ม.) | ไม่ |
| width_m | กว้าง (ม.) | ไม่ |
| volume_l | ปริมาตร (ลิตร) | ไม่ |
| increment | ขั้นซื้อ | ใช่ |
| scope_key | ขอบเขตต้นทุน | ไม่ |
| covered_scopes | ขอบเขตที่ชุดรวม (คั่นด้วย ,) | ไม่ |
| tags | แท็กงาน (ขึ้นบรรทัดใหม่) | ไม่ |
| notes | สเปก / หมายเหตุ | ไม่ |
| company_id | FK → companies | ใช่ |
| cost_type_id | FK → cost_types | ใช่ |
| purchase_unit_id | FK → units | ใช่ |
| usage_unit_id | FK → units | ใช่ |

## modular_products — สเปก Modular

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| width_mm | กว้าง (มม.) | ไม่ |
| height_mm | สูง (มม.) | ไม่ |
| depth_mm | ลึก (มม.) | ไม่ |
| notes | รายละเอียดสินค้า | ไม่ |
| resource_id | FK → cost_resources | ใช่ |

## cost_groups — หมวดขอบเขต

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสขอบเขต | ใช่ |
| name | ชื่อขอบเขต | ใช่ |
| company_id | FK → companies | ใช่ |

## project_resources — ทรัพยากรประจำโครงการ

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| price | ราคาอ้างอิงโครงการ | ไม่ |
| notes | หมายเหตุ | ไม่ |
| project_id | FK → projects | ใช่ |
| resource_id | FK → cost_resources | ใช่ |

## work_components — รายการทำราคา

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสรายการ | ใช่ |
| name | ชื่อรายการทำราคา | ใช่ |
| quantity | ปริมาณขาย | ใช่ |
| margin | กำไร (% ของราคาขาย) | ใช่ |
| work_item_id | FK → work_items | ใช่ |
| category_id | FK → work_categories | ใช่ |
| unit_id | FK → units | ใช่ |
| source_template_id | FK → rate_templates | ไม่ |

## component_groups — กลุ่มงาน / ชุด

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสกลุ่ม | ใช่ |
| name | ชื่อกลุ่มงาน | ใช่ |
| assembly_kind | ประเภทชุด | ใช่ |
| sourcing_method | วิธีจัดหา | ใช่ |
| calculation_method | วิธีคำนวณ | ใช่ |
| area | พื้นที่แผงด้านเดียว (ตร.ม.) | ไม่ |
| plySides | ด้านบุไม้อัด | ไม่ |
| lamSides | ด้านปิดผิว | ไม่ |
| quantity | จำนวนชุด | ไม่ |
| notes | หมายเหตุ | ไม่ |
| component_id | FK → work_components | ใช่ |
| source_template_group_id | FK → rate_template_groups | ไม่ |

## component_cost_lines — รายละเอียดต้นทุน

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| numerator | ปริมาณ / อัตรา | ไม่ |
| denominator | หารด้วย | ใช่ |
| basis | ฐานปริมาณ | ใช่ |
| waste | เผื่อเศษ (%) | ใช่ |
| price | ราคาต่อหน่วยซื้อที่ใช้คิดทุน | ไม่ |
| line_role | บทบาท | ใช่ |
| quantity_source | ฐานคำนวณปริมาณ | ใช่ |
| labor_phase | ประเภทค่าแรง | ไม่ |
| additional_reason | เหตุผลเพิ่มนอกชุด | ไม่ |
| additional_location | ตำแหน่งเพิ่มนอกชุด | ไม่ |
| notes | หมายเหตุ | ไม่ |
| component_id | FK → work_components | ใช่ |
| group_id | FK → component_groups | ไม่ |
| project_resource_id | FK → project_resources | ใช่ |
| parent_id | FK → component_cost_lines | ไม่ |
| source_template_line_id | FK → rate_template_cost_lines | ไม่ |

## cost_line_coverages — ขอบเขตราคาบรรทัด

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| scope_key | ขอบเขต | ใช่ |
| mode | วิธีครอบคลุม | ใช่ |
| notes | หมายเหตุ | ไม่ |
| cost_line_id | FK → component_cost_lines | ใช่ |
| cost_group_id | FK → cost_groups | ใช่ |
| group_id | FK → component_groups | ไม่ |
| source_template_coverage_id | FK → rate_template_coverages | ไม่ |

## resource_bundle_items — ส่วนประกอบสินค้าชุด

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| inclusion_status | รวมในชุดหรือไม่ | ใช่ |
| quantity | จำนวนต่อชุด (เว้นว่างเมื่อไม่ทราบ) | ไม่ |
| scope_key | ขอบเขต | ใช่ |
| source_reference | เอกสารอ้างอิง / หมายเหตุ | ไม่ |
| bundle_resource_id | FK → cost_resources | ใช่ |
| child_resource_id | FK → cost_resources | ใช่ |

## rate_templates — รายการทำราคากลาง

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสคลัง | ใช่ |
| name | ชื่อรายการ | ใช่ |
| revision | รุ่น | ใช่ |
| margin | กำไร (% ของราคาขาย) | ใช่ |
| quotation_description | รายละเอียดสำหรับใบเสนอราคา | ไม่ |
| company_id | FK → companies | ใช่ |
| category_id | FK → work_categories | ใช่ |
| unit_id | FK → units | ใช่ |

## rate_template_groups — กลุ่มงานต้นแบบ

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| code | รหัสกลุ่ม | ใช่ |
| name | ชื่อกลุ่มงาน | ใช่ |
| assembly_kind | ประเภทชุด | ใช่ |
| sourcing_method | วิธีจัดหา | ใช่ |
| calculation_method | วิธีคำนวณ | ใช่ |
| area | พื้นที่แผงต่อ 1 หน่วยขาย | ไม่ |
| plySides | ด้านบุไม้อัด | ไม่ |
| lamSides | ด้านปิดผิว | ไม่ |
| quantity | จำนวนชุดต่อ 1 หน่วยขาย | ไม่ |
| notes | หมายเหตุ | ไม่ |
| template_id | FK → rate_templates | ใช่ |

## rate_template_cost_lines — ต้นทุนต้นแบบต่อหน่วย

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| numerator | ปริมาณ / อัตรา | ไม่ |
| denominator | หารด้วย | ใช่ |
| basis | ฐานปริมาณ | ไม่ |
| waste | เผื่อเศษ (%) | ใช่ |
| price | ราคาต่อหน่วยซื้อที่ใช้คิดทุน | ไม่ |
| line_role | บทบาท | ใช่ |
| quantity_source | ฐานคำนวณปริมาณ | ใช่ |
| labor_phase | ประเภทค่าแรง | ไม่ |
| additional_reason | เหตุผลเพิ่มนอกชุด | ไม่ |
| additional_location | ตำแหน่งเพิ่มนอกชุด | ไม่ |
| notes | หมายเหตุ | ไม่ |
| template_id | FK → rate_templates | ใช่ |
| group_id | FK → rate_template_groups | ไม่ |
| resource_id | FK → cost_resources | ใช่ |
| parent_id | FK → rate_template_cost_lines | ไม่ |

## rate_template_coverages — ขอบเขตต้นแบบ

| ช่องฟอร์ม/อ้างอิง | ความหมาย/ปลายทาง | local required |
|---|---|---|
| scope_key | ขอบเขต | ใช่ |
| mode | วิธีครอบคลุม | ใช่ |
| notes | หมายเหตุ | ไม่ |
| template_id | FK → rate_templates | ใช่ |
| cost_line_id | FK → rate_template_cost_lines | ใช่ |
| cost_group_id | FK → cost_groups | ใช่ |
| group_id | FK → rate_template_groups | ไม่ |

## ข้อมูล runtime นอกฟอร์มที่ต้องคง

รวม status/version/revision/is_active, snapshot ราคา/หน่วย/ขอบเขตชุด, line_kind/variant/resolution, ที่มาต้นแบบและข้อมูลการยืนยันเพิ่มนอกชุด, rate_area/rate_quantity/rate_basis/is_customized, ลำดับ RT/S ในข้อมูลเจ้าของ ข้อมูลเหล่านี้ใช้กฎใน local/store.mjs และ local/rates.mjs ไม่เปิดให้แก้เป็นช่องทั่วไปเพื่อข้าม validation

ไม่มี resource_tags/resource_tag_links หรือ undo API ใน schema นี้ ณ รอบจัดเอกสาร สองตารางแท็กเป็นข้อเสนอรอบหน้า ไม่ใช่ตารางที่สร้างแล้ว
