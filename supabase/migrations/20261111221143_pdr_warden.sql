-- Run once as project database owner. Adventure data + separate PDR AI quota.
-- PDR isolated schema: no existing rooms/tables modified.
BEGIN;
CREATE SCHEMA IF NOT EXISTS pdr_private;
REVOKE ALL ON SCHEMA pdr_private FROM PUBLIC, anon, authenticated;
CREATE TABLE pdr_private.adventures(id text PRIMARY KEY, edition text NOT NULL CHECK(edition='cairn-2e'), revision integer NOT NULL);
CREATE TABLE pdr_private.locations(id text PRIMARY KEY, adventure_id text NOT NULL REFERENCES pdr_private.adventures, data jsonb NOT NULL);
CREATE TABLE pdr_private.connections(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, adventure_id text NOT NULL REFERENCES pdr_private.adventures, data jsonb NOT NULL);
CREATE TABLE pdr_private.encounters(id text PRIMARY KEY, adventure_id text NOT NULL REFERENCES pdr_private.adventures, data jsonb NOT NULL);
CREATE TABLE pdr_private.secrets(location_id text PRIMARY KEY REFERENCES pdr_private.locations, data jsonb NOT NULL);
ALTER TABLE pdr_private.adventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdr_private.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdr_private.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdr_private.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdr_private.secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pdr_private FROM PUBLIC, anon, authenticated;
CREATE TABLE public.pdr_licenses(adventure_id text PRIMARY KEY, data jsonb NOT NULL);
ALTER TABLE public.pdr_licenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdr_licenses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pdr_licenses TO anon, authenticated;
CREATE POLICY pdr_license_read ON public.pdr_licenses FOR SELECT TO anon, authenticated USING (true);
INSERT INTO pdr_private.adventures VALUES ('tegny-v1','cairn-2e',1);
INSERT INTO public.pdr_licenses VALUES ('tegny-v1','{"title": "The Feast of Tegny Wood", "author": "Yochai Gal", "contributors": "Editing: Derek B. and Yossi Krausz. Layout: Adam Hensley. Art & map: Ari-Matti Toivonen.", "source": "https://cairnrpg.com/adventures/first-party/", "url": "https://creativecommons.org/licenses/by-sa/4.0/", "notice": "Texto, arte y maquetación originales: CC BY-SA 4.0. Publicado en mayo de 2026.", "changes": "Traducción parcial al español y adaptación interactiva por Puertas del Castellano. Escena inicial fija, dos trasfondos originales compatibles con Cairn 2e, viaje de un turno, sin encuentros aleatorios en esta muestra, y objetivo de informar al mercado añadidos. Adaptación de aventura y prompt bajo CC BY-SA 4.0. Sin patrocinio ni aval de los autores originales."}'::jsonb);
INSERT INTO pdr_private.locations VALUES ('bartermoot','tegny-v1','{"id": "bartermoot", "name": "Bartermoot", "description": "Robles y abedules rodean un mercado de tiendas amarillas y verdes. Huele a comida y suena música. Unos niños llegan gritando: han visto un cadáver en la presa vieja. Un sendero baja al sureste, hacia el agua.", "page": 6}'::jsonb);
INSERT INTO pdr_private.locations VALUES ('old-dam','tegny-v1','{"id": "old-dam", "name": "La presa vieja", "description": "Una presa transitable cruza el río. Sus tablas están podridas y llenas de agujeros: no soportarán a dos personas a la vez. Un cadáver flota boca abajo, atrapado junto a la presa. Al otro lado se amontonan barcas viejas.", "page": 8}'::jsonb);
INSERT INTO pdr_private.connections(adventure_id,data) VALUES ('tegny-v1','{"from": "bartermoot", "to": "old-dam", "turns": 1, "kind": "animal-path", "source": "TegnyMapSpread: 1–2"}'::jsonb);
INSERT INTO pdr_private.connections(adventure_id,data) VALUES ('tegny-v1','{"from": "old-dam", "to": "bartermoot", "turns": 1, "kind": "animal-path", "source": "TegnyMapSpread: 2–1"}'::jsonb);
INSERT INTO pdr_private.encounters VALUES ('children','tegny-v1','{"id": "children", "location": "bartermoot", "trigger": "start", "text": "Los niños piden ayuda: hay una mujer muerta en la presa.", "page": 3}'::jsonb);
INSERT INTO pdr_private.secrets VALUES ('old-dam','{"corpse": "El vientre está fusionado con esqueletos de peces que aún se retuercen. Hay un residuo naranja en un zapato. El contacto directo puede provocar una infección mortal.", "boat": "Una sola barca está entera; caben dos personas.", "loot": {"gold": 12, "item": "Cebo de pesca"}, "origin": "La víctima se infectó en el cenador inclinado (6); no revelar esta procedencia en esta muestra."}'::jsonb);
INSERT INTO pdr_private.secrets VALUES ('bartermoot','{"colors": "El amarillo representa al Maestro de Comercio; el verde invita a la gente del Bosque."}'::jsonb);
CREATE FUNCTION public.pdr_load_tegny() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT jsonb_build_object(
 'id',a.id,'edition',a.edition,'revision',a.revision,
 'license',(SELECT data FROM public.pdr_licenses WHERE adventure_id=a.id),
 'locations',(SELECT jsonb_agg(data ORDER BY id) FROM pdr_private.locations WHERE adventure_id=a.id),
 'connections',(SELECT jsonb_agg(data ORDER BY id) FROM pdr_private.connections WHERE adventure_id=a.id),
 'encounters',(SELECT jsonb_agg(data ORDER BY id) FROM pdr_private.encounters WHERE adventure_id=a.id),
 'secrets',(SELECT jsonb_object_agg(location_id,data) FROM pdr_private.secrets)
) FROM pdr_private.adventures a WHERE a.id='tegny-v1';
$$;
REVOKE ALL ON FUNCTION public.pdr_load_tegny() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pdr_load_tegny() TO service_role;

