-- Kiem thu cho migration 20261029000003_members_ui.sql: member_field_access + log_members_export.
-- Chay boi run_rls_tests.sh (can rls_helpers.sql nap truoc). Du lieu mau CHI nam trong CSDL kiem thu.
\set ON_ERROR_STOP on
\ir rls_fixture.sql

create table t.ids(k text primary key, v uuid);
grant select, insert on t.ids to public;
create function t.id(k text) returns uuid language sql stable as $$ select v from t.ids where t.ids.k = $1 $$;
grant execute on function t.id(text) to public;
create function t.cnt(sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || sql || ') q' into n; return n; end $$;
grant execute on function t.cnt(text) to public;

\set U1 '00000000-0000-0000-0000-000000000001'
\set U2 '00000000-0000-0000-0000-000000000002'
\set U3 '00000000-0000-0000-0000-000000000003'
\set U4 '00000000-0000-0000-0000-000000000004'
\set U5 '00000000-0000-0000-0000-000000000005'
\set U6 '00000000-0000-0000-0000-000000000006'
\set U7 '00000000-0000-0000-0000-000000000007'
\set U8 '00000000-0000-0000-0000-000000000008'
\set BA 'b0000000-0000-0000-0000-00000000000a'
\set BB 'b0000000-0000-0000-0000-00000000000b'

-- ===== 0. Du lieu: cac ho so voi muc hien thi khac nhau =====
select t.as_user(:'U2');
insert into t.ids select 'grandpa', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Ong Noi','gender','male','branch_id',:'BA','birth_solar_year',1950,'birth_solar_month',5,'birth_solar_day',10,
  'birth_visibility','branch','contact_visibility','admins','phone','0900000001','death_visibility','admins'));
insert into t.ids select 'dad', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Bo','gender','male','branch_id',:'BA','birth_solar_year',1975,'birth_solar_month',3,'birth_solar_day',2,
  'contact_visibility','admins','phone','0900000002','birth_visibility','admins','photo_visibility','admins'));
insert into t.ids select 'kidB', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Be B','branch_id',:'BB',
  'birth_solar_year', extract(year from now())::int - 8,'birth_solar_month',2,'birth_solar_day',2,'birth_visibility','family'));
insert into t.ids select 'bkid', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Chu Nhanh B','branch_id',:'BB','birth_solar_year',1990,'birth_solar_month',7,'birth_solar_day',7,
  'birth_visibility','branch','contact_visibility','branch','phone','0900000003'));
insert into t.ids select 'open', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Cong Khai','branch_id',:'BA','birth_solar_year',1960,'birth_solar_month',1,'birth_solar_day',1,
  'birth_visibility','family','contact_visibility','family','phone','0900000009'));
select t.as_user(:'U1');
select public.link_membership_member((select id from public.family_memberships where user_id = :'U4'), t.id('dad'));
select public.link_membership_member((select id from public.family_memberships where user_id = :'U5'), t.id('bkid'));
select t.as_root();
create table t.phoned as select id from public.family_members where phone is not null;
create table t.born as select id from public.family_members where birth_solar_month is not null;
grant select on t.phoned, t.born to public;

-- ===== 1. member_field_access: ket qua theo vai tro =====
-- Member nhanh A (U4), gan voi Bo
select t.as_user(:'U4');
select t.ok((public.member_field_access(t.id('grandpa'))->>'birth')::boolean, 'member: xem duoc ngay sinh Ong Noi (muc nhanh, cung nhanh A)');
select t.ok(not (public.member_field_access(t.id('grandpa'))->>'contact')::boolean, 'member: khong xem duoc lien he Ong Noi (chi quan tri)');
select t.ok(not (public.member_field_access(t.id('grandpa'))->>'death')::boolean, 'member: khong xem duoc ngay mat dat chi quan tri');
select t.ok((public.member_field_access(t.id('grandpa'))->>'photo')::boolean, 'member: xem duoc anh (muc ca gia dinh)');
select t.ok(not (public.member_field_access(t.id('bkid'))->>'birth')::boolean, 'member: khong xem duoc ngay sinh nhanh B');
select t.ok(not (public.member_field_access(t.id('bkid'))->>'contact')::boolean, 'member: khong xem duoc lien he nhanh B');
select t.ok(not (public.member_field_access(t.id('kidB'))->>'birth')::boolean, 'tre em nhanh B: ngay sinh bi che du dat ca gia dinh');
select t.ok((public.member_field_access(t.id('open'))->>'contact')::boolean, 'member: xem duoc lien he dat ca gia dinh');
select t.ok((public.member_field_access(t.id('dad'))->>'birth')::boolean
        and (public.member_field_access(t.id('dad'))->>'contact')::boolean
        and (public.member_field_access(t.id('dad'))->>'photo')::boolean, 'member: ho so cua chinh minh xem du moi nhom truong');
