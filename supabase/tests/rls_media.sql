-- Kiem thu RLS + nghiep vu cho module Media: kho anh (Storage), anh bia, anh dai dien, album theo thanh vien, bang tin.
-- Chay boi run_rls_tests.sh (can rls_helpers.sql nap truoc). Du lieu mau CHI nam trong CSDL kiem thu.
-- Storage that (Supabase) khong co o day: stub chi gom bang storage.objects/buckets; chinh sach RLS cua storage.objects
-- duoc kiem tra bang cach INSERT/SELECT truc tiep voi vai tro authenticated/anon.
\set ON_ERROR_STOP on
-- Giam do on de runner (grep -q + pipefail) khong gap SIGPIPE khi dau ra lon: an bang ket qua va thong bao PASS.
-- Muon xem tung PASS khi go loi:  psql -v verbose=1 -f rls_media.sql
\if :{?verbose}
\else
  \o /dev/null
  set client_min_messages = warning;
\endif
\ir rls_fixture.sql

create table t.ids(k text primary key, v uuid);
grant select, insert on t.ids to public;
create function t.id(k text) returns uuid language sql stable as $$ select v from t.ids where t.ids.k = $1 $$;
grant execute on function t.id(text) to public;
create function t.cnt(sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || sql || ') q' into n; return n; end $$;
grant execute on function t.cnt(text) to public;
-- So dong bi tac dong boi mot cau lenh DML (RLS khong co chinh sach => 0, khong bao loi)
create function t.affected(sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute sql; get diagnostics n = row_count; return n; end $$;
grant execute on function t.affected(text) to public;

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

-- ===== Mo phong Storage: cot metadata (Supabase that co san), kich thuoc doc tu bien phien t.obj_size =====
alter table storage.objects add column metadata jsonb;
create function t.obj_meta() returns trigger language plpgsql as $$
begin new.metadata := jsonb_build_object('size', nullif(current_setting('t.obj_size', true), '')::bigint); return new; end $$;
grant execute on function t.obj_meta() to public;
create trigger t_obj_meta before insert on storage.objects for each row execute function t.obj_meta();

create table t.media(k text primary key, id uuid, bucket text, path text, thumb text);
grant select, insert on t.media to public;
-- Tai len day du nhu may chu: begin -> ghi tep vao storage.objects (chiu chinh sach) -> finalize. Chay bang quyen nguoi goi.
create function t.upload(p_key text, p_kind text, p_member uuid, p_family uuid default current_setting('t.fid')::uuid,
  p_mime text default 'image/jpeg', p_bytes bigint default 1000, p_thumb int default 100,
  p_actual bigint default null, p_skip_obj boolean default false, p_finalize boolean default true) returns uuid
language plpgsql as $$
declare r jsonb; v_id uuid;
begin
  r := public.begin_media_upload(p_family, p_kind, p_member, p_mime, p_bytes, p_thumb, 800, 600);
  v_id := (r->>'id')::uuid;
  insert into t.media values (p_key, v_id, r->>'bucket', r->>'path', r->>'thumb_path');
  if not p_skip_obj then
    perform set_config('t.obj_size', coalesce(p_actual, p_bytes)::text, false);
    insert into storage.objects (bucket_id, name, owner) values (r->>'bucket', r->>'path', auth.uid());
    if r->>'thumb_path' is not null then
      perform set_config('t.obj_size', p_thumb::text, false);
      insert into storage.objects (bucket_id, name, owner) values (r->>'bucket', r->>'thumb_path', auth.uid());
    end if;
  end if;
  if p_finalize then perform public.finalize_media(v_id, null); end if;
  return v_id;
end $$;
grant execute on function t.upload(text, text, uuid, uuid, text, bigint, int, bigint, boolean, boolean) to public;
-- Nguoi dang dang nhap co doc duoc tep (anh chinh / anh thu nho) cua khoa k khong?
-- anon khong co quyen bang storage.objects trong stub => 'permission denied' cung tinh la bi chan
create function t.rd(k text) returns boolean language plpgsql stable as $$
begin
  return exists (select 1 from storage.objects o join t.media m on m.bucket = o.bucket_id and m.path = o.name where m.k = $1);
exception when insufficient_privilege then return false;
end $$;
create function t.rdt(k text) returns boolean language plpgsql stable as $$
begin
  return exists (select 1 from storage.objects o join t.media m on m.bucket = o.bucket_id and m.thumb = o.name where m.k = $1);
exception when insufficient_privilege then return false;
end $$;
grant execute on function t.rd(text), t.rdt(text) to public;

-- ===== 0. Dung ho so + tai khoan mau =====
select t.as_user(:'U2');
insert into t.ids select 'dad', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Bo','branch_id',:'BA','birth_solar_year',1975));
insert into t.ids select 'badm', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Quan tri nhanh A','branch_id',:'BA','birth_solar_year',1980));
insert into t.ids select 'bkid', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Khach nhanh B','branch_id',:'BB','birth_solar_year',1990));
insert into t.ids select 'grandpa', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Ong Noi (da mat)','branch_id',:'BA','is_deceased',true,'birth_solar_year',1940));
insert into t.ids select 'living', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Chu chua co tai khoan','branch_id',:'BA','birth_solar_year',1982));
insert into t.ids select 'bmem', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Nguoi nhanh B chua co tai khoan','branch_id',:'BB','birth_solar_year',1985));
insert into t.ids select 'kid', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Be A','branch_id',:'BA','birth_solar_year',extract(year from now())::int - 9,'birth_solar_month',1,'birth_solar_day',1));
insert into t.ids select 'famadm', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Quan tri gia dinh','birth_solar_year',1970));
insert into t.ids select 'u8m', public.create_member(current_setting('t.fid')::uuid, jsonb_build_object('full_name','Thanh vien nhanh B','branch_id',:'BB','birth_solar_year',1992));
select t.as_root();
-- U8: thanh vien nhanh B (de thu pham vi nhanh)
insert into public.family_memberships (user_id, family_id, role_key, branch_id) values (:'U8', current_setting('t.fid')::uuid, 'member', :'BB');
select t.as_user(:'U1');
select public.link_membership_member((select id from public.family_memberships where user_id = :'U2'), t.id('famadm'));
select public.link_membership_member((select id from public.family_memberships where user_id = :'U3'), t.id('badm'));
select public.link_membership_member((select id from public.family_memberships where user_id = :'U4'), t.id('dad'));
select public.link_membership_member((select id from public.family_memberships where user_id = :'U5'), t.id('bkid'));
select public.link_membership_member((select id from public.family_memberships where user_id = :'U8'), t.id('u8m'));

-- Gia dinh thu hai (U6 la Super Admin o do): dung de thu doc cheo gia dinh
select t.as_root();
insert into public.families (name) values ('Gia dinh 2') returning id as fid2 \gset
insert into public.family_memberships (user_id, family_id, role_key) values (:'U6', :'fid2', 'super_admin');
select set_config('t.fid2', :'fid2', false);
select t.as_user(:'U6');
insert into t.ids select 'f2m', public.create_member(current_setting('t.fid2')::uuid, '{"full_name":"Nguoi gia dinh 2"}'::jsonb);

-- ===== 1. Cau hinh bucket (private, gioi han, khong svg) =====
select t.as_root();
select t.ok((select count(*) from storage.buckets where id in ('avatars','family-media')) = 2, 'bucket: co avatars va family-media');
select t.ok(not exists (select 1 from storage.buckets where id in ('avatars','family-media') and public), 'bucket: ca hai deu PRIVATE (public=false)');
select t.ok(not exists (select 1 from storage.buckets where id in ('avatars','family-media') and file_size_limit is distinct from 8388608), 'bucket: gioi han 8 MB');
select t.ok(not exists (select 1 from storage.buckets where id in ('avatars','family-media')
   and (allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp'] or 'image/svg+xml' = any(allowed_mime_types))), 'bucket: chi jpeg/png/webp, khong svg');
select t.ok((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), 'storage.objects bat RLS');
select t.ok((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE','DELETE','ALL')) = 0,
  'storage: khong co chinh sua UPDATE/DELETE/ALL cho nguoi dung (khong ghi de, khong xoa truc tiep)');
select t.ok((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and 'anon' = any(roles)) = 0, 'storage: khong co chinh sach cho anon');

-- ===== 2. Quyen module posts (ma tran) =====
select t.ok((select count(*) from public.role_permissions where module = 'posts' and role_key = 'family_admin') = 6, 'posts: family_admin du 6 quyen');
select t.ok((select array_agg(action order by action) from public.role_permissions where module = 'posts' and role_key = 'branch_admin') = array['approve','create','delete','view'], 'posts: branch_admin = view/create/delete/approve (kiem duyet)');
select t.ok((select array_agg(action order by action) from public.role_permissions where module = 'posts' and role_key = 'member') = array['create','view'], 'posts: member = xem + dang');
select t.ok((select array_agg(action order by action) from public.role_permissions where module = 'posts' and role_key = 'guest') = array['view'], 'posts: guest chi xem');

-- ===== 3. Luong tai len + chinh sach ghi Storage =====
select t.as_user(:'U4');   -- member, chu ho so 'dad'
select t.ok(not public.is_editing_open(current_setting('t.fid')::uuid, :'BA'), 'tien de: che do chinh sua dang KHOA');
select t.upload('dad_a1', 'album', t.id('dad'));
select t.ok((select status from public.media_items where id = (select id from t.media where k = 'dad_a1')) = 'ready', 'upload day du: media chuyen sang ready');
select t.ok((select path from t.media where k = 'dad_a1') = current_setting('t.fid') || '/album/' || t.id('dad')::text || '/' || (select id from t.media where k = 'dad_a1')::text || '.jpg',
  'duong dan dung mau <family>/album/<member>/<id>.jpg');
select t.ok((select thumb from t.media where k = 'dad_a1') like '%\_t.jpg', 'co anh thu nho _t.jpg');
select t.ok(t.rd('dad_a1') and t.rdt('dad_a1'), 'nguoi tai len doc duoc anh va anh thu nho cua minh');
-- Kiem tra dau vao begin_media_upload
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/svg+xml', 1000, 100, 10, 10)$$, 'MIME svg bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/gif', 1000, 100, 10, 10)$$, 'MIME gif bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'application/pdf', 1000, 100, 10, 10)$$, 'MIME pdf bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/jpeg', 8388609, 100, 10, 10)$$, 'tep > 8 MB bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/jpeg', 0, 100, 10, 10)$$, 'tep 0 byte bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/jpeg', 1000, 1048577, 10, 10)$$, 'anh thu nho > 1 MB bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/jpeg', 1000, 100, 0, 10)$$, 'kich thuoc anh khong hop le bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'khac', t.id('dad'), 'image/jpeg', 1000, 100, 10, 10)$$, 'loai khong hop le bi tu choi');
select t.ok(public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/png', 8388608, 0, 10, 10) is not null, 'dung 8 MB + png duoc chap nhan (bien)');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'album bat buoc co ho so dich');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'post', t.id('dad'), 'image/jpeg', 1000, 100, 10, 10)$$, 'anh bai viet khong gan ho so');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('f2m'), 'image/jpeg', 1000, 100, 10, 10)$$, 'ho so cua gia dinh khac bi tu choi');
select t.fails($$select public.begin_media_upload(current_setting('t.fid2')::uuid, 'post', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'khong tai len vao gia dinh khac');
select t.fails($$select t.upload('bad_noobj', 'album', t.id('dad'), p_skip_obj => true)$$, 'finalize khi chua co tep: bi tu choi');
select t.fails($$select t.upload('bad_size', 'album', t.id('dad'), p_bytes => 1000, p_actual => 999999)$$, 'finalize: kich thuoc thuc te khac khai bao (lach han muc) bi tu choi');

-- Chinh sach ghi storage.objects
select t.upload('pend', 'album', t.id('dad'), p_skip_obj => true, p_finalize => false);
select t.ok((select status from public.media_items where id = (select id from t.media where k = 'pend')) = 'pending', 'chua finalize: trang thai pending');
select t.fails($$insert into storage.objects (bucket_id, name) values ('family-media', current_setting('t.fid') || '/album/' || t.id('dad')::text || '/tu-bia-ra.jpg')$$, 'ghi vao duong dan KHONG duoc cap bi tu choi');
select t.fails($$insert into storage.objects (bucket_id, name) values ('family-media', 'khong-co-thu-muc-gia-dinh.jpg')$$, 'ghi duong dan khong theo mau bi tu choi');
select t.fails($$insert into storage.objects (bucket_id, name) values ('family-media', current_setting('t.fid2') || '/post/x.jpg')$$, 'ghi vao thu muc cua gia dinh khac bi tu choi');
select t.fails($$insert into storage.objects (bucket_id, name) select 'avatars', path from t.media where k = 'pend'$$, 'ghi sai bucket (duong dan cua family-media vao avatars) bi tu choi');
select t.fails($$insert into storage.objects (bucket_id, name) values ('public', 'x.jpg')$$, 'ghi vao bucket la bi tu choi');
select t.as_user(:'U5');
select t.fails($$insert into storage.objects (bucket_id, name) select bucket, path from t.media where k = 'pend'$$, 'nguoi khac KHONG ghi duoc vao duong dan duoc cap cho nguoi khac');
select t.as_user(:'U4');
select t.ok(t.affected($$insert into storage.objects (bucket_id, name) select bucket, path from t.media where k = 'pend'$$) = 1, 'chinh chu ghi duoc vao duong dan duoc cap (dong pending)');
select t.fails($$insert into storage.objects (bucket_id, name) select bucket, path from t.media where k = 'dad_a1'$$, 'khong ghi lai len media da ready (khong ghi de)');
select t.ok(t.affected($$update storage.objects set name = name || 'x' where name in (select path from t.media where k = 'dad_a1')$$) = 0, 'khong sua/doi ten tep qua RLS');
select t.ok(t.affected($$delete from storage.objects where name in (select path from t.media where k = 'dad_a1')$$) = 0, 'khong xoa tep truc tiep qua RLS');
select t.as_root();
select t.ok((select count(*) from storage.objects o join t.media m on m.path = o.name where m.k = 'dad_a1') = 1, 'tep van con sau khi thu sua/xoa');
select t.ok((select count(*) from public.media_items where family_id = current_setting('t.fid')::uuid) >= 3, 'media_items co dong cho moi lan tai len');
-- Nguoi ngoai / thu hoi / anon khong tai len duoc
select t.as_user(:'U7');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'post', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'tai khoan thu hoi: khong tai len');
select t.as_user(:'U6');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'post', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'nguoi ngoai gia dinh: khong tai len');
select t.as_anon();
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'post', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'anon: khong goi duoc begin_media_upload');
select t.fails($$insert into storage.objects (bucket_id, name) values ('family-media', 'a/b.jpg')$$, 'anon: khong ghi storage');
select t.fails($$select * from public.media_items$$, 'anon: khong doc media_items');
select t.as_user(:'U5');   -- guest
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'post', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'guest: khong tai anh bai viet');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('bkid'), 'image/jpeg', 1000, 100, 10, 10)$$, 'guest: khong tai vao album cua chinh minh (chi xem)');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'avatar', t.id('bkid'), 'image/jpeg', 1000, 100, 10, 10)$$, 'guest: khong doi anh dai dien');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'cover', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'guest: khong tai anh bia');

