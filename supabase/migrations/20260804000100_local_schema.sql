
create schema if not exists local;

create table if not exists local.buildings (
  id      serial primary key,
  name    text not null unique,
  active  boolean not null default true,
  created timestamptz not null default now()
);

create table if not exists local.rooms (
  id          serial primary key,
  building_id integer not null references local.buildings(id) on delete cascade,
  number      text    not null,
  floor       integer not null,
  side        text,
  wing        text,
  active      boolean not null default true,
  unique (building_id, number)
);

create table if not exists local.bills (
  id           serial primary key,
  room_id      integer not null references local.rooms(id) on delete cascade,
  month        text    not null,
  rate         numeric(10,2) not null,
  prev_reading numeric(10,1),
  pres_reading numeric(10,1),
  consumption  numeric(10,1) not null default 0,
  subtotal     numeric(10,2) not null default 0,
  surcharge    numeric(10,2) not null default 50,
  total        numeric(12,2) not null default 0,
  status       text not null default 'unpaid' check (status in ('unpaid','paid')),
  paid_date    date,
  created      timestamptz not null default now(),
  unique (room_id, month)
);

create table if not exists local.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

insert into local.settings (key, value) values

  ('rate', '0'),
  ('surcharge', '50')
on conflict (key) do nothing;

create table if not exists local.logs (
  id        bigserial primary key,
  ts        timestamptz not null default now(),
  event     text not null,
  building  text,
  month     text,
  rate      numeric(10,2),
  surcharge numeric(10,2),
  rooms     integer,
  total     numeric(12,2),
  msg       text
);

create table if not exists local.app_errors (
  id         bigserial primary key,
  ts         timestamptz not null default now(),
  action     text not null,
  building   text,
  month      text,
  room       text,
  rate       numeric(10,2),
  message    text,
  detail     text,
  stack      text,
  url        text,
  user_agent text
);

create index if not exists idx_local_rooms_building on local.rooms(building_id);
create index if not exists idx_local_bills_room    on local.bills(room_id);
create index if not exists idx_local_bills_month   on local.bills(month);
create index if not exists idx_local_logs_ts       on local.logs(ts desc);
create index if not exists idx_local_app_errors_ts on local.app_errors(ts desc);

alter table local.buildings enable row level security;
alter table local.rooms     enable row level security;
alter table local.bills     enable row level security;
alter table local.settings  enable row level security;
alter table local.logs      enable row level security;
alter table local.app_errors enable row level security;

create policy "sf_local_all_buildings" on local.buildings
  for all to authenticated using (true) with check (true);
create policy "sf_local_all_rooms" on local.rooms
  for all to authenticated using (true) with check (true);
create policy "sf_local_all_bills" on local.bills
  for all to authenticated using (true) with check (true);
create policy "sf_local_all_settings" on local.settings
  for all to authenticated using (true) with check (true);
create policy "sf_local_all_logs" on local.logs
  for all to authenticated using (true) with check (true);
create policy "sf_local_all_app_errors" on local.app_errors
  for all to authenticated using (true) with check (true);

grant usage on schema local to anon, authenticated, service_role;
grant select on all tables in schema local to anon;
grant all on all tables in schema local to authenticated;
grant all on all sequences in schema local to authenticated;

alter role authenticator set pgrst.db_schemas = 'public, storage, graphql_public, local';
notify pgrst, 'reload config';
