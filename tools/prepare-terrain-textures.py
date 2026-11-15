"""Prepare the user supplied terrain pack: python tools/prepare-terrain-textures.py SOURCE."""
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image

source = Path(sys.argv[1])
output = Path(__file__).resolve().parents[1] / 'public' / 'terrain'
output.mkdir(parents=True, exist_ok=True)
names = ['grass (1).png', 'grass (4).png', 'leaves.png', 'dirt (2).png',
         'g_pal_00_color.png', 'snow.png', 'grass snow.png', 'road.png']
tile, padding = 256, 8
cell = tile + padding * 2
atlas = Image.new('RGB', (cell * 4, cell * 2))
manifest = []
for index, name in enumerate(names):
    path = source / name
    image = Image.open(path).convert('RGB').resize((tile, tile), Image.Resampling.BOX)
    # Wrapped gutters preserve repeat sampling and isolate neighbouring tiles.
    padded = Image.new('RGB', (cell, cell))
    padded.paste(image, (padding, padding))
    padded.paste(image.crop((tile-padding, 0, tile, tile)), (0, padding))
    padded.paste(image.crop((0, 0, padding, tile)), (tile+padding, padding))
    padded.paste(padded.crop((0, tile, cell, tile+padding)), (0, 0))
    padded.paste(padded.crop((0, padding, cell, padding*2)), (0, tile+padding))
    atlas.paste(padded, ((index % 4) * cell, (index // 4) * cell))
    manifest.append({'layer': index, 'source': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
atlas.save(output / 'terrain-atlas.png', optimize=True)
(output / 'manifest.json').write_text(json.dumps({'tile': tile, 'padding': padding,
    'columns': 4, 'rows': 2, 'textures': manifest}, indent=2), encoding='utf-8')
print(f'Prepared {len(names)} textures, {atlas.width} x {atlas.height}')
