import json
from pathlib import Path

# Load uncached list
uncached = Path('graphify-out/.graphify_uncached.txt').read_text(encoding='utf-8').splitlines()
uncached = [f for f in uncached if f.strip()]

# Load existing graph nodes to see what source files are already represented
g = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
existing_source_files = set()
for n in g.get('nodes', []):
    sf = n.get('source_file', '')
    if sf:
        # Normalize: take just the filename part for fuzzy matching
        existing_source_files.add(Path(sf).name.lower())

# Categorize uncached files
root = Path('.').resolve()
truly_new = []
likely_known = []

skip_dirs = {'graphify-out', '.claude', '.vs', 'node_modules', '__pycache__'}
skip_exts = {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico', '.woff', '.ttf'}

for f in uncached:
    p = Path(f)
    # Skip non-code/doc
    if p.suffix.lower() in skip_exts:
        continue
    # Skip junk dirs
    if any(part in skip_dirs for part in p.parts):
        continue
    # Check if filename exists in graph
    if p.name.lower() in existing_source_files:
        likely_known.append(f)
    else:
        truly_new.append(f)

print(f'Truly NEW files (not in graph by name): {len(truly_new)}')
for f in truly_new[:40]:
    try:
        rel = str(Path(f).relative_to(root))
    except ValueError:
        rel = f
    print(f'  {rel}')

print(f'\nLikely already in graph (filename match): {len(likely_known)}')
for f in likely_known[:10]:
    try:
        rel = str(Path(f).relative_to(root))
    except ValueError:
        rel = f
    print(f'  {rel}')
