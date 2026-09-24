-- Natural-language logging (nl-logging.md): remember how an entry was made and what was typed/said.
-- Additive and nullable: existing rows and older app versions keep working unchanged.

alter table public.food_logs
  add column if not exists source text check (source in ('manual', 'text', 'voice')),
  add column if not exists raw_input text check (char_length(raw_input) <= 500);

comment on column public.food_logs.source is 'manual = picked in search; text/voice = confirmed from a parsed sentence';
comment on column public.food_logs.raw_input is 'the sentence the entry came from (text/voice only)';
