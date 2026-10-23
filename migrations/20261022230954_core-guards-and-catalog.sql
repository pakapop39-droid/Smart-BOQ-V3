-- No direct client writes: guards also protect operator mistakes and future RPCs.
DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_conversion_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE dim text; code text; BEGIN
 SELECT dimension,unit_code INTO dim,code FROM public.units WHERE unit_id=NEW.usage_unit_id AND is_active;
 IF dim IS NULL OR (NEW.conversion_method='COUNT' AND dim<>'COUNT') OR (NEW.conversion_method='COUNT_LENGTH' AND code<>'M') OR (NEW.conversion_method='AREA' AND code<>'M2') OR (NEW.conversion_method='VOLUME' AND code<>'L') THEN RAISE EXCEPTION 'CONVERSION_UNIT_MISMATCH'; END IF;
 PERFORM public.boq_yield(NEW.conversion_method,NEW.pack_count,NEW.length_m,NEW.width_m,NEW.volume_l);
 RETURN NEW; END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_conversion_guard: %', SQLERRM; END $diag$;
CREATE TRIGGER conversion_guard BEFORE INSERT OR UPDATE ON public.cost_resources FOR EACH ROW EXECUTE FUNCTION public.boq_conversion_guard();
CREATE TRIGGER conversion_guard BEFORE INSERT OR UPDATE ON public.project_resources FOR EACH ROW EXECUTE FUNCTION public.boq_conversion_guard();

DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_catalog_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.version:=1;
 ELSE
 IF NEW.resource_id<>OLD.resource_id OR NEW.company_id<>OLD.company_id OR NEW.resource_code<>OLD.resource_code THEN RAISE EXCEPTION 'IMMUTABLE_RESOURCE_IDENTITY'; END IF;
 -- These fields define a different SKU, not a price edit.
 IF ROW(NEW.specification,NEW.cost_type_id,NEW.purchase_unit_id,NEW.usage_unit_id,NEW.conversion_method,NEW.pack_count,NEW.length_m,NEW.width_m,NEW.volume_l) IS DISTINCT FROM ROW(OLD.specification,OLD.cost_type_id,OLD.purchase_unit_id,OLD.usage_unit_id,OLD.conversion_method,OLD.pack_count,OLD.length_m,OLD.width_m,OLD.volume_l) THEN RAISE EXCEPTION 'SPEC_CHANGE_REQUIRES_NEW_CODE'; END IF;
 NEW.version:=OLD.version+1;
 END IF; RETURN NEW; END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_catalog_guard: %', SQLERRM; END $diag$;
CREATE TRIGGER catalog_guard BEFORE INSERT OR UPDATE ON public.cost_resources FOR EACH ROW EXECUTE FUNCTION public.boq_catalog_guard();
DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_modular_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE code text; BEGIN
 IF TG_OP='UPDATE' AND NEW.resource_id<>OLD.resource_id THEN RAISE EXCEPTION 'IMMUTABLE_RESOURCE_IDENTITY'; END IF;
 SELECT resource_code INTO code FROM public.cost_resources WHERE resource_id=NEW.resource_id FOR UPDATE;
 IF code <> NEW.function_code||'-'||lpad(NEW.width_mm::text,4,'0')||'-'||lpad(NEW.height_mm::text,4,'0')||'-'||lpad(NEW.depth_mm::text,4,'0')||'-'||NEW.led_code THEN RAISE EXCEPTION 'MODULAR_CODE_MISMATCH'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.function_code,NEW.width_mm,NEW.height_mm,NEW.depth_mm,NEW.led_code) IS DISTINCT FROM ROW(OLD.function_code,OLD.width_mm,OLD.height_mm,OLD.depth_mm,OLD.led_code) THEN RAISE EXCEPTION 'SPEC_CHANGE_REQUIRES_NEW_CODE'; END IF;
 -- All runtime modular writes use catalog_commit, which bumps the parent version once.
 RETURN NEW; END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_modular_guard: %', SQLERRM; END $diag$;
CREATE TRIGGER modular_guard BEFORE INSERT OR UPDATE ON public.modular_products FOR EACH ROW EXECUTE FUNCTION public.boq_modular_guard();

DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_project_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
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
 END CASE;
 UPDATE public.projects SET updated_at=now() WHERE project_id=pid;
 RETURN NEW; END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_project_guard: %', SQLERRM; END $diag$;
CREATE TRIGGER project_guard BEFORE INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.boq_project_guard();
CREATE TRIGGER project_guard BEFORE INSERT OR UPDATE OR DELETE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.boq_project_guard();
CREATE TRIGGER project_guard BEFORE INSERT OR UPDATE OR DELETE ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.boq_project_guard();
CREATE TRIGGER project_guard BEFORE INSERT OR UPDATE OR DELETE ON public.work_components FOR EACH ROW EXECUTE FUNCTION public.boq_project_guard();
CREATE TRIGGER project_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_resources FOR EACH ROW EXECUTE FUNCTION public.boq_project_guard();
CREATE TRIGGER project_guard BEFORE INSERT OR UPDATE OR DELETE ON public.component_cost_lines FOR EACH ROW EXECUTE FUNCTION public.boq_project_guard();
CREATE TRIGGER project_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cost_line_coverages FOR EACH ROW EXECUTE FUNCTION public.boq_project_guard();

DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_catalog_export() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tenant uuid:=public.boq_company(); result jsonb; BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 SELECT coalesce(jsonb_agg((to_jsonb(r)-'company_id'-'created_at'-'updated_at'-'cost_type_id'-'purchase_unit_id'-'usage_unit_id')
 ||jsonb_build_object('version',r.version::text,'kind',CASE WHEN m.resource_id IS NOT NULL THEN 'VS_MODULAR' WHEN ct.type_code='LABOR' THEN 'LABOR' ELSE 'MATERIAL' END,'cost_type_code',ct.type_code,'purchase_unit_code',pu.unit_code,'usage_unit_code',uu.unit_code)
 ||coalesce(to_jsonb(m)-'resource_id'-'created_at'-'updated_at','{}'::jsonb) ORDER BY r.resource_code),'[]'::jsonb) INTO result
 FROM public.cost_resources r JOIN public.cost_types ct USING(cost_type_id) JOIN public.units pu ON pu.unit_id=r.purchase_unit_id JOIN public.units uu ON uu.unit_id=r.usage_unit_id LEFT JOIN public.modular_products m USING(resource_id)
 WHERE r.company_id=tenant AND ct.type_code IN ('MATERIAL','EQUIPMENT','LABOR');
 RETURN jsonb_build_object('template_version','1','rows',result); END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_catalog_export: %', SQLERRM; END $diag$;

