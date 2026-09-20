begin;

alter table public.compositions drop constraint if exists compositions_category_check;
alter table public.compositions add constraint compositions_category_check
  check (category between 1 and 7);

commit;
