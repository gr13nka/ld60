"""Add a song to the game's playlist, at the loudness every song shares.

Run: python3 scripts/music/add-song.py ~/Downloads/Song.wav [name]
Writes src/sounds/songs/<name>.mp3 (the file's own name, lower-cased, by default); the game
plays whatever is in that folder, so nothing else needs to change. Requires ffmpeg.

Every song is brought to the same integrated loudness here, so one never jumps out over
another; how loud the music sits under the world's sounds is `MUSIC_LEVEL` in soundtrack.js.
"""

from pathlib import Path
import json
import re
import subprocess
import sys

LOUDNESS = -16  # LUFS, integrated
PEAK = -1.5  # dBTP

source = Path(sys.argv[1]).expanduser()
name = sys.argv[2] if len(sys.argv) > 2 else re.sub(r'[^a-z0-9]+', '-', source.stem.lower()).strip('-')
destination = Path(__file__).resolve().parents[2] / 'src/sounds/songs' / f'{name}.mp3'
target = f'I={LOUDNESS}:TP={PEAK}:LRA=20'

# Two passes: measure, then apply one fixed gain so the song keeps its own dynamics.
measured = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(source),
                           '-af', f'loudnorm={target}:print_format=json', '-f', 'null', '-'],
                          check=True, capture_output=True, text=True).stderr
m = json.loads(measured[measured.rindex('{'):measured.rindex('}') + 1])
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                '-af', f"loudnorm={target}:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
                       f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
                       f":offset={m['target_offset']}",
                '-ar', '44100', '-codec:a', 'libmp3lame', '-q:a', '4', str(destination)], check=True)

print(f'Wrote {destination} (was {m["input_i"]} LUFS)')
