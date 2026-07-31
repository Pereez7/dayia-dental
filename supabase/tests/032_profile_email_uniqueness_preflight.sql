begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;

do $setup_pgtap_search_path$
declare
  pgtap_schema text;
begin
  select namespaces.nspname
  into pgtap_schema
  from pg_proc procedures
  join pg_namespace namespaces
    on namespaces.oid = procedures.pronamespace
  where procedures.proname = 'plan'
    and pg_get_function_identity_arguments(procedures.oid) = 'integer'
  order by namespaces.nspname
  limit 1;

  if pgtap_schema is null then
    raise exception 'pgTAP exists but plan(integer) is not installed.';
  end if;

  perform set_config(
    'search_path',
    format('public, extensions, %I', pgtap_schema),
    false
  );
end;
$setup_pgtap_search_path$;

select plan(1);

select is(
  (
    select count(*)
    from (
      select lower(btrim(profiles.email))
      from public.profiles profiles
      where nullif(btrim(profiles.email), '') is not null
      group by lower(btrim(profiles.email))
      having count(*) > 1
    ) duplicate_emails
  ),
  0::bigint,
  'profile emails are globally unique before installing PERF-004'
);

select * from finish();

rollback;