-- Pure row planner plus tenant-scoped lookup. Only callers below are exposed.
DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_catalog_plan(row_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tenant uuid:=public.boq_company(); r public.cost_resources; oldr public.cost_resources; m public.modular_products; oldm public.modular_products; obj jsonb; modobj jsonb; before_obj jsonb; expected bigint; kind text; action text; key text;
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
END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_catalog_plan: %', SQLERRM; END $diag$;

DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_catalog_preview(rows_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row_data jsonb; plan jsonb; plans jsonb:='[]'; seen_ids text[]:='{}'; seen_codes text[]:='{}'; n integer:=0; k text; rid text; ok boolean:=true;
BEGIN
 IF public.boq_company() IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 IF jsonb_typeof(rows_data) IS DISTINCT FROM 'array' OR jsonb_array_length(rows_data)>10000 THEN RAISE EXCEPTION 'INVALID_ROW_COUNT'; END IF;
 FOR row_data IN SELECT value FROM jsonb_array_elements(rows_data) LOOP
 n:=n+1;
 BEGIN
 k:=public.boq_key(row_data->>'resource_code');rid:=nullif(row_data->>'resource_id','');
 IF k=ANY(seen_codes) OR (rid IS NOT NULL AND rid=ANY(seen_ids)) THEN RAISE EXCEPTION 'DUPLICATE_ROW'; END IF;
 seen_codes:=array_append(seen_codes,k);IF rid IS NOT NULL THEN seen_ids:=array_append(seen_ids,rid); END IF;
 plan:=public.boq_catalog_plan(row_data);
 EXCEPTION WHEN OTHERS THEN plan:=jsonb_build_object('action','ERROR','message',SQLERRM); END;
 IF plan->>'action' NOT IN ('ADD','UPDATE','NO_CHANGE') THEN ok:=false; END IF;
 plans:=plans||jsonb_build_array(plan||jsonb_build_object('row',n));
 END LOOP;
 RETURN jsonb_build_object('valid',ok,'rows',plans,'preview_token',md5(plans::text)); END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_catalog_preview: %', SQLERRM; END $diag$;

DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_catalog_commit(rows_data jsonb,preview_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tenant uuid:=public.boq_company(); preview jsonb; plan jsonb; r public.cost_resources; m public.modular_products; rid uuid; added integer:=0; changed integer:=0; unchanged integer:=0;
BEGIN
 IF tenant IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 -- Serialize catalog writes per company, including first-time rows.
 PERFORM 1 FROM public.companies WHERE company_id=tenant FOR UPDATE;
 preview:=public.boq_catalog_preview(rows_data);
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
END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_catalog_commit: %', SQLERRM; END $diag$;

-- Read persisted snapshots once; coverage never participates in the monetary sum.
DO $diag$ BEGIN EXECUTE $definition$CREATE FUNCTION public.boq_project_calculate(pid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c record; pr record; calc jsonb; comps jsonb:='[]'; purchases jsonb:='[]'; pending jsonb:='[]'; ct numeric:=0; st numeric:=0; budget numeric:=0; labor numeric:=0; usage numeric; yy numeric; item jsonb;
BEGIN
 IF public.boq_company() IS NULL OR public.boq_project_company(pid) IS DISTINCT FROM public.boq_company() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 FOR c IN SELECT x.* FROM public.work_components x JOIN public.work_items w USING(work_item_id) WHERE w.project_id=pid ORDER BY w.sort_order,x.sort_order,x.component_id LOOP
 IF c.quantity=0 OR NOT EXISTS(SELECT 1 FROM public.component_cost_lines WHERE component_id=c.component_id) THEN pending:=pending||jsonb_build_array(c.component_id);CONTINUE; END IF;
 SELECT public.boq_component_calc(c.quantity,c.target_margin_percent,jsonb_agg(jsonb_build_object('price',purchase_price_snapshot::text,'yield',yield_per_purchase_snapshot::text,'numerator',usage_numerator::text,'denominator',usage_denominator::text,'waste',waste_percent::text,'basis',quantity_basis))) INTO calc FROM public.component_cost_lines WHERE component_id=c.component_id;
 ct:=ct+(calc->>'cost_total')::numeric;st:=st+(calc->>'sale_total')::numeric;comps:=comps||jsonb_build_array(calc||jsonb_build_object('component_id',c.component_id,'work_item_id',c.work_item_id));
 END LOOP;
 FOR pr IN SELECT p.*,t.type_code FROM public.project_resources p JOIN public.cost_types t USING(cost_type_id) WHERE p.project_id=pid AND EXISTS(SELECT 1 FROM public.component_cost_lines l WHERE l.project_resource_id=p.project_resource_id) LOOP
 SELECT sum(public.boq_line_usage(c.quantity,l.usage_numerator,l.usage_denominator,l.waste_percent,l.quantity_basis)) INTO usage FROM public.component_cost_lines l JOIN public.work_components c USING(component_id) WHERE l.project_resource_id=pr.project_resource_id;
 IF pr.type_code='LABOR' THEN
 SELECT coalesce(sum(public.boq_line_usage(c.quantity,l.usage_numerator,l.usage_denominator,l.waste_percent,l.quantity_basis)*l.purchase_price_snapshot::numeric(80,32)/l.yield_per_purchase_snapshot),0) INTO yy FROM public.component_cost_lines l JOIN public.work_components c USING(component_id) WHERE l.project_resource_id=pr.project_resource_id;
 labor:=labor+yy;CONTINUE; END IF;
 yy:=public.boq_yield(pr.conversion_method,pr.pack_count,pr.length_m,pr.width_m,pr.volume_l);
 item:=public.boq_purchase_calc(usage,yy,pr.purchase_increment,pr.purchase_unit_price);budget:=budget+(item->>'purchase_budget')::numeric;purchases:=purchases||jsonb_build_array(item||jsonb_build_object('project_resource_id',pr.project_resource_id));
 END LOOP;
 RETURN jsonb_build_object('components',comps,'purchases',purchases,'incomplete_components',pending,'cost_total',ct::text,'sale_total',st::text,'difference',(st-ct)::text,'material_purchase_budget',budget::text,'labor_total',round(labor,2)::text,'combined_budget',(budget+round(labor,2))::text,'cash_difference',(st-budget-round(labor,2))::text,'ready_to_lock',false);
END $$;$definition$; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'boq_project_calculate: %', SQLERRM; END $diag$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.boq_company(),public.boq_project_company(uuid),public.boq_component_project(uuid),public.boq_line_project(uuid),public.boq_catalog_export(),public.boq_catalog_preview(jsonb),public.boq_catalog_commit(jsonb,text),public.boq_project_calculate(uuid) TO authenticated;

INSERT INTO public.units(unit_code,unit_name,symbol,dimension,allowed_for_sale) VALUES
('M','เมตร','ม.','LENGTH',true),('M2','ตารางเมตร','ตร.ม.','AREA',true),('SET','ชุด','ชุด','COUNT',true),('SHEET','แผ่น','แผ่น','COUNT',false),('BUNDLE','มัด','มัด','COUNT',false),('CAN','ปี๊บ','ปี๊บ','COUNT',false),('L','ลิตร','ลิตร','VOLUME',false),('ITEM','ใบ','ใบ','COUNT',false);
INSERT INTO public.cost_types(type_code,type_name) VALUES ('MATERIAL','วัสดุ'),('EQUIPMENT','อุปกรณ์'),('LABOR','ค่าแรง'),('OTHER','อื่น ๆ');
INSERT INTO public.cost_groups(group_code,group_name,sort_order) VALUES
('CARCASS','โครงตู้',1),('DOOR_CORE','แกนหน้าบาน',2),('HARDWARE','อุปกรณ์',3),('FINISH','วัสดุปิดผิว',4),('ADHESIVE','กาวและวัสดุประกอบผิว',5),('COUNTERTOP','วัสดุท็อป',6),('COUNTERTOP_LABOR','ค่าแรงงานท็อป',7),('ASSEMBLY_LABOR','ค่าแรงประกอบและทำผิว',8),('INSTALL_LABOR','ค่าแรงติดตั้ง',9),('LED','ไฟ LED',10),('TRANSPORT','ขนส่งและยกของ',11),('OTHER','อื่น ๆ',12);