-- ===== 4. Anh bia gia dinh =====
select t.as_user(:'U4');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'cover', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'member: khong tai anh bia');
select t.as_user(:'U3');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'cover', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'branch_admin: khong tai anh bia (can family.update)');
select t.as_user(:'U2');
select t.upload('cover1', 'cover', null, p_bytes => 500000, p_thumb => 40000);
select t.ok((select path from t.media where k = 'cover1') like current_setting('t.fid') || '/cover/%', 'duong dan anh bia theo mau <family>/cover/..');
select t.as_user(:'U4');
select t.ok(not t.rd('cover1'), 'anh bia chua duoc dat: thanh vien khac chua doc duoc');
select t.fails($$select public.set_family_cover(current_setting('t.fid')::uuid, (select id from t.media where k = 'cover1'))$$, 'member: khong dat duoc anh bia');
select t.as_user(:'U3');
select t.fails($$select public.set_family_cover(current_setting('t.fid')::uuid, (select id from t.media where k = 'cover1'))$$, 'branch_admin: khong dat duoc anh bia');
select t.as_user(:'U2');
select t.fails($$select public.set_family_cover(current_setting('t.fid')::uuid, (select id from t.media where k = 'dad_a1'))$$, 'khong dat anh album lam anh bia (sai loai)');
select t.fails($$update public.families set cover_path = 'x/y.jpg' where id = current_setting('t.fid')::uuid$$, 'khong sua truc tiep families.cover_path');
select t.ok(t.affected($$update public.families set name = 'Gia dinh Test' where id = current_setting('t.fid')::uuid$$) = 1, 'van sua duoc ten gia dinh (khong lam hong quyen cu)');
select public.set_family_cover(current_setting('t.fid')::uuid, (select id from t.media where k = 'cover1'));
select t.ok((select cover_path from public.families where id = current_setting('t.fid')::uuid) = (select path from t.media where k = 'cover1'), 'set_family_cover cap nhat cover_path');
-- Moi thanh vien (ke ca khach) doc duoc anh bia; nguoi ngoai/thu hoi/anon thi khong
select t.as_user(:'U4'); select t.ok(t.rd('cover1') and t.rdt('cover1'), 'member doc duoc anh bia');
select t.as_user(:'U5'); select t.ok(t.rd('cover1'), 'guest doc duoc anh bia');
select t.as_user(:'U3'); select t.ok(t.rd('cover1'), 'branch_admin doc duoc anh bia');
select t.as_user(:'U8'); select t.ok(t.rd('cover1'), 'member nhanh khac doc duoc anh bia');
select t.as_user(:'U6'); select t.ok(not t.rd('cover1'), 'nguoi ngoai (gia dinh khac): khong doc anh bia');
select t.as_user(:'U7'); select t.ok(not t.rd('cover1'), 'tai khoan thu hoi: khong doc anh bia');
select t.as_anon(); select t.ok(not t.rd('cover1'), 'anon: khong doc anh bia');
select t.as_user(:'U4'); select t.ok(t.cnt('select 1 from public.media_items') >= 1, 'member doc duoc media_items cua noi dung duoc xem');
select t.ok(t.cnt($$select 1 from public.media_items where kind = 'cover'$$) = 1, 'member thay dong media cua anh bia');
select t.as_user(:'U6'); select t.ok(t.cnt($$select 1 from public.media_items where family_id = current_setting('t.fid')::uuid$$) = 0, 'nguoi ngoai khong thay media_items cua gia dinh khac');
-- Doi anh bia: ban cu bi xoa mem, khong con doc duoc
select t.as_user(:'U2');
select t.upload('cover2', 'cover', null);
select public.set_family_cover(current_setting('t.fid')::uuid, (select id from t.media where k = 'cover2'));
select t.as_user(:'U4');
select t.ok(not t.rd('cover1') and t.rd('cover2'), 'doi anh bia: ban cu khong doc duoc, ban moi doc duoc');
select t.as_root();
select t.ok((select deleted_at is not null from public.media_items where id = (select id from t.media where k = 'cover1')), 'anh bia cu bi xoa mem');
select t.ok((select count(*) from public.audit_logs where action = 'family.cover_set') = 2, 'nhat ky: dat anh bia duoc ghi');
-- Xoa anh bia
select t.as_user(:'U2');
select public.set_family_cover(current_setting('t.fid')::uuid, null);
select t.ok((select cover_path from public.families where id = current_setting('t.fid')::uuid) is null, 'xoa anh bia: cover_path = null');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'family.cover_clear') = 1, 'nhat ky: xoa anh bia duoc ghi');
-- Anh bia gia dinh khac khong lo
select t.as_user(:'U6');
select t.upload('cover_f2', 'cover', null, p_family => current_setting('t.fid2')::uuid);
select public.set_family_cover(current_setting('t.fid2')::uuid, (select id from t.media where k = 'cover_f2'));
select t.ok(t.rd('cover_f2'), 'gia dinh 2: super admin doc duoc anh bia cua minh');
select t.as_user(:'U2');
select t.ok(not t.rd('cover_f2'), 'family_admin gia dinh 1 khong doc duoc anh bia gia dinh 2');
select t.fails($$select public.set_family_cover(current_setting('t.fid2')::uuid, (select id from t.media where k = 'cover_f2'))$$, 'khong dat anh bia cho gia dinh khac');
select t.as_user(:'U6');
select t.fails($$select public.set_family_cover(current_setting('t.fid')::uuid, (select id from t.media where k = 'cover_f2'))$$, 'super admin gia dinh 2 khong dat anh bia cho gia dinh 1');

