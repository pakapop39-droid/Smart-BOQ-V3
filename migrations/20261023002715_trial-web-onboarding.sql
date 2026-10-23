-- Public, stateless calculators reveal no stored business data and perform no writes.
GRANT EXECUTE ON FUNCTION public.boq_component_calc(numeric,numeric,jsonb),public.boq_purchase_calc(numeric,numeric,numeric,numeric) TO anon;

CREATE FUNCTION public.boq_register_company(company_name text,address text,phone text,display_name text,email text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE uid uuid:=auth.uid(); cid uuid; mid uuid; BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
 -- Serialize onboarding of one authenticated identity; never accept another subject.
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 IF EXISTS(SELECT 1 FROM public.members WHERE auth_subject=uid) THEN RAISE EXCEPTION 'ACCOUNT_ALREADY_REGISTERED'; END IF;
 IF length(btrim(company_name))=0 OR length(btrim(address))=0 OR length(btrim(phone))=0 OR length(btrim(display_name))=0 OR length(btrim(email))=0 THEN RAISE EXCEPTION 'REQUIRED_FIELDS'; END IF;
 INSERT INTO public.companies(company_name,address,phone) VALUES(company_name,address,phone) RETURNING company_id INTO cid;
 INSERT INTO public.members(auth_subject,display_name,email) VALUES(uid,display_name,email) RETURNING member_id INTO mid;
 INSERT INTO public.company_memberships(company_id,member_id) VALUES(cid,mid);
 RETURN cid;END $$;
REVOKE ALL ON FUNCTION public.boq_register_company(text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.boq_register_company(text,text,text,text,text) TO authenticated;
