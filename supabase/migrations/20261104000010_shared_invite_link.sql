-- Lien ket moi DUNG CHUNG cho ca nha (nguoi dung chot 29/10/2026):
-- Schema goc da co san invitations.max_uses (1..50) + used_count, va peek_invitation /
-- redeem_invitation da kiem tra used_count < max_uses; chi con thieu: create_invitation
-- chua nhan p_max_uses nen moi loi moi tao ra deu mac dinh 1 luot dung.
-- Migration nay tao lai create_invitation voi tham so p_max_uses (mac dinh 1 = hanh vi cu).

drop function if exists public.create_invitation(uuid, text, text, uuid, uuid, int);

create or replace function public.create_invitation(
  p_family uuid, p_email text, p_role text,
  p_branch uuid default null, p_member_id uuid default null, p_ttl_hours int default 168,
  p_max_uses int default 1
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text; v_email text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.roles where key = p_role) then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if p_ttl_hours is null or p_ttl_hours < 1 or p_ttl_hours > 720 then
    raise exception 'ttl must be between 1 and 720 hours' using errcode = '22023';
  end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 50 then
    raise exception 'max_uses must be between 1 and 50' using errcode = '22023';
  end if;
  if p_branch is not null and not exists (
       select 1 from public.branches b
       where b.id = p_branch and b.family_id = p_family and b.deleted_at is null) then
    raise exception 'branch does not belong to family' using errcode = '22023';
  end if;
  if p_role = 'branch_admin' and p_branch is null then
    raise exception 'branch_admin needs a branch' using errcode = '22023';
  end if;

  if p_role in ('super_admin','family_admin','branch_admin') then
    -- Chi Super Admin duoc moi admin
    if public.my_role(p_family) is distinct from 'super_admin' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    if not public.has_permission(p_family, 'invitations', 'create', p_branch) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  v_email := nullif(lower(btrim(p_email)), '');
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (family_id, email, token_hash, role_key, branch_id, member_id,
                                  expires_at, max_uses, created_by)
  values (p_family, v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_role, p_branch,
          p_member_id, now() + make_interval(hours => p_ttl_hours), p_max_uses, auth.uid())
  returning id into v_id;

  perform public.write_audit(p_family, 'invitation.create', 'invitation', v_id::text, null,
    jsonb_build_object('email', v_email, 'role', p_role, 'branch_id', p_branch, 'max_uses', p_max_uses));
  return v_token;
end $$;

grant execute on function public.create_invitation(uuid, text, text, uuid, uuid, int, int) to authenticated;
