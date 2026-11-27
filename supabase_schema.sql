-- Schema & Row Level Security (RLS) cho Giáo viên AI Toán THCS (Supabase)
-- Chạy 1 lần trong Supabase Dashboard -> SQL Editor -> New Query

-- 1. Bảng profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'admin')) default 'student',
  student_code text,
  full_name text not null,
  ho_ten_chuan_hoa text,
  class_name text,
  auth_email text,
  approved boolean not null default true,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (ho_ten_chuan_hoa, class_name)
);

-- 2. Bảng settings
create table if not exists public.settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lang_mode text not null default 'vi',
  selected_grade int not null default 9,
  teacher_gender text not null default 'co',
  sound_enabled boolean not null default true,
  sound_volume numeric not null default 0.4,
  updated_at timestamptz not null default now()
);

-- 3. Bảng conversations & messages
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grade int not null default 9,
  lang_mode text not null default 'vi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null,
  grade int,
  lang_mode text,
  created_at timestamptz not null default now()
);

-- 4. Bảng practice_results
create table if not exists public.practice_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  score numeric,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. Bảng activity_log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  summary text,
  created_at timestamptz not null default now()
);

-- 6. Bảng app_config (cài đặt toàn hệ thống, ví dụ: allow_self_register)
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bật Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.practice_results enable row level security;
alter table public.activity_log enable row level security;
alter table public.app_config enable row level security;

-- Helper kiểm tra role admin
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and locked = false
  );
$$;

-- RLS Policies: Học sinh chỉ đọc/ghi dữ liệu của chính mình; Admin đọc/quản lý tất cả
create policy "profiles_self_read" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin());

create policy "settings_self_all" on public.settings for all using (auth.uid() = user_id or public.is_admin());
create policy "conversations_self_all" on public.conversations for all using (auth.uid() = user_id or public.is_admin());
create policy "messages_self_all" on public.messages for all using (auth.uid() = user_id or public.is_admin());
create policy "practice_self_all" on public.practice_results for all using (auth.uid() = user_id or public.is_admin());
create policy "activity_self_all" on public.activity_log for all using (auth.uid() = user_id or public.is_admin());
create policy "app_config_read_all" on public.app_config for select using (true);
create policy "app_config_admin_write" on public.app_config for all using (public.is_admin());