-- Khop voi members_view: truong co du lieu thi hien <=> access = true
select t.ok((select bool_and((public.member_field_access(v.id)->>'contact')::boolean = (v.phone is not null))
             from public.members_view v join t.phoned p on p.id = v.id), 'member: contact khop voi viec phone co hien trong members_view');
select t.ok((select bool_and((public.member_field_access(v.id)->>'birth')::boolean = (v.birth_solar_month is not null))
             from public.members_view v join t.born p on p.id = v.id), 'member: birth khop voi viec ngay sinh co hien trong members_view');
-- Khach (U5, gan voi Chu Nhanh B, khong thuoc nhanh nao)
select t.as_user(:'U5');
select t.ok(not (public.member_field_access(t.id('grandpa'))->>'birth')::boolean, 'guest: khong xem ngay sinh muc nhanh');
select t.ok((public.member_field_access(t.id('bkid'))->>'birth')::boolean and (public.member_field_access(t.id('bkid'))->>'contact')::boolean, 'guest: xem du ho so cua chinh minh');
select t.ok((public.member_field_access(t.id('open'))->>'contact')::boolean, 'guest: xem lien he dat ca gia dinh');
-- Quan tri nhanh A (U3)
select t.as_user(:'U3');
select t.ok((public.member_field_access(t.id('grandpa'))->>'contact')::boolean and (public.member_field_access(t.id('grandpa'))->>'death')::boolean, 'branch_admin: xem du truong trong nhanh minh');
select t.ok(not (public.member_field_access(t.id('bkid'))->>'contact')::boolean, 'branch_admin: khong xem lien he nhanh khac');
select t.ok(not (public.member_field_access(t.id('kidB'))->>'birth')::boolean, 'branch_admin: khong xem ngay sinh tre em nhanh khac');
select t.ok((select bool_and((public.member_field_access(v.id)->>'contact')::boolean = (v.phone is not null))
             from public.members_view v join t.phoned p on p.id = v.id), 'branch_admin: contact khop voi members_view');
-- Quan tri gia dinh / super admin
select t.as_user(:'U2');
select t.ok((public.member_field_access(t.id('bkid'))->>'contact')::boolean and (public.member_field_access(t.id('kidB'))->>'birth')::boolean, 'family_admin: xem moi nhom truong');
select t.as_user(:'U1');
select t.ok((public.member_field_access(t.id('grandpa'))->>'death')::boolean, 'super_admin: xem moi nhom truong');

-- ===== 2. member_field_access: nguoi ngoai / thu hoi / anon / khong ton tai / da xoa =====
select t.as_user(:'U6');
select t.ok(public.member_field_access(t.id('open')) is null, 'outsider: member_field_access tra null');
select t.as_user(:'U7');
select t.ok(public.member_field_access(t.id('open')) is null, 'tai khoan bi thu hoi: member_field_access tra null');
select t.as_user(:'U8');
select t.ok(public.member_field_access(t.id('open')) is null, 'tai khoan chua co quyen: member_field_access tra null');
select t.as_anon();
select t.fails($$select public.member_field_access(t.id('open'))$$, 'anon: khong goi duoc member_field_access');
select t.as_user(:'U2');
select t.ok(public.member_field_access('00000000-0000-0000-0000-0000000000ff') is null, 'ho so khong ton tai: tra null');
insert into t.ids select 'tmp', public.create_member(current_setting('t.fid')::uuid, '{"full_name":"Se bi xoa"}'::jsonb);
select public.delete_member(t.id('tmp'));
select t.ok(public.member_field_access(t.id('tmp')) is null, 'ho so da xoa mem: tra null');
select public.restore_member(t.id('tmp'));
select t.ok(public.member_field_access(t.id('tmp')) is not null, 'khoi phuc ho so: member_field_access tra ket qua lai');
select t.ok((select count(*) from jsonb_object_keys(public.member_field_access(t.id('tmp')))) = 4, 'member_field_access chi tra dung 4 khoa');

