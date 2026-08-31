alter table public.compositions
drop constraint if exists compositions_category_check;

alter table public.compositions
add constraint compositions_category_check check (category between 1 and 6);

update public.compositions
set category = 6,
    updated_at = now()
where title ~ '〔[A-Za-z]+-?[0-9]+〕';