-- PDR-only paid-call reservations; does not consume or change PDT/PDQ quotas.
CREATE TABLE pdr_private.warden_quota (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 minute_until timestamptz NOT NULL DEFAULT '-infinity',
 minute_count integer NOT NULL DEFAULT 0,
 day_until timestamptz NOT NULL DEFAULT '-infinity',
 day_count integer NOT NULL DEFAULT 0
);
ALTER TABLE pdr_private.warden_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pdr_private.warden_quota FROM PUBLIC, anon, authenticated;
INSERT INTO pdr_private.warden_quota DEFAULT VALUES;
CREATE FUNCTION public.reserve_pdr_warden_calls(p_calls integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE q pdr_private.warden_quota%ROWTYPE; checked_at timestamptz;
BEGIN
 IF p_calls NOT IN (1,2) OR p_calls IS NULL THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
 SELECT * INTO STRICT q FROM pdr_private.warden_quota WHERE singleton FOR UPDATE;
 checked_at := pg_catalog.clock_timestamp();
 IF (q.minute_until>checked_at AND q.minute_count+p_calls>12)
 OR (q.day_until>checked_at AND q.day_count+p_calls>200) THEN RETURN false; END IF;
 UPDATE pdr_private.warden_quota SET
  minute_count=CASE WHEN minute_until<=checked_at THEN p_calls ELSE minute_count+p_calls END,
  minute_until=CASE WHEN minute_until<=checked_at THEN checked_at+interval '1 minute' ELSE minute_until END,
  day_count=CASE WHEN day_until<=checked_at THEN p_calls ELSE day_count+p_calls END,
  day_until=CASE WHEN day_until<=checked_at THEN checked_at+interval '24 hours' ELSE day_until END
 WHERE singleton;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_pdr_warden_calls(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_pdr_warden_calls(integer) TO service_role;
COMMIT;
