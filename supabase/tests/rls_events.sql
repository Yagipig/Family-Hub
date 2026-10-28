-- Kiem thu RLS + nghiep vu cho module Lich, Sinh nhat & Su kien (migration 20261030000001..4).
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
-- Su kien mau: bat dau 2030 (xa moi kich ban nhac nho), co the ghi de truong qua extra
create function t.ev(title text, extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object('title', title, 'starts_at', '2030-06-01T10:00:00+07:00') || extra $$;
grant execute on function t.ev(text, jsonb) to public;
-- Dem thong bao theo nguoi nhan + mau tieu de (goi khi dang la root)
create function t.ntf(u uuid, pat text) returns bigint language sql as $$
  select count(*) from public.notifications where user_id = u and title like pat $$;
create function t.ntfk(u uuid, k text) returns bigint language sql as $$
  select count(*) from public.notifications where user_id = u and kind = k $$;
create function t.ntfb(u uuid, pat text, bodypat text) returns bigint language sql as $$
  select count(*) from public.notifications where user_id = u and title like pat and body like bodypat $$;

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

-- Gia dinh thu hai (de thu ranh gioi gia dinh); U8 la super_admin o do
select t.as_root();
insert into public.families (name) values ('Gia dinh 2') returning id as fid2 \gset
insert into public.family_memberships (user_id, family_id, role_key) values (:'U8', :'fid2', 'super_admin');
select set_config('t.fid2', :'fid2', false);

-- =====================================================================
-- 1. Ham am lich trong SQL (bang lunar_months)
-- =====================================================================
select t.ok((select count(*) from public.lunar_months) between 2400 and 2600, 'am lich: bang co ~2487 thang (1900-2100)');
select t.ok((select count(*) from public.lunar_months m
             left join lateral (select n.start_date from public.lunar_months n where n.start_date > m.start_date order by n.start_date limit 1) nx on true
             where nx.start_date is not null and nx.start_date <> m.start_date + m.days) = 0,
            'am lich: cac thang noi lien nhau, khong ho/chong');
select t.ok((select count(*) from public.lunar_months where is_leap) between 68 and 78, 'am lich: so thang nhuan hop ly (~73)');
-- Mung 1 Tet (Viet Nam): 2024-02-10, 2026-02-17, 2027-02-06; Tet 2007 = 17/2 (Viet Nam som hon Trung Quoc 1 ngay), Tet 1985 = 21/1
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('2024-02-10')) = '(2024,1,1,f)', 'am lich SQL: 10/2/2024 = mung 1 Tet');
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('2026-02-17')) = '(2026,1,1,f)', 'am lich SQL: 17/2/2026 = mung 1 Tet');
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('2007-02-17')) = '(2007,1,1,f)', 'am lich SQL: Tet Viet Nam 2007 = 17/2/2007');
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('2030-02-02')) = '(2030,1,1,f)', 'am lich SQL: Tet Viet Nam 2030 = 2/2/2030');
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('1985-01-21')) = '(1985,1,1,f)', 'am lich SQL: Tet Viet Nam 1985 = 21/1/1985');
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('1985-03-21')) = '(1985,2,1,t)', 'am lich SQL: nhuan thang 2 nam 1985 bat dau 21/3/1985');
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('1985-04-19')) = '(1985,2,30,t)', 'am lich SQL: ngay cuoi thang nhuan 1985 = 19/4 (30 ngay)');
select t.ok((select row(lunar_year, lunar_month, lunar_day, is_leap)::text from public._lunar_of('2026-11-11')) = '(2026,10,3,f)', 'am lich SQL: 11/11/2026 = 3 thang 10 (doi chieu voi lunar.ts)');
select t.ok(not exists (select 1 from public._lunar_of('1899-12-31')), 'am lich SQL: ngoai du lieu khong tra ve gi (khong loi)');
select t.ok(not exists (select 1 from public._lunar_of('2101-06-01')), 'am lich SQL: sau 2100 khong tra ve gi');
select t.ok(public._lunar_to_solar(2023, 2, 1, true) = '2023-03-22', 'am->duong: nhuan thang 2 nam 2023 mung 1 = 22/3/2023');
select t.ok(public._lunar_to_solar(2024, 4, 1, true) is null, 'am->duong: nam 2024 khong co thang nhuan -> NULL');
select t.ok(public._lunar_to_solar(2026, 2, 30, false) is null, 'am->duong: ngay 30 cua thang thieu (2/2026 co 29 ngay) -> NULL');
select t.ok(public._lunar_to_solar(2026, 2, 29, false) = '2026-04-16', 'am->duong: 29/2/2026 am = 16/4/2026');
-- Quy tac lap lai (giong lunar.ts, doi chieu gia tri sinh tu lunar.ts)
select t.ok(public._lunar_recur_date(2026, 6, 15, true) = '2026-07-28', 'lap am: nhuan 6 goc, 2026 khong nhuan -> thang 6 thuong (28/7/2026)');
select t.ok(public._lunar_recur_date(2025, 6, 15, true) = '2025-08-08', 'lap am: nhuan 6 goc, 2025 co nhuan 6 -> dung thang nhuan (8/8/2025)');
select t.ok(public._lunar_recur_date(2025, 6, 15, false) = '2025-07-09', 'lap am: thang thuong goc 6/15/2025 -> 9/7/2025 (khong lay thang nhuan)');
select t.ok(public._lunar_recur_date(2026, 2, 30, false) = '2026-04-16', 'lap am: ngay 30 cua thang 29 ngay -> ngay cuoi thang (16/4/2026)');
select t.ok(public._lunar_recur_date(2026, 3, 30, false) = '2026-05-16', 'lap am: ngay 30 cua thang du 30 ngay giu nguyen');
select t.ok(public._lunar_recur_date(2026, 13, 1, false) is null and public._lunar_recur_date(2026, 5, 31, false) is null, 'lap am: thang/ngay ngoai khoang -> NULL');
select t.ok(public._lunar_occurs_on('2026-11-11', 10, 3, false), 'occurs_on: 11/11/2026 la 3/10 am');
select t.ok(not public._lunar_occurs_on('2026-11-12', 10, 3, false), 'occurs_on: 12/11/2026 khong phai 3/10 am');
select t.ok(public._lunar_occurs_on('2026-04-16', 2, 30, false), 'occurs_on: ngay 30/2 goc roi vao 16/4/2026 (ngay 29)');
select t.ok(not public._lunar_occurs_on('2026-04-15', 2, 30, false), 'occurs_on: khong roi vao ngay 28/2 am');
select t.ok(public._solar_md_occurs_on('2027-02-28', 2, 29) and not public._solar_md_occurs_on('2028-02-28', 2, 29) and public._solar_md_occurs_on('2028-02-29', 2, 29),
            'duong lich: 29/2 -> 28/2 o nam khong nhuan, dung 29/2 o nam nhuan');
