-- Kiem thu RLS + nghiep vu cho Dot 2: thanh vien, gia pha, yeu cau sua, thong bao, nhap/xuat.
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
\set BA1 'b0000000-0000-0000-0000-0000000000a1'

-- ===== 0. Dung gia pha mau bang family_admin =====
select t.as_user(:'U2');
insert into t.ids select 'grandpa', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Ong Noi','gender','male','branch_id',:'BA','birth_solar_year',1950,'birth_solar_month',5,'birth_solar_day',10,
  'birth_visibility','branch','contact_visibility','admins','phone','0900000001'));
insert into t.ids select 'grandma', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Ba Noi','gender','female','branch_id',:'BA','birth_solar_year',1953));
insert into t.ids select 'dad', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Bo','gender','male','branch_id',:'BA','birth_solar_year',1975,'birth_solar_month',3,'birth_solar_day',2,
  'contact_visibility','admins','phone','0900000002','birth_visibility','admins'));
insert into t.ids select 'mom', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Me','gender','female','birth_solar_year',1978));
insert into t.ids select 'kid', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Be A','gender','female','branch_id',:'BA',
  'birth_solar_year', extract(year from now())::int - 10,'birth_solar_month',1,'birth_solar_day',1,'birth_visibility','family'));
insert into t.ids select 'kidB', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Be B','branch_id',:'BB',
  'birth_solar_year', extract(year from now())::int - 8,'birth_solar_month',2,'birth_solar_day',2,'birth_visibility','family'));
insert into t.ids select 'bkid', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Chu Nhanh B','branch_id',:'BB','birth_solar_year',1990,'birth_solar_month',7,'birth_solar_day',7,
  'birth_visibility','branch','contact_visibility','branch','phone','0900000003'));
insert into t.ids select 'a1', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object(
  'full_name','Nguoi Nhanh A1','branch_id',:'BA1','birth_solar_year',1985));

select public.add_parent_link(t.id('dad'), t.id('grandpa'));
select public.add_parent_link(t.id('dad'), t.id('grandma'));
select public.add_parent_link(t.id('kid'), t.id('dad'));
select public.add_parent_link(t.id('kid'), t.id('mom'));
select public.add_partnership(t.id('grandpa'), t.id('grandma'), 'married', 1972::smallint);
select public.add_partnership(t.id('mom'), t.id('dad'), 'married');

-- Gan tai khoan: member(004) = Bo; guest(005) = Chu Nhanh B (khach co ho so)
select t.as_user(:'U1');
select public.link_membership_member((select id from public.family_memberships where user_id = :'U4'), t.id('dad'));
select public.link_membership_member((select id from public.family_memberships where user_id = :'U5'), t.id('bkid'));
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'member.insert') = 8, 'audit: moi ho so tao ra co mot dong nhat ky member.insert');
select t.ok((select count(*) from public.audit_logs where action = 'parent_link.insert') = 4, 'audit: lien ket cha-con duoc ghi');
select t.ok((select count(*) from public.audit_logs where action = 'membership.link_member') = 2, 'audit: gan tai khoan voi ho so duoc ghi');
select t.fails($$select public.link_membership_member((select id from public.family_memberships where user_id = '00000000-0000-0000-0000-000000000004'), (select id from public.family_members where full_name='Be A'))$$, 'root khong co auth.uid nen bi tu choi gan tai khoan');

-- Hai tai khoan khong cung tro mot ho so
select t.as_user(:'U1');
select t.fails($$select public.link_membership_member((select id from public.family_memberships where user_id = '00000000-0000-0000-0000-000000000002'), t.id('dad'))$$, 'mot ho so chi gan mot tai khoan dang hoat dong');

-- ===== 1. Nguoi la / thu hoi / chua dang nhap =====
select t.as_user(:'U6');
select t.ok(t.cnt('select 1 from public.members_view') = 0, 'outsider: members_view rong');
select t.ok(t.cnt('select 1 from public.member_parent_links_v') = 0, 'outsider: lien ket cha-con rong');
select t.ok(t.cnt('select 1 from public.member_change_requests') = 0, 'outsider: khong thay yeu cau sua');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, '{"full_name":"Hack"}'::jsonb)$$, 'outsider: khong tao duoc ho so');
select t.fails($$select public.export_family_tree(current_setting('t.fid')::uuid)$$, 'outsider: khong xuat duoc');
select t.as_user(:'U7');
select t.ok(t.cnt('select 1 from public.members_view') = 0, 'tai khoan bi thu hoi: members_view rong');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, '{"full_name":"Hack"}'::jsonb)$$, 'tai khoan bi thu hoi: khong tao duoc ho so');
select t.fails($$select public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('dad'), '{"bio":"x"}'::jsonb)$$, 'tai khoan bi thu hoi: khong gui duoc yeu cau');
select t.as_user(:'U8');
select t.ok(t.cnt('select 1 from public.members_view') = 0, 'tai khoan chua co quyen: members_view rong');
select t.as_anon();
select t.fails($$select * from public.members_view$$, 'anon: khong doc duoc members_view');
select t.fails($$select * from public.family_members$$, 'anon: khong doc duoc bang goc');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, '{"full_name":"Hack"}'::jsonb)$$, 'anon: khong goi duoc create_member');
select t.fails($$select * from public.notifications$$, 'anon: khong doc duoc thong bao');

