-- Kiem thu RLS + nghiep vu cho Module G (Tro choi giai tri gia dinh - DIEM AO).
-- Chay boi run_rls_tests.sh (can rls_helpers.sql nap truoc). Du lieu mau CHI nam trong CSDL kiem thu.
\set ON_ERROR_STOP on
\ir rls_fixture.sql

create table t.ids(k text primary key, v uuid);
grant select, insert, update on t.ids to public;
create function t.id(k text) returns uuid language sql stable as $$ select v from t.ids where t.ids.k = $1 $$;
grant execute on function t.id(text) to public;
create function t.cnt(sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || sql || ') q' into n; return n; end $$;
grant execute on function t.cnt(text) to public;
-- Mong doi bi tu choi VOI thong diep khop mau
create function t.fails_with(sql text, pat text, name text) returns void language plpgsql as $$
declare msg text; okk boolean := false;
begin
  begin execute sql; exception when others then msg := sqlerrm; okk := (sqlerrm ~ pat); end;
  perform t.ok(okk, name || coalesce('  [' || msg || ']', '  [KHONG bi tu choi]'));
end $$;
grant execute on function t.fails_with(text, text, text) to public;

\set U1 '00000000-0000-0000-0000-000000000001'
\set U2 '00000000-0000-0000-0000-000000000002'
\set U3 '00000000-0000-0000-0000-000000000003'
\set U4 '00000000-0000-0000-0000-000000000004'
\set U5 '00000000-0000-0000-0000-000000000005'
\set U6 '00000000-0000-0000-0000-000000000006'
\set U7 '00000000-0000-0000-0000-000000000007'
\set U8 '00000000-0000-0000-0000-000000000008'

-- "Vector vang": ket qua da tinh bang ban TypeScript (src/lib/games/fair.ts), SQL phai cho DUNG ket qua nay
select t.as_root();
select t.ok(public.fair_commit(repeat('00', 32)) = '60e05bd1b195af2f94112fa7197a5c88289058840ce7c6df9693756bc6250f55',
  'vector vang: fair_commit khop ban TypeScript');
select t.ok(public.fair_commit('abc') = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256(abc) dung chuan');
select t.ok(public.fair_shuffle(repeat('00', 32), 10) = array[10,6,4,7,1,8,2,5,9,3], 'vector vang: fair_shuffle(10) khop ban TypeScript');
select t.ok(public.fair_shuffle(repeat('ab', 32), 1) = array[1], 'vector vang: fair_shuffle(1)');
select t.ok(public.fair_shuffle(repeat('0123456789abcdef', 4), 90) = array[84,18,34,27,62,85,66,80,29,68,15,24,76,71,75,56,67,30,16,31,55,39,21,35,28,45,19,9,57,72,88,82,1,46,38,8,59,70,89,43,77,2,54,17,20,48,49,52,11,6,3,51,25,83,33,60,42,90,87,86,64,78,40,53,61,79,58,50,4,47,7,81,36,44,12,69,32,23,26,37,65,73,14,41,63,13,5,10,22,74],
  'vector vang: fair_shuffle(90) khop ban TypeScript');
select t.ok(public.lottery_compute_winners(repeat('0123456789abcdef', 4),
  '[{"no":1,"owner":"u1"},{"no":2,"owner":"u1"},{"no":3,"owner":"u2"},{"no":4,"owner":"u3"},{"no":5,"owner":"u3"},{"no":6,"owner":"u3"},{"no":7,"owner":"u4"},{"no":8,"owner":"u5"}]'::jsonb, 3) = array[2,4,7],
  'vector vang: lottery_compute_winners (3 giai) khop ban TypeScript');
select t.ok(public.lottery_compute_winners(repeat('fedcba9876543210', 4),
  '[{"no":8,"owner":"u5"},{"no":7,"owner":"u4"},{"no":1,"owner":"u1"},{"no":2,"owner":"u1"},{"no":3,"owner":"u2"},{"no":4,"owner":"u3"},{"no":5,"owner":"u3"},{"no":6,"owner":"u3"}]'::jsonb, 6) = array[1,6,8,7,3],
  'vector vang: lottery_compute_winners (6 giai, chi 5 nguoi, thu tu vao tuy y) khop ban TypeScript');
select t.ok(public.fair_shuffle(repeat('0123456789abcdef', 4), 90) <> public.fair_shuffle(repeat('0123456789abcdee', 4), 90), 'seed khac cho hoan vi khac');
select t.ok((select array_agg(x order by x) from unnest(public.fair_shuffle(repeat('7f', 32), 90)) x) = (select array_agg(g) from generate_series(1, 90) g), 'fair_shuffle la hoan vi cua 1..90');

-- ===== 1. Mac dinh TAT; moi ham choi bi tu choi khi module tat =====
select t.as_root();
select t.ok((select enabled from public.game_settings where family_id = current_setting('t.fid')::uuid) = false, 'mac dinh: module tro choi TAT');

select t.as_user(:'U2');   -- family_admin tao bao li xi truoc (duoc phep cau hinh khi dang tat)
insert into t.ids select 'pk_off', public.lixi_create(current_setting('t.fid')::uuid, 'Bao thu', array[5,10]);
select t.as_user(:'U4');
select t.fails_with($$select public.points_my_balance(current_setting('t.fid')::uuid)$$, 'games_disabled', 'tat module: xem so du bi tu choi');
select t.fails_with($$select public.claim_daily_gift(current_setting('t.fid')::uuid)$$, 'games_disabled', 'tat module: qua hang ngay bi tu choi');
select t.fails_with($$select public.lixi_draw(t.id('pk_off'))$$, 'games_disabled', 'tat module: boc li xi bi tu choi');
select t.fails_with($$select public.games_leaderboard(current_setting('t.fid')::uuid)$$, 'games_disabled', 'tat module: bang xep hang bi tu choi');
select t.ok(t.cnt('select 1 from public.lixi_packets') = 0, 'tat module: thanh vien khong thay bao li xi');
select t.ok(t.cnt('select 1 from public.game_settings') = 1, 'thanh vien doc duoc cai dat de biet module dang tat');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.lixi_packets') = 1, 'quan tri van thay du lieu de cau hinh khi module tat');

-- ===== 2. Quyen quan tri; nguoi ngoai / thu hoi / khach / chua dang nhap =====
select t.as_user(:'U4');
select t.fails_with($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000)$$, 'forbidden', 'thanh vien khong bat/tat duoc module');
select t.as_user(:'U3');
select t.fails_with($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000)$$, 'forbidden', 'quan tri nhanh khong bat/tat duoc module');
select t.as_user(:'U5');
select t.fails_with($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000)$$, 'forbidden', 'khach khong bat/tat duoc module');
select t.as_user(:'U6');
select t.fails($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000)$$, 'nguoi ngoai khong bat/tat duoc');
select t.ok(t.cnt('select 1 from public.game_settings') = 0, 'nguoi ngoai khong doc duoc cai dat');
select t.as_anon();
select t.fails($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000)$$, 'chua dang nhap khong bat/tat duoc');
select t.fails($$select public.points_my_balance(current_setting('t.fid')::uuid)$$, 'anon khong goi duoc ham so du');
select t.fails($$select * from public.game_settings$$, 'anon khong doc duoc bang cai dat');

select t.as_user(:'U2');
select t.fails($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 9, 5, 10, 100, 5000)$$, 'cai dat sai: cuoc toi thieu > toi da bi tu choi');
select t.fails($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 5000, 10, 1, 5, 10, 100, 5000)$$, 'cai dat sai: diem khoi dau qua lon bi tu choi');
select t.fails($$select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 4, 100, 5000)$$, 'cai dat sai: tong/van < cuoc toi da bi tu choi');
select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000);
select t.as_root();
select t.ok((select enabled from public.game_settings where family_id = current_setting('t.fid')::uuid), 'quan tri bat module');
select t.ok((select count(*) from public.audit_logs where action = 'games.settings' and (before_data->>'enabled')::boolean = false and (after_data->>'enabled')::boolean = true) = 1,
  'audit: bat module ghi truoc/sau');

-- Khach (guest) khong choi, nguoi ngoai/thu hoi bi chan
select t.as_user(:'U5');
select t.fails_with($$select public.points_my_balance(current_setting('t.fid')::uuid)$$, 'forbidden', 'khach khong choi: xem so du bi tu choi');
select t.fails_with($$select public.claim_daily_gift(current_setting('t.fid')::uuid)$$, 'forbidden', 'khach khong choi: qua hang ngay bi tu choi');
select t.fails_with($$select public.lixi_draw(t.id('pk_off'))$$, 'forbidden', 'khach khong choi: boc li xi bi tu choi');
select t.ok(t.cnt('select 1 from public.lixi_packets') = 0, 'khach khong thay du lieu tro choi');
select t.as_user(:'U6');
select t.fails_with($$select public.points_my_balance(current_setting('t.fid')::uuid)$$, 'forbidden', 'nguoi ngoai: so du bi tu choi');
select t.fails_with($$select public.lixi_draw(t.id('pk_off'))$$, 'forbidden', 'nguoi ngoai: boc li xi bi tu choi');
select t.fails_with($$select public.games_leaderboard(current_setting('t.fid')::uuid)$$, 'forbidden', 'nguoi ngoai: bang xep hang bi tu choi');
select t.ok(t.cnt('select 1 from public.lixi_packets') = 0, 'nguoi ngoai: khong thay bao li xi');
select t.as_user(:'U7');
select t.fails_with($$select public.points_my_balance(current_setting('t.fid')::uuid)$$, 'forbidden', 'tai khoan bi thu hoi: so du bi tu choi');
select t.fails_with($$select public.lixi_draw(t.id('pk_off'))$$, 'forbidden', 'tai khoan bi thu hoi: boc li xi bi tu choi');
select t.ok(t.cnt('select 1 from public.lixi_packets') = 0, 'tai khoan bi thu hoi: khong thay du lieu');
select t.as_anon();
select t.fails($$select public.lixi_draw(t.id('pk_off'))$$, 'anon khong boc duoc li xi');

