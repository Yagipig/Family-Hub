-- Kiem thu RLS + nghiep vu Module C: thiep, hen gio, li xi (chi ghi nhan), thong tin nhan tien rieng tu.
-- Chay boi run_rls_tests.sh (can rls_helpers.sql nap truoc). Du lieu mau CHI nam trong CSDL kiem thu.
\set ON_ERROR_STOP on
\ir rls_fixture.sql

create table t.ids(k text primary key, v uuid);
grant select, insert on t.ids to public;
create function t.id(k text) returns uuid language sql stable as $$ select v from t.ids where t.ids.k = $1 $$;
create function t.cnt(sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || sql || ') q' into n; return n; end $$;
create function t.u(n int) returns uuid language sql immutable as
  $$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.fam() returns uuid language sql stable as $$ select current_setting('t.fid')::uuid $$;
grant execute on all functions in schema t to public;

\set U1 '00000000-0000-0000-0000-000000000001'
\set U2 '00000000-0000-0000-0000-000000000002'
\set U3 '00000000-0000-0000-0000-000000000003'
\set U4 '00000000-0000-0000-0000-000000000004'
\set U5 '00000000-0000-0000-0000-000000000005'
\set U6 '00000000-0000-0000-0000-000000000006'
\set U7 '00000000-0000-0000-0000-000000000007'
\set U8 '00000000-0000-0000-0000-000000000008'
\set U9 '00000000-0000-0000-0000-000000000009'
\set U10 '00000000-0000-0000-0000-000000000010'
\set U11 '00000000-0000-0000-0000-000000000011'
\set BA 'b0000000-0000-0000-0000-00000000000a'
\set BB 'b0000000-0000-0000-0000-00000000000b'

-- Them hai thanh vien nhanh B (009, 010) va mot thanh vien khong nhanh (011)
select t.as_root();
insert into auth.users (id, email) values (t.u(9), 'b1@test.local'), (t.u(10), 'b2@test.local'), (t.u(11), 'nb@test.local');
insert into public.user_profiles (id, display_name, timezone, country_code) values
  (t.u(9), 'ThanhVienB1', 'Asia/Tokyo', 'JP'), (t.u(10), 'ThanhVienB2', 'America/Los_Angeles', 'US'), (t.u(11), 'KhongNhanh', 'Asia/Ho_Chi_Minh', 'VN');
insert into public.family_memberships (user_id, family_id, role_key, branch_id) values
  (t.u(9), t.fam(), 'member', :'BB'), (t.u(10), t.fam(), 'member', :'BB'), (t.u(11), t.fam(), 'member', null);

-- ===== 0. Mau thiep =====
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.card_templates') >= 8, 'mau thiep: co it nhat 8 mau');
select t.ok((select count(distinct effect) from public.card_templates) = 4, 'mau thiep: du 4 hieu ung (phong bi, hoa, phao giay, den long)');
select t.ok((select count(distinct occasion) from public.card_templates) >= 5, 'mau thiep: nhieu dip khac nhau');
select t.fails($$insert into public.card_templates (key, name_vi, occasion, effect, motif, palette) values ('hack-mau','x','tet','petals','mai','{"bg":"1","bg2":"1","text":"1","accent":"1","particle":"1"}')$$, 'mau thiep: nguoi dung khong them mau truc tiep');
select t.fails($$update public.card_templates set name_vi = 'x'$$, 'mau thiep: khong sua truc tiep');
select t.as_anon();
select t.fails($$select * from public.card_templates$$, 'mau thiep: anon khong doc duoc');
select t.as_root();
select t.fails($$insert into public.card_templates (key, name_vi, occasion, effect, motif, palette) values ('palette-thieu','x','tet','petals','mai','{"bg":"1"}')$$, 'mau thiep: palette thieu khoa bi tu choi');

-- ===== 1. Quyen gui thiep =====
select t.as_user(:'U6');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(3)], null, null)$$, 'nguoi ngoai: khong gui duoc thiep');
select t.fails($$select * from public.list_card_audience(t.fam())$$, 'nguoi ngoai: khong xem duoc danh sach nguoi nhan');
select t.ok(t.cnt('select 1 from public.cards') = 0 and t.cnt('select 1 from public.card_recipients') = 0 and t.cnt('select 1 from public.gifts') = 0, 'nguoi ngoai: khong thay thiep/nguoi nhan/li xi');
select t.as_user(:'U7');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(3)], null, null)$$, 'tai khoan thu hoi: khong gui duoc thiep');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 1000, 'VND')$$, 'tai khoan thu hoi: khong hen duoc li xi');
select t.as_user(:'U5');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(3)], null, null)$$, 'khach (guest): khong co quyen gui thiep');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 1000, 'VND')$$, 'khach (guest): khong co quyen hen li xi');
select t.as_anon();
select t.fails($$select public.send_card('00000000-0000-0000-0000-000000000000', 'tet-hoa-mai', null, 'hi', 'users', array[]::uuid[], null, null)$$, 'anon: khong goi duoc send_card');
select t.fails($$select public.mark_card_opened(gen_random_uuid())$$, 'anon: khong goi duoc mark_card_opened');
select t.fails($$select * from public.cards$$, 'anon: khong doc duoc bang cards');

-- Danh sach nguoi nhan chon duoc
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.list_card_audience(t.fam())') = 6, 'danh sach nguoi nhan: 6 nguoi (khong gom chinh minh, thu hoi, nguoi ngoai, khach guest)');
select t.ok(not exists (select 1 from public.list_card_audience(t.fam()) where user_id in (t.u(4), t.u(5), t.u(6), t.u(7))), 'danh sach nguoi nhan: khong co chinh minh/khach/nguoi ngoai/tai khoan thu hoi');

-- Ham cards_can cho giao dien: chi tra loi ve quyen cua chinh nguoi goi
select t.as_user(:'U4');
select t.ok(public.cards_can(t.fam(), 'cards', 'create') and public.cards_can(t.fam(), 'gifts', 'create'), 'cards_can: member duoc gui thiep va li xi');
select t.ok(not public.cards_can(t.fam(), 'cards', 'delete') and not public.cards_can(t.fam(), 'members', 'view'), 'cards_can: khong tra loi cho quyen khong thuoc module thiep/li xi hoac quyen khong co');
select t.as_user(:'U3');
select t.ok(public.cards_can(t.fam(), 'cards', 'create'), 'cards_can: branch_admin duoc gui thiep (khong phu thuoc nhanh)');
select t.as_user(:'U5');
select t.ok(not public.cards_can(t.fam(), 'cards', 'create'), 'cards_can: guest khong duoc gui thiep');
select t.as_user(:'U6');
select t.ok(not public.cards_can(t.fam(), 'cards', 'create'), 'cards_can: nguoi ngoai khong duoc');
select t.as_user(:'U7');
select t.ok(not public.cards_can(t.fam(), 'cards', 'create'), 'cards_can: tai khoan thu hoi khong duoc');
select t.as_anon();
select t.fails($$select public.cards_can(t.fam(), 'cards', 'create')$$, 'cards_can: anon khong goi duoc');