select t.ok(public._safe_make_date(1990, 2, 31) is null and public._safe_make_date(1990, 2, 28) = '1990-02-28', '_safe_make_date: ngay sai -> NULL');
-- Ham noi bo khong goi duoc bang authenticated/anon
select t.as_user(:'U2');
select t.fails($$select * from public._lunar_of('2024-02-10')$$, 'authenticated khong goi duoc _lunar_of');
select t.fails($$select public._lunar_recur_date(2026, 6, 15, true)$$, 'authenticated khong goi duoc _lunar_recur_date');
select t.fails($$select public._member_hits_on(current_setting('t.fid')::uuid, '2026-11-11')$$, 'authenticated khong goi duoc _member_hits_on');
select t.fails($$select public._can_see_field_for('00000000-0000-0000-0000-000000000002', current_setting('t.fid')::uuid, null, null, 'family', false)$$, 'authenticated khong goi duoc _can_see_field_for');
select t.fails($$select public._can_view_event_for('00000000-0000-0000-0000-000000000002', current_setting('t.fid')::uuid, null, 'family')$$, 'authenticated khong goi duoc _can_view_event_for');
select t.fails($$select public._event_clean(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z"}'::jsonb)$$, 'authenticated khong goi duoc _event_clean');
select t.fails($$select public.generate_daily_notifications(now())$$, 'family_admin khong goi duoc generate_daily_notifications');
select t.as_user(:'U1');
select t.fails($$select public.generate_daily_notifications(now())$$, 'ke ca super_admin (authenticated) khong goi duoc generate_daily_notifications');
select t.as_anon();
select t.fails($$select public.generate_daily_notifications(now())$$, 'anon khong goi duoc generate_daily_notifications');
select t.fails($$select * from public.lunar_months$$, 'anon khong doc duoc lunar_months');

-- =====================================================================
-- 2. Quyen xem su kien: nhanh, vai tro, nguoi ngoai
-- =====================================================================
select t.as_user(:'U2');
insert into t.ids select 'visF',  public.create_event(current_setting('t.fid')::uuid, t.ev('VIS-F'));
insert into t.ids select 'visA',  public.create_event(current_setting('t.fid')::uuid, t.ev('VIS-A',  jsonb_build_object('branch_id', :'BA', 'visibility', 'branch')));
insert into t.ids select 'visB',  public.create_event(current_setting('t.fid')::uuid, t.ev('VIS-B',  jsonb_build_object('branch_id', :'BB', 'visibility', 'branch')));
insert into t.ids select 'visBf', public.create_event(current_setting('t.fid')::uuid, t.ev('VIS-Bf', jsonb_build_object('branch_id', :'BB', 'visibility', 'family')));
insert into t.ids select 'visA1', public.create_event(current_setting('t.fid')::uuid, t.ev('VIS-A1', jsonb_build_object('branch_id', :'BA1', 'visibility', 'branch')));
select t.ok(t.cnt($$select 1 from public.events where title like 'VIS-%'$$) = 5, 'family_admin: thay 5 su kien');
select t.as_user(:'U1');
select t.ok(t.cnt($$select 1 from public.events where title like 'VIS-%'$$) = 5, 'super_admin: thay 5 su kien');
select t.as_user(:'U3');   -- branch_admin nhanh A
select t.ok(t.cnt($$select 1 from public.events where title like 'VIS-%'$$) = 4, 'branch_admin A: thay su kien toan gia dinh, nhanh A, nhanh con A1, va su kien nhanh B mo cho ca nha (4)');
select t.ok(t.cnt($$select 1 from public.events where title = 'VIS-B'$$) = 0, 'branch_admin A: khong thay su kien rieng nhanh B');
select t.as_user(:'U4');   -- member nhanh A
select t.ok(t.cnt($$select 1 from public.events where title like 'VIS-%'$$) = 4, 'member nhanh A: thay 4 su kien (khong thay VIS-B)');
select t.ok(t.cnt($$select 1 from public.events where title = 'VIS-A1'$$) = 1, 'member nhanh A: thay su kien nhanh con A1');
select t.as_user(:'U5');   -- guest, khong nhanh
select t.ok(t.cnt($$select 1 from public.events where title like 'VIS-%'$$) = 2, 'guest: chi thay su kien mo cho ca nha (VIS-F, VIS-Bf)');
select t.ok(t.cnt($$select 1 from public.events where title = 'VIS-A'$$) = 0, 'guest: khong thay su kien rieng nhanh');
select t.as_user(:'U6');
select t.ok(t.cnt('select 1 from public.events') = 0, 'nguoi ngoai: khong thay su kien nao');
select t.ok(t.cnt('select 1 from public.event_rsvps') = 0, 'nguoi ngoai: khong thay RSVP');
select t.as_user(:'U7');
select t.ok(t.cnt('select 1 from public.events') = 0, 'tai khoan bi thu hoi: khong thay su kien');
select t.as_user(:'U8');
select t.ok(t.cnt($$select 1 from public.events where family_id = current_setting('t.fid')::uuid$$) = 0, 'super_admin gia dinh khac: khong thay su kien gia dinh nay');
select t.as_anon();
select t.fails($$select * from public.events$$, 'anon: khong doc duoc events');
select t.fails($$select * from public.event_rsvps$$, 'anon: khong doc duoc event_rsvps');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"Hack","starts_at":"2030-01-01T00:00:00Z"}'::jsonb)$$, 'anon: khong tao duoc su kien');

-- Ghi truc tiep bi tu choi
select t.as_user(:'U2');
select t.fails($$insert into public.events (family_id, title, starts_at) values (current_setting('t.fid')::uuid, 'Truc tiep', now())$$, 'family_admin: khong INSERT truc tiep vao events');
select t.fails($$update public.events set title = 'X'$$, 'family_admin: khong UPDATE truc tiep events');
select t.fails($$delete from public.events$$, 'family_admin: khong DELETE truc tiep events');
select t.fails($$insert into public.event_rsvps (event_id, user_id, family_id, occurrence, response) values (t.id('visF'), '00000000-0000-0000-0000-000000000002', current_setting('t.fid')::uuid, '2030-06-01', 'yes')$$, 'khong INSERT truc tiep event_rsvps');
select t.as_user(:'U4');
select t.fails($$update public.events set title = 'X'$$, 'member: khong UPDATE truc tiep events');
select t.fails($$delete from public.event_rsvps$$, 'member: khong DELETE truc tiep event_rsvps');

-- Thong bao khi tao su kien: chi nguoi xem duoc, tru nguoi tao
select t.as_root();
select t.ok((select count(*) from public.notifications where kind = 'event' and dedupe_key like 'event:' || t.id('visF')::text || ':new:%') = 4,
            'thong bao su kien moi (toan gia dinh): U1,U3,U4,U5 (khong gom nguoi tao U2, khong gom nguoi ngoai/thu hoi)');
select t.ok((select count(*) from public.notifications where dedupe_key like 'event:' || t.id('visB')::text || ':new:%') = 1
            and (select count(*) from public.notifications where user_id = :'U1' and dedupe_key = 'event:' || t.id('visB')::text || ':new:' || :'U1') = 1,
            'thong bao su kien rieng nhanh B: chi super_admin (nguoi tao khac)');
select t.ok((select count(*) from public.notifications where dedupe_key like 'event:' || t.id('visA')::text || ':new:%') = 3,
            'thong bao su kien rieng nhanh A: U1, U3, U4 (khach khong thay nen khong nhan)');
select t.ok((select count(*) from public.notifications where user_id in (:'U6', :'U7', :'U8') and kind = 'event') = 0, 'nguoi ngoai/thu hoi/chua co quyen khong nhan thong bao su kien');
select t.ok((select link from public.notifications where dedupe_key = 'event:' || t.id('visF')::text || ':new:' || :'U4') = '/lich/su-kien/' || t.id('visF')::text, 'thong bao tro toi trang su kien noi bo');

-- =====================================================================
-- 3. Tao su kien theo vai tro + che do chinh sua
-- =====================================================================
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'locked');   -- chac chan dang khoa
select t.as_user(:'U4');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Member khi khoa'))$$, 'member: khong tao duoc su kien khi che do chinh sua KHOA');
select t.as_user(:'U5');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Khach'))$$, 'guest: khong tao duoc su kien');
select t.as_user(:'U6');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Ngoai'))$$, 'nguoi ngoai: khong tao duoc su kien');
select t.as_user(:'U7');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Thu hoi'))$$, 'tai khoan thu hoi: khong tao duoc su kien');
select t.as_user(:'U8');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Nguoi la'))$$, 'super_admin gia dinh khac: khong tao duoc su kien gia dinh nay');
select t.fails($$select public.create_event(current_setting('t.fid2')::uuid, t.ev('Sai nhanh', jsonb_build_object('branch_id', 'b0000000-0000-0000-0000-00000000000a')))$$, 'khong gan su kien vao nhanh cua gia dinh khac');
-- branch_admin A
select t.as_user(:'U3');
insert into t.ids select 'ba_A',  public.create_event(current_setting('t.fid')::uuid, t.ev('BA nhanh A',  jsonb_build_object('branch_id', :'BA')));
insert into t.ids select 'ba_A1', public.create_event(current_setting('t.fid')::uuid, t.ev('BA nhanh A1', jsonb_build_object('branch_id', :'BA1')));
select t.ok(t.id('ba_A') is not null and t.id('ba_A1') is not null, 'branch_admin A: tao duoc su kien nhanh A va nhanh con A1');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('BA nhanh B', jsonb_build_object('branch_id', 'b0000000-0000-0000-0000-00000000000b')))$$, 'branch_admin A: khong tao duoc su kien nhanh B');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('BA toan gia dinh'))$$, 'branch_admin: khong tao duoc su kien toan gia dinh');
select t.fails($$select public.update_event(t.id('visF'), '{"title":"Sua trai quyen"}'::jsonb)$$, 'branch_admin: khong sua duoc su kien toan gia dinh');
select t.fails($$select public.update_event(t.id('visB'), '{"title":"Sua trai quyen"}'::jsonb)$$, 'branch_admin A: khong sua duoc su kien nhanh B');
select t.fails($$select public.cancel_event(t.id('visBf'))$$, 'branch_admin A: khong huy duoc su kien nhanh B');
select public.update_event(t.id('ba_A'), '{"title":"BA nhanh A (sua)"}'::jsonb);
select t.ok((select title from public.events where id = t.id('ba_A')) = 'BA nhanh A (sua)', 'branch_admin A: sua duoc su kien nhanh A');
select t.fails($$select public.update_event(t.id('ba_A'), jsonb_build_object('branch_id', 'b0000000-0000-0000-0000-00000000000b'))$$, 'branch_admin A: khong chuyen duoc su kien sang nhanh B');
select t.fails($$select public.delete_event(t.id('ba_A'))$$, 'branch_admin: khong xoa han duoc (can quyen delete)');
-- family_admin tao du loai
select t.as_user(:'U2');
insert into t.ids select 'fa_ly', public.create_event(current_setting('t.fid')::uuid, t.ev('Gio ong', jsonb_build_object('recurrence','yearly_lunar','lunar_month',10,'lunar_day',3,'kind','memorial')));
insert into t.ids select 'fa_ys', public.create_event(current_setting('t.fid')::uuid, t.ev('Ky niem cuoi', jsonb_build_object('recurrence','yearly_solar','kind','anniversary','starts_at','2029-03-05T09:00:00+07:00')));
select t.ok(t.id('fa_ly') is not null and t.id('fa_ys') is not null, 'family_admin: tao su kien lap am lich va duong lich');
-- Kiem tra du lieu
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"starts_at":"2030-01-01T00:00:00Z"}'::jsonb)$$, 'thieu tieu de bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"   ","starts_at":"2030-01-01T00:00:00Z"}'::jsonb)$$, 'tieu de rong bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x"}'::jsonb)$$, 'thieu thoi gian bat dau bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"khong phai ngay"}'::jsonb)$$, 'ngay gio sai dinh dang bi tu choi (22023, khong lo loi noi bo)');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-02T00:00:00Z","ends_at":"2030-01-01T00:00:00Z"}'::jsonb)$$, 'ket thuc truoc bat dau bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","ends_at":"2030-03-01T00:00:00Z"}'::jsonb)$$, 'su kien keo dai qua 31 ngay bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","kind":"bay"}'::jsonb)$$, 'kind khong hop le bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","timezone":"Mars/Olympus"}'::jsonb)$$, 'mui gio khong ton tai bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","recurrence":"yearly_lunar"}'::jsonb)$$, 'lap am lich thieu thang/ngay am bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","recurrence":"yearly_lunar","lunar_month":13,"lunar_day":1}'::jsonb)$$, 'thang am 13 bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","recurrence":"hang_tuan"}'::jsonb)$$, 'kieu lap khong hop le bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","visibility":"branch"}'::jsonb)$$, 'visibility=branch ma khong co nhanh bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","visibility":"cong_khai"}'::jsonb)$$, 'visibility khong hop le bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"1800-01-01T00:00:00Z"}'::jsonb)$$, 'nam ngoai pham vi bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, jsonb_build_object('title', repeat('a', 201), 'starts_at', '2030-01-01T00:00:00Z'))$$, 'tieu de qua 200 ky tu bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","branch_id":"khong-phai-uuid"}'::jsonb)$$, 'branch_id sai dinh dang bi tu choi');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, '{"title":"x","starts_at":"2030-01-01T00:00:00Z","branch_id":"11111111-1111-1111-1111-111111111111"}'::jsonb)$$, 'branch_id khong ton tai bi tu choi');
select t.ok((select recurrence from public.events where id = t.id('fa_ys')) = 'yearly_solar' and (select lunar_month from public.events where id = t.id('fa_ys')) is null, 'lap duong lich: khong luu truong am lich');
-- Thanh vien khi che do MO
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open');
select t.as_user(:'U4');
insert into t.ids select 'm_fam', public.create_event(current_setting('t.fid')::uuid, t.ev('Member toan gia dinh'));
insert into t.ids select 'm_A',   public.create_event(current_setting('t.fid')::uuid, t.ev('Member nhanh A', jsonb_build_object('branch_id', :'BA')));
insert into t.ids select 'm_A1',  public.create_event(current_setting('t.fid')::uuid, t.ev('Member nhanh A1', jsonb_build_object('branch_id', :'BA1', 'visibility', 'branch')));
select t.ok(t.id('m_fam') is not null and t.id('m_A') is not null and t.id('m_A1') is not null, 'member: tao duoc su kien (toan gia dinh, nhanh A, nhanh con A1) khi che do MO');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Member nhanh B', jsonb_build_object('branch_id', 'b0000000-0000-0000-0000-00000000000b')))$$, 'member nhanh A: khong tao duoc su kien nhanh B du che do mo');
select t.ok((select created_by from public.events where id = t.id('m_fam')) = :'U4', 'created_by = nguoi tao');
select public.update_event(t.id('m_fam'), '{"location":"Nha tho ho"}'::jsonb);
select t.ok((select location from public.events where id = t.id('m_fam')) = 'Nha tho ho' and (select title from public.events where id = t.id('m_fam')) = 'Member toan gia dinh', 'member: sua su kien cua minh (cap nhat tung phan, giu truong khac)');
select t.fails($$select public.update_event(t.id('visF'), '{"title":"Member sua cua nguoi khac"}'::jsonb)$$, 'member: khong sua duoc su kien cua nguoi khac');
select t.fails($$select public.cancel_event(t.id('visF'))$$, 'member: khong huy duoc su kien cua nguoi khac');
select t.fails($$select public.delete_event(t.id('m_fam'))$$, 'member: khong xoa han duoc ke ca su kien cua minh');
select t.fails($$select public.update_event(t.id('m_A'), jsonb_build_object('branch_id', 'b0000000-0000-0000-0000-00000000000b'))$$, 'member: khong chuyen su kien cua minh sang nhanh B');
select t.fails($$select public.update_event(t.id('m_A'), '{"title":""}'::jsonb)$$, 'sua thanh tieu de rong bi tu choi');
select t.fails($$select public.update_event(t.id('m_A'), '{"starts_at":"2030-06-01T10:00:00+07:00","ends_at":"2020-01-01T00:00:00Z"}'::jsonb)$$, 'sua: ket thuc truoc bat dau bi tu choi');
select t.as_user(:'U5');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Khach khi mo'))$$, 'guest: van khong tao duoc khi che do mo');
-- Khoa lai: nguoi tao mat quyen sua/huy
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'locked');
select t.as_user(:'U4');
select t.fails($$select public.update_event(t.id('m_fam'), '{"title":"Sua khi khoa"}'::jsonb)$$, 'member: het quyen sua su kien cua minh khi che do chinh sua khoa lai');
select t.fails($$select public.cancel_event(t.id('m_fam'))$$, 'member: het quyen huy su kien cua minh khi khoa');
select t.ok(t.cnt($$select 1 from public.events where id = t.id('m_fam')$$) = 1, 'member: van XEM duoc su kien khi khoa');
-- Che do mo rieng cho nhanh: nhanh A khoa, gia dinh mo
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open');
select public.set_editing_mode(current_setting('t.fid')::uuid, :'BA'::uuid, 'locked');
select t.as_user(:'U4');
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Nhanh A dang khoa', jsonb_build_object('branch_id', 'b0000000-0000-0000-0000-00000000000a')))$$, 'member: nhanh A khoa rieng thi khong tao duoc su kien nhanh A');
insert into t.ids select 'm_fam2', public.create_event(current_setting('t.fid')::uuid, t.ev('Toan gia dinh van mo'));
select t.ok(t.id('m_fam2') is not null, 'member: van tao duoc su kien toan gia dinh khi gia dinh mo');
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, :'BA'::uuid, 'open');
-- Chong spam: toi da 30 su kien/24h voi nguoi khong phai quan tri
select t.as_user(:'U4');
do $$
declare n int; i int;
begin
  select count(*) into n from public.events where created_by = '00000000-0000-0000-0000-000000000004';
  for i in 1..(30 - n) loop
    perform public.create_event(current_setting('t.fid')::uuid, t.ev('Spam ' || i, '{"starts_at":"1950-01-01T00:00:00Z"}'::jsonb));
  end loop;
