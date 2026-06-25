create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  erstellt_am timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Eigene Subscriptions lesen" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "Eigene Subscription anlegen" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "Eigene Subscription loeschen" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- Service-Role darf alle lesen (für Push-Versand)
create policy "Service kann alle lesen" on push_subscriptions
  for select using (true);