-- ===== 2. Gui ngay, rieng tu, thong bao =====
select t.as_user(:'U4');
insert into t.ids select 'c_now', public.send_card(t.fam(), 'tet-hoa-mai', 'Chuc Tet', 'Chuc ong ba nam moi an khang', 'users', array[t.u(3), t.u(9)], null, null);
select t.ok((select delivered_at is not null from public.cards where id = t.id('c_now')), 'gui ngay: danh dau da giao');
select t.ok(t.cnt('select 1 from public.card_recipients where card_id = t.id(''c_now'')') = 2, 'gui ngay: nguoi gui thay 2 dong nguoi nhan');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_now'')') = 1, 'gui ngay: nguoi nhan thay thiep');
select t.ok(t.cnt('select 1 from public.card_recipients where card_id = t.id(''c_now'')') = 1, 'gui ngay: nguoi nhan chi thay dong cua chinh minh');
select t.ok((select user_id from public.card_recipients where card_id = t.id('c_now')) = t.u(3), 'gui ngay: dong thay duoc la cua chinh minh');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.cards') = 0, 'rieng tu: family_admin KHONG doc duoc thiep cua nguoi khac');
select t.ok(t.cnt('select 1 from public.card_recipients') = 0, 'rieng tu: family_admin khong thay nguoi nhan');
select t.as_user(:'U1');
select t.ok(t.cnt('select 1 from public.cards') = 0, 'rieng tu: super_admin cung khong doc duoc thiep cua nguoi khac');
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.cards') = 0, 'rieng tu: thanh vien khac khong thay thiep');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.cards') = 0, 'rieng tu: thanh vien khong phai nguoi nhan khong thay thiep');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'card' and user_id = t.u(3) and link = '/thiep/' || t.id('c_now')::text$$) = 1, 'thong bao: nguoi nhan co thong bao kind=card tro dung /thiep/<id>');
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'card' and user_id = t.u(4)$$) = 0, 'thong bao: nguoi gui khong tu nhan thong bao');
select t.ok((select body is null from public.notifications where kind = 'card' and user_id = t.u(3)), 'thong bao: khong lo noi dung loi chuc');
select t.ok(not exists (select 1 from public.notifications where title like '%an khang%'), 'thong bao: tieu de khong chua loi chuc');

-- Ghi truc tiep bi tu choi
select t.as_user(:'U4');
select t.fails($$insert into public.cards (family_id, sender_id, template_key, message, audience_kind) values (t.fam(), t.u(4), 'tet-hoa-mai', 'x', 'family')$$, 'ghi truc tiep: khong them duoc vao cards');
select t.fails($$update public.cards set message = 'sua lau' where id = t.id('c_now')$$, 'ghi truc tiep: khong sua duoc cards');
select t.fails($$delete from public.cards where id = t.id('c_now')$$, 'ghi truc tiep: khong xoa duoc cards');
select t.fails($$insert into public.card_recipients (card_id, user_id) values (t.id('c_now'), t.u(5))$$, 'ghi truc tiep: khong them nguoi nhan');
select t.fails($$update public.card_recipients set status = 'opened', opened_at = now() where card_id = t.id('c_now')$$, 'ghi truc tiep: khong tu danh dau da mo');
select t.fails($$insert into public.gifts (family_id, sender_id, recipient_id) values (t.fam(), t.u(4), t.u(3))$$, 'ghi truc tiep: khong them duoc li xi');
-- Ham noi bo / job khong goi duoc bang authenticated
select t.fails($$select public._deliver_card(t.id('c_now'))$$, 'ham noi bo: _deliver_card bi chan');
select t.fails($$select public._notify_card_recipient(t.id('c_now'), t.u(3))$$, 'ham noi bo: _notify_card_recipient bi chan');
select t.fails($$select public._create_gift(t.fam(), t.u(4), t.u(3), 100, 'VND', null, null)$$, 'ham noi bo: _create_gift bi chan');
select t.fails($$select public._resolve_card_audience(t.fam(), t.u(4), 'family', null, null)$$, 'ham noi bo: _resolve_card_audience bi chan');
select t.fails($$select public._cards_can(t.fam(), 'cards', 'create')$$, 'ham noi bo: _cards_can bi chan');
select t.fails($$select public.deliver_due_cards()$$, 'job: authenticated khong goi duoc deliver_due_cards');
select t.as_anon();
select t.fails($$select public.deliver_due_cards()$$, 'job: anon khong goi duoc deliver_due_cards');

-- ===== 3. Mo thiep =====
select t.as_user(:'U3');
select t.ok(public.mark_card_opened(t.id('c_now')) = true, 'mo thiep: nguoi nhan danh dau da mo lan dau');
select t.ok((select status = 'opened' and opened_at is not null from public.card_recipients where card_id = t.id('c_now')), 'mo thiep: status=opened, co opened_at');
select opened_at as first_open from public.card_recipients where card_id = t.id('c_now') \gset
select t.ok(public.mark_card_opened(t.id('c_now')) = false, 'mo thiep: goi lai khong doi gi (idempotent)');
select t.ok((select opened_at = :'first_open'::timestamptz from public.card_recipients where card_id = t.id('c_now')), 'mo thiep: opened_at khong bi ghi de');
select t.as_root();
select t.ok((select read_at is not null from public.notifications where kind = 'card' and user_id = t.u(3)), 'mo thiep: thong bao tuong ung duoc danh dau da doc');
select t.as_user(:'U4');
select t.ok((select status from public.card_recipients where card_id = t.id('c_now') and user_id = t.u(3)) = 'opened', 'mo thiep: nguoi gui thay nguoi nhan da mo');
select t.ok((select status from public.card_recipients where card_id = t.id('c_now') and user_id = t.u(9)) = 'unseen', 'mo thiep: nguoi chua mo van la unseen');
select t.ok(public.mark_card_opened(t.id('c_now')) = false, 'mo thiep: nguoi gui goi khong tac dung');
select t.as_user(:'U2');
select t.ok(public.mark_card_opened(t.id('c_now')) = false, 'mo thiep: nguoi khong phai nguoi nhan khong tac dung');
select t.as_root();
select t.ok((select status from public.card_recipients where card_id = t.id('c_now') and user_id = t.u(9)) = 'unseen', 'mo thiep: khong ai danh dau ho nguoi khac');

