alter table public.compositions
add column if not exists category smallint
check (category between 1 and 6);
