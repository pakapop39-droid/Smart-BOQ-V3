CREATE FUNCTION public.boq_trial_calculate(payload jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb;l jsonb;r jsonb;rr jsonb;line_data jsonb;calc jsonb;comps jsonb:='[]';purchases jsonb:='[]';usage_map jsonb:='{}';seen text[]:='{}';code text;used numeric;cost numeric:=0;sale numeric:=0;budget numeric:=0;labor numeric:=0;material_used numeric:=0;
BEGIN
 IF jsonb_typeof(payload->'components') IS DISTINCT FROM 'array' OR jsonb_typeof(payload->'resources') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'components') NOT BETWEEN 1 AND 120 OR jsonb_array_length(payload->'resources')>2000 THEN RAISE EXCEPTION 'INVALID_TRIAL_INPUT'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(payload->'resources') LOOP
 code:=r->>'code';IF code IS NULL OR code=ANY(seen) OR code='' OR (r->>'price')::numeric IS NULL OR (r->>'price')::numeric<0 OR (r->>'price')::numeric='NaN'::numeric OR (r->>'yield')::numeric IS NULL OR (r->>'yield')::numeric<=0 OR (r->>'yield')::numeric='NaN'::numeric OR r->>'type' IS NULL OR r->>'type' NOT IN ('MATERIAL','EQUIPMENT','LABOR','OTHER') THEN RAISE EXCEPTION 'INVALID_RESOURCE'; END IF;seen:=array_append(seen,code);
 END LOOP;
 FOR c IN SELECT value FROM jsonb_array_elements(payload->'components') LOOP
 IF jsonb_typeof(c->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'lines') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_LINES'; END IF;
 line_data:='[]';
 FOR l IN SELECT value FROM jsonb_array_elements(c->'lines') LOOP
 SELECT value INTO rr FROM jsonb_array_elements(payload->'resources') WHERE value->>'code'=l->>'code';IF rr IS NULL THEN RAISE EXCEPTION 'UNKNOWN_RESOURCE'; END IF;
 used:=public.boq_line_usage((c->>'quantity')::numeric,(l->>'numerator')::numeric,(l->>'denominator')::numeric,(l->>'waste')::numeric,l->>'basis');code:=l->>'code';
 usage_map:=jsonb_set(usage_map,ARRAY[code],to_jsonb((coalesce((usage_map->>code)::numeric,0)+used)::text));
 IF rr->>'type'='LABOR' THEN labor:=labor+used*(rr->>'price')::numeric(80,32)/(rr->>'yield')::numeric; ELSE material_used:=material_used+used*(rr->>'price')::numeric(80,32)/(rr->>'yield')::numeric; END IF;
 line_data:=line_data||jsonb_build_array(l||jsonb_build_object('price',rr->>'price','yield',rr->>'yield'));
 END LOOP;
 calc:=public.boq_component_calc((c->>'quantity')::numeric,(c->>'margin')::numeric,line_data);cost:=cost+(calc->>'cost_total')::numeric;sale:=sale+(calc->>'sale_total')::numeric;comps:=comps||jsonb_build_array(calc||jsonb_build_object('code',c->>'code','name',c->>'name','quantity',c->>'quantity','unit',c->>'unit'));
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(payload->'resources') LOOP
 code:=r->>'code';IF r->>'type'='LABOR' OR NOT usage_map?code THEN CONTINUE; END IF;
 calc:=public.boq_purchase_calc((usage_map->>code)::numeric,(r->>'yield')::numeric,(r->>'increment')::numeric,(r->>'price')::numeric);budget:=budget+(calc->>'purchase_budget')::numeric;purchases:=purchases||jsonb_build_array(calc||jsonb_build_object('code',code,'name',r->>'name','purchase_unit',r->>'purchase_unit','usage_unit',r->>'usage_unit'));
 END LOOP;
 RETURN jsonb_build_object('components',comps,'purchases',purchases,'cost_total',cost::text,'sale_total',sale::text,'difference',(sale-cost)::text,'material_purchase_budget',budget::text,'labor_total',round(labor,2)::text,'combined_budget',(budget+round(labor,2))::text,'cash_difference',(sale-budget-round(labor,2))::text,'purchase_excess',(budget-round(material_used,2))::text,'data_status','SAMPLE','persisted',false);
END $$;
REVOKE ALL ON FUNCTION public.boq_trial_calculate(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boq_trial_calculate(jsonb) TO anon,authenticated;
