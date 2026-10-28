-- Kiem thu RLS + nghiep vu cho Module D (Tin nhan): doc/gui theo thanh vien, thu hoi, guest, nhom nhanh, tin rieng, chan,
-- sua/xoa, gioi han tan suat, bao cao, thong bao gop, ham noi bo, nhat ky.
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
create function t.plan(sql text) returns text language plpgsql as $$
declare r text; acc text := ''; begin for r in execute 'explain ' || sql loop acc := acc || r || E'\n'; end loop; return acc; end $$;
grant execute on function t.plan(text) to public;

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
\set U12 '00000000-0000-0000-0000-000000000012'
\set U13 '00000000-0000-0000-0000-000000000013'
\set BA 'b0000000-0000-0000-0000-00000000000a'
\set BB 'b0000000-0000-0000-0000-00000000000b'

-- ===== 0. Du lieu bo sung =====
--   U9  = thanh vien nhanh B        U10 = thanh vien nhanh A       U11 = admin nhanh B
--   U12 = thanh vien nhanh A (dung cho kiem thu thu hoi)           U13 = vao gia dinh MUON (kiem tra tin cu)
--   U8  = thanh vien cua gia dinh THU HAI (kiem tra cach ly giua cac gia dinh)
select t.as_root();
insert into auth.users (id, email) values
 (:'U9','u9@test.local'), (:'U10','u10@test.local'), (:'U11','u11@test.local'), (:'U12','u12@test.local'), (:'U13','u13@test.local');
insert into public.user_profiles (id, display_name) values
 (:'U9','Chin'), (:'U10','Muoi'), (:'U11','MuoiMot'), (:'U12','MuoiHai'), (:'U13','MuoiBa'), (:'U8','Newbie');
insert into public.family_memberships (user_id, family_id, role_key, branch_id) values
 (:'U9', current_setting('t.fid')::uuid, 'member', :'BB'),
 (:'U10', current_setting('t.fid')::uuid, 'member', :'BA'),
 (:'U11', current_setting('t.fid')::uuid, 'branch_admin', :'BB'),
 (:'U12', current_setting('t.fid')::uuid, 'member', :'BA');
insert into public.families (name) values ('Gia dinh thu hai') returning id as fid2 \gset
select set_config('t.fid2', :'fid2', false);
insert into public.family_memberships (user_id, family_id, role_key) values (:'U8', :'fid2', 'member');

insert into t.ids select 'fam', id from public.conversations where family_id = current_setting('t.fid')::uuid and kind = 'family';
insert into t.ids select 'brA', id from public.conversations where kind = 'branch' and branch_id = :'BA';
insert into t.ids select 'brB', id from public.conversations where kind = 'branch' and branch_id = :'BB';
insert into t.ids select 'fam2', id from public.conversations where family_id = :'fid2' and kind = 'family';

-- ===== 1. Tu dong tao nhom gia dinh / nhom nhanh =====
select t.ok((select count(*) from public.conversations where family_id = current_setting('t.fid')::uuid and kind = 'family') = 1, 'nhom gia dinh: dung mot cuoc cho moi gia dinh');
select t.ok(t.id('fam') is not null and t.id('brA') is not null and t.id('brB') is not null and t.id('fam2') is not null, 'nhom gia dinh/nhanh duoc tao tu dong khi them thanh vien');
select t.ok((select count(*) from public.conversation_members where conversation_id = t.id('fam') and left_at is null) = 8, 'nhom gia dinh: tat ca thanh vien co quyen chat (8 nguoi)');
select t.ok(not exists (select 1 from public.conversation_members where conversation_id = t.id('fam') and user_id in (:'U5', :'U7', :'U6')), 'nhom gia dinh: khong co khach, tai khoan thu hoi, nguoi ngoai');
select t.ok((select array_agg(user_id order by user_id) from public.conversation_members where conversation_id = t.id('brA') and left_at is null)
          = array[:'U3', :'U4', :'U10', :'U12']::uuid[], 'nhom nhanh A: dung cac thanh vien nhanh A');
select t.ok((select array_agg(user_id order by user_id) from public.conversation_members where conversation_id = t.id('brB') and left_at is null)
          = array[:'U9', :'U11']::uuid[], 'nhom nhanh B: dung cac thanh vien nhanh B');
select t.ok(t.id('fam') <> t.id('fam2') and not exists (select 1 from public.conversation_members where conversation_id = t.id('fam2') and user_id <> :'U8'), 'gia dinh thu hai co nhom rieng, khong lan nguoi cua gia dinh dau');

-- Dong bo lai nhieu lan khong sinh them hang (idempotent)
select count(*) as n_conv, (select count(*) from public.conversation_members) as n_cm from public.conversations \gset
select public._chat_sync_user(user_id, family_id) from public.family_memberships;
select public._chat_sync_user(user_id, family_id) from public.family_memberships;
select t.ok((select count(*) from public.conversations) = :n_conv and (select count(*) from public.conversation_members) = :n_cm, 'dong bo nhom chay lai nhieu lan khong tao trung (idempotent)');

select t.as_user(:'U4');
select t.ok(public.ensure_chat_groups(current_setting('t.fid')::uuid) = t.id('fam'), 'ensure_chat_groups tra ve nhom gia dinh');
select t.as_root();
select t.ok((select count(*) from public.conversations) = :n_conv and (select count(*) from public.conversation_members) = :n_cm, 'ensure_chat_groups idempotent');

-- ===== 2. Nguoi ngoai / thu hoi / khach / chua dang nhap =====
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Chao ca nha, day la tin dau tien') ->> 'id' as mid \gset
insert into t.ids values ('m1', :'mid');
select t.as_user(:'U6');
select t.ok(t.cnt('select 1 from public.messages') = 0, 'nguoi ngoai: khong doc duoc bang messages');
select t.ok(t.cnt('select 1 from public.chat_messages_v') = 0 and t.cnt('select 1 from public.chat_conversations_v') = 0
          and t.cnt('select 1 from public.chat_members_v') = 0 and t.cnt('select 1 from public.chat_people_v') = 0, 'nguoi ngoai: cac view rong');
select t.fails($$select public.send_message(t.id('fam'), 'hack')$$, 'nguoi ngoai: khong gui duoc');
select t.fails($$select public.mark_read(t.id('fam'))$$, 'nguoi ngoai: khong danh dau da doc');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'nguoi ngoai: khong tao duoc tin nhan rieng');
select t.fails($$select public.ensure_chat_groups(current_setting('t.fid')::uuid)$$, 'nguoi ngoai: khong ensure duoc nhom');
select t.as_user(:'U7');
select t.ok(t.cnt('select 1 from public.messages') = 0 and t.cnt('select 1 from public.chat_conversations_v') = 0, 'tai khoan bi thu hoi: khong thay gi');
select t.fails($$select public.send_message(t.id('fam'), 'hack')$$, 'tai khoan bi thu hoi: khong gui duoc');
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.messages') = 0 and t.cnt('select 1 from public.chat_conversations_v') = 0 and t.cnt('select 1 from public.chat_people_v') = 0, 'khach: khong thay tin nhan, cuoc tro chuyen, danh ba chat');
select t.fails($$select public.send_message(t.id('fam'), 'hack')$$, 'khach: khong gui duoc');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'khach: khong tao tin nhan rieng');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, 'Nhom khach', array['00000000-0000-0000-0000-000000000004']::uuid[])$$, 'khach: khong tao nhom');
select t.fails($$select public.ensure_chat_groups(current_setting('t.fid')::uuid)$$, 'khach: khong ensure nhom');
select t.fails($$select public.block_chat_user(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'khach: khong chan nguoi khac (khong dung chat)');
select t.as_user(:'U8');
select t.ok(t.cnt('select 1 from public.messages') = 0, 'thanh vien gia dinh khac: khong doc duoc tin cua gia dinh nay');
select t.fails($$select public.send_message(t.id('fam'), 'hack')$$, 'thanh vien gia dinh khac: khong gui duoc vao nhom gia dinh nay');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'khac gia dinh: khong nhan rieng duoc (tham so gia dinh nay)');
select t.fails($$select public.create_direct(current_setting('t.fid2')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'khac gia dinh: khong nhan rieng duoc (tham so gia dinh minh)');
select t.ok(public.ensure_chat_groups(current_setting('t.fid2')::uuid) = t.id('fam2'), 'gia dinh thu hai: ensure tra ve nhom cua minh');
select public.send_message(t.id('fam2'), 'tin gia dinh hai') ->> 'id' as mid2 \gset
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''fam2'')') = 0, 'cach ly gia dinh: thanh vien gia dinh 1 khong doc duoc tin gia dinh 2');
select t.as_anon();
select t.fails('select 1 from public.messages', 'anon: khong doc duoc messages');
select t.fails('select 1 from public.chat_messages_v', 'anon: khong doc duoc view tin nhan');
select t.fails($$select public.send_message('00000000-0000-0000-0000-000000000000', 'x')$$, 'anon: khong goi duoc send_message');