-- ===== 3. So diem ao =====
select t.as_user(:'U4');
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = 100, 'lan dau: nhan 100 diem khoi dau');
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = 100, 'goi lai khong tang them diem khoi dau');
select t.ok(t.cnt($$select 1 from public.points_ledger where reason = 'start'$$) = 1, 'chi mot dong "start" cho moi nguoi');
select t.ok((select balance from public.points_balance_v where user_id = :'U4') = 100, 'view so du khop');
select t.ok(t.cnt('select 1 from public.points_balance_v') = 1, 'thanh vien chi thay so du cua chinh minh qua view');
select t.ok(t.cnt('select 1 from public.points_ledger where user_id <> auth.uid()') = 0, 'thanh vien khong thay so cua nguoi khac');
-- khong sua truc tiep so diem
select t.fails($$insert into public.points_ledger (family_id, user_id, delta, reason) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 1000, 'daily_gift')$$, 'thanh vien khong chen duoc dong so diem');
select t.fails($$update public.points_ledger set delta = 1000$$, 'thanh vien khong sua duoc so diem');
select t.fails($$delete from public.points_ledger$$, 'thanh vien khong xoa duoc so diem');
select t.fails($$update public.game_settings set enabled = false$$, 'thanh vien khong sua truc tiep cai dat');
select t.fails($$select public._points_add(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 1000, 'lixi', null)$$, 'ham noi bo _points_add khong goi duoc bang authenticated');
select t.fails($$select public._rand_below(6)$$, 'ham noi bo _rand_below khong goi duoc bang authenticated');
select t.as_root();
select t.fails($$update public.points_ledger set delta = 1000 where user_id = '00000000-0000-0000-0000-000000000004'$$, 'ngay ca quyen cao: so diem khong sua duoc (trigger)');
select t.fails($$delete from public.points_ledger$$, 'ngay ca quyen cao: so diem khong xoa duoc (trigger)');
select t.fails($$truncate public.points_ledger$$, 'ngay ca quyen cao: so diem khong truncate duoc');
select t.fails_with($$insert into public.points_ledger (family_id, user_id, delta, reason, local_day) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', -100000, 'lixi', current_date)$$,
  'insufficient_points', 'khong the lam so du am (rang buoc o bang)');
select t.fails($$insert into public.points_ledger (family_id, user_id, delta, reason, local_day) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 0, 'lixi', current_date)$$, 'delta = 0 bi tu choi');
select t.fails($$insert into public.points_ledger (family_id, user_id, delta, reason, local_day) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 5, 'nap_tien', current_date)$$, 'ly do la ("nap tien") bi tu choi - chi co ly do diem ao');
insert into public.points_ledger (family_id, user_id, delta, reason, local_day, balance_after)
  values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 1, 'daily_gift', current_date - 400, 999999);
select t.ok((select balance_after from public.points_ledger where user_id = '00000000-0000-0000-0000-000000000004' order by id desc limit 1) = 101,
  'so du sau giao dich do CSDL tinh, bo qua gia tri nguoi chen');
-- (dong thu nghiem tren la cua nguoi choi U4 va se duoc tinh vao so du; ghi nho de doi chieu)

-- Qua hang ngay
select t.as_user(:'U4');
select t.ok(public.claim_daily_gift(current_setting('t.fid')::uuid) = 10, 'qua hang ngay: nhan 10 diem');
select t.fails_with($$select public.claim_daily_gift(current_setting('t.fid')::uuid)$$, 'already_claimed', 'qua hang ngay: moi ngay chi mot lan');
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = 111, 'so du sau qua hang ngay = 101 + 10');
select t.as_root();
select t.fails($$insert into public.points_ledger (family_id, user_id, delta, reason, local_day) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 10, 'daily_gift', public._user_local_day('00000000-0000-0000-0000-000000000004'))$$,
  'chi muc duy nhat: hai qua trong mot ngay bi tu choi o CSDL');
-- Mui gio: ngay tinh theo mui gio cua nguoi choi, ngay nhan phai tang dan
select t.as_user(:'U3');
update public.user_profiles set timezone = 'Etc/GMT+12' where id = :'U3';
select t.ok(public.claim_daily_gift(current_setting('t.fid')::uuid) = 10, 'mui gio UTC-12: nhan qua');
select t.fails_with($$select public.claim_daily_gift(current_setting('t.fid')::uuid)$$, 'already_claimed', 'mui gio UTC-12: nhan lan 2 trong ngay bi tu choi');
update public.user_profiles set timezone = 'Pacific/Kiritimati' where id = :'U3';
select t.ok(public.claim_daily_gift(current_setting('t.fid')::uuid) = 10, 'sang ngay dia phuong ke tiep (UTC+14): nhan duoc qua moi');
update public.user_profiles set timezone = 'Etc/GMT+12' where id = :'U3';
select t.fails_with($$select public.claim_daily_gift(current_setting('t.fid')::uuid)$$, 'already_claimed', 'doi mui gio lui ngay de nhan lai bi chan (ngay nhan tang dan)');
update public.user_profiles set timezone = 'Asia/Ho_Chi_Minh' where id = :'U3';

-- Bang xep hang
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.games_leaderboard(current_setting(''t.fid'')::uuid)') >= 2, 'bang xep hang co nguoi choi');
select t.ok((select rnk from public.games_leaderboard(current_setting('t.fid')::uuid) order by balance desc, display_name limit 1) = 1, 'bang xep hang: hang 1 dung');
select t.as_user(:'U2');
select public.games_save_settings(current_setting('t.fid')::uuid, true, false, 100, 10, 1, 5, 10, 100, 5000);
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.games_leaderboard(current_setting(''t.fid'')::uuid)') = 0, 'tat bang xep hang: khong tra ve ai');
select t.as_user(:'U2');
select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000);

-- ===== 4. Li xi may man =====
select t.as_user(:'U4');
select t.fails_with($$select public.lixi_create(current_setting('t.fid')::uuid, 'Hack', array[500,500])$$, 'forbidden', 'thanh vien khong tao duoc bao li xi');
select t.as_user(:'U2');
select t.fails($$select public.lixi_create(current_setting('t.fid')::uuid, 'x', array[]::int[])$$, 'bao li xi rong bi tu choi');
select t.fails($$select public.lixi_create(current_setting('t.fid')::uuid, 'x', array[0])$$, 'phan thuong 0 diem bi tu choi');
select t.fails($$select public.lixi_create(current_setting('t.fid')::uuid, 'x', array[501])$$, 'phan thuong > 500 bi tu choi');
select t.fails($$select public.lixi_create(current_setting('t.fid')::uuid, 'x', array[1], now() - interval '1 hour')$$, 'han dong trong qua khu bi tu choi');
insert into t.ids select 'pk1', public.lixi_create(current_setting('t.fid')::uuid, 'Li xi Tet', array[5,10,20]);
select t.as_root();
select t.ok((select count(*) from public.notifications where link = '/tro-choi/li-xi-may-man' and user_id = :'U4') = 1, 'thong bao bao li xi moi den thanh vien');
select t.ok((select count(*) from public.notifications where link = '/tro-choi/li-xi-may-man' and user_id = :'U5') = 0, 'khach khong nhan thong bao tro choi');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.lixi_prizes') = 0, 'thanh vien khong thay danh sach phan thuong');
select t.fails($$update public.lixi_prizes set points = 500$$, 'thanh vien khong sua duoc phan thuong');
select t.fails($$insert into public.lixi_draws (packet_id, family_id, user_id, points) select id, family_id, auth.uid(), 500 from public.lixi_packets limit 1$$, 'thanh vien khong tu chen ket qua boc');
select public.lixi_draw(t.id('pk1'));
select t.ok((select points from public.lixi_draws where user_id = :'U4' and packet_id = t.id('pk1')) in (5,10,20), 'boc duoc mot trong cac phan thuong');
select t.ok((select delta from public.points_ledger where user_id = :'U4' and reason = 'lixi' and ref = t.id('pk1')::text) = (select points from public.lixi_draws where user_id = :'U4' and packet_id = t.id('pk1')),
  'so diem ghi vao so khop ket qua boc');
