-- Module C (Thiep & Li xi) / migration 1: thu vien mau thiep.
-- Hinh minh hoa la SVG/CSS tu ve trong ung dung (src/lib/card-templates.ts); bang nay giu khoa mau, dip, hieu ung
-- va bang mau. Test vitest (card-templates.test.ts) doi chieu hai ben de khong lech nhau.

create table public.card_templates (
  key text primary key check (key ~ '^[a-z0-9-]{3,40}$'),
  name_vi text not null check (char_length(name_vi) between 1 and 80),
  occasion text not null check (occasion in ('tet','sinh-nhat','gio','cuoi','ta-on','trung-thu','chuc-mung')),
  effect text not null check (effect in ('envelope','petals','confetti','lantern')),
  motif text not null check (motif ~ '^[a-z-]{3,30}$'),
  palette jsonb not null check (palette ?& array['bg','bg2','text','accent','particle']),
  sort_order smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Moi mau: key, ten, dip, hieu ung mo, hoa tiet, bang mau, thu tu. (Moi dong mot mau: test doi chieu doc tu day.)
insert into public.card_templates (key, name_vi, occasion, effect, motif, palette, sort_order) values
('tet-hoa-mai', 'Hoa mai đầu xuân', 'tet', 'petals', 'mai', '{"bg":"#7b1e2b","bg2":"#5c1520","text":"#fff6e0","accent":"#f2c14e","particle":"#f6d365"}'::jsonb, 10),
('tet-phong-bao', 'Phong bao đỏ', 'tet', 'envelope', 'redenvelope', '{"bg":"#a4161a","bg2":"#7b1e2b","text":"#fff6e0","accent":"#e7c27d","particle":"#e7c27d"}'::jsonb, 20),
('tet-den-long', 'Đèn lồng xuân', 'tet', 'lantern', 'lantern', '{"bg":"#5c1520","bg2":"#2a1a1a","text":"#fbf0d9","accent":"#c9a96b","particle":"#e8b04a"}'::jsonb, 30),
('sinh-nhat-bong-bay', 'Bóng bay sinh nhật', 'sinh-nhat', 'confetti', 'balloons', '{"bg":"#fff3d6","bg2":"#f1e6cc","text":"#5c1520","accent":"#7b1e2b","particle":"#c9a96b"}'::jsonb, 40),
('sinh-nhat-banh-kem', 'Bánh kem ấm áp', 'sinh-nhat', 'envelope', 'cake', '{"bg":"#fbf6ec","bg2":"#f1e6cc","text":"#5c1520","accent":"#7b1e2b","particle":"#c9a96b"}'::jsonb, 50),
('gio-nen-tam-huong', 'Nén tâm hương', 'gio', 'lantern', 'candle', '{"bg":"#3a2a2a","bg2":"#2a1a1a","text":"#f1e6cc","accent":"#c9a96b","particle":"#f4d58d"}'::jsonb, 60),
('cuoi-hoa-hong', 'Hoa hồng đỏ rượu', 'cuoi', 'petals', 'rose', '{"bg":"#fffdf8","bg2":"#f1e6cc","text":"#5c1520","accent":"#7b1e2b","particle":"#a4313f"}'::jsonb, 70),
('cuoi-nhan-doi', 'Nhẫn đôi trăm năm', 'cuoi', 'confetti', 'rings', '{"bg":"#fbf6ec","bg2":"#ead9b0","text":"#5c1520","accent":"#b08d4a","particle":"#c9a96b"}'::jsonb, 80),
('ta-on-hoa-sen', 'Tạ ơn hoa sen', 'ta-on', 'petals', 'lotus', '{"bg":"#fbf6ec","bg2":"#ecdcbc","text":"#5c1520","accent":"#7b1e2b","particle":"#d9a5a5"}'::jsonb, 90),
('trung-thu-den-sao', 'Rằm trung thu', 'trung-thu', 'lantern', 'starlantern', '{"bg":"#2a1a1a","bg2":"#5c1520","text":"#fbf0d9","accent":"#e8b04a","particle":"#f4d58d"}'::jsonb, 100),
('chuc-mung-rang-ro', 'Chúc mừng rạng rỡ', 'chuc-mung', 'confetti', 'burst', '{"bg":"#7b1e2b","bg2":"#a4313f","text":"#fff6e0","accent":"#f1e6cc","particle":"#e7c27d"}'::jsonb, 110);

alter table public.card_templates enable row level security;
create policy card_templates_select on public.card_templates for select to authenticated using (active);
revoke all on public.card_templates from anon, authenticated;
grant select on public.card_templates to authenticated;