-- ===== 3. Doc / gui trong nhom gia dinh; bang goc khong ghi truc tiep =====
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''m1'')') = 1, 'thanh vien: doc duoc tin trong nhom gia dinh (bang messages)');
select t.ok((select body from public.chat_messages_v where id = t.id('m1')) = 'Chao ca nha, day la tin dau tien'
          and (select sender_name from public.chat_messages_v where id = t.id('m1')) = 'Member', 'thanh vien: view tin nhan co noi dung va ten nguoi gui');
select t.ok((select unread_count from public.chat_conversations_v where id = t.id('fam')) = 1, 'so tin chua doc cua nguoi nhan = 1');
select t.as_user(:'U4');
select t.ok((select unread_count from public.chat_conversations_v where id = t.id('fam')) = 0, 'tin cua chinh minh khong tinh la chua doc');
select t.as_user(:'U3');
select public.send_message(t.id('fam'), 'Admin nhanh cung nhan duoc') ->> 'id' as mid \gset
select t.ok(:'mid' is not null, 'admin nhanh (pham vi bi gioi han) van gui duoc tin vao nhom gia dinh');
-- Ghi truc tiep vao bang bi tu choi
select t.as_user(:'U4');
select t.fails($$insert into public.messages (conversation_id, sender_id, body) values (t.id('fam'), '00000000-0000-0000-0000-000000000004', 'ghi truc tiep')$$, 'khong ghi truc tiep vao messages');
select t.fails($$update public.messages set body = 'sua truc tiep' where id = t.id('m1')$$, 'khong sua truc tiep messages');
select t.fails($$delete from public.messages where id = t.id('m1')$$, 'khong xoa truc tiep messages');
select t.fails($$insert into public.conversations (family_id, kind, title) values (current_setting('t.fid')::uuid, 'group', 'x')$$, 'khong tao truc tiep conversations');
select t.fails($$insert into public.conversation_members (conversation_id, user_id) values (t.id('fam'), '00000000-0000-0000-0000-000000000004')$$, 'khong ghi truc tiep conversation_members');
select t.fails('select 1 from public.conversations', 'khong doc truc tiep conversations (chi qua view)');
select t.fails('select 1 from public.conversation_members', 'khong doc truc tiep conversation_members (khong lo last_read_at cua nguoi khac)');
select t.fails('select 1 from public.chat_blocks', 'khong doc truc tiep chat_blocks');
select t.fails('select 1 from public.message_reports', 'khong doc truc tiep message_reports');
select t.fails($$insert into public.message_reports (family_id, conversation_id, message_id, reporter_id, reason_kind, message_snapshot) values (current_setting('t.fid')::uuid, t.id('fam'), t.id('m1'), '00000000-0000-0000-0000-000000000004', 'spam', 'x')$$, 'khong ghi truc tiep message_reports');
select t.fails($$insert into public.chat_blocks (blocker_id, blocked_id, family_id) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010', current_setting('t.fid')::uuid)$$, 'khong ghi truc tiep chat_blocks');

-- ===== 4. Do dai / noi dung tin nhan =====
select t.fails($$select public.send_message(t.id('fam'), '')$$, 'tin rong bi tu choi');
select t.fails($$select public.send_message(t.id('fam'), E'  \n\t ')$$, 'tin chi co khoang trang bi tu choi');
select t.fails($$select public.send_message(t.id('fam'), null)$$, 'tin null bi tu choi');
select t.fails($$select public.send_message(t.id('fam'), repeat('x', 4001))$$, 'tin dai 4001 ky tu bi tu choi');
select public.send_message(t.id('fam'), repeat('x', 4000)) ->> 'id' as mid \gset
select t.ok(:'mid' is not null, 'tin dai dung 4000 ky tu gui duoc');
select t.as_root();
select t.fails($$insert into public.messages (conversation_id, sender_id, body) values (t.id('fam'), '00000000-0000-0000-0000-000000000004', repeat('y', 4001))$$, 'rang buoc bang: body > 4000 bi chan ca voi quyen cao');
select t.fails($$insert into public.messages (conversation_id, sender_id, body, deleted_at) values (t.id('fam'), '00000000-0000-0000-0000-000000000004', 'con noi dung', now())$$, 'rang buoc bang: tin da xoa khong duoc con noi dung');
select t.fails($$insert into public.messages (conversation_id, sender_id, kind, body) values (t.id('fam'), '00000000-0000-0000-0000-000000000004', 'system', 'gia mao he thong')$$, 'rang buoc bang: tin he thong khong co nguoi gui');
select t.ok(exists (select 1 from pg_indexes where indexname = 'messages_conv_created_idx'), 'co index phan trang (conversation_id, created_at desc)');
set enable_seqscan = off;
select t.plan('select id from public.messages where conversation_id = ''' || t.id('fam')::text || ''' order by created_at desc, id desc limit 30') like '%messages_conv_created_idx%' as uses_idx \gset
reset enable_seqscan;
select t.ok(:'uses_idx'::boolean, 'truy van phan trang dung index messages_conv_created_idx');

-- ===== 5. Nhom nhanh: chi nguoi trong nhanh moi doc =====
select t.as_user(:'U4');
select public.send_message(t.id('brA'), 'Tin rieng cua nhanh A') ->> 'id' as mid \gset
insert into t.ids values ('mA1', :'mid');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.chat_messages_v where id = t.id(''mA1'')') = 1, 'nhom nhanh A: thanh vien nhanh A doc duoc');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.chat_messages_v where id = t.id(''mA1'')') = 1, 'nhom nhanh A: admin nhanh A doc duoc');
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mA1'')') = 0, 'nhom nhanh A: thanh vien nhanh B KHONG doc duoc');
select t.fails($$select public.send_message(t.id('brA'), 'xam nhap')$$, 'nhom nhanh A: thanh vien nhanh B khong gui duoc');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mA1'')') = 0, 'nhom nhanh A: admin gia dinh (khong thuoc nhanh) cung KHONG doc duoc noi dung');
select t.as_user(:'U1');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mA1'')') = 0, 'nhom nhanh A: super admin (khong thuoc nhanh) cung KHONG doc duoc noi dung');

-- Doi nhanh: U10 sang nhanh B
select t.as_root();
update public.family_memberships set branch_id = :'BB' where user_id = :'U10';
select t.ok(exists (select 1 from public.conversation_members where conversation_id = t.id('brA') and user_id = :'U10' and left_at is not null and left_reason = 'auto'), 'doi nhanh: roi nhom nhanh cu (ly do auto)');
select t.ok(exists (select 1 from public.conversation_members where conversation_id = t.id('brB') and user_id = :'U10' and left_at is null), 'doi nhanh: vao nhom nhanh moi');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mA1'')') = 0, 'doi nhanh: khong con doc duoc tin nhom nhanh cu (ke ca tin cu)');
select t.fails($$select public.send_message(t.id('brA'), 'toi van nhan duoc?')$$, 'doi nhanh: khong gui duoc vao nhom nhanh cu');
select public.send_message(t.id('brB'), 'Chao nhanh B') ->> 'id' as mid \gset
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.messages where id = ''' || :'mid' || '''') = 1, 'doi nhanh: nhom nhanh moi doc duoc tin cua nguoi moi chuyen toi');
-- Quay lai nhanh A: vao lai nhom A nhung khong thay tin trong thoi gian vang mat
select t.as_user(:'U4');
select public.send_message(t.id('brA'), 'Tin luc U10 vang mat') ->> 'id' as mid \gset
insert into t.ids values ('mA2', :'mid');
select t.as_root();
update public.family_memberships set branch_id = :'BA' where user_id = :'U10';
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.messages where id in (t.id(''mA1''), t.id(''mA2''))') = 0, 'quay lai nhanh A: KHONG thay tin gui truoc luc vao lai (ke ca tin luc con la thanh vien truoc do)');
select t.ok(t.cnt('select 1 from public.chat_messages_v where id in (t.id(''mA1''), t.id(''mA2''))') = 0, 'quay lai nhanh A: view tin nhan cung khong thay tin cu');
select t.as_user(:'U4');
select public.send_message(t.id('brA'), 'Tin sau khi U10 quay lai') ->> 'id' as mid \gset
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.messages where id = ''' || :'mid' || '''') = 1, 'quay lai nhanh A: thay tin gui sau khi vao lai');
select t.as_root();
select t.ok(not exists (select 1 from public.conversation_members where conversation_id = t.id('brB') and user_id = :'U10' and left_at is null), 'quay lai nhanh A: da roi nhom nhanh B');

-- ===== 6. Thu hoi tai khoan: mat quyen ngay; kich hoat lai: khong thay tin luc bi thu hoi =====
select t.as_user(:'U12');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''m1'')') = 1, 'U12 truoc khi bi thu hoi doc duoc nhom gia dinh');
select t.as_user(:'U1');
select public.revoke_membership((select id from public.family_memberships where user_id = :'U12'));
select t.as_user(:'U12');
select t.ok(t.cnt('select 1 from public.messages') = 0 and t.cnt('select 1 from public.chat_conversations_v') = 0, 'bi thu hoi: mat quyen doc NGAY (khong con tin nao)');
select t.fails($$select public.send_message(t.id('fam'), 'toi bi thu hoi')$$, 'bi thu hoi: khong gui duoc');
select t.fails($$select public.send_message(t.id('brA'), 'toi bi thu hoi')$$, 'bi thu hoi: khong gui duoc vao nhom nhanh');
select t.as_root();
select t.ok(not exists (select 1 from public.conversation_members where user_id = :'U12' and left_at is null), 'bi thu hoi: moi dong thanh vien cuoc tro chuyen deu duoc dong (auto)');
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Tin luc U12 bi thu hoi') ->> 'id' as mid \gset
insert into t.ids values ('mRev', :'mid');
select t.as_root();
update public.family_memberships set status = 'active', revoked_at = null where user_id = :'U12';
select t.as_user(:'U12');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mRev'')') = 0 and t.cnt('select 1 from public.messages where id = t.id(''m1'')') = 0, 'kich hoat lai: khong thay tin gui truoc/trong luc bi thu hoi');
select t.ok(t.cnt('select 1 from public.chat_messages_v where id in (t.id(''mRev''), t.id(''m1''))') = 0, 'kich hoat lai: view tin nhan cung khong thay tin cu');
select t.ok(t.cnt('select 1 from public.chat_conversations_v where id = t.id(''fam'')') = 1, 'kich hoat lai: duoc vao lai nhom gia dinh');
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Chao mung quay lai') ->> 'id' as mid \gset
select t.as_user(:'U12');
select t.ok(t.cnt('select 1 from public.messages where id = ''' || :'mid' || '''') = 1, 'kich hoat lai: thay tin moi');

-- Nguoi vao gia dinh muon khong thay lich su truoc luc vao
select t.as_root();
insert into auth.users (id, email) values (:'U13','late@test.local') on conflict do nothing;
insert into public.family_memberships (user_id, family_id, role_key, branch_id) values (:'U13', current_setting('t.fid')::uuid, 'member', :'BB');
select t.as_user(:'U13');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''m1'')') = 0, 'thanh vien vao muon: khong thay tin truoc luc vao');
select t.ok(t.cnt('select 1 from public.chat_messages_v where conversation_id = t.id(''fam'') and id = t.id(''m1'')') = 0, 'thanh vien vao muon: view tin nhan cung khong thay tin truoc luc vao');
select t.ok((select last_preview from public.chat_conversations_v where id = t.id('fam')) is null, 'thanh vien vao muon: xem truoc tin cuoi cung khong lo tin truoc luc vao');
select t.ok(t.cnt('select 1 from public.chat_conversations_v where id = t.id(''fam'')') = 1 and t.cnt('select 1 from public.chat_conversations_v where id = t.id(''brB'')') = 1, 'thanh vien vao muon: tu dong vao nhom gia dinh va nhom nhanh');

-- U13 co mot tin doc duoc (gui sau khi U13 vao) de cac kiem tra phong thu ben duoi khong bi "rong san"
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Tin danh cho nguoi vao muon') ->> 'id' as mid \gset
insert into t.ids values ('mLate', :'mid');
select t.as_user(:'U13');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mLate'')') = 1 and t.cnt('select 1 from public.chat_messages_v where id = t.id(''mLate'')') = 1, 'thanh vien vao muon: doc duoc tin gui sau khi vao (bang va view)');
select t.as_root();
-- Phong thu nhieu lop: ke ca khi trigger dong bo bi tat/loi, RLS van chan tai khoan bi thu hoi ngay (khong phu thuoc dong bo)
select t.as_root();
alter table public.family_memberships disable trigger family_memberships_chat_sync;
update public.family_memberships set status = 'revoked', revoked_at = now() where user_id = :'U13';
select t.ok(exists (select 1 from public.conversation_members where conversation_id = t.id('fam') and user_id = :'U13' and left_at is null), 'phong thu: (gia lap trigger loi) dong thanh vien van con hieu luc');
select t.as_user(:'U13');
select t.ok(t.cnt('select 1 from public.messages') = 0, 'phong thu: tai khoan bi thu hoi van khong doc duoc bang messages du dong bo that bai');
select t.ok(t.cnt('select 1 from public.chat_messages_v') = 0 and t.cnt('select 1 from public.chat_conversations_v') = 0 and t.cnt('select 1 from public.chat_members_v') = 0, 'phong thu: tai khoan bi thu hoi van khong doc duoc qua cac view du dong bo that bai');
select t.fails($$select public.send_message(t.id('fam'), 'qua mat trigger')$$, 'phong thu: tai khoan bi thu hoi van khong gui duoc du dong bo that bai');
select t.fails($$select public.mark_read(t.id('fam'))$$, 'phong thu: tai khoan bi thu hoi khong mark_read');
select t.as_root();
update public.family_memberships set status = 'active', revoked_at = null where user_id = :'U13';
alter table public.family_memberships enable trigger family_memberships_chat_sync;
select t.as_user(:'U13');
select t.ok(t.cnt('select 1 from public.chat_conversations_v where id = t.id(''fam'')') = 1, 'phong thu: kich hoat lai (trigger bat) van doc duoc nhom gia dinh');

-- Ha vai tro xuong khach: mat quyen chat ngay va roi cac nhom; nang lai thanh vien: vao lai nhom tu dong
select t.as_root();
update public.family_memberships set role_key = 'guest' where user_id = :'U13';
select t.as_user(:'U13');
select t.ok(t.cnt('select 1 from public.messages') = 0 and t.cnt('select 1 from public.chat_conversations_v') = 0, 'ha xuong khach: mat quyen chat ngay');
select t.fails($$select public.send_message(t.id('fam'), 'khach gui')$$, 'ha xuong khach: khong gui duoc');
select t.as_root();
select t.ok(not exists (select 1 from public.conversation_members where user_id = :'U13' and left_at is null), 'ha xuong khach: roi moi cuoc tro chuyen (auto)');
update public.family_memberships set role_key = 'member' where user_id = :'U13';
select t.as_user(:'U13');
select t.ok(t.cnt('select 1 from public.chat_conversations_v where id = t.id(''fam'')') = 1 and t.cnt('select 1 from public.chat_conversations_v where id = t.id(''brB'')') = 1, 'nang lai thanh vien: tu dong vao lai nhom gia dinh va nhom nhanh');

-- ===== 7. Tin nhan rieng (1-1) =====
select t.as_user(:'U4');
select public.create_direct(current_setting('t.fid')::uuid, :'U10') as dm \gset
insert into t.ids values ('dm', :'dm');
select t.ok(public.create_direct(current_setting('t.fid')::uuid, :'U10') = t.id('dm'), 'DM: goi lai tra ve cung mot cuoc');
select t.as_user(:'U10');
select t.ok(public.create_direct(current_setting('t.fid')::uuid, :'U4') = t.id('dm'), 'DM: dao chieu nguoi tao van la cung mot cuoc (duy nhat moi cap)');
select t.as_root();
select t.ok((select count(*) from public.conversations where kind = 'direct') = 1, 'DM: chi co mot cuoc cho mot cap');
select t.as_user(:'U4');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'DM: khong tu nhan voi chinh minh');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000005')$$, 'DM: khong nhan rieng voi khach');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000006')$$, 'DM: khong nhan rieng voi nguoi ngoai');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000007')$$, 'DM: khong nhan rieng voi tai khoan bi thu hoi');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000008')$$, 'DM: khong nhan rieng voi nguoi o gia dinh khac');
select t.ok(t.cnt('select 1 from public.chat_conversations_v where id = t.id(''dm'')') = 1 and (select last_preview from public.chat_conversations_v where id = t.id('dm')) is null, 'DM chua co tin nhan: nguoi tao mo duoc phong (last_preview null de danh sach an di)');
select t.as_user(:'U10');
select t.ok((select last_preview from public.chat_conversations_v where id = t.id('dm')) is null and (select unread_count from public.chat_conversations_v where id = t.id('dm')) = 0, 'DM chua co tin nhan: nguoi kia thay last_preview null va 0 chua doc');
select t.as_user(:'U4');
select public.send_message(t.id('dm'), 'Tin rieng giua 4 va 10 - bi mat') ->> 'id' as mid \gset
insert into t.ids values ('mDM', :'mid');
select t.ok((select title from public.chat_conversations_v where id = t.id('dm')) = 'Muoi', 'DM: ten cuoc tro chuyen la ten nguoi kia');
select t.as_user(:'U10');
select t.ok((select title from public.chat_conversations_v where id = t.id('dm')) = 'Member' and (select unread_count from public.chat_conversations_v where id = t.id('dm')) = 1, 'DM: nguoi nhan thay ten nguoi gui va 1 tin chua doc');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mDM'')') = 1, 'DM: nguoi nhan doc duoc');
-- Nguoi thu ba khong doc / gui duoc, ke ca admin
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mDM'')') = 0, 'DM: thanh vien khac KHONG doc duoc');
select t.fails($$select public.send_message(t.id('dm'), 'xen vao')$$, 'DM: thanh vien khac khong gui duoc');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mDM'')') = 0 and t.cnt('select 1 from public.chat_messages_v where conversation_id = t.id(''dm'')') = 0, 'DM: admin gia dinh KHONG doc duoc');
select t.as_user(:'U1');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mDM'')') = 0, 'DM: super admin KHONG doc duoc');
select t.fails($$select public.delete_message(t.id('mDM'))$$, 'DM: admin khong xoa duoc tin trong DM khong tham gia');
select t.fails($$select public.mark_read(t.id('dm'))$$, 'DM: nguoi ngoai cuoc khong danh dau da doc');
select t.as_user(:'U4');
select t.fails($$select public.leave_conversation(t.id('dm'))$$, 'DM: khong roi duoc');
select t.fails($$select public.add_conversation_member(t.id('dm'), '00000000-0000-0000-0000-000000000009')$$, 'DM: khong them nguoi thu ba');
select t.fails($$select public.remove_conversation_member(t.id('dm'), '00000000-0000-0000-0000-000000000010')$$, 'DM: khong go nguoi kia');

-- Tin cua nguoi khac trong DM: khong ai (ke ca nguoi trong DM) xoa duoc tin cua nguoi kia
select t.as_user(:'U10');
select public.send_message(t.id('dm'), 'Tra loi tu 10') ->> 'id' as mid \gset
insert into t.ids values ('mDM2', :'mid');
select t.as_user(:'U4');
select t.fails($$select public.delete_message(t.id('mDM2'))$$, 'DM: khong xoa duoc tin cua nguoi kia');

-- Chan
select t.as_user(:'U10');
select public.block_chat_user(current_setting('t.fid')::uuid, :'U4');
select t.ok((select i_blocked from public.chat_conversations_v where id = t.id('dm')), 'chan: nguoi chan thay trang thai da chan');
select t.fails($$select public.send_message(t.id('dm'), 'toi chan roi van gui')$$, 'chan: nguoi chan cung khong gui duoc vao DM (phai bo chan truoc)');
select t.as_user(:'U4');
select t.fails($$select public.send_message(t.id('dm'), 'ban chan toi a?')$$, 'chan: nguoi bi chan khong gui duoc');
select t.fails($$select public.create_direct(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000010')$$, 'chan: nguoi bi chan khong tao lai DM');
select t.ok(not (select i_blocked from public.chat_conversations_v where id = t.id('dm')), 'chan: nguoi bi chan KHONG thay minh bi chan');
select public.send_message(t.id('fam'), 'Nhom gia dinh khong bi anh huong boi chan') ->> 'id' as mid \gset
select t.ok(:'mid' is not null, 'chan: chi ap dung cho DM, nhom van gui duoc');
select t.as_user(:'U10');
select public.unblock_chat_user(:'U4');
select t.as_user(:'U4');
select public.send_message(t.id('dm'), 'Da bo chan') ->> 'id' as mid \gset
select t.ok(:'mid' is not null, 'bo chan: gui lai duoc');
select t.fails($$select public.block_chat_user(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004')$$, 'chan: khong tu chan minh');
select t.fails($$select public.block_chat_user(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000006')$$, 'chan: khong chan nguoi ngoai gia dinh');

-- ===== 8. Sua / xoa tin =====
-- (Lui moc joined_at cua nhom gia dinh 2 gio de co the lui created_at cua tin ma tin van nam trong cua so doc cua thanh vien)
select t.as_root();
update public.conversation_members set joined_at = joined_at - interval '2 hours' where conversation_id = t.id('fam');
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Tin de sua') ->> 'id' as mid \gset
insert into t.ids values ('mEdit', :'mid');
select public.edit_message(t.id('mEdit'), 'Tin da sua');
select t.ok((select body from public.chat_messages_v where id = t.id('mEdit')) = 'Tin da sua' and (select edited_at from public.chat_messages_v where id = t.id('mEdit')) is not null, 'chu tin sua duoc trong 15 phut, co dau da sua');
select t.fails($$select public.edit_message(t.id('mEdit'), '')$$, 'sua thanh rong bi tu choi');
select t.fails($$select public.edit_message(t.id('mEdit'), repeat('z', 4001))$$, 'sua qua 4000 ky tu bi tu choi');
select t.as_user(:'U10');
select t.fails($$select public.edit_message(t.id('mEdit'), 'sua tin nguoi khac')$$, 'khong sua duoc tin cua nguoi khac');
select t.as_user(:'U2');
select t.fails($$select public.edit_message(t.id('mEdit'), 'admin sua tin nguoi khac')$$, 'admin cung khong sua duoc tin cua nguoi khac');
select t.as_user(:'U6');
select t.fails($$select public.edit_message(t.id('mEdit'), 'nguoi ngoai')$$, 'nguoi ngoai khong sua duoc');
select t.as_root();
update public.messages set created_at = created_at - interval '16 minutes' where id = t.id('mEdit');
select t.as_user(:'U4');
select t.fails($$select public.edit_message(t.id('mEdit'), 'qua 15 phut')$$, 'qua 15 phut khong sua duoc');
select t.ok((select body from public.chat_messages_v where id = t.id('mEdit')) = 'Tin da sua', 'tin giu nguyen noi dung sau lan sua bi tu choi');
select t.as_root();
update public.messages set created_at = now() - interval '14 minutes' where id = t.id('mEdit');
select t.as_user(:'U4');
select public.edit_message(t.id('mEdit'), 'Sua lan hai o phut thu 14');
select t.ok((select body from public.chat_messages_v where id = t.id('mEdit')) = 'Sua lan hai o phut thu 14', 'o phut thu 14 van sua duoc');

-- Tra loi
select public.send_message(t.id('fam'), 'Tra loi tin de sua', t.id('mEdit')) ->> 'id' as mid \gset
insert into t.ids values ('mReply', :'mid');
select t.ok((select reply_body from public.chat_messages_v where id = t.id('mReply')) = 'Sua lan hai o phut thu 14', 'tra loi: view co noi dung tin duoc tra loi');
select t.fails($$select public.send_message(t.id('fam'), 'tra loi tin ngoai nhom', t.id('mA1'))$$, 'tra loi: khong tra loi duoc tin o cuoc tro chuyen khac');
select t.fails($$select public.send_message(t.id('brA'), 'tra loi tin nhom khac', t.id('mEdit'))$$, 'tra loi: tin duoc tra loi phai cung cuoc tro chuyen');
select t.fails($$select public.send_message(t.id('fam'), 'tra loi tin khong ton tai', '00000000-0000-0000-0000-00000000dead')$$, 'tra loi: tin khong ton tai bi tu choi');

-- Chong gui trung (client_id)
select public.send_message(t.id('fam'), 'Tin co client id', null, 'cccccccc-0000-0000-0000-000000000001') ->> 'id' as c1 \gset
select public.send_message(t.id('fam'), 'Tin co client id', null, 'cccccccc-0000-0000-0000-000000000001') ->> 'id' as c2 \gset
select t.ok(:'c1' = :'c2', 'client_id: gui lai tra ve cung mot tin');
select t.as_root();
select t.ok((select count(*) from public.messages where client_id = 'cccccccc-0000-0000-0000-000000000001') = 1, 'client_id: chi co mot dong trong CSDL');
select t.as_user(:'U4');
select t.fails($$select public.send_message(t.id('brA'), 'cung client id khac cuoc', null, 'cccccccc-0000-0000-0000-000000000001')$$, 'client_id: khong dung lai cho cuoc tro chuyen khac');
select t.as_user(:'U10');
select public.send_message(t.id('fam'), 'Nguoi khac dung chung client id', null, 'cccccccc-0000-0000-0000-000000000001') ->> 'id' as c3 \gset
select t.ok(:'c3' <> :'c1', 'client_id: moi nguoi gui co khong gian client_id rieng');

-- Xoa mem
select t.as_user(:'U4');
select public.delete_message(t.id('mEdit'));
select t.ok((select deleted from public.chat_messages_v where id = t.id('mEdit')) and (select body from public.chat_messages_v where id = t.id('mEdit')) = '', 'xoa: view bao da xoa va khong tra noi dung');
select t.as_root();
select t.ok((select body from public.messages where id = t.id('mEdit')) = '' and (select deleted_at from public.messages where id = t.id('mEdit')) is not null, 'xoa mem: noi dung bi xoa sach ngay trong CSDL (khong lo cho ai, ke ca quan tri)');
select t.as_user(:'U10');
select t.ok((select body from public.messages where id = t.id('mEdit')) = '', 'xoa: nguoi khac doc bang goc cung chi thay chuoi rong');
select t.ok((select reply_deleted from public.chat_messages_v where id = t.id('mReply')) and (select reply_body from public.chat_messages_v where id = t.id('mReply')) is null, 'xoa: tin tra loi cho tin da xoa khong lo noi dung goc');
select t.ok((select last_preview from public.chat_conversations_v where id = t.id('dm')) is not null, 'danh sach co xem truoc tin cuoi');
select t.as_user(:'U4');
select public.delete_message(t.id('mEdit'));
select t.ok(true, 'xoa hai lan: khong loi (idempotent)');
select t.fails($$select public.edit_message(t.id('mEdit'), 'sua tin da xoa')$$, 'khong sua duoc tin da xoa');
select t.as_user(:'U10');
select t.fails($$select public.delete_message(t.id('m1'))$$, 'thanh vien thuong khong xoa duoc tin nguoi khac');
select t.as_user(:'U6');
select t.fails($$select public.delete_message(t.id('m1'))$$, 'nguoi ngoai khong xoa duoc');

-- Quan tri xoa tin nguoi khac (chi trong cuoc ho tham gia)
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Tin se bi admin xoa') ->> 'id' as mid \gset
insert into t.ids values ('mMod', :'mid');
select public.send_message(t.id('brA'), 'Tin nhanh A se bi admin nhanh xoa') ->> 'id' as mid \gset
insert into t.ids values ('mModA', :'mid');
select t.as_user(:'U3');
select t.fails($$select public.delete_message(t.id('mMod'))$$, 'admin nhanh khong xoa duoc tin trong nhom gia dinh (ngoai pham vi)');
select public.delete_message(t.id('mModA'));
select t.ok((select deleted from public.chat_messages_v where id = t.id('mModA')), 'admin nhanh xoa duoc tin trong nhom nhanh cua minh');
select t.as_user(:'U2');
select t.fails($$select public.delete_message(t.id('mModA'))$$, 'admin gia dinh khong tham gia nhom nhanh A thi khong xoa duoc (khong doc duoc)');
select public.delete_message(t.id('mMod'));
select t.ok((select deleted from public.chat_messages_v where id = t.id('mMod')), 'admin gia dinh xoa duoc tin trong nhom gia dinh');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'chat.message_hide') = 2, 'nhat ky: hai lan quan tri an tin duoc ghi');

-- ===== 9. Nhom tuy chon =====
select t.as_user(:'U4');
select public.create_group(current_setting('t.fid')::uuid, 'Nhom di Da Lat', array[:'U10', :'U9']::uuid[]) as g \gset
insert into t.ids values ('g1', :'g');
select t.as_root();
select t.ok((select role from public.conversation_members where conversation_id = t.id('g1') and user_id = :'U4') = 'owner'
        and (select count(*) from public.conversation_members where conversation_id = t.id('g1') and left_at is null) = 3, 'nhom: nguoi tao la chu nhom, du 3 thanh vien');
select t.ok((select count(*) from public.audit_logs where action = 'chat.group_create' and entity_id = t.id('g1')::text) = 1, 'nhat ky: tao nhom');
select t.ok(exists (select 1 from public.messages where conversation_id = t.id('g1') and kind = 'system'), 'nhom: co tin he thong khi tao');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.chat_messages_v where conversation_id = t.id(''g1'') and kind = ''system''') = 1, 'nhom: thanh vien moi thay tin he thong tao nhom');
select t.ok((select title from public.chat_conversations_v where id = t.id('g1')) = 'Nhom di Da Lat', 'nhom: ten hien thi');
select t.as_user(:'U6');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''g1'')') = 0, 'nhom: nguoi ngoai khong doc');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''g1'')') = 0, 'nhom: admin nhanh khong thuoc nhom khong doc duoc');
select t.as_user(:'U4');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, '', array['00000000-0000-0000-0000-000000000010']::uuid[])$$, 'nhom: ten rong bi tu choi');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, repeat('a', 101), array['00000000-0000-0000-0000-000000000010']::uuid[])$$, 'nhom: ten qua 100 ky tu bi tu choi');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, 'Khong ai', '{}'::uuid[])$$, 'nhom: can it nhat mot thanh vien khac');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, 'Co khach', array['00000000-0000-0000-0000-000000000005']::uuid[])$$, 'nhom: khong them khach');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, 'Co nguoi ngoai', array['00000000-0000-0000-0000-000000000006']::uuid[])$$, 'nhom: khong them nguoi ngoai');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, 'Co nguoi gia dinh khac', array['00000000-0000-0000-0000-000000000008']::uuid[])$$, 'nhom: khong them nguoi gia dinh khac');
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, 'Co thu hoi', array['00000000-0000-0000-0000-000000000007']::uuid[])$$, 'nhom: khong them tai khoan thu hoi');
select public.send_message(t.id('g1'), 'Chao nhom Da Lat') ->> 'id' as mid \gset
insert into t.ids values ('mG1', :'mid');

