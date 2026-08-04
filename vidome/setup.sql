-- این اسکریپت را در Supabase → SQL Editor → New query کپی و اجرا کنید (دکمه Run)

-- جدول ویدیوها
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text default '',
  owner text not null,
  owner_uid uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  duration numeric default 0,
  size bigint default 0,
  mime text default '',
  storage_path text not null
);

alter table public.videos enable row level security;

-- خواندن لیست ویدیوها برای همه (حتی کاربران مهمان) آزاد است
create policy "Public read videos" on public.videos
  for select using (true);

-- فقط کاربر لاگین‌کرده و فقط با owner_uid خودش می‌تواند ردیف اضافه کند
create policy "Owner insert videos" on public.videos
  for insert with check (auth.uid() = owner_uid);

-- فقط صاحبِ ویدیو می‌تواند آن را حذف کند
create policy "Owner delete videos" on public.videos
  for delete using (auth.uid() = owner_uid);

-- ====================================================================
-- بعد از اجرای بالا، باید یک باکت Storage به نام "videos" بسازید:
-- Storage → New bucket → نام: videos → تیک "Public bucket" را بزنید → Create
-- سپس این بخش را هم اجرا کنید تا قوانین آپلود/حذف تنظیم شود:
-- ====================================================================

create policy "Public read videos bucket"
  on storage.objects for select
  using (bucket_id = 'videos');

create policy "Users upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
