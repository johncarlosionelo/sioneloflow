
alter table public.bills alter column prev_reading drop not null;
alter table local.bills  alter column prev_reading drop not null;