-- ===== 2. Bang goc khong truy cap truc tiep =====
select t.as_user(:'U2');
select t.fails($$select * from public.family_members$$, 'family_admin: khong doc bang goc family_members');
select t.fails($$insert into public.family_members (family_id, full_name) values (current_setting('t.fid')::uuid, 'Truc tiep')$$, 'family_admin: khong ghi truc tiep bang goc');
select t.fails($$update public.family_members set full_name = 'X'$$, 'family_admin: khong update truc tiep');
select t.fails($$delete from public.member_parent_links$$, 'family_admin: khong xoa truc tiep lien ket');
select t.fails($$insert into public.notifications (family_id, user_id, kind, title) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000002', 'system', 'gia')$$, 'khong tu chen thong bao');
select t.fails($$select public._notify(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000002', 'system', 'x', null, null, null)$$, 'authenticated khong goi duoc ham noi bo _notify');
select t.fails($$select public._member_insert(current_setting('t.fid')::uuid, '{"full_name":"x"}'::jsonb, null)$$, 'authenticated khong goi duoc _member_insert');
select t.fails($$select public.write_audit(current_setting('t.fid')::uuid, 'fake', 'x', null, null, null)$$, 'authenticated khong ghi duoc nhat ky gia');

-- ===== 3. Che truong nhay cam =====
-- Member (004, nhanh A, gan voi Bo)
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.members_view') = 8, 'member: thay du 8 ho so (ten luon hien)');
select t.ok((select birth_solar_month from public.members_view where id = t.id('grandpa')) = 5, 'member: thay ngay sinh Ong Noi (pham vi nhanh, cung nhanh A)');
select t.ok((select phone from public.members_view where id = t.id('grandpa')) is null, 'member: khong thay SDT khi dat chi quan tri');
select t.ok((select birth_solar_month from public.members_view where id = t.id('bkid')) is null, 'member: khong thay ngay sinh nhanh B (pham vi nhanh)');
select t.ok((select birth_solar_year from public.members_view where id = t.id('bkid')) = 1990, 'member: van thay nam sinh');
select t.ok((select phone from public.members_view where id = t.id('bkid')) is null, 'member: khong thay SDT nhanh B');
select t.ok((select birth_solar_month from public.members_view where id = t.id('kidB')) is null, 'tre em nhanh B: ngay sinh khong mo cho ca gia dinh du dat family');
select t.ok((select is_minor from public.members_view where id = t.id('kidB')), 'tre em duoc nhan biet theo tuoi');
select t.ok((select birth_solar_month from public.members_view where id = t.id('kid')) = 1, 'tre em cung nhanh: thay ngay sinh');
select t.ok((select phone from public.members_view where id = t.id('dad')) = '0900000002', 'tu xem SDT cua chinh minh');
select t.ok((select birth_solar_month from public.members_view where id = t.id('dad')) = 3, 'tu xem ngay sinh cua chinh minh (dat chi quan tri)');
select t.ok((select is_self from public.members_view where id = t.id('dad')), 'is_self dung cho ho so cua minh');
select t.ok((select birth_visibility from public.members_view where id = t.id('dad')) = 'admins', 'chu ho so thay cai dat rieng tu cua minh');
select t.ok((select birth_visibility from public.members_view where id = t.id('grandpa')) is null, 'nguoi khac khong thay cai dat rieng tu');
select t.ok(not (select can_edit from public.members_view where id = t.id('grandpa')), 'member (khoa): can_edit=false voi ho so nguoi khac');
select t.ok((select can_edit from public.members_view where id = t.id('dad')), 'member: can_edit=true voi ho so cua minh');
-- Guest
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.members_view') = 8, 'guest: thay danh sach ten');
select t.ok((select birth_solar_month from public.members_view where id = t.id('grandpa')) is null, 'guest: khong thay ngay sinh (pham vi nhanh, khong co nhanh)');
select t.ok((select birth_solar_month from public.members_view where id = t.id('bkid')) = 7, 'guest: thay ngay sinh cua chinh minh (gan ho so)');
select t.ok(not (select can_edit from public.members_view where id = t.id('bkid')), 'guest: khong bao gio duoc sua, ke ca ho so cua minh');
select t.fails($$select public.update_member(t.id('bkid'), '{"bio":"khach sua"}'::jsonb)$$, 'guest: khong sua duoc ho so cua minh');
-- Branch admin nhanh A (003)
select t.as_user(:'U3');
select t.ok((select birth_solar_month from public.members_view where id = t.id('dad')) = 3, 'branch_admin: thay du lieu rieng tu trong nhanh minh');
select t.ok((select phone from public.members_view where id = t.id('grandpa')) = '0900000001', 'branch_admin: thay SDT ho so nhanh minh');
select t.ok((select birth_solar_month from public.members_view where id = t.id('bkid')) is null, 'branch_admin: khong thay du lieu rieng tu nhanh khac');
select t.ok((select birth_solar_month from public.members_view where id = t.id('kidB')) is null, 'branch_admin: khong thay ngay sinh tre em nhanh khac');
select t.ok((select birth_visibility from public.members_view where id = t.id('grandpa')) = 'branch', 'branch_admin: thay cai dat rieng tu trong nhanh minh');
-- Family admin / super admin
select t.as_user(:'U2');
select t.ok((select phone from public.members_view where id = t.id('bkid')) = '0900000003', 'family_admin: thay moi du lieu');
select t.ok((select birth_solar_month from public.members_view where id = t.id('kidB')) = 2, 'family_admin: thay ngay sinh tre em');
select t.as_user(:'U1');
select t.ok(t.cnt('select 1 from public.members_view') = 8, 'super_admin: thay toan bo');

-- ===== 4. Khoa / mo chinh sua =====
select t.as_user(:'U4');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Moi','branch_id','b0000000-0000-0000-0000-00000000000a'))$$, 'member: khong tao ho so khi bi khoa');
select t.fails($$select public.update_member(t.id('grandpa'), '{"bio":"Sua luc khoa"}'::jsonb)$$, 'member: khong sua ho so nguoi khac khi bi khoa');
select public.update_member(t.id('dad'), '{"bio":"Tu cap nhat gioi thieu"}'::jsonb);
select t.ok((select bio from public.members_view where id = t.id('dad')) = 'Tu cap nhat gioi thieu', 'member: luon tu sua duoc ho so cua minh');
select t.fails($$select public.update_member(t.id('dad'), jsonb_build_object('branch_id','b0000000-0000-0000-0000-00000000000b'))$$, 'member: khong tu doi nhanh');
select t.fails($$select public.update_member(t.id('dad'), '{"full_name":""}'::jsonb)$$, 'ten rong bi tu choi');
select t.fails($$select public.add_parent_link(t.id('a1'), t.id('mom'))$$, 'member: khong them quan he khi bi khoa');
select t.fails($$select public.delete_member(t.id('dad'))$$, 'member: khong xoa duoc ho so');
-- Branch admin B (khong co): dung branch admin A mo khoa nhanh A
select t.as_user(:'U3');
select public.set_editing_mode(current_setting('t.fid')::uuid, :'BA', 'open', now() + interval '1 day');
select t.as_user(:'U4');
select public.update_member(t.id('grandpa'), '{"hometown":"Hue"}'::jsonb);
select t.ok((select hometown from public.members_view where id = t.id('grandpa')) = 'Hue', 'member: sua duoc ho so nhanh A khi nhanh A mo');
insert into t.ids select 'newA', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Them boi member','branch_id',:'BA'));
select t.ok(t.id('newA') is not null, 'member: tao ho so nhanh A khi nhanh A mo');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Sai nhanh','branch_id','b0000000-0000-0000-0000-00000000000b'))$$, 'member: khong tao o nhanh B khi chi nhanh A mo');
select t.fails($$select public.update_member(t.id('bkid'), '{"bio":"x"}'::jsonb)$$, 'member: khong sua nhanh B khi chi nhanh A mo');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, '{"full_name":"Khong nhanh"}'::jsonb)$$, 'member: tao ho so khong nhanh khi gia dinh con khoa');
select t.fails($$select public.update_member(t.id('mom'), '{"bio":"x"}'::jsonb)$$, 'member: khong sua ho so khong nhanh khi gia dinh con khoa');
select t.as_user(:'U3');
select public.set_editing_mode(current_setting('t.fid')::uuid, :'BA', 'locked');
select t.as_user(:'U4');
select t.fails($$select public.update_member(t.id('grandpa'), '{"hometown":"Saigon"}'::jsonb)$$, 'khoa lai: member het quyen sua ngay lap tuc');
select t.as_root();
update public.branches set editing_mode = 'open', editing_open_until = now() - interval '1 second' where id = :'BA';
select t.as_user(:'U4');
select t.fails($$select public.update_member(t.id('grandpa'), '{"hometown":"Saigon"}'::jsonb)$$, 'het han mo khoa: tu dong khoa');

-- ===== 5. Branch admin =====
select t.as_user(:'U3');
select t.as_root(); update public.branches set editing_mode = 'locked', editing_open_until = null where id = :'BA'; select t.as_user(:'U3');
insert into t.ids select 'byBA', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Tao boi branch admin','branch_id',:'BA1'));
select t.ok(t.id('byBA') is not null, 'branch_admin: tao ho so nhanh con khi dang khoa');
select public.update_member(t.id('a1'), '{"bio":"ok"}'::jsonb);
select t.ok((select bio from public.members_view where id = t.id('a1')) = 'ok', 'branch_admin: sua ho so nhanh con');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','x','branch_id','b0000000-0000-0000-0000-00000000000b'))$$, 'branch_admin: khong tao o nhanh khac');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, '{"full_name":"x"}'::jsonb)$$, 'branch_admin: khong tao ho so khong thuoc nhanh nao');
select t.fails($$select public.update_member(t.id('bkid'), '{"bio":"x"}'::jsonb)$$, 'branch_admin: khong sua nhanh khac');
select t.fails($$select public.update_member(t.id('mom'), '{"bio":"x"}'::jsonb)$$, 'branch_admin: khong sua ho so khong nhanh');
select t.fails($$select public.update_member(t.id('a1'), jsonb_build_object('branch_id','b0000000-0000-0000-0000-00000000000b'))$$, 'branch_admin: khong chuyen thanh vien sang nhanh ngoai pham vi');
select public.update_member(t.id('a1'), jsonb_build_object('branch_id',:'BA'));
select t.ok((select branch_id from public.members_view where id = t.id('a1')) = :'BA'::uuid, 'branch_admin: chuyen trong pham vi cua minh duoc');
select public.update_member(t.id('a1'), jsonb_build_object('branch_id',:'BA1'));
select t.fails($$select public.delete_member(t.id('byBA'))$$, 'branch_admin: khong xoa ho so (can quyen delete)');
select t.fails($$select public.import_family_tree(current_setting('t.fid')::uuid, '{"members":[]}'::jsonb)$$, 'branch_admin: khong nhap gia pha');
select t.fails($$select public.export_family_tree(current_setting('t.fid')::uuid)$$, 'branch_admin: khong xuat gia pha');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','x','branch_id','00000000-0000-0000-0000-0000000000ff'))$$, 'nhanh khong ton tai bi tu choi');

-- ===== 6. Xoa mem / khoi phuc =====
select t.as_user(:'U2');
select t.fails($$select public.delete_member(t.id('dad'))$$, 'khong xoa ho so dang gan tai khoan');
select public.delete_member(t.id('byBA'));
select t.ok(t.cnt('select 1 from public.members_view where id = ''' || t.id('byBA') || '''') = 0, 'ho so da xoa khong con trong danh sach');
select t.ok(t.cnt('select 1 from public.members_trash_v') = 1, 'family_admin: thay thung rac');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.members_trash_v') = 0, 'branch_admin: khong thay thung rac');
select t.as_user(:'U2');
select public.restore_member(t.id('byBA'));
select t.ok(t.cnt('select 1 from public.members_view where id = ''' || t.id('byBA') || '''') = 1, 'khoi phuc ho so');
select t.fails($$select public.restore_member(t.id('byBA'))$$, 'khong khoi phuc ho so chua xoa');
-- Xoa ho so thi lien ket an
select public.delete_member(t.id('mom'));
select t.ok(t.cnt('select 1 from public.member_parent_links_v where parent_id = ''' || t.id('mom') || '''') = 0, 'lien ket den ho so da xoa bi an');
select t.ok(t.cnt('select 1 from public.member_partnerships_v where member_a = ''' || t.id('mom') || ''' or member_b = ''' || t.id('mom') || '''') = 0, 'hon nhan den ho so da xoa bi an');
select public.restore_member(t.id('mom'));
select t.ok(t.cnt('select 1 from public.member_parent_links_v where parent_id = ''' || t.id('mom') || '''') = 1, 'khoi phuc ho so: lien ket hien lai');

-- ===== 7. Quan he gia pha: rang buoc =====
select t.fails($$select public.add_parent_link(t.id('grandpa'), t.id('kid'))$$, 'chan vong lap: con khong the la cha cua to tien');
select t.fails($$select public.add_parent_link(t.id('dad'), t.id('dad'))$$, 'chan tu lam cha cua chinh minh');
select t.fails($$select public.add_parent_link(t.id('kid'), t.id('dad'))$$, 'chan lien ket cha-con trung');
select t.fails($$select public.add_parent_link(t.id('kid'), t.id('a1'))$$, 'chan cha me ruot thu ba');
select public.add_parent_link(t.id('kid'), t.id('a1'), 'adoptive');
select t.ok(t.cnt('select 1 from public.member_parent_links_v where child_id = ''' || t.id('kid') || '''') = 3, 'cho phep cha me nuoi them (adoptive)');
select t.fails($$select public.add_parent_link(t.id('kid'), t.id('bkid'), 'khac')$$, 'loai quan he khong hop le bi tu choi');
select t.fails($$select public.add_partnership(t.id('dad'), t.id('grandpa'))$$, 'chan hon nhan cha-con');
select t.fails($$select public.add_partnership(t.id('mom'), t.id('dad'))$$, 'chan hon nhan trung (cung thu tu)');
select t.fails($$select public.add_partnership(t.id('dad'), t.id('mom'))$$, 'chan hon nhan trung (dao thu tu)');
select t.fails($$select public.add_partnership(t.id('dad'), t.id('dad'))$$, 'chan ket hon voi chinh minh');
select t.ok(t.cnt('select 1 from public.member_partnerships_v') = 2, 'hai moi hon nhan');
select public.remove_partnership((select id from public.member_partnerships_v where member_a = least(t.id('mom'), t.id('dad')) and member_b = greatest(t.id('mom'), t.id('dad'))));
select public.add_partnership(t.id('dad'), t.id('mom'), 'divorced', 2000::smallint, 2010::smallint);
select t.ok((select status from public.member_partnerships_v where member_a = least(t.id('mom'), t.id('dad')) and member_b = greatest(t.id('mom'), t.id('dad'))) = 'divorced', 'xoa mem hon nhan roi them lai duoc');
select public.remove_parent_link((select id from public.member_parent_links_v where child_id = t.id('kid') and parent_id = t.id('a1')));
select t.ok(t.cnt('select 1 from public.member_parent_links_v where child_id = ''' || t.id('kid') || '''') = 2, 'go lien ket cha-con (xoa mem)');
select public.update_partnership((select id from public.member_partnerships_v where status = 'divorced'), 'widowed', 2000::smallint, 2015::smallint);
select t.ok(t.cnt('select 1 from public.member_partnerships_v where status = ''widowed''') = 1, 'cap nhat tinh trang hon nhan');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.member_parent_links_v') = 4, 'member: xem duoc lien ket cha-con');
select t.fails($$select public.add_partnership(t.id('a1'), t.id('bkid'))$$, 'member (khoa): khong them hon nhan');
select t.fails($$select public.remove_parent_link((select id from public.member_parent_links_v limit 1))$$, 'member (khoa): khong go lien ket');

-- ===== 8. Khac gia dinh =====
select t.as_root();
insert into public.families (name) values ('Gia dinh 2') returning id as fid2 \gset
insert into public.user_profiles (id, display_name) values (:'U8', 'Chu gia dinh 2');
insert into public.family_memberships (user_id, family_id, role_key) values (:'U8', :'fid2', 'super_admin');
select set_config('t.fid2', :'fid2', false);
select t.as_user(:'U8');
insert into t.ids select 'f2m', public.create_member(current_setting('t.fid2')::uuid, '{"full_name":"Nguoi gia dinh 2"}'::jsonb);
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.members_view where id = t.id(''f2m'')') = 0, 'khong thay ho so gia dinh khac');
select t.fails($$select public.update_member(t.id('f2m'), '{"bio":"x"}'::jsonb)$$, 'khong sua ho so gia dinh khac');
select t.fails($$select public.create_member(current_setting('t.fid2')::uuid, '{"full_name":"x"}'::jsonb)$$, 'khong tao ho so trong gia dinh khac');
select t.fails($$select public.add_parent_link(t.id('kid'), t.id('f2m'))$$, 'khong noi cha-con xuyen gia dinh');
select t.fails($$select public.add_partnership(t.id('kid'), t.id('f2m'))$$, 'khong noi hon nhan xuyen gia dinh');
select t.as_root();
insert into public.branches (id, family_id, name) values ('b0000000-0000-0000-0000-0000000000f2', current_setting('t.fid2')::uuid, 'Nhanh F2');
select t.as_user(:'U2');
select t.fails($$select public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','x','branch_id','b0000000-0000-0000-0000-0000000000f2'))$$, 'nhanh thuoc gia dinh khac bi tu choi');
select t.fails($$select public.link_membership_member((select id from public.family_memberships where user_id = :'U4'::uuid), t.id('f2m'))$$, 'khong gan tai khoan voi ho so gia dinh khac');

-- ===== 9. Yeu cau chinh sua =====
select t.as_user(:'U4');   -- member, gan voi Bo, nhanh A dang khoa
select t.ok(t.cnt('select 1 from public.member_change_requests') = 0, 'chua co yeu cau');
insert into t.ids select 'cr1', public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('grandma'), '{"hometown":"Da Nang"}'::jsonb, 'Sua que quan');
insert into t.ids select 'cr2', public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('bkid'), '{"bio":"x"}'::jsonb);
insert into t.ids select 'cr3', public.submit_change_request(current_setting('t.fid')::uuid, 'create_member', null, jsonb_build_object('full_name','Em be moi','branch_id',:'BA'));
insert into t.ids select 'cr4', public.submit_change_request(current_setting('t.fid')::uuid, 'add_parent', null, jsonb_build_object('child_id', t.id('grandpa'), 'parent_id', t.id('kid'), 'kind','biological'));
insert into t.ids select 'cr5', public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('a1'), jsonb_build_object('branch_id', :'BB'));
select t.ok(t.cnt('select 1 from public.member_change_requests') = 5, 'member: thay yeu cau cua minh');
select t.ok((select hometown from public.members_view where id = t.id('grandma')) is null, 'gui yeu cau chua doi du lieu');
select t.fails($$select public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('f2m'), '{}'::jsonb)$$, 'khong gui yeu cau cho ho so gia dinh khac');
select t.fails($$select public.submit_change_request(current_setting('t.fid')::uuid, 'xoa_het', null, '{}'::jsonb)$$, 'loai yeu cau khong hop le bi tu choi');
select t.fails($$select public.review_change_request(t.id('cr1'), true)$$, 'member: khong duyet duoc yeu cau');
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.member_change_requests') = 0, 'guest: khong thay yeu cau cua nguoi khac');
select t.fails($$select public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('dad'), '{"bio":"x"}'::jsonb)$$, 'guest: khong gui duoc yeu cau');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.member_change_requests') = 4, 'branch_admin: chi thay yeu cau thuoc nhanh minh (khong thay yeu cau nhanh B)');
select t.fails($$select public.review_change_request(t.id('cr2'), true)$$, 'branch_admin: khong duyet yeu cau nhanh khac');
select t.fails($$select public.review_change_request(t.id('cr5'), true)$$, 'branch_admin: khong duyet yeu cau chuyen thanh vien ra ngoai pham vi');
select t.fails($$select public.review_change_request(t.id('cr4'), true)$$, 'duyet that bai khi tao vong lap cha-con');
select t.ok((select status from public.member_change_requests where id = t.id('cr4')) = 'pending', 'duyet loi: yeu cau van cho duyet (giao dich cuon lai)');
select public.review_change_request(t.id('cr1'), true, 'OK');
select t.ok((select hometown from public.members_view where id = t.id('grandma')) = 'Da Nang', 'duyet yeu cau: du lieu duoc ap dung');
select t.ok((select status from public.member_change_requests where id = t.id('cr1')) = 'approved', 'trang thai approved');
select t.fails($$select public.review_change_request(t.id('cr1'), true)$$, 'khong duyet lai yeu cau da xu ly');
select public.review_change_request(t.id('cr3'), true);
select t.ok(t.cnt('select 1 from public.members_view where full_name = ''Em be moi''') = 1, 'duyet yeu cau tao ho so: ho so duoc tao');
select public.review_change_request(t.id('cr4'), false, 'Khong hop ly');
select t.ok((select status from public.member_change_requests where id = t.id('cr4')) = 'rejected', 'tu choi yeu cau');
select t.ok(t.cnt('select 1 from public.member_parent_links_v where child_id = ''' || t.id('grandpa') || '''') = 0, 'tu choi: khong ap dung thay doi');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.member_change_requests') = 5, 'family_admin: thay moi yeu cau');
select public.review_change_request(t.id('cr2'), true);
select t.ok((select bio from public.members_view where id = t.id('bkid')) = 'x', 'family_admin: duyet yeu cau nhanh B');
select public.review_change_request(t.id('cr5'), false);
select t.as_user(:'U4');
insert into t.ids select 'cr6', public.submit_change_request(current_setting('t.fid')::uuid, 'update_member', t.id('grandma'), '{"bio":"y"}'::jsonb);
select t.as_user(:'U5');
select t.fails($$select public.cancel_change_request(t.id('cr6'))$$, 'khong huy yeu cau cua nguoi khac');
select t.as_user(:'U4');
select public.cancel_change_request(t.id('cr6'));
select t.ok((select status from public.member_change_requests where id = t.id('cr6')) = 'cancelled', 'chu yeu cau huy duoc');
select t.as_user(:'U2');
select t.fails($$select public.review_change_request(t.id('cr6'), true)$$, 'khong duyet yeu cau da huy');
-- Yeu cau xoa / go lien ket
select t.as_user(:'U4');
insert into t.ids select 'cr7', public.submit_change_request(current_setting('t.fid')::uuid, 'remove_link', null,
  jsonb_build_object('link_id', (select id from public.member_parent_links_v where child_id = t.id('kid') and parent_id = t.id('mom'))));
insert into t.ids select 'cr8', public.submit_change_request(current_setting('t.fid')::uuid, 'delete_member', t.id('a1'), '{}'::jsonb);
select t.as_user(:'U2');
select public.review_change_request(t.id('cr7'), true);
select t.ok(t.cnt('select 1 from public.member_parent_links_v where child_id = ''' || t.id('kid') || '''') = 1, 'yeu cau go lien ket duoc ap dung');
select public.review_change_request(t.id('cr8'), true);
select t.ok(t.cnt('select 1 from public.members_view where id = ''' || t.id('a1') || '''') = 0, 'yeu cau xoa ho so duoc ap dung (xoa mem)');
select t.as_user(:'U4');
insert into t.ids select 'cr9', public.submit_change_request(current_setting('t.fid')::uuid, 'delete_member', t.id('dad'), '{}'::jsonb);
select t.as_user(:'U2');
select t.fails($$select public.review_change_request(t.id('cr9'), true)$$, 'khong duyet xoa ho so dang gan tai khoan');

-- ===== 10. Thong bao =====
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.notifications where kind = ''change_request''') >= 5, 'family_admin: nhan thong bao khi co yeu cau moi');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.notifications') = 0, 'member: khong nhan thong bao yeu cau cua minh');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.notifications where kind = ''change_request''') = 8, 'branch_admin: nhan thong bao cac yeu cau thuoc nhanh minh (8/9)');
select t.ok(t.cnt('select 1 from public.notifications where dedupe_key like ''cr:' || t.id('cr2') || '%''') = 0, 'branch_admin: khong nhan thong bao yeu cau nhanh B');
select t.ok(public.mark_notifications_read(null) = 8, 'danh dau da doc tat ca thong bao cua minh');
select t.ok(t.cnt('select 1 from public.notifications where read_at is null') = 0, 'khong con thong bao chua doc');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.notifications where read_at is null') >= 5, 'danh dau da doc chi anh huong thong bao cua chinh minh');
select t.as_root();
select public._notify(current_setting('t.fid')::uuid, :'U4', 'system', 'Xin chao', null, '/', 'k1');
select t.ok(public._notify(current_setting('t.fid')::uuid, :'U4', 'system', 'Xin chao', null, '/', 'k1') is null, 'chong trung: gui lai cung dedupe_key bi bo qua');
select t.ok((select count(*) from public.notifications where user_id = :'U4' and dedupe_key = 'k1') = 1, 'chong trung: chi mot thong bao');
select t.ok(public._notify(current_setting('t.fid')::uuid, :'U6', 'system', 'x', null, null, null) is null, 'khong gui thong bao cho nguoi ngoai gia dinh');
select t.ok(public._notify(current_setting('t.fid')::uuid, :'U7', 'system', 'x', null, null, null) is null, 'khong gui thong bao cho tai khoan bi thu hoi');
select t.fails($$select public._notify(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 'system', 'x', null, 'https://evil.example/', null)$$, 'thong bao chi cho phep lien ket noi bo');
select t.fails($$select public._notify(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 'system', 'x', null, '//evil.example/', null)$$, 'thong bao chan lien ket //');
select t.as_user(:'U4');
select public.save_notification_preferences(current_setting('t.fid')::uuid, true, '{0,3}'::smallint[], true, true, true, false, true);
select t.as_root();
select t.ok(public._notify(current_setting('t.fid')::uuid, :'U4', 'gift', 'Li xi', null, null, 'g1') is null, 'tuy chon tat thong bao li xi duoc ton trong');
select t.ok(public._notify(current_setting('t.fid')::uuid, :'U4', 'card', 'Thiep', null, null, 'c1') is not null, 'thong bao thiep van gui khi bat');
select t.as_user(:'U4');
select t.fails($$select public.save_notification_preferences(current_setting('t.fid')::uuid, true, '{4}'::smallint[], true, true, true, true, true)$$, 'so ngay nhac khong hop le bi tu choi');
select t.as_user(:'U6');
select t.fails($$select public.save_notification_preferences(current_setting('t.fid')::uuid, true, '{0}'::smallint[], true, true, true, true, true)$$, 'nguoi ngoai khong luu duoc tuy chon');