select t.fails_with($$select public.lixi_draw(t.id('pk1'))$$, 'already_drawn', 'chong boc doi: lan hai bi tu choi');
select t.as_root();
select t.fails($$insert into public.lixi_draws (packet_id, family_id, user_id, points) values (t.id('pk1'), current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 5)$$, 'chong boc doi: rang buoc unique o bang');
select t.as_user(:'U3');
select public.lixi_draw(t.id('pk1'));
select t.as_user(:'U5');
select t.fails_with($$select public.lixi_draw(t.id('pk1'))$$, 'forbidden', 'khach khong boc duoc');
select t.as_user(:'U1');
select public.lixi_draw(t.id('pk1'));
select t.as_root();
select t.ok((select sum(points) from public.lixi_draws where packet_id = t.id('pk1')) = 35 and (select count(distinct points) from public.lixi_draws where packet_id = t.id('pk1')) = 3,
  'ba nguoi boc het dung 3 phan thuong khac nhau (5+10+20), khong trung phan');
select t.ok((select status from public.lixi_packets where id = t.id('pk1')) = 'closed', 'het phan thuong thi bao tu dong dong');
select t.as_user(:'U2');
select t.fails_with($$select public.lixi_draw(t.id('pk1'))$$, 'closed', 'bao da het phan thuong: nguoi sau khong boc duoc');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.lixi_draws where packet_id = t.id(''pk1'')') = 3, 'thanh vien xem duoc ai boc duoc bao nhieu');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.lixi_prizes where claimed_by is not null') = 3, 'quan tri thay phan thuong da boc');
insert into t.ids select 'pk2', public.lixi_create(current_setting('t.fid')::uuid, 'Bao dong', array[7]);
select public.lixi_close(t.id('pk2'));
select t.as_user(:'U4');
select t.fails_with($$select public.lixi_draw(t.id('pk2'))$$, 'closed', 'bao da dong: boc bi tu choi');
select t.fails_with($$select public.lixi_close(t.id('pk2'))$$, 'forbidden', 'thanh vien khong dong duoc bao');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'lixi.create') = 3 and (select count(*) from public.audit_logs where action = 'lixi.close') = 1, 'audit: tao/dong bao li xi');
-- ngau nhien: _rand_below phan bo deu
select t.ok((select max(c) - min(c) from (select r, count(*) c from (select public._rand_below(6) r from generate_series(1, 12000)) s group by r) q) < 400
        and (select count(distinct r) from (select public._rand_below(6) r from generate_series(1, 600)) s) = 6, 'ngau nhien: _rand_below(6) phan bo deu (12000 mau)');
select t.ok(not exists (select 1 from (select public._rand_below(1) r from generate_series(1, 100)) s where r <> 0), '_rand_below(1) luon bang 0');

-- ===== 5. Xo so gia dinh =====
select t.as_user(:'U4');
select t.fails_with($$select public.lottery_open(current_setting('t.fid')::uuid, 'Hack', now() + interval '1 hour', 5, 1, 3, '[{"kind":"points","label":"G","points":500}]')$$, 'forbidden', 'thanh vien khong mo duoc ky quay');
select t.as_user(:'U2');
select t.fails($$select public.lottery_open(current_setting('t.fid')::uuid, 'x', now() - interval '1 hour', 5, 1, 3, '[{"kind":"wish","label":"G"}]')$$, 'ky quay o qua khu bi tu choi');
select t.fails($$select public.lottery_open(current_setting('t.fid')::uuid, 'x', now() + interval '1 hour', 5, 1, 3, '[]')$$, 'ky quay khong co giai bi tu choi');
select t.fails($$select public.lottery_open(current_setting('t.fid')::uuid, 'x', now() + interval '1 hour', 500, 1, 3, '[{"kind":"wish","label":"G"}]')$$, 'gia ve qua cao bi tu choi');
select t.fails($$select public.lottery_open(current_setting('t.fid')::uuid, 'x', now() + interval '1 hour', 5, 4, 3, '[{"kind":"wish","label":"G"}]')$$, 've mien phi > toi da bi tu choi');
select t.fails($$select public.lottery_open(current_setting('t.fid')::uuid, 'x', now() + interval '1 hour', 5, 1, 3, '[{"kind":"cash","label":"G","points":5}]')$$, 'giai thuong loai "tien" bi tu choi (chi diem/loi chuc/vat pham)');
select t.fails($$select public.lottery_open(current_setting('t.fid')::uuid, 'x', now() + interval '1 hour', 5, 1, 3, '[{"kind":"points","label":"G","points":9999}]')$$, 'giai diem qua lon bi tu choi');
insert into t.ids select 'lot1', public.lottery_open(current_setting('t.fid')::uuid, 'Quay so Tet', now() + interval '1 hour', 5, 1, 3,
  '[{"kind":"points","label":"Giai nhat","points":30},{"kind":"wish","label":"Loi chuc may man"},{"kind":"item","label":"Mot chiec banh"}]');
select t.as_user(:'U4');
select t.ok((select commit_hash from public.lottery_draws where id = t.id('lot1')) ~ '^[0-9a-f]{64}$', 'ma cam ket duoc cong bo ngay khi mo ky quay');
select t.ok(t.cnt('select 1 from public.game_seeds') = 0, 'seed KHONG doc duoc truoc khi quay (thanh vien)');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.game_seeds') = 0, 'seed KHONG doc duoc truoc khi quay (ke ca quan tri)');
select t.as_user(:'U4');
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = 111 + (select points from public.lixi_draws where user_id = :'U4' and packet_id = t.id('pk1')), 'so du truoc khi mua ve: 111 + diem li xi');
select t.ok(public.lottery_get_ticket(t.id('lot1')) = 1, 've dau mien phi, so ve 1');
select t.ok((select paid from public.lottery_tickets where draw_id = t.id('lot1') and ticket_no = 1) = 0, 've dau: khong mat diem');
select t.ok(public.lottery_get_ticket(t.id('lot1')) = 2, 've thu hai doi bang diem, so ve 2');
select t.ok((select paid from public.lottery_tickets where draw_id = t.id('lot1') and ticket_no = 2) = 5, 've thu hai: tru dung 5 diem');
select t.ok((select delta from public.points_ledger where reason = 'lottery_ticket' and user_id = :'U4' order by id desc limit 1) = -5, 'so diem ghi -5 cho ve');
select public.lottery_get_ticket(t.id('lot1'));
select t.fails_with($$select public.lottery_get_ticket(t.id('lot1'))$$, 'max_tickets', 've thu tu vuot toi da bi tu choi');
select t.as_user(:'U3');
select public.lottery_get_ticket(t.id('lot1'));
select public.lottery_get_ticket(t.id('lot1'));
select t.as_user(:'U2');
select public.lottery_get_ticket(t.id('lot1'));
select t.as_user(:'U5');
select t.fails_with($$select public.lottery_get_ticket(t.id('lot1'))$$, 'forbidden', 'khach khong nhan ve');
select t.as_user(:'U6');
select t.fails_with($$select public.lottery_get_ticket(t.id('lot1'))$$, 'forbidden', 'nguoi ngoai khong nhan ve');
select t.ok(t.cnt('select 1 from public.lottery_draws') = 0, 'nguoi ngoai khong thay ky quay');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.lottery_tickets where draw_id = t.id(''lot1'')') = 3, 'truoc khi quay: chi thay ve cua minh');
select t.fails($$insert into public.lottery_tickets (draw_id, family_id, user_id, ticket_no) values (t.id('lot1'), current_setting('t.fid')::uuid, auth.uid(), 99)$$, 'thanh vien khong tu chen ve');
select t.fails($$update public.lottery_draws set status = 'drawn'$$, 'thanh vien khong tu chuyen ky quay sang "da quay"');
select t.fails($$insert into public.lottery_results (draw_id, family_id, rank, prize_id, ticket_no, user_id, label) select id, family_id, 1, (select id from public.lottery_prizes limit 1), 1, auth.uid(), 'x' from public.lottery_draws limit 1$$, 'thanh vien khong tu chen ket qua quay');
select t.fails_with($$select public.lottery_run(t.id('lot1'))$$, 'too_early', 'chua toi gio: thanh vien khong quay som duoc');
select t.as_user(:'U5');
select t.fails_with($$select public.lottery_run(t.id('lot1'))$$, 'forbidden', 'khach khong quay duoc');
select t.as_root();
select t.ok((select ticket_count from public.lottery_draws where id = t.id('lot1')) = 6 and (select count(distinct ticket_no) from public.lottery_tickets where draw_id = t.id('lot1')) = 6, 'so ve lien tuc 1..6, khong trung');
-- ve doi diem khong lam am so du: ky quay gia 50
select t.as_user(:'U2');
insert into t.ids select 'lot_exp', public.lottery_open(current_setting('t.fid')::uuid, 'Ve dat', now() + interval '1 hour', 50, 0, 5, '[{"kind":"wish","label":"G"}]');
select t.as_user(:'U4');
do $$
declare i int; failed boolean := false; msg text; bal int;
begin
  for i in 1..5 loop
    begin
      perform public.lottery_get_ticket(t.id('lot_exp'));
    exception when others then failed := true; msg := sqlerrm; exit;
    end;
  end loop;
  select balance_after into bal from public.points_ledger where user_id = '00000000-0000-0000-0000-000000000004' order by id desc limit 1;
  perform t.ok(failed and msg = 'insufficient_points' and bal >= 0 and bal < 50, 'doi ve: het diem thi bi tu choi, so du khong am (con ' || bal || ')');
