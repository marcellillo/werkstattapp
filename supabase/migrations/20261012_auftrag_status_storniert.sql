-- Der Status "storniert" fehlte in der Prüfregel der Aufträge, obwohl die App "Auftrag stornieren" anbietet und
-- überall nach diesem Status filtert -- das Stornieren schlug dadurch (still) fehl.
ALTER TABLE public.auftraege DROP CONSTRAINT IF EXISTS auftraege_status_check;
ALTER TABLE public.auftraege ADD CONSTRAINT auftraege_status_check
  CHECK (status = ANY (ARRAY['angenommen','diagnose','reparatur','warten_teile','fertig','ausgeliefert','verkauft','storniert']));