end $$;
select t.fails($$select public.create_event(current_setting('t.fid')::uuid, t.ev('Spam qua han muc'))$$, 'member: bi chan khi tao qua 30 su kien trong 24 gio');
select t.as_user(:'U2');
select t.ok(public.create_event(current_setting('t.fid')::uuid, t.ev('Admin khong bi gioi han')) is not null, 'quan tri khong bi gioi han chong spam');
-- Su kien da qua (mot lan) khong tao thong bao; su kien lap thi co
select t.as_root();
select t.ok((select count(*) from public.notifications where title like 'Sự kiện mới: Spam %') = 0, 'su kien mot lan da qua: khong bao thong bao');

-- =====================================================================
-- 4. Huy, xoa, nhat ky
-- =====================================================================
select t.as_user(:'U2');
insert into t.ids select 'toCancel', public.create_event(current_setting('t.fid')::uuid, t.ev('Se huy'));
select t.as_user(:'U4');
select public.set_rsvp(t.id('toCancel'), '2030-06-01', 'yes', 1, null);
select t.as_user(:'U5');
select t.fails($$select public.set_rsvp(t.id('toCancel'), '2030-06-01', 'yes')$$, 'guest: khong RSVP duoc (chi xem)');
select t.as_user(:'U2');
select public.cancel_event(t.id('toCancel'), 'Troi mua to');
select t.ok((select cancelled_at is not null and cancel_reason = 'Troi mua to' and cancelled_by = :'U2' from public.events where id = t.id('toCancel')), 'huy: ghi thoi gian, ly do, nguoi huy');
select public.cancel_event(t.id('toCancel'), 'lan hai');
select t.ok((select cancel_reason from public.events where id = t.id('toCancel')) = 'Troi mua to', 'huy lan hai: bo qua (idempotent), khong ghi de ly do');
select t.fails($$select public.update_event(t.id('toCancel'), '{"title":"Sua su kien da huy"}'::jsonb)$$, 'khong sua duoc su kien da huy');
select t.as_user(:'U4');
select t.fails($$select public.set_rsvp(t.id('toCancel'), '2030-06-01', 'no')$$, 'khong RSVP duoc su kien da huy');
select t.ok(t.cnt($$select 1 from public.events where id = t.id('toCancel')$$) = 1, 'su kien huy van xem duoc (hien "da huy")');
select t.as_root();
select t.ok((select count(*) from public.notifications where dedupe_key like 'event:' || t.id('toCancel')::text || ':cancel:%') = 1
            and (select count(*) from public.notifications where user_id = :'U4' and dedupe_key = 'event:' || t.id('toCancel')::text || ':cancel:' || :'U4') = 1,
            'huy: chi nguoi da tra loi co/co the (U4) duoc bao');
