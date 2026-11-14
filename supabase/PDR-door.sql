-- Existing project: door catalog is castle_doors, not the PDD rooms table.
-- Prepared from the verified live 27-row catalog on 2026-11-11.
BEGIN;
LOCK TABLE public.castle_doors IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.castle_doors WHERE position=19 AND badge='PDR' AND destination_passage='PDR') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.castle_doors WHERE badge='PDR' OR destination_passage='PDR') THEN
    RAISE EXCEPTION 'PDR is already assigned elsewhere; inspect before changing it';
  END IF;
  UPDATE public.castle_doors
     SET name='Puerta de los Roles', badge='PDR', destination_passage='PDR'
   WHERE position=19 AND name='Puerta 19' AND badge='19'
     AND destination_passage IS NULL AND initial_door IS FALSE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Door 19 is no longer vacant; no room was replaced';
  END IF;
END $$;
SELECT position,name,badge,destination_passage FROM public.castle_doors WHERE position=19;
COMMIT;