-- ===== 4. Kiem tra du lieu thiep =====
select t.as_user(:'U4');
select t.fails($$select public.send_card(t.fam(), 'khong-co-mau', null, 'hi', 'users', array[t.u(3)], null, null)$$, 'du lieu: mau khong ton tai bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, '', 'users', array[t.u(3)], null, null)$$, 'du lieu: loi chuc rong bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, '    ', 'users', array[t.u(3)], null, null)$$, 'du lieu: loi chuc chi khoang trang bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, repeat('a', 2001), 'users', array[t.u(3)], null, null)$$, 'du lieu: loi chuc 2001 ky tu bi tu choi');
select t.ok(public.send_card(t.fam(), 'tet-hoa-mai', null, repeat('a', 2000), 'users', array[t.u(3)], null, null) is not null, 'du lieu: loi chuc 2000 ky tu hop le');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', repeat('t', 121), 'hi', 'users', array[t.u(3)], null, null)$$, 'du lieu: tieu de 121 ky tu bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'bad', array[t.u(3)], null, null)$$, 'du lieu: kieu nguoi nhan sai bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(6)], null, null)$$, 'nguoi nhan: nguoi ngoai gia dinh bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(7)], null, null)$$, 'nguoi nhan: tai khoan da thu hoi bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(5)], null, null)$$, 'nguoi nhan: khach (guest) khong co quyen xem thiep nen khong la nguoi nhan');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(4)], null, null)$$, 'nguoi nhan: chi gui cho chinh minh bi tu choi (khong co nguoi nhan)');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[]::uuid[], null, null)$$, 'nguoi nhan: danh sach rong bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', null, null, null)$$, 'nguoi nhan: danh sach null bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'branch', null, null, null)$$, 'nguoi nhan: chon nhanh ma khong co nhanh bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(3), t.u(6)], null, null)$$, 'nguoi nhan: lo mot nguoi la thi ca thiep bi tu choi');
select t.ok(t.cnt('select 1 from public.cards where sender_id = t.u(4)') = 2, 'nguoi nhan: cac thiep loi khong de lai du lieu do dang (chi con 2 thiep hop le)');
insert into t.ids select 'c_dup', public.send_card(t.fam(), 'tet-hoa-mai', null, 'trung', 'users', array[t.u(3), t.u(3), t.u(9), t.u(4)], null, null);
select t.ok(t.cnt('select 1 from public.card_recipients where card_id = t.id(''c_dup'')') = 2, 'nguoi nhan: id trung/chinh minh duoc loai, con 2 nguoi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(3)], null, now() + interval '400 days')$$, 'hen gio: qua 366 ngay bi tu choi');

-- ===== 5. Nhom nhan: nhanh / ca gia dinh =====
select t.as_user(:'U2');   -- family_admin: khong thuoc nhanh nao
insert into t.ids select 'c_famall', public.send_card(t.fam(), 'chuc-mung-rang-ro', 'Chuc mung', 'Chuc ca nha', 'family', null, null, null);
select t.ok(t.cnt('select 1 from public.card_recipients where card_id = t.id(''c_famall'')') = 6, 'nhom nhan: ca gia dinh = 6 nguoi (khong gom nguoi gui, khach guest)');
select t.ok(not exists (select 1 from public.card_recipients where card_id = t.id('c_famall') and user_id in (t.u(2), t.u(5), t.u(7))), 'nhom nhan: khong gom nguoi gui, khach guest va tai khoan thu hoi');
insert into t.ids select 'c_brB', public.send_card(t.fam(), 'cuoi-hoa-hong', null, 'Chuc nhanh B', 'branch', null, :'BB', null);
select t.ok(t.cnt('select 1 from public.card_recipients where card_id = t.id(''c_brB'')') = 2, 'nhom nhan: nhanh B co 2 nguoi (009, 010)');
select t.as_user(:'U4');
insert into t.ids select 'c_brA', public.send_card(t.fam(), 'cuoi-hoa-hong', null, 'Chuc nhanh A', 'branch', null, :'BA', null);
select t.ok((select array_agg(user_id order by user_id) from public.card_recipients where card_id = t.id('c_brA')) = array[t.u(3)], 'nhom nhan: nhanh A tru nguoi gui (004) chi con 003');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'branch', null, 'b0000000-0000-0000-0000-0000000000a1', null)$$, 'nhom nhan: nhanh con rong => khong co nguoi nhan, bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'branch', null, gen_random_uuid(), null)$$, 'nhom nhan: nhanh khong ton tai bi tu choi');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_brB'')') = 1 and t.cnt('select 1 from public.cards where id = t.id(''c_brA'')') = 0, 'nhom nhan: thanh vien nhanh B thay thiep gui nhanh B, khong thay thiep nhanh A');
select t.as_user(:'U3');   -- branch_admin van gui duoc thiep (quyen khong theo pham vi nhanh)
select t.ok(public.send_card(t.fam(), 'sinh-nhat-banh-kem', null, 'Chuc mung sinh nhat', 'users', array[t.u(4)], null, null) is not null, 'quyen: branch_admin gui duoc thiep (cards.create khong theo nhanh)');

-- ===== 6. Hen gio: giao luoi =====
select t.as_user(:'U4');
insert into t.ids select 'c_sched', public.send_card(t.fam(), 'tet-den-long', 'Chuc Tet hen gio', 'Noi dung hen gio', 'users', array[t.u(3), t.u(9)], null, now() + interval '2 days');
select t.ok((select delivered_at is null from public.cards where id = t.id('c_sched')), 'hen gio: chua giao (delivered_at null)');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_sched'')') = 1, 'hen gio: nguoi gui van xem duoc');
select t.ok(t.cnt('select 1 from public.card_recipients where card_id = t.id(''c_sched'')') = 2, 'hen gio: nguoi gui xem duoc nguoi nhan');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_sched'')') = 0, 'hen gio: nguoi nhan KHONG thay thiep chua toi gio');
select t.ok(t.cnt('select 1 from public.card_recipients where card_id = t.id(''c_sched'')') = 0, 'hen gio: nguoi nhan khong thay ca dong nguoi nhan');
select t.ok(public.mark_card_opened(t.id('c_sched')) = false, 'hen gio: nguoi nhan khong mo duoc thiep chua toi gio');
select t.ok(public.deliver_my_due_cards() = 0, 'hen gio: deliver_my_due_cards khong tao thong bao cho thiep chua toi gio');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where user_id = t.u(3) and link = '/thiep/' || t.id('c_sched')::text$$) = 0, 'hen gio: chua co thong bao');
select t.as_service();
select t.ok(public.deliver_due_cards() >= 0 and t.cnt($$select 1 from public.notifications where link = '/thiep/' || t.id('c_sched')::text$$) = 0, 'hen gio: job chua giao thiep chua toi gio');
select t.ok(public.deliver_due_cards(now() + interval '10 days') >= 0 and t.cnt($$select 1 from public.notifications where link = '/thiep/' || t.id('c_sched')::text$$) = 0, 'hen gio: p_now o tuong lai bi chan tren boi now() (khong bao thiep chua hien)');
select t.as_user(:'U4');
-- Sua: chi nguoi gui, doi noi dung/gio/nguoi nhan
select t.as_user(:'U3');
select t.fails($$select public.update_card(t.id('c_sched'), 'tet-hoa-mai', null, 'sua trom', 'users', array[t.u(3)], null, now() + interval '2 days')$$, 'sua: nguoi nhan khong sua duoc thiep cua nguoi khac');
select t.fails($$select public.cancel_card(t.id('c_sched'))$$, 'huy: nguoi nhan khong huy duoc thiep cua nguoi khac');
select t.as_user(:'U2');
select t.fails($$select public.update_card(t.id('c_sched'), 'tet-hoa-mai', null, 'sua trom', 'users', array[t.u(3)], null, now() + interval '2 days')$$, 'sua: family_admin khong sua duoc thiep cua nguoi khac');
select t.fails($$select public.cancel_card(t.id('c_sched'))$$, 'huy: family_admin khong huy duoc thiep cua nguoi khac');
select t.as_user(:'U4');
select public.update_card(t.id('c_sched'), 'cuoi-hoa-hong', 'Tieu de moi', 'Loi chuc da sua', 'users', array[t.u(3), t.u(10)], null, now() + interval '3 days');
select t.ok((select message = 'Loi chuc da sua' and template_key = 'cuoi-hoa-hong' and title = 'Tieu de moi' from public.cards where id = t.id('c_sched')), 'sua: noi dung/mau/tieu de da doi');
select t.ok((select array_agg(user_id order by user_id) from public.card_recipients where card_id = t.id('c_sched')) = array[t.u(3), t.u(10)], 'sua: doi nguoi nhan (bo 009, them 010)');
select t.ok((select scheduled_at > now() + interval '2 days 12 hours' from public.cards where id = t.id('c_sched')), 'sua: doi gio hen');
select t.fails($$select public.update_card(t.id('c_sched'), 'tet-hoa-mai', null, '', 'users', array[t.u(3)], null, null)$$, 'sua: loi chuc rong bi tu choi');
select t.fails($$select public.update_card(t.id('c_sched'), 'tet-hoa-mai', null, 'x', 'users', array[t.u(6)], null, null)$$, 'sua: nguoi nhan la nguoi ngoai bi tu choi');
select t.ok((select message = 'Loi chuc da sua' and (select count(*) from public.card_recipients where card_id = t.id('c_sched')) = 2 from public.cards where id = t.id('c_sched')), 'sua: lan sua loi khong lam hong du lieu cu');
-- Toi gio (gia lap bang cach lui scheduled_at)
select t.as_root();
update public.cards set scheduled_at = now() - interval '1 minute' where id = t.id('c_sched');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_sched'')') = 1, 'toi gio: nguoi nhan thay thiep ngay (RLS, khong can cron)');
select t.ok(t.cnt($$select 1 from public.notifications where link = '/thiep/' || t.id('c_sched')::text$$) = 0, 'toi gio: nhung chua co thong bao (giao luoi)');
select t.ok(public.deliver_my_due_cards() >= 1, 'toi gio: deliver_my_due_cards tao thong bao con thieu cho chinh minh');
select t.ok(t.cnt($$select 1 from public.notifications where link = '/thiep/' || t.id('c_sched')::text$$) = 1, 'toi gio: nguoi dung co 1 thong bao');
select t.ok(public.deliver_my_due_cards() = 0, 'toi gio: goi lai khong tao them (idempotent)');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_sched'')') = 1, 'toi gio: nguoi nhan moi cung thay thiep');
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_sched'')') = 0, 'sua: nguoi nhan cu bi bo (009) khong thay thiep');
select t.as_service();
select t.ok(public.deliver_due_cards() >= 1, 'job: giao cac thiep da toi gio');
select t.as_root();
select t.ok((select delivered_at is not null from public.cards where id = t.id('c_sched')), 'job: danh dau delivered_at');
select t.ok(t.cnt($$select 1 from public.notifications where user_id = t.u(3) and link = '/thiep/' || t.id('c_sched')::text$$) = 1, 'job: khong trung thong bao da tao lazy (dedupe)');
select t.ok(t.cnt($$select 1 from public.notifications where user_id = t.u(10) and link = '/thiep/' || t.id('c_sched')::text$$) = 1, 'job: nguoi nhan con lai duoc thong bao');
select t.as_service();
select t.ok(public.deliver_due_cards() = 0, 'job: chay lai khong giao them');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where link = '/thiep/' || t.id('c_sched')::text$$) = 2, 'job: tong 2 thong bao (khong trung)');
select t.as_user(:'U4');
select t.fails($$select public.update_card(t.id('c_sched'), 'tet-hoa-mai', null, 'qua muon', 'users', array[t.u(3)], null, null)$$, 'sua: thiep da toi gio khong sua duoc');