select t.as_user(:'U3');
select t.fails($$select public.delete_event(t.id('toCancel'))$$, 'branch_admin: khong xoa han');
select t.as_user(:'U2');
select public.delete_event(t.id('toCancel'));
select t.as_user(:'U4');
select t.ok(t.cnt($$select 1 from public.events where id = t.id('toCancel')$$) = 0, 'su kien da xoa (xoa mem) khong con thay');
select t.as_root();
select t.ok((select count(*) from public.events where id = t.id('toCancel') and deleted_at is not null) = 1, 'xoa mem: dong van con, co deleted_at');
select t.as_user(:'U2');
select t.fails($$select public.delete_event(t.id('toCancel'))$$, 'xoa lan hai: khong con tim thay');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'event.create' and entity_id = t.id('visF')::text) = 1, 'nhat ky: event.create');
select t.ok((select count(*) from public.audit_logs where action = 'event.update' and entity_id = t.id('ba_A')::text) = 1, 'nhat ky: event.update');
select t.ok((select count(*) from public.audit_logs where action = 'event.cancel' and entity_id = t.id('toCancel')::text) = 1, 'nhat ky: event.cancel (1 lan du huy hai lan)');
select t.ok((select count(*) from public.audit_logs where action = 'event.delete' and entity_id = t.id('toCancel')::text) = 1, 'nhat ky: event.delete');
select t.ok((select before_data->>'title' from public.audit_logs where action = 'event.update' and entity_id = t.id('ba_A')::text) = 'BA nhanh A'
            and (select after_data->>'title' from public.audit_logs where action = 'event.update' and entity_id = t.id('ba_A')::text) = 'BA nhanh A (sua)', 'nhat ky: luu truoc/sau khi sua');
select t.ok((select count(*) from public.audit_logs where action like 'event.%' and actor_id is null) = 0, 'nhat ky: moi dong co nguoi thuc hien');

-- Su kien thay doi gio -> bao nguoi da tra loi
select t.as_user(:'U2');
insert into t.ids select 'chg', public.create_event(current_setting('t.fid')::uuid, t.ev('Doi gio'));
select t.as_user(:'U4');
select public.set_rsvp(t.id('chg'), '2030-06-01', 'maybe', 0, null);
select t.as_user(:'U5');
select t.as_user(:'U2');
select public.update_event(t.id('chg'), '{"starts_at":"2030-06-01T19:00:00+07:00"}'::jsonb);
select public.update_event(t.id('chg'), '{"description":"chi doi mo ta"}'::jsonb);
select t.as_root();
select t.ok((select count(*) from public.notifications where title like 'Sự kiện đã thay đổi: Doi gio%') = 1
            and t.ntf(:'U4', 'Sự kiện đã thay đổi: Doi gio%') = 1, 'doi gio: chi nguoi da tra loi (U4) duoc bao; doi mo ta thi khong bao');

-- =====================================================================
-- 5. RSVP
-- =====================================================================
select t.as_user(:'U2');
insert into t.ids select 'rs_once', public.create_event(current_setting('t.fid')::uuid, t.ev('RSVP mot lan'));
insert into t.ids select 'rs_ly',   public.create_event(current_setting('t.fid')::uuid, t.ev('RSVP am lich', jsonb_build_object('recurrence','yearly_lunar','lunar_month',1,'lunar_day',1,'starts_at','2029-02-13T09:00:00+07:00')));
insert into t.ids select 'rs_ys',   public.create_event(current_setting('t.fid')::uuid, t.ev('RSVP duong lich', jsonb_build_object('recurrence','yearly_solar','starts_at','2029-03-05T09:00:00+07:00')));
insert into t.ids select 'rs_brB',  public.create_event(current_setting('t.fid')::uuid, t.ev('RSVP nhanh B', jsonb_build_object('branch_id', :'BB', 'visibility', 'branch')));
select t.as_user(:'U4');
select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes', 2, 'Di 3 nguoi');
select t.ok((select response = 'yes' and guests = 2 and note = 'Di 3 nguoi' from public.event_rsvps where event_id = t.id('rs_once') and user_id = :'U4'), 'member: RSVP co kem so khach va ghi chu');
select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'maybe', 1, null);
select t.ok((select count(*) from public.event_rsvps where event_id = t.id('rs_once') and user_id = :'U4') = 1
            and (select response from public.event_rsvps where event_id = t.id('rs_once') and user_id = :'U4') = 'maybe', 'RSVP lai: ghi de, khong trung dong');
