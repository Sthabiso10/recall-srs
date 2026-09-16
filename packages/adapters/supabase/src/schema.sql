-- Recall — Supabase / Postgres schema
--
-- Run once in the SQL editor before using @recall-srs/adapter-supabase.
-- Safe to re-run: everything is IF NOT EXISTS.
--
-- Three design decisions worth knowing:
--   1. Scheduling state is flattened into columns rather than stored as JSONB,
--      so "what is due right now" is an index scan instead of a JSON parse.
--   2. recall_reviews is append-only. No UPDATE or DELETE policy exists for it
--      on purpose — analytics are only as trustworthy as the history behind
--      them, and history you can edit is not history.
--   3. RLS is on from the first migration, not bolted on later.

-- ---------------------------------------------------------------- decks
create table if not exists public.recall_decks (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists recall_decks_user_idx
  on public.recall_decks (user_id);

-- ---------------------------------------------------------------- cards
create table if not exists public.recall_cards (
  id               text primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  deck_id          text references public.recall_decks (id) on delete set null,

  question         text not null,
  answer           text not null,
  category         text,
  difficulty       text check (difficulty in ('easy', 'medium', 'hard')),
  tags             text[] not null default '{}',

  -- SM-2 scheduling state
  repetitions      integer not null default 0,
  ease_factor      real    not null default 2.5,
  interval_days    real    not null default 0,
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  lapses           integer not null default 0,
  status           text not null default 'new'
                   check (status in ('new', 'learning', 'review', 'relearning', 'suspended')),

  metadata         jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- The hot path: "cards due for this user, in this deck, soonest first."
create index if not exists recall_cards_due_idx
  on public.recall_cards (user_id, deck_id, due_at)
  where status <> 'suspended';

-- GIN index so tag filters stay fast as decks grow.
create index if not exists recall_cards_tags_idx
  on public.recall_cards using gin (tags);

-- -------------------------------------------------------------- reviews
create table if not exists public.recall_reviews (
  id             text primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  card_id        text not null references public.recall_cards (id) on delete cascade,
  session_id     text,

  quality        smallint not null check (quality between 0 and 5),
  reviewed_at    timestamptz not null default now(),
  duration_ms    integer not null default 0,
  lapsed         boolean not null,

  -- Snapshots either side of the review, so the curve can be rebuilt from the
  -- log alone without replaying the whole algorithm.
  prev_repetitions integer not null,
  prev_ease_factor real    not null,
  prev_interval    real    not null,
  prev_status      text    not null,
  next_repetitions integer not null,
  next_ease_factor real    not null,
  next_interval    real    not null,
  next_status      text    not null
);

create index if not exists recall_reviews_user_time_idx
  on public.recall_reviews (user_id, reviewed_at desc);

create index if not exists recall_reviews_card_idx
  on public.recall_reviews (card_id, reviewed_at desc);

-- ------------------------------------------------------------------ RLS
alter table public.recall_decks   enable row level security;
alter table public.recall_cards   enable row level security;
alter table public.recall_reviews enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'recall_decks_owner') then
    create policy recall_decks_owner on public.recall_decks
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'recall_cards_owner') then
    create policy recall_cards_owner on public.recall_cards
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- Reviews: read and insert only. No update, no delete, by design.
  if not exists (select 1 from pg_policies where policyname = 'recall_reviews_select') then
    create policy recall_reviews_select on public.recall_reviews
      for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'recall_reviews_insert') then
    create policy recall_reviews_insert on public.recall_reviews
      for insert with check (auth.uid() = user_id);
  end if;
end
$$;

-- ---------------------------------------------------------- updated_at
create or replace function public.recall_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recall_cards_touch on public.recall_cards;
create trigger recall_cards_touch
  before update on public.recall_cards
  for each row execute function public.recall_touch_updated_at();

drop trigger if exists recall_decks_touch on public.recall_decks;
create trigger recall_decks_touch
  before update on public.recall_decks
  for each row execute function public.recall_touch_updated_at();