-- Them thanh vien
select t.as_user(:'U10');
select t.fails($$select public.add_conversation_member(t.id('g1'), '00000000-0000-0000-0000-000000000012')$$, 'nhom: thanh vien thuong khong them duoc nguoi');
select t.as_user(:'U4');
select public.add_conversation_member(t.id('g1'), :'U12');
select t.fails($$select public.add_conversation_member(t.id('g1'), '00000000-0000-0000-0000-000000000005')$$, 'nhom: khong them khach');
select t.fails($$select public.add_conversation_member(t.id('g1'), '00000000-0000-0000-0000-000000000006')$$, 'nhom: khong them nguoi ngoai');
select t.fails($$select public.add_conversation_member(t.id('brB'), '00000000-0000-0000-0000-000000000004')$$, 'nhom nhanh: chu nhom thuong khong them nguoi vao nhom nhanh B');
select t.as_user(:'U12');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mG1'')') = 0, 'them vao nhom: nguoi moi khong thay tin truoc luc vao');
select t.ok(t.cnt('select 1 from public.chat_messages_v where conversation_id = t.id(''g1'') and kind = ''system''') >= 1, 'them vao nhom: thay tin he thong luc them');
select t.as_user(:'U2');
select public.add_conversation_member(t.id('g1'), :'U3');
select t.as_root();
select t.ok(exists (select 1 from public.conversation_members where conversation_id = t.id('g1') and user_id = :'U3' and left_at is null), 'admin gia dinh (khong tham gia) them duoc nguoi vao nhom');
select t.ok((select count(*) from public.audit_logs where action = 'chat.member_add') >= 2, 'nhat ky: them thanh vien');