-- ===== 3. log_members_export =====
select t.as_root();
select count(*) as n0 from public.audit_logs where action = 'members.export_csv' \gset
select t.as_user(:'U2');
select public.log_members_export(current_setting('t.fid')::uuid, 12);
select t.as_user(:'U1');
select public.log_members_export(current_setting('t.fid')::uuid, -5);
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'members.export_csv') = :n0 + 2, 'xuat CSV: moi lan goi ghi mot dong nhat ky');
select t.ok((select after_data->>'rows' from public.audit_logs where action = 'members.export_csv' and actor_id = :'U2') = '12', 'xuat CSV: nhat ky ghi so dong va nguoi thuc hien');
select t.ok((select after_data->>'rows' from public.audit_logs where action = 'members.export_csv' and actor_id = :'U1') = '0', 'xuat CSV: so dong am bi dua ve 0');
select t.ok((select entity_type from public.audit_logs where action = 'members.export_csv' and actor_id = :'U2') = 'family', 'xuat CSV: nhat ky gan voi gia dinh');
select t.as_user(:'U3');
select t.fails($$select public.log_members_export(current_setting('t.fid')::uuid, 1)$$, 'branch_admin: khong co quyen xuat nen khong ghi duoc nhat ky xuat');
select t.as_user(:'U4');
select t.fails($$select public.log_members_export(current_setting('t.fid')::uuid, 1)$$, 'member: khong goi duoc log_members_export');
select t.as_user(:'U5');
select t.fails($$select public.log_members_export(current_setting('t.fid')::uuid, 1)$$, 'guest: khong goi duoc log_members_export');
select t.as_user(:'U6');
select t.fails($$select public.log_members_export(current_setting('t.fid')::uuid, 1)$$, 'outsider: khong goi duoc log_members_export');
select t.as_user(:'U7');
select t.fails($$select public.log_members_export(current_setting('t.fid')::uuid, 1)$$, 'tai khoan bi thu hoi: khong goi duoc log_members_export');
select t.as_anon();
select t.fails($$select public.log_members_export(current_setting('t.fid')::uuid, 1)$$, 'anon: khong goi duoc log_members_export');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'members.export_csv') = :n0 + 2, 'cac lan bi tu choi khong de lai dong nhat ky');

-- ===== 4. Hop dong giao dien <-> RPC: payload yeu cau ma giao dien thuc su gui =====
-- (giao dien gui so la JSON number, null de xoa gia tri, boolean that; RPC phai chap nhan dung cac dang nay)
select t.as_user(:'U4');  -- member, nhanh A, gia dinh dang khoa => phai gui yeu cau
insert into t.ids select 'rq_upd', public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('grandpa'),
  '{"hometown":"Hue","bio":null,"is_deceased":false,"birth_lunar_leap":false,"generation_no":3,"birth_solar_year":1951}'::jsonb, 'Cap nhat que quan');
insert into t.ids select 'rq_new', public.submit_change_request(current_setting('t.fid')::uuid, 'create_member', null,
  jsonb_build_object('full_name','Thanh Vien Moi','gender','female','branch_id',:'BA','birth_solar_year',1990,'birth_solar_month',6,'birth_solar_day',15,
  'birthday_mode','solar','is_deceased',false,'birth_lunar_leap',false), null);