end $$;
-- Quan tri quay som
select t.as_user(:'U2');
select t.ok(public.lottery_run(t.id('lot1')) = 3, 'quan tri quay: co 3 nguoi trung 3 giai');
select t.fails_with($$select public.lottery_run(t.id('lot1'))$$, 'not_open', 'chi quay duoc mot lan');
select t.as_user(:'U4');
select t.fails_with($$select public.lottery_get_ticket(t.id('lot1'))$$, 'closed|max_tickets', 'sau khi quay khong nhan them ve');
select t.ok(t.cnt('select 1 from public.lottery_results where draw_id = t.id(''lot1'')') = 3, 'ket qua cong khai cho ca nha');
select t.ok((select count(distinct user_id) from public.lottery_results where draw_id = t.id('lot1')) = 3, 'moi nguoi chi trung toi da mot giai');
select t.ok(t.cnt('select 1 from public.lottery_tickets where draw_id = t.id(''lot1'')') = 6, 'sau khi quay: thay tat ca ve de kiem chung');
-- Kiem chung commit-reveal tu goc nhin thanh vien
select t.ok((select count(*) from public.game_seeds where kind = 'lottery' and ref_id = t.id('lot1')) = 1, 'sau khi quay: seed duoc tiet lo');
select t.ok(public.fair_commit((select seed from public.game_seeds where ref_id = t.id('lot1'))) = (select commit_hash from public.lottery_draws where id = t.id('lot1')),
  'kiem chung: sha256(seed) = ma cam ket da cong bo truoc khi quay');
select t.ok((select array_agg(ticket_no order by rank) from public.lottery_results where draw_id = t.id('lot1')) =
  public.lottery_compute_winners((select seed from public.game_seeds where ref_id = t.id('lot1')),
     (select jsonb_agg(jsonb_build_object('no', ticket_no, 'owner', user_id::text)) from public.lottery_tickets where draw_id = t.id('lot1')), 3),
  'kiem chung: tinh lai tu seed ra dung ket qua cong bo');
select t.as_root();
select t.ok((select points_awarded from public.lottery_results where draw_id = t.id('lot1') and rank = 1) = 30
        and (select delta from public.points_ledger where reason = 'lottery_prize' and user_id = (select user_id from public.lottery_results where draw_id = t.id('lot1') and rank = 1)) = 30,
  'giai diem duoc cong vao so diem nguoi trung');
select t.ok((select count(*) from public.points_ledger where reason = 'lottery_prize') = 1, 'giai loi chuc / vat pham khong cong diem');
select t.ok((select count(*) from public.notifications where link = '/tro-choi/xo-so' and title like 'Chúc mừng%') = 3, 'nguoi trung giai nhan thong bao');
select t.ok((select count(*) from public.audit_logs where action = 'lottery.open') = 2 and (select count(*) from public.audit_logs where action = 'lottery.draw') = 1, 'audit: mo ky quay / quay so');
-- Quay theo gio (thanh vien kich hoat sau gio quay) va het gio khong nhan ve
select t.as_user(:'U2');
insert into t.ids select 'lot2', public.lottery_open(current_setting('t.fid')::uuid, 'Quay theo gio', now() + interval '1 hour', 0, 1, 1, '[{"kind":"points","label":"Nhat","points":10},{"kind":"wish","label":"Nhi"}]');
select t.as_user(:'U4');
select public.lottery_get_ticket(t.id('lot2'));
select t.as_root();
update public.lottery_draws set draw_at = now() - interval '1 minute' where id = t.id('lot2');
select t.as_user(:'U3');
select t.fails_with($$select public.lottery_get_ticket(t.id('lot2'))$$, 'closed', 'qua gio quay: khong nhan ve nua');
select t.as_user(:'U4');
select t.ok(public.lottery_run(t.id('lot2')) = 1, 'toi gio: thanh vien kich hoat quay; chi co 1 nguoi nen chi 1 giai');
select t.ok(t.cnt('select 1 from public.lottery_results where draw_id = t.id(''lot2'')') = 1, 'it nguoi hon so giai: chi tao ket qua cho nguoi co ve');
-- Huy: hoan diem
select t.as_user(:'U2');
insert into t.ids select 'lot3', public.lottery_open(current_setting('t.fid')::uuid, 'Se huy', now() + interval '1 hour', 5, 0, 2, '[{"kind":"wish","label":"G"}]');
select t.as_root();
select set_config('t.bal3', (select balance_after::text from public.points_ledger where user_id = :'U3' order by id desc limit 1), false);
select t.as_user(:'U3');
select public.lottery_get_ticket(t.id('lot3'));
select t.as_user(:'U4');
select t.fails_with($$select public.lottery_cancel(t.id('lot3'))$$, 'forbidden', 'thanh vien khong huy duoc ky quay');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.game_seeds where ref_id = t.id(''lot3'')') = 0, 'ky quay dang mo: seed van kin');
select public.lottery_cancel(t.id('lot3'));
select t.as_root();
select t.ok((select balance_after from public.points_ledger where user_id = :'U3' order by id desc limit 1)::text = current_setting('t.bal3'), 'huy ky quay: hoan lai du diem ve');
select t.ok((select count(*) from public.game_seeds where ref_id = t.id('lot3') and revealed_at is not null) = 1, 'huy ky quay: seed duoc tiet lo');
select t.ok((select count(*) from public.audit_logs where action = 'lottery.cancel') = 1, 'audit: huy ky quay');
-- Khong co ve nao: quay xong khong co giai, khong loi
select t.as_user(:'U2');
insert into t.ids select 'lot0', public.lottery_open(current_setting('t.fid')::uuid, 'Khong ai mua', now() + interval '1 hour', 5, 1, 3, '[{"kind":"points","label":"G","points":10}]');
select t.ok(public.lottery_run(t.id('lot0')) = 0, 'khong co ve: quay xong, 0 giai');
select t.ok((select status from public.lottery_draws where id = t.id('lot0')) = 'drawn' and (select count(*) from public.lottery_results where draw_id = t.id('lot0')) = 0, 'khong co ve: trang thai da quay, khong co ket qua');
select t.as_root();

-- ===== 6. Lo to =====
select t.as_root();
do $$
declare i int; g smallint[]; bad int := 0; c int; r int; cnt int;
begin
  for i in 1..400 loop
    g := public._loto_generate_card();
    if not public.loto_card_is_valid(g) then bad := bad + 1; end if;
    for c in 0..8 loop
      cnt := 0;
      for r in 0..2 loop if g[r * 9 + c + 1] <> 0 then cnt := cnt + 1; end if; end loop;
      if cnt < 1 or cnt > 3 then bad := bad + 1; end if;
    end loop;
  end loop;
  perform t.ok(bad = 0, 'to lo to sinh ra (400 to): hop le, moi cot 1-3 so');
end $$;
do $$
declare g smallint[]; h smallint[]; k int;
begin
  g := public._loto_generate_card();
  h := g; perform t.ok(public.loto_card_is_valid(h), 'to goc hop le');
  -- bo mot so o hang 1 => hang con 4 so
  for k in 1..9 loop if g[k] <> 0 then h := g; h[k] := 0; exit; end if; end loop;
  perform t.ok(not public.loto_card_is_valid(h), 'sai: hang chi con 4 so');
  -- them so vao o trong hang 1
  for k in 1..9 loop if g[k] = 0 then h := g; h[k] := (case k when 1 then 5 when 9 then 85 else (k - 1) * 10 + 5 end); exit; end if; end loop;
  perform t.ok(not public.loto_card_is_valid(h), 'sai: hang co 6 so');
  -- so ngoai dai cot
  for k in 1..9 loop if g[k] <> 0 then h := g; h[k] := 90 - (k - 1); if k = 9 then h[k] := 5; end if; exit; end if; end loop;
  perform t.ok(not public.loto_card_is_valid(h), 'sai: so nam ngoai dai cua cot');
  h := g; h[1] := null; perform t.ok(not public.loto_card_is_valid(h), 'sai: co phan tu null');
  perform t.ok(not public.loto_card_is_valid(g[1:26]), 'sai: thieu o (26 so)');
  perform t.ok(not public.loto_card_is_valid(array_fill(0::smallint, array[27])), 'sai: to rong');
  perform t.ok(not public.loto_card_is_valid(null), 'sai: null');
end $$;
-- trung so / sai thu tu trong cot: dung cot co du 2 so
do $$
declare g smallint[]; c int; r int; a int := -1; b int := -1; ra int; rb int; h smallint[]; tmp smallint;
begin
  g := public._loto_generate_card();
  for c in 0..8 loop
    a := -1; b := -1;
    for r in 0..2 loop
      if g[r * 9 + c + 1] <> 0 then if a < 0 then a := r * 9 + c + 1; else b := r * 9 + c + 1; exit; end if; end if;
    end loop;
    exit when b > 0;
  end loop;
  if b > 0 then
    h := g; tmp := h[a]; h[a] := h[b]; h[b] := tmp;
    perform t.ok(not public.loto_card_is_valid(h), 'sai: cot khong tang dan (doi cho hai so)');
    h := g; h[b] := h[a];
    perform t.ok(not public.loto_card_is_valid(h), 'sai: trung so trong cot');
  else
    perform t.ok(false, 'khong tim duoc cot co 2 so de thu (rat hiem)');
  end if;
