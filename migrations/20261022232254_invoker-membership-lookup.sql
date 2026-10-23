-- Break the RLS helper cycle using the authenticated member identity directly.
DROP POLICY own_read ON public.company_memberships;
CREATE POLICY own_read ON public.company_memberships FOR SELECT TO authenticated USING (is_active AND EXISTS(SELECT 1 FROM public.members m WHERE m.member_id=company_memberships.member_id AND m.auth_subject=(SELECT auth.uid()) AND m.is_active));
DROP POLICY own_read ON public.companies;
CREATE POLICY own_read ON public.companies FOR SELECT TO authenticated USING (is_active AND EXISTS(SELECT 1 FROM public.company_memberships cm JOIN public.members m USING(member_id) WHERE cm.company_id=companies.company_id AND cm.is_active AND m.is_active AND m.auth_subject=(SELECT auth.uid())));
ALTER FUNCTION public.boq_company() SECURITY INVOKER;
