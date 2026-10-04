-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║   Snack Man Remastered - online scoreboard setup for Supabase        ║
-- ║   This file was written by Claude (Anthropic's AI).                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Paste all of this into Supabase's SQL Editor and press Run. It's safe to run again.
--
-- What it sets up:
--   * a table of scores, one row per name, holding that name's best score
--   * anyone can read the table (to show the top 10)
--   * nobody can change the table directly. Scores only go in through submit_snack_man_score(),
--     which checks the name and score, and only ever raises a name's score, never lowers it.

create table if not exists public.snack_man_scores (
    name_key text primary key,                -- the name in lowercase, so "Milo" and "MILO" are the same person
    name text not null,                       -- the name as shown on the board
    score integer not null,
    updated_at timestamptz not null default now(),

    constraint snack_man_name_shape check (name ~ '^[A-Z0-9 ]{1,10}$'),
    constraint snack_man_name_key_matches check (name_key = lower(name)),
    constraint snack_man_score_range check (score between 1 and 100000000)
);

-- Row level security: with it on, the only things anyone can do are what the policies below allow
alter table public.snack_man_scores enable row level security;

drop policy if exists "Anyone can read Snack Man scores" on public.snack_man_scores;
create policy "Anyone can read Snack Man scores"
    on public.snack_man_scores for select
    to anon, authenticated
    using (true);

grant select on public.snack_man_scores to anon, authenticated;
revoke insert, update, delete on public.snack_man_scores from anon, authenticated;

-- Saves a score for a name, keeping whichever is higher: the new score or the one already there.
-- Returns the name's row afterwards, and whether the new score was an improvement.
create or replace function public.submit_snack_man_score(player_name text, player_score integer)
returns table (name text, score integer, improved boolean)
language plpgsql
security definer          -- runs with the table owner's rights, so it can write even though players can't
set search_path = public
as $$
#variable_conflict use_column
declare
    clean_name text := upper(btrim(regexp_replace(coalesce(player_name, ''), '\s+', ' ', 'g')));
    previous_score integer;
begin
    if clean_name !~ '^[A-Z0-9 ]{1,10}$' then
        raise exception 'Names must be 1 to 10 letters, numbers or spaces';
    end if;
    if replace(clean_name, ' ', '') ~ '(FUCK|SHIT|CUNT|NIGG|FAG|BITCH|WHORE|SLUT|RAPE|DICK|COCK|PUSSY)' then
        raise exception 'That name is not allowed';
    end if;
    if player_score is null or player_score < 1 or player_score > 100000000 then
        raise exception 'Invalid score';
    end if;

    select s.score into previous_score
    from public.snack_man_scores s
    where s.name_key = lower(clean_name);

    insert into public.snack_man_scores as s (name_key, name, score, updated_at)
    values (lower(clean_name), clean_name, player_score, now())
    on conflict (name_key) do update
        set score = excluded.score, name = excluded.name, updated_at = excluded.updated_at
        where excluded.score > s.score;

    return query
        select s.name, s.score, (previous_score is null or player_score > previous_score)
        from public.snack_man_scores s
        where s.name_key = lower(clean_name);
end;
$$;

revoke all on function public.submit_snack_man_score(text, integer) from public;
grant execute on function public.submit_snack_man_score(text, integer) to anon, authenticated;