end $$;
select t.fails($$insert into public.loto_cards (room_id, family_id, user_id, card_no, grid) values (gen_random_uuid(), current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 1, array_fill(1::smallint, array[27]))$$, 'rang buoc CHECK: to khong hop le khong the nam trong bang');

select t.as_user(:'U4');
select t.fails_with($$select public.loto_create_room(current_setting('t.fid')::uuid, 'Hack', 500)$$, 'forbidden', 'thanh vien khong tao phong lo to');
select t.as_user(:'U2');
select t.fails($$select public.loto_create_room(current_setting('t.fid')::uuid, 'x', 501)$$, 'giai kinh > 500 bi tu choi');
insert into t.ids select 'lt1', public.loto_create_room(current_setting('t.fid')::uuid, 'Lo to Tet', 40);
select t.ok((select code from public.loto_rooms where id = t.id('lt1')) ~ '^[A-HJ-NP-Z2-9]{6}$', 'phong co ma 6 ky tu (khong co ky tu de nham)');
select t.ok((select commit_hash from public.loto_rooms where id = t.id('lt1')) ~ '^[0-9a-f]{64}$', 'phong co ma cam ket ngay khi tao');
select t.as_user(:'U4');
select t.fails_with($$select public.loto_join(t.id('lt1'), 4)$$, '22023|1..3|cards', 'chi duoc 1-3 to (4 to bi tu choi)');
select t.fails($$select public.loto_join(t.id('lt1'), 0)$$, '0 to bi tu choi');
select t.ok(public.loto_join(t.id('lt1'), 2) = 2, 'U4 vao phong voi 2 to');
select t.fails_with($$select public.loto_join(t.id('lt1'), 1)$$, 'already_joined', 'moi nguoi vao phong mot lan');
select t.ok(t.cnt('select 1 from public.loto_cards where room_id = t.id(''lt1'')') = 2, 'thanh vien chi thay to cua minh');
select t.ok(not exists (select 1 from public.loto_cards where not public.loto_card_is_valid(grid)), 'to nhan duoc deu hop le');
select t.ok(public.loto_find_room(current_setting('t.fid')::uuid, lower((select code from public.loto_rooms where id = t.id('lt1')))) = t.id('lt1'), 'tim phong theo ma (khong phan biet hoa thuong)');
select t.ok(public.loto_find_room(current_setting('t.fid')::uuid, 'ZZZZZZ') is null, 'ma khong ton tai: khong tra ve gi');
select t.fails($$insert into public.loto_cards (room_id, family_id, user_id, card_no, grid) select room_id, family_id, user_id, 3, grid from public.loto_cards limit 1$$, 'thanh vien khong tu chen to');
select t.fails($$update public.loto_cards set grid = grid$$, 'thanh vien khong sua to');
select t.fails($$update public.loto_rooms set status = 'finished', winner_user = auth.uid()$$, 'thanh vien khong tu tuyen bo thang');
select t.fails($$insert into public.loto_calls (room_id, family_id, seq, number) values (t.id('lt1'), current_setting('t.fid')::uuid, 1, 1)$$, 'thanh vien khong tu ho so');
select t.as_user(:'U3');
select t.ok(public.loto_join(t.id('lt1'), 3) = 3, 'U3 vao phong voi 3 to');
select t.as_user(:'U2');
select t.ok(public.loto_join(t.id('lt1'), 1) = 1, 'quan tri cung choi duoc 1 to');
select t.as_user(:'U5');
select t.fails_with($$select public.loto_join(t.id('lt1'), 1)$$, 'forbidden', 'khach khong vao phong');
select t.as_user(:'U6');
select t.fails_with($$select public.loto_join(t.id('lt1'), 1)$$, 'forbidden', 'nguoi ngoai khong vao phong');
select t.ok(t.cnt('select 1 from public.loto_rooms') = 0 and t.cnt('select 1 from public.loto_cards') = 0, 'nguoi ngoai khong thay phong / to');
select t.as_user(:'U7');
select t.fails_with($$select public.loto_join(t.id('lt1'), 1)$$, 'forbidden', 'tai khoan bi thu hoi khong vao phong');
select t.as_user(:'U4');
select t.fails_with($$select public.loto_start(t.id('lt1'))$$, 'forbidden', 'thanh vien khong bat dau van');
select t.fails_with($$select public.loto_call_next(t.id('lt1'))$$, 'forbidden', 'thanh vien khong ho so');
select t.fails_with($$select public.loto_claim_kinh(t.id('lt1'), (select id from public.loto_cards limit 1))$$, 'not_playing', 'chua bat dau: khong kinh duoc');
select t.as_user(:'U2');
select t.fails_with($$select public.loto_call_next(t.id('lt1'))$$, 'not_playing', 'chua bat dau: chua ho so duoc');
select public.loto_start(t.id('lt1'));
select t.as_user(:'U3');
select t.fails_with($$select public.loto_join(t.id('lt1'), 1)$$, 'not_waiting|already_joined', 'van da bat dau: khong vao them');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.game_seeds where kind = ''loto'' and ref_id = t.id(''lt1'')') = 0, 'dang choi: seed van kin');
-- quan tri ho so; moi nguoi kinh gia
select t.as_user(:'U2');
select t.ok(public.loto_call_next(t.id('lt1')) between 1 and 90, 'ho so thu nhat hop le (1..90)');
select public.loto_call_next(t.id('lt1'));
select public.loto_call_next(t.id('lt1'));
select t.as_user(:'U3');
-- U3 co 3 to, sau 3 so khong the du hang (moi hang can 5 so): kinh gia bi tu choi, khong thang
select t.ok((public.loto_claim_kinh(t.id('lt1'), (select id from public.loto_cards where user_id = auth.uid() and card_no = 1)))->>'ok' = 'false', 'kinh gia (moi 3 so) bi tu choi');
select t.ok((select status from public.loto_rooms where id = t.id('lt1')) = 'playing' and (select winner_user from public.loto_rooms where id = t.id('lt1')) is null, 'kinh gia khong lam ket thuc van');
select t.ok((public.loto_claim_kinh(t.id('lt1'), (select id from public.loto_cards where user_id = auth.uid() and card_no = 2)))->>'ok' = 'false', 'kinh gia lan 2 bi tu choi');
select t.ok((public.loto_claim_kinh(t.id('lt1'), (select id from public.loto_cards where user_id = auth.uid() and card_no = 3)))->>'ok' = 'false', 'kinh gia lan 3 bi tu choi');
select t.ok(t.cnt('select 1 from public.loto_claims where valid = false') = 3, 'kinh gia duoc ghi lai (3 lan)');
select t.fails_with($$select public.loto_claim_kinh(t.id('lt1'), (select id from public.loto_cards where user_id = auth.uid() and card_no = 1))$$, 'too_many_false_claims', 'qua 3 lan kinh gia: bi chan');
select t.ok(not exists (select 1 from public.points_ledger where reason = 'loto_prize'), 'kinh gia khong duoc thuong diem');
select t.as_user(:'U4');
select t.fails_with($$select public.loto_claim_kinh(t.id('lt1'), (select id from public.loto_cards where user_id = '00000000-0000-0000-0000-000000000003' limit 1))$$, 'forbidden|not_found', 'khong dung duoc to cua nguoi khac de kinh');
-- ho tiep cho toi khi hang dau tien cua mot to cua U4 du (kiem tra DOC LAP voi ham may chu)
select t.as_root();
create table t.u4cards as select id, grid from public.loto_cards where user_id = '00000000-0000-0000-0000-000000000004' and room_id = t.id('lt1');
grant select on t.u4cards to public;
select t.as_user(:'U2');
do $$
declare i int; done boolean := false; c record; r int; k int; ok boolean;
begin
  for i in 1..90 loop
    for c in select id, grid from t.u4cards loop
      for r in 0..2 loop
        ok := true;
        for k in 1..9 loop
          if c.grid[r * 9 + k] <> 0 and not exists (select 1 from public.loto_calls l where l.room_id = t.id('lt1') and l.number = c.grid[r * 9 + k]) then ok := false; end if;
        end loop;
        if ok then done := true; end if;
      end loop;
    end loop;
    exit when done;
    perform public.loto_call_next(t.id('lt1'));
  end loop;
  perform t.ok(done, 'ho so cho toi khi to cua U4 co hang du');
end $$;
select t.as_user(:'U4');
select t.ok((public.loto_claim_kinh(t.id('lt1'), (select c.id from public.loto_cards c where c.user_id = auth.uid() and exists (
   select 1 from generate_series(0, 2) r where not exists (select 1 from generate_series(1, 9) k where c.grid[r * 9 + k] <> 0 and not exists
     (select 1 from public.loto_calls l where l.room_id = c.room_id and l.number = c.grid[r * 9 + k]))) limit 1)))->>'ok' = 'true',
  'kinh dung: may chu xac nhan va U4 thang');
