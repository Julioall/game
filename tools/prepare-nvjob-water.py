"""Copy original NVJOB v1.6 water resources and MIT notices without conversion."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

source = Path(sys.argv[1])
assets = source / 'Assets' / '#NVJOB Simple Water Shaders'
output = Path(__file__).resolve().parents[1] / 'public' / 'water' / 'nvjob'
output.mkdir(parents=True, exist_ok=True)
mapping = {'Water A 0.png': 'albedo-0.png', 'Water A 1.png': 'albedo-1.png',
           'Water N 0.png': 'normal-0.png', 'Water N 1.png': 'normal-1.png', 'Water H.png': 'height.png'}
manifest = []
for name, target in mapping.items():
    path = assets / 'Examples Water' / 'Materials' / 'Textures' / name
    shutil.copyfile(path, output / target)
    data = path.read_bytes()
    manifest.append({'source': name, 'file': target, 'bytes': len(data),
                     'sha256': hashlib.sha256(data).hexdigest()})
for name in ['license_nvjob.txt', 'license_unity.txt']:
    shutil.copyfile(assets / name, output / name)
shutil.copyfile(source / 'LICENSE', output / 'LICENSE')
(output / 'manifest.json').write_text(json.dumps({'package': '#NVJOB Simple Water Shaders v1.6',
    'license': 'MIT', 'textures': manifest}, indent=2), encoding='utf-8')
print(f'Prepared {len(manifest)} original water textures and three license notices.')