-- ===== 5. Anh dai dien =====
select t.as_user(:'U4');   -- chu ho so 'dad'
select t.upload('av_dad1', 'avatar', t.id('dad'), p_bytes => 30000, p_thumb => 0);
select t.ok((select bucket from t.media where k = 'av_dad1') = 'avatars', 'avatar nam trong bucket avatars');
select t.ok((select path from t.media where k = 'av_dad1') like current_setting('t.fid') || '/avatar/' || t.id('dad')::text || '/%', 'duong dan avatar theo mau <family>/avatar/<member>/..');
select t.as_user(:'U2'); select t.ok(not t.rd('av_dad1'), 'avatar chua dat: nguoi khac chua doc duoc');
select t.as_user(:'U4');
select public.set_member_avatar(t.id('dad'), (select id from t.media where k = 'av_dad1'));
select t.as_root();
select t.ok((select avatar_path from public.family_members where id = t.id('dad')) = (select path from t.media where k = 'av_dad1'), 'set_member_avatar cap nhat avatar_path');
select t.ok((select count(*) from public.audit_logs where action = 'member.update' and entity_id = t.id('dad')::text) >= 1, 'nhat ky: doi avatar duoc ghi (trigger member.update)');
select t.as_user(:'U2'); select t.ok(t.rd('av_dad1'), 'family_admin doc duoc avatar');
select t.as_user(:'U5'); select t.ok(t.rd('av_dad1'), 'guest doc duoc avatar (photo_visibility = family)');
select t.as_user(:'U8'); select t.ok(t.rd('av_dad1'), 'member nhanh khac doc duoc avatar (family)');
select t.ok((select avatar_path from public.members_view where id = t.id('dad')) is not null, 'members_view hien avatar_path (family)');
select t.as_user(:'U6'); select t.ok(not t.rd('av_dad1'), 'nguoi ngoai khong doc duoc avatar');
select t.as_anon(); select t.ok(not t.rd('av_dad1'), 'anon khong doc duoc avatar');
-- Rieng tu anh: photo_visibility = 'admins' (chu ho so tu dat)
select t.as_user(:'U4');
select public.update_member(t.id('dad'), '{"photo_visibility":"admins"}'::jsonb);
select t.ok(t.rd('av_dad1'), 'chu ho so van thay avatar cua minh');
select t.as_user(:'U5'); select t.ok(not t.rd('av_dad1'), 'photo_visibility=admins: guest khong doc avatar');
select t.ok((select avatar_path from public.members_view where id = t.id('dad')) is null, 'members_view che avatar_path (admins)');
select t.as_user(:'U8'); select t.ok(not t.rd('av_dad1'), 'photo_visibility=admins: member nhanh khac khong doc avatar');
select t.as_user(:'U3'); select t.ok(t.rd('av_dad1'), 'photo_visibility=admins: branch_admin cung nhanh doc duoc');
select t.as_user(:'U2'); select t.ok(t.rd('av_dad1'), 'photo_visibility=admins: family_admin doc duoc');
select t.as_user(:'U4');
select public.update_member(t.id('dad'), '{"photo_visibility":"family"}'::jsonb);
-- Doi avatar: ban cu bi xoa mem
select t.upload('av_dad2', 'avatar', t.id('dad'), p_bytes => 30000, p_thumb => 0);
select public.set_member_avatar(t.id('dad'), (select id from t.media where k = 'av_dad2'));
select t.as_user(:'U2'); select t.ok(t.rd('av_dad2') and not t.rd('av_dad1'), 'doi avatar: ban moi doc duoc, ban cu khong');
-- Quyen dat avatar
select t.as_user(:'U8');   -- member nhanh B, khong phai chu
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'avatar', t.id('dad'), 'image/jpeg', 1000, 0, 10, 10)$$, 'member khac: khong tai avatar cho nguoi khac (khoa chinh sua)');
select t.fails($$select public.set_member_avatar(t.id('dad'), (select id from t.media where k = 'av_dad2'))$$, 'member khac: khong dat avatar cho nguoi khac');
select t.as_user(:'U5');
select t.fails($$select public.set_member_avatar(t.id('bkid'), (select id from t.media where k = 'av_dad2'))$$, 'guest: khong dat avatar (ke ca ho so cua minh)');
select t.as_user(:'U4');
select t.fails($$select public.set_member_avatar(t.id('dad'), (select id from t.media where k = 'cover2'))$$, 'avatar: media sai loai bi tu choi');
select t.fails($$select public.set_member_avatar(t.id('badm'), (select id from t.media where k = 'av_dad2'))$$, 'avatar: khong dat avatar cua nguoi khac bang media cua minh');
select t.upload('av_pending', 'avatar', t.id('dad'), p_skip_obj => true, p_finalize => false);
select t.fails($$select public.set_member_avatar(t.id('dad'), (select id from t.media where k = 'av_pending'))$$, 'avatar: media pending (chua finalize) bi tu choi');
-- Admin dat avatar cho nguoi khac; che do MO cho phep member sua ho so chua co tai khoan
select t.as_user(:'U2');
select t.upload('av_gp', 'avatar', t.id('grandpa'), p_bytes => 20000, p_thumb => 0);
select public.set_member_avatar(t.id('grandpa'), (select id from t.media where k = 'av_gp'));
select t.as_user(:'U3');
select t.upload('av_living', 'avatar', t.id('living'), p_bytes => 20000, p_thumb => 0);
select public.set_member_avatar(t.id('living'), (select id from t.media where k = 'av_living'));
select t.as_user(:'U3');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'avatar', t.id('bmem'), 'image/jpeg', 1000, 0, 10, 10)$$, 'branch_admin: khong dat avatar nguoi nhanh khac');
select t.as_user(:'U8');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'avatar', t.id('grandpa'), 'image/jpeg', 1000, 0, 10, 10)$$, 'member: khoa chinh sua -> khong dat avatar cho nguoi khac');
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open', null);
select t.as_user(:'U8');
select t.upload('av_bmem', 'avatar', t.id('bmem'), p_bytes => 20000, p_thumb => 0);
select public.set_member_avatar(t.id('bmem'), (select id from t.media where k = 'av_bmem'));
select t.ok((select avatar_path from public.members_view where id = t.id('bmem')) is not null, 'che do MO: member dat duoc avatar cho ho so chua co tai khoan');
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'locked', null);
select t.as_user(:'U8');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'avatar', t.id('bmem'), 'image/jpeg', 1000, 0, 10, 10)$$, 'khoa lai: member khong dat avatar cho nguoi khac nua');
-- Tre em: anh cua tre toi da pham vi nhanh
select t.as_user(:'U2');
select t.upload('av_kid', 'avatar', t.id('kid'), p_bytes => 20000, p_thumb => 0);
select public.set_member_avatar(t.id('kid'), (select id from t.media where k = 'av_kid'));
select t.as_user(:'U4'); select t.ok(t.rd('av_kid'), 'anh dai dien tre em: nguoi cung nhanh doc duoc');
select t.as_user(:'U8'); select t.ok(not t.rd('av_kid'), 'anh dai dien tre em: nguoi nhanh khac KHONG doc duoc (tre em toi da pham vi nhanh)');
select t.as_user(:'U5'); select t.ok(not t.rd('av_kid'), 'anh dai dien tre em: guest khong doc duoc');
-- Xoa avatar
select t.as_user(:'U4');
select public.set_member_avatar(t.id('dad'), null);
select t.as_root();
select t.ok((select avatar_path from public.family_members where id = t.id('dad')) is null, 'xoa avatar: avatar_path = null');
select t.as_user(:'U2'); select t.ok(not t.rd('av_dad2'), 'xoa avatar: tep khong con doc duoc');