select t.ok((select status from public.loto_rooms where id = t.id('lt1')) = 'finished' and (select winner_user from public.loto_rooms where id = t.id('lt1')) = :'U4', 'phong ket thuc, nguoi thang la U4');
select t.ok((select delta from public.points_ledger where reason = 'loto_prize') = 40, 'thang duoc cong 40 diem ao');
select t.as_user(:'U2');
select t.fails_with($$select public.loto_call_next(t.id('lt1'))$$, 'not_playing', 'van da ket thuc: khong ho them');
select t.as_user(:'U3');
select t.fails_with($$select public.loto_claim_kinh(t.id('lt1'), (select id from public.loto_cards where user_id = auth.uid() and card_no = 1))$$, 'not_playing', 'van da co nguoi kinh: kinh sau bi tu choi');
-- Kiem chung commit-reveal
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.game_seeds where ref_id = t.id(''lt1'')') = 1, 'ket thuc: seed duoc tiet lo');
select t.ok(public.fair_commit((select seed from public.game_seeds where ref_id = t.id('lt1'))) = (select commit_hash from public.loto_rooms where id = t.id('lt1')), 'lo to: sha256(seed) = ma cam ket');
select t.ok((select array_agg(number::int order by seq) from public.loto_calls where room_id = t.id('lt1')) =
  (public.fair_shuffle((select seed from public.game_seeds where ref_id = t.id('lt1')), 90))[1:(select called_count from public.loto_rooms where id = t.id('lt1'))],
  'lo to: cac so da ho = phan dau hoan vi tinh lai tu seed');
select t.ok((select count(distinct number) from public.loto_calls where room_id = t.id('lt1')) = (select called_count from public.loto_rooms where id = t.id('lt1')), 'khong ho trung so');
select t.ok(t.cnt('select 1 from public.loto_cards where room_id = t.id(''lt1'')') = 4, 'sau khi thang: thay to cua minh (3) + to thang (1)');
-- Van ho du 90 so
select t.as_user(:'U2');
insert into t.ids select 'lt2', public.loto_create_room(current_setting('t.fid')::uuid, 'Lo to dai', 0);
select t.fails_with($$select public.loto_start(t.id('lt2'))$$, 'no_players', 'khong co nguoi choi: khong bat dau');
select public.loto_join(t.id('lt2'), 1);
select public.loto_start(t.id('lt2'));
do $$ declare i int; begin for i in 1..90 loop perform public.loto_call_next(t.id('lt2')); end loop; end $$;
select t.fails_with($$select public.loto_call_next(t.id('lt2'))$$, 'all_called', 'het 90 so thi khong ho nua');
select public.loto_end(t.id('lt2'));
select t.ok((select array_agg(number::int order by seq) from public.loto_calls where room_id = t.id('lt2')) = public.fair_shuffle((select seed from public.game_seeds where ref_id = t.id('lt2')), 90), '90 so da ho = dung hoan vi tu seed');
select t.ok((select count(distinct number) from public.loto_calls where room_id = t.id('lt2')) = 90, '90 so khac nhau');
select t.fails_with($$select public.loto_end(t.id('lt2'))$$, 'already_finished', 'ket thuc hai lan bi tu choi');
select t.ok((select count(*) from public.audit_logs where action = 'loto.create_room') = 2 and (select count(*) from public.audit_logs where action = 'loto.start') = 2
        and (select count(*) from public.audit_logs where action = 'loto.kinh') = 1 and (select count(*) from public.audit_logs where action = 'loto.end') = 1, 'audit: tao phong / bat dau / kinh / ket thuc');
-- Huy phong chua bat dau
insert into t.ids select 'lt3', public.loto_create_room(current_setting('t.fid')::uuid, 'Se huy', 10);
select public.loto_end(t.id('lt3'));
select t.ok((select status from public.loto_rooms where id = t.id('lt3')) = 'cancelled', 'phong chua bat dau bi huy -> cancelled');

-- ===== 7. Bau cua tom ca =====
select t.as_root();
select t.ok(public._bc_payout(10, 1::smallint, array[1,2,3]::smallint[]) = 20, 'bau cua: ra 1 lan -> nhan lai n + 1n = 20');
select t.ok(public._bc_payout(10, 1::smallint, array[1,1,3]::smallint[]) = 30, 'bau cua: ra 2 lan -> n + 2n = 30');
select t.ok(public._bc_payout(10, 1::smallint, array[1,1,1]::smallint[]) = 40, 'bau cua: ra 3 lan -> n + 3n = 40');
select t.ok(public._bc_payout(10, 1::smallint, array[2,3,4]::smallint[]) = 0, 'bau cua: khong ra -> mat tien dat');
select t.ok((select sum(public._bc_payout(1, s::smallint, array[a, b, c]::smallint[])) from generate_series(1,6) a, generate_series(1,6) b, generate_series(1,6) c, (values (1),(2),(3),(4),(5),(6)) v(s) where s = 3) = 199,
  'bau cua: liet ke 216 ket qua, tong tra ve cho 1 diem = 199 (RTP chinh xac 199/216 = 92,13%)');
select t.ok(not exists (select 1 from (select s, sum(public._bc_payout(1, s::smallint, array[a, b, c]::smallint[])) tot from generate_series(1,6) a, generate_series(1,6) b, generate_series(1,6) c, generate_series(1,6) s group by s) q where tot <> 199), 'bau cua: moi o deu co RTP = 199/216');
select t.ok((select abs(avg(public._bc_payout(1, 1::smallint, public._bc_roll_dice())) - 199.0/216) from generate_series(1, 60000)) < 0.03, 'bau cua: mo phong 60000 van bang xuc xac may chu cho RTP ~ 92,1% (dung sai 3%)');
select t.ok((select max(c) - min(c) from (select d, count(*) c from (select (public._bc_roll_dice())[1] d from generate_series(1, 30000)) s group by d) q) < 800
        and (select count(distinct d) from (select unnest(public._bc_roll_dice()) d from generate_series(1, 500)) s) = 6, 'bau cua: xuc xac phan bo deu 1..6 (30000 mau)');
select t.ok(not exists (select 1 from (select public._bc_roll_dice() d from generate_series(1, 2000)) s where array_length(d, 1) <> 3 or not d <@ array[1,2,3,4,5,6]::smallint[]), 'bau cua: moi lan lac dung 3 xuc xac gia tri 1..6');
select t.ok((select pronargs from pg_proc where proname = 'bc_roll' and pronamespace = 'public'::regnamespace) = 1
        and (select pronargs from pg_proc where proname = 'bc_place_bet' and pronamespace = 'public'::regnamespace) = 3, 'ket qua khong do client quyet dinh: bc_roll chi nhan id van; bc_place_bet khong nhan nguoi dung/ket qua');

select t.as_user(:'U4');
select t.fails_with($$select public.bc_open_room(current_setting('t.fid')::uuid, 'Hack')$$, 'forbidden', 'thanh vien khong mo phong bau cua');
select t.as_user(:'U2');
select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000);
insert into t.ids select 'bc1', public.bc_open_room(current_setting('t.fid')::uuid, 'Bau cua Tet');
select t.fails($$select public.bc_open_room(current_setting('t.fid')::uuid, 'Phong thu hai')$$, 'moi gia dinh chi mot phong bau cua dang mo');
select t.fails($$select public.bc_new_round(t.id('bc1'), 5)$$, 'thoi gian dat cuoc < 10 giay bi tu choi');
insert into t.ids select 'rd1', public.bc_new_round(t.id('bc1'), 120);
select t.fails_with($$select public.bc_new_round(t.id('bc1'), 120)$$, 'round_open', 'dang co van chua het gio: khong mo van moi');
select t.as_user(:'U4');
select t.ok((public.bc_my_state(current_setting('t.fid')::uuid)->'room'->>'title') = 'Bau cua Tet', 'trang thai cua toi: thay phong dang mo');
select set_config('t.b4', (public.points_my_balance(current_setting('t.fid')::uuid))::text, false);
select public.bc_place_bet(t.id('rd1'), 1, 5);
select public.bc_place_bet(t.id('rd1'), 2, 5);
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 3, 1)$$, 'over_round_total', 'tong cuoc moi van toi da 10: vuot bi tu choi');
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 1, 1)$$, 'over_max_bet|over_round_total', 'cung mot o: tong khong qua toi da');
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 4, 6)$$, 'bet_out_of_range', 'cuoc > toi da bi tu choi');
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 4, 0)$$, 'bet_out_of_range', 'cuoc 0 bi tu choi');
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 4, -3)$$, 'bet_out_of_range', 'cuoc am bi tu choi');
select t.fails($$select public.bc_place_bet(t.id('rd1'), 7, 1)$$, 'o so 7 khong ton tai');
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = current_setting('t.b4')::int - 10, 'dat cuoc tru diem ngay (10)');
select t.ok(t.cnt('select 1 from public.bc_bets where round_id = t.id(''rd1'')') = 2, 'thay 2 cuoc cua minh');
select t.fails($$insert into public.bc_bets (round_id, family_id, user_id, symbol, amount, local_day) values (t.id('rd1'), current_setting('t.fid')::uuid, auth.uid(), 3, 1, current_date)$$, 'khong chen cuoc truc tiep');
select t.fails($$update public.bc_rounds set status = 'rolled', dice = array[1,1,1]::smallint[]$$, 'client khong tu dat ket qua xuc xac');
select t.fails_with($$select public.bc_roll(t.id('rd1'))$$, 'too_early', 'thanh vien khong lac som (chua het gio dat cuoc)');
select t.as_user(:'U3');
select public.bc_place_bet(t.id('rd1'), 1, 3);
select t.ok(t.cnt('select 1 from public.bc_bets where round_id = t.id(''rd1'')') = 1, 'truoc khi lac: khong thay cuoc cua nguoi khac');
select t.as_user(:'U5');
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 1, 1)$$, 'forbidden', 'khach khong dat cuoc');
select t.as_user(:'U6');
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 1, 1)$$, 'forbidden', 'nguoi ngoai khong dat cuoc');
select t.ok(t.cnt('select 1 from public.bc_rounds') = 0, 'nguoi ngoai khong thay van');
select t.as_user(:'U2');
select t.ok(array_length(public.bc_roll(t.id('rd1')), 1) = 3, 'quan tri lac xuc xac: 3 xuc xac');
select t.fails_with($$select public.bc_roll(t.id('rd1'))$$, 'not_betting', 'lac hai lan bi tu choi');
select t.as_user(:'U4');
select t.fails_with($$select public.bc_place_bet(t.id('rd1'), 1, 1)$$, 'betting_closed', 'van da chot: khong dat them');
select t.ok(t.cnt('select 1 from public.bc_bets where round_id = t.id(''rd1'')') = 3, 'sau khi lac: ca nha thay cac cuoc');
select t.as_root();
select t.ok(not exists (select 1 from public.bc_bets b join public.bc_rounds r on r.id = b.round_id where b.round_id = t.id('rd1')
                        and b.payout is distinct from public._bc_payout(b.amount, b.symbol, r.dice)), 'tien tra khop luat truyen thong cho tung cuoc');
