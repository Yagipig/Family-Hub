-- Phan bang tin cua kiem thu module Media (duoc rls_media.sql nap bang \ir; KHONG chay rieng).
-- Ngu canh: gia dinh test + fixture + ho so da dung o rls_media.sql; che do chinh sua dang KHOA, han muc 800 MB.

-- ===== 10. Dang bai =====
select t.as_user(:'U4');
insert into t.ids select 'p1', public.create_post(current_setting('t.fid')::uuid, 'Xin chao ca nha', 'family');
insert into t.ids select 'p2', public.create_post(current_setting('t.fid')::uuid, 'Chuyen rieng cua nhanh A', 'branch');
select t.ok((select branch_id from public.posts where id = t.id('p1')) = :'BA', 'bai cua member ghi nhanh cua tac gia (pham vi kiem duyet)');
select t.ok((select visibility from public.posts where id = t.id('p2')) = 'branch', 'bai pham vi nhanh');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'Dang vao nhanh B', 'family', 'b0000000-0000-0000-0000-00000000000b')$$, 'member khong dang vao nhanh khac cua minh');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, repeat('a', 5001), 'family')$$, 'bai > 5000 ky tu bi tu choi');
select t.ok(public.create_post(current_setting('t.fid')::uuid, repeat('a', 5000), 'family') is not null, 'bai dung 5000 ky tu duoc chap nhan');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, '   ', 'family')$$, 'bai rong bi tu choi');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'x', 'cong-khai')$$, 'visibility khong hop le bi tu choi');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'x', 'family', null, array(select gen_random_uuid()))$$, 'media khong ton tai bi tu choi');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'x', 'family', null, array(select gen_random_uuid() from generate_series(1, 11)))$$, 'qua 10 anh bi tu choi');
select t.as_user(:'U2');
insert into t.ids select 'p3', public.create_post(current_setting('t.fid')::uuid, 'Thong bao cua quan tri gia dinh', 'family');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'x', 'branch')$$, 'bai pham vi nhanh can co nhanh (admin khong thuoc nhanh nao)');
insert into t.ids select 'p4', public.create_post(current_setting('t.fid')::uuid, 'Admin dang cho nhanh A', 'branch', 'b0000000-0000-0000-0000-00000000000a');
select t.ok((select branch_id from public.posts where id = t.id('p3')) is null, 'bai cua admin toan gia dinh: branch_id = null');
select t.as_user(:'U3');
insert into t.ids select 'p5', public.create_post(current_setting('t.fid')::uuid, 'Branch admin dang cho nhanh A', 'branch');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'x', 'branch', 'b0000000-0000-0000-0000-00000000000b')$$, 'branch_admin khong dang vao nhanh ngoai pham vi');
select t.as_user(:'U8');
insert into t.ids select 'p6', public.create_post(current_setting('t.fid')::uuid, 'Bai cua nhanh B', 'family');
-- Khong duoc dang
select t.as_user(:'U5');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'Khach dang bai', 'family')$$, 'guest: khong dang bai');
select t.as_user(:'U6');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'Nguoi ngoai', 'family')$$, 'nguoi ngoai: khong dang bai vao gia dinh 1');
select t.as_user(:'U7');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'Thu hoi', 'family')$$, 'tai khoan thu hoi: khong dang bai');
select t.as_anon();
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'Anon', 'family')$$, 'anon: khong goi duoc create_post');
-- Anh bai viet
select t.as_user(:'U4');
select t.upload('pm1', 'post', null, p_bytes => 200000, p_thumb => 20000);
select t.upload('pm2', 'post', null);
select t.ok((select path from t.media where k = 'pm1') like current_setting('t.fid') || '/post/%', 'duong dan anh bai viet theo mau <family>/post/..');
insert into t.ids select 'p7', public.create_post(current_setting('t.fid')::uuid, 'Bai co anh', 'family', null, array[(select id from t.media where k = 'pm1')]);
insert into t.ids select 'p8', public.create_post(current_setting('t.fid')::uuid, 'Anh rieng nhanh A', 'branch', null, array[(select id from t.media where k = 'pm2')]);
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'dung lai anh', 'family', null, array[(select id from t.media where k = 'pm1')])$$, 'mot anh khong gan cho hai bai');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'anh album', 'family', null, array[(select id from t.media where k = 'dad_a1')])$$, 'media album khong dung duoc cho bai viet');
select t.as_user(:'U8');
select t.upload('pm_u8', 'post', null);
select t.as_user(:'U2');
select t.fails($$select public.create_post(current_setting('t.fid')::uuid, 'lay anh nguoi khac', 'family', null, array[(select id from t.media where k = 'pm_u8')])$$, 'khong dung anh do nguoi khac tai len');
select t.as_user(:'U8');
insert into t.ids select 'p_img_only', public.create_post(current_setting('t.fid')::uuid, '', 'family', null, array[(select id from t.media where k = 'pm_u8')]);
select t.ok((select body from public.posts where id = t.id('p_img_only')) = '', 'bai chi co anh (khong chu) duoc chap nhan');
-- Anh bai viet chon roi bo (khong gan vao bai nao) qua 24 gio bi don; anh da gan vao bai thi khong
select t.as_user(:'U4');
select t.upload('pm_orphan', 'post', null);
select t.as_root();
update public.media_items set created_at = now() - interval '2 days' where id in (select id from t.media where k in ('pm_orphan', 'pm1', 'pm2', 'pm_u8'));
select t.as_service();
select t.ok(exists (select 1 from public.media_cleanup_list(24, 3, 1000) where id = (select id from t.media where k = 'pm_orphan')), 'anh bai viet chua gan (> 24 gio): vao danh sach don');
select t.ok(not exists (select 1 from public.media_cleanup_list(24, 3, 1000) where id in (select id from t.media where k in ('pm1', 'pm2', 'pm_u8'))), 'anh da gan vao bai viet: khong bi don');
select t.ok(public.media_cleanup_finish(array[(select id from t.media where k = 'pm_orphan')]) = 1, 'don anh bai viet chua gan');
select t.as_user(:'U4');
select t.ok(not t.rd('pm_orphan'), 'anh da don: khong doc duoc');
-- Doc anh bai viet (storage)
select t.as_user(:'U5'); select t.ok(t.rd('pm1') and t.rdt('pm1'), 'guest doc anh bai viet cong khai trong gia dinh');
select t.ok(not t.rd('pm2'), 'guest khong doc anh cua bai pham vi nhanh');
select t.as_user(:'U8'); select t.ok(t.rd('pm1') and not t.rd('pm2'), 'member nhanh B: doc anh bai family, khong doc anh bai nhanh A');
select t.as_user(:'U3'); select t.ok(t.rd('pm1') and t.rd('pm2'), 'branch_admin nhanh A doc ca hai');
select t.as_user(:'U2'); select t.ok(t.rd('pm1') and t.rd('pm2'), 'family_admin doc ca hai');
select t.as_user(:'U4'); select t.ok(t.rd('pm1') and t.rd('pm2'), 'tac gia doc ca hai');
select t.as_user(:'U6'); select t.ok(not t.rd('pm1') and not t.rd('pm2'), 'nguoi ngoai khong doc anh bai viet');
select t.as_user(:'U7'); select t.ok(not t.rd('pm1'), 'tai khoan thu hoi khong doc anh bai viet');
select t.as_anon(); select t.ok(not t.rd('pm1'), 'anon khong doc anh bai viet');