-- ===== 11. Mui gio / quoc gia =====
select t.as_user(:'U4');
update public.user_profiles set country_code = 'JP', timezone = 'Asia/Tokyo' where id = :'U4';
select t.ok((select timezone from public.user_profiles where id = :'U4') = 'Asia/Tokyo', 'chon quoc gia/mui gio cho tai khoan cua minh');
select t.fails($$update public.user_profiles set timezone = 'Mars/Olympus' where id = '00000000-0000-0000-0000-000000000004'$$, 'mui gio khong ton tai bi tu choi');
select t.fails($$update public.user_profiles set country_code = 'jp' where id = '00000000-0000-0000-0000-000000000004'$$, 'ma quoc gia sai dinh dang bi tu choi');
update public.user_profiles set timezone = 'Europe/Berlin' where id = :'U2';
select t.ok((select timezone from public.user_profiles where id = :'U2') <> 'Europe/Berlin', 'khong sua duoc mui gio cua nguoi khac');

-- ===== 12. Xuat / nhap =====
select t.as_user(:'U4');
select t.fails($$select public.export_family_tree(current_setting('t.fid')::uuid)$$, 'member: khong xuat duoc gia pha');
select t.as_user(:'U2');
select public.export_family_tree(current_setting('t.fid')::uuid) as dump \gset
select t.ok((:'dump'::jsonb)->'members' is not null and jsonb_array_length((:'dump'::jsonb)->'members') >= 8, 'xuat: co danh sach thanh vien');
select t.ok(not ((:'dump'::jsonb)->'members'->0 ? 'family_id') and not ((:'dump'::jsonb)->'members'->0 ? 'branch_id'), 'xuat: khong lo family_id/branch_id noi bo');
select t.ok((:'dump'::jsonb)->'members'->0 ? 'branch', 'xuat: giu ten nhanh');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'tree.export') = 1, 'xuat gia pha duoc ghi nhat ky');
select t.as_user(:'U8');
select public.import_family_tree(current_setting('t.fid2')::uuid, :'dump'::jsonb) as imp \gset
select t.ok((select count(*) from public.members_view where family_id = current_setting('t.fid2')::uuid) = 1 + jsonb_array_length((:'dump'::jsonb)->'members'), 'nhap: tao dung so thanh vien (cong 1 ho so co san)');
select t.ok((select count(*) from public.member_parent_links_v where family_id = current_setting('t.fid2')::uuid) = jsonb_array_length((:'dump'::jsonb)->'parents'), 'nhap: tao dung so quan he cha-con');
select t.ok((select count(*) from public.member_partnerships_v where family_id = current_setting('t.fid2')::uuid) = jsonb_array_length((:'dump'::jsonb)->'partners'), 'nhap: tao dung so quan he vo chong');
select t.fails($$select public.import_family_tree(current_setting('t.fid2')::uuid, '{"members":[{"id":"a","full_name":"A"}],"parents":[{"child":"a","parent":"khong-co"}]}'::jsonb)$$, 'nhap: tham chieu khong hop le bi tu choi');
select t.fails($$select public.import_family_tree(current_setting('t.fid2')::uuid, '{"members":[{"id":"a","full_name":"A"},{"id":"b","full_name":"B"}],"parents":[{"child":"a","parent":"b"},{"child":"b","parent":"a"}]}'::jsonb)$$, 'nhap: chan vong lap trong tep nhap');
select t.ok((select count(*) from public.members_view where family_id = current_setting('t.fid2')::uuid) = 1 + jsonb_array_length((:'dump'::jsonb)->'members'), 'nhap loi: khong de lai du lieu do dang');
select t.fails($$select public.import_family_tree(current_setting('t.fid2')::uuid, '{"members":[{"full_name":"khong id"}]}'::jsonb)$$, 'nhap: moi thanh vien can id');
select t.fails($$select public.import_family_tree(current_setting('t.fid2')::uuid, '{"members":"khong phai mang"}'::jsonb)$$, 'nhap: members phai la mang');
select t.fails($$select public.import_family_tree(current_setting('t.fid')::uuid, '{"members":[]}'::jsonb)$$, 'nhap vao gia dinh khac bi tu choi');

-- ===== 13. Nhat ky khong bi sua =====
select t.as_user(:'U1');
select t.fails($$update public.audit_logs set action = 'x'$$, 'nhat ky khong sua duoc');
select t.fails($$delete from public.audit_logs$$, 'nhat ky khong xoa duoc');

-- ===== Tong ket =====
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
