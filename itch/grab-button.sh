#!/bin/sh
# grab-button.sh LOOK KIND FRAME OUTDIR — draws one page button with button-render.html in
# Orca's browser tab (real WebGL; the dev server on :5199) and saves it as OUTDIR/LOOK-KIND-FRAME.png.
cd ~/orca/projects/Gas
q="?look=$1&kind=$2&frame=$3"
orca goto --url "http://localhost:5199/itch/button-render.html$q" --json >/dev/null
for i in $(seq 1 20); do
  t=$(orca eval --expression "document.title + '|' + location.search" --json | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['result'])" 2>/dev/null)
  [ "$t" = "ready|$q" ] && break; sleep 0.5
done
[ "$t" = "ready|$q" ] || { echo "not ready: $1 $2 $3 ($t)"; orca eval --expression "document.body.innerText.slice(0,300)" --json | grep '"result": "'; exit 1; }
orca eval --expression "window.png" --json | python3 -c "import json,sys,base64;d=json.load(sys.stdin)['result']['result'];open('$4/$1-$2-$3.png','wb').write(base64.b64decode(d.split(',')[1]))"