-- Go thanh vien
select t.as_user(:'U10');
select t.fails($$select public.remove_conversation_member(t.id('g1'), '00000000-0000-0000-0000-000000000009')$$, 'nhom: thanh vien thuong khong go duoc nguoi');
select t.as_user(:'U4');
select t.fails($$select public.remove_conversation_member(t.id('g1'), '00000000-0000-0000-0000-000000000004')$$, 'nhom: chu nhom khong tu go minh (dung roi nhom)');
select public.add_conversation_member(t.id('g1'), :'U2');
select t.fails($$select public.remove_conversation_member(t.id('g1'), '00000000-0000-0000-0000-000000000002')$$, 'nhom: chu nhom khong go duoc nguoi co vai tro cao hon (admin gia dinh)');
select public.remove_conversation_member(t.id('g1'), :'U9');
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''g1'')') = 0 and t.cnt('select 1 from public.chat_conversations_v where id = t.id(''g1'')') = 0, 'bi go: khong con doc duoc gi cua nhom (ke ca tin cu)');
select t.ok(t.cnt('select 1 from public.chat_messages_v where conversation_id = t.id(''g1'')') = 0 and t.cnt('select 1 from public.chat_members_v where conversation_id = t.id(''g1'')') = 0, 'bi go: cac view tin nhan/thanh vien cung khong tra gi');
select t.fails($$select public.send_message(t.id('g1'), 'toi bi go roi')$$, 'bi go: khong gui duoc');
select t.as_user(:'U4');
select public.send_message(t.id('g1'), 'Tin sau khi U9 bi go') ->> 'id' as mid \gset
insert into t.ids values ('mG2', :'mid');
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''mG2'')') = 0, 'bi go: khong doc duoc tin moi');
select t.as_root();
select t.ok(exists (select 1 from public.conversation_members where conversation_id = t.id('g1') and user_id = :'U9' and left_reason = 'removed' and removed_by = :'U4'), 'bi go: ghi nhan ly do removed va nguoi go');
select t.ok((select count(*) from public.audit_logs where action = 'chat.member_remove') >= 1, 'nhat ky: go thanh vien');
-- Dong bo tu dong khong keo nguoi bi go tro lai (chi voi nhom tu dong)
select t.as_user(:'U9');
select t.fails($$select public.mark_read(t.id('g1'))$$, 'bi go: khong danh dau da doc');

