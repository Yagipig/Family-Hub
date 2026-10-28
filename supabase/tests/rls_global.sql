-- Kiem tra toan cuc tren SCHEMA DA GOP TAT CA MODULE: bat ky bang/ham moi nao quen RLS/quyen se lam test nay that bai.
\set ON_ERROR_STOP on
select t.as_root();

select t.ok((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity) = 0,
  'moi bang trong public deu bat RLS');

select t.ok((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')
               and (has_any_column_privilege('anon', c.oid, 'select,insert,update,references')
                    or has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate'))) = 0,
  'anon khong co quyen nao tren bang/view/sequence trong public');

select t.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) = 0,
  'anon khong goi duoc ham nao trong public (ke ca qua PUBLIC)');

-- Chi cho phep ghi truc tiep (RLS van ap dung) tren: branches (CRUD nhanh), families/user_profiles (cot chon loc)
select t.ok((select coalesce(string_agg(c.relname, ',' order by c.relname), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r','p')
               and (has_any_column_privilege('authenticated', c.oid, 'insert,update') or has_table_privilege('authenticated', c.oid, 'delete,truncate')))
            = 'branches,families,user_profiles',
  'authenticated chi ghi truc tiep duoc branches/families/user_profiles; moi bang khac chi qua ham security definer');

select t.ok((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r','p') and has_table_privilege('authenticated', c.oid, 'truncate,references,trigger')) = 0,
  'authenticated khong co TRUNCATE/REFERENCES/TRIGGER tren bang nao');

select t.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.prosecdef
               and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')) = 0,
  'moi ham security definer deu dat search_path co dinh');

-- Ham khong phai security definer ma authenticated goi duoc: chi cho phep nhom ham thuan (khong doc bang)
select t.ok((select coalesce(string_agg(p.proname, ',' order by p.proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') and not p.prosecdef)
            = '_fair_word,fair_commit,fair_shuffle,loto_card_is_valid,lottery_compute_winners,member_is_minor',
  'ham khong-security-definer ma authenticated goi duoc chi la ham thuan da duyet');

-- Ham job/noi bo: authenticated khong duoc goi
select t.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('_notify','_member_insert','_member_update','_add_parent_link','_add_partnership','_user_has_permission',
                                 'generate_daily_notifications','deliver_due_cards','write_audit','peek_invitation','redeem_invitation','bootstrap_family')
               and has_function_privilege('authenticated', p.oid, 'execute')) = 0,
  'ham noi bo/job (notify, audit, cron, moi) khong goi duoc boi authenticated');

select t.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('generate_daily_notifications','deliver_due_cards','peek_invitation','redeem_invitation')
               and has_function_privilege('service_role', p.oid, 'execute')) = 4,
  'ham job danh cho service_role thi service_role goi duoc');

-- Nhat ky bat bien
select t.ok((select count(*) from pg_trigger where tgrelid = 'public.audit_logs'::regclass and not tgisinternal) >= 1, 'audit_logs co trigger chong sua/xoa');

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results \gset
\echo
\echo === KET QUA: :passed dat, :failed that bai ===
select case when :failed > 0 then 1/0 else 1 end as all_passed;
