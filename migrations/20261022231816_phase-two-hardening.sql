CREATE OR REPLACE FUNCTION public.boq_project_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE pid uuid; oldpid uuid; p public.projects; tenant uuid; other_tenant uuid; cur uuid; BEGIN
 IF TG_TABLE_NAME='projects' THEN
 IF TG_OP<>'INSERT' AND OLD.pricing_status='LOCKED' THEN RAISE EXCEPTION 'PROJECT_LOCKED'; END IF;
 IF TG_OP='UPDATE' AND (NEW.project_id<>OLD.project_id OR NEW.company_id<>OLD.company_id) THEN RAISE EXCEPTION 'IMMUTABLE_PROJECT_IDENTITY'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ARCHIVE_INSTEAD_OF_DELETE'; END IF;
 IF NEW.pricing_status='LOCKED' THEN RAISE EXCEPTION 'USE_PROJECT_LOCK_SERVICE'; END IF;
 IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1; END IF; RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'DELETE_NOT_AVAILABLE_IN_PHASE2'; END IF;
 CASE TG_TABLE_NAME
 WHEN 'areas','work_items','project_resources' THEN pid:=NEW.project_id; IF TG_OP='UPDATE' THEN oldpid:=OLD.project_id; END IF;
 WHEN 'work_components' THEN SELECT project_id INTO pid FROM public.work_items WHERE work_item_id=NEW.work_item_id; IF TG_OP='UPDATE' AND NEW.work_item_id<>OLD.work_item_id THEN RAISE EXCEPTION 'REPARENT_NOT_ALLOWED'; END IF;
 WHEN 'component_cost_lines' THEN pid:=public.boq_component_project(NEW.component_id); IF TG_OP='UPDATE' AND NEW.component_id<>OLD.component_id THEN RAISE EXCEPTION 'REPARENT_NOT_ALLOWED'; END IF;
 WHEN 'cost_line_coverages' THEN pid:=public.boq_line_project(NEW.cost_line_id); IF TG_OP='UPDATE' AND NEW.cost_line_id<>OLD.cost_line_id THEN RAISE EXCEPTION 'REPARENT_NOT_ALLOWED'; END IF;
 END CASE;
 IF oldpid IS NOT NULL AND oldpid<>pid THEN RAISE EXCEPTION 'REPARENT_NOT_ALLOWED'; END IF;
 SELECT * INTO p FROM public.projects WHERE project_id=pid FOR UPDATE;
 IF p.project_id IS NULL OR p.pricing_status<>'DRAFT' THEN RAISE EXCEPTION 'PROJECT_LOCKED_OR_MISSING'; END IF;
 tenant:=p.company_id;
 CASE TG_TABLE_NAME
 WHEN 'areas' THEN
 cur:=NEW.parent_area_id; WHILE cur IS NOT NULL LOOP IF cur=NEW.area_id THEN RAISE EXCEPTION 'AREA_CYCLE'; END IF; SELECT parent_area_id INTO cur FROM public.areas WHERE area_id=cur; END LOOP;
 WHEN 'work_components' THEN
 SELECT company_id INTO other_tenant FROM public.work_categories WHERE category_id=NEW.category_id;
 IF other_tenant IS DISTINCT FROM tenant THEN RAISE EXCEPTION 'CATEGORY_COMPANY_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.units WHERE unit_id=NEW.selling_unit_id AND allowed_for_sale AND is_active) THEN RAISE EXCEPTION 'INVALID_SELLING_UNIT'; END IF;
 WHEN 'project_resources' THEN
 SELECT company_id INTO other_tenant FROM public.cost_resources WHERE resource_id=NEW.resource_id;
 IF other_tenant IS DISTINCT FROM tenant THEN RAISE EXCEPTION 'RESOURCE_COMPANY_MISMATCH'; END IF;
 WHEN 'component_cost_lines' THEN
 IF NOT EXISTS(SELECT 1 FROM public.project_resources pr WHERE pr.project_resource_id=NEW.project_resource_id AND pr.project_id=pid AND pr.cost_type_id=NEW.cost_type_id AND pr.purchase_unit_id=NEW.purchase_unit_id AND pr.usage_unit_id=NEW.usage_unit_id) THEN RAISE EXCEPTION 'COST_LINE_RESOURCE_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM public.project_resources pr JOIN public.modular_products mp USING(resource_id) WHERE pr.project_resource_id=NEW.project_resource_id) AND (NEW.quantity_basis<>'TOTAL' OR NEW.usage_numerator/NEW.usage_denominator<>trunc(NEW.usage_numerator/NEW.usage_denominator)) THEN RAISE EXCEPTION 'MODULAR_REQUIRES_TOTAL_INTEGER'; END IF;
 ELSE NULL;
 END CASE;
 UPDATE public.projects SET updated_at=now() WHERE project_id=pid;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.boq_catalog_commit_for(tenant uuid,rows_data jsonb,preview_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE preview jsonb; plan jsonb; r public.cost_resources; m public.modular_products; rid uuid; added integer:=0; changed integer:=0; unchanged integer:=0;
BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 -- Serialize catalog writes per company, including first-time rows.
 PERFORM 1 FROM public.companies WHERE company_id=tenant FOR UPDATE;
 preview:=public.boq_catalog_preview_for(tenant,rows_data);
 IF NOT (preview->>'valid')::boolean OR (preview->>'preview_token' IS DISTINCT FROM preview_token AND EXISTS(SELECT 1 FROM jsonb_array_elements(preview->'rows') x WHERE x->>'action'<>'NO_CHANGE')) THEN RAISE EXCEPTION 'PREVIEW_CHANGED_OR_INVALID'; END IF;

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
CREATE OR REPLACE FUNCTION public.boq_test_catalog() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $test$ DECLARE tenant uuid; second_tenant uuid; payload jsonb:='[{"kind":"MATERIAL","resource_id":null,"version":null,"resource_code":"SAMPLE-LM01","resource_name":"SAMPLE ลามิเนต","specification":null,"cost_type_code":"MATERIAL","purchase_unit_code":"SHEET","usage_unit_code":"M2","purchase_unit_price":"1200.000000","conversion_method":"AREA","pack_count":null,"length_m":"2.400000","width_m":"1.200000","volume_l":null,"purchase_increment":"1.000000","coverage_area_per_purchase":null,"coverage_note":null,"price_updated_at":"2026-10-23T00:00:00Z","is_active":true},{"kind":"LABOR","resource_id":null,"version":null,"resource_code":"SAMPLE-LB01","resource_name":"SAMPLE ค่าแรง","specification":null,"cost_type_code":"LABOR","purchase_unit_code":"M","usage_unit_code":"M","purchase_unit_price":"600","conversion_method":"DIRECT","pack_count":null,"length_m":null,"width_m":null,"volume_l":null,"purchase_increment":"1.000000","coverage_area_per_purchase":null,"coverage_note":null,"price_updated_at":"2026-10-23T00:00:00Z","is_active":true},{"kind":"VS_MODULAR","resource_id":null,"version":null,"resource_code":"b-0800-0750-0600-0","resource_name":"SAMPLE โครงตู้","specification":null,"cost_type_code":"MATERIAL","purchase_unit_code":"ITEM","usage_unit_code":"ITEM","purchase_unit_price":"4000","conversion_method":"DIRECT","pack_count":null,"length_m":null,"width_m":null,"volume_l":null,"purchase_increment":"1.000000","coverage_area_per_purchase":null,"coverage_note":null,"price_updated_at":"2026-10-23T00:00:00Z","is_active":true,"function_code":"b","width_mm":"800","height_mm":"750","depth_mm":"600","led_code":"0","included_scope":"SAMPLE รอตรวจ Index","excluded_scope":"SAMPLE รอตรวจ Index","index_reference":null}]'::jsonb; preview jsonb; result jsonb; item jsonb; revised jsonb; old_payload jsonb; rid uuid; cnt bigint; v bigint; caught boolean; BEGIN BEGIN
 INSERT INTO public.companies(company_name,address,phone) VALUES('SAMPLE rollback-only','SAMPLE','SAMPLE') RETURNING company_id INTO tenant;
 INSERT INTO public.companies(company_name,address,phone) VALUES('SAMPLE other tenant rollback-only','SAMPLE','SAMPLE') RETURNING company_id INTO second_tenant;
 preview:=public.boq_catalog_preview_for(tenant,payload); IF NOT (preview->>'valid')::boolean THEN RAISE EXCEPTION 'PREVIEW_FAIL %',preview; END IF;
 result:=public.boq_catalog_commit_for(tenant,payload,preview->>'preview_token');IF result->>'added'<>'3' THEN RAISE EXCEPTION 'ADD_FAIL %',result; END IF;
 preview:=public.boq_catalog_preview_for(tenant,payload);result:=public.boq_catalog_commit_for(tenant,payload,preview->>'preview_token');IF result->>'unchanged'<>'3' THEN RAISE EXCEPTION 'REPEAT_FAIL %',result; END IF;
 SELECT resource_id,version INTO rid,v FROM public.cost_resources WHERE company_id=tenant AND resource_code='SAMPLE-LM01';IF v<>1 THEN RAISE EXCEPTION 'NOOP_VERSION_FAIL'; END IF;
 item:=payload->0||jsonb_build_object('resource_id',rid,'version','1');old_payload:=jsonb_build_array(item);
 item:=item||jsonb_build_object('purchase_unit_price','1250');revised:=jsonb_build_array(item);
 preview:=public.boq_catalog_preview_for(tenant,revised);result:=public.boq_catalog_commit_for(tenant,revised,preview->>'preview_token');IF result->>'updated'<>'1' THEN RAISE EXCEPTION 'UPDATE_FAIL %',result; END IF;
 SELECT version INTO v FROM public.cost_resources WHERE resource_id=rid;IF v<>2 THEN RAISE EXCEPTION 'UPDATE_VERSION_FAIL'; END IF;
 preview:=public.boq_catalog_preview_for(tenant,revised);IF preview->'rows'->0->>'action'<>'NO_CHANGE' THEN RAISE EXCEPTION 'REPEAT_OLD_VERSION_FAIL'; END IF;
 preview:=public.boq_catalog_preview_for(tenant,old_payload);IF preview->'rows'->0->>'action'<>'CONFLICT' THEN RAISE EXCEPTION 'STALE_FAIL %',preview; END IF;
 preview:=public.boq_catalog_preview_for(second_tenant,revised);IF (preview->>'valid')::boolean THEN RAISE EXCEPTION 'CROSS_TENANT_FAIL'; END IF;
 preview:=public.boq_catalog_preview_for(tenant,jsonb_build_array(payload->0,payload->0));IF (preview->>'valid')::boolean THEN RAISE EXCEPTION 'DUPLICATE_FAIL'; END IF;
 preview:=public.boq_catalog_preview_for(tenant,'[]');result:=public.boq_catalog_commit_for(tenant,'[]',preview->>'preview_token');SELECT count(*) INTO cnt FROM public.cost_resources WHERE company_id=tenant;IF cnt<>3 THEN RAISE EXCEPTION 'DELETION_FAIL'; END IF;
 caught:=false;BEGIN PERFORM public.boq_component_calc(0,40,'[]');EXCEPTION WHEN OTHERS THEN caught:=true;END;IF NOT caught THEN RAISE EXCEPTION 'ZERO_QUANTITY_FAIL'; END IF;
 caught:=false;BEGIN PERFORM public.boq_component_calc(1,100,'[{"price":"1000","yield":"1","numerator":"1.5","denominator":"1","waste":"0","basis":"PER_UNIT"},{"price":"1200","yield":"2.88","numerator":"1.44","denominator":"1","waste":"0","basis":"PER_UNIT"},{"price":"3000","yield":"1","numerator":"0.6","denominator":"1","waste":"0","basis":"PER_UNIT"},{"price":"800","yield":"1","numerator":"1","denominator":"1","waste":"0","basis":"PER_UNIT"},{"price":"300","yield":"1","numerator":"1","denominator":"1","waste":"0","basis":"PER_UNIT"},{"price":"1400","yield":"1","numerator":"1","denominator":"1","waste":"0","basis":"PER_UNIT"},{"price":"600","yield":"1","numerator":"1","denominator":"1","waste":"0","basis":"PER_UNIT"}]'::jsonb);EXCEPTION WHEN OTHERS THEN caught:=true;END;IF NOT caught THEN RAISE EXCEPTION 'MARGIN_FAIL'; END IF;
 -- An HTTP retry uses the old preview token but must be an idempotent no-op.
 result:=public.boq_catalog_commit_for(tenant,revised,'old-response-token');IF result->>'unchanged'<>'1' THEN RAISE EXCEPTION 'NETWORK_RETRY_FAIL'; END IF;
 -- Change modular scope: same resource, parent version increases once.
 SELECT resource_id INTO rid FROM public.cost_resources WHERE company_id=tenant AND resource_code='b-0800-0750-0600-0';
 item:=payload->2||jsonb_build_object('resource_id',rid,'version','1','included_scope','SAMPLE updated scope');
 preview:=public.boq_catalog_preview_for(tenant,jsonb_build_array(item));result:=public.boq_catalog_commit_for(tenant,jsonb_build_array(item),preview->>'preview_token');
 SELECT version INTO v FROM public.cost_resources WHERE resource_id=rid;IF v<>2 THEN RAISE EXCEPTION 'MODULAR_VERSION_FAIL'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.modular_products WHERE resource_id=rid AND included_scope='SAMPLE updated scope') THEN RAISE EXCEPTION 'MODULAR_SCOPE_FAIL'; END IF;
 RAISE EXCEPTION 'PHASE2_CATALOG_REHEARSAL_PASS_ROLLED_BACK';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PHASE2_CATALOG_REHEARSAL_PASS_ROLLED_BACK' THEN RAISE; END IF; END; RETURN jsonb_build_object('status','PASS','fixtures','rolled back'); END $test$;

ALTER TABLE public.work_components ADD COLUMN facade_area_m2 public.boq_nonnegative;
ALTER TABLE public.component_cost_lines ADD CONSTRAINT waste_finite CHECK(waste_percent<>'NaN'::numeric);
REVOKE ALL ON FUNCTION public.boq_test_catalog(),public.boq_catalog_commit_for(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