-- ===== 6. Album =====
select t.as_user(:'U4');
select t.ok(public.ensure_default_album(t.id('dad')) = public.ensure_default_album(t.id('dad')), 'album mac dinh: goi lai tra ve cung mot album');
insert into t.ids select 'alb_dad', public.ensure_default_album(t.id('dad'));
select t.ok((select title from public.albums where id = t.id('alb_dad')) = 'Ảnh chung', 'album mac dinh co ten Anh chung');
select t.ok(not public.is_editing_open(current_setting('t.fid')::uuid, :'BA'), 'chu album: che do chinh sua van KHOA');
select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'dad_a1'), 'Anh gia dinh', date '2020-02-01');
select t.ok((select item_count from public.albums_v where id = t.id('alb_dad')) = 1, 'chu album them anh luc khoa chinh sua (noi dung ca nhan)');
select t.fails($$select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'dad_a1'))$$, 'khong them cung mot anh hai lan');
select t.ok((select cover_media from public.albums where id = t.id('alb_dad')) = (select id from t.media where k = 'dad_a1'), 'anh dau tien tro thanh bia album');
select t.upload('dad_a2', 'album', t.id('dad'));
select t.upload('dad_a3', 'album', t.id('dad'));
select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'dad_a2'), null);
select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'dad_a3'), 'Cho hoi');
select t.fails($$select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'cover2'))$$, 'khong them media sai loai (cover) vao album');
select t.fails($$select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'av_gp'))$$, 'khong them media cua ho so khac vao album');
select t.ok((select count(*) from public.album_items_v where album_id = t.id('alb_dad')) = 3, 'album_items_v: 3 anh');
select t.ok((select caption from public.album_items_v where media_id = (select id from t.media where k = 'dad_a1')) = 'Anh gia dinh', 'chu thich duoc luu');
-- Moi thanh vien doc album 'family' cua moi nguoi
select t.as_user(:'U2'); select t.ok(t.rd('dad_a1') and t.rdt('dad_a1'), 'family_admin doc anh album family');
select t.ok(t.cnt($$select 1 from public.album_items_v where album_id = '$$ || t.id('alb_dad') || $$'$$) = 3, 'family_admin thay 3 anh trong album');
select t.as_user(:'U5'); select t.ok(t.rd('dad_a1'), 'guest doc anh album family (chi xem)');
select t.as_user(:'U8'); select t.ok(t.rd('dad_a2'), 'member nhanh khac doc anh album family');
select t.as_user(:'U3'); select t.ok(t.rd('dad_a3'), 'branch_admin doc anh album family');
select t.as_user(:'U6'); select t.ok(not t.rd('dad_a1') and not t.rdt('dad_a1'), 'nguoi ngoai (gia dinh khac) khong doc duoc anh album');
select t.ok(t.cnt('select 1 from public.albums_v') = 0, 'nguoi ngoai khong thay album nao cua gia dinh 1');
select t.ok(t.cnt('select 1 from public.album_items_v') = 0, 'nguoi ngoai khong thay anh album');
select t.as_user(:'U7'); select t.ok(not t.rd('dad_a1') and t.cnt('select 1 from public.albums_v') = 0, 'thu hoi: khong doc anh, khong thay album');
select t.as_anon(); select t.ok(not t.rd('dad_a1'), 'anon khong doc anh album'); select t.fails($$select * from public.albums_v$$, 'anon khong doc albums_v');
-- So anh theo thanh vien
select t.as_user(:'U5');
select t.ok((select photo_count from public.album_member_counts_v where member_id = t.id('dad')) = 3, 'album_member_counts_v: Bo co 3 anh');
-- Ai duoc them anh vao album cua nguoi khac
select t.as_user(:'U8');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/jpeg', 1000, 100, 10, 10)$$, 'member khac: khong them anh vao album cua ho so DA co tai khoan');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('grandpa'), 'image/jpeg', 1000, 100, 10, 10)$$, 'member: khoa chinh sua -> khong them anh vao album nguoi da mat');
select t.fails($$select public.create_album(t.id('grandpa'), 'Album cua minh cho ong')$$, 'member: khoa chinh sua -> khong tao album cho nguoi da mat');
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open', null);
select t.as_user(:'U8');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/jpeg', 1000, 100, 10, 10)$$, 'che do MO: van khong them anh vao album ho so DA co tai khoan');
insert into t.ids select 'alb_gp', public.ensure_default_album(t.id('grandpa'));
select t.upload('gp_a1', 'album', t.id('grandpa'));
select public.add_album_item(t.id('alb_gp'), (select id from t.media where k = 'gp_a1'), 'Anh ky niem');
select t.ok((select item_count from public.albums_v where id = t.id('alb_gp')) = 1, 'che do MO: member them anh vao album nguoi da mat');
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'locked', null);
select t.as_user(:'U8');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('grandpa'), 'image/jpeg', 1000, 100, 10, 10)$$, 'khoa lai: member khong them nua');
select t.ok(t.rd('gp_a1'), 'anh da them van doc duoc sau khi khoa lai');
-- Che do MO theo nhanh: gia dinh MO nhung nhanh A bi khoa rieng -> album nguoi nhanh A khong them duoc; nhanh B (ke thua) them duoc
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'open', null);
select t.as_user(:'U3');
select public.set_editing_mode(current_setting('t.fid')::uuid, :'BA', 'locked', null);
select t.as_user(:'U8');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('grandpa'), 'image/jpeg', 1000, 100, 10, 10)$$, 'nhanh A bi khoa rieng: khong them anh vao album nguoi nhanh A du gia dinh dang mo');
select t.ok(public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('bmem'), 'image/jpeg', 1000, 100, 10, 10) is not null, 'nhanh B ke thua che do mo: them duoc anh vao album nguoi nhanh B');
select t.as_user(:'U1');
select public.set_editing_mode(current_setting('t.fid')::uuid, null, 'locked', null);
-- Admin them anh vao album cua ho so co tai khoan
select t.as_user(:'U2');
select t.upload('dad_by_admin', 'album', t.id('dad'));
select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'dad_by_admin'), 'Admin them');
select t.ok((select item_count from public.albums_v where id = t.id('alb_dad')) = 4, 'admin them duoc anh vao album ho so co tai khoan');
select t.as_user(:'U3');
select t.upload('dad_by_badm', 'album', t.id('dad'));   -- branch_admin nhanh A, Bo thuoc nhanh A
select t.ok((select status from public.media_items where id = (select id from t.media where k = 'dad_by_badm')) = 'ready', 'branch_admin them duoc anh vao album ho so trong nhanh minh');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('bmem'), 'image/jpeg', 1000, 100, 10, 10)$$, 'branch_admin: khong them anh vao album nguoi nhanh B');
select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'dad_by_badm'), 'Quan tri nhanh them');
-- Chi nguoi tai anh len moi gan duoc vao album (khong gan anh do nguoi khac tai)
select t.as_user(:'U2');
select t.upload('dad_by_admin2', 'album', t.id('dad'));
select t.as_user(:'U4');
select t.fails($$select public.add_album_item(t.id('alb_dad'), (select id from t.media where k = 'dad_by_admin2'))$$, 'khong gan anh do nguoi khac tai len vao album cua minh');
-- Sua chu thich
select t.as_user(:'U8');
select t.fails($$select public.update_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_a1')), 'sua trom')$$, 'member khac: khong sua chu thich anh nguoi khac');
select t.as_user(:'U4');
select public.update_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_a1')), 'Chu thich moi', date '2021-03-04');
select t.ok((select caption from public.album_items_v where media_id = (select id from t.media where k = 'dad_a1')) = 'Chu thich moi', 'chu album sua chu thich');
select public.update_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_by_admin')), 'Chu album sua anh admin them');
select t.ok((select caption from public.album_items_v where media_id = (select id from t.media where k = 'dad_by_admin')) = 'Chu album sua anh admin them', 'chu album sua chu thich anh do admin them');
select t.as_user(:'U2');
select public.update_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_by_admin')), 'Admin sua anh minh them');
select t.ok((select caption from public.album_items_v where media_id = (select id from t.media where k = 'dad_by_admin')) = 'Admin sua anh minh them', 'nguoi them tu sua chu thich anh cua minh');
select t.as_user(:'U3');
select t.fails($$select public.update_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_a1')), 'quan tri nhanh sua noi dung ca nhan')$$, 'branch_admin: khong sua chu thich anh cua chu album (chi go vi pham)');
-- Go anh
select t.as_user(:'U8');
select t.fails($$select public.remove_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_a2')))$$, 'member khac: khong go anh nguoi khac');
select t.as_user(:'U5');
select t.fails($$select public.remove_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_a2')))$$, 'guest: khong go anh');
select t.as_user(:'U3');   -- branch_admin nhanh A go anh vi pham trong album nhanh A
select public.remove_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_by_admin')));
select t.ok(not exists (select 1 from public.album_items_v where media_id = (select id from t.media where k = 'dad_by_admin')), 'branch_admin go duoc anh vi pham trong nhanh minh');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'album.remove_item_moderation') = 1, 'nhat ky: go anh boi quan tri duoc ghi');
select t.ok((select deleted_at is not null from public.media_items where id = (select id from t.media where k = 'dad_by_admin')), 'go anh -> media bi xoa mem');
select t.as_user(:'U2'); select t.ok(not t.rd('dad_by_admin'), 'anh da go khong con doc duoc (nguoi khac)');
select t.as_user(:'U4'); select t.ok(not t.rd('dad_by_admin'), 'anh da go khong con doc duoc (ca chu album)');
-- Branch admin khong go anh o nhanh khac; admin gia dinh duoc
select t.as_user(:'U2');
insert into t.ids select 'alb_bmem', public.ensure_default_album(t.id('bmem'));
select t.upload('bmem_a1', 'album', t.id('bmem'));
select public.add_album_item(t.id('alb_bmem'), (select id from t.media where k = 'bmem_a1'));
select t.as_user(:'U3');
select t.fails($$select public.remove_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'bmem_a1')))$$, 'branch_admin: khong go anh nhanh khac');
select t.fails($$select public.delete_album(t.id('alb_bmem'))$$, 'branch_admin: khong xoa album nhanh khac');
-- Chu album go anh do nguoi khac them
select t.as_user(:'U4');
select public.remove_album_item((select id from public.album_items where media_id = (select id from t.media where k = 'dad_by_badm')));
select t.ok(not exists (select 1 from public.album_items_v where media_id = (select id from t.media where k = 'dad_by_badm')), 'chu album go duoc anh do nguoi khac them');
-- Album 'owner' (rieng tu) va 'branch'
select t.as_user(:'U4');
insert into t.ids select 'alb_priv', public.create_album(t.id('dad'), 'Rieng tu', 'Chi minh toi', 'owner');
insert into t.ids select 'alb_branch', public.create_album(t.id('dad'), 'Trong nhanh', null, 'branch');
select t.upload('priv1', 'album', t.id('dad'));
select t.upload('br1', 'album', t.id('dad'));
select public.add_album_item(t.id('alb_priv'), (select id from t.media where k = 'priv1'));
select public.add_album_item(t.id('alb_branch'), (select id from t.media where k = 'br1'));
select t.ok(t.rd('priv1') and t.rd('br1'), 'chu album doc duoc album owner va branch cua minh');
select t.as_user(:'U2'); select t.ok(not t.rd('priv1') and not t.rdt('priv1'), 'album owner: ke ca family_admin cung khong doc duoc');
select t.ok(t.cnt($$select 1 from public.albums where id = '$$ || t.id('alb_priv') || $$'$$) = 0, 'album owner: family_admin khong thay ca dong album');
select t.ok(t.rd('br1'), 'album branch: family_admin doc duoc');
select t.as_user(:'U3'); select t.ok(t.rd('br1') and not t.rd('priv1'), 'album branch: branch_admin nhanh A doc duoc; album owner thi khong');
select t.as_user(:'U8'); select t.ok(not t.rd('br1') and not t.rd('priv1'), 'album branch: member nhanh B khong doc duoc');
select t.as_user(:'U5'); select t.ok(not t.rd('br1') and not t.rd('priv1'), 'album branch/owner: guest khong doc duoc');
select t.as_user(:'U5');
select t.ok((select photo_count from public.album_member_counts_v where member_id = t.id('dad')) = 3, 'guest chi dem anh album family (3)');
select t.as_user(:'U3');
select t.ok((select photo_count from public.album_member_counts_v where member_id = t.id('dad')) = 4, 'branch_admin nhanh A dem 3 family + 1 branch');
select t.as_user(:'U2');
select t.ok((select photo_count from public.album_member_counts_v where member_id = t.id('dad')) = 4, 'family_admin dem 3 family + 1 branch (khong thay album owner)');
select t.as_user(:'U4');
select t.ok((select photo_count from public.album_member_counts_v where member_id = t.id('dad')) = 5, 'chu ho so dem du anh cua minh (3 family + owner + branch)');
select t.as_user(:'U8');
select t.ok((select photo_count from public.album_member_counts_v where member_id = t.id('dad')) = 3, 'member nhanh B chi dem anh album family (3)');
-- update_album
select t.as_user(:'U4');
select public.update_album(t.id('alb_dad'), 'Anh chung cua Bo', 'Mo ta', 'family', (select id from t.media where k = 'dad_a2'));
select t.ok((select title from public.albums_v where id = t.id('alb_dad')) = 'Anh chung cua Bo', 'chu album doi ten');
select t.fails($$select public.update_album(t.id('alb_dad'), 'x', null, 'family', (select id from t.media where k = 'bmem_a1'))$$, 'bia album phai la anh cua album');
select t.fails($$select public.update_album(t.id('alb_dad'), 'x', null, 'cong-khai', null)$$, 'visibility khong hop le bi tu choi');
select t.fails($$select public.update_album(t.id('alb_dad'), '   ', null, 'family', null)$$, 'ten album rong bi tu choi');
select t.as_user(:'U8');
select t.fails($$select public.update_album(t.id('alb_dad'), 'Chiem', null, 'family', null)$$, 'member khac khong sua album');
select t.fails($$select public.delete_album(t.id('alb_dad'))$$, 'member khac khong xoa album');
select t.fails($$select public.create_album(t.id('dad'), 'Album gia')$$, 'member khac khong tao album cho ho so co tai khoan');
-- Tag nguoi
select t.as_user(:'U4');
select public.tag_media_person((select id from t.media where k = 'dad_a1'), t.id('grandpa'));
select t.ok((select jsonb_array_length(people) from public.album_items_v where media_id = (select id from t.media where k = 'dad_a1')) = 1, 'tag nguoi trong anh');
select t.as_user(:'U8');
select t.ok(t.cnt($$select 1 from public.media_people$$) = 1, 'member thay tag cua anh duoc xem');
select t.fails($$select public.tag_media_person((select id from t.media where k = 'dad_a1'), t.id('u8m'))$$, 'member khac khong gan the vao anh nguoi khac');
select t.fails($$select public.untag_media_person((select id from t.media where k = 'dad_a1'), t.id('grandpa'))$$, 'member khac khong go the');
select t.as_user(:'U4');
select t.fails($$select public.tag_media_person((select id from t.media where k = 'dad_a1'), t.id('f2m'))$$, 'khong gan the ho so gia dinh khac');
select t.as_user(:'U6');
select t.ok(t.cnt('select 1 from public.media_people') = 0, 'nguoi ngoai khong thay the nguoi');
select t.as_user(:'U4');
select public.untag_media_person((select id from t.media where k = 'dad_a1'), t.id('grandpa'));
select t.ok(t.cnt('select 1 from public.media_people') = 0, 'go the nguoi');
-- Xoa album
select t.as_user(:'U3');
select public.delete_album(t.id('alb_branch'));
select t.ok(not exists (select 1 from public.albums_v where id = t.id('alb_branch')), 'branch_admin xoa album trong nhanh minh');
select t.as_user(:'U4'); select t.ok(not t.rd('br1'), 'xoa album: anh khong con doc duoc');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'album.delete_moderation') = 1, 'nhat ky: xoa album boi quan tri duoc ghi');
select t.as_user(:'U4');
select public.delete_album(t.id('alb_priv'));
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'album.delete_moderation') = 1, 'chu album tu xoa: khong ghi nhat ky kiem duyet');
-- Ho so bi xoa mem -> album an
select t.as_user(:'U2');
select public.ensure_default_album(t.id('living'));
select t.upload('living_a1', 'album', t.id('living'));
select public.add_album_item(public.ensure_default_album(t.id('living')), (select id from t.media where k = 'living_a1'));
select t.as_user(:'U5'); select t.ok(t.rd('living_a1'), 'truoc khi xoa ho so: guest doc duoc anh');
select t.as_user(:'U2');
select public.delete_member(t.id('living'));
select t.as_user(:'U5'); select t.ok(not t.rd('living_a1') and t.cnt($$select 1 from public.albums_v where member_id = '$$ || t.id('living') || $$'$$) = 0, 'ho so bi xoa mem: album va anh an');
select t.as_user(:'U2');
select public.restore_member(t.id('living'));
select t.as_user(:'U5'); select t.ok(t.rd('living_a1'), 'khoi phuc ho so: anh doc duoc lai');

