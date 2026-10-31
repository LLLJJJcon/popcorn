alter table public.saved_items
  add column removed_from_saved_at timestamptz;

comment on column public.saved_items.removed_from_saved_at is
  'Removes this bookmark from Saved without deleting source evidence or existing practice, mastery, and review records.';
