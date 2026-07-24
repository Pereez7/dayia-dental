-- Auditable rejection for owner-submitted payment notices.
-- Rejection never creates a payment or changes subscription access.

create or replace function public.reject_subscription_payment_submission(
  target_submission_id uuid,
  target_reviewed_by uuid,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_submission public.subscription_payment_submissions%rowtype;
  target_subscription_id uuid;
begin
  if length(btrim(coalesce(target_reason, ''))) < 5
    or length(btrim(target_reason)) > 500 then
    raise exception 'REJECTION_REASON_INVALID';
  end if;

  select *
  into target_submission
  from public.subscription_payment_submissions
  where id = target_submission_id
  for update;

  if target_submission.id is null then
    raise exception 'PAYMENT_SUBMISSION_NOT_FOUND';
  end if;

  if target_submission.status <> 'pending_review' then
    raise exception 'PAYMENT_SUBMISSION_NOT_PENDING';
  end if;

  select subscriptions.id
  into target_subscription_id
  from public.clinic_subscriptions subscriptions
  where subscriptions.clinic_id = target_submission.clinic_id
  limit 1;

  update public.subscription_payment_submissions
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = target_reviewed_by,
    review_notes = btrim(target_reason),
    updated_at = now()
  where id = target_submission.id;

  insert into public.subscription_events (
    clinic_id,
    subscription_id,
    event_type,
    previous_plan_id,
    new_plan_id,
    notes,
    metadata,
    recorded_by
  ) values (
    target_submission.clinic_id,
    target_subscription_id,
    'payment_submission_rejected',
    target_submission.plan_id,
    target_submission.plan_id,
    btrim(target_reason),
    jsonb_build_object(
      'submission_id', target_submission.id,
      'amount_expected', target_submission.amount_expected,
      'billing_cycle', target_submission.billing_cycle
    ),
    target_reviewed_by
  );

  return target_submission.id;
end;
$$;

revoke all on function public.reject_subscription_payment_submission(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.reject_subscription_payment_submission(
  uuid, uuid, text
) to service_role;

comment on function public.reject_subscription_payment_submission(
  uuid, uuid, text
) is
  'Rejects one pending owner payment notice and records the administrative reason.';
