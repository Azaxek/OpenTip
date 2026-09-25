-- Optional location scoping for teams. A team with NO rows here receives its categories' tips from every location;
-- a team with rows only receives tips submitted for those locations (e.g. one school's counseling team in a district).
create table team_locations (
  org_id uuid not null references organizations on delete cascade,
  team_id uuid not null references teams on delete cascade,
  location_id uuid not null references locations on delete cascade,
  primary key (team_id, location_id)
);

alter table team_locations enable row level security;
create policy tenant on team_locations using (org_id = app_org()) with check (org_id = app_org());
grant select, insert, update, delete on team_locations to opentip_app;