-- Roi nhom, chuyen quyen chu nhom
select t.as_user(:'U10');
select public.leave_conversation(t.id('g1'));
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''g1'')') = 0, 'roi nhom: khong con doc duoc tin (ke ca tin cu)');
select t.ok(t.cnt('select 1 from public.chat_messages_v where conversation_id = t.id(''g1'')') = 0, 'roi nhom: view tin nhan cung khong tra gi');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.chat_members_v where conversation_id = t.id(''g1'') and user_id in (''00000000-0000-0000-0000-000000000009'', ''00000000-0000-0000-0000-000000000010'')') = 0, 'danh sach thanh vien khong liet ke nguoi da roi hoac bi go');
select t.ok(t.cnt('select 1 from public.chat_members_v where conversation_id = t.id(''g1'') and user_id = ''00000000-0000-0000-0000-000000000004''') = 1, 'danh sach thanh vien van co nguoi dang o trong nhom');
select t.as_user(:'U10');
select t.fails($$select public.send_message(t.id('g1'), 'toi da roi')$$, 'roi nhom: khong gui duoc');
select t.fails($$select public.leave_conversation(t.id('fam'))$$, 'nhom gia dinh: khong roi duoc');
select t.fails($$select public.leave_conversation(t.id('brA'))$$, 'nhom nhanh: khong roi duoc');
select t.as_user(:'U4');
select public.leave_conversation(t.id('g1'));
select t.as_root();
select t.ok((select role from public.conversation_members where conversation_id = t.id('g1') and user_id = :'U12') = 'owner'
        or (select role from public.conversation_members where conversation_id = t.id('g1') and user_id = :'U2') = 'owner', 'chu nhom roi: quyen chu nhom duoc chuyen cho nguoi con lai vao som nhat');