-- Huy thiep chua toi gio
select t.as_user(:'U4');
insert into t.ids select 'c_cancel', public.send_card(t.fam(), 'tet-hoa-mai', null, 'se huy', 'users', array[t.u(3)], null, now() + interval '1 day');
select public.cancel_card(t.id('c_cancel'));
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_cancel'')') = 0, 'huy: nguoi gui khong con thay thiep da huy');
select t.as_root();
select t.ok((select deleted_at is not null from public.cards where id = t.id('c_cancel')), 'huy: thiep bi xoa mem (deleted_at)');
select t.as_user(:'U4');
select t.fails($$select public.cancel_card(t.id('c_cancel'))$$, 'huy: huy lan hai bi tu choi');
select t.fails($$select public.update_card(t.id('c_cancel'), 'tet-hoa-mai', null, 'x', 'users', array[t.u(3)], null, null)$$, 'huy: thiep da huy khong sua duoc');
select t.as_root();
update public.cards set scheduled_at = now() - interval '1 minute' where id = t.id('c_cancel');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_cancel'')') = 0, 'huy: dau toi gio nguoi nhan van khong thay thiep da huy');
select t.ok(public.mark_card_opened(t.id('c_cancel')) = false, 'huy: khong mo duoc thiep da huy');
select t.as_service();
select public.deliver_due_cards();
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where link = '/thiep/' || t.id('c_cancel')::text$$) = 0, 'huy: thiep da huy khong tao thong bao');

-- Nguoi nhan bi thu hoi quyen
select t.as_user(:'U4');
insert into t.ids select 'c_rev', public.send_card(t.fam(), 'tet-hoa-mai', null, 'cho 010', 'users', array[t.u(10)], null, null);
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.cards where id = t.id(''c_rev'')') = 1, 'thu hoi: truoc khi thu hoi thay thiep');
select t.as_root();
update public.family_memberships set status = 'revoked', revoked_at = now() where user_id = t.u(10);
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.cards') = 0 and t.cnt('select 1 from public.card_recipients') = 0, 'thu hoi: tai khoan bi thu hoi mat quyen xem thiep ngay lap tuc');
select t.ok(public.mark_card_opened(t.id('c_rev')) = false, 'thu hoi: khong mo duoc thiep');
select t.fails($$select * from public.list_card_audience(t.fam())$$, 'thu hoi: khong xem duoc danh sach nguoi nhan');
select t.as_root();
update public.family_memberships set status = 'active', revoked_at = null where user_id = t.u(10);