select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'no', 5, null);
select t.ok((select guests from public.event_rsvps where event_id = t.id('rs_once') and user_id = :'U4') = 0, 'tra loi "khong tham du": so khach ve 0');
select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes', 1, null);
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'co')$$, 'RSVP: phan hoi khong hop le bi tu choi');
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes', 21)$$, 'RSVP: qua 20 khach bi tu choi');
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes', -1)$$, 'RSVP: so khach am bi tu choi');
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-06-02', 'yes')$$, 'RSVP: ngay khong phai ngay dien ra bi tu choi (su kien mot lan)');
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-05-31', 'yes')$$, 'RSVP: ngay truoc ngay bat dau bi tu choi');
select t.fails($$select public.set_rsvp(t.id('rs_once'), null, 'yes')$$, 'RSVP: thieu ngay bi tu choi');
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes', 0, repeat('a', 301))$$, 'RSVP: ghi chu qua 300 ky tu bi tu choi');
select t.fails($$select public.set_rsvp('11111111-1111-1111-1111-111111111111', '2030-06-01', 'yes')$$, 'RSVP: su kien khong ton tai');
select public.set_rsvp(t.id('rs_ly'), '2030-02-02', 'yes');
select t.ok(true, 'RSVP am lich: nhan dung ngay Tet 2030 (2/2/2030 theo am lich Viet Nam)');
select t.fails($$select public.set_rsvp(t.id('rs_ly'), '2030-02-03', 'yes')$$, 'RSVP am lich: ngay 3/2/2030 khong phai mung 1 -> tu choi');
select t.fails($$select public.set_rsvp(t.id('rs_ly'), '2029-02-14', 'yes')$$, 'RSVP am lich: ngay khac bi tu choi');
select public.set_rsvp(t.id('rs_ys'), '2030-03-05', 'yes');
select t.fails($$select public.set_rsvp(t.id('rs_ys'), '2030-03-06', 'yes')$$, 'RSVP duong lich: sai ngay bi tu choi');
select t.fails($$select public.set_rsvp(t.id('rs_brB'), '2030-06-01', 'yes')$$, 'RSVP: khong tra loi duoc su kien rieng nhanh minh khong thuoc');
select t.as_user(:'U6');
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes')$$, 'nguoi ngoai: khong RSVP duoc');
select t.as_user(:'U7');
select t.fails($$select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes')$$, 'tai khoan thu hoi: khong RSVP duoc');
select t.as_user(:'U3');
select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'no', 0, null);
select t.as_user(:'U1');
select public.set_rsvp(t.id('rs_once'), '2030-06-01', 'yes', 3, null);
-- Ai thay RSVP?
select t.as_user(:'U4');
select t.ok(t.cnt($$select 1 from public.event_rsvps where event_id = t.id('rs_once')$$) = 1, 'member: chi thay RSVP cua chinh minh (khong thay cua nguoi khac)');
select t.as_user(:'U5');
select t.ok(t.cnt($$select 1 from public.event_rsvps where event_id = t.id('rs_once')$$) = 0, 'guest: khong thay RSVP nao');
select t.as_user(:'U2');
select t.ok(t.cnt($$select 1 from public.event_rsvps where event_id = t.id('rs_once')$$) = 3, 'family_admin: thay danh sach tham du day du (3 nguoi)');
select t.as_user(:'U3');
select t.ok(t.cnt($$select 1 from public.event_rsvps where event_id = t.id('rs_once')$$) = 1, 'branch_admin: su kien toan gia dinh khong thuoc quyen sua -> chi thay RSVP cua minh');
-- Tong hop khong lo ten
select t.as_user(:'U4');
select t.ok((select yes_count from public.event_rsvp_counts(t.id('rs_once'), '2030-06-01')) = 2
            and (select no_count from public.event_rsvp_counts(t.id('rs_once'), '2030-06-01')) = 1
            and (select guests from public.event_rsvp_counts(t.id('rs_once'), '2030-06-01')) = 4, 'tong hop: dem co/khong/so khach cho moi nguoi xem duoc (2 co, 1 khong, 4 khach)');
select t.as_user(:'U5');
select t.ok((select yes_count from public.event_rsvp_counts(t.id('rs_once'), '2030-06-01')) = 2, 'guest: xem duoc tong hop');
select t.ok(not exists (select 1 from public.event_rsvp_counts(t.id('rs_brB'), '2030-06-01')), 'guest: khong xem tong hop su kien nhanh khong thuoc');
select t.as_user(:'U6');
select t.ok(not exists (select 1 from public.event_rsvp_counts(t.id('rs_once'), '2030-06-01')), 'nguoi ngoai: tong hop rong');
select t.as_anon();
select t.fails($$select * from public.event_rsvp_counts(t.id('rs_once'), '2030-06-01')$$, 'anon: khong goi duoc event_rsvp_counts');
-- Thu hoi quyen: mat quyen xem ngay lap tuc
select t.as_user(:'U1');
select public.revoke_membership((select id from public.family_memberships where user_id = :'U5'));
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.events') = 0, 'thu hoi quyen: khach mat quyen xem su kien ngay');
select t.as_root();
-- khoi phuc khach de cac kiem tra sau (dung truc tiep bang root)
update public.family_memberships set status = 'active', revoked_at = null where user_id = :'U5';