-- ===== 11. Doc bang tin (RLS + feed_page) =====
select t.as_user(:'U5');   -- guest, khong thuoc nhanh nao
select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid)) = 6, 'guest: feed gom 6 bai family (p1, bai 5000 ky tu, p3, p6, p7, bai chi anh)');
select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid) where id in (t.id('p2'), t.id('p4'), t.id('p5'), t.id('p8'))), 'guest khong thay bai pham vi nhanh');
select t.ok(t.cnt('select 1 from public.posts') = 6, 'guest: bang posts cung 6 dong (RLS)');
select t.as_user(:'U8');
select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid)) = 6, 'member nhanh B khong thay bai pham vi nhanh A');
select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p2')), 'member nhanh B khong thay p2');
select t.as_user(:'U4');
select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid)) = 10, 'member nhanh A thay 10 bai (6 family + p2,p4,p5,p8)');
select t.as_user(:'U3');
select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid)) = 10, 'branch_admin nhanh A thay 10 bai');
select t.as_user(:'U2'); select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid)) = 10, 'family_admin thay 10 bai');
select t.as_user(:'U1'); select t.ok(t.cnt('select 1 from public.posts') = 10, 'super_admin thay 10 bai');
select t.as_user(:'U6');
select t.ok(t.cnt($$select 1 from public.posts where family_id = current_setting('t.fid')::uuid$$) = 0, 'nguoi ngoai: khong thay bai nao cua gia dinh 1');
select t.fails($$select * from public.feed_page(current_setting('t.fid')::uuid)$$, 'nguoi ngoai: feed_page bi tu choi');
select t.ok(t.cnt('select 1 from public.post_media') = 0, 'nguoi ngoai: khong thay post_media');
select t.as_user(:'U7');
select t.fails($$select * from public.feed_page(current_setting('t.fid')::uuid)$$, 'tai khoan thu hoi: feed_page bi tu choi');
select t.ok(t.cnt('select 1 from public.posts') = 0, 'tai khoan thu hoi: khong thay bai nao');
select t.as_anon();
select t.fails($$select * from public.posts$$, 'anon: khong doc bang posts');
select t.fails($$select * from public.feed_page(current_setting('t.fid')::uuid)$$, 'anon: khong goi duoc feed_page');
select t.fails($$select * from public.moderation_queue(current_setting('t.fid')::uuid)$$, 'anon: khong goi duoc moderation_queue');
-- Noi dung feed
select t.as_user(:'U8');
select t.ok((select jsonb_array_length(media) from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p7')) = 1, 'feed: bai co anh tra ve danh sach media');
select t.ok((select author_name from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')) = 'Bo', 'feed: ten tac gia lay tu ho so thanh vien');
select t.ok((select is_mine from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p6')), 'feed: is_mine cho bai cua minh');
select t.ok(not (select can_moderate from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p6')), 'feed: member khong co quyen kiem duyet');
select t.as_user(:'U3');
select t.ok((select can_moderate from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')), 'feed: branch_admin kiem duyet bai trong nhanh');
select t.ok(not (select can_moderate from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p6')), 'feed: branch_admin khong kiem duyet bai nhanh B');

-- ===== 12. Phan trang theo cursor =====
select t.as_root();
insert into public.posts (family_id, branch_id, author_id, body, visibility, created_at)
select current_setting('t.fid')::uuid, null, :'U2', 'Bai cu so ' || g, 'family', now() - interval '2 hours' - g * interval '1 minute'
from generate_series(1, 60) g;
select t.as_user(:'U5');
do $$
declare
  v_ids uuid[] := '{}'; v_cur_at timestamptz; v_cur_id uuid; n int; pages int := 0; rec record; total int;
  v_prev timestamptz := null; sorted boolean := true; v_new uuid[];
begin
  select count(*) into total from public.posts;   -- RLS: bai guest duoc xem
  loop
    v_new := '{}';
    for rec in select * from public.feed_page(current_setting('t.fid')::uuid, v_cur_at, v_cur_id, 7) loop
      v_new := v_new || rec.id;
      if v_prev is not null and rec.created_at > v_prev then sorted := false; end if;
      v_prev := rec.created_at; v_cur_at := rec.created_at; v_cur_id := rec.id;
    end loop;
    exit when cardinality(v_new) = 0;
    pages := pages + 1; v_ids := v_ids || v_new;
    exit when pages > 20;
    if cardinality(v_new) < 7 then exit; end if;
  end loop;
  perform t.ok(cardinality(v_ids) = total, 'phan trang: gom du ' || total || ' bai (lay duoc ' || cardinality(v_ids) || ' trong ' || pages || ' trang)');
  perform t.ok((select count(distinct x) from unnest(v_ids) x) = cardinality(v_ids), 'phan trang: khong trung bai giua cac trang');
  perform t.ok(sorted, 'phan trang: moi nhat truoc');
  perform t.ok(pages >= 5, 'phan trang: chia nhieu trang (trang 7 bai)');
end $$;
select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid, null, null, 1000)) = 50, 'gioi han so bai moi trang toi da 50');
select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid, null, null, 0)) = 1, 'p_limit <= 0 duoc dua ve 1');

-- ===== 13. Sua / xoa / an / ghim =====
select t.as_user(:'U4');
select public.update_post(t.id('p1'), 'Xin chao ca nha (da sua)');
select t.ok((select edited_at is not null and body = 'Xin chao ca nha (da sua)' from public.posts where id = t.id('p1')), 'tac gia sua bai, co edited_at');
select t.fails($$select public.update_post(t.id('p1'), '')$$, 'sua thanh rong bi tu choi (bai khong anh)');
select t.as_user(:'U8');
select t.fails($$select public.update_post(t.id('p1'), 'sua trom')$$, 'member khac khong sua bai nguoi khac');
select t.fails($$select public.delete_post(t.id('p1'))$$, 'member khac khong xoa bai nguoi khac');
select t.fails($$select public.hide_post(t.id('p1'), 'x')$$, 'member khong an bai');
select t.fails($$select public.pin_post(t.id('p1'), true)$$, 'member khong ghim bai');
select t.as_user(:'U2');
select t.fails($$select public.update_post(t.id('p1'), 'admin sua bai nguoi khac')$$, 'admin khong sua bai nguoi khac (chi an/xoa)');
select t.as_user(:'U5');
select t.fails($$select public.update_post(t.id('p1'), 'x')$$, 'guest khong sua bai');
select t.fails($$select public.delete_post(t.id('p1'))$$, 'guest khong xoa bai');
select t.fails($$select public.hide_post(t.id('p1'), 'x')$$, 'guest khong an bai');
select t.as_user(:'U6');
select t.fails($$select public.delete_post(t.id('p1'))$$, 'nguoi ngoai khong xoa bai');
select t.fails($$select public.hide_post(t.id('p1'), 'x')$$, 'nguoi ngoai khong an bai');
-- An bai
select t.as_user(:'U3');   -- branch_admin nhanh A
select t.fails($$select public.hide_post(t.id('p3'), 'vi pham')$$, 'branch_admin khong an bai cap gia dinh (branch_id null)');
select t.fails($$select public.hide_post(t.id('p6'), 'vi pham')$$, 'branch_admin khong an bai nhanh B');
select public.hide_post(t.id('p1'), 'Noi dung khong phu hop');
select t.as_user(:'U5'); select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')), 'bai bi an: guest khong thay');
select t.as_user(:'U8'); select t.ok(t.cnt($$select 1 from public.posts where id = '$$ || t.id('p1') || $$'$$) = 0, 'bai bi an: member khac khong thay (RLS)');
select t.as_user(:'U4'); select t.ok((select hidden from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')), 'bai bi an: tac gia van thay va biet bai bi an');
select t.ok((select hide_reason from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')) = 'Noi dung khong phu hop', 'tac gia thay ly do bi an');
select t.fails($$select public.update_post(t.id('p1'), 'sua bai bi an')$$, 'khong sua bai dang bi an');
select t.fails($$select public.add_comment(t.id('p1'), 'binh luan vao bai bi an')$$, 'khong binh luan vao bai bi an');
select t.as_user(:'U3'); select t.ok((select count(*) from public.hidden_posts(current_setting('t.fid')::uuid)) = 1, 'hidden_posts: quan tri nhanh thay bai bi an trong nhanh');
select t.as_user(:'U2');
select t.fails($$select public.pin_post(t.id('p1'), true)$$, 'khong ghim bai dang bi an');
select t.as_user(:'U8'); select t.ok((select count(*) from public.hidden_posts(current_setting('t.fid')::uuid)) = 0, 'hidden_posts: member khong thay gi');
select t.as_user(:'U3');
select public.unhide_post(t.id('p1'));
select t.as_user(:'U5'); select t.ok(exists (select 1 from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')), 'bo an: guest thay lai');
select t.as_user(:'U2');
select public.hide_post(t.id('p3'), 'thu');
select t.as_user(:'U3'); select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p3')), 'bai cap gia dinh bi an: branch_admin khong thay');
select t.as_user(:'U2'); select t.ok(exists (select 1 from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p3')), 'bai cap gia dinh bi an: tac gia (admin) van thay');
select public.unhide_post(t.id('p3'));
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'post.hide') = 2, 'nhat ky: an bai duoc ghi (2)');
select t.ok((select count(*) from public.audit_logs where action = 'post.unhide') = 2, 'nhat ky: bo an bai duoc ghi (2)');
-- Ghim
select t.as_user(:'U3');
select t.fails($$select public.pin_post(t.id('p1'), true)$$, 'branch_admin khong ghim bai pham vi gia dinh');
select public.pin_post(t.id('p5'), true);
select t.as_user(:'U4'); select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid, null, null, 20, true)) = 1, 'branch_admin ghim duoc bai pham vi nhanh');
select t.as_user(:'U8'); select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid, null, null, 20, true)) = 0, 'bai ghim cua nhanh A khong lo cho nhanh B');
select t.as_user(:'U2');
select public.pin_post(t.id('p1'), true);
select public.pin_post(t.id('p3'), true);
select t.as_user(:'U8'); select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid, null, null, 20, true)) = 2, 'bai ghim gia dinh: moi nguoi thay (2)');
select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid, null, null, 50) where id in (t.id('p1'), t.id('p3'))), 'bai da ghim khong lap lai trong danh sach thuong');
select t.as_user(:'U2');
select public.pin_post(t.id('p3'), false);
select t.as_user(:'U8'); select t.ok((select count(*) from public.feed_page(current_setting('t.fid')::uuid, null, null, 20, true)) = 1, 'bo ghim');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action in ('post.pin','post.unpin')) = 4, 'nhat ky: ghim / bo ghim duoc ghi (4)');
select t.as_user(:'U2'); select public.pin_post(t.id('p1'), false);
select t.as_user(:'U3'); select public.pin_post(t.id('p5'), false);
-- Xoa bai
select t.as_user(:'U4');
insert into t.ids select 'p_tmp', public.create_post(current_setting('t.fid')::uuid, 'Bai se tu xoa', 'family');
select public.delete_post(t.id('p_tmp'));
select t.as_user(:'U5'); select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid, null, null, 50) where id = t.id('p_tmp')), 'xoa mem: bai khong con trong feed');
select t.as_root();
select t.ok((select deleted_at is not null from public.posts where id = t.id('p_tmp')), 'xoa mem: dong van con (deleted_at)');
select t.ok((select count(*) from public.audit_logs where action = 'post.delete_moderation') = 0, 'tac gia tu xoa: khong ghi nhat ky kiem duyet');
select t.as_user(:'U3');
select public.delete_post(t.id('p2'));   -- bai cua U4 trong nhanh A
select t.fails($$select public.delete_post(t.id('p6'))$$, 'branch_admin khong xoa bai nhanh B');
select t.fails($$select public.delete_post(t.id('p3'))$$, 'branch_admin khong xoa bai cap gia dinh');
select t.as_user(:'U4'); select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid, null, null, 50) where id = t.id('p2')), 'bai bi quan tri xoa: tac gia cung khong thay');
select t.as_user(:'U8');
insert into t.ids select 'p9', public.create_post(current_setting('t.fid')::uuid, 'Bai se bi admin xoa', 'family');
select t.as_user(:'U2');
select public.delete_post(t.id('p9'));
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'post.delete_moderation') = 2, 'nhat ky: xoa boi quan tri duoc ghi (2)');
-- Xoa bai co anh: anh khong con doc duoc
select t.as_user(:'U5'); select t.ok(t.rd('pm1'), 'truoc khi xoa bai: guest doc duoc anh');
select t.as_user(:'U4');
select public.delete_post(t.id('p7'));
select t.as_user(:'U5'); select t.ok(not t.rd('pm1') and not t.rdt('pm1'), 'xoa bai: anh dinh kem khong con doc duoc');
select t.as_user(:'U4'); select t.ok(not t.rd('pm1'), 'xoa bai: ca tac gia cung khong doc duoc anh da xoa');