select t.ok((select status from public.member_change_requests where id = t.id('rq_upd')) = 'pending', 'yeu cau sua: trang thai cho duyet');
select t.ok((select requested_by from public.member_change_requests where id = t.id('rq_upd')) = :'U4'::uuid, 'yeu cau luu dung nguoi gui');
select t.ok((select branch_id from public.member_change_requests where id = t.id('rq_upd')) = :'BA'::uuid, 'yeu cau gan theo nhanh cua ho so dich (de quan tri nhanh duyet)');
select t.ok((select hometown from public.members_view where id = t.id('grandpa')) is null, 'chua duyet: ho so chua bi doi');
select t.fails($$select public.review_change_request(t.id('rq_upd'), true, null)$$, 'member: khong tu duyet yeu cau cua minh');
select t.ok(t.cnt('select 1 from public.member_change_requests') = 2, 'member: chi thay yeu cau cua minh');
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.member_change_requests') = 0, 'guest: khong thay yeu cau nguoi khac');
select t.fails($$select public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('bkid'), '{"bio":"khach"}'::jsonb, null)$$, 'guest: khong gui duoc yeu cau');
-- Quan tri nhanh A duyet
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.member_change_requests') = 2, 'branch_admin A: thay yeu cau thuoc nhanh A');
select public.review_change_request(t.id('rq_upd'), true, 'Da kiem tra');
select t.ok((select hometown from public.members_view where id = t.id('grandpa')) = 'Hue', 'duyet: que quan duoc cap nhat tu payload');
select t.ok((select generation_no from public.members_view where id = t.id('grandpa')) = 3, 'duyet: so JSON duoc nhan la smallint');
select t.ok((select birth_solar_year from public.members_view where id = t.id('grandpa')) = 1951, 'duyet: nam sinh JSON number');
select public.review_change_request(t.id('rq_new'), true, null);
select t.ok((select count(*) from public.members_view where full_name = 'Thanh Vien Moi' and birth_solar_year = 1990 and birth_solar_month = 6) = 1, 'duyet yeu cau tao moi: ho so xuat hien dung du lieu');
select t.as_root();
select t.ok((select created_by from public.family_members where full_name = 'Thanh Vien Moi') = :'U4'::uuid, 'ho so tao qua yeu cau: nguoi tao la nguoi gui yeu cau');
select t.ok((select status from public.member_change_requests where id = t.id('rq_upd')) = 'approved'
        and (select review_note from public.member_change_requests where id = t.id('rq_upd')) = 'Da kiem tra', 'duyet: ghi trang thai va ghi chu');
select t.as_user(:'U3');
select t.fails($$select public.review_change_request(t.id('rq_upd'), false, null)$$, 'khong duyet lai yeu cau da xu ly');

-- Quan he qua yeu cau: cha me (nuoi), vo chong (nam la so), vong lap, go lien ket
select t.as_user(:'U2');
select public.add_parent_link(t.id('open'), t.id('grandpa'));   -- grandpa la cha ruot cua open
-- Hai nguoi cung nhanh A (yeu cau ve vo chong duoc gan theo nhanh cua nguoi co ma nho hon: cung nhanh thi ket qua on dinh)
insert into t.ids select 'spouse', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Vo Bo','branch_id',:'BA'));
select t.as_user(:'U4');
insert into t.ids select 'rq_par', public.submit_change_request(current_setting('t.fid')::uuid, 'add_parent', t.id('dad'),
  jsonb_build_object('child_id', t.id('dad'), 'parent_id', t.id('open'), 'kind', 'adoptive'), null);
insert into t.ids select 'rq_ptn', public.submit_change_request(current_setting('t.fid')::uuid, 'add_partner', t.id('dad'),
  jsonb_build_object('a_id', t.id('dad'), 'b_id', t.id('spouse'), 'status', 'married', 'start_year', 1999, 'end_year', null), 'ghi chu');
insert into t.ids select 'rq_cyc', public.submit_change_request(current_setting('t.fid')::uuid, 'add_parent', t.id('grandpa'),
  jsonb_build_object('child_id', t.id('grandpa'), 'parent_id', t.id('open'), 'kind', 'biological'), null);
select t.as_user(:'U3');
select public.review_change_request(t.id('rq_par'), true, null);
select t.ok((select kind from public.member_parent_links_v where child_id = t.id('dad') and parent_id = t.id('open')) = 'adoptive', 'duyet add_parent: quan he cha me nuoi duoc tao');
select public.review_change_request(t.id('rq_ptn'), true, null);
select t.ok((select start_year from public.member_partnerships_v where member_a in (t.id('dad'), t.id('spouse')) and member_b in (t.id('dad'), t.id('spouse'))) = 1999, 'duyet add_partner: nam bat dau la so, nam ket thuc null');
select t.fails($$select public.review_change_request(t.id('rq_cyc'), true, null)$$, 'duyet yeu cau tao vong lap bi tu choi');
select t.ok((select status from public.member_change_requests where id = t.id('rq_cyc')) = 'pending', 'duyet loi: yeu cau van cho duyet (giao dien hien loi, khong mat yeu cau)');
select public.review_change_request(t.id('rq_cyc'), false, 'Khong hop ly');
select t.ok((select status from public.member_change_requests where id = t.id('rq_cyc')) = 'rejected', 'tu choi duoc yeu cau loi');
-- Go lien ket qua link_id / partnership_id
select t.as_user(:'U4');
insert into t.ids select 'rq_rl', public.submit_change_request(current_setting('t.fid')::uuid, 'remove_link', null,
  jsonb_build_object('link_id', (select id from public.member_parent_links_v where child_id = t.id('dad') and parent_id = t.id('open'))), null);