select t.ok((select count(*) from public.conversation_members where conversation_id = t.id('g1') and left_at is null and role = 'owner') = 1, 'nhom luon co dung mot chu nhom');
-- Roi nhom roi duoc them lai: joined_at moi
select t.as_user(:'U2');
select public.add_conversation_member(t.id('g1'), :'U10');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.messages where id in (t.id(''mG1''), t.id(''mG2''))') = 0, 'duoc them lai: khong thay tin trong thoi gian vang mat / truoc do');
select t.ok(t.cnt('select 1 from public.chat_messages_v where id in (t.id(''mG1''), t.id(''mG2''))') = 0, 'duoc them lai: view tin nhan cung khong thay tin cu');

-- Doi ten nhom
select t.fails($$select public.rename_conversation(t.id('g1'), 'Thanh vien khong duoc doi ten')$$, 'doi ten: thanh vien thuong khong duoc');
select t.as_user(:'U2');
select public.rename_conversation(t.id('g1'), 'Nhom moi doi ten');
select t.ok((select title from public.chat_conversations_v where id = t.id('g1')) = 'Nhom moi doi ten', 'doi ten: admin gia dinh doi duoc');
select t.fails($$select public.rename_conversation(t.id('fam'), 'doi ten nhom gia dinh')$$, 'doi ten: khong doi ten nhom gia dinh');
select t.fails($$select public.rename_conversation(t.id('g1'), '')$$, 'doi ten: ten rong bi tu choi');

-- Gioi han tao nhom: 5 nhom / gio
select t.as_user(:'U11');
select public.create_group(current_setting('t.fid')::uuid, 'Nhom ' || i, array[:'U9']::uuid[]) from generate_series(1, 5) i;
select t.fails($$select public.create_group(current_setting('t.fid')::uuid, 'Nhom thu 6', array['00000000-0000-0000-0000-000000000009']::uuid[])$$, 'tao nhom: qua 5 nhom/gio bi tu choi');

-- ===== 10. Gioi han tan suat gui tin: 30 tin / phut / nguoi =====
select t.as_root();
insert into t.ids select 'gRate', id from public.conversations where kind = 'group' and title = 'Nhom 1' and created_by = :'U11';
select t.as_user(:'U9');
do $$ begin
  for i in 1..30 loop perform public.send_message(t.id('gRate'), 'tin so ' || i); end loop;
end $$;
select t.ok((select count(*) from public.messages where sender_id = '00000000-0000-0000-0000-000000000009' and created_at > now() - interval '1 minute') >= 30, '30 tin dau trong mot phut gui duoc');
select t.fails($$select public.send_message(t.id('gRate'), 'tin thu 31')$$, 'tin thu 31 trong mot phut bi gioi han');
select t.fails($$select public.send_message(t.id('fam'), 'gioi han tinh tren moi cuoc tro chuyen')$$, 'gioi han tinh tren tat ca cuoc tro chuyen cua nguoi gui');
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Nguoi khac van gui binh thuong') ->> 'id' as mid \gset
select t.ok(:'mid' is not null, 'gioi han tan suat tinh rieng tung nguoi');
select t.as_root();
update public.messages set created_at = created_at - interval '2 minutes' where sender_id = :'U9' and created_at > now() - interval '1 minute';
select t.as_user(:'U9');
select public.send_message(t.id('gRate'), 'Het han gioi han') ->> 'id' as mid \gset
select t.ok(:'mid' is not null, 'qua mot phut thi gui lai duoc');

-- ===== 11. Bao cao tin nhan =====
select t.as_user(:'U4');
select public.send_message(t.id('fam'), 'Noi dung vi pham ABC123') ->> 'id' as mid \gset
insert into t.ids values ('mBad', :'mid');
select t.as_user(:'U10');
select public.report_message(t.id('mBad'), 'abuse', 'Loi le khong phu hop') as rid \gset
insert into t.ids values ('rep1', :'rid');
select t.ok(public.report_message(t.id('mBad'), 'abuse', 'lan hai') = t.id('rep1'), 'bao cao: bao cao lai cung tin tra ve bao cao cu (khong trung)');
select t.fails($$select public.report_message(t.id('mBad'), 'nonsense', null)$$, 'bao cao: ly do khong hop le bi tu choi');
select t.fails($$select public.report_message(t.id('mBad'), 'other', repeat('n', 501))$$, 'bao cao: ghi chu qua 500 ky tu bi tu choi');
select t.as_user(:'U4');
select t.fails($$select public.report_message(t.id('mBad'), 'spam', null)$$, 'bao cao: khong tu bao cao tin cua minh');
select t.as_user(:'U6');
select t.fails($$select public.report_message(t.id('mBad'), 'spam', null)$$, 'bao cao: nguoi ngoai khong bao cao duoc');
select t.as_user(:'U5');
select t.fails($$select public.report_message(t.id('mBad'), 'spam', null)$$, 'bao cao: khach khong bao cao duoc');
select t.as_user(:'U9');
select t.fails($$select public.report_message(t.id('mA1'), 'spam', null)$$, 'bao cao: khong bao cao duoc tin o cuoc tro chuyen minh khong doc duoc');
select t.as_user(:'U10');
select t.fails($$select public.report_message((select id from public.messages where kind = 'system' and conversation_id = t.id('g1') limit 1), 'spam', null)$$, 'bao cao: khong bao cao tin he thong');
select t.fails($$select public.report_message(t.id('mMod'), 'spam', null)$$, 'bao cao: khong bao cao tin da xoa');
select t.as_root();
select t.ok((select message_snapshot from public.message_reports where id = t.id('rep1')) = 'Noi dung vi pham ABC123', 'bao cao: ban chup noi dung dung luc bao cao');
select t.ok((select count(*) from public.audit_logs where action = 'chat.report') = 1, 'nhat ky: bao cao');
select t.ok(not exists (select 1 from public.audit_logs where coalesce(after_data::text, '') || coalesce(before_data::text, '') like '%ABC123%'), 'nhat ky: khong chua noi dung tin nhan');
select t.ok(exists (select 1 from public.notifications where user_id = :'U1' and kind = 'system' and dedupe_key = 'chatreport:' || t.id('rep1')::text)
        and exists (select 1 from public.notifications where user_id = :'U2' and kind = 'system' and dedupe_key = 'chatreport:' || t.id('rep1')::text), 'bao cao: super admin va admin gia dinh duoc bao');
select t.ok(not exists (select 1 from public.notifications where user_id in (:'U10', :'U4', :'U3', :'U9') and dedupe_key = 'chatreport:' || t.id('rep1')::text), 'bao cao: khong bao cho nguoi bao cao, nguoi bi bao cao, admin nhanh ngoai pham vi');
-- Nguoi gui xoa tin sau khi bi bao cao: ban chup van con cho quan tri
select t.as_user(:'U4');
select public.delete_message(t.id('mBad'));
-- Ai xem duoc bao cao
select t.as_user(:'U2');
select t.ok((select message_snapshot from public.chat_reports_v where id = t.id('rep1')) = 'Noi dung vi pham ABC123' and (select message_deleted from public.chat_reports_v where id = t.id('rep1')), 'quan tri: thay ban chup du tin da bi nguoi gui xoa');
select t.ok((select can_resolve from public.chat_reports_v where id = t.id('rep1')), 'quan tri: co quyen xu ly');
select t.as_user(:'U1');
select t.ok(t.cnt('select 1 from public.chat_reports_v where id = t.id(''rep1'')') = 1, 'super admin thay bao cao');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.chat_reports_v where id = t.id(''rep1'')') = 1 and (select is_mine from public.chat_reports_v where id = t.id('rep1')) and not (select can_resolve from public.chat_reports_v where id = t.id('rep1')), 'nguoi bao cao thay bao cao cua minh, khong co quyen xu ly');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.chat_reports_v') = 0, 'nguoi bi bao cao khong thay bao cao');
select t.as_user(:'U9');
select t.ok(t.cnt('select 1 from public.chat_reports_v') = 0, 'thanh vien khac khong thay bao cao');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.chat_reports_v where id = t.id(''rep1'')') = 0, 'admin nhanh khong thay bao cao cua nhom gia dinh (ngoai pham vi)');
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.chat_reports_v') = 0, 'khach khong thay bao cao');
select t.as_user(:'U6');
select t.ok(t.cnt('select 1 from public.chat_reports_v') = 0, 'nguoi ngoai khong thay bao cao');
-- Bao cao trong nhom nhanh A: admin nhanh A xu ly duoc
select t.as_user(:'U4');
select public.send_message(t.id('brA'), 'Tin xau o nhom nhanh A') ->> 'id' as mid \gset
insert into t.ids values ('mBadA', :'mid');
select t.as_user(:'U10');
select public.report_message(t.id('mBadA'), 'inappropriate', null) as rid \gset
insert into t.ids values ('repA', :'rid');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.chat_reports_v where id = t.id(''repA'')') = 1 and (select can_resolve from public.chat_reports_v where id = t.id('repA')), 'admin nhanh A thay va xu ly duoc bao cao trong nhom nhanh A');
select t.as_user(:'U11');
select t.ok(t.cnt('select 1 from public.chat_reports_v where id = t.id(''repA'')') = 0, 'admin nhanh B khong thay bao cao cua nhanh A');
select t.fails($$select public.resolve_report(t.id('repA'), 'dismiss', null)$$, 'admin nhanh B khong xu ly duoc bao cao nhanh A');