-- ===== 7. Li xi dinh kem thiep =====
select t.as_user(:'U4');
insert into t.ids select 'c_gift', public.send_card(t.fam(), 'tet-phong-bao', 'Li xi Tet', 'Li xi dau nam', 'users', array[t.u(3), t.u(9)], null, now() + interval '1 day', true, 500000, 'vnd', 'Chuc con hoc gioi');
select t.ok(t.cnt('select 1 from public.gifts where card_id = t.id(''c_gift'')') = 2, 'li xi kem thiep: moi nguoi nhan mot khoan ghi nhan');
select t.ok(not exists (select 1 from public.gifts where card_id = t.id('c_gift') and (status <> 'pledged' or amount_minor <> 500000 or currency <> 'VND')), 'li xi kem thiep: trang thai pledged, tien ghi nhan 500000 VND (chu thuong duoc doi thanh chu hoa)');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.gifts') = 0, 'li xi kem thiep hen gio: nguoi nhan CHUA thay li xi');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'gift' and user_id in (t.u(3), t.u(9))$$) = 0, 'li xi kem thiep hen gio: chua co thong bao li xi');
select id as gift3 from public.gifts where card_id = t.id('c_gift') and recipient_id = t.u(3) \gset
select t.as_user(:'U3');
select t.fails(format($$select public.gift_transition(%L, 'confirm')$$, :'gift3'), 'li xi kem thiep hen gio: nguoi nhan khong thao tac duoc khi chua thay');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.gifts where card_id = t.id(''c_gift'')') = 2, 'li xi kem thiep: nguoi gui thay li xi cua minh');
select t.fails($$select public.update_card(t.id('c_gift'), 'tet-phong-bao', null, 'x', 'users', array[t.u(3)], null, null)$$, 'sua thiep co li xi: khong doi duoc nguoi nhan');
select public.update_card(t.id('c_gift'), 'tet-phong-bao', 'Li xi Tet', 'Loi chuc sua, giu nguoi nhan', 'users', array[t.u(9), t.u(3)], null, now() + interval '1 day');
select t.ok((select message = 'Loi chuc sua, giu nguoi nhan' from public.cards where id = t.id('c_gift')), 'sua thiep co li xi: sua noi dung va giu nguyen nguoi nhan thi duoc');
-- Toi gio
select t.as_root();
update public.cards set scheduled_at = now() - interval '1 minute' where id = t.id('c_gift');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.gifts') = 1, 'li xi: toi gio nguoi nhan thay dung 1 li xi cua minh');
select t.ok(public.deliver_my_due_cards() = 1, 'li xi: lazy deliver tao thong bao');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'gift' and user_id = t.u(3)$$) = 1, 'li xi: thong bao kind=gift cho nguoi nhan');
-- Huy thiep -> huy li xi pledged
select t.as_user(:'U4');
insert into t.ids select 'c_gift2', public.send_card(t.fam(), 'tet-phong-bao', null, 'se huy ca li xi', 'users', array[t.u(3)], null, now() + interval '1 day', true, 1000, 'JPY');
select public.cancel_card(t.id('c_gift2'));
select t.ok((select status from public.gifts where card_id = t.id('c_gift2')) = 'cancelled', 'huy thiep: li xi pledged di kem bi huy theo');
select t.ok((select cancelled_at is not null from public.gifts where card_id = t.id('c_gift2')), 'huy thiep: li xi bi huy co cancelled_at');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'gift.cancel' and after_data->>'reason' = 'card_cancelled'$$) = 1, 'huy thiep: ghi nhat ky gift.cancel');

-- ===== 8. Li xi: kiem tra du lieu =====
select t.as_user(:'U4');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 0, 'VND')$$, 'li xi: so tien 0 bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(3), -5, 'VND')$$, 'li xi: so tien am bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 100000000000001, 'VND')$$, 'li xi: so tien qua lon bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 100, 'VNDD')$$, 'li xi: tien te 4 chu bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 100, 'V1')$$, 'li xi: tien te sai dinh dang bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 100, null)$$, 'li xi: co so tien khong co tien te bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(3), null, 'VND')$$, 'li xi: co tien te khong co so tien bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(3), 100, 'VND', repeat('n', 501))$$, 'li xi: ghi chu 501 ky tu bi tu choi');
select t.fails($$select public.create_gift(t.fam(), t.u(4), 100, 'VND')$$, 'li xi: khong tu hen cho chinh minh');
select t.fails($$select public.create_gift(t.fam(), t.u(6), 100, 'VND')$$, 'li xi: nguoi ngoai khong nhan duoc');
select t.fails($$select public.create_gift(t.fam(), t.u(7), 100, 'VND')$$, 'li xi: tai khoan thu hoi khong nhan duoc');
insert into t.ids select 'g1', public.create_gift(t.fam(), t.u(3), 250000, 'jpy', 'Li xi mung tuoi');
insert into t.ids select 'g_noamt', public.create_gift(t.fam(), t.u(9), null, null, 'Chi la loi chuc');
select t.fails($$select public.create_gift(t.fam(), t.u(5), 100, 'VND')$$, 'li xi: khach (guest) khong co quyen xem li xi nen khong la nguoi nhan');
select t.ok((select amount_minor = 250000 and currency = 'JPY' and status = 'pledged' from public.gifts where id = t.id('g1')), 'li xi: tao duoc, tien te viet hoa, trang thai pledged');
select t.ok((select amount_minor is null and currency is null from public.gifts where id = t.id('g_noamt')), 'li xi: cho phep khong ghi so tien');
select t.ok(to_regclass('public.balances') is null and to_regclass('public.wallets') is null and to_regclass('public.payments') is null, 'li xi: khong co bang so du/vi/thanh toan');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.gifts where id = t.id(''g1'')') = 1, 'li xi doc lap: nguoi nhan thay ngay');
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'gift' and link = '/li-xi'$$) >= 1, 'li xi doc lap: nguoi nhan co thong bao');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.gifts') = 0, 'rieng tu: family_admin khong thay li xi cua nguoi khac');
select t.as_user(:'U1');
select t.ok(t.cnt('select 1 from public.gifts') = 0, 'rieng tu: super_admin khong thay li xi cua nguoi khac');
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.gifts where id = t.id(''g1'')') = 0, 'rieng tu: nguoi thu ba khong thay li xi');