-- ===== 14. Binh luan + thong bao =====
select t.as_user(:'U2');
insert into t.ids select 'c1', public.add_comment(t.id('p1'), 'Chuc mung nhe!');
select t.as_user(:'U4');
select t.ok((select count(*) from public.notifications where kind = 'system' and link = '/bang-tin#bai-' || t.id('p1')::text) = 1, 'thong bao: tac gia nhan thong bao khi co binh luan vao bai cua minh');
select t.ok((select title from public.notifications where kind = 'system' order by created_at desc limit 1) like 'Quan tri gia dinh%', 'thong bao co ten nguoi binh luan');
select t.ok((select family_id from public.notifications where kind = 'system' limit 1) = current_setting('t.fid')::uuid, 'thong bao dung gia dinh');
insert into t.ids select 'c_own', public.add_comment(t.id('p1'), 'Cam on moi nguoi');
select t.ok((select count(*) from public.notifications where kind = 'system' and link = '/bang-tin#bai-' || t.id('p1')::text) = 1, 'tu binh luan bai cua minh: khong tu thong bao');
select public.set_post_notifications(current_setting('t.fid')::uuid, false);
select t.as_user(:'U8');
insert into t.ids select 'c_u8', public.add_comment(t.id('p1'), 'Con toi muon biet them');
select t.as_user(:'U4');
select t.ok((select count(*) from public.notifications where kind = 'system' and link = '/bang-tin#bai-' || t.id('p1')::text) = 1, 'tuy chon tat: khong nhan thong bao binh luan');
select public.set_post_notifications(current_setting('t.fid')::uuid, true);
select t.as_user(:'U3');
insert into t.ids select 'c_u3', public.add_comment(t.id('p1'), 'Quan tri nhanh xin chao');
select t.as_user(:'U4');
select t.ok((select count(*) from public.notifications where kind = 'system' and link = '/bang-tin#bai-' || t.id('p1')::text) = 2, 'bat lai tuy chon: nhan thong bao');
select t.as_user(:'U8');
select t.ok(t.cnt($$select 1 from public.notifications where kind = 'system'$$) = 0, 'nguoi khac khong thay thong bao cua tac gia');
-- Quyen binh luan
select t.as_user(:'U5');
select t.fails($$select public.add_comment(t.id('p1'), 'khach binh luan')$$, 'guest khong binh luan');
select t.as_user(:'U6');
select t.fails($$select public.add_comment(t.id('p1'), 'nguoi ngoai binh luan')$$, 'nguoi ngoai khong binh luan');
select t.as_user(:'U7');
select t.fails($$select public.add_comment(t.id('p1'), 'thu hoi binh luan')$$, 'tai khoan thu hoi khong binh luan');
select t.as_user(:'U8');
select t.fails($$select public.add_comment(t.id('p8'), 'binh luan vao bai nhanh A')$$, 'member nhanh B khong binh luan vao bai pham vi nhanh A (khong thay bai)');
select t.fails($$select public.add_comment(t.id('p1'), '')$$, 'binh luan rong bi tu choi');
select t.fails($$select public.add_comment(t.id('p1'), repeat('b', 2001))$$, 'binh luan > 2000 ky tu bi tu choi');
select t.ok(public.add_comment(t.id('p1'), repeat('b', 2000)) is not null, 'binh luan dung 2000 ky tu duoc chap nhan');
select t.fails($$select public.add_comment(t.id('p_tmp'), 'binh luan vao bai da xoa')$$, 'khong binh luan vao bai da xoa');
-- Doc binh luan
select t.as_user(:'U5');
select t.ok((select count(*) from public.post_comments(t.id('p1'))) = 5, 'guest doc duoc binh luan (5)');
select t.ok((select comment_count from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')) = 5, 'feed: dem binh luan');
select t.ok(not (select can_delete from public.post_comments(t.id('p1')) where id = t.id('c1')), 'guest khong xoa duoc binh luan');
select t.fails($$select * from public.post_comments(t.id('p8'))$$, 'guest khong doc binh luan cua bai nhanh A');
select t.as_user(:'U6');
select t.fails($$select * from public.post_comments(t.id('p1'))$$, 'nguoi ngoai khong doc binh luan');
select t.ok(t.cnt('select 1 from public.comments') = 0, 'nguoi ngoai: bang comments rong');
select t.as_user(:'U8');
select t.ok(t.cnt('select 1 from public.comments') = 5, 'member doc bang comments (RLS theo bai duoc xem)');
-- Sua / xoa binh luan
select t.fails($$select public.update_comment(t.id('c1'), 'sua trom')$$, 'member khac khong sua binh luan nguoi khac');
select t.fails($$select public.delete_comment(t.id('c1'))$$, 'member khac khong xoa binh luan nguoi khac');
select t.as_user(:'U2');
select public.update_comment(t.id('c1'), 'Chuc mung nhe! (sua)');
select t.ok((select body from public.post_comments(t.id('p1')) where id = t.id('c1')) = 'Chuc mung nhe! (sua)', 'tac gia binh luan sua duoc');
select t.as_user(:'U4');   -- chu bai xoa binh luan duoi bai cua minh
select public.delete_comment(t.id('c1'));
select t.ok(not exists (select 1 from public.post_comments(t.id('p1')) where id = t.id('c1')), 'chu bai xoa duoc binh luan duoi bai cua minh');
select t.as_user(:'U3');   -- branch_admin xoa binh luan cua U8 trong bai thuoc nhanh A
select public.delete_comment(t.id('c_u8'));
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'comment.delete_moderation') = 2, 'nhat ky: xoa binh luan boi chu bai / quan tri (2)');
select t.as_user(:'U8');
select public.delete_comment((select id from public.comments where author_id = :'U8' and char_length(body) = 2000));
select t.ok((select count(*) from public.post_comments(t.id('p1'))) = 2, 'tac gia tu xoa binh luan; con 2 binh luan');

