CREATE OR REPLACE FUNCTION public.ae_daily_summary(p_slot text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n ae_nodes;
  l ae_latest;
  rule ae_rules;
  v_metric text;
  val float8;
  status text;
  tip text;
  msg text;
  total int := 0;
  day text := to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM-DD');
  hr int := extract(hour from now() at time zone 'Asia/Jakarta')::int;
  part text := case
    when hr between 4 and 10 then 'PAGI'
    when hr between 11 and 14 then 'SIANG'
    when hr between 15 and 17 then 'SORE'
    else 'MALAM'
  end;
  part_emoji text := case
    when hr between 4 and 10 then '🌅'
    when hr between 11 and 14 then '☀️'
    when hr between 15 and 17 then '🌇'
    else '🌙'
  end;
  sensor_fresh boolean;
  area_key text;
  air_payload jsonb;
  wx_payload jsonb;
  fire_payload jsonb;
  quake_payload jsonb;
  air_title text;
  air_status text;
  air_tone text;
  air_action text;
  ispu_val float8;
  aqi_val float8;
  wx_temp float8;
  wx_hum float8;
  wx_rain_prob float8;
  wx_warn_title text;
  wx_warn_action text;
  fire_count int;
  quake_line text;
  pub_lines text;
  pub_tip text;
  hook_tone text;
begin
  if p_slot not in ('pagi', 'siang', 'sore', 'malam') then
    raise exception 'slot tidak dikenal: %', p_slot;
  end if;

  for n in
    select x.* from ae_nodes x
    where x.enabled
      and exists(select 1 from ae_subscriptions s where s.node_id = x.id and s.active)
  loop
    if exists(select 1 from ae_rules where node_id = n.id and enabled and alert_band is not null) then
      continue;
    end if;

    select * into l from ae_latest where node_id = n.id;
    sensor_fresh := (l.node_id is not null and l.observed_at >= now() - interval '30 minutes');

    -- Ambil cache API publik untuk node ini (fallback ke referensi 'surabaya' jika belum ada)
    area_key := case
      when exists(
        select 1 from ae_environment_area_cache
        where area_id = 'node_' || n.id
          and last_attempt_at >= now() - interval '6 hours'
      ) then 'node_' || n.id
      else 'surabaya'
    end;

    select payload into air_payload
    from ae_environment_area_cache
    where area_id = area_key and provider = 'openmeteo_air'
      and last_attempt_at >= now() - interval '6 hours';

    select payload into wx_payload
    from ae_environment_area_cache
    where area_id = area_key and provider = 'openmeteo_weather'
      and last_attempt_at >= now() - interval '6 hours';

    select payload into fire_payload
    from ae_environment_area_cache
    where area_id = area_key and provider = 'firms'
      and last_attempt_at >= now() - interval '6 hours';

    select payload into quake_payload
    from ae_environment_area_cache
    where area_id = area_key and provider = 'bmkg_quake'
      and last_attempt_at >= now() - interval '6 hours';

    -- Ekstrak ringkasan udara wilayah (Open-Meteo Air Quality)
    air_title := null; air_tone := null; air_action := null; ispu_val := null; aqi_val := null;
    if air_payload is not null then
      if jsonb_typeof(air_payload->'insights') = 'array' then
        select i->>'title', i->>'tone', i->>'action'
        into air_title, air_tone, air_action
        from jsonb_array_elements(air_payload->'insights') i
        where i->>'category' = 'air_quality'
        limit 1;
      end if;
      if jsonb_typeof(air_payload->'facts') = 'array' then
        select (f->>'value')::float8 into ispu_val
        from jsonb_array_elements(air_payload->'facts') f
        where f->>'category' = 'air_quality'
          and f->>'label' ilike '%ISPU PM2.5%'
          and jsonb_typeof(f->'value') = 'number'
        limit 1;

        select (f->>'value')::float8 into aqi_val
        from jsonb_array_elements(air_payload->'facts') f
        where f->>'category' = 'air_quality'
          and (f->>'label' ilike '%AQI US%' or f->>'label' ilike '%US AQI%')
          and jsonb_typeof(f->'value') = 'number'
        limit 1;
      end if;
    end if;

    -- Ekstrak ringkasan cuaca wilayah (Open-Meteo Weather)
    wx_temp := null; wx_hum := null; wx_rain_prob := null; wx_warn_title := null; wx_warn_action := null;
    if wx_payload is not null then
      if jsonb_typeof(wx_payload->'facts') = 'array' then
        select (f->>'value')::float8 into wx_temp
        from jsonb_array_elements(wx_payload->'facts') f
        where f->>'category' = 'weather'
          and f->>'label' ilike 'Suhu udara%'
          and jsonb_typeof(f->'value') = 'number'
        limit 1;

        select (f->>'value')::float8 into wx_hum
        from jsonb_array_elements(wx_payload->'facts') f
        where f->>'category' = 'weather'
          and f->>'label' ilike 'Kelembapan udara%'
          and jsonb_typeof(f->'value') = 'number'
        limit 1;

        select (f->>'value')::float8 into wx_rain_prob
        from jsonb_array_elements(wx_payload->'facts') f
        where f->>'category' = 'weather'
          and f->>'label' ilike '%peluang presipitasi%'
          and jsonb_typeof(f->'value') = 'number'
        limit 1;
      end if;
      if jsonb_typeof(wx_payload->'insights') = 'array' then
        select i->>'title', i->>'action'
        into wx_warn_title, wx_warn_action
        from jsonb_array_elements(wx_payload->'insights') i
        where i->>'category' = 'weather'
          and i->>'tone' in ('warning', 'danger')
        limit 1;
      end if;
    end if;

    -- Ekstrak titik panas satelit (NASA FIRMS, tampil jika > 0)
    fire_count := 0;
    if fire_payload is not null and jsonb_typeof(fire_payload->'facts') = 'array' then
      select coalesce(round((f->>'value')::numeric)::int, 0) into fire_count
      from jsonb_array_elements(fire_payload->'facts') f
      where f->>'category' = 'fire'
        and f->>'label' ilike '%titik panas%'
        and jsonb_typeof(f->'value') = 'number'
      limit 1;
    end if;

    -- Ekstrak gempa BMKG M5+ dalam 24 jam terakhir (radius 300 km)
    quake_line := null;
    if quake_payload is not null and jsonb_typeof(quake_payload->'events') = 'array' then
      select '⚠️ Gempa BMKG: *M ' || replace(round((ev->>'magnitude')::numeric, 1)::text, '.', ',') || '*' ||
             coalesce(' · ' || nullif(ev->>'title', ''), '') ||
             case when jsonb_typeof(ev->'distance_km') = 'number'
               then ' (~' || round((ev->>'distance_km')::numeric)::int || ' km)'
               else '' end
      into quake_line
      from jsonb_array_elements(quake_payload->'events') ev
      where (ev->>'observed_at') ~ '^\d{4}-\d{2}-\d{2}T'
        and (ev->>'observed_at')::timestamptz >= now() - interval '24 hours'
        and jsonb_typeof(ev->'magnitude') = 'number'
      order by (ev->>'observed_at')::timestamptz desc
      limit 1;
    end if;

    -- Susun blok kondisi wilayah (format konsisten: emoji, kapitalisasi, dan bold hanya pada nilai utama)
    pub_lines := '';
    air_status := nullif(trim(regexp_replace(coalesce(air_title, ''), '^(?:Estimasi\s+)?(?:ISPU\s+PM2\.5|Kualitas\s+udara)\s*[:\-]?\s*', '', 'i')), '');
    if air_status is not null then
      air_status := initcap(air_status);
    end if;

    if air_status is not null or ispu_val is not null or aqi_val is not null then
      pub_lines := pub_lines || '💨 Udara: ' ||
        coalesce('*' || air_status || '*', '*Tersedia*') ||
        case
          when ispu_val is not null and aqi_val is not null
            then ' (ISPU ' || round(ispu_val::numeric)::int || ' · AQI ' || round(aqi_val::numeric)::int || ')'
          when ispu_val is not null
            then ' (ISPU ' || round(ispu_val::numeric)::int || ')'
          when aqi_val is not null
            then ' (AQI ' || round(aqi_val::numeric)::int || ')'
          else ''
        end || chr(10);
    end if;

    if wx_temp is not null or wx_warn_title is not null then
      pub_lines := pub_lines || '🌡️ Cuaca: ' ||
        coalesce('*' || ae_num(wx_temp) || ' °C*', '*Tersedia*') ||
        case when wx_hum is not null then ' · Lembap ' || round(wx_hum::numeric)::int || '%' else '' end ||
        case
          when wx_rain_prob is not null and wx_rain_prob >= 60 then ' · Peluang hujan *' || round(wx_rain_prob::numeric)::int || '%*'
          when wx_rain_prob is not null and wx_rain_prob >= 30 then ' · Peluang hujan ' || round(wx_rain_prob::numeric)::int || '%'
          else ''
        end ||
        case when wx_warn_title is not null then chr(10) || '⚠️ Peringatan: *' || wx_warn_title || '*' else '' end ||
        chr(10);
    end if;

    if coalesce(fire_count, 0) > 0 then
      pub_lines := pub_lines || '🔥 Titik panas: *' || fire_count || ' deteksi* (radius 50 km, 24 jam)' || chr(10);
    end if;

    if quake_line is not null then
      pub_lines := pub_lines || quake_line || chr(10);
    end if;

    pub_tip := case
      when air_tone = 'danger' then 'Tetap di dalam ruangan, tutup jendela, dan pakai masker KN95/N95 bila terpaksa keluar.'
      when air_tone = 'warning' then 'Kurangi aktivitas berat di luar ruangan dan pakai masker KN95/N95 bila perlu keluar.'
      when wx_warn_title is not null then 'Waspadai hujan petir dan hindari berteduh di bawah pohon atau lapangan terbuka.'
      when wx_rain_prob is not null and wx_rain_prob >= 60 then 'Siapkan payung atau jas hujan sebelum beraktivitas di luar.'
      else 'Udara wilayah dalam batas normal. Jaga tetap bersih dengan tidak membakar sampah.'
    end;
    if air_tone in ('warning', 'danger') and wx_warn_title is not null then
      pub_tip := pub_tip || ' Waspadai juga potensi hujan petir.';
    elsif air_tone in ('warning', 'danger') and wx_rain_prob is not null and wx_rain_prob >= 60 then
      pub_tip := pub_tip || ' Siapkan payung atau jas hujan sebelum keluar.';
    end if;

    -- Susun pesan utama
    msg := part_emoji || ' *KONDISI UDARA · ' || part || '*' || chr(10) || '📍 ' || n.name || chr(10);
    status := null;
    tip := null;

    if not sensor_fresh then
      if pub_lines <> '' then
        hook_tone := case
          when air_tone = 'danger' then 'danger'
          when air_tone = 'warning' or wx_warn_title is not null or coalesce(fire_count, 0) > 0 or quake_line is not null then 'warning'
          else 'good'
        end;
        msg := ae_bot_hook('daily', hook_tone, '{}', now()) || chr(10) || chr(10) ||
          msg || '🕒 ' || ae_wib(now()) || chr(10) || chr(10) ||
          'Sensor lokal belum aktif' || coalesce(' sejak ' || ae_wib(l.observed_at), '') || '.' || chr(10) || chr(10) ||
          '🌐 *KONDISI WILAYAH*' || chr(10) || rtrim(pub_lines, chr(10));
        if pub_tip is not null then
          msg := msg || chr(10) || chr(10) || pub_tip;
        end if;
      else
        msg := ae_bot_hook('stale', null, '{}', now()) || chr(10) || chr(10) ||
          msg || '🕒 ' || ae_wib(now()) || chr(10) || chr(10) ||
          'Sensor belum mengirim data terbaru' || coalesce(' sejak ' || ae_wib(l.observed_at), '') ||
          '. Kondisi udara terbaru belum bisa ditampilkan.';
      end if;
    else
      v_metric := case
        when n.pm25_validated and jsonb_typeof(l.metrics->'pm25_ug_m3') = 'number' then 'pm25_ug_m3'
        when jsonb_typeof(l.metrics->'dust_ug_m3') = 'number' then 'dust_ug_m3'
      end;
      msg := msg || '🕒 ' || ae_wib(l.observed_at) || chr(10) || chr(10);
      if v_metric is not null then
        val := (l.metrics->>v_metric)::float8;
        select * into rule from ae_rules where node_id = n.id and ae_rules.metric = v_metric and enabled;
        status := case
          when rule.id is null then null
          when rule.danger_high is not null and val >= rule.danger_high then 'Bahaya'
          when val >= rule.high then 'Waspada'
          else 'Baik'
        end;
        msg := msg || ae_metric_label(v_metric) || ': *' || ae_num(val) || ' µg/m³*' || coalesce(' · *' || status || '*', '') || chr(10);
      end if;
      msg := msg || coalesce(ae_other_readings(l.metrics, v_metric), '');
      if pub_lines <> '' then
        msg := rtrim(msg, chr(10)) || chr(10) || chr(10) ||
          '🌐 *KONDISI WILAYAH*' || chr(10) || rtrim(pub_lines, chr(10));
      end if;
      tip := case status
        when 'Bahaya' then 'Tetap di dalam ruangan, tutup jendela, dan pakai masker KN95/N95 bila terpaksa keluar.'
        when 'Waspada' then 'Kurangi aktivitas berat di luar ruangan dan pakai masker KN95/N95 bila perlu keluar.'
        when 'Baik' then case
          when air_tone in ('warning', 'danger') or wx_warn_title is not null or (wx_rain_prob is not null and wx_rain_prob >= 60) then pub_tip
          else 'Udara dalam batas normal. Jaga tetap bersih dengan tidak membakar sampah.'
        end
      end;
      if tip is not null then msg := msg || chr(10) || chr(10) || tip; end if;
      hook_tone := case
        when status = 'Bahaya' or air_tone = 'danger' then 'danger'
        when status = 'Waspada' or air_tone = 'warning' or wx_warn_title is not null then 'warning'
        when status = 'Baik' then 'good'
      end;
      msg := ae_bot_hook('daily', hook_tone, l.metrics, now()) || chr(10) || chr(10) || msg;
    end if;

    msg := msg || chr(10) || chr(10) || 'ℹ️ Informasi lebih lanjut: https://aerosense.me';
    perform ae_queue_wa(n, 'daily:' || n.id || ':' || day || ':' || p_slot, msg, null, jsonb_build_array(n.name, p_slot));
    total := total + 1;
  end loop;

  return total;
end
$function$;

-- Pastikan jadwal malam (22.00 WIB = 15.00 UTC, tiap 5 jam: 07, 12, 17, 22 WIB) terdaftar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE command ILIKE '%ae_daily_summary(''malam'')%') THEN
    PERFORM cron.schedule('ae_daily_summary_malam', '0 15 * * *', $cron$select public.ae_daily_summary('malam')$cron$);
  END IF;
END $$;
