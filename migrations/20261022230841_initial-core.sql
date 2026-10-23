-- Master 1.6. Fresh isolated TEST project only. No legacy objects.
CREATE DOMAIN public.boq_text AS text CHECK (length(btrim(VALUE)) > 0);
CREATE DOMAIN public.boq_positive AS numeric(20,6) CHECK (VALUE > 0 AND VALUE <> 'NaN'::numeric);
CREATE DOMAIN public.boq_nonnegative AS numeric(20,6) CHECK (VALUE >= 0 AND VALUE <> 'NaN'::numeric);
CREATE FUNCTION public.boq_key(text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,public,pg_temp AS $$ SELECT lower(normalize(btrim($1),NFC)) $$;
CREATE TABLE public.companies (company_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_name public.boq_text NOT NULL,address public.boq_text NOT NULL,phone public.boq_text NOT NULL,email text,tax_id text,logo_file_ref text,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies FROM anon,authenticated;
CREATE TABLE public.members (member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_subject uuid NOT NULL UNIQUE REFERENCES auth.users(id),display_name public.boq_text NOT NULL,email public.boq_text NOT NULL,phone text,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members FROM anon,authenticated;
CREATE TABLE public.company_memberships (membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.companies(company_id) UNIQUE,member_id uuid NOT NULL REFERENCES public.members(member_id) UNIQUE,role text NOT NULL DEFAULT 'OWNER' CHECK(role='OWNER'),is_active boolean NOT NULL DEFAULT true,UNIQUE(company_id,membership_id),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_memberships FROM anon,authenticated;
CREATE TABLE public.units (unit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_code public.boq_text NOT NULL UNIQUE,unit_name public.boq_text NOT NULL,symbol public.boq_text NOT NULL,dimension text NOT NULL CHECK(dimension IN ('LENGTH','AREA','VOLUME','COUNT')),allowed_for_sale boolean NOT NULL DEFAULT false,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.units FROM anon,authenticated;
CREATE TABLE public.cost_types (cost_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),type_code text NOT NULL UNIQUE CHECK(type_code IN ('MATERIAL','EQUIPMENT','LABOR','OTHER')),type_name public.boq_text NOT NULL,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.cost_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cost_types FROM anon,authenticated;
CREATE TABLE public.work_categories (category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.companies(company_id),category_code public.boq_text NOT NULL,category_name public.boq_text NOT NULL,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),is_active boolean NOT NULL DEFAULT true,UNIQUE(company_id,category_code),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.work_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_categories FROM anon,authenticated;
CREATE TABLE public.projects (project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.companies(company_id),project_code public.boq_text NOT NULL,project_name public.boq_text NOT NULL,owner_name public.boq_text NOT NULL,contact_name text,contact_phone text,location_text text,map_url text,pricing_conditions text,description text,start_date date,prepared_by_membership_id uuid NOT NULL,pricing_status text NOT NULL DEFAULT 'DRAFT' CHECK(pricing_status IN ('DRAFT','LOCKED')),locked_at timestamptz,version bigint NOT NULL DEFAULT 1 CHECK(version>0),is_archived boolean NOT NULL DEFAULT false,FOREIGN KEY(company_id,prepared_by_membership_id) REFERENCES public.company_memberships(company_id,membership_id),UNIQUE(company_id,project_code),CHECK((pricing_status='DRAFT' AND locked_at IS NULL) OR (pricing_status='LOCKED' AND locked_at IS NOT NULL)),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.projects FROM anon,authenticated;
CREATE TABLE public.areas (area_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(project_id),parent_area_id uuid,area_code public.boq_text NOT NULL,area_name public.boq_text NOT NULL,area_type text NOT NULL CHECK(area_type IN ('BUILDING','FLOOR','ROOM','ZONE')),pricing_note text,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),UNIQUE(project_id,area_code),UNIQUE(project_id,area_id),FOREIGN KEY(project_id,parent_area_id) REFERENCES public.areas(project_id,area_id),CHECK(parent_area_id IS DISTINCT FROM area_id),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.areas FROM anon,authenticated;
CREATE TABLE public.work_items (work_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(project_id),area_id uuid NOT NULL,keyplan_code public.boq_text NOT NULL,work_name public.boq_text NOT NULL,description text,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),UNIQUE(project_id,keyplan_code),FOREIGN KEY(project_id,area_id) REFERENCES public.areas(project_id,area_id),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_items FROM anon,authenticated;
CREATE TABLE public.work_components (component_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),work_item_id uuid NOT NULL REFERENCES public.work_items(work_item_id),category_id uuid NOT NULL REFERENCES public.work_categories(category_id),component_name public.boq_text NOT NULL,specification text,note text,quantity numeric(18,6) NOT NULL CHECK(quantity>=0 AND quantity<>'NaN'::numeric),selling_unit_id uuid NOT NULL REFERENCES public.units(unit_id),target_margin_percent numeric(9,4) NOT NULL CHECK(target_margin_percent>=0 AND target_margin_percent<100),construction_method text NOT NULL CHECK(construction_method IN ('CUSTOM','VS_MODULAR')),sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.work_components ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_components FROM anon,authenticated;
CREATE TABLE public.cost_resources (resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.companies(company_id),resource_code public.boq_text NOT NULL,resource_name public.boq_text NOT NULL,specification text,cost_type_id uuid NOT NULL REFERENCES public.cost_types(cost_type_id),purchase_unit_id uuid NOT NULL REFERENCES public.units(unit_id),usage_unit_id uuid NOT NULL REFERENCES public.units(unit_id),purchase_unit_price public.boq_nonnegative NOT NULL,conversion_method text NOT NULL CHECK(conversion_method IN ('DIRECT','COUNT','COUNT_LENGTH','AREA','VOLUME')),
pack_count public.boq_positive,length_m public.boq_positive,width_m public.boq_positive,volume_l public.boq_positive,
purchase_increment public.boq_positive NOT NULL,coverage_area_per_purchase public.boq_positive,coverage_note text,
CHECK ((conversion_method='DIRECT' AND pack_count IS NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NULL AND purchase_unit_id=usage_unit_id)
OR (conversion_method='COUNT' AND pack_count IS NOT NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NULL)
OR (conversion_method='COUNT_LENGTH' AND pack_count IS NOT NULL AND length_m IS NOT NULL AND width_m IS NULL AND volume_l IS NULL)
OR (conversion_method='AREA' AND pack_count IS NULL AND length_m IS NOT NULL AND width_m IS NOT NULL AND volume_l IS NULL)
OR (conversion_method='VOLUME' AND pack_count IS NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NOT NULL)),price_updated_at timestamptz NOT NULL,is_active boolean NOT NULL DEFAULT true,version bigint NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(company_id,resource_code),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.cost_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cost_resources FROM anon,authenticated;
CREATE TABLE public.modular_products (resource_id uuid PRIMARY KEY REFERENCES public.cost_resources(resource_id),function_code public.boq_text NOT NULL,width_mm integer NOT NULL CHECK(width_mm>0),height_mm integer NOT NULL CHECK(height_mm>0),depth_mm integer NOT NULL CHECK(depth_mm>0),led_code text NOT NULL CHECK(led_code IN ('0','1','2')),included_scope text,excluded_scope text,index_reference text,created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.modular_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.modular_products FROM anon,authenticated;
CREATE TABLE public.project_resources (project_resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(project_id),resource_id uuid NOT NULL REFERENCES public.cost_resources(resource_id),name_snapshot public.boq_text NOT NULL,specification_snapshot text,cost_type_id uuid NOT NULL REFERENCES public.cost_types(cost_type_id),purchase_unit_id uuid NOT NULL REFERENCES public.units(unit_id),usage_unit_id uuid NOT NULL REFERENCES public.units(unit_id),purchase_unit_price public.boq_nonnegative NOT NULL,conversion_method text NOT NULL CHECK(conversion_method IN ('DIRECT','COUNT','COUNT_LENGTH','AREA','VOLUME')),
pack_count public.boq_positive,length_m public.boq_positive,width_m public.boq_positive,volume_l public.boq_positive,
purchase_increment public.boq_positive NOT NULL,coverage_area_per_purchase public.boq_positive,coverage_note text,
CHECK ((conversion_method='DIRECT' AND pack_count IS NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NULL AND purchase_unit_id=usage_unit_id)
OR (conversion_method='COUNT' AND pack_count IS NOT NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NULL)
OR (conversion_method='COUNT_LENGTH' AND pack_count IS NOT NULL AND length_m IS NOT NULL AND width_m IS NULL AND volume_l IS NULL)
OR (conversion_method='AREA' AND pack_count IS NULL AND length_m IS NOT NULL AND width_m IS NOT NULL AND volume_l IS NULL)
OR (conversion_method='VOLUME' AND pack_count IS NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NOT NULL)),note text,is_active boolean NOT NULL DEFAULT true,UNIQUE(project_id,resource_id),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_resources FROM anon,authenticated;
CREATE TABLE public.cost_groups (cost_group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_code varchar(40) NOT NULL UNIQUE,group_name public.boq_text NOT NULL,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.cost_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cost_groups FROM anon,authenticated;
CREATE TABLE public.component_cost_lines (cost_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),component_id uuid NOT NULL REFERENCES public.work_components(component_id),project_resource_id uuid NOT NULL REFERENCES public.project_resources(project_resource_id),description_snapshot public.boq_text NOT NULL,cost_type_id uuid NOT NULL REFERENCES public.cost_types(cost_type_id),purchase_unit_id uuid NOT NULL REFERENCES public.units(unit_id),usage_unit_id uuid NOT NULL REFERENCES public.units(unit_id),purchase_price_snapshot public.boq_nonnegative NOT NULL,yield_per_purchase_snapshot numeric(28,12) NOT NULL CHECK(yield_per_purchase_snapshot>0 AND yield_per_purchase_snapshot<>'NaN'::numeric),usage_numerator numeric(20,8) NOT NULL CHECK(usage_numerator>=0 AND usage_numerator<>'NaN'::numeric),usage_denominator numeric(20,8) NOT NULL CHECK(usage_denominator>0 AND usage_denominator<>'NaN'::numeric),waste_percent numeric(9,4) NOT NULL DEFAULT 0 CHECK(waste_percent>=0),quantity_basis text NOT NULL CHECK(quantity_basis IN ('PER_UNIT','TOTAL')),cost_group_id uuid NOT NULL REFERENCES public.cost_groups(cost_group_id),scope_review_status varchar(10) NOT NULL DEFAULT 'PENDING' CHECK(scope_review_status IN ('PENDING','CONFIRMED')),pricing_data_status varchar(10) NOT NULL DEFAULT 'UNVERIFIED' CHECK(pricing_data_status IN ('SAMPLE','UNVERIFIED','VERIFIED')),note text,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.component_cost_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.component_cost_lines FROM anon,authenticated;
CREATE TABLE public.cost_line_coverages (coverage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cost_line_id uuid NOT NULL REFERENCES public.component_cost_lines(cost_line_id),cost_group_id uuid NOT NULL REFERENCES public.cost_groups(cost_group_id),scope_key varchar(120) NOT NULL CHECK(scope_key ~ '^[A-Z0-9]+([.][A-Z0-9_]+)+$'),coverage_mode varchar(10) NOT NULL CHECK(coverage_mode IN ('BUNDLED','DETAIL')),note text,UNIQUE(cost_line_id,cost_group_id,scope_key),created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.cost_line_coverages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cost_line_coverages FROM anon,authenticated;
CREATE UNIQUE INDEX projects_canonical_code ON public.projects (company_id,public.boq_key(project_code));
CREATE UNIQUE INDEX areas_canonical_code ON public.areas (project_id,public.boq_key(area_code));
CREATE UNIQUE INDEX work_items_canonical_code ON public.work_items (project_id,public.boq_key(keyplan_code));
CREATE UNIQUE INDEX work_categories_canonical_code ON public.work_categories (company_id,public.boq_key(category_code));
CREATE UNIQUE INDEX cost_resources_canonical_code ON public.cost_resources (company_id,public.boq_key(resource_code));

CREATE FUNCTION public.boq_company() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT cm.company_id FROM public.company_memberships cm JOIN public.members m USING(member_id) JOIN public.companies c USING(company_id) WHERE m.auth_subject=(SELECT auth.uid()) AND m.is_active AND cm.is_active AND c.is_active
$$;
CREATE FUNCTION public.boq_project_company(uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT company_id FROM public.projects WHERE project_id=$1 $$;
CREATE FUNCTION public.boq_component_project(uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT w.project_id FROM public.work_components c JOIN public.work_items w USING(work_item_id) WHERE c.component_id=$1 $$;
CREATE FUNCTION public.boq_line_project(uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT public.boq_component_project(component_id) FROM public.component_cost_lines WHERE cost_line_id=$1 $$;
CREATE POLICY own_read ON public.companies FOR SELECT TO authenticated USING (company_id=public.boq_company()); GRANT SELECT ON public.companies TO authenticated;
CREATE POLICY own_read ON public.members FOR SELECT TO authenticated USING (auth_subject=(SELECT auth.uid())); GRANT SELECT ON public.members TO authenticated;
CREATE POLICY own_read ON public.company_memberships FOR SELECT TO authenticated USING (company_id=public.boq_company()); GRANT SELECT ON public.company_memberships TO authenticated;
CREATE POLICY own_read ON public.work_categories FOR SELECT TO authenticated USING (company_id=public.boq_company()); GRANT SELECT ON public.work_categories TO authenticated;
CREATE POLICY own_read ON public.projects FOR SELECT TO authenticated USING (company_id=public.boq_company()); GRANT SELECT ON public.projects TO authenticated;
CREATE POLICY own_read ON public.areas FOR SELECT TO authenticated USING (public.boq_project_company(project_id)=public.boq_company()); GRANT SELECT ON public.areas TO authenticated;
CREATE POLICY own_read ON public.work_items FOR SELECT TO authenticated USING (public.boq_project_company(project_id)=public.boq_company()); GRANT SELECT ON public.work_items TO authenticated;
CREATE POLICY own_read ON public.work_components FOR SELECT TO authenticated USING (public.boq_project_company(public.boq_component_project(component_id))=public.boq_company()); GRANT SELECT ON public.work_components TO authenticated;
CREATE POLICY own_read ON public.cost_resources FOR SELECT TO authenticated USING (company_id=public.boq_company()); GRANT SELECT ON public.cost_resources TO authenticated;
CREATE POLICY own_read ON public.modular_products FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.cost_resources r WHERE r.resource_id=modular_products.resource_id AND r.company_id=public.boq_company())); GRANT SELECT ON public.modular_products TO authenticated;
CREATE POLICY own_read ON public.project_resources FOR SELECT TO authenticated USING (public.boq_project_company(project_id)=public.boq_company()); GRANT SELECT ON public.project_resources TO authenticated;
CREATE POLICY own_read ON public.component_cost_lines FOR SELECT TO authenticated USING (public.boq_project_company(public.boq_component_project(component_id))=public.boq_company()); GRANT SELECT ON public.component_cost_lines TO authenticated;
CREATE POLICY own_read ON public.cost_line_coverages FOR SELECT TO authenticated USING (public.boq_project_company(public.boq_line_project(cost_line_id))=public.boq_company()); GRANT SELECT ON public.cost_line_coverages TO authenticated;
CREATE POLICY own_read ON public.units FOR SELECT TO authenticated USING (true); GRANT SELECT ON public.units TO authenticated;
CREATE POLICY own_read ON public.cost_types FOR SELECT TO authenticated USING (true); GRANT SELECT ON public.cost_types TO authenticated;
CREATE POLICY own_read ON public.cost_groups FOR SELECT TO authenticated USING (true); GRANT SELECT ON public.cost_groups TO authenticated;

-- Precision: all calculation function intermediates use unconstrained NUMERIC with
-- div_scale of at least 32 decimals (explicit numeric casts on input dividends).
CREATE FUNCTION public.boq_yield(method text,pack numeric,len numeric,wid numeric,vol numeric) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE y numeric; BEGIN
 y:=CASE method WHEN 'DIRECT' THEN 1 WHEN 'COUNT' THEN pack WHEN 'COUNT_LENGTH' THEN pack*len WHEN 'AREA' THEN wid*len WHEN 'VOLUME' THEN vol ELSE NULL END;
 IF y IS NULL OR y<=0 OR y='NaN'::numeric THEN RAISE EXCEPTION 'INVALID_CONVERSION'; END IF; RETURN y; END $$;
CREATE FUNCTION public.boq_line_usage(q numeric,n numeric,d numeric,w numeric,b text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN IF q IS NULL OR n IS NULL OR d IS NULL OR w IS NULL OR q<0 OR n<0 OR d<=0 OR w<0 OR b IS NULL OR b NOT IN ('PER_UNIT','TOTAL') OR q='NaN'::numeric OR n='NaN'::numeric OR d='NaN'::numeric OR w='NaN'::numeric THEN RAISE EXCEPTION 'INVALID_USAGE'; END IF;
RETURN n::numeric(80,32)/d*(1+w::numeric(80,32)/100)*CASE b WHEN 'PER_UNIT' THEN q ELSE 1 END; END $$;
CREATE FUNCTION public.boq_component_calc(q numeric,margin numeric,lines jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE l jsonb; raw_cost numeric:=0; use_qty numeric; unit_cost numeric; unit_sale numeric;
BEGIN
 IF q IS NULL OR q<=0 OR margin IS NULL OR margin<0 OR margin>=100 OR q='NaN'::numeric OR margin='NaN'::numeric OR jsonb_typeof(lines) IS DISTINCT FROM 'array' OR jsonb_array_length(lines)=0 THEN RAISE EXCEPTION 'INCOMPLETE_COMPONENT'; END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(lines) LOOP
 IF (l->>'yield')::numeric IS NULL OR (l->>'yield')::numeric<=0 OR (l->>'price')::numeric IS NULL OR (l->>'price')::numeric<0 OR (l->>'yield')::numeric='NaN'::numeric OR (l->>'price')::numeric='NaN'::numeric THEN RAISE EXCEPTION 'INVALID_PRICE_YIELD'; END IF;
 use_qty:=public.boq_line_usage(q,(l->>'numerator')::numeric,(l->>'denominator')::numeric,(l->>'waste')::numeric,l->>'basis');
 raw_cost:=raw_cost + use_qty*(l->>'price')::numeric(80,32)/(l->>'yield')::numeric;
 END LOOP;
 unit_cost:=raw_cost::numeric(80,32)/q; unit_sale:=round(unit_cost/(1-margin::numeric(80,32)/100),2);
 RETURN jsonb_build_object('cost_per_unit',unit_cost::text,'cost_total',round(q*unit_cost,2)::text,'sale_per_unit',unit_sale::text,'sale_total',round(q*unit_sale,2)::text,'difference',(round(q*unit_sale,2)-round(q*unit_cost,2))::text);
END $$;
CREATE FUNCTION public.boq_purchase_calc(usage numeric,y numeric,inc numeric,price numeric) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE qty numeric; BEGIN IF usage IS NULL OR y IS NULL OR inc IS NULL OR price IS NULL OR usage<0 OR y<=0 OR inc<=0 OR price<0 OR usage='NaN'::numeric OR y='NaN'::numeric OR inc='NaN'::numeric OR price='NaN'::numeric THEN RAISE EXCEPTION 'INVALID_PURCHASE'; END IF;
 qty:=ceil(usage::numeric(80,32)/y/inc)*inc;
 RETURN jsonb_build_object('usage_total',usage::text,'purchase_quantity',qty::text,'purchase_budget',round(qty*price,2)::text,'theoretical_remainder',(qty*y-usage)::text); END $$;
-- Defensive timestamp trigger; write surface is RPC-only, never broad client DML.
CREATE FUNCTION public.boq_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN NEW.updated_at:=clock_timestamp(); IF TG_OP='INSERT' THEN NEW.created_at:=clock_timestamp(); END IF; RETURN NEW; END $$;
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.company_memberships FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.cost_types FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.work_categories FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.work_components FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.cost_resources FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.modular_products FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.project_resources FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.cost_groups FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.component_cost_lines FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.cost_line_coverages FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.boq_company(),public.boq_project_company(uuid),public.boq_component_project(uuid),public.boq_line_project(uuid) TO authenticated;
