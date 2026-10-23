import fs from 'node:fs';
// Generates the first migration only before it is applied. No legacy schema is read.
const target=process.argv[2];if(!target)throw Error('migration path required');
if(fs.existsSync(target)&&fs.statSync(target).size>100)throw Error('Refusing to overwrite migration history');
let sql=`-- Master 1.6. Fresh isolated TEST project only. No legacy objects.
CREATE DOMAIN public.boq_text AS text CHECK (length(btrim(VALUE)) > 0);
CREATE DOMAIN public.boq_positive AS numeric(20,6) CHECK (VALUE > 0 AND VALUE <> 'NaN'::numeric);
CREATE DOMAIN public.boq_nonnegative AS numeric(20,6) CHECK (VALUE >= 0 AND VALUE <> 'NaN'::numeric);
CREATE FUNCTION public.boq_key(text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,public,pg_temp AS $$ SELECT lower(normalize(btrim($1),NFC)) $$;
`;
const uuid='uuid PRIMARY KEY DEFAULT gen_random_uuid()',stamp='created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()';
const ref=(table,key)=>`uuid NOT NULL REFERENCES public.${table}(${key})`;
const conversion=`conversion_method text NOT NULL CHECK(conversion_method IN ('DIRECT','COUNT','COUNT_LENGTH','AREA','VOLUME')),
pack_count public.boq_positive,length_m public.boq_positive,width_m public.boq_positive,volume_l public.boq_positive,
purchase_increment public.boq_positive NOT NULL,coverage_area_per_purchase public.boq_positive,coverage_note text,
CHECK ((conversion_method='DIRECT' AND pack_count IS NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NULL AND purchase_unit_id=usage_unit_id)
OR (conversion_method='COUNT' AND pack_count IS NOT NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NULL)
OR (conversion_method='COUNT_LENGTH' AND pack_count IS NOT NULL AND length_m IS NOT NULL AND width_m IS NULL AND volume_l IS NULL)
OR (conversion_method='AREA' AND pack_count IS NULL AND length_m IS NOT NULL AND width_m IS NOT NULL AND volume_l IS NULL)
OR (conversion_method='VOLUME' AND pack_count IS NULL AND length_m IS NULL AND width_m IS NULL AND volume_l IS NOT NULL))`;
const tables={
companies:`company_id ${uuid}, company_name public.boq_text NOT NULL,address public.boq_text NOT NULL,phone public.boq_text NOT NULL,email text,tax_id text,logo_file_ref text,is_active boolean NOT NULL DEFAULT true`,
members:`member_id ${uuid},auth_subject uuid NOT NULL UNIQUE REFERENCES auth.users(id),display_name public.boq_text NOT NULL,email public.boq_text NOT NULL,phone text,is_active boolean NOT NULL DEFAULT true`,
company_memberships:`membership_id ${uuid},company_id ${ref('companies','company_id')} UNIQUE,member_id ${ref('members','member_id')} UNIQUE,role text NOT NULL DEFAULT 'OWNER' CHECK(role='OWNER'),is_active boolean NOT NULL DEFAULT true,UNIQUE(company_id,membership_id)`,
units:`unit_id ${uuid},unit_code public.boq_text NOT NULL UNIQUE,unit_name public.boq_text NOT NULL,symbol public.boq_text NOT NULL,dimension text NOT NULL CHECK(dimension IN ('LENGTH','AREA','VOLUME','COUNT')),allowed_for_sale boolean NOT NULL DEFAULT false,is_active boolean NOT NULL DEFAULT true`,
cost_types:`cost_type_id ${uuid},type_code text NOT NULL UNIQUE CHECK(type_code IN ('MATERIAL','EQUIPMENT','LABOR','OTHER')),type_name public.boq_text NOT NULL,is_active boolean NOT NULL DEFAULT true`,
work_categories:`category_id ${uuid},company_id ${ref('companies','company_id')},category_code public.boq_text NOT NULL,category_name public.boq_text NOT NULL,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),is_active boolean NOT NULL DEFAULT true,UNIQUE(company_id,category_code)`,
projects:`project_id ${uuid},company_id ${ref('companies','company_id')},project_code public.boq_text NOT NULL,project_name public.boq_text NOT NULL,owner_name public.boq_text NOT NULL,contact_name text,contact_phone text,location_text text,map_url text,pricing_conditions text,description text,start_date date,prepared_by_membership_id uuid NOT NULL,pricing_status text NOT NULL DEFAULT 'DRAFT' CHECK(pricing_status IN ('DRAFT','LOCKED')),locked_at timestamptz,version bigint NOT NULL DEFAULT 1 CHECK(version>0),is_archived boolean NOT NULL DEFAULT false,FOREIGN KEY(company_id,prepared_by_membership_id) REFERENCES public.company_memberships(company_id,membership_id),UNIQUE(company_id,project_code),CHECK((pricing_status='DRAFT' AND locked_at IS NULL) OR (pricing_status='LOCKED' AND locked_at IS NOT NULL))`,
areas:`area_id ${uuid},project_id ${ref('projects','project_id')},parent_area_id uuid,area_code public.boq_text NOT NULL,area_name public.boq_text NOT NULL,area_type text NOT NULL CHECK(area_type IN ('BUILDING','FLOOR','ROOM','ZONE')),pricing_note text,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),UNIQUE(project_id,area_code),UNIQUE(project_id,area_id),FOREIGN KEY(project_id,parent_area_id) REFERENCES public.areas(project_id,area_id),CHECK(parent_area_id IS DISTINCT FROM area_id)`,
work_items:`work_item_id ${uuid},project_id ${ref('projects','project_id')},area_id uuid NOT NULL,keyplan_code public.boq_text NOT NULL,work_name public.boq_text NOT NULL,description text,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),UNIQUE(project_id,keyplan_code),FOREIGN KEY(project_id,area_id) REFERENCES public.areas(project_id,area_id)`,
work_components:`component_id ${uuid},work_item_id ${ref('work_items','work_item_id')},category_id ${ref('work_categories','category_id')},component_name public.boq_text NOT NULL,specification text,note text,quantity numeric(18,6) NOT NULL CHECK(quantity>=0 AND quantity<>'NaN'::numeric),selling_unit_id ${ref('units','unit_id')},target_margin_percent numeric(9,4) NOT NULL CHECK(target_margin_percent>=0 AND target_margin_percent<100),construction_method text NOT NULL CHECK(construction_method IN ('CUSTOM','VS_MODULAR')),sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0)`,
cost_resources:`resource_id ${uuid},company_id ${ref('companies','company_id')},resource_code public.boq_text NOT NULL,resource_name public.boq_text NOT NULL,specification text,cost_type_id ${ref('cost_types','cost_type_id')},purchase_unit_id ${ref('units','unit_id')},usage_unit_id ${ref('units','unit_id')},purchase_unit_price public.boq_nonnegative NOT NULL,${conversion},price_updated_at timestamptz NOT NULL,is_active boolean NOT NULL DEFAULT true,version bigint NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(company_id,resource_code)`,
modular_products:`resource_id uuid PRIMARY KEY REFERENCES public.cost_resources(resource_id),function_code public.boq_text NOT NULL,width_mm integer NOT NULL CHECK(width_mm>0),height_mm integer NOT NULL CHECK(height_mm>0),depth_mm integer NOT NULL CHECK(depth_mm>0),led_code text NOT NULL CHECK(led_code IN ('0','1','2')),included_scope text,excluded_scope text,index_reference text`,
project_resources:`project_resource_id ${uuid},project_id ${ref('projects','project_id')},resource_id ${ref('cost_resources','resource_id')},name_snapshot public.boq_text NOT NULL,specification_snapshot text,cost_type_id ${ref('cost_types','cost_type_id')},purchase_unit_id ${ref('units','unit_id')},usage_unit_id ${ref('units','unit_id')},purchase_unit_price public.boq_nonnegative NOT NULL,${conversion},note text,is_active boolean NOT NULL DEFAULT true,UNIQUE(project_id,resource_id)`,
cost_groups:`cost_group_id ${uuid},group_code varchar(40) NOT NULL UNIQUE,group_name public.boq_text NOT NULL,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),is_active boolean NOT NULL DEFAULT true`,
component_cost_lines:`cost_line_id ${uuid},component_id ${ref('work_components','component_id')},project_resource_id ${ref('project_resources','project_resource_id')},description_snapshot public.boq_text NOT NULL,cost_type_id ${ref('cost_types','cost_type_id')},purchase_unit_id ${ref('units','unit_id')},usage_unit_id ${ref('units','unit_id')},purchase_price_snapshot public.boq_nonnegative NOT NULL,yield_per_purchase_snapshot numeric(28,12) NOT NULL CHECK(yield_per_purchase_snapshot>0 AND yield_per_purchase_snapshot<>'NaN'::numeric),usage_numerator numeric(20,8) NOT NULL CHECK(usage_numerator>=0 AND usage_numerator<>'NaN'::numeric),usage_denominator numeric(20,8) NOT NULL CHECK(usage_denominator>0 AND usage_denominator<>'NaN'::numeric),waste_percent numeric(9,4) NOT NULL DEFAULT 0 CHECK(waste_percent>=0),quantity_basis text NOT NULL CHECK(quantity_basis IN ('PER_UNIT','TOTAL')),cost_group_id ${ref('cost_groups','cost_group_id')},scope_review_status varchar(10) NOT NULL DEFAULT 'PENDING' CHECK(scope_review_status IN ('PENDING','CONFIRMED')),pricing_data_status varchar(10) NOT NULL DEFAULT 'UNVERIFIED' CHECK(pricing_data_status IN ('SAMPLE','UNVERIFIED','VERIFIED')),note text,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0)`,
cost_line_coverages:`coverage_id ${uuid},cost_line_id ${ref('component_cost_lines','cost_line_id')},cost_group_id ${ref('cost_groups','cost_group_id')},scope_key varchar(120) NOT NULL CHECK(scope_key ~ '^[A-Z0-9]+([.][A-Z0-9_]+)+$'),coverage_mode varchar(10) NOT NULL CHECK(coverage_mode IN ('BUNDLED','DETAIL')),note text,UNIQUE(cost_line_id,cost_group_id,scope_key)`
};
for(const [name,columns]of Object.entries(tables))sql+=`CREATE TABLE public.${name} (${columns},${stamp});\nALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON public.${name} FROM anon,authenticated;\n`;
for(const [table,parent,code]of [['projects','company_id','project_code'],['areas','project_id','area_code'],['work_items','project_id','keyplan_code'],['work_categories','company_id','category_code'],['cost_resources','company_id','resource_code']])sql+=`CREATE UNIQUE INDEX ${table}_canonical_code ON public.${table} (${parent},public.boq_key(${code}));\n`;
sql+=`
CREATE FUNCTION public.boq_company() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT cm.company_id FROM public.company_memberships cm JOIN public.members m USING(member_id) JOIN public.companies c USING(company_id) WHERE m.auth_subject=(SELECT auth.uid()) AND m.is_active AND cm.is_active AND c.is_active
$$;
CREATE FUNCTION public.boq_project_company(uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT company_id FROM public.projects WHERE project_id=$1 $$;
CREATE FUNCTION public.boq_component_project(uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT w.project_id FROM public.work_components c JOIN public.work_items w USING(work_item_id) WHERE c.component_id=$1 $$;
CREATE FUNCTION public.boq_line_project(uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT public.boq_component_project(component_id) FROM public.component_cost_lines WHERE cost_line_id=$1 $$;
`;
const policies={companies:'company_id=public.boq_company()',members:'auth_subject=(SELECT auth.uid())',company_memberships:'company_id=public.boq_company()',work_categories:'company_id=public.boq_company()',projects:'company_id=public.boq_company()',areas:'public.boq_project_company(project_id)=public.boq_company()',work_items:'public.boq_project_company(project_id)=public.boq_company()',work_components:'public.boq_project_company(public.boq_component_project(component_id))=public.boq_company()',cost_resources:'company_id=public.boq_company()',modular_products:'EXISTS(SELECT 1 FROM public.cost_resources r WHERE r.resource_id=modular_products.resource_id AND r.company_id=public.boq_company())',project_resources:'public.boq_project_company(project_id)=public.boq_company()',component_cost_lines:'public.boq_project_company(public.boq_component_project(component_id))=public.boq_company()',cost_line_coverages:'public.boq_project_company(public.boq_line_project(cost_line_id))=public.boq_company()',units:'true',cost_types:'true',cost_groups:'true'};
for(const [t,p]of Object.entries(policies))sql+=`CREATE POLICY own_read ON public.${t} FOR SELECT TO authenticated USING (${p}); GRANT SELECT ON public.${t} TO authenticated;\n`;
sql+=`
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
`;
for(const t of Object.keys(tables))sql+=`CREATE TRIGGER stamp BEFORE INSERT OR UPDATE ON public.${t} FOR EACH ROW EXECUTE FUNCTION public.boq_stamp();\n`;
sql+=`REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.boq_company(),public.boq_project_company(uuid),public.boq_component_project(uuid),public.boq_line_project(uuid) TO authenticated;
`;
fs.writeFileSync(target,sql);console.log(`Generated ${Object.keys(tables).length} tables; no cloud calls`);
