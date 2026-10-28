-- Kiem thu yeu cau du lieu ca nhan (Dot 6)
\set ON_ERROR_STOP on
\ir rls_fixture.sql
\set U1 '00000000-0000-0000-0000-000000000001'
\set U2 '00000000-0000-0000-0000-000000000002'
\set U3 '00000000-0000-0000-0000-000000000003'
\set U4 '00000000-0000-0000-0000-000000000004'
\set U5 '00000000-0000-0000-0000-000000000005'
\set U6 '00000000-0000-0000-0000-000000000006'
\set U7 '00000000-0000-0000-0000-000000000007'
create table t.ids(k text primary key, v uuid);
grant select, insert on t.ids to public;
create function t.id(k text) returns uuid language sql stable as $$ select v from t.ids where t.ids.k = $1 $$;
grant execute on function t.id(text) to public;
create function t.cnt(sql text) returns bigint language plpgsql as $$ declare n bigint; begin execute 'select count(*) from (' || sql || ') q' into n; return n; end $$;
grant execute on function t.cnt(text) to public;

-- Gui yeu cau
select t.as_user(:'U4');
insert into t.ids select 'r1', public.submit_data_request(current_setting('t.fid')::uuid, 'export', 'Cho toi ban sao du lieu');
insert into t.ids select 'r2', public.submit_data_request(current_setting('t.fid')::uuid, 'delete', 'Xoa ho so cua toi');
select t.ok(t.cnt('select 1 from public.data_requests') = 2, 'member thay yeu cau cua minh');
select t.fails($$select public.submit_data_request(current_setting('t.fid')::uuid, 'hack', null)$$, 'loai yeu cau khong hop le bi tu choi');
select t.fails($$insert into public.data_requests (family_id, user_id, kind) values (current_setting('t.fid')::uuid, '00000000-0000-0000-0000-000000000004', 'export')$$, 'khong ghi truc tiep bang yeu cau');
select t.fails($$update public.data_requests set status = 'done'$$, 'khong tu danh dau yeu cau da xong');
select public.submit_data_request(current_setting('t.fid')::uuid, 'correct', null);
select public.submit_data_request(current_setting('t.fid')::uuid, 'correct', null);
select public.submit_data_request(current_setting('t.fid')::uuid, 'correct', null);
select t.fails($$select public.submit_data_request(current_setting('t.fid')::uuid, 'correct', null)$$, 'gioi han so yeu cau dang mo (5)');

-- Nguoi khac
select t.as_user(:'U5');
select t.ok(t.cnt('select 1 from public.data_requests') = 0, 'khach khong thay yeu cau cua nguoi khac');
insert into t.ids select 'rg', public.submit_data_request(current_setting('t.fid')::uuid, 'export');
select t.ok(t.cnt('select 1 from public.data_requests') = 1, 'khach gui duoc yeu cau cho du lieu cua chinh minh');
select t.as_user(:'U3');
select t.ok(t.cnt('select 1 from public.data_requests') = 0, 'branch_admin khong thay yeu cau du lieu ca nhan');
select t.fails($$select public.handle_data_request(t.id('r1'), 'done')$$, 'branch_admin khong xu ly duoc');
select t.as_user(:'U6');
select t.ok(t.cnt('select 1 from public.data_requests') = 0, 'nguoi ngoai khong thay gi');
select t.fails($$select public.submit_data_request(current_setting('t.fid')::uuid, 'export')$$, 'nguoi ngoai khong gui duoc');
select t.as_user(:'U7');
select t.fails($$select public.submit_data_request(current_setting('t.fid')::uuid, 'export')$$, 'tai khoan thu hoi khong gui duoc');
select t.as_anon();
select t.fails($$select * from public.data_requests$$, 'anon khong doc duoc');

-- Xu ly
select t.as_user(:'U4');
select t.fails($$select public.handle_data_request(t.id('r1'), 'done')$$, 'member khong xu ly duoc yeu cau cua chinh minh');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.data_requests') = 6, 'family_admin thay moi yeu cau');
select t.ok(t.cnt('select 1 from public.notifications where link = ''/admin/yeu-cau-du-lieu''') = 6, 'quan tri nhan thong bao khi co yeu cau');
select t.fails($$select public.handle_data_request(t.id('r1'), 'cancelled')$$, 'trang thai khong hop le bi tu choi');
select public.handle_data_request(t.id('r1'), 'in_progress', 'Dang chuan bi');
select public.handle_data_request(t.id('r1'), 'done', 'Da gui qua kenh rieng');
select t.fails($$select public.handle_data_request(t.id('r1'), 'done')$$, 'khong xu ly lai yeu cau da xong');
select public.handle_data_request(t.id('r2'), 'rejected', 'Can gap truc tiep de xac minh');
select t.as_user(:'U4');
select t.ok((select status from public.data_requests where id = t.id('r1')) = 'done', 'nguoi gui thay trang thai moi');
select t.ok(t.cnt('select 1 from public.notifications where dedupe_key like ''drs:%''') = 3, 'nguoi gui nhan thong bao khi doi trang thai (3 lan)');
select t.fails($$select public.cancel_data_request(t.id('r1'))$$, 'khong huy yeu cau da xu ly');
select public.cancel_data_request((select id from public.data_requests where status = 'pending' limit 1));
select t.ok(t.cnt('select 1 from public.data_requests where status = ''cancelled''') = 1, 'huy yeu cau dang cho');
select t.as_user(:'U5');
select t.fails($$select public.cancel_data_request(t.id('r1'))$$, 'khong huy yeu cau cua nguoi khac');

-- Nhat ky
select t.as_user(:'U4');
select public.log_my_data_export(current_setting('t.fid')::uuid);
select t.as_user(:'U6');
select t.fails($$select public.log_my_data_export(current_setting('t.fid')::uuid)$$, 'nguoi ngoai khong ghi nhat ky xuat');
select t.as_root();
select t.ok((select count(*) from public.audit_logs where action = 'personal_data.export') = 1, 'nhat ky: tu tai du lieu ca nhan');
select t.ok((select count(*) from public.audit_logs where action like 'data_request.%') >= 9, 'nhat ky: cac buoc yeu cau du lieu');
select t.as_user(:'U2');
select t.ok(t.cnt('select 1 from public.audit_logs where action = ''personal_data.export''') = 1, 'family_admin xem duoc nhat ky');
select t.as_user(:'U4');
select t.ok(t.cnt('select 1 from public.audit_logs') = 0, 'member khong xem duoc nhat ky');

select t.as_root();
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
