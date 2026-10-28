-- Kiem thu RLS cho nen tang (Dot 1). Can rls_helpers.sql chay truoc.
\set ON_ERROR_STOP on
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

-- ===== 1. Nguoi la / tai khoan bi thu hoi =====
select t.as_user('00000000-0000-0000-0000-000000000006');
select t.ok((select count(*) from public.families) = 0, 'outsider: khong thay families');
select t.ok((select count(*) from public.branches) = 0, 'outsider: khong thay branches');
select t.ok((select count(*) from public.family_memberships) = 0, 'outsider: khong thay memberships');
select t.ok((select count(*) from public.audit_logs) = 0, 'outsider: khong thay audit_logs');
select t.ok((select count(*) from public.invitations) = 0, 'outsider: khong thay invitations');
select t.ok((select count(*) from public.user_profiles) = 1, 'outsider: chi thay ho so cua chinh minh');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'members','view'), 'outsider: has_permission = false');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'x@x.com','member')$$, 'outsider: khong tao duoc loi moi');

select t.as_user('00000000-0000-0000-0000-000000000007');
select t.ok((select count(*) from public.families) = 0, 'revoked: mat quyen xem families ngay lap tuc');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'members','view'), 'revoked: has_permission = false');

select t.as_anon();
select t.fails('select * from public.families', 'anon: khong doc duoc families');
select t.fails('select * from public.user_profiles', 'anon: khong doc duoc ho so');
select t.fails($$select public.has_permission(gen_random_uuid(),'members','view')$$, 'anon: khong goi duoc has_permission');

-- ===== 2. Thanh vien thuong =====
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.ok((select count(*) from public.families) = 1, 'member: thay gia dinh cua minh');
select t.ok((select count(*) from public.branches) = 3, 'member: thay cac nhanh');
select t.ok((select count(*) from public.family_memberships) = 1, 'member: chi thay membership cua minh');
select t.ok((select count(*) from public.invitations) = 0, 'member: khong thay loi moi');
select t.ok((select count(*) from public.audit_logs) = 0, 'member: khong thay nhat ky');
select t.ok((select count(*) from public.user_profiles) >= 5, 'member: thay ho so cung gia dinh');
select t.ok(not exists (select 1 from public.user_profiles where display_name='Outsider'), 'member: khong thay ho so nguoi ngoai');
select t.fails($$insert into public.branches (family_id,name) values (current_setting('t.fid')::uuid,'Hack')$$, 'member: khong them duoc nhanh');
select t.fails($$update public.family_memberships set role_key='super_admin'$$, 'member: khong tu nang quyen (khong co grant UPDATE)');
select t.fails($$insert into public.family_memberships (user_id,family_id,role_key) values (gen_random_uuid(),current_setting('t.fid')::uuid,'member')$$, 'member: khong chen membership truc tiep');
select t.fails($$insert into public.audit_logs (action,entity_type) values ('x','y')$$, 'member: khong chen duoc nhat ky');
update public.families set name = 'Bi sua' where id = current_setting('t.fid')::uuid;
update public.user_profiles set display_name = 'Doi ten khac' where id = '00000000-0000-0000-0000-000000000005';
update public.user_profiles set display_name = 'Member moi' where id = '00000000-0000-0000-0000-000000000004';
select t.as_root();
select t.ok((select name from public.families) = 'Gia dinh Test', 'member: sua families bi RLS chan (0 dong)');
select t.ok((select display_name from public.user_profiles where id='00000000-0000-0000-0000-000000000005') = 'Guest', 'member: khong sua duoc ho so nguoi khac');
select t.ok((select display_name from public.user_profiles where id='00000000-0000-0000-0000-000000000004') = 'Member moi', 'member: sua duoc ho so cua minh');

-- ===== 3. Ma tran has_permission =====
select t.as_user('00000000-0000-0000-0000-000000000001');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'backup','export'), 'super_admin: moi quyen');
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'invitations','create'), 'family_admin: moi duoc thanh vien');
select t.as_user('00000000-0000-0000-0000-000000000003');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'invitations','create','b0000000-0000-0000-0000-00000000000a'), 'branch_admin: moi trong nhanh minh');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'invitations','create','b0000000-0000-0000-0000-0000000000a1'), 'branch_admin: moi trong nhanh con');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'invitations','create','b0000000-0000-0000-0000-00000000000b'), 'branch_admin: khong moi o nhanh khac');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'invitations','create'), 'branch_admin: khong moi toan gia dinh (branch null)');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'members','view'), 'branch_admin: xem chung duoc');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'audit','view'), 'branch_admin: khong xem nhat ky');
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'invitations','create'), 'member: khong moi');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'cards','create'), 'member: gui thiep duoc');
select t.as_user('00000000-0000-0000-0000-000000000005');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'chat','view'), 'guest: khong chat');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'tree','view'), 'guest: xem cay gia pha');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'cards','create'), 'guest: khong gui thiep');