-- ===== 15. Cam xuc =====
select t.as_user(:'U4');
select public.set_reaction('post', t.id('p3'), 'heart');
select public.set_reaction('post', t.id('p3'), 'like');
select t.ok((select count(*) from public.reactions where post_id = t.id('p3') and user_id = :'U4') = 1, 'doi cam xuc khong tao dong thu hai (moi nguoi 1 cam xuc/bai)');
select t.ok((select kind from public.reactions where post_id = t.id('p3') and user_id = :'U4') = 'like', 'doi cam xuc: giu loai moi');
select t.ok((select my_reaction from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p3')) = 'like', 'feed: my_reaction');
select t.as_user(:'U8');
select public.set_reaction('post', t.id('p3'), 'heart');
select t.ok((select reactions from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p3')) = '{"like": 1, "heart": 1}'::jsonb, 'feed: dem cam xuc theo loai');
select public.set_reaction('post', t.id('p3'), null);
select t.ok((select reactions from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p3')) = '{"like": 1}'::jsonb, 'bo cam xuc (null)');
select t.fails($$select public.set_reaction('post', t.id('p3'), 'ghet')$$, 'loai cam xuc khong hop le bi tu choi');
select t.fails($$select public.set_reaction('khac', t.id('p3'), 'like')$$, 'loai doi tuong khong hop le bi tu choi');
select t.fails($$select public.set_reaction('post', t.id('p8'), 'like')$$, 'khong tha cam xuc vao bai khong xem duoc');
select public.set_reaction('comment', t.id('c_own'), 'pray');
select t.ok((select reactions from public.post_comments(t.id('p1')) where id = t.id('c_own')) = '{"pray": 1}'::jsonb, 'cam xuc cho binh luan');
select t.fails($$select public.set_reaction('comment', t.id('c1'), 'like')$$, 'khong tha cam xuc vao binh luan da xoa');
select t.fails($$insert into public.reactions (family_id, post_id, user_id, kind) values (current_setting('t.fid')::uuid, t.id('p3'), '00000000-0000-0000-0000-000000000008', 'like')$$, 'khong ghi truc tiep reactions');
select t.as_root();
select t.fails($$insert into public.reactions (family_id, post_id, user_id, kind) values (current_setting('t.fid')::uuid, t.id('p3'), '00000000-0000-0000-0000-000000000004', 'wow')$$, 'rang buoc duy nhat: khong chen dong cam xuc thu hai cua cung nguoi');
select t.as_user(:'U5');
select t.fails($$select public.set_reaction('post', t.id('p3'), 'like')$$, 'guest khong tha cam xuc');
select t.as_user(:'U6');
select t.fails($$select public.set_reaction('post', t.id('p3'), 'like')$$, 'nguoi ngoai khong tha cam xuc');
select t.ok(t.cnt('select 1 from public.reactions') = 0, 'nguoi ngoai khong doc reactions');

-- ===== 16. Bao cao + kiem duyet =====
select t.as_user(:'U8');
insert into t.ids select 'r1', public.report_content(t.id('p1'), null, 'Noi dung gay kho chiu');
select t.fails($$select public.report_content(t.id('p1'), null, 'bao cao lan hai')$$, 'khong bao cao trung (khi con dang mo)');
select t.fails($$select public.report_content(t.id('p1'), null, '')$$, 'ly do rong bi tu choi');
select t.fails($$select public.report_content(t.id('p1'), null, repeat('x', 501))$$, 'ly do > 500 ky tu bi tu choi');
select t.fails($$select public.report_content(t.id('p8'), null, 'bai khong xem duoc')$$, 'khong bao cao bai khong xem duoc');
select t.fails($$select public.report_content(t.id('p1'), gen_random_uuid(), 'binh luan khong ton tai')$$, 'bao cao binh luan khong ton tai bi tu choi');
insert into t.ids select 'r_c', public.report_content(t.id('p1'), t.id('c_own'), 'Binh luan khong hay');
select t.as_user(:'U5');
insert into t.ids select 'r2', public.report_content(t.id('p1'), null, 'Khach cung bao cao duoc');
select t.as_user(:'U4');
insert into t.ids select 'r_b', public.report_content(t.id('p6'), null, 'Bao cao bai nhanh B');
select t.as_user(:'U6');
select t.fails($$select public.report_content(t.id('p1'), null, 'nguoi ngoai')$$, 'nguoi ngoai khong bao cao');
-- Thong bao cho quan tri
select t.as_user(:'U3');
select t.ok((select count(*) from public.notifications where kind = 'system' and link = '/admin/kiem-duyet') = 3, 'branch_admin nhan thong bao bao cao trong nhanh minh (r1, r_c, r2)');
select t.as_user(:'U2');
select t.ok((select count(*) from public.notifications where kind = 'system' and link = '/admin/kiem-duyet') = 4, 'family_admin nhan thong bao moi bao cao (4)');
select t.as_user(:'U8');
select t.ok(t.cnt($$select 1 from public.notifications where link = '/admin/kiem-duyet'$$) = 0, 'member khong nhan thong bao kiem duyet');
-- Hang cho
select t.as_user(:'U3');
select t.ok((select count(*) from public.moderation_queue(current_setting('t.fid')::uuid)) = 3, 'branch_admin thay 3 bao cao trong nhanh minh');
select t.ok(not exists (select 1 from public.moderation_queue(current_setting('t.fid')::uuid) where post_id = t.id('p6')), 'branch_admin khong thay bao cao bai nhanh B');
select t.as_user(:'U2');
select t.ok((select count(*) from public.moderation_queue(current_setting('t.fid')::uuid)) = 4, 'family_admin thay 4 bao cao');
select t.as_user(:'U4');
select t.ok((select count(*) from public.moderation_queue(current_setting('t.fid')::uuid)) = 0, 'member: hang cho rong (khong du quyen)');
select t.ok(t.cnt('select 1 from public.post_reports') = 1, 'tac gia/bao cao: chi thay bao cao do minh gui (r_b), khong thay bao cao ve bai cua minh');
select t.as_user(:'U8');
select t.ok(t.cnt('select 1 from public.post_reports') = 2, 'nguoi bao cao thay bao cao cua minh (2)');
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.post_reports') = 1, 'guest chi thay bao cao cua minh');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.post_reports') = 4, 'family_admin thay moi bao cao (RLS)');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.post_reports') = 3, 'branch_admin thay bao cao trong nhanh minh (RLS)');
-- Xu ly
select t.as_user(:'U8');
select t.fails($$select public.resolve_post_report(t.id('r1'), 'hide')$$, 'member khong xu ly bao cao');
select t.as_user(:'U3');
select t.fails($$select public.resolve_post_report(t.id('r_b'), 'dismiss')$$, 'branch_admin khong xu ly bao cao nhanh B');
select t.fails($$select public.resolve_post_report(t.id('r1'), 'xoa-sach')$$, 'hanh dong khong hop le bi tu choi');
select public.resolve_post_report(t.id('r_c'), 'hide', 'Binh luan vi pham');
select t.as_user(:'U8');
select t.ok(not exists (select 1 from public.post_comments(t.id('p1')) where id = t.id('c_own')), 'xu ly bao cao binh luan: binh luan bi xoa');
select t.as_user(:'U3');
select public.resolve_post_report(t.id('r1'), 'hide', 'Da an bai');
select t.as_user(:'U5');
select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid) where id = t.id('p1')), 'xu ly bao cao: bai bi an');
select t.as_user(:'U3');
select t.fails($$select public.resolve_post_report(t.id('r1'), 'dismiss')$$, 'bao cao da xu ly khong xu ly lai');
select t.as_user(:'U2');
select public.resolve_post_report(t.id('r_b'), 'dismiss', 'Khong vi pham');
select public.resolve_post_report(t.id('r2'), 'delete');
select t.ok((select status from public.post_reports where id = t.id('r_b')) = 'dismissed', 'bao cao bo qua: trang thai dismissed');
select t.ok((select status from public.post_reports where id = t.id('r2')) = 'resolved', 'bao cao da xu ly: trang thai resolved');
select t.ok(not exists (select 1 from public.feed_page(current_setting('t.fid')::uuid, null, null, 50) where id = t.id('p1')), 'delete: bai bi xoa');
select t.ok((select count(*) from public.moderation_queue(current_setting('t.fid')::uuid)) = 0, 'hang cho trong sau khi xu ly het');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action like 'report.%') = 4, 'nhat ky: xu ly bao cao duoc ghi (4)');
select t.ok((select count(*) from public.post_reports where status = 'open') = 0, 'khong con bao cao mo');

