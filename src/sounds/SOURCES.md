# Quitters audio

`songs/` holds the game's music; every mp3 there is played, shuffled, with fades and a short
silence between songs (`soundtrack.js`). Add one with `python3 scripts/music/add-song.py <file>`,
which brings it to -16 LUFS. `songs/zavod.mp3` is **Zavod** (2:36), the owner's track made with
Suno Studio (2026-10-19), from `Zavod-ebat-release.wav`. `songs/begu-na-smenu.mp3` is **Begu na smenu**
(2:39), also the owner's, made with Suno Studio (2026-10-19), from `begu na smenu.mp3`.

The five numbered WAV files in `music/` are gear accents made for the earlier generated loop;
the game does not cue them.

`chirr.mp3` is **Small Mammals - Kinkajou; Baby Chirping** by TheKingOfGeeks360
(https://freesound.org/people/TheKingOfGeeks360/sounds/852086/), **Creative Commons 0** as its page
states, fetched 2026-10-16 as the public `-hq.mp3` preview (2.5 s). A kinkajou is of the raccoon's
family; it was taken over the CC0 raccoon recordings found (screams, growls, hisses and a gecker by
TRP and h_sylvan), which were too fierce for someone asking politely. Cut at 0.30 s for 1.25 s, which
holds four or five short chirps by its loudness, high-pass 40 Hz, 5 ms fade in, 100 ms fade out, peak
to −3 dBFS, mono, 44.1 kHz, `-q:a 4`. Played when the raccoon asks for a light and thanks for it
(`raccoon.js`). Chosen by its loudness, not heard by anyone.
