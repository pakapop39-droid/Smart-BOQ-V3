CREATE OR REPLACE FUNCTION public.boq_catalog_export() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tenant uuid:=public.boq_company(); result jsonb; BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 SELECT coalesce(jsonb_agg((to_jsonb(r)-'company_id'-'created_at'-'updated_at'-'cost_type_id'-'purchase_unit_id'-'usage_unit_id')
 ||jsonb_build_object('version',r.version::text,'kind',CASE WHEN m.resource_id IS NOT NULL THEN 'VS_MODULAR' WHEN ct.type_code='LABOR' THEN 'LABOR' ELSE 'MATERIAL' END,'cost_type_code',ct.type_code,'purchase_unit_code',pu.unit_code,'usage_unit_code',uu.unit_code)
 ||jsonb_build_object('purchase_unit_price',r.purchase_unit_price::text,'pack_count',r.pack_count::text,'length_m',r.length_m::text,'width_m',r.width_m::text,'volume_l',r.volume_l::text,'purchase_increment',r.purchase_increment::text,'coverage_area_per_purchase',r.coverage_area_per_purchase::text)
||coalesce(to_jsonb(m)-'resource_id'-'created_at'-'updated_at','{}'::jsonb) ORDER BY r.resource_code),'[]'::jsonb) INTO result
 FROM public.cost_resources r JOIN public.cost_types ct USING(cost_type_id) JOIN public.units pu ON pu.unit_id=r.purchase_unit_id JOIN public.units uu ON uu.unit_id=r.usage_unit_id LEFT JOIN public.modular_products m USING(resource_id)
 WHERE r.company_id=tenant AND ct.type_code IN ('MATERIAL','EQUIPMENT','LABOR');
 RETURN jsonb_build_object('template_version','1','rows',result); END $$;
UPDATE public.cost_groups SET group_code='CARCASS_MATERIAL',group_name='วัสดุโครงตู้' WHERE group_code='CARCASS';
INSERT INTO public.cost_groups(group_code,group_name,sort_order) VALUES('CARCASS_PRODUCTION','ค่าแรงผลิตโครงตู้',2);
REVOKE ALL ON FUNCTION public.boq_catalog_export() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.boq_component_calc(numeric,numeric,jsonb),public.boq_purchase_calc(numeric,numeric,numeric,numeric) TO authenticated;