-- ===== 9. Li xi: may trang thai =====
select t.as_user(:'U3');
select t.fails($$select public.gift_transition(t.id('g1'), 'mark_sent')$$, 'trang thai: nguoi nhan khong bam duoc "toi da chuyen"');
select t.fails($$select public.gift_transition(t.id('g1'), 'cancel')$$, 'trang thai: nguoi nhan khong huy duoc li xi cua nguoi gui');
select t.fails($$select public.gift_transition(t.id('g1'), 'confirm')$$, 'trang thai: khong the xac nhan khi nguoi gui chua danh dau da chuyen');
select t.fails($$select public.gift_transition(t.id('g1'), 'dispute')$$, 'trang thai: khong the khieu nai khi chua danh dau da chuyen');
select t.fails($$select public.gift_transition(t.id('g1'), 'hack')$$, 'trang thai: hanh dong la bi tu choi');
select t.fails($$update public.gifts set status = 'recipient_confirmed', recipient_confirmed_at = now() where id = t.id('g1')$$, 'trang thai: khong the tu update truc tiep thanh da nhan');
select t.as_user(:'U2');
select t.fails($$select public.gift_transition(t.id('g1'), 'mark_sent')$$, 'trang thai: family_admin khong thao tac duoc li xi cua nguoi khac');
select t.fails($$select public.gift_transition(t.id('g1'), 'confirm')$$, 'trang thai: family_admin khong xac nhan ho');
select t.as_user(:'U6');
select t.fails($$select public.gift_transition(t.id('g1'), 'mark_sent')$$, 'trang thai: nguoi ngoai bi tu choi');
select t.as_anon();
select t.fails($$select public.gift_transition(gen_random_uuid(), 'mark_sent')$$, 'trang thai: anon bi tu choi');
select t.as_user(:'U4');
select t.fails($$select public.gift_transition(t.id('g1'), 'confirm')$$, 'trang thai: nguoi gui khong tu xac nhan "da nhan"');
select t.fails($$select public.gift_transition(t.id('g1'), 'dispute')$$, 'trang thai: nguoi gui khong khieu nai');
select t.ok(public.gift_transition(t.id('g1'), 'mark_sent') = 'sender_marked_sent', 'trang thai: nguoi gui bam "toi da chuyen" => sender_marked_sent');
select t.ok((select sender_marked_at is not null from public.gifts where id = t.id('g1')), 'trang thai: co sender_marked_at');
select t.fails($$select public.gift_transition(t.id('g1'), 'mark_sent')$$, 'trang thai: khong danh dau lan hai');
select t.fails($$select public.gift_transition(t.id('g1'), 'cancel')$$, 'trang thai: da danh dau chuyen thi nguoi gui khong huy duoc');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'gift' and user_id = t.u(3) and title like '%đã đánh dấu đã chuyển%'$$) = 1, 'trang thai: nguoi nhan duoc thong bao');
select t.as_user(:'U3');
select t.ok(public.gift_transition(t.id('g1'), 'dispute', 'Chua thay tien') = 'disputed', 'trang thai: nguoi nhan khieu nai => disputed');
select t.ok((select dispute_note = 'Chua thay tien' and disputed_at is not null from public.gifts where id = t.id('g1')), 'trang thai: luu ghi chu khieu nai');
select t.fails($$select public.gift_transition(t.id('g1'), 'dispute')$$, 'trang thai: khong khieu nai lan hai');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'gift' and user_id = t.u(4) and title like '%chưa nhận được%'$$) = 1, 'trang thai: nguoi gui duoc thong bao khieu nai');
select t.as_user(:'U4');
select t.ok(public.gift_transition(t.id('g1'), 'mark_sent') = 'sender_marked_sent', 'trang thai: sau khieu nai nguoi gui co the danh dau chuyen lai');
select t.as_user(:'U3');
select t.ok(public.gift_transition(t.id('g1'), 'confirm') = 'recipient_confirmed', 'trang thai: nguoi nhan xac nhan "da nhan" => recipient_confirmed');
select t.ok((select recipient_confirmed_at is not null from public.gifts where id = t.id('g1')), 'trang thai: co recipient_confirmed_at');
select t.fails($$select public.gift_transition(t.id('g1'), 'confirm')$$, 'trang thai cuoi: khong xac nhan lai');
select t.fails($$select public.gift_transition(t.id('g1'), 'dispute')$$, 'trang thai cuoi: khong khieu nai sau khi da nhan');
select t.as_user(:'U4');
select t.fails($$select public.gift_transition(t.id('g1'), 'cancel')$$, 'trang thai cuoi: khong huy sau khi da nhan');
select t.fails($$select public.gift_transition(t.id('g1'), 'mark_sent')$$, 'trang thai cuoi: khong danh dau chuyen lai');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.audit_logs where entity_type = 'gift' and entity_id = t.id('g1')::text$$) = 5, 'nhat ky: 5 su kien cua li xi g1 (create, mark_sent, dispute, mark_sent, confirm)');
select t.ok(t.cnt($$select 1 from public.audit_logs where action in ('gift.mark_sent','gift.confirm','gift.dispute','gift.create') and (after_data::text like '%250000%' or after_data::text like '%JPY%')$$) = 0, 'nhat ky: khong ghi so tien/tien te (quan tri vien doc duoc nhat ky)');
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'gift.confirm' and actor_id = t.u(3)$$) = 1, 'nhat ky: ghi dung nguoi xac nhan');
-- Huy bang tay
select t.as_user(:'U4');
insert into t.ids select 'g2', public.create_gift(t.fam(), t.u(3), 100, 'USD');
select t.ok(public.gift_transition(t.id('g2'), 'cancel') = 'cancelled', 'huy: nguoi gui huy li xi pledged');
select t.as_user(:'U3');
select t.fails($$select public.gift_transition(t.id('g2'), 'confirm')$$, 'huy: khong xac nhan li xi da huy');
-- Rang buoc o muc bang (root co the viet truc tiep; CHECK van chan du lieu sai)
select t.as_root();
select t.fails($$insert into public.gifts (family_id, sender_id, recipient_id, amount_minor) values (t.fam(), t.u(4), t.u(3), 100)$$, 'rang buoc: co so tien ma khong co tien te bi chan');
select t.fails($$insert into public.gifts (family_id, sender_id, recipient_id, status) values (t.fam(), t.u(4), t.u(3), 'recipient_confirmed')$$, 'rang buoc: da nhan ma khong co moc thoi gian bi chan');
select t.fails($$insert into public.gifts (family_id, sender_id, recipient_id) values (t.fam(), t.u(4), t.u(4))$$, 'rang buoc: nguoi gui = nguoi nhan bi chan');
select t.fails($$insert into public.gifts (family_id, sender_id, recipient_id, status) values (t.fam(), t.u(4), t.u(3), 'paid')$$, 'rang buoc: khong co trang thai "da tra tien" nao');

