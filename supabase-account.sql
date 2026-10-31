-- Nàng Nông Trại — MÃ CÁ NHÂN: lưu game lên mây, đổi thiết bị chỉ cần mã + mật khẩu.
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor → New query → dán toàn bộ → Run.
-- (Chạy sau supabase-setup.sql. Chạy lại nhiều lần cũng không sao.)

create extension if not exists pgcrypto with schema extensions;

-- Tài khoản: mã 8 ký tự, mật khẩu đã băm (bcrypt), dữ liệu game, số phiên bản để phát hiện 2 máy ghi đè nhau
create table if not exists public.accounts (
  code          text primary key check (code ~ '^[A-Z0-9]{8}$'),
  pass_hash     text not null,
  data          jsonb,
  rev           int not null default 1,
  fails         int not null default 0,
  locked_until  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Mỗi thiết bị đã đăng nhập giữ một "vé" (token) — chỉ lưu bản băm
create table if not exists public.account_tokens (
  token_hash  text primary key,
  code        text not null references public.accounts(code) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Bật RLS và KHÔNG tạo policy: không ai đọc/ghi trực tiếp được, chỉ qua các hàm bên dưới
alter table public.accounts enable row level security;
alter table public.account_tokens enable row level security;
revoke all on public.accounts, public.account_tokens from anon, authenticated;

-- (nội bộ) tạo vé mới cho một tài khoản
create or replace function public.acc_new_token(p_code text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex');
begin
  insert into account_tokens(token_hash, code) values (encode(digest(t, 'sha256'), 'hex'), p_code);
  return t;
end $$;
revoke execute on function public.acc_new_token(text) from public, anon, authenticated;

-- Tạo mã cá nhân mới từ dữ liệu game hiện tại
create or replace function public.acc_create(p_pass text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c text; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if length(coalesce(p_pass, '')) < 6 then return jsonb_build_object('error', 'Mật khẩu cần ít nhất 6 ký tự'); end if;
  if p_data is null or pg_column_size(p_data) > 300000 then return jsonb_build_object('error', 'Dữ liệu game không hợp lệ'); end if;
  loop
    c := '';
    for i in 1..8 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    begin
      insert into accounts(code, pass_hash, data) values (c, crypt(p_pass, gen_salt('bf')), p_data);
      exit;
    exception when unique_violation then -- trùng mã thì tạo mã khác
    end;
  end loop;
  return jsonb_build_object('code', c, 'token', acc_new_token(c), 'rev', 1, 'updated_at', now());
end $$;

-- (nội bộ) kiểm tra mật khẩu: trả về null nếu đúng, hoặc câu báo lỗi. Sai 5 lần liên tiếp thì khoá 15 phút.
create or replace function public.acc_verify(p_code text, p_pass text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a accounts; f int;
begin
  select * into a from accounts where code = p_code for update;
  if not found then return 'Sai mã hoặc mật khẩu'; end if;
  if a.locked_until is not null and a.locked_until > now() then
    return format('Nhập sai quá nhiều lần, thử lại sau %s phút', ceil(extract(epoch from a.locked_until - now()) / 60));
  end if;
  if a.pass_hash <> crypt(coalesce(p_pass, ''), a.pass_hash) then
    f := case when a.locked_until is not null then 1 else a.fails + 1 end;   -- hết hạn khoá thì đếm lại từ đầu
    update accounts set fails = f, locked_until = case when f >= 5 then now() + interval '15 minutes' else null end where code = a.code;
    return 'Sai mã hoặc mật khẩu';
  end if;
  update accounts set fails = 0, locked_until = null where code = a.code;
  return null;
end $$;
revoke execute on function public.acc_verify(text, text) from public, anon, authenticated;

-- Đăng nhập trên thiết bị: trả về dữ liệu game + vé.
-- Đồng thời chuyển quyền chủ nông trại (coop) sang thiết bị này để giữ nguyên mã nông trại.
create or replace function public.acc_login(p_code text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a accounts; fc text; err text; c text := upper(replace(coalesce(p_code, ''), '-', ''));
begin
  err := acc_verify(c, p_pass);
  if err is not null then return jsonb_build_object('error', err); end if;
  select * into a from accounts where code = c;
  fc := a.data -> 'coop' ->> 'code';
  if fc is not null and auth.uid() is not null then
    update farms set owner = auth.uid() where code = fc;
  end if;
  return jsonb_build_object('code', a.code, 'token', acc_new_token(a.code), 'rev', a.rev, 'data', a.data, 'updated_at', a.updated_at);
end $$;

-- Lưu lên mây. p_rev phải khớp bản trên mây (nếu máy khác vừa lưu thì báo xung đột thay vì ghi đè).
-- p_force = true: ghi đè dù xung đột (người chơi đã chọn giữ bản của máy này).
create or replace function public.acc_save(p_code text, p_token text, p_data jsonb, p_rev int, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a accounts;
begin
  if not exists (select 1 from account_tokens where code = p_code and token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')) then
    return jsonb_build_object('error', 'Phiên đăng nhập đã hết, hãy đăng nhập lại', 'auth', true);
  end if;
  if p_data is null or pg_column_size(p_data) > 300000 then return jsonb_build_object('error', 'Dữ liệu game không hợp lệ'); end if;
  select * into a from accounts where code = p_code for update;
  if a.rev <> p_rev and not coalesce(p_force, false) then
    return jsonb_build_object('conflict', true, 'rev', a.rev, 'updated_at', a.updated_at, 'name', a.data ->> 'name', 'lv', a.data -> 'lv', 'day', a.data -> 'day');
  end if;
  update accounts set data = p_data, rev = a.rev + 1, updated_at = now() where code = p_code;
  return jsonb_build_object('rev', a.rev + 1, 'updated_at', now());
end $$;

-- Lấy bản trên mây (dùng khi xung đột và người chơi chọn tải bản trên mây về)
create or replace function public.acc_pull(p_code text, p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a accounts;
begin
  if not exists (select 1 from account_tokens where code = p_code and token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')) then
    return jsonb_build_object('error', 'Phiên đăng nhập đã hết, hãy đăng nhập lại', 'auth', true);
  end if;
  select * into a from accounts where code = p_code;
  return jsonb_build_object('rev', a.rev, 'data', a.data, 'updated_at', a.updated_at);
end $$;

-- Đăng xuất trên thiết bị này (huỷ vé)
create or replace function public.acc_logout(p_code text, p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from account_tokens where code = p_code and token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- Đổi mật khẩu (cần mật khẩu cũ)
create or replace function public.acc_change_pass(p_code text, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare err text;
begin
  if length(coalesce(p_new, '')) < 6 then return jsonb_build_object('error', 'Mật khẩu mới cần ít nhất 6 ký tự'); end if;
  err := acc_verify(p_code, p_old);
  if err is not null then return jsonb_build_object('error', replace(err, 'Sai mã hoặc mật khẩu', 'Mật khẩu cũ không đúng')); end if;
  update accounts set pass_hash = crypt(p_new, gen_salt('bf')) where code = p_code;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.acc_create(text, jsonb) to anon, authenticated;
grant execute on function public.acc_login(text, text) to anon, authenticated;
grant execute on function public.acc_save(text, text, jsonb, int, boolean) to anon, authenticated;
grant execute on function public.acc_pull(text, text) to anon, authenticated;
grant execute on function public.acc_logout(text, text) to anon, authenticated;
grant execute on function public.acc_change_pass(text, text, text) to anon, authenticated;
