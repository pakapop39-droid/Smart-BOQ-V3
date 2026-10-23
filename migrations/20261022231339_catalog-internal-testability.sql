-- Private tenant helpers allow rollback-only operator tests without creating auth accounts.
CREATE FUNCTION public.boq_catalog_plan_for(tenant uuid,row_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.cost_resources; oldr public.cost_resources; m public.modular_products; oldm public.modular_products; obj jsonb; modobj jsonb; before_obj jsonb; expected bigint; kind text; action text; key text;
BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 IF jsonb_typeof(row_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_ROW'; END IF;
 FOR key IN SELECT jsonb_object_keys(row_data) LOOP
 IF key NOT IN ('resource_id','version','kind','resource_code','resource_name','specification','purchase_unit_price','price_updated_at','is_active','cost_type_code','purchase_unit_code','usage_unit_code','conversion_method','pack_count','length_m','width_m','volume_l','purchase_increment','coverage_area_per_purchase','coverage_note','function_code','width_mm','height_mm','depth_mm','led_code','included_scope','excluded_scope','index_reference') THEN RAISE EXCEPTION 'UNKNOWN_COLUMN: %',key; END IF;
 END LOOP;
 kind:=row_data->>'kind'; IF kind IS NULL OR kind NOT IN ('MATERIAL','LABOR','VS_MODULAR') THEN RAISE EXCEPTION 'INVALID_KIND'; END IF;
 SELECT * INTO r FROM jsonb_populate_record(NULL::public.cost_resources,row_data-'version');
 r.company_id:=tenant;
 SELECT cost_type_id INTO r.cost_type_id FROM public.cost_types WHERE type_code=row_data->>'cost_type_code' AND is_active;
 SELECT unit_id INTO r.purchase_unit_id FROM public.units WHERE unit_code=row_data->>'purchase_unit_code' AND is_active;
 SELECT unit_id INTO r.usage_unit_id FROM public.units WHERE unit_code=row_data->>'usage_unit_code' AND is_active;
 IF r.cost_type_id IS NULL OR r.purchase_unit_id IS NULL OR r.usage_unit_id IS NULL OR r.resource_code IS NULL OR r.resource_name IS NULL OR r.purchase_unit_price IS NULL OR r.purchase_increment IS NULL OR r.price_updated_at IS NULL OR r.is_active IS NULL THEN RAISE EXCEPTION 'REQUIRED_FIELD_OR_REFERENCE_MISSING'; END IF;
 IF (kind='LABOR' AND row_data->>'cost_type_code'<>'LABOR') OR (kind IN ('MATERIAL','VS_MODULAR') AND row_data->>'cost_type_code' NOT IN ('MATERIAL','EQUIPMENT')) THEN RAISE EXCEPTION 'KIND_TYPE_MISMATCH'; END IF;
 IF r.conversion_method IS NULL OR r.conversion_method NOT IN ('DIRECT','COUNT','COUNT_LENGTH','AREA','VOLUME') THEN RAISE EXCEPTION 'INVALID_CONVERSION'; END IF;
 -- Full conversion checks are run in preview, not only at INSERT.
 IF NOT ((r.conversion_method='DIRECT' AND r.purchase_unit_id=r.usage_unit_id AND r.pack_count IS NULL AND r.length_m IS NULL AND r.width_m IS NULL AND r.volume_l IS NULL)
 OR (r.conversion_method='COUNT' AND r.pack_count IS NOT NULL AND r.length_m IS NULL AND r.width_m IS NULL AND r.volume_l IS NULL)
 OR (r.conversion_method='COUNT_LENGTH' AND r.pack_count IS NOT NULL AND r.length_m IS NOT NULL AND r.width_m IS NULL AND r.volume_l IS NULL)
 OR (r.conversion_method='AREA' AND r.pack_count IS NULL AND r.length_m IS NOT NULL AND r.width_m IS NOT NULL AND r.volume_l IS NULL)
 OR (r.conversion_method='VOLUME' AND r.pack_count IS NULL AND r.length_m IS NULL AND r.width_m IS NULL AND r.volume_l IS NOT NULL)) THEN RAISE EXCEPTION 'INVALID_CONVERSION_FIELDS'; END IF;
 IF (r.conversion_method='COUNT' AND NOT EXISTS(SELECT 1 FROM public.units WHERE unit_id=r.usage_unit_id AND dimension='COUNT')) OR (r.conversion_method IN ('COUNT_LENGTH','AREA','VOLUME') AND row_data->>'usage_unit_code'<>CASE r.conversion_method WHEN 'COUNT_LENGTH' THEN 'M' WHEN 'AREA' THEN 'M2' ELSE 'L' END) THEN RAISE EXCEPTION 'CONVERSION_UNIT_MISMATCH'; END IF;
 PERFORM public.boq_yield(r.conversion_method,r.pack_count,r.length_m,r.width_m,r.volume_l);
 IF r.resource_id IS NOT NULL THEN
 SELECT * INTO oldr FROM public.cost_resources WHERE resource_id=r.resource_id AND company_id=tenant;
 IF oldr.resource_id IS NULL OR r.resource_code<>oldr.resource_code THEN RAISE EXCEPTION 'UNKNOWN_OR_CHANGED_IDENTITY'; END IF;
 expected:=nullif(row_data->>'version','')::bigint; IF expected IS NULL OR expected<1 THEN RAISE EXCEPTION 'VERSION_REQUIRED'; END IF;
 ELSE
 IF nullif(row_data->>'version','') IS NOT NULL THEN RAISE EXCEPTION 'NEW_ROW_VERSION_MUST_BE_EMPTY'; END IF;
 SELECT * INTO oldr FROM public.cost_resources WHERE company_id=tenant AND public.boq_key(resource_code)=public.boq_key(r.resource_code);
 END IF;
 IF oldr.resource_id IS NOT NULL THEN
 SELECT * INTO oldm FROM public.modular_products WHERE resource_id=oldr.resource_id;
 IF (kind='VS_MODULAR') IS DISTINCT FROM (oldm.resource_id IS NOT NULL) THEN RAISE EXCEPTION 'KIND_CHANGED'; END IF;
 END IF;
 obj:=to_jsonb(r)-'resource_id'-'version'-'created_at'-'updated_at';
 before_obj:=to_jsonb(oldr)-'resource_id'-'version'-'created_at'-'updated_at';
 modobj:=NULL;
 IF kind='VS_MODULAR' THEN
 SELECT * INTO m FROM jsonb_populate_record(NULL::public.modular_products,row_data);
 IF m.function_code IS NULL OR m.width_mm IS NULL OR m.height_mm IS NULL OR m.depth_mm IS NULL OR m.width_mm<=0 OR m.height_mm<=0 OR m.depth_mm<=0 OR m.led_code IS NULL OR m.led_code NOT IN ('0','1','2') THEN RAISE EXCEPTION 'INCOMPLETE_MODULAR'; END IF;
 IF r.resource_code<>m.function_code||'-'||lpad(m.width_mm::text,4,'0')||'-'||lpad(m.height_mm::text,4,'0')||'-'||lpad(m.depth_mm::text,4,'0')||'-'||m.led_code THEN RAISE EXCEPTION 'MODULAR_CODE_MISMATCH'; END IF;
 modobj:=to_jsonb(m)-'resource_id'-'created_at'-'updated_at';
 ELSE
 IF EXISTS(SELECT 1 FROM jsonb_each(row_data) e WHERE e.key IN ('function_code','width_mm','height_mm','depth_mm','led_code','included_scope','excluded_scope','index_reference') AND e.value<>'null'::jsonb) THEN RAISE EXCEPTION 'MODULAR_FIELDS_ON_NON_MODULAR'; END IF;
 END IF;
 IF oldr.resource_id IS NULL THEN action:='ADD';
 ELSIF obj=before_obj AND modobj IS NOT DISTINCT FROM (CASE WHEN oldm.resource_id IS NULL THEN NULL ELSE to_jsonb(oldm)-'resource_id'-'created_at'-'updated_at' END) THEN action:='NO_CHANGE';
 ELSIF r.resource_id IS NULL THEN action:='MATCH_REVIEW';
 ELSIF expected<>oldr.version THEN action:='CONFLICT';
 ELSE
 IF ROW(r.specification,r.cost_type_id,r.purchase_unit_id,r.usage_unit_id,r.conversion_method,r.pack_count,r.length_m,r.width_m,r.volume_l) IS DISTINCT FROM ROW(oldr.specification,oldr.cost_type_id,oldr.purchase_unit_id,oldr.usage_unit_id,oldr.conversion_method,oldr.pack_count,oldr.length_m,oldr.width_m,oldr.volume_l) THEN RAISE EXCEPTION 'SPEC_CHANGE_REQUIRES_NEW_CODE'; END IF;
 action:='UPDATE'; END IF;
 RETURN jsonb_build_object('action',action,'resource_id',oldr.resource_id,'current_version',oldr.version::text,'record',obj,'modular',modobj,'before',before_obj,'before_modular',CASE WHEN oldm.resource_id IS NULL THEN NULL ELSE to_jsonb(oldm)-'resource_id'-'created_at'-'updated_at' END);
END $$;
CREATE FUNCTION public.boq_catalog_preview_for(tenant uuid,rows_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_data jsonb; plan jsonb; plans jsonb:='[]'; seen_ids text[]:='{}'; seen_codes text[]:='{}'; n integer:=0; k text; rid text; ok boolean:=true;
BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 IF jsonb_typeof(rows_data) IS DISTINCT FROM 'array' OR jsonb_array_length(rows_data)>10000 THEN RAISE EXCEPTION 'INVALID_ROW_COUNT'; END IF;
 FOR row_data IN SELECT value FROM jsonb_array_elements(rows_data) LOOP
 n:=n+1;
 BEGIN
 k:=public.boq_key(row_data->>'resource_code');rid:=nullif(row_data->>'resource_id','');
 IF k=ANY(seen_codes) OR (rid IS NOT NULL AND rid=ANY(seen_ids)) THEN RAISE EXCEPTION 'DUPLICATE_ROW'; END IF;
 seen_codes:=array_append(seen_codes,k);IF rid IS NOT NULL THEN seen_ids:=array_append(seen_ids,rid); END IF;
 plan:=public.boq_catalog_plan_for(tenant,row_data);
 EXCEPTION WHEN OTHERS THEN plan:=jsonb_build_object('action','ERROR','message',SQLERRM); END;
 IF plan->>'action' NOT IN ('ADD','UPDATE','NO_CHANGE') THEN ok:=false; END IF;
 plans:=plans||jsonb_build_array(plan||jsonb_build_object('row',n));
 END LOOP;
 RETURN jsonb_build_object('valid',ok,'rows',plans,'preview_token',md5(plans::text)); END $$;
CREATE FUNCTION public.boq_catalog_commit_for(tenant uuid,rows_data jsonb,preview_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE preview jsonb; plan jsonb; r public.cost_resources; m public.modular_products; rid uuid; added integer:=0; changed integer:=0; unchanged integer:=0;
BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 -- Serialize catalog writes per company, including first-time rows.
 PERFORM 1 FROM public.companies WHERE company_id=tenant FOR UPDATE;
 preview:=public.boq_catalog_preview_for(tenant,rows_data);
 IF NOT (preview->>'valid')::boolean OR preview->>'preview_token' IS DISTINCT FROM preview_token THEN RAISE EXCEPTION 'PREVIEW_CHANGED_OR_INVALID'; END IF;

 FOR plan IN SELECT value FROM jsonb_array_elements(preview->'rows') ORDER BY value->>'resource_id' LOOP
 IF plan->>'action'='NO_CHANGE' THEN unchanged:=unchanged+1;CONTINUE; END IF;
 rid:=coalesce((plan->>'resource_id')::uuid,gen_random_uuid());
 SELECT * INTO r FROM jsonb_populate_record(NULL::public.cost_resources,plan->'record'||jsonb_build_object('resource_id',rid,'version',1,'created_at',now(),'updated_at',now()));
 IF plan->>'action'='ADD' THEN INSERT INTO public.cost_resources SELECT r.*; added:=added+1;
 ELSE
 UPDATE public.cost_resources SET resource_name=r.resource_name,purchase_unit_price=r.purchase_unit_price,purchase_increment=r.purchase_increment,coverage_area_per_purchase=r.coverage_area_per_purchase,coverage_note=r.coverage_note,price_updated_at=r.price_updated_at,is_active=r.is_active WHERE resource_id=rid AND company_id=tenant AND version=(plan->>'current_version')::bigint;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONCURRENT_CATALOG_CHANGE'; END IF; changed:=changed+1;
 END IF;
 IF plan->'modular'<>'null'::jsonb THEN
 SELECT * INTO m FROM jsonb_populate_record(NULL::public.modular_products,plan->'modular'||jsonb_build_object('resource_id',rid,'created_at',now(),'updated_at',now()));
 IF plan->>'action'='ADD' THEN INSERT INTO public.modular_products SELECT m.*;
 ELSE UPDATE public.modular_products SET included_scope=m.included_scope,excluded_scope=m.excluded_scope,index_reference=m.index_reference WHERE resource_id=rid; END IF;
 END IF;
 END LOOP;

 RETURN jsonb_build_object('added',added,'updated',changed,'unchanged',unchanged);
END $$;
CREATE OR REPLACE FUNCTION public.boq_catalog_preview(rows_data jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT public.boq_catalog_preview_for(public.boq_company(),rows_data) $$;
CREATE OR REPLACE FUNCTION public.boq_catalog_commit(rows_data jsonb,preview_token text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT public.boq_catalog_commit_for(public.boq_company(),rows_data,preview_token) $$;
DROP FUNCTION public.boq_catalog_plan(jsonb);
REVOKE ALL ON FUNCTION public.boq_catalog_plan_for(uuid,jsonb),public.boq_catalog_preview_for(uuid,jsonb),public.boq_catalog_commit_for(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
