-- Text the organization shows tipsters on their status page (and help text on the receipt).
-- tipster_note: what to expect (hours, reply times). help_text: crisis / victim-support resources.
-- Both are organization settings, not tipster data.
alter table organizations add column tipster_note text not null default '' check (char_length(tipster_note) <= 600);
alter table organizations add column help_text text not null default '' check (char_length(help_text) <= 1200);