-- ===== 7. Ghi truc tiep bi cam; ham noi bo khong goi duoc =====
select t.as_user(:'U1');
select t.fails($$insert into public.media_items (family_id, uploader, kind, bucket, path, mime, bytes) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000001', 'post', 'family-media', 'x', 'image/jpeg', 1)$$, 'super admin: khong ghi truc tiep media_items');
select t.fails($$update public.media_items set status = 'ready'$$, 'khong update truc tiep media_items');
select t.fails($$delete from public.media_items$$, 'khong delete truc tiep media_items');
select t.fails($$insert into public.albums (family_id, member_id, title, created_by) values (current_setting('t.fid')::uuid, t.id('dad'), 'x', '00000000-0000-0000-0000-000000000001')$$, 'khong ghi truc tiep albums');
select t.fails($$update public.albums set title = 'x'$$, 'khong update truc tiep albums');
select t.fails($$insert into public.album_items (family_id, album_id, media_id, added_by) values (current_setting('t.fid')::uuid, t.id('alb_dad'), (select id from t.media where k = 'dad_a1'), '00000000-0000-0000-0000-000000000001')$$, 'khong ghi truc tiep album_items');
select t.fails($$delete from public.album_items$$, 'khong xoa truc tiep album_items');
select t.fails($$insert into public.media_people (media_id, member_id, family_id, tagged_by) values ((select id from t.media where k = 'dad_a1'), t.id('dad'), current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000001')$$, 'khong ghi truc tiep media_people');
select t.fails($$select * from public.family_media_settings$$, 'khong doc truc tiep family_media_settings');
select t.fails($$select public._media_soft_delete((select id from t.media where k = 'dad_a1'))$$, 'ham noi bo _media_soft_delete khong goi duoc');
select t.fails($$select public._can_upload_kind(current_setting('t.fid')::uuid, 'post', null)$$, 'ham noi bo _can_upload_kind khong goi duoc');
select t.fails($$select * from public.media_cleanup_list()$$, 'authenticated khong goi duoc media_cleanup_list');
select t.fails($$select public.media_cleanup_finish(array[gen_random_uuid()])$$, 'authenticated khong goi duoc media_cleanup_finish');
select t.as_anon();
select t.fails($$select * from public.media_cleanup_list()$$, 'anon khong goi duoc media_cleanup_list');

-- ===== 8. Han muc dung luong =====
select t.as_user(:'U2');
select t.ok((public.family_media_usage(current_setting('t.fid')::uuid)->>'quota_bytes')::bigint = 838860800, 'han muc mac dinh 800 MB');
select t.ok((public.family_media_usage(current_setting('t.fid')::uuid)->>'used_bytes')::bigint > 0, 'bao muc dung > 0 sau khi tai anh');
select t.ok((public.family_media_usage(current_setting('t.fid')::uuid)->>'items')::int >= 10, 'bao so anh');
select t.fails($$select public.set_media_quota(current_setting('t.fid')::uuid, 104857600)$$, 'family_admin: khong doi han muc (chi super admin)');
select t.as_user(:'U3'); select t.fails($$select public.family_media_usage(current_setting('t.fid')::uuid)$$, 'branch_admin: khong xem muc dung luong');
select t.as_user(:'U4'); select t.fails($$select public.family_media_usage(current_setting('t.fid')::uuid)$$, 'member: khong xem muc dung luong');
select t.as_user(:'U6'); select t.fails($$select public.family_media_usage(current_setting('t.fid')::uuid)$$, 'nguoi ngoai: khong xem muc dung luong');
select t.as_user(:'U1');
select t.fails($$select public.set_media_quota(current_setting('t.fid')::uuid, 1000)$$, 'han muc qua nho bi tu choi');
select t.fails($$select public.set_media_quota(current_setting('t.fid')::uuid, 1073741824000)$$, 'han muc qua lon bi tu choi');
select public.set_media_quota(current_setting('t.fid')::uuid, 52428800);   -- 50 MB
select t.ok((public.family_media_usage(current_setting('t.fid')::uuid)->>'quota_bytes')::bigint = 52428800, 'super admin dat han muc 50 MB');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'media.set_quota') = 1, 'nhat ky: doi han muc duoc ghi');
select t.as_user(:'U4');
-- Dung chuan: moi lan giu cho 8 MB; den luc vuot 50 MB thi bi chan
do $$
declare i int; ok_n int := 0; blocked boolean := false;
begin
  for i in 1..8 loop
    begin
      perform public.begin_media_upload(current_setting('t.fid')::uuid, 'album', (select v from t.ids where k = 'dad'), 'image/jpeg', 8388608, 0, 10, 10);
      ok_n := ok_n + 1;
    exception when sqlstate 'P0001' then blocked := true; exit;
    end;
  end loop;
  perform t.ok(blocked and ok_n between 4 and 7, 'han muc: bi chan khi vuot 50 MB (so lan giu cho thanh cong = ' || ok_n || ')');
end $$;
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'album', t.id('dad'), 'image/jpeg', 8388608, 0, 10, 10)$$, 'han muc: tiep tuc bi chan');
select t.as_user(:'U2');
select t.ok((public.family_media_usage(current_setting('t.fid')::uuid)->>'used_bytes')::bigint <= 52428800, 'muc dung khong vuot han muc');
-- Han muc cua gia dinh khac khong anh huong
select t.as_user(:'U6');
select t.ok(public.begin_media_upload(current_setting('t.fid2')::uuid, 'post', null, 'image/jpeg', 8388608, 0, 10, 10) is not null, 'han muc la theo tung gia dinh (gia dinh 2 van tai duoc)');