-- ===== 10. Thong tin nhan tien rieng tu =====
-- (ciphertext o day chi la chuoi base64 gia; viec ma hoa that duoc kiem thu bang vitest o src/lib/crypto.test.ts)
select t.as_user(:'U4');
insert into t.ids values ('p1', 'a0000000-0000-0000-0000-000000000001');
select public.create_payout_profile(t.id('p1'), t.fam(), 'bank', 'Vietcombank cua toi', '1234', 'Q0lQSEVSVEVYVF9WRVJZX1NFQ1JFVA==', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1);
select t.ok(t.cnt('select 1 from public.my_payout_profiles(t.fam())') = 1, 'nhan tien: chu ho so thay ho so cua minh (dang che)');
select t.ok((select not (to_jsonb(r) ? 'ciphertext') and not (to_jsonb(r) ? 'iv') and not (to_jsonb(r) ? 'tag') and r.last4 = '1234' from public.my_payout_profiles(t.fam()) r), 'nhan tien: danh sach che chi co 4 so cuoi, khong co ciphertext');
-- Khong ai doc truc tiep
select t.fails($$select * from public.payout_profiles$$, 'nhan tien: chinh chu cung khong doc truc tiep bang');
select t.fails($$select * from public.payout_shares$$, 'nhan tien: chinh chu khong doc truc tiep payout_shares');
select t.fails($$update public.payout_profiles set label = 'x'$$, 'nhan tien: khong sua truc tiep');
select t.fails($$delete from public.payout_profiles$$, 'nhan tien: khong xoa truc tiep');
select t.fails($$insert into public.payout_profiles (id, family_id, owner_id, kind, label, ciphertext, iv, tag) values (gen_random_uuid(), t.fam(), t.u(4), 'bank', 'x', 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: khong them truc tiep');
select t.as_user(:'U2');
select t.fails($$select * from public.payout_profiles$$, 'nhan tien: family_admin KHONG doc duoc bang');
select t.ok(t.cnt('select 1 from public.my_payout_profiles(t.fam())') = 0, 'nhan tien: family_admin khong thay ho so cua nguoi khac qua danh sach');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'nhan tien: family_admin khong lay duoc ban ma');
select t.as_user(:'U1');
select t.fails($$select * from public.payout_profiles$$, 'nhan tien: super_admin khong doc duoc bang');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'nhan tien: super_admin khong lay duoc ban ma');
select t.fails($$select public.share_payout_profile(t.id('p1'), t.u(1), 24)$$, 'nhan tien: super_admin khong tu chia se ho so cua nguoi khac cho minh');
select t.as_user(:'U6');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'nhan tien: nguoi ngoai khong lay duoc ban ma');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', 'x', null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: nguoi ngoai khong tao ho so');
select t.as_anon();
select t.fails($$select * from public.payout_profiles$$, 'nhan tien: anon khong doc duoc bang');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'nhan tien: anon khong lay duoc ban ma');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.my_payout_profiles(t.fam())') = 0, 'nhan tien: nguoi khac khong thay ho so trong danh sach cua minh');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'nhan tien: chua duoc chia se thi khong lay duoc');
select t.ok(t.cnt('select 1 from public.payout_profiles_shared_with_me(t.fam())') = 0, 'nhan tien: chua co ho so nao chia se cho minh');
select t.fails($$select public.share_payout_profile(t.id('p1'), t.u(3), 24)$$, 'nhan tien: khong phai chu thi khong chia se duoc');
select t.fails($$select public.delete_payout_profile(t.id('p1'))$$, 'nhan tien: khong phai chu thi khong xoa duoc');
-- Du lieu dau vao
select t.as_user(:'U4');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'card', 'x', null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: loai khong hop le bi tu choi');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', '   ', null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: nhan rong bi tu choi');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', 'x', '12345', 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: 5 ky tu cuoi bi tu choi (chi toi da 4)');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', 'x', null, 'QUJDREVGR0g=', 'AAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: iv sai do dai bi tu choi');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', 'x', null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAA')$$, 'nhan tien: tag sai do dai bi tu choi');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', 'x', null, 'khong phai base64!', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: ciphertext khong phai base64 bi tu choi');
select t.fails($$select public.create_payout_profile(t.id('p1'), t.fam(), 'bank', 'x', null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'nhan tien: id trung bi tu choi');
select t.ok(t.cnt('select 1 from public.my_payout_profiles(t.fam())') = 1, 'nhan tien: cac lan tao loi khong de lai ho so');
-- Chia se
select t.fails($$select public.share_payout_profile(t.id('p1'), t.u(4), 24)$$, 'chia se: khong chia se cho chinh minh');
select t.fails($$select public.share_payout_profile(t.id('p1'), t.u(6), 24)$$, 'chia se: khong chia se cho nguoi ngoai gia dinh');
select t.fails($$select public.share_payout_profile(t.id('p1'), t.u(7), 24)$$, 'chia se: khong chia se cho tai khoan da thu hoi');
select t.fails($$select public.share_payout_profile(t.id('p1'), t.u(3), 0)$$, 'chia se: han 0 gio bi tu choi');
select t.fails($$select public.share_payout_profile(t.id('p1'), t.u(3), 721)$$, 'chia se: han qua 30 ngay bi tu choi');
select t.fails($$select public.share_payout_profile(t.id('p1'), null, 24)$$, 'chia se: thieu nguoi nhan bi tu choi');
insert into t.ids select 'sh1', public.share_payout_profile(t.id('p1'), t.u(3), 24);
select t.ok(t.cnt('select 1 from public.my_payout_shares(t.fam()) where state = ''active''') = 1, 'chia se: chu thay luot chia se dang hieu luc');
select t.ok(public.share_payout_profile(t.id('p1'), t.u(3), 48) = t.id('sh1'), 'chia se: chia se lai cho cung nguoi chi gia han, khong tao them dong');
select t.ok(t.cnt('select 1 from public.my_payout_shares(t.fam())') = 1, 'chia se: van chi 1 dong');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.notifications where user_id = t.u(3) and kind = 'gift' and title like '%chia sẻ thông tin nhận tiền%'$$) >= 1, 'chia se: nguoi duoc chia se co thong bao');
-- Nguoi duoc chia se
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.payout_profiles_shared_with_me(t.fam())') = 1, 'duoc chia se: thay ho so (dang che) trong danh sach');
select t.ok((select not (to_jsonb(r) ? 'ciphertext') and r.last4 = '1234' and r.owner_name = 'Member' from public.payout_profiles_shared_with_me(t.fam()) r), 'duoc chia se: danh sach che, kem ten chu ho so');
select * from public.reveal_payout_profile(t.id('p1')) \gset rv_
select t.ok(:'rv_ciphertext' = 'Q0lQSEVSVEVYVF9WRVJZX1NFQ1JFVA==' and :'rv_owner_id' = '00000000-0000-0000-0000-000000000004', 'duoc chia se: lay duoc ban ma dung (de may chu giai ma)');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'payout.reveal' and entity_id = t.id('p1')::text and after_data->>'viewer' = t.u(3)::text and after_data->>'owner' = t.u(4)::text and after_data->>'relation' = 'shared'$$) = 1, 'nhat ky: payout.reveal ghi ai xem ho so cua ai (nguoi duoc chia se)');
select t.as_user(:'U4');
select * from public.reveal_payout_profile(t.id('p1')) \gset rv2_
select t.as_root();
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'payout.reveal' and after_data->>'relation' = 'self'$$) = 1, 'nhat ky: chinh chu xem cung duoc ghi (relation=self)');
select t.ok(t.cnt($$select 1 from public.audit_logs where action like 'payout.%' and (after_data::text like '%Q0lQSEVS%' or before_data::text like '%Q0lQSEVS%' or after_data ? 'ciphertext')$$) = 0, 'nhat ky: khong chua ciphertext/bi mat');
select t.as_user(:'U2');
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'payout.reveal'$$) = 2, 'nhat ky: quan tri vien doc duoc ai xem ho so cua ai (khong doc duoc noi dung)');
select t.as_user(:'U5');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'duoc chia se: nguoi khac (chua duoc chia se) van khong lay duoc');
-- Het han chan ngay
select t.as_root();
update public.payout_shares set created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute' where id = t.id('sh1');
select t.as_user(:'U3');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'het han: lay ban ma bi chan ngay');
select t.ok(t.cnt('select 1 from public.payout_profiles_shared_with_me(t.fam())') = 0, 'het han: khong con trong danh sach');
select t.as_user(:'U4');
select t.ok((select state from public.my_payout_shares(t.fam()) where share_id = t.id('sh1')) = 'expired', 'het han: chu thay luot chia se o trang thai het han');
select t.ok(public.share_payout_profile(t.id('p1'), t.u(3), 24) = t.id('sh1'), 'het han: chia se lai gia han luot cu');
select t.as_user(:'U3');
select t.ok((select ciphertext from public.reveal_payout_profile(t.id('p1'))) is not null, 'het han: sau khi gia han lay duoc lai');
-- Thu hoi chan ngay
select t.as_user(:'U5');
select t.fails($$select public.revoke_payout_share(t.id('sh1'))$$, 'thu hoi: nguoi khac khong thu hoi duoc');
select t.as_user(:'U3');
select t.fails($$select public.revoke_payout_share(t.id('sh1'))$$, 'thu hoi: nguoi duoc chia se khong tu thu hoi duoc cua chu');
select t.as_user(:'U4');
select public.revoke_payout_share(t.id('sh1'));
select t.as_user(:'U3');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'thu hoi: bi chan ngay lap tuc');
select t.ok(t.cnt('select 1 from public.payout_profiles_shared_with_me(t.fam())') = 0, 'thu hoi: khong con trong danh sach');
select t.as_user(:'U4');
select t.ok((select state from public.my_payout_shares(t.fam()) where share_id = t.id('sh1')) = 'revoked', 'thu hoi: chu thay trang thai da thu hoi');
select t.ok(public.share_payout_profile(t.id('p1'), t.u(3), 24) <> t.id('sh1'), 'thu hoi: chia se lai tao luot moi');
select t.as_root();
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'payout.revoke'$$) = 1 and t.cnt($$select 1 from public.audit_logs where action = 'payout.share'$$) = 4, 'nhat ky: ghi chia se va thu hoi');
-- Chu bi thu hoi tai khoan / nguoi xem bi thu hoi tai khoan
select t.as_user(:'U9');
insert into t.ids values ('p2', 'a0000000-0000-0000-0000-000000000002');
select public.create_payout_profile(t.id('p2'), t.fam(), 'ewallet', 'Vi cua B1', null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==');
select public.share_payout_profile(t.id('p2'), t.u(3), 24);
select public.share_payout_profile(t.id('p2'), t.u(11), 24);
select t.as_user(:'U3');
select t.ok((select ciphertext from public.reveal_payout_profile(t.id('p2'))) is not null, 'chu bi thu hoi: truoc do lay duoc');
select t.as_root();
update public.family_memberships set status = 'revoked', revoked_at = now() where user_id = t.u(11);
select t.as_user(:'U11');
select t.fails($$select * from public.reveal_payout_profile(t.id('p2'))$$, 'nguoi xem bi thu hoi tai khoan: khong lay duoc');
select t.as_root();
update public.family_memberships set status = 'revoked', revoked_at = now() where user_id = t.u(9);
select t.as_user(:'U3');
select t.fails($$select * from public.reveal_payout_profile(t.id('p2'))$$, 'chu bi thu hoi tai khoan: nguoi duoc chia se khong lay duoc nua');
select t.ok(t.cnt('select 1 from public.payout_profiles_shared_with_me(t.fam())') = 1, 'chu bi thu hoi tai khoan: bien khoi danh sach duoc chia se (chi con ho so p1)');
select t.as_user(:'U9');
select t.fails($$select * from public.reveal_payout_profile(t.id('p2'))$$, 'chu bi thu hoi tai khoan: chinh chu cung khong xem duoc');
select t.as_root();
update public.family_memberships set status = 'active', revoked_at = null where user_id in (t.u(9), t.u(11));
-- Xoa ho so
select t.as_user(:'U4');
select public.delete_payout_profile(t.id('p1'));
select t.ok(t.cnt('select 1 from public.my_payout_profiles(t.fam())') = 0, 'xoa: ho so bien mat');
select t.as_user(:'U3');
select t.fails($$select * from public.reveal_payout_profile(t.id('p1'))$$, 'xoa: nguoi duoc chia se khong lay duoc nua');
select t.as_root();
select t.ok(t.cnt('select 1 from public.payout_shares where profile_id = t.id(''p1'')') = 0, 'xoa: cac luot chia se bi xoa theo');
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'payout.delete' and entity_id = t.id('p1')::text$$) = 1, 'nhat ky: ghi viec xoa ho so');
-- Gioi han so ho so
select t.as_user(:'U5');
select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', 'x' || g, null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==') from generate_series(1, 10) g;
select t.ok(t.cnt('select 1 from public.my_payout_profiles(t.fam())') = 10, 'gioi han: tao duoc 10 ho so');
select t.fails($$select public.create_payout_profile(gen_random_uuid(), t.fam(), 'bank', 'thu 11', null, 'QUJDREVGR0g=', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==')$$, 'gioi han: ho so thu 11 bi tu choi');
select t.as_root();
select t.ok(not (has_table_privilege('authenticated', 'public.payout_profiles', 'select') or has_table_privilege('authenticated', 'public.payout_profiles', 'insert')
   or has_table_privilege('authenticated', 'public.payout_profiles', 'update') or has_table_privilege('authenticated', 'public.payout_profiles', 'delete')
   or has_table_privilege('authenticated', 'public.payout_shares', 'select') or has_table_privilege('authenticated', 'public.payout_shares', 'insert')
   or has_table_privilege('anon', 'public.payout_profiles', 'select') or has_table_privilege('anon', 'public.payout_shares', 'select')), 'cap quyen: anon/authenticated khong co quyen nao tren bang payout');

-- ===== 11. Gioi han so nguoi nhan va toc do =====
insert into auth.users (id, email) select gen_random_uuid(), 'bulk' || g || '@test.local' from generate_series(1, 215) g;
insert into public.user_profiles (id, display_name) select id, 'Bulk ' || email from auth.users where email like 'bulk%';
insert into public.family_memberships (user_id, family_id, role_key) select id, t.fam(), 'member' from auth.users where email like 'bulk%';
create table t.bulk as select id, row_number() over (order by email) as n from auth.users where email like 'bulk%';
grant select on t.bulk to public;
select t.as_user(:'U2');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'family', null, null, null)$$, 'gioi han: ca gia dinh > 200 nguoi bi tu choi');
select t.ok(public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi 200', 'users',
    (select array_agg(id) from t.bulk where n <= 200), null, null) is not null, 'gioi han: dung 200 nguoi thi duoc');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi 201', 'users',
    (select array_agg(id) from t.bulk where n <= 201), null, null)$$, 'gioi han: 201 nguoi bi tu choi');