-- ===== 17. Ghi truc tiep / ham noi bo =====
select t.as_user(:'U2');
select t.fails($$insert into public.posts (family_id, author_id, body) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000002', 'truc tiep')$$, 'khong ghi truc tiep posts');
select t.fails($$update public.posts set pinned = true$$, 'khong update truc tiep posts');
select t.fails($$delete from public.posts$$, 'khong delete truc tiep posts');
select t.fails($$insert into public.comments (family_id, post_id, author_id, body) values (current_setting('t.fid')::uuid, t.id('p3'), '00000000-0000-0000-0000-000000000002', 'x')$$, 'khong ghi truc tiep comments');
select t.fails($$update public.comments set body = 'x'$$, 'khong update truc tiep comments');
select t.fails($$insert into public.post_reports (family_id, post_id, reporter, reason) values (current_setting('t.fid')::uuid, t.id('p3'), '00000000-0000-0000-0000-000000000002', 'x')$$, 'khong ghi truc tiep post_reports');
select t.fails($$update public.post_reports set status = 'resolved'$$, 'khong update truc tiep post_reports');
select t.fails($$insert into public.post_media (post_id, media_id) values (t.id('p3'), (select id from t.media where k = 'cover2'))$$, 'khong ghi truc tiep post_media');
select t.fails($$select public._can_interact(current_setting('t.fid')::uuid)$$, 'ham noi bo _can_interact khong goi duoc');
select t.fails($$insert into public.post_notification_prefs (user_id, family_id, comments) values ('00000000-0000-0000-0000-000000000002', current_setting('t.fid')::uuid, false)$$, 'khong ghi truc tiep post_notification_prefs');
select t.fails($$select public.set_post_notifications(current_setting('t.fid2')::uuid, false)$$, 'khong dat tuy chon thong bao cho gia dinh khac');

-- ===== 18. Cheo gia dinh =====
select t.as_user(:'U6');
insert into t.ids select 'f2p', public.create_post(current_setting('t.fid2')::uuid, 'Bai gia dinh 2', 'family');
select t.upload('f2_pm', 'post', null, p_family => current_setting('t.fid2')::uuid);
select t.ok(t.rd('f2_pm'), 'gia dinh 2: tac gia doc anh bai viet cua minh');
select t.as_user(:'U2');
select t.fails($$select * from public.feed_page(current_setting('t.fid2')::uuid)$$, 'family_admin gia dinh 1 khong doc feed gia dinh 2');
select t.ok(t.cnt($$select 1 from public.posts where family_id = current_setting('t.fid2')::uuid$$) = 0, 'khong thay bai gia dinh 2 qua bang posts');
select t.ok(not t.rd('f2_pm'), 'khong doc anh bai viet gia dinh 2');
select t.fails($$select public.add_comment(t.id('f2p'), 'sang gia dinh khac')$$, 'khong binh luan bai gia dinh khac');
select t.fails($$select public.create_post(current_setting('t.fid2')::uuid, 'x', 'family')$$, 'khong dang bai vao gia dinh khac');
select t.fails($$select public.report_content(t.id('f2p'), null, 'x')$$, 'khong bao cao bai gia dinh khac');
select t.as_user(:'U6');
select t.fails($$select public.create_post(current_setting('t.fid2')::uuid, 'lay anh gia dinh 1', 'family', null, array[(select id from t.media where k = 'pm_u8')])$$, 'khong gan anh cua gia dinh 1 vao bai gia dinh 2');

-- ===== 19. Chong ngap =====
select t.as_user(:'U1');
do $$
declare i int; n int := 0;
begin
  for i in 1..25 loop
    begin
      perform public.create_post(current_setting('t.fid')::uuid, 'Bai so ' || i, 'family');
      n := n + 1;
    exception when sqlstate 'P0001' then exit;
    end;
  end loop;
  perform t.ok(n = 20, 'chong ngap: toi da 20 bai/gio/nguoi (dang duoc ' || n || ')');
end $$;

-- ===== 20. Thu hoi co hieu luc ngay =====
select t.as_user(:'U8');
select t.ok(t.rd('pm_u8') and t.rd('dad_a1') and exists (select 1 from public.feed_page(current_setting('t.fid')::uuid)), 'truoc khi thu hoi: U8 doc duoc anh bai viet, anh album va feed');
select t.as_user(:'U1');
select public.revoke_membership((select id from public.family_memberships where user_id = :'U8'));
select t.as_user(:'U8');
select t.ok(not t.rd('pm_u8'), 'sau thu hoi: khong doc duoc ca anh do chinh minh tai len');
select t.ok(not t.rd('dad_a1'), 'sau thu hoi: khong doc anh album');
select t.fails($$select * from public.feed_page(current_setting('t.fid')::uuid)$$, 'sau thu hoi: feed_page bi tu choi');
select t.fails($$select public.add_comment(t.id('p3'), 'x')$$, 'sau thu hoi: khong binh luan');
select t.fails($$select public.set_reaction('post', t.id('p3'), 'like')$$, 'sau thu hoi: khong tha cam xuc');
select t.fails($$select public.begin_media_upload(current_setting('t.fid')::uuid, 'post', null, 'image/jpeg', 1000, 100, 10, 10)$$, 'sau thu hoi: khong tai len');
select t.ok(t.cnt('select 1 from public.albums_v') = 0 and t.cnt('select 1 from public.media_items') = 0 and t.cnt('select 1 from public.posts') = 0, 'sau thu hoi: khong thay album / media / bai viet');

-- ===== Tong ket =====
\o
select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
