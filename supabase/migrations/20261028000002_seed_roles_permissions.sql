-- Dot 1 / migration 2: vai tro va ma tran quyen mac dinh (module x hanh dong)

insert into public.roles (key, name_vi, rank, scope_limited) values
  ('super_admin',  'Super Admin',            1, false),
  ('family_admin', 'Quản trị gia đình',      2, false),
  ('branch_admin', 'Quản trị nhánh',         3, true),
  ('member',       'Thành viên',             4, false),
  ('guest',        'Khách / hạn chế',        5, false);

-- Cac module cua MVP (module cua giai doan sau them bang migration rieng)
insert into public.permissions (module, action)
select m, a
from unnest(array['family','roles','invitations','members','tree','events','cards','gifts','chat','audit','backup','data_requests','editing']) as m,
     unnest(array['view','create','update','delete','approve','export']) as a;

-- family_admin: tat ca quyen
insert into public.role_permissions (role_key, module, action)
select 'family_admin', module, action from public.permissions;

-- branch_admin: quan ly trong nhanh duoc giao (hieu luc theo pham vi nhanh)
insert into public.role_permissions (role_key, module, action)
select 'branch_admin', module, action from public.permissions
where (module in ('members','tree','events','chat') and action in ('view','create','update','approve'))
   or (module = 'invitations' and action in ('view','create','delete'))
   or (module = 'editing' and action in ('view','update'))
   or (module in ('cards','gifts') and action in ('view','create'))
   or (module = 'family' and action = 'view');

-- member
insert into public.role_permissions (role_key, module, action)
select 'member', module, action from public.permissions
where (module in ('members','tree','events') and action = 'view')
   or (module in ('cards','gifts','chat') and action in ('view','create'))
   or (module = 'family' and action = 'view')
   or (module = 'editing' and action = 'view');

-- guest: chi xem noi dung duoc phep
insert into public.role_permissions (role_key, module, action)
select 'guest', module, action from public.permissions
where (module in ('members','tree','events') and action = 'view')
   or (module = 'family' and action = 'view');