insert into t.ids select 'rq_rp', public.submit_change_request(current_setting('t.fid')::uuid, 'remove_link', null,
  jsonb_build_object('partnership_id', (select id from public.member_partnerships_v where member_a in (t.id('dad'), t.id('spouse')) and member_b in (t.id('dad'), t.id('spouse')))), null);
select t.as_user(:'U3');
select public.review_change_request(t.id('rq_rl'), true, null);
select public.review_change_request(t.id('rq_rp'), true, null);
select t.ok(t.cnt('select 1 from public.member_parent_links_v where child_id = ''' || t.id('dad') || ''' and parent_id = ''' || t.id('open') || '''') = 0, 'duyet remove_link (link_id): go quan he cha me');
select t.ok(t.cnt('select 1 from public.member_partnerships_v where member_a in (''' || t.id('dad') || ''',''' || t.id('spouse') || ''') and member_b in (''' || t.id('dad') || ''',''' || t.id('spouse') || ''')') = 0, 'duyet remove_link (partnership_id): go quan he vo chong');

-- Yeu cau xoa ho so + huy yeu cau
select t.as_user(:'U4');
insert into t.ids select 'rq_del', public.submit_change_request(current_setting('t.fid')::uuid, 'delete_member', t.id('tmp'), '{}'::jsonb, 'khong can nua');
insert into t.ids select 'rq_cancel', public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('open'), '{"bio":"x"}'::jsonb, null);
select public.cancel_change_request(t.id('rq_cancel'));
select t.ok((select status from public.member_change_requests where id = t.id('rq_cancel')) = 'cancelled', 'nguoi gui huy duoc yeu cau cua minh');
select t.fails($$select public.cancel_change_request(t.id('rq_cancel'))$$, 'khong huy lai yeu cau da huy');
select t.as_user(:'U3');
select t.fails($$select public.cancel_change_request(t.id('rq_del'))$$, 'nguoi khac khong huy duoc yeu cau cua nguoi gui');
select t.fails($$select public.review_change_request(t.id('rq_cancel'), true, null)$$, 'khong duyet yeu cau da huy');
-- ho so 'tmp' khong thuoc nhanh nao => quan tri nhanh khong duyet duoc, quan tri gia dinh duyet duoc
select t.fails($$select public.review_change_request(t.id('rq_del'), true, null)$$, 'branch_admin: khong duyet yeu cau xoa ho so khong thuoc nhanh minh');
select t.as_user(:'U2');
select public.review_change_request(t.id('rq_del'), true, null);
select t.ok(t.cnt('select 1 from public.members_trash_v where id = ''' || t.id('tmp') || '''') = 1, 'duyet yeu cau xoa: ho so vao thung rac');
select public.restore_member(t.id('tmp'));

-- Bao ve du lieu bi che: payload chi chua truong thay doi nen khong ghi de truong an
select t.as_user(:'U4');
select t.ok(not (public.member_field_access(t.id('bkid'))->>'contact')::boolean, 'tien de: member khong xem duoc lien he cua Chu Nhanh B');
select t.as_user(:'U2');
select public.update_member(t.id('bkid'), '{"hometown":"Da Nang"}'::jsonb);
select t.ok((select phone from public.members_view where id = t.id('bkid')) = '0900000003', 'payload chi gom truong doi: so dien thoai an khong bi xoa');
select t.ok((select birth_solar_month from public.members_view where id = t.id('bkid')) = 7, 'payload chi gom truong doi: ngay sinh an khong bi xoa');

-- ===== Tong ket =====
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
