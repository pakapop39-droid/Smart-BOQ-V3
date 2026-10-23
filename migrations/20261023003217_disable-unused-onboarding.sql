-- This review link is stateless. Enable account onboarding only after integration tests.
REVOKE ALL ON FUNCTION public.boq_register_company(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