select t.ok((select coalesce(sum(delta), 0) from public.points_ledger where reason = 'baucua_payout' and ref = t.id('rd1')::text) = (select coalesce(sum(payout), 0) from public.bc_bets where round_id = t.id('rd1')), 'so diem: tong tra thuong = tong payout cua cac cuoc');
select t.ok((select coalesce(sum(-delta), 0) from public.points_ledger where reason = 'baucua_bet' and ref = t.id('rd1')::text) = 13, 'so diem: moi cuoc deu duoc ghi (tong 13)');
select t.ok((select dice from public.bc_rounds where id = t.id('rd1')) <@ array[1,2,3,4,5,6]::smallint[], 'ket qua xuc xac hop le');
-- Van moi + thanh vien chot khi het gio
select t.as_user(:'U2');
insert into t.ids select 'rd2', public.bc_new_round(t.id('bc1'), 30);
select t.as_user(:'U4');
select public.bc_place_bet(t.id('rd2'), 6, 2);
select t.as_root();
update public.bc_rounds set betting_closes_at = now() - interval '1 second' where id = t.id('rd2');
select t.as_user(:'U4');
select t.fails_with($$select public.bc_place_bet(t.id('rd2'), 6, 1)$$, 'betting_closed', 'het gio dat cuoc: tu choi');
select t.ok(array_length(public.bc_roll(t.id('rd2')), 1) = 3, 'het gio: thanh vien chot van duoc');
select t.as_user(:'U2');
-- mo van moi khi van truoc chua chot nhung het gio: tu chot
insert into t.ids select 'rd3', public.bc_new_round(t.id('bc1'), 30);
select public.bc_place_bet(t.id('rd3'), 2, 1);
select t.as_root();
update public.bc_rounds set betting_closes_at = now() - interval '1 second' where id = t.id('rd3');
select t.as_user(:'U2');
insert into t.ids select 'rd4', public.bc_new_round(t.id('bc1'), 30);
select t.ok((select status from public.bc_rounds where id = t.id('rd3')) = 'rolled', 'mo van moi: van cu het gio duoc tu chot');
-- Huy phong: hoan diem
select set_config('t.b2', public.points_my_balance(current_setting('t.fid')::uuid)::text, false);
select public.bc_place_bet(t.id('rd4'), 1, 4);
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = current_setting('t.b2')::int - 4, 'U2 dat 4 diem');
select public.bc_close_room(t.id('bc1'));
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = current_setting('t.b2')::int, 'dong phong: hoan lai cuoc dang cho');
select t.ok((select status from public.bc_rounds where id = t.id('rd4')) = 'cancelled', 'van dang cho bi huy');
select t.as_user(:'U4');
select t.fails_with($$select public.bc_new_round(t.id('bc1'), 30)$$, 'forbidden', 'thanh vien khong mo van');
-- Gioi han thua moi ngay: cung loai "tu khoa toi ngay mai"
select t.as_user(:'U2');
select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 5, 5000);
update public.user_profiles set timezone = 'Etc/GMT+12' where id = :'U2';
insert into t.ids select 'bc2', public.bc_open_room(current_setting('t.fid')::uuid, 'Phong han muc');
do $$
declare i int; s jsonb; rid uuid; fid uuid := current_setting('t.fid')::uuid; mn int := 0;
begin
  for i in 1..400 loop
    s := public.bc_my_state(fid);
    mn := least(mn, (s->>'net_today')::int);
    exit when s->>'locked' is not null;
    rid := public.bc_new_round(t.id('bc2'), 30);
    begin
      perform public.bc_place_bet(rid, 1, 1 + (i * 3) % 5);   -- thu cac muc cuoc 1..5; may chu tu chan khi vuot ngan sach ngay
    exception when others then
      if sqlerrm <> 'over_daily_budget' then raise; end if;
      perform public.bc_place_bet(rid, 1, 5 + (s->>'net_today')::int);   -- chi dat duoc phan ngan sach con lai
    end;
    perform public.bc_roll(rid);
  end loop;
  s := public.bc_my_state(fid);
  perform t.ok(s->>'locked' = 'loss', 'gioi han thua: cham muc -> trang thai khoa "loss" (sau ' || i || ' van)');
  perform t.ok((s->>'net_today')::int >= -5, 'gioi han thua: khong bao gio thua qua 5 diem trong ngay (thua rong ' || (s->>'net_today') || ')');
  perform t.ok(mn >= -5, 'gioi han thua: moi thoi diem deu >= -5');
end $$;
select t.ok(public.bc_my_state(current_setting('t.fid')::uuid)->>'locked' = 'loss', 'U2 dang bi khoa choi bau cua hom nay');
select t.as_user(:'U2');
insert into t.ids select 'rd5', public.bc_new_round(t.id('bc2'), 30);
select t.fails_with($$select public.bc_place_bet(t.id('rd5'), 1, 1)$$, 'daily_limit_loss', 'khoa choi: dat cuoc bi tu choi ("hen ngay mai")');
update public.user_profiles set timezone = 'Pacific/Kiritimati' where id = :'U2';
select t.ok(public.bc_my_state(current_setting('t.fid')::uuid)->>'locked' is null, 'sang ngay dia phuong ke tiep: het khoa');
select t.ok((public.bc_place_bet(t.id('rd5'), 1, 1)->>'round_total')::int = 1, 'ngay moi: dat cuoc lai duoc');
update public.user_profiles set timezone = 'Asia/Ho_Chi_Minh' where id = :'U2';
select public.bc_roll(t.id('rd5'));
-- Gioi han thang moi ngay (dung chen so diem bang quyen cao de xac dinh duoc)
select t.as_user(:'U2');
select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 1000, 50);
select t.as_root();
insert into public.points_ledger (family_id, user_id, delta, reason, ref) values (current_setting('t.fid')::uuid, :'U1', 60, 'baucua_payout', 'test-win');
select t.as_user(:'U1');
select t.ok(public.bc_my_state(current_setting('t.fid')::uuid)->>'locked' = 'win', 'gioi han thang: cham muc -> khoa "win"');
select t.as_user(:'U2');
select public.bc_close_room(t.id('bc2'));
select t.ok((select status from public.bc_rooms where id = t.id('bc2')) = 'closed', 'dong phong bau cua 2');
insert into t.ids select 'bc3', public.bc_open_room(current_setting('t.fid')::uuid, 'Phong 3');
insert into t.ids select 'rd6', public.bc_new_round(t.id('bc3'), 30);
select t.as_user(:'U1');
select t.fails_with($$select public.bc_place_bet(t.id('rd6'), 1, 1)$$, 'daily_limit_win', 'khoa thang: dat cuoc bi tu choi');
-- Khong du diem
select t.as_user(:'U2');
select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 1000, 5000);
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'baucua.open_room') = 3 and (select count(*) from public.audit_logs where action = 'baucua.close_room') = 2, 'audit: mo / dong phong bau cua');