-- Xu ly bao cao
select t.as_user(:'U4');
select t.fails($$select public.resolve_report(t.id('rep1'), 'dismiss', null)$$, 'xu ly: thanh vien thuong khong xu ly duoc');
select t.as_user(:'U10');
select t.fails($$select public.resolve_report(t.id('rep1'), 'dismiss', null)$$, 'xu ly: nguoi bao cao khong tu xu ly duoc');
select t.as_user(:'U3');
select t.fails($$select public.resolve_report(t.id('rep1'), 'dismiss', null)$$, 'xu ly: admin nhanh khong xu ly duoc bao cao nhom gia dinh');
select t.as_user(:'U2');
select t.fails($$select public.resolve_report(t.id('rep1'), 'xoa_het', null)$$, 'xu ly: hanh dong khong hop le bi tu choi');
select public.resolve_report(t.id('rep1'), 'hide_message', 'Da nhac nho');
select t.ok((select status from public.chat_reports_v where id = t.id('rep1')) = 'resolved' and (select action_taken from public.chat_reports_v where id = t.id('rep1')) = 'message_hidden', 'xu ly: bao cao chuyen resolved, ghi hanh dong');
select t.fails($$select public.resolve_report(t.id('rep1'), 'dismiss', null)$$, 'xu ly: khong xu ly lai bao cao da xong');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'chat.report_resolve') = 1, 'nhat ky: xu ly bao cao');
select t.ok(exists (select 1 from public.notifications where user_id = :'U10' and dedupe_key = 'chatreport-done:' || t.id('rep1')::text), 'xu ly: bao cho nguoi bao cao');

-- Bao cao tin nhom nhanh A: an tin + go thanh vien (U4 khoi nhom nhanh A)
select t.as_user(:'U3');
select public.resolve_report(t.id('repA'), 'hide_and_remove', null);
select t.as_root();
select t.ok((select body from public.messages where id = t.id('mBadA')) = '' and (select deleted_at from public.messages where id = t.id('mBadA')) is not null, 'xu ly: an tin va xoa sach noi dung');
select t.ok(exists (select 1 from public.conversation_members where conversation_id = t.id('brA') and user_id = :'U4' and left_reason = 'removed'), 'xu ly: go thanh vien khoi nhom nhanh');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''brA'')') = 0, 'bi go khoi nhom nhanh: khong con doc duoc nhom do');
select t.fails($$select public.send_message(t.id('brA'), 'toi bi go')$$, 'bi go khoi nhom nhanh: khong gui duoc');
select t.ok(public.ensure_chat_groups(current_setting('t.fid')::uuid) = t.id('fam') and t.cnt('select 1 from public.messages where conversation_id = t.id(''brA'')') = 0, 'ensure_chat_groups khong keo nguoi bi go tro lai nhom tu dong');
select t.as_root();
update public.family_memberships set branch_id = branch_id where user_id = :'U4';
select t.ok(not exists (select 1 from public.conversation_members where conversation_id = t.id('brA') and user_id = :'U4' and left_at is null), 'dong bo khi doi vai tro/nhanh khong keo nguoi bi go tro lai');
select t.as_user(:'U3');
select public.add_conversation_member(t.id('brA'), :'U4');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.chat_conversations_v where id = t.id(''brA'')') = 1, 'admin nhanh them lai thanh vien da bi go');
select t.as_user(:'U3');
select t.fails($$select public.add_conversation_member(t.id('brA'), '00000000-0000-0000-0000-000000000009')$$, 'nhom nhanh A: khong them nguoi thuoc nhanh B');
select t.fails($$select public.add_conversation_member(t.id('fam'), '00000000-0000-0000-0000-000000000009')$$, 'admin nhanh khong quan ly nhom gia dinh');

-- Bao cao: khong go duoc nguoi co vai tro cao hon; dismiss
select t.as_user(:'U1');
select public.send_message(t.id('fam'), 'Tin cua super admin') ->> 'id' as mid \gset
insert into t.ids values ('mSuper', :'mid');
select t.as_user(:'U10');
select public.report_message(t.id('mSuper'), 'spam', null) as rid \gset
insert into t.ids values ('repS', :'rid');
select t.as_user(:'U2');
select t.fails($$select public.resolve_report(t.id('repS'), 'remove_member', null)$$, 'xu ly: admin gia dinh khong go duoc super admin');
select public.resolve_report(t.id('repS'), 'dismiss', 'Khong vi pham');
select t.ok((select action_taken from public.chat_reports_v where id = t.id('repS')) = 'dismissed', 'xu ly: bo qua bao cao');
select t.ok((select deleted from public.chat_messages_v where id = t.id('mSuper')) is false, 'xu ly: bo qua thi tin con nguyen');

-- Bao cao tin trong DM: quan tri khong doc duoc DM nhung thay ban chup va an duoc tin; khong go thanh vien duoc
select t.as_user(:'U10');
select public.send_message(t.id('dm'), 'Tin rieng khong hay') ->> 'id' as mid \gset
insert into t.ids values ('mDMbad', :'mid');
select t.as_user(:'U4');
select public.report_message(t.id('mDMbad'), 'abuse', null) as rid \gset
insert into t.ids values ('repD', :'rid');
select t.as_user(:'U2');
select t.ok((select message_snapshot from public.chat_reports_v where id = t.id('repD')) = 'Tin rieng khong hay', 'bao cao DM: quan tri thay ban chup');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''dm'')') = 0, 'bao cao DM: quan tri van khong doc duoc DM');
select t.fails($$select public.resolve_report(t.id('repD'), 'remove_member', null)$$, 'bao cao DM: khong go thanh vien khoi tin nhan rieng');
select public.resolve_report(t.id('repD'), 'hide_message', null);
select t.as_user(:'U4');
select t.ok((select deleted from public.chat_messages_v where id = t.id('mDMbad')), 'bao cao DM: tin da duoc an');

-- Bao cao tin nhom gia dinh: go thanh vien khoi nhom gia dinh (U10), khong tu keo lai
select t.as_user(:'U10');
select public.send_message(t.id('fam'), 'Tin U10 bi bao cao') ->> 'id' as mid \gset
insert into t.ids values ('mU10', :'mid');
select t.as_user(:'U9');
select public.report_message(t.id('mU10'), 'abuse', null) as rid \gset
insert into t.ids values ('repU10', :'rid');
select t.as_user(:'U2');
select public.resolve_report(t.id('repU10'), 'remove_member', null);
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''fam'')') = 0 and t.cnt('select 1 from public.chat_conversations_v where id = t.id(''fam'')') = 0, 'bi go khoi nhom gia dinh: khong doc duoc nhom gia dinh');
select t.ok(public.ensure_chat_groups(current_setting('t.fid')::uuid) is null, 'bi go khoi nhom gia dinh: ensure khong tu keo lai');
select t.ok(t.cnt('select 1 from public.messages where conversation_id = t.id(''fam'')') = 0, 'bi go: van khong doc duoc sau ensure');
select t.as_user(:'U2');
select public.add_conversation_member(t.id('fam'), :'U10');
select t.as_user(:'U10');
select t.ok(t.cnt('select 1 from public.chat_conversations_v where id = t.id(''fam'')') = 1, 'quan tri khoi phuc thanh vien vao nhom gia dinh');
select t.ok(t.cnt('select 1 from public.messages where id = t.id(''m1'')') = 0, 'khoi phuc: khong thay tin trong luc bi go');

