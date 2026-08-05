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
  join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
  where procedures.proname = 'plan'
    and pg_get_function_identity_arguments(procedures.oid) = 'integer'
  order by namespaces.nspname
  limit 1;

  perform set_config(
    'search_path',
    format('public, extensions, %I', pgtap_schema),
    false
  );
end;
$setup_pgtap_search_path$;

select plan(2);

select ok(
  not exists (
    select 1
    from public.patients patients
    group by
      patients.clinic_id,
      regexp_replace(patients.phone, '\D', '', 'g')
    having count(*) > 1
  ),
  'no clinic has duplicate normalized patient phones'
);

select ok(
  not exists (
    select 1
    from public.patients patients
    where patients.email is not null
      and btrim(patients.email) <> ''
    group by patients.clinic_id, lower(btrim(patients.email))
    having count(*) > 1
  ),
  'no clinic has duplicate normalized patient emails'
);

select * from finish();

rollback;