-- ===== 4. Loi moi =====
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'a@a.com','member')$$, 'member: khong tao loi moi');
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'a@a.com','family_admin')$$, 'family_admin: khong moi duoc admin');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'a@a.com','super_admin')$$, 'family_admin: khong moi super_admin');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'a@a.com','member',null,null,0)$$, 'ttl 0 bi tu choi');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'a@a.com','nonexistent')$$, 'vai tro khong ton tai bi tu choi');
select public.create_invitation(current_setting('t.fid')::uuid,'newbie@test.local','member','b0000000-0000-0000-0000-00000000000b') as tok_member \gset
select set_config('t.tok_member', :'tok_member', false);
select t.ok(length(:'tok_member') = 48, 'family_admin: tao loi moi member, token 48 ky tu hex');
select t.as_user('00000000-0000-0000-0000-000000000003');
select t.ok(public.create_invitation(current_setting('t.fid')::uuid,'x1@test.local','member','b0000000-0000-0000-0000-0000000000a1') is not null, 'branch_admin: moi trong nhanh con');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'x2@test.local','member','b0000000-0000-0000-0000-00000000000b')$$, 'branch_admin: khong moi sang nhanh khac');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'x3@test.local','member')$$, 'branch_admin: khong moi khong chi nhanh');
select t.fails($$select public.create_invitation(current_setting('t.fid')::uuid,'x4@test.local','branch_admin','b0000000-0000-0000-0000-00000000000a')$$, 'branch_admin: khong moi admin khac');
select t.ok((select count(*) from public.invitations) = 1, 'branch_admin: chi thay loi moi trong nhanh minh');
select t.as_user('00000000-0000-0000-0000-000000000001');
select public.create_invitation(current_setting('t.fid')::uuid,'newadmin@test.local','family_admin') as tok_admin \gset
select set_config('t.tok_admin', :'tok_admin', false);
select t.ok(:'tok_admin' is not null, 'super_admin: moi duoc family_admin');
select t.ok((select count(*) from public.invitations) = 3, 'super_admin: thay moi loi moi');
select t.ok(not exists (select 1 from public.invitations where token_hash = :'tok_admin'), 'token goc khong duoc luu, chi luu bam');
select t.ok((select count(*) from public.audit_logs where action='invitation.create') = 3, 'tao loi moi duoc ghi nhat ky');

-- ===== 5. peek / redeem =====
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.fails($$select * from public.peek_invitation('abc')$$, 'authenticated: khong goi duoc peek_invitation');
select t.fails($$select public.redeem_invitation('abc', gen_random_uuid(), 'x')$$, 'authenticated: khong goi duoc redeem_invitation');
select t.fails($$select public.bootstrap_family('x', gen_random_uuid(), 'x')$$, 'authenticated: khong goi duoc bootstrap_family');
select t.as_service();
select t.ok((select count(*) from public.peek_invitation(current_setting('t.tok_member'))) = 1, 'service: peek tra ve loi moi hop le');
select t.ok((select count(*) from public.peek_invitation('khong-ton-tai')) = 0, 'service: peek token sai = rong');
select t.fails($$select public.redeem_invitation(current_setting('t.tok_member'), '00000000-0000-0000-0000-000000000006', 'Sai email')$$, 'redeem: sai email bi tu choi');
select public.redeem_invitation(current_setting('t.tok_member'), '00000000-0000-0000-0000-000000000008', 'Newbie') as new_mem \gset
select t.ok(:'new_mem' is not null, 'redeem: dung email thanh cong');
select t.fails($$select public.redeem_invitation(current_setting('t.tok_member'), '00000000-0000-0000-0000-000000000008', 'Newbie')$$, 'redeem: dung lai token bi tu choi');
select t.as_user('00000000-0000-0000-0000-000000000008');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'tree','view'), 'nguoi moi: co quyen xem sau khi redeem');
select t.as_root();
update public.invitations set expires_at = now() - interval '1 minute' where email = 'newadmin@test.local';
select t.as_service();
select t.fails($$select public.redeem_invitation(current_setting('t.tok_admin'), '00000000-0000-0000-0000-000000000006', 'x')$$, 'redeem: loi moi het han bi tu choi');