-- =====================================================================
-- 6. can_see_field_for nhat quan voi can_see_field (moi nguoi x moi ho so x moi muc rieng tu x tre em)
-- =====================================================================
select t.as_user(:'U2');
insert into t.ids select 'cs_admins', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','CS admins','branch_id',:'BA','birth_visibility','admins'));
insert into t.ids select 'cs_branchA', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','CS branch A','branch_id',:'BA','birth_visibility','branch'));
insert into t.ids select 'cs_branchB', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','CS branch B','branch_id',:'BB','birth_visibility','branch'));
insert into t.ids select 'cs_fam', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','CS family','branch_id',:'BB','birth_visibility','family'));
insert into t.ids select 'cs_nobranch', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','CS no branch','birth_visibility','branch'));
insert into t.ids select 'cs_a1', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','CS A1','branch_id',:'BA1','birth_visibility','branch'));
select t.as_user(:'U1');
select public.link_membership_member((select id from public.family_memberships where user_id = :'U4'), t.id('cs_branchB'));   -- U4 = chinh chu cs_branchB
select t.as_root();
create table t.cmp(u uuid, m uuid, vis text, minor boolean, a boolean, b boolean);
do $$
declare u uuid; m record; v text; mi boolean; a boolean; b boolean;
begin
  for u in select unnest(array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008']::uuid[]) loop
    perform set_config('request.jwt.claim.sub', u::text, true);
    for m in select id, family_id, branch_id from public.family_members where family_id = current_setting('t.fid')::uuid loop
      foreach v in array array['family','branch','admins'] loop
        foreach mi in array array[false, true] loop
          a := public.can_see_field(m.family_id, m.branch_id, m.id, v, mi);
          b := public._can_see_field_for(u, m.family_id, m.branch_id, m.id, v, mi);
          insert into t.cmp values (u, m.id, v, mi, a, b);
        end loop;
      end loop;
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select t.ok((select count(*) from t.cmp) >= 8 * 6 * 6, 'can_see_field_for: da so sanh du tat ca to hop (>= 288)');
select t.ok((select count(*) from t.cmp where a is distinct from b) = 0, 'can_see_field_for: KHONG lech so voi can_see_field o bat ky to hop nao');
select t.ok((select count(*) from t.cmp where a) > 20 and (select count(*) from t.cmp where not a) > 20, 'can_see_field_for: phep so sanh co ca ket qua dung lan sai (khong tam thuong)');
select t.ok((select count(*) from t.cmp where u = :'U6' and a) = 0 and (select count(*) from t.cmp where u = :'U7' and b) = 0, 'can_see_field_for: nguoi ngoai va tai khoan thu hoi khong thay gi');
select t.ok((select bool_and(b) from t.cmp where u = :'U4' and m = t.id('cs_branchB')), 'can_see_field_for: chinh chu luon thay ho so cua minh');
-- can_view_event_for nhat quan voi can_view_event
create table t.cmp2(u uuid, br uuid, vis text, a boolean, b boolean);
do $$
declare u uuid; br uuid; v text; a boolean; b boolean;
begin
  for u in select unnest(array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008']::uuid[]) loop
    perform set_config('request.jwt.claim.sub', u::text, true);
    foreach br in array array[null, 'b0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000a1']::uuid[] loop
      foreach v in array array['family','branch'] loop
        a := public.can_view_event(current_setting('t.fid')::uuid, br, v);
        b := public._can_view_event_for(u, current_setting('t.fid')::uuid, br, v);
        insert into t.cmp2 values (u, br, v, a, b);
      end loop;
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select t.ok((select count(*) from t.cmp2) = 64 and (select count(*) from t.cmp2 where a is distinct from b) = 0, 'can_view_event_for: khop can_view_event o ca 64 to hop');
select t.ok((select count(*) from t.cmp2 where a) between 10 and 50, 'can_view_event_for: phep so sanh co ca dung lan sai');
select t.ok((select a from t.cmp2 where u = :'U5' and br is null and vis = 'branch') = false
            and (select a from t.cmp2 where u = :'U2' and br is null and vis = 'branch') = true, 'su kien "nhanh" bi mat nhanh: chi quan tri gia dinh thay (an toan)');
-- Go lien ket de cac kich ban sau khong bi anh huong (U4 tro lai gan voi "Bo" o phan 7)
select t.as_user(:'U1');
select public.link_membership_member((select id from public.family_memberships where user_id = :'U4'), null);
select t.as_root();

-- =====================================================================
-- 7. Job thong bao hang ngay
-- =====================================================================
-- Mui gio: U3 o Los Angeles, con lai o Viet Nam (mac dinh)
select t.as_user(:'U3');
update public.user_profiles set timezone = 'America/Los_Angeles', country_code = 'US' where id = '00000000-0000-0000-0000-000000000003';
select t.fails($$update public.user_profiles set timezone = 'Khong/Co' where id = '00000000-0000-0000-0000-000000000003'$$, 'mui gio khong ton tai bi tu choi (trigger)');
update public.user_profiles set timezone = 'Asia/Tokyo' where id = '00000000-0000-0000-0000-000000000002';
select t.as_root();
select t.ok((select timezone from public.user_profiles where id = :'U2') = 'Asia/Ho_Chi_Minh', 'khong doi duoc mui gio cua nguoi khac (RLS: 0 dong bi sua)');
select t.as_user(:'U3');
select t.as_root();
select t.ok((select timezone from public.user_profiles where id = :'U3') = 'America/Los_Angeles', 'U3 o Los Angeles');

-- Ho so mau (family_admin tao). Ngay muc tieu T = 11/11/2026 (gio Viet Nam): am lich 3 thang 10.
select t.as_user(:'U2');
insert into t.ids select 'Alice', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Alice','branch_id',:'BA','birth_solar_year',1980,'birth_solar_month',11,'birth_solar_day',11));
insert into t.ids select 'Bao', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Bao','branch_id',:'BA','birthday_mode','lunar','birth_solar_year',1970,'birth_solar_month',5,'birth_solar_day',5,'birth_lunar_year',1970,'birth_lunar_month',10,'birth_lunar_day',3));
insert into t.ids select 'Chi', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Chi','branch_id',:'BA','birthday_mode','both','birth_solar_year',1990,'birth_solar_month',11,'birth_solar_day',11,'birth_lunar_year',1990,'birth_lunar_month',10,'birth_lunar_day',3));
insert into t.ids select 'Dung', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Dung','branch_id',:'BA','birth_solar_year',1985,'birth_solar_month',11,'birth_solar_day',11,'birth_visibility','admins'));
insert into t.ids select 'Em', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Em','branch_id',:'BB','birth_solar_year',1992,'birth_solar_month',11,'birth_solar_day',11,'birth_visibility','branch'));
insert into t.ids select 'Kid', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Kid','branch_id',:'BB','birth_solar_year',extract(year from now())::int - 10,'birth_solar_month',11,'birth_solar_day',11,'birth_visibility','family'));
insert into t.ids select 'Bo', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Bo','branch_id',:'BA','birth_solar_year',1975,'birth_solar_month',11,'birth_solar_day',11,'birth_visibility','admins'));
insert into t.ids select 'Bay', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Bay','branch_id',:'BA','birth_solar_year',1960,'birth_solar_month',11,'birth_solar_day',18));
insert into t.ids select 'Ong', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Ong','branch_id',:'BA','is_deceased',true,'death_lunar_month',10,'death_lunar_day',3,'death_solar_year',2020));
insert into t.ids select 'Cu', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Cu','branch_id',:'BA','is_deceased',true,'death_solar_year',2020,'death_solar_month',11,'death_solar_day',17,'death_visibility','admins'));
insert into t.ids select 'Cuoi', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Cuoi','branch_id',:'BA','is_deceased',true,'death_lunar_month',6,'death_lunar_day',15,'death_lunar_leap',true,'death_solar_year',2024));
insert into t.ids select 'Hai', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Hai','branch_id',:'BA','is_deceased',true,'death_lunar_month',2,'death_lunar_day',30,'death_solar_year',2019));
insert into t.ids select 'Xoa', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Xoa','branch_id',:'BA','birth_solar_year',1980,'birth_solar_month',11,'birth_solar_day',11));
insert into t.ids select 'Quado', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Quado','branch_id',:'BA','is_deceased',true,'birth_solar_year',1930,'birth_solar_month',11,'birth_solar_day',11));
insert into t.ids select 'Moi', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Moi','branch_id',:'BA','birth_solar_year',2026,'birth_solar_month',11,'birth_solar_day',11));
insert into t.ids select 'Thieu', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Thieu','branch_id',:'BA','birth_solar_year',1980));
insert into t.ids select 'Loi', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Loi','branch_id',:'BA','birthday_mode','lunar','birth_solar_year',1990,'birth_solar_month',2,'birth_solar_day',31));
insert into t.ids select 'Nhuan', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Nhuan','branch_id',:'BA','birth_solar_year',2000,'birth_solar_month',2,'birth_solar_day',29));
select public.delete_member(t.id('Xoa'));
select t.as_user(:'U1');
select public.link_membership_member((select id from public.family_memberships where user_id = :'U4'), t.id('Bo'));

-- Tuy chon thong bao: U5 tat sinh nhat (van nhan ngay gio); U4 chi bao dung ngay + khong nhan nhac su kien
select t.as_user(:'U5');
select public.save_notification_preferences(current_setting('t.fid')::uuid, false, '{0,1,7}', true, true, true, true, true);
select t.as_user(:'U4');
select public.save_notification_preferences(current_setting('t.fid')::uuid, true, '{0}', true, false, true, true, true);

-- Su kien de nhac (U2 tao). Gio la theo mui gio Viet Nam.
select t.as_user(:'U2');
insert into t.ids select 'e1', public.create_event(current_setting('t.fid')::uuid, t.ev('Tiec VN', '{"starts_at":"2026-11-11T23:00:00+07:00"}'::jsonb));
insert into t.ids select 'e2', public.create_event(current_setting('t.fid')::uuid, t.ev('Hop nhanh B', jsonb_build_object('starts_at','2026-11-11T10:00:00+07:00','branch_id',:'BB','visibility','branch')));
insert into t.ids select 'e3', public.create_event(current_setting('t.fid')::uuid, t.ev('Gio To', '{"starts_at":"2020-11-17T09:00:00+07:00","recurrence":"yearly_lunar","lunar_month":10,"lunar_day":3,"kind":"memorial"}'::jsonb));
insert into t.ids select 'e4', public.create_event(current_setting('t.fid')::uuid, t.ev('Huy roi', '{"starts_at":"2026-11-11T10:00:00+07:00"}'::jsonb));
select public.cancel_event(t.id('e4'));
insert into t.ids select 'e5', public.create_event(current_setting('t.fid')::uuid, t.ev('Khong di', '{"starts_at":"2026-11-11T12:00:00+07:00"}'::jsonb));
insert into t.ids select 'e6', public.create_event(current_setting('t.fid')::uuid, t.ev('Ca ngay', '{"starts_at":"2026-11-12T00:00:00+07:00","all_day":true,"location":"Nha tho"}'::jsonb));
insert into t.ids select 'e7', public.create_event(current_setting('t.fid')::uuid, t.ev('Da xoa', '{"starts_at":"2026-11-11T10:00:00+07:00"}'::jsonb));
select public.delete_event(t.id('e7'));
select t.as_root();
-- U5 tra loi "khong" cho e5 (chen truc tiep vi ngay muc tieu o tuong lai gan/xa tuy dong ho may)
insert into public.event_rsvps (event_id, user_id, family_id, occurrence, response) values (t.id('e5'), :'U5', current_setting('t.fid')::uuid, '2026-11-11', 'no');
delete from public.notifications;    -- bo thong bao tao boi cac phan truoc, chi do thong bao cua job

-- p_now: 10/11/2026 17:00 UTC = 0h ngay 11/11 gio Viet Nam = 9h ngay 10/11 o Los Angeles
select public.generate_daily_notifications('2026-11-10 17:00:00+00') as r1 \gset
select t.ok((:'r1'::jsonb->>'created')::int > 0 and (:'r1'::jsonb->>'families')::int >= 2, 'job: tra ve tong ket (so thong bao tao ra > 0)');
select t.ok(not has_function_privilege('authenticated', 'public.generate_daily_notifications(timestamptz)', 'execute')
            and has_function_privilege('service_role', 'public.generate_daily_notifications(timestamptz)', 'execute'), 'job: chi service_role co quyen chay');

-- Sinh nhat / ngay gio, nguoi nhan o Viet Nam (U1, U2): thay het
select t.ok(t.ntf(:'U2', 'Hôm nay là sinh nhật %') = 7, 'family_admin (VN): 7 sinh nhat hom nay (Alice, Bao am lich, Chi, Dung, Em, Kid, Bo)');
select t.ok(t.ntf(:'U1', 'Hôm nay là sinh nhật %') = 7, 'super_admin (VN): 7 sinh nhat hom nay');
select t.ok(t.ntf(:'U2', 'Hôm nay là ngày giỗ của %') = 2, 'family_admin: 2 ngay gio hom nay (Ong am lich, Cu suy ra am tu ngay mat duong)');
select t.ok(t.ntf(:'U2', 'Hôm nay là sinh nhật Alice') = 1, 'sinh nhat duong lich: Alice');
select t.ok(t.ntf(:'U2', 'Hôm nay là sinh nhật Bao') = 1, 'sinh nhat am lich (3/10): Bao dung ngay 11/11/2026');
select t.ok(t.ntf(:'U2', 'Hôm nay là sinh nhật Chi') = 1, 'che do "both": Chi trung ca duong va am nhung chi mot thong bao');
select t.ok(t.ntf(:'U2', '%Moi%') = 0, 'ho so sinh nam 2026: chua toi sinh nhat dau tien -> khong bao');
select t.ok(t.ntf(:'U2', '%Xoa%') = 0, 'ho so da xoa mem: khong bao');
select t.ok(t.ntf(:'U2', '%Quado%') = 0, 'nguoi da mat: khong bao sinh nhat');
select t.ok(t.ntf(:'U2', '%Thieu%') = 0 and t.ntf(:'U2', '%Loi%') = 0, 'thieu thang/ngay hoac ngay sai (31/2): khong bao va khong gay loi');
select t.ok(t.ntfb(:'U2', 'Hôm nay là sinh nhật Bao', '%Tròn 56 tuổi%âm lịch 3/10%') = 1, 'noi dung: tuoi theo nam am (56) va ngay am lich 3/10');
select t.ok(t.ntfb(:'U2', 'Hôm nay là sinh nhật Alice', '%Tròn 46 tuổi%Dương lịch 11/11%âm lịch 3/10%') = 1, 'noi dung: tuoi 46, duong lich 11/11, am lich 3/10');
select t.ok(t.ntfb(:'U2', 'Hôm nay là ngày giỗ của Ong', '%Giỗ lần thứ 6%') = 1, 'ngay gio: lan thu 6 (2026 - 2020)');
select t.ok(t.ntfb(:'U2', 'Hôm nay là ngày giỗ của Cu', '%Giỗ lần thứ 6%âm lịch 3/10%') = 1, 'ngay gio suy tu ngay mat duong 17/11/2020 = 3/10 am; lan thu 6');
-- Con 7 ngay: Bay (18/11)
select t.ok(t.ntf(:'U2', 'Còn 7 ngày nữa là sinh nhật Bay') = 1, 'bao truoc 7 ngay (mac dinh {0,1,7})');
select t.ok(t.ntf(:'U4', 'Còn 7 ngày nữa là sinh nhật Bay') = 0, 'U4 chi dat bao dung ngay {0}: khong nhan "con 7 ngay"');
-- Quyen xem ngay sinh: U4 (member nhanh A, tu la "Bo")
select t.ok(t.ntf(:'U4', 'Hôm nay là sinh nhật %') = 3, 'member nhanh A: chi 3 sinh nhat (Alice, Bao, Chi) - khong Dung(admins), Em(nhanh B), Kid(tre em nhanh B)');
select t.ok(t.ntf(:'U4', 'Hôm nay là sinh nhật Dung') = 0 and t.ntf(:'U4', 'Hôm nay là sinh nhật Em') = 0 and t.ntf(:'U4', 'Hôm nay là sinh nhật Kid') = 0, 'member: khong lo ngay sinh bi che');
select t.ok(t.ntf(:'U4', 'Chúc mừng sinh nhật, Bo!') = 1 and t.ntf(:'U4', 'Hôm nay là sinh nhật Bo') = 0, 'chu ho so: nhan loi chuc mung rieng (du ngay sinh dat chi quan tri)');
select t.ok(t.ntf(:'U2', 'Chúc mừng sinh nhật%') = 0, 'nguoi khac khong nhan loi chuc mung gui cho chu ho so');
select t.ok(t.ntf(:'U4', 'Hôm nay là ngày giỗ của %') = 1 and t.ntf(:'U4', 'Hôm nay là ngày giỗ của Cu') = 0, 'member: thay gio Ong (cong khai), khong thay gio Cu (chi quan tri)');
-- Khach U5: tat sinh nhat, van nhan ngay gio
select t.ok(t.ntfk(:'U5', 'birthday') = 0, 'U5 tat thong bao sinh nhat: khong nhan sinh nhat');
select t.ok(t.ntf(:'U5', 'Hôm nay là ngày giỗ của Ong') = 1 and t.ntfk(:'U5', 'death_anniversary') = 1, 'U5 van nhan ngay gio (cong khai)');
-- Branch admin A o Los Angeles: gio dia phuong 10/11 nen 11/11 la "ngay mai"
select t.ok(t.ntf(:'U3', 'Hôm nay là sinh nhật %') = 0, 'LA (10/11): chua toi hom nay');
select t.ok(t.ntf(:'U3', 'Ngày mai là sinh nhật %') = 5, 'LA: "ngay mai" 5 sinh nhat trong pham vi (Alice, Bao, Chi, Dung, Bo); khong Em/Kid nhanh B');
select t.ok(t.ntf(:'U3', 'Ngày mai là ngày giỗ của %') = 2, 'LA: "ngay mai" 2 ngay gio (Ong, Cu trong nhanh A)');
select t.ok(t.ntf(:'U3', 'Còn 7 ngày nữa là sinh nhật Bay') = 0, 'LA: 10/11 + 7 = 17/11, Bay (18/11) chua toi');
-- Nguoi ngoai / thu hoi / khong quyen
select t.ok((select count(*) from public.notifications where user_id in (:'U6', :'U7', :'U8')) = 0, 'nguoi ngoai/thu hoi/chua co quyen: khong nhan thong bao nao');
select t.ok((select count(*) from public.notifications where user_id = :'U8') = 0, 'super_admin cua gia dinh khac khong nhan thong bao gia dinh nay');
select t.ok((select count(*) from public.notifications n where family_id <> current_setting('t.fid')::uuid) = 0, 'khong thong bao nao ro sang gia dinh khac');
-- Nhac su kien
select t.ok(t.ntf(:'U2', 'Hôm nay: Tiec VN') = 1, 'VN: tiec 23h ngay 11/11 -> "hom nay"');
select t.ok(t.ntf(:'U3', 'Ngày mai: Tiec VN') = 1 and t.ntf(:'U3', 'Hôm nay: Tiec VN') = 0, 'LA: cung su kien do 8h sang 11/11 gio LA -> "ngay mai"');
select t.ok(t.ntfb(:'U3', 'Ngày mai: Tiec VN', '%08:00 ngày 11/11 (giờ của bạn)%') = 1, 'LA: gio hien thi theo mui gio nguoi nhan (08:00 11/11)');
select t.ok(t.ntfb(:'U2', 'Hôm nay: Tiec VN', '%23:00 ngày 11/11 (giờ của bạn)%') = 1, 'VN: gio hien thi 23:00 11/11');
select t.ok(t.ntf(:'U2', 'Hôm nay: Hop nhanh B') = 1 and t.ntf(:'U3', '%Hop nhanh B%') = 0 and t.ntf(:'U5', '%Hop nhanh B%') = 0, 'su kien rieng nhanh B: chi quan tri gia dinh nhan nhac');
select t.ok(t.ntf(:'U2', 'Hôm nay: Gio To') = 1, 'su kien lap theo am lich (3/10): nhac dung ngay 11/11/2026');
select t.ok(t.ntf(:'U3', 'Hôm nay: Gio To') = 1, 'LA: gio To 9h VN = 18h ngay 10/11 LA -> "hom nay" (theo ngay dia phuong)');
select t.ok(t.ntf(:'U2', '%Huy roi%') = 0 and t.ntf(:'U2', '%Da xoa%') = 0, 'su kien da huy / da xoa: khong nhac');
select t.ok(t.ntf(:'U2', 'Hôm nay: Khong di') = 1 and t.ntf(:'U5', '%Khong di%') = 0, 'nguoi da tra loi "khong": khong nhac; nguoi khac van nhan');
select t.ok(t.ntfb(:'U2', 'Ngày mai: Ca ngay', 'Cả ngày 12/11 · Nha tho') = 1, 'su kien ca ngay: "Ca ngay 12/11" kem dia diem, khong doi theo mui gio');
select t.ok(t.ntf(:'U3', '%Ca ngay%') = 0, 'LA: su kien ca ngay 12/11 chua toi ("ngay mai" cua LA la 11/11)');
select t.ok(t.ntfk(:'U4', 'event_reminder') = 0, 'U4 tat nhac su kien: khong nhan nhac nao');
select t.ok(t.ntfk(:'U5', 'event_reminder') = 3, 'khach U5: Tiec VN, Gio To, Ca ngay (da tra loi khong cho Khong di; khong thay Hop nhanh B)');
select t.ok(t.ntfk(:'U2', 'event_reminder') = 5, 'family_admin: Tiec VN, Hop nhanh B, Gio To, Khong di, Ca ngay (5)');
select t.ok((select count(*) from public.notifications where link !~ '^/') = 0, 'moi lien ket thong bao la duong dan noi bo');

-- Chay lai: khong trung
select count(*) as n_before from public.notifications \gset
select public.generate_daily_notifications('2026-11-10 17:00:00+00') as r2 \gset
select t.ok((:'r2'::jsonb->>'created')::int = 0 and (select count(*) from public.notifications) = :n_before, 'chay lai cung thoi diem: khong tao them thong bao nao (dedupe)');
select public.generate_daily_notifications('2026-11-10 18:30:00+00') as r2b \gset
select t.ok((:'r2b'::jsonb->>'created')::int = 0, 'chay lai sau vai gio (cung ngay dia phuong): van khong trung');
-- Ngay hom sau: chi tao thong bao moi cho ngay moi, khong lap lai ngay cu
select public.generate_daily_notifications('2026-11-11 17:00:00+00') as r3 \gset
select t.ok(t.ntf(:'U2', 'Hôm nay là sinh nhật Alice') = 1 and t.ntf(:'U2', 'Ngày mai là sinh nhật Alice') = 0, 'ngay hom sau: khong bao lai sinh nhat Alice (da qua)');
select t.ok(t.ntf(:'U2', 'Hôm nay: Ca ngay') = 1, 'ngay 12/11 (VN): su kien ca ngay thanh "hom nay" - thong bao moi, khong trung "ngay mai" truoc do');
select t.ok(t.ntf(:'U3', 'Hôm nay: Tiec VN') = 1, 'LA 11/11 9h: Tiec VN thanh "hom nay"');

-- Quy tac thang nhuan / ngay 30 / 29-2
select public.generate_daily_notifications('2026-07-27 17:00:00+00');   -- gio VN: 28/7/2026
select t.ok(t.ntf(:'U2', 'Hôm nay là ngày giỗ của Cuoi') = 1 and t.ntfb(:'U2', 'Hôm nay là ngày giỗ của Cuoi', '%Giỗ lần thứ 2%') = 1,
            'gio nhuan 6: nam 2026 khong co nhuan 6 -> dung thang 6 thuong (28/7/2026), lan thu 2');
select public.generate_daily_notifications('2025-08-07 17:00:00+00');   -- gio VN: 8/8/2025 (nhuan thang 6/2025)
select t.ok(t.ntfb(:'U2', 'Hôm nay là ngày giỗ của Cuoi', '%Giỗ lần thứ 1%') = 1, 'gio nhuan 6: nam 2025 co nhuan 6 -> dung thang nhuan (8/8/2025), lan thu 1');
select public.generate_daily_notifications('2026-04-15 17:00:00+00');   -- gio VN: 16/4/2026
select t.ok(t.ntf(:'U2', 'Hôm nay là ngày giỗ của Hai') = 1, 'gio ngay 30 thang thieu: 30/2 -> 29/2 am = 16/4/2026');
select public.generate_daily_notifications('2027-02-27 17:00:00+00');   -- gio VN: 28/2/2027
select t.ok(t.ntf(:'U2', 'Hôm nay là sinh nhật Nhuan') = 1, 'sinh 29/2: nam 2027 khong nhuan -> bao vao 28/2');
select public.generate_daily_notifications('2028-02-27 17:00:00+00');   -- gio VN: 28/2/2028 (nam nhuan)
select t.ok(t.ntfb(:'U2', 'Hôm nay là sinh nhật Nhuan', '%Tròn 28 tuổi%') = 0 and (select count(*) from public.notifications where user_id = :'U2' and title = 'Hôm nay là sinh nhật Nhuan' and body like '%28/02%') = 1,
            'sinh 29/2: nam 2028 nhuan khong bao vao 28/2 (chi co thong bao cua 2027)');
select public.generate_daily_notifications('2028-02-28 17:00:00+00');   -- gio VN: 29/2/2028
select t.ok(t.ntfb(:'U2', 'Hôm nay là sinh nhật Nhuan', '%Tròn 28 tuổi%Dương lịch 29/02%') = 1, 'sinh 29/2: nam nhuan 2028 bao dung 29/2');
-- Nhat ky tao ra boi tao thanh vien/su kien da kiem o tren; thong bao khong ghi nhat ky gia
select t.ok((select count(*) from public.audit_logs where action like 'notification%') = 0, 'job khong ghi nhat ky thao tac nguoi dung');

-- Thong bao cua nguoi dung: chi thay cua minh, danh dau da doc
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.notifications where user_id <> auth.uid()') = 0, 'member: chi thay thong bao cua minh');
select t.ok(public.mark_notifications_read(null) >= 1 and t.cnt('select 1 from public.notifications where read_at is null') = 0, 'danh dau da doc het thong bao cua minh');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.notifications where read_at is null') > 0, 'danh dau da doc cua U4 khong anh huong thong bao cua U2');

-- Nhat ky xuat hien cho nguoi co quyen xem
select t.as_user(:'U1');
select t.ok(t.cnt($$select 1 from public.audit_logs where action = 'event.create'$$) >= 10, 'super_admin xem duoc nhat ky tao su kien');
select t.as_user(:'U4');
select t.ok(t.cnt($$select 1 from public.audit_logs$$) = 0, 'member khong xem duoc nhat ky');

-- ===== Nhat ky xuat lich (.ics): migration 5 =====
select t.as_user(:'U4');
select public.log_calendar_export(:'fid', 'events', 7);
select t.as_user(:'U5');
select public.log_calendar_export(:'fid', 'all', 3);
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'calendar.export') = 2, 'xuat lich: member va khach deu ghi nhat ky (moi nguoi mot dong)');
select t.ok((select (after_data->>'count')::int from public.audit_logs where action = 'calendar.export' and actor_id = :'U4') = 7
            and (select after_data->>'scope' from public.audit_logs where action = 'calendar.export' and actor_id = :'U4') = 'events', 'xuat lich: nhat ky luu pham vi va so muc');
select t.as_user(:'U6');
select t.fails(format($$select public.log_calendar_export(%L, 'all', 1)$$, :'fid'), 'xuat lich: nguoi ngoai khong ghi duoc nhat ky vao gia dinh');
select t.as_user(:'U7');
select t.fails(format($$select public.log_calendar_export(%L, 'all', 1)$$, :'fid'), 'xuat lich: tai khoan da thu hoi bi chan');
select t.as_anon();
select t.fails(format($$select public.log_calendar_export(%L, 'all', 1)$$, :'fid'), 'xuat lich: anon bi chan');
select t.as_user(:'U4');
select t.fails(format($$select public.log_calendar_export(%L, 'bogus', 1)$$, :'fid'), 'xuat lich: pham vi khong hop le bi tu choi');
select t.fails(format($$insert into public.audit_logs (family_id, action, entity_type) values (%L, 'calendar.export', 'x')$$, :'fid'), 'xuat lich: khong ghi truc tiep vao nhat ky');

-- ===== Tong ket =====
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
