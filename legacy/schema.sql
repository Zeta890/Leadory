begin;
create table public.campaigns (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null, niche text not null, city text not null, radius_km int not null check(radius_km between 1 and 50),
 max_companies int not null check(max_companies between 1 and 100), prioritize_no_website boolean not null default true,
 require_instagram boolean not null default false, require_business_phone boolean not null default true,
 created_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.leads (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 campaign_id uuid not null, name text not null, phone text, website text, instagram text, source_url text not null,
 website_status text not null default 'unknown' check(website_status in ('unknown','not_identified','identified')),
 stage text not null default 'qualified' check(stage in ('qualified','authorized','interested','meeting','proposal','won','lost')),
 score int not null default 0 check(score between 0 and 100), created_at timestamptz not null default now(),
 foreign key(campaign_id,owner_id) references public.campaigns(id,owner_id)
);
create unique index leads_phone_unique on public.leads(owner_id,campaign_id,phone) where phone is not null;
alter table public.campaigns enable row level security;
alter table public.leads enable row level security;
revoke all on public.campaigns,public.leads from anon;
grant select,insert,update,delete on public.campaigns,public.leads to authenticated;
create policy campaigns_owner on public.campaigns for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy leads_owner on public.leads for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
commit;
