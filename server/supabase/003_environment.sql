BEGIN;
CREATE TABLE IF NOT EXISTS public.ae_environment_areas(
 id text PRIMARY KEY CHECK(id ~ '^[a-zA-Z0-9_-]{1,40}$'),
 name text NOT NULL,
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 coordinate_source text NOT NULL DEFAULT 'configured_reference',
 timezone text NOT NULL DEFAULT 'Asia/Jakarta',
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.ae_environment_area_cache(
 area_id text NOT NULL REFERENCES public.ae_environment_areas(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('openmeteo_weather','openmeteo_air','openmeteo_flood','soilgrids','firms','bmkg_quake','bmkg_weather','iqair')),
 request_latitude double precision NOT NULL,
 request_longitude double precision NOT NULL,
 payload jsonb NOT NULL DEFAULT '{"facts":[],"status":"unavailable"}'::jsonb,
 refresh_after timestamptz NOT NULL DEFAULT now(),
 last_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 PRIMARY KEY(area_id,provider)
);
ALTER TABLE public.ae_environment_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ae_environment_area_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ae_environment_areas,public.ae_environment_area_cache FROM anon,authenticated;
GRANT SELECT ON public.ae_environment_areas,public.ae_environment_area_cache TO authenticated;
GRANT ALL ON public.ae_environment_areas,public.ae_environment_area_cache TO service_role;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ae_environment_areas' AND policyname='environment_reference_read') THEN
  CREATE POLICY environment_reference_read ON public.ae_environment_areas FOR SELECT TO authenticated USING(enabled);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ae_environment_area_cache' AND policyname='environment_reference_cache_read') THEN
  CREATE POLICY environment_reference_cache_read ON public.ae_environment_area_cache FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ae_environment_areas a WHERE a.id=area_id AND a.enabled));
 END IF;
END $$;
INSERT INTO public.ae_environment_areas(id,name,latitude,longitude,coordinate_source)
VALUES('surabaya','Wilayah Kota Surabaya',-7.24917,112.75083,'city_reference')
ON CONFLICT(id) DO UPDATE SET name=excluded.name,latitude=excluded.latitude,longitude=excluded.longitude,coordinate_source=excluded.coordinate_source,timezone=excluded.timezone,enabled=true;
UPDATE public.ae_environment_areas SET enabled=false WHERE id='its-sukolilo';
COMMIT;
SELECT 'ready' AS status;