-- ===== 12. Danh dau da doc + thong bao gop =====
-- Dung nhom g2 rieng: U4 (chu), U10, U12; U12 tat thong bao; U9 khong o trong nhom
select t.as_user(:'U4');
select public.create_group(current_setting('t.fid')::uuid, 'Nhom thong bao', array[:'U10', :'U12', :'U9']::uuid[]) as g \gset
insert into t.ids values ('g2', :'g');
select t.as_user(:'U12');
select public.set_conversation_muted(t.id('g2'), true);
select t.as_user(:'U9');
select public.set_conversation_muted(t.id('g2'), false);
select t.as_root();
-- U9 tat thong bao chat o muc tuy chon
insert into public.notification_preferences (user_id, family_id, chat) values (:'U9', current_setting('t.fid')::uuid, false);
-- thong bao "duoc them vao nhom" khong tinh vao kiem tra gop: xoa de de dem
delete from public.notifications where dedupe_key = 'chat:' || t.id('g2')::text;
select t.as_user(:'U4');
select public.send_message(t.id('g2'), 'Tin 1 nhom thong bao');
select public.send_message(t.id('g2'), 'Tin 2 nhom thong bao');
select public.send_message(t.id('g2'), 'Tin 3 nhom thong bao');
select t.as_root();
select t.ok((select count(*) from public.notifications where user_id = :'U10' and dedupe_key = 'chat:' || t.id('g2')::text and read_at is null) = 1, 'thong bao gop: 3 tin chi tao 1 thong bao chua doc cho nguoi nhan');
select t.ok((select link from public.notifications where user_id = :'U10' and dedupe_key = 'chat:' || t.id('g2')::text) = '/tin-nhan/' || t.id('g2')::text and (select kind from public.notifications where user_id = :'U10' and dedupe_key = 'chat:' || t.id('g2')::text) = 'chat', 'thong bao: kind chat va lien ket noi bo toi cuoc tro chuyen');
select t.ok(not exists (select 1 from public.notifications where user_id = :'U4' and dedupe_key = 'chat:' || t.id('g2')::text), 'thong bao: khong bao cho nguoi gui');
select t.ok(not exists (select 1 from public.notifications where user_id = :'U12' and dedupe_key = 'chat:' || t.id('g2')::text), 'thong bao: nguoi tat tieng cuoc tro chuyen khong duoc bao');
select t.ok(not exists (select 1 from public.notifications where user_id = :'U9' and dedupe_key = 'chat:' || t.id('g2')::text), 'thong bao: ton trong notification_preferences.chat = false');
select t.ok(not exists (select 1 from public.notifications where user_id = :'U3' and dedupe_key = 'chat:' || t.id('g2')::text), 'thong bao: khong bao cho nguoi khong o trong nhom');
select t.ok(not exists (select 1 from public.notifications where body like '%Tin 1 nhom%' or title like '%Tin 1 nhom%'), 'thong bao: khong chua noi dung tin nhan');
select t.as_user(:'U10');
select t.ok((select unread_count from public.chat_conversations_v where id = t.id('g2')) = 3, 'chua doc: 3 tin');
select public.mark_read(t.id('g2'));
select t.ok((select unread_count from public.chat_conversations_v where id = t.id('g2')) = 0, 'mark_read: ve 0 tin chua doc');
select t.as_root();
select t.ok((select read_at from public.notifications where user_id = :'U10' and dedupe_key = 'chat:' || t.id('g2')::text) is not null, 'mark_read: thong bao chat cua cuoc nay duoc danh dau da doc');
select t.as_user(:'U4');
select public.send_message(t.id('g2'), 'Tin 4 sau khi da doc');
select t.as_root();
select t.ok((select count(*) from public.notifications where user_id = :'U10' and dedupe_key = 'chat:' || t.id('g2')::text) = 1
        and (select count(*) from public.notifications where user_id = :'U10' and dedupe_key = 'chat:' || t.id('g2')::text and read_at is null) = 1, 'sau khi da doc, tin moi tao thong bao moi (van chi 1 dong chua doc)');
-- mark_read khong lui lai
select t.as_user(:'U10');
select last_read_at as lr from public.chat_conversations_v where id = t.id('g2') \gset
select public.mark_read(t.id('g2'), now() - interval '1 day');
select t.ok((select last_read_at from public.chat_conversations_v where id = t.id('g2')) = :'lr'::timestamptz, 'mark_read khong bao gio lui moc da doc');
select public.mark_read(t.id('g2'), now() + interval '1 day');
select t.ok((select last_read_at from public.chat_conversations_v where id = t.id('g2')) <= clock_timestamp(), 'mark_read khong dat moc o tuong lai');
select t.as_user(:'U9');
select t.fails($$select public.set_conversation_muted(t.id('dm'), true)$$, 'tat tieng: nguoi khong trong cuoc tro chuyen bi tu choi');
select t.as_user(:'U4');
select t.fails($$select public.delete_message((select id from public.messages where kind = 'system' and conversation_id = t.id('g2') limit 1))$$, 'tin he thong khong xoa duoc');
select t.fails($$select public.edit_message((select id from public.messages where kind = 'system' and conversation_id = t.id('g2') limit 1), 'sua tin he thong')$$, 'tin he thong khong sua duoc');

-- ===== 13. Ham noi bo khong goi duoc; danh ba chat =====
select t.as_user(:'U4');
select t.fails($$select public._chat_join(t.id('fam'), '00000000-0000-0000-0000-000000000004', 'owner', true)$$, 'ham noi bo: _chat_join khong goi duoc');
select t.fails($$select public._chat_leave(t.id('g2'), '00000000-0000-0000-0000-000000000010', 'removed', null)$$, 'ham noi bo: _chat_leave khong goi duoc');
select t.fails($$select public._chat_sync_user('00000000-0000-0000-0000-000000000005', current_setting('t.fid')::uuid)$$, 'ham noi bo: _chat_sync_user khong goi duoc');
select t.fails($$select public._chat_notify_new(t.id('fam'), '00000000-0000-0000-0000-000000000004')$$, 'ham noi bo: _chat_notify_new khong goi duoc');
select t.fails($$select public._chat_system_message(t.id('fam'), 'gia mao')$$, 'ham noi bo: _chat_system_message khong goi duoc');
select t.fails($$select public._chat_role_allows('00000000-0000-0000-0000-000000000004', current_setting('t.fid')::uuid, 'view')$$, 'ham noi bo: _chat_role_allows khong goi duoc');
select t.fails($$select public._chat_member_ok('00000000-0000-0000-0000-000000000004', t.id('fam'))$$, 'ham noi bo: _chat_member_ok khong goi duoc');
select t.fails($$select public._chat_ensure_family_conv(current_setting('t.fid')::uuid)$$, 'ham noi bo: _chat_ensure_family_conv khong goi duoc');
select t.fails($$select public._notify(current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000010', 'chat', 'gia mao', null, '/', null)$$, 'ham noi bo: _notify khong goi duoc');
select t.ok((select array_agg(display_name order by display_name) from public.chat_people_v) is not null
        and not exists (select 1 from public.chat_people_v where user_id in (:'U4', :'U5', :'U6', :'U7', :'U8')), 'danh ba chat: khong co chinh minh, khach, nguoi ngoai, thu hoi, gia dinh khac');
select t.ok(exists (select 1 from public.chat_people_v where user_id = :'U2') and exists (select 1 from public.chat_people_v where user_id = :'U3'), 'danh ba chat: co admin va admin nhanh');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.chat_members_v where conversation_id = t.id(''dm'')') = 2 and t.cnt('select 1 from public.chat_members_v where conversation_id = t.id(''brB'')') = 0, 'chat_members_v: chi liet ke thanh vien cua cuoc tro chuyen minh dang tham gia');
select t.as_user(:'U4');

-- ===== 13b. Dong bo lai tu dau (mo phong nang cap: xoa nhom roi chay lai dong bo cho cac tai khoan dang hoat dong) =====
select t.as_root();
select count(*) as n_before from public.conversations where kind in ('family', 'branch') \gset
delete from public.conversations where kind in ('family', 'branch');
select public._chat_sync_user(m.user_id, m.family_id) from public.family_memberships m where m.status = 'active';
select t.ok((select count(*) from public.conversations where kind = 'family') = 2 and (select count(*) from public.conversations where kind = 'branch') = 2, 'dong bo lai tu dau: nhom gia dinh (2 gia dinh) va nhom nhanh A, B duoc tao lai dung mot cuoc moi loai');
select t.ok((select count(*) from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id where c.kind = 'family' and cm.left_at is null and c.family_id = current_setting('t.fid')::uuid) = 9, 'dong bo lai tu dau: nhom gia dinh co du 9 thanh vien co quyen chat (U1..U4, U9..U13)');
select t.ok((select count(*) from public.conversation_members x where x.family_id is null) = 0 and not exists (select 1 from public.conversation_members x join public.conversations c on c.id = x.conversation_id where x.family_id <> c.family_id), 'conversation_members.family_id luon trung voi conversations.family_id');

-- ===== 14. Realtime + nhat ky bat bien =====
select t.as_root();
select t.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'), 'Realtime: bang messages nam trong publication supabase_realtime');
select t.ok(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('conversation_members', 'conversations', 'message_reports', 'chat_blocks')), 'Realtime: chi messages duoc phat (khong phat last_read/bao cao/chan)');
select t.as_user(:'U1');
select t.fails($$update public.audit_logs set action = 'x'$$, 'nhat ky khong sua duoc');

-- ===== Tong ket =====
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
