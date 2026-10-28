-- Module C / migration 5: thong tin nhan tien rieng tu (payout_profiles + payout_shares).
-- Nguyen tac:
--  * Ten chu tai khoan + so tai khoan/ID vi duoc MA HOA o tang ung dung (AES-256-GCM, khoa PAYOUT_ENC_KEY chi o may chu).
--    CSDL chi giu ciphertext + iv + tag (base64) va toi da 4 ky tu cuoi de che. KHONG luu mat khau/PIN/OTP/so the.
--  * Khong ai doc truc tiep hai bang nay (ke ca quan tri vien, ke ca chinh chu). Moi truy cap di qua cac ham duoi day.
--  * Chu ho so chia se cho TUNG nguoi cu the, co han dung, thu hoi duoc, hieu luc ngay.
--  * Moi lan lay du lieu day du (reveal) deu ghi nhat ky payout.reveal (ai xem ho so cua ai). Nhat ky khong chua bi mat.
--  * Quan tri vien KHONG co dac quyen xem; chi thay duoc cac dong nhat ky.

create table public.payout_profiles (
  id uuid primary key,                           -- do may chu sinh (dung lam AAD khi ma hoa)
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bank','ewallet','other')),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  last4 text check (last4 is null or last4 ~ '^[A-Za-z0-9]{1,4}$'),
  ciphertext text not null check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(ciphertext) between 8 and 4096),
  iv text not null check (iv ~ '^[A-Za-z0-9+/]+={0,2}$' and octet_length(decode(iv, 'base64')) = 12),
  tag text not null check (tag ~ '^[A-Za-z0-9+/]+={0,2}$' and octet_length(decode(tag, 'base64')) = 16),
  key_version smallint not null default 1 check (key_version between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payout_profiles_owner_idx on public.payout_profiles(owner_id);
create trigger payout_profiles_updated before update on public.payout_profiles
  for each row execute function public.set_updated_at();

create table public.payout_shares (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.payout_profiles(id) on delete cascade,
  shared_with uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
-- Moi nguoi chi co mot luot chia se con hieu luc cho mot ho so
create unique index payout_shares_active_uq on public.payout_shares(profile_id, shared_with) where revoked_at is null;
create index payout_shares_user_idx on public.payout_shares(shared_with) where revoked_at is null;

alter table public.payout_profiles enable row level security;
alter table public.payout_shares enable row level security;
-- Co y KHONG co policy nao: ke ca khi bi cap quyen nham, RLS van tu choi moi truy van truc tiep.
revoke all on public.payout_profiles, public.payout_shares from anon, authenticated;

-- ---- Tao ho so (chinh chu). Ciphertext do may chu tao; ham nay khong bao gio thay ban ro. ----
create or replace function public.create_payout_profile(
  p_id uuid, p_family uuid, p_kind text, p_label text, p_last4 text,
  p_ciphertext text, p_iv text, p_tag text, p_key_version int default 1
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.payout_profiles where owner_id = auth.uid()) >= 10 then
    raise exception 'profile_limit' using errcode = 'P0001';
  end if;
  insert into public.payout_profiles (id, family_id, owner_id, kind, label, last4, ciphertext, iv, tag, key_version)
  values (p_id, p_family, auth.uid(), p_kind, btrim(p_label), nullif(p_last4, ''), p_ciphertext, p_iv, p_tag, p_key_version);
  perform public.write_audit(p_family, 'payout.create', 'payout_profile', p_id::text, null,
    jsonb_build_object('owner', auth.uid(), 'kind', p_kind, 'label', btrim(p_label)));
  return p_id;
end $$;

-- ---- Danh sach CHE cua chinh minh ----
create or replace function public.my_payout_profiles(p_family uuid)
returns table (id uuid, kind text, label text, last4 text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return query select p.id, p.kind, p.label, p.last4, p.created_at
    from public.payout_profiles p
    where p.owner_id = auth.uid() and p.family_id = p_family and public.is_family_member(p.family_id)
    order by p.created_at;
end $$;

create or replace function public.my_payout_shares(p_family uuid)
returns table (share_id uuid, profile_id uuid, shared_with uuid, shared_with_name text,
               created_at timestamptz, expires_at timestamptz, revoked_at timestamptz, state text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return query select s.id, s.profile_id, s.shared_with, up.display_name, s.created_at, s.expires_at, s.revoked_at,
      case when s.revoked_at is not null then 'revoked'
           when s.expires_at <= now() then 'expired' else 'active' end
    from public.payout_shares s
    join public.payout_profiles p on p.id = s.profile_id
    left join public.user_profiles up on up.id = s.shared_with
    where p.owner_id = auth.uid() and p.family_id = p_family and public.is_family_member(p.family_id)
    order by s.created_at desc
    limit 200;
end $$;

-- ---- Chia se / thu hoi / xoa ----
create or replace function public.share_payout_profile(p_profile uuid, p_user uuid, p_hours int default 168) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.payout_profiles; v_id uuid; v_exp timestamptz; v_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.payout_profiles where id = p_profile for update;
  if not found or p.owner_id <> auth.uid() or not public.is_family_member(p.family_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() or not exists (
       select 1 from public.family_memberships m
       where m.user_id = p_user and m.family_id = p.family_id and m.status = 'active') then
    raise exception 'bad share target' using errcode = '22023';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 720 then
    raise exception 'hours must be between 1 and 720' using errcode = '22023';
  end if;
  v_exp := now() + make_interval(hours => p_hours);
  update public.payout_shares set expires_at = v_exp
    where profile_id = p.id and shared_with = p_user and revoked_at is null
    returning id into v_id;
  if v_id is null then
    insert into public.payout_shares (profile_id, shared_with, expires_at) values (p.id, p_user, v_exp)
    returning id into v_id;
  end if;
  perform public.write_audit(p.family_id, 'payout.share', 'payout_profile', p.id::text, null,
    jsonb_build_object('owner', p.owner_id, 'shared_with', p_user, 'expires_at', v_exp));
  select display_name into v_name from public.user_profiles where id = auth.uid();
  perform public._notify(p.family_id, p_user, 'gift',
    left(coalesce(v_name, 'Một người thân') || ' đã chia sẻ thông tin nhận tiền cho bạn (có thời hạn).', 200),
    null, '/li-xi', 'payoutshare:' || v_id::text || ':' || extract(epoch from v_exp)::bigint::text);
  return v_id;
end $$;

create or replace function public.revoke_payout_share(p_share uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.payout_shares; p public.payout_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into s from public.payout_shares where id = p_share for update;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into p from public.payout_profiles where id = s.profile_id;
  if p.owner_id <> auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payout_shares set revoked_at = now() where id = s.id and revoked_at is null;
  perform public.write_audit(p.family_id, 'payout.revoke', 'payout_profile', p.id::text, null,
    jsonb_build_object('owner', p.owner_id, 'shared_with', s.shared_with, 'share_id', s.id));
end $$;

create or replace function public.delete_payout_profile(p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payout_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.payout_profiles where id = p_profile for update;
  if not found or p.owner_id <> auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.payout_profiles where id = p.id;   -- xoa han (kem cac luot chia se)
  perform public.write_audit(p.family_id, 'payout.delete', 'payout_profile', p.id::text,
    jsonb_build_object('owner', p.owner_id, 'label', p.label), null);
end $$;

-- ---- Ho so nguoi khac chia se cho toi (danh sach CHE, chi luot con hieu luc) ----
create or replace function public.payout_profiles_shared_with_me(p_family uuid)
returns table (profile_id uuid, owner_id uuid, owner_name text, kind text, label text, last4 text, expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_family_member(p_family) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select p.id, p.owner_id, up.display_name, p.kind, p.label, p.last4, s.expires_at
    from public.payout_shares s
    join public.payout_profiles p on p.id = s.profile_id
    left join public.user_profiles up on up.id = p.owner_id
    where s.shared_with = auth.uid() and s.revoked_at is null and s.expires_at > now()
      and p.family_id = p_family
      and exists (select 1 from public.family_memberships m
                  where m.user_id = p.owner_id and m.family_id = p.family_id and m.status = 'active')
    order by s.expires_at;
end $$;

-- ---- Lay ban ma de may chu giai ma. Chi CHINH CHU hoac nguoi dang duoc chia se (chua het han, chua thu hoi).
-- Ghi nhat ky payout.reveal TRUOC khi tra du lieu (cung giao dich: loi nhat ky => khong tra gi).
create or replace function public.reveal_payout_profile(p_profile uuid)
returns table (id uuid, owner_id uuid, family_id uuid, ciphertext text, iv text, tag text, key_version smallint)
language plpgsql security definer set search_path = public as $$
declare p public.payout_profiles; v_me uuid := auth.uid(); v_share uuid; v_rel text;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into p from public.payout_profiles pp where pp.id = p_profile;
  if not found or not public.is_family_member(p.family_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p.owner_id = v_me then
    v_rel := 'self';
  else
    select s.id into v_share from public.payout_shares s
      where s.profile_id = p.id and s.shared_with = v_me and s.revoked_at is null and s.expires_at > now();
    if v_share is null or not exists (
         select 1 from public.family_memberships m
         where m.user_id = p.owner_id and m.family_id = p.family_id and m.status = 'active') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    v_rel := 'shared';
  end if;
  perform public.write_audit(p.family_id, 'payout.reveal', 'payout_profile', p.id::text, null,
    jsonb_build_object('owner', p.owner_id, 'viewer', v_me, 'relation', v_rel, 'share_id', v_share));
  return query select p.id, p.owner_id, p.family_id, p.ciphertext, p.iv, p.tag, p.key_version;
end $$;

grant execute on function
  public.create_payout_profile(uuid, uuid, text, text, text, text, text, text, int),
  public.my_payout_profiles(uuid), public.my_payout_shares(uuid),
  public.share_payout_profile(uuid, uuid, int), public.revoke_payout_share(uuid),
  public.delete_payout_profile(uuid), public.payout_profiles_shared_with_me(uuid),
  public.reveal_payout_profile(uuid)
  to authenticated;
