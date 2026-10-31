-- Nàng Nông Trại — tạo bảng cho tính năng ghé thăm nông trại bạn bè.
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor → New query → dán toàn bộ → Run.

-- Mỗi nông trại: mã 6 ký tự, chủ sở hữu, ảnh chụp trạng thái để khách xem
create table if not exists public.farms (
  code        text primary key check (code ~ '^[A-Z0-9]{6}$'),
  owner       uuid not null default auth.uid(),
  pub         jsonb,
  updated_at  timestamptz not null default now()
);

-- Việc khách làm giúp (tưới, tặng quà) — chờ chủ nông trại nhận rồi xoá
create table if not exists public.inbox (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.farms(code) on delete cascade,
  sender      uuid not null default auth.uid(),
  msg         jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists inbox_code_idx on public.inbox(code);

alter table public.farms enable row level security;
alter table public.inbox enable row level security;

-- Ai đã đăng nhập (kể cả ẩn danh) đều xem được nông trại để ghé thăm
drop policy if exists farms_read on public.farms;
create policy farms_read on public.farms for select to authenticated using (true);
-- Chỉ được tạo / sửa nông trại của chính mình
drop policy if exists farms_insert on public.farms;
create policy farms_insert on public.farms for insert to authenticated with check (owner = auth.uid());
drop policy if exists farms_update on public.farms;
create policy farms_update on public.farms for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- Ai cũng gửi được việc giúp (ghi đúng tên mình), chỉ chủ nông trại đọc và xoá được
drop policy if exists inbox_insert on public.inbox;
create policy inbox_insert on public.inbox for insert to authenticated with check (sender = auth.uid());
drop policy if exists inbox_owner_read on public.inbox;
create policy inbox_owner_read on public.inbox for select to authenticated
  using (exists (select 1 from public.farms f where f.code = inbox.code and f.owner = auth.uid()));
drop policy if exists inbox_owner_delete on public.inbox;
create policy inbox_owner_delete on public.inbox for delete to authenticated
  using (exists (select 1 from public.farms f where f.code = inbox.code and f.owner = auth.uid()));