select t.fails($$select public.send_card(t.fam(), 'tet-phong-bao', null, 'li xi cho 21 nguoi', 'users',
    (select array_agg(id) from t.bulk where n <= 21), null, null, true, 1000, 'VND')$$, 'gioi han: li xi dinh kem toi da 20 nguoi nhan');
select t.ok(public.send_card(t.fam(), 'tet-phong-bao', null, 'li xi cho 20 nguoi', 'users',
    (select array_agg(id) from t.bulk where n <= 20), null, null, true, 1000, 'VND') is not null, 'gioi han: li xi dinh kem 20 nguoi nhan thi duoc');
select t.as_root();
select t.ok(t.cnt('select 1 from public.gifts where amount_minor = 1000 and currency = ''VND'' and card_id is not null') = 20, 'gioi han: tao du 20 li xi, lenh bi tu choi khong de lai li xi nao');
-- Toc do: 50 thiep / 24 gio
select t.as_root();
insert into public.cards (family_id, sender_id, template_key, message, audience_kind)
  select t.fam(), t.u(3), 'tet-hoa-mai', 'x', 'family' from generate_series(1, 50);
select t.as_user(:'U3');
select t.fails($$select public.send_card(t.fam(), 'tet-hoa-mai', null, 'hi', 'users', array[t.u(4)], null, null)$$, 'toc do: gui qua 50 thiep trong 24 gio bi tu choi');

-- Xoa nhanh da dung de gui thiep khong lam hong thiep cu
select t.as_root();
insert into public.branches (id, family_id, name) values ('b0000000-0000-0000-0000-0000000000f1', t.fam(), 'Nhanh tam');
update public.family_memberships set branch_id = 'b0000000-0000-0000-0000-0000000000f1' where user_id = t.u(11);
select t.as_user(:'U4');
insert into t.ids select 'c_tmpbranch', public.send_card(t.fam(), 'tet-hoa-mai', null, 'gui nhanh tam', 'branch', null, 'b0000000-0000-0000-0000-0000000000f1', null);
select t.as_root();
update public.family_memberships set branch_id = null where user_id = t.u(11);
delete from public.branches where id = 'b0000000-0000-0000-0000-0000000000f1';
select t.ok((select audience_branch_id is null and audience_kind = 'branch' from public.cards where id = t.id('c_tmpbranch')), 'xoa nhanh: thiep cu van con, audience_branch_id thanh null');
select t.ok((select count(*) from public.card_recipients where card_id = t.id('c_tmpbranch')) = 1, 'xoa nhanh: danh sach nguoi nhan cua thiep cu giu nguyen');

-- ===== 12. Nhat ky khong bi sua =====
select t.as_user(:'U1');
select t.fails($$update public.audit_logs set action = 'x'$$, 'nhat ky khong sua duoc');

-- ===== Tong ket =====
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
