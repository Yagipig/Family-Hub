-- Ham tro giup dung chung cho moi file rls_*.sql
\set ON_ERROR_STOP on
create schema t;
grant usage on schema t to public;
create table t.results(name text, ok boolean);
create function t.as_user(u uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
  execute 'set role authenticated';
end $$;
create function t.as_anon() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub','',false); execute 'set role anon'; end $$;
create function t.as_service() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub','',false); execute 'set role service_role'; end $$;
create function t.as_root() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub','',false); end $$;
create function t.ok(cond boolean, name text) returns void language plpgsql as $$
begin
  insert into t.results values (name, coalesce(cond,false));
  if coalesce(cond,false) then raise notice 'PASS  %', name; else raise warning 'FAIL  %', name; end if;
end $$;
-- Mong doi cau lenh bi tu choi (loi bat ky)
create function t.fails(sql text, name text) returns void language plpgsql as $$
declare raised boolean := false; msg text;
begin
  begin execute sql; exception when others then raised := true; msg := sqlerrm; end;
  perform t.ok(raised, name || coalesce('  [' || msg || ']', ''));
end $$;
grant execute on all functions in schema t to public;
grant insert, select on t.results to public;