-- ===== 6. Thu hoi quyen / Super Admin cuoi / nhat ky =====
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.fails($$select public.revoke_membership((select id from public.family_memberships where role_key='guest'))$$, 'member: khong thu hoi duoc quyen ai');
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.fails($$select public.revoke_membership((select id from public.family_memberships where role_key='super_admin'))$$, 'family_admin: khong thu hoi duoc super_admin');
select t.fails($$select public.revoke_membership((select id from public.family_memberships where user_id=auth.uid()))$$, 'khong tu thu hoi chinh minh');
select public.revoke_membership((select id from public.family_memberships where role_key='guest'));
select t.as_user('00000000-0000-0000-0000-000000000005');
select t.ok((select count(*) from public.families) = 0, 'guest bi thu hoi: mat quyen xem ngay lap tuc');
select t.ok(not public.has_permission(current_setting('t.fid')::uuid,'tree','view'), 'guest bi thu hoi: has_permission = false');
select t.as_user('00000000-0000-0000-0000-000000000001');
select t.fails($$select public.set_member_role((select id from public.family_memberships where role_key='super_admin'),'member')$$, 'khong ha quyen Super Admin cuoi cung');
select t.fails($$select public.revoke_membership((select id from public.family_memberships where role_key='super_admin'))$$, 'khong tu thu hoi (Super Admin cuoi)');
select public.set_member_role((select id from public.family_memberships where role_key='member' and user_id='00000000-0000-0000-0000-000000000004'), 'branch_admin', 'b0000000-0000-0000-0000-00000000000b');
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.ok(public.has_permission(current_setting('t.fid')::uuid,'invitations','create','b0000000-0000-0000-0000-00000000000b'), 'set_member_role: len branch_admin co hieu luc');
select t.as_user('00000000-0000-0000-0000-000000000001');
select t.fails($$select public.set_member_role((select id from public.family_memberships where user_id='00000000-0000-0000-0000-000000000004'),'branch_admin',null)$$, 'branch_admin bat buoc co nhanh');
select t.as_root();
select t.fails($$delete from public.family_memberships where role_key='super_admin'$$, 'xoa truc tiep Super Admin cuoi bi trigger chan');
select t.fails($$update public.audit_logs set action='x'$$, 'audit_logs: khong sua duoc (ke ca superuser)');
select t.fails($$delete from public.audit_logs$$, 'audit_logs: khong xoa duoc');
select t.fails($$select public.bootstrap_family('lan 2', '00000000-0000-0000-0000-000000000006', 'x')$$, 'bootstrap chi chay mot lan');
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.ok((select count(*) from public.audit_logs) >= 5, 'family_admin: xem duoc nhat ky');
select t.ok(exists (select 1 from public.audit_logs where action='membership.revoke'), 'thu hoi quyen duoc ghi nhat ky');

-- ===== 7. Khoa / mo khoa chinh sua =====
select t.as_user('00000000-0000-0000-0000-000000000004');
select t.ok(not public.is_editing_open(current_setting('t.fid')::uuid), 'mac dinh: chinh sua bi khoa');
select t.fails($$select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open')$$, 'member (nay la branch_admin nhanh B): khong bat toan gia dinh');
select public.set_editing_mode(current_setting('t.fid')::uuid, 'b0000000-0000-0000-0000-00000000000b', 'open');
select t.ok(public.is_editing_open(current_setting('t.fid')::uuid, 'b0000000-0000-0000-0000-00000000000b'), 'branch_admin: bat duoc nhanh minh');
select t.ok(not public.is_editing_open(current_setting('t.fid')::uuid, 'b0000000-0000-0000-0000-00000000000a'), 'nhanh khac van khoa');
select t.fails($$select public.set_editing_mode(current_setting('t.fid')::uuid, 'b0000000-0000-0000-0000-00000000000a', 'open')$$, 'branch_admin: khong bat nhanh khac');
select t.as_user('00000000-0000-0000-0000-000000000002');
select t.fails($$select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open', now() - interval '1 hour')$$, 'han mo khoa trong qua khu bi tu choi');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open', now() + interval '1 day');
select t.ok(public.is_editing_open(current_setting('t.fid')::uuid), 'family_admin: bat toan gia dinh co han');
select t.ok(public.is_editing_open(current_setting('t.fid')::uuid, 'b0000000-0000-0000-0000-00000000000a'), 'nhanh ke thua trang thai gia dinh');
select public.set_editing_mode(current_setting('t.fid')::uuid, 'b0000000-0000-0000-0000-00000000000a', 'locked');
select t.ok(not public.is_editing_open(current_setting('t.fid')::uuid, 'b0000000-0000-0000-0000-00000000000a'), 'nhanh khoa rieng ghi de trang thai gia dinh');
select t.as_root();
update public.families set editing_open_until = now() - interval '1 second' where id = current_setting('t.fid')::uuid;
select t.ok(not public.is_editing_open(current_setting('t.fid')::uuid), 'het han tu dong dong lai khong can cron');

-- ===== Tong ket =====
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
