-- =============================================
-- آتیشی - اسکریپت کامل دیتابیس (با سیستم رنک)
-- =============================================

drop table if exists reactions cascade;
drop table if exists challenges cascade;
drop table if exists messages cascade;
drop table if exists stickers cascade;
drop table if exists custom_emojis cascade;
drop table if exists bans cascade;
drop table if exists warnings cascade;
drop table if exists app_settings cascade;
drop table if exists profiles cascade;

create extension if not exists pgcrypto;

-- پروفایل (با رنک)
create table profiles (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users(id) on delete cascade,
  username text unique not null,
  bio text default '',
  avatar text default '',
  rank text default 'member',          -- member | vip | mod | admin
  is_banned boolean default false,
  ban_reason text default '',
  created_at timestamptz default now()
);

-- پیام‌ها
create table messages (
  id bigserial primary key,
  username text not null,
  message text default '',
  avatar text default '',
  media_url text default '',
  media_type text default '',          -- image | video | audio | file | sticker
  reply_to bigint references messages(id) on delete set null,
  is_challenge boolean default false,
  challenge_id bigint,
  is_system boolean default false,
  room text default 'public',          -- public | game | movie | minecraft
  created_at timestamptz default now()
);

create index if not exists messages_room_created_idx on messages (room, created_at desc);

-- ری‌اکشن
create table reactions (
  id bigserial primary key,
  message_id bigint references messages(id) on delete cascade,
  username text not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, username, emoji)
);

-- چالش
create table challenges (
  id bigserial primary key,
  question text not null,
  answer text not null,
  prize text not null,
  created_by text not null,
  is_active boolean default true,
  winner_username text default null,
  message_id bigint,
  created_at timestamptz default now()
);

-- بن‌ها
create table bans (
  id bigserial primary key,
  username text not null,
  reason text default '',
  banned_by text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- اخطارها
create table warnings (
  id bigserial primary key,
  username text not null,
  reason text default '',
  warned_by text not null,
  created_at timestamptz default now()
);

-- تنظیمات اپ
create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- استیکرها
create table stickers (
  id bigserial primary key,
  pack_name text not null,
  name text not null,
  url text not null,
  created_by text not null,
  created_at timestamptz default now()
);

-- ایموجی‌های کاستوم
create table custom_emojis (
  id bigserial primary key,
  pack_name text not null,
  name text not null,
  url text not null,
  created_by text not null,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table messages enable row level security;
alter table reactions enable row level security;
alter table challenges enable row level security;
alter table bans enable row level security;
alter table warnings enable row level security;
alter table app_settings enable row level security;
alter table stickers enable row level security;
alter table custom_emojis enable row level security;

-- پروفایل
create policy "Public profiles read" on profiles for select using (true);
create policy "Users can insert own profile" on profiles for insert to authenticated with check (auth.uid() = owner);
create policy "Users can update own profile" on profiles for update to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
create policy "Staff can update any profile" on profiles for update to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (
      select 1 from profiles p
      where p.owner = auth.uid() and p.rank in ('mod','admin')
    )
  );

-- پیام‌ها
create policy "Public messages read" on messages for select using (true);
create policy "Authenticated users can send messages" on messages for insert to authenticated with check (true);
create policy "Staff can delete messages" on messages for delete to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (
      select 1 from profiles p
      where p.owner = auth.uid() and p.rank in ('mod','admin')
    )
  );
create policy "Staff can update messages" on messages for update to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (
      select 1 from profiles p
      where p.owner = auth.uid() and p.rank in ('mod','admin')
    )
  );

-- ری‌اکشن
create policy "Public reactions read" on reactions for select using (true);
create policy "Authenticated users can react" on reactions for insert to authenticated with check (true);
create policy "Users can delete own reaction" on reactions for delete to authenticated using (true);

-- چالش (ادمین + مود)
create policy "Public challenges read" on challenges for select using (true);
create policy "Staff can manage challenges" on challenges for all to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  )
  with check (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  );

-- بن (ادمین + مود)
create policy "Public bans read" on bans for select using (true);
create policy "Staff can manage bans" on bans for all to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  )
  with check (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  );

-- اخطار
create policy "Public warnings read" on warnings for select using (true);
create policy "Staff can manage warnings" on warnings for all to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  )
  with check (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  );

-- تنظیمات (فقط ادمین اصلی + رنک admin)
create policy "Public settings read" on app_settings for select using (true);
create policy "Admin can manage settings" on app_settings for all to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank = 'admin')
  )
  with check (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank = 'admin')
  );

-- استیکر / ایموجی (ادمین + مود)
create policy "Public stickers read" on stickers for select using (true);
create policy "Staff can manage stickers" on stickers for all to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  )
  with check (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  );

create policy "Public custom_emojis read" on custom_emojis for select using (true);
create policy "Staff can manage custom_emojis" on custom_emojis for all to authenticated
  using (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  )
  with check (
    auth.jwt() ->> 'email' = 'admin@atishi.ir'
    or exists (select 1 from profiles p where p.owner = auth.uid() and p.rank in ('mod','admin'))
  );

-- Realtime
do $$ begin alter publication supabase_realtime add table messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table reactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table challenges; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table bans; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table app_settings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table stickers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table custom_emojis; exception when duplicate_object then null; end $$;

insert into app_settings (key, value) values ('active_event', 'none')
on conflict (key) do nothing;
