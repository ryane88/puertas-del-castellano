begin;

grant select on table public.pdm_words to anon;

alter policy pdm_read_published_words on public.pdm_words
    to anon, authenticated
    using (published);

commit;
