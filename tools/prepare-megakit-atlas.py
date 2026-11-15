"""Offline atlas for the supplied CC0 MegaKit plants (requires Pillow)."""
import sys
from pathlib import Path
from PIL import Image, ImageOps

root = Path(sys.argv[1])
names = ['Grass.png', 'Leaves.png', 'Flowers.png', 'Leaves_NormalTree_C.png',
         'Leaves_TwistedTree_C.png', 'Mushrooms.png']
atlas = Image.new('RGBA', (1536, 1024), (255, 255, 255, 0))
for i, name in enumerate(names):
    tile = Image.open(root / 'Textures' / name).convert('RGBA').resize((504, 504), Image.Resampling.LANCZOS)
    if name in ['Grass.png', 'Leaves.png', 'Leaves_NormalTree_C.png', 'Leaves_TwistedTree_C.png']:
        # The source atlas also contains red/purple foliage. Keep its cutouts
        # and shading while giving all ground foliage the requested green base.
        alpha = tile.getchannel('A')
        tones = ImageOps.grayscale(tile).point(lambda value: round(value / 64) * 64)
        tile = ImageOps.colorize(tones, '#284918', '#92b54a').convert('RGBA')
        tile.putalpha(alpha)
    x, y = i % 3 * 512 + 4, i // 3 * 512 + 4
    atlas.paste(tile, (x, y))
out = Path('src/render/assets/megakit-plants.png')
out.parent.mkdir(parents=True, exist_ok=True)
atlas.save(out, optimize=True)