-- ===== 8. Trinh chieu TV =====
select t.as_user(:'U4');
select t.ok((public.games_tv_state(t.id('lt1'))->>'kind') = 'loto' and (public.games_tv_state(t.id('lt1'))->>'seed') is not null, 'TV lo to da ket thuc: co seed de kiem chung');
select t.ok(jsonb_array_length(public.games_tv_state(t.id('lt1'))->'called') = (select called_count from public.loto_rooms where id = t.id('lt1')), 'TV lo to: danh sach so da ho');
select t.ok((public.games_tv_state(t.id('lt1'))->'winner'->>'name') = 'Member', 'TV lo to: ten nguoi thang');
select t.ok((public.games_tv_state(t.id('lot1'))->>'kind') = 'lottery' and jsonb_array_length(public.games_tv_state(t.id('lot1'))->'results') = 3, 'TV xo so: ket qua cac giai');
select t.ok((public.games_tv_state(t.id('lot1'))->'tickets') is not null and jsonb_typeof(public.games_tv_state(t.id('lot1'))->'seed') = 'string', 'TV xo so da quay: co danh sach ve va seed');
select t.ok((public.games_tv_state(t.id('bc3'))->>'kind') = 'baucua', 'TV bau cua: trang thai phong');
select t.as_user(:'U2');
insert into t.ids select 'lt4', public.loto_create_room(current_setting('t.fid')::uuid, 'Dang cho', 5);
insert into t.ids select 'lot4', public.lottery_open(current_setting('t.fid')::uuid, 'Dang mo', now() + interval '1 day', 5, 1, 3, '[{"kind":"wish","label":"G"}]');
select t.as_user(:'U4');
select t.ok(public.games_tv_state(t.id('lt4'))->'seed' = 'null'::jsonb or (public.games_tv_state(t.id('lt4'))->>'seed') is null, 'TV: phong dang cho khong lo seed');
select t.ok((public.games_tv_state(t.id('lot4'))->>'seed') is null and (public.games_tv_state(t.id('lot4'))->'tickets') = 'null'::jsonb or (public.games_tv_state(t.id('lot4'))->'tickets') is null, 'TV: ky quay dang mo khong lo seed/danh sach ve');
select t.ok(public.games_tv_state(t.id('lot4'))->>'commit' = (select commit_hash from public.lottery_draws where id = t.id('lot4')), 'TV: hien ma cam ket cong khai');
select t.fails_with($$select public.games_tv_state(gen_random_uuid())$$, 'not_found', 'TV: id khong ton tai');
select t.as_user(:'U5');
select t.fails_with($$select public.games_tv_state(t.id('lt1'))$$, 'forbidden', 'TV: khach khong xem');
select t.as_user(:'U6');
select t.fails_with($$select public.games_tv_state(t.id('lt1'))$$, 'forbidden', 'TV: nguoi ngoai khong xem');
select t.as_anon();
select t.fails($$select public.games_tv_state(t.id('lt1'))$$, 'TV: anon khong xem');

-- ===== 9. Tat module giua chung: moi ham choi bi tu choi =====
select t.as_user(:'U2');
insert into t.ids select 'pk3', public.lixi_create(current_setting('t.fid')::uuid, 'Truoc khi tat', array[5,5]);
select public.loto_join(t.id('lt4'), 1);
select public.games_save_settings(current_setting('t.fid')::uuid, false, true, 100, 10, 1, 5, 10, 100, 5000);
select t.as_user(:'U4');
select t.fails_with($$select public.lixi_draw(t.id('pk3'))$$, 'games_disabled', 'tat: boc li xi bi tu choi');
select t.fails_with($$select public.lottery_get_ticket(t.id('lot4'))$$, 'games_disabled', 'tat: nhan ve bi tu choi');
select t.fails_with($$select public.loto_join(t.id('lt4'), 1)$$, 'games_disabled', 'tat: vao phong lo to bi tu choi');
select t.fails_with($$select public.bc_place_bet(t.id('rd6'), 1, 1)$$, 'games_disabled', 'tat: dat cuoc bau cua bi tu choi');
select t.fails_with($$select public.claim_daily_gift(current_setting('t.fid')::uuid)$$, 'games_disabled', 'tat: qua hang ngay bi tu choi');
select t.fails_with($$select public.bc_my_state(current_setting('t.fid')::uuid)$$, 'games_disabled', 'tat: trang thai bau cua bi tu choi');
select t.fails_with($$select public.lottery_run(t.id('lot4'))$$, 'games_disabled|too_early', 'tat: quay so (thanh vien) bi tu choi');
select t.fails_with($$select public.games_tv_state(t.id('lt4'))$$, 'forbidden', 'tat: trinh chieu TV bi tu choi voi thanh vien');
select t.ok(t.cnt('select 1 from public.loto_rooms') = 0 and t.cnt('select 1 from public.lixi_draws') = 0 and t.cnt('select 1 from public.points_ledger') = 0, 'tat: thanh vien khong doc duoc du lieu tro choi (ke ca so diem cua minh)');
select t.as_user(:'U2');
select t.fails_with($$select public.loto_start(t.id('lt4'))$$, 'games_disabled', 'tat: ke ca quan tri cung khong bat dau van lo to');
select t.fails_with($$select public.lottery_run(t.id('lot4'))$$, 'games_disabled', 'tat: ke ca quan tri cung khong quay so');
select t.fails_with($$select public.bc_new_round(t.id('bc3'), 30)$$, 'games_disabled', 'tat: ke ca quan tri cung khong mo van bau cua moi');
select t.ok(t.cnt('select 1 from public.loto_rooms') >= 1, 'tat: quan tri van doc duoc de cau hinh');
select public.games_save_settings(current_setting('t.fid')::uuid, true, true, 100, 10, 1, 5, 10, 100, 5000);
select t.as_user(:'U4');
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) >= 0, 'bat lai: choi tiep binh thuong, so diem con nguyen');

-- ===== 10. Quyen thuc thi ham =====
select t.as_root();
select t.ok(not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('_points_add','_points_ensure','_points_balance','_rand_below','_seed_new','_seed_get','_seed_reveal','_bc_settle','_bc_cancel_round','_bc_net_settled',
                    '_loto_generate_card','_games_top','_games_require_play','_games_require_admin','_games_enabled','_user_local_day','_bc_roll_dice','_bc_payout')
  and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))), 'ham noi bo khong cap quyen cho authenticated/anon');
select t.ok(not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('points_my_balance','claim_daily_gift','games_leaderboard','games_save_settings','lixi_create','lixi_close','lixi_draw','lottery_open','lottery_get_ticket','lottery_run','lottery_cancel',
                    'loto_create_room','loto_join','loto_find_room','loto_start','loto_call_next','loto_end','loto_claim_kinh','bc_open_room','bc_close_room','bc_new_round','bc_place_bet','bc_roll','bc_my_state','games_tv_state','games_purge_user')
  and has_function_privilege('anon', p.oid, 'execute')), 'anon khong goi duoc ham API nao cua module');
select t.ok(not has_function_privilege('authenticated', 'public.games_purge_user(uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.games_purge_user(uuid, uuid)', 'execute'), 'games_purge_user chi cho service_role');
select t.ok(not exists (select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema = 'public'
  and table_name in ('points_ledger','game_settings','game_seeds','lixi_packets','lixi_prizes','lixi_draws','lottery_draws','lottery_prizes','lottery_tickets','lottery_results','loto_rooms','loto_calls','loto_cards','loto_claims','bc_rooms','bc_rounds','bc_bets','points_balance_v')
  and privilege_type <> 'SELECT'), 'khong bang nao cua module cap quyen ghi truc tiep cho authenticated/anon');
select t.ok(not exists (select 1 from pg_tables where schemaname = 'public' and tablename in ('points_ledger','game_settings','game_seeds','lixi_packets','lixi_prizes','lixi_draws','lottery_draws','lottery_prizes','lottery_tickets','lottery_results','loto_rooms','loto_calls','loto_cards','loto_claims','bc_rooms','bc_rounds','bc_bets') and not rowsecurity), 'moi bang cua module deu bat RLS');

-- ===== 11. Toan ven so diem =====
select t.ok(not exists (select 1 from (select family_id, user_id, sum(delta) s, (select l2.balance_after from public.points_ledger l2 where l2.family_id = l.family_id and l2.user_id = l.user_id order by l2.id desc limit 1) b
                        from public.points_ledger l group by family_id, user_id) q where q.s <> q.b), 'toan ven: so du cuoi = tong delta cua moi nguoi');
select t.ok((select min(balance_after) from public.points_ledger) >= 0, 'toan ven: khong co thoi diem nao so du am');
select t.ok(not exists (select 1 from public.points_ledger l where l.balance_after <> coalesce((select l2.balance_after from public.points_ledger l2 where l2.family_id = l.family_id and l2.user_id = l.user_id and l2.id < l.id order by l2.id desc limit 1), 0) + l.delta),
  'toan ven: moi dong co balance_after = so du truoc + delta');

-- ===== 12. Xoa du lieu mot nguoi (service_role) =====
select t.as_user(:'U4');
select t.fails($$select public.games_purge_user(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'thanh vien khong goi duoc games_purge_user');
select t.as_service();
select t.ok(public.games_purge_user(current_setting('t.fid')::uuid, :'U4') > 0, 'service_role xoa duoc so diem mot nguoi');
select t.as_root();
select t.ok((select count(*) from public.points_ledger where user_id = :'U4') = 0, 'so diem cua nguoi do da xoa');
select t.ok((select count(*) from public.audit_logs where action = 'games.purge_user') = 1, 'audit: xoa du lieu diem');
select t.fails($$delete from public.points_ledger$$, 'sau khi xoa, so van chi them (khong xoa duoc bang tay)');
select t.as_user(:'U4');
select t.ok(public.points_my_balance(current_setting('t.fid')::uuid) = 100, 'sau khi xoa: lan sau nhan lai diem khoi dau');

-- ===== Tong ket =====
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