-- ===== 9. Don dep media mo coi =====
select t.as_root();
select t.ok(t.cnt($$select 1 from public.media_items where status = 'pending' and deleted_at is null$$) >= 6, 'tien de: co nhieu media pending');
select t.ok((select count(*) from public.media_cleanup_list()) = 0, 'media pending moi (< 24 gio) chua bi don');
update public.media_items set created_at = now() - interval '25 hours' where status = 'pending' and deleted_at is null and family_id = current_setting('t.fid')::uuid;
-- Media READY cu (30 ngay) van dang dung: KHONG duoc don
update public.media_items set created_at = now() - interval '30 days' where id = (select id from t.media where k = 'dad_a1');
select t.as_service();
select t.ok((select count(*) from public.media_cleanup_list(24, 3, 1000)) >= 6, 'service_role: pending > 24 gio nam trong danh sach don');
select t.ok(not exists (select 1 from public.media_cleanup_list(24, 3, 1000) where id = (select id from t.media where k = 'dad_a1')), 'media ready cu 30 ngay nhung dang dung: khong bi don');
select t.ok(not exists (select 1 from public.media_cleanup_list(24, 3, 1000) c join public.media_items m on m.id = c.id where m.status = 'ready'), 'danh sach don khong chua media ready con dung');
select t.ok(not exists (select 1 from public.media_cleanup_list(24, 3, 1000) c where c.id = (select id from t.media where k = 'dad_a1')), 'media dang dung khong bi don');
select t.as_root();
create table t.cl as select id from public.media_cleanup_list(24, 3, 1000);
grant select on t.cl to public;
select t.as_service();
select t.ok(public.media_cleanup_finish(array(select id from t.cl)) = (select count(*) from t.cl), 'cleanup_finish danh dau dung so dong');
select t.ok(public.media_cleanup_finish(array(select id from t.cl)) = 0, 'cleanup_finish lan 2: khong dong nao con du dieu kien');
select t.ok(public.media_cleanup_finish(array[(select id from t.media where k = 'dad_a1')]) = 0, 'cleanup_finish khong dung vao media dang dung');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'media.cleanup') = 1, 'nhat ky: don dep duoc ghi');
select t.ok(not exists (select 1 from public.media_items where id in (select id from t.cl) and purged_at is null), 'moi dong da don co purged_at');
select t.as_user(:'U2');
select t.ok((public.family_media_usage(current_setting('t.fid')::uuid)->>'used_bytes')::bigint < 20000000, 'sau don dep: muc dung giam (khong con tinh phan da don)');
select t.as_root();
-- Media da xoa qua 3 ngay duoc don; chua toi han thi chua
update public.media_items set deleted_at = now() - interval '4 days' where id = (select id from t.media where k = 'dad_by_admin');
update public.media_items set deleted_at = now() - interval '1 day' where id = (select id from t.media where k = 'dad_by_badm');
select t.as_service();
select t.ok(exists (select 1 from public.media_cleanup_list(24, 3, 1000) where id = (select id from t.media where k = 'dad_by_admin')), 'media xoa > 3 ngay: vao danh sach don');
select t.ok(not exists (select 1 from public.media_cleanup_list(24, 3, 1000) where id = (select id from t.media where k = 'dad_by_badm')), 'media xoa < 3 ngay: chua don (cho khoi phuc/phan nan)');
select t.ok(public.media_cleanup_finish(array[(select id from t.media where k = 'dad_by_admin')]) = 1, 'don media da xoa qua han');
select t.as_user(:'U4');
select t.ok(not t.rd('dad_by_admin'), 'media da don khong doc duoc');
-- Media READY nhung chua gan vao dau (chon anh roi bo) qua 24 gio cung bi don; anh dang dung thi khong
select t.as_root();
update public.media_items set created_at = now() - interval '2 days'
  where id in (select id from t.media where k in ('dad_by_admin2', 'dad_a2', 'av_gp', 'av_kid'));
select t.as_service();
select t.ok(exists (select 1 from public.media_cleanup_list(24, 3, 1000) where id = (select id from t.media where k = 'dad_by_admin2')), 'anh ready chua gan vao dau (> 24 gio): vao danh sach don');
select t.ok(not exists (select 1 from public.media_cleanup_list(24, 3, 1000) where id in (select id from t.media where k in ('dad_a2', 'av_gp', 'av_kid'))), 'anh ready dang dung (album / avatar): khong bi don');
select t.ok(public.media_cleanup_finish(array[(select id from t.media where k = 'dad_by_admin2')]) = 1, 'don anh ready chua gan');
select t.as_user(:'U2');
select t.ok(not t.rd('dad_by_admin2'), 'anh chua gan da don: khong doc duoc');
select t.ok(t.rd('dad_a2'), 'anh dang dung van doc duoc');
select t.as_user(:'U1');
select public.set_media_quota(current_setting('t.fid')::uuid, 838860800);

-- ===== (tiep tuc o phan bang tin) =====
\ir media_posts_part.sql
