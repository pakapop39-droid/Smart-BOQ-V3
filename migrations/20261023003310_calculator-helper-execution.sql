-- Stateless SECURITY INVOKER calculators require their pure helpers too.
GRANT EXECUTE ON FUNCTION public.boq_line_usage(numeric,numeric,numeric,numeric,text),public.boq_yield(text,numeric,numeric,numeric,numeric) TO anon,authenticated;
