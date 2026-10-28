-- Du lieu mau dung chung (CHI trong CSDL kiem thu). Dung: \ir rls_fixture.sql sau khi nap rls_helpers.sql.
-- Vai: ...001 super_admin, ...002 family_admin, ...003 branch_admin (nhanh A), ...004 member (nhanh A),
--      ...005 guest, ...006 nguoi ngoai, ...007 da thu hoi, ...008 chua co quyen.
-- Nhanh: b0..0a (A), b0..0b (B), b0..a1 (A1, con cua A). Gia dinh id nam trong bien psql :fid va t.fid.
-- ===== Du lieu mau (CHI trong CSDL kiem thu) =====
select t.as_root();
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','super@test.local'),
 ('00000000-0000-0000-0000-000000000002','famadmin@test.local'),
 ('00000000-0000-0000-0000-000000000003','branchadmin@test.local'),
 ('00000000-0000-0000-0000-000000000004','member@test.local'),
 ('00000000-0000-0000-0000-000000000005','guest@test.local'),
 ('00000000-0000-0000-0000-000000000006','outsider@test.local'),
 ('00000000-0000-0000-0000-000000000007','revoked@test.local'),
 ('00000000-0000-0000-0000-000000000008','newbie@test.local');

select public.bootstrap_family('Gia dinh Test', '00000000-0000-0000-0000-000000000001', 'Super') as fid \gset
insert into public.branches (id, family_id, name) values
 ('b0000000-0000-0000-0000-00000000000a', :'fid', 'Nhanh A'),
 ('b0000000-0000-0000-0000-00000000000b', :'fid', 'Nhanh B');
insert into public.branches (id, family_id, name, parent_branch_id) values
 ('b0000000-0000-0000-0000-0000000000a1', :'fid', 'Nhanh A1', 'b0000000-0000-0000-0000-00000000000a');
insert into public.user_profiles (id, display_name) values
 ('00000000-0000-0000-0000-000000000002','FamAdmin'),
 ('00000000-0000-0000-0000-000000000003','BranchAdmin'),
 ('00000000-0000-0000-0000-000000000004','Member'),
 ('00000000-0000-0000-0000-000000000005','Guest'),
 ('00000000-0000-0000-0000-000000000006','Outsider'),
 ('00000000-0000-0000-0000-000000000007','Revoked');
insert into public.family_memberships (user_id, family_id, role_key, branch_id) values
 ('00000000-0000-0000-0000-000000000002', :'fid', 'family_admin', null),
 ('00000000-0000-0000-0000-000000000003', :'fid', 'branch_admin', 'b0000000-0000-0000-0000-00000000000a'),
 ('00000000-0000-0000-0000-000000000004', :'fid', 'member', 'b0000000-0000-0000-0000-00000000000a'),
 ('00000000-0000-0000-0000-000000000005', :'fid', 'guest', null);
insert into public.family_memberships (user_id, family_id, role_key, status, revoked_at) values
 ('00000000-0000-0000-0000-000000000007', :'fid', 'member', 'revoked', now());
select set_config('t.fid', :'fid', false);

