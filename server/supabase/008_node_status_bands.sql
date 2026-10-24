-- Optional danger threshold. No regulatory or health thresholds are inferred.
alter table public.ae_rules add column if not exists danger_high double precision;
alter table public.ae_rules drop constraint if exists ae_rules_danger_high_check;
alter table public.ae_rules add constraint ae_rules_danger_high_check
  check (danger_high is null or (danger_high > high and danger_high < 'Infinity'::float8));
comment on column public.ae_rules.danger_high is 'Operator-defined escalation level in the same sensor unit. Null means no danger band is configured; not an AQI/ISPU health classification.';
