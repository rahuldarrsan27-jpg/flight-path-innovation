# 3D aircraft models (drop-in)

The fleet inspector renders **in-house** (no Sketchfab author bar, branded, with
service hotspots) when a matching `.glb` file exists here. If a file is missing,
that aircraft automatically **falls back to the Sketchfab embed** — nothing breaks.

Add these files to activate the in-house viewer:

| File                    | Aircraft        |
|-------------------------|-----------------|
| `atr72.glb`             | ATR 72          |
| `ejet.glb`              | Embraer E-Jet   |
| `b737max.glb`           | Boeing 737 MAX  |
| `a320neo.glb`           | Airbus A320neo  |

## Where to get the files

**Option A — download the models we already use (free, CC-BY).** 3 of the 4 are
downloadable from Sketchfab with your account:
- ATR 72 — https://sketchfab.com/models/1e1a7186f7444d288675262fcee44744
- Boeing 737 MAX — https://sketchfab.com/models/2747cad8b4c64122abe992c9ad1e8bd1
- Airbus A320neo — https://sketchfab.com/models/b14863d4091e41e6abe25832a0af3b00

On each page click **Download 3D model → glTF (.glb)**. Rename to the filename in
the table above and place it here. Because these are **CC-BY**, keep the credit
line on `/credits.html` (already linked in the footer).

The current Embraer model is not downloadable — pick any downloadable E-Jet on
Sketchfab (filter: *Downloadable*) and save it as `ejet.glb`, then add its author
to `/credits.html`.

**Option B — royalty-free / owned models (no attribution needed).** Buy accurate
A320/737/ATR/E-Jet models from a marketplace (CGTrader, TurboSquid), export as
`.glb`, drop them here, and you can remove `/credits.html` + its footer link.

## Tips
- Keep each file **under ~8–10 MB** for fast load (decimate / draco-compress if huge).
- Models are auto-scaled and centered; hotspots are placed from the bounding box.
