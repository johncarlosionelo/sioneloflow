
create table if not exists buildings (
  id      serial primary key,
  name    text not null unique,
  active  boolean not null default true,
  created timestamptz not null default now()
);

create table if not exists rooms (
  id          serial primary key,
  building_id integer not null references buildings(id) on delete cascade,
  number      text    not null,
  floor       integer not null,
  side        text,
  wing        text,
  active      boolean not null default true,
  unique (building_id, number)
);

create table if not exists bills (
  id           serial primary key,
  room_id      integer not null references rooms(id) on delete cascade,
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

create table if not exists settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values

  ('rate', '0'),
  ('surcharge', '50')
on conflict (key) do nothing;

create table if not exists logs (
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

create table if not exists app_errors (
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

create index if not exists idx_rooms_building on rooms(building_id);
create index if not exists idx_bills_room    on bills(room_id);
create index if not exists idx_bills_month   on bills(month);
create index if not exists idx_logs_ts       on logs(ts);
create index if not exists idx_app_errors_ts on app_errors(ts desc);

alter table buildings enable row level security;
alter table rooms     enable row level security;
alter table bills     enable row level security;
alter table settings  enable row level security;
alter table logs      enable row level security;
alter table app_errors enable row level security;

create policy "sf_all_buildings" on buildings
  for all to authenticated using (true) with check (true);
create policy "sf_all_rooms" on rooms
  for all to authenticated using (true) with check (true);
create policy "sf_all_bills" on bills
  for all to authenticated using (true) with check (true);
create policy "sf_all_settings" on settings
  for all to authenticated using (true) with check (true);
create policy "sf_all_logs" on logs
  for all to authenticated using (true) with check (true);
create policy "sf_all_app_errors" on app_errors
  for all to authenticated using (true) with check (true);
