import json
from pathlib import Path

uncached = Path('graphify-out/.graphify_uncached.txt').read_text(encoding='utf-8').splitlines()
uncached = [f for f in uncached if f.strip()]

g = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
existing_names = set()
for n in g.get('nodes', []):
    sf = n.get('source_file', '')
    if sf:
        existing_names.add(Path(sf).name.lower())

root = Path('.').resolve()
skip_dirs = {'graphify-out', '.claude', '.vs', 'node_modules', '__pycache__'}
skip_exts = {'.png','.jpg','.jpeg','.webp','.svg','.gif','.ico','.woff','.ttf','.lock'}

# Config files with minimal semantic value
skip_names = {'package.json','package-lock.json','vercel.json','.eslintrc.json','tsconfig.json',
              'postcss.config.js','tailwind.config.js','jsconfig.json','undo-restructure.js',
              'figma.config.js','components.json','figma.config.js','.prettierrc','.gitignore',
              'eslint.config.js','vite.config.js'}

truly_new_valuable = []
for f in uncached:
    p = Path(f)
    if p.suffix.lower() in skip_exts:
        continue
    if any(part in skip_dirs for part in p.parts):
        continue
    if p.name.lower() in skip_names:
        continue
    if p.name.lower() in existing_names:
        continue
    # skip root-level duplicates of backend/ paths
    parts = list(p.parts)
    if len(parts) <= 2 and parts[-1].endswith(('.js', '.md', '.json')):
        # root-level file - check if backend/ version exists in list
        pass
    truly_new_valuable.append(f)

# Dedupe by filename (skip root copies if backend/ version present)
seen_names = set()
deduped = []
for f in truly_new_valuable:
    p = Path(f)
    key = p.name.lower()
    # Keep backend/ version over root version
    if key in seen_names:
        # if current starts with 'backend' or has deeper path, keep it
        already = [x for x in deduped if Path(x).name.lower() == key][0]
        if len(Path(f).parts) > len(Path(already).parts):
            deduped.remove(already)
            deduped.append(f)
    else:
        seen_names.add(key)
        deduped.append(f)

print(f'Valuable new files to graphify: {len(deduped)}')
for f in deduped:
    try:
        rel = str(p.relative_to(root)) if (p := Path(f)).is_absolute() else f
    except:
        rel = f
    print(f'  {rel}')

# Save filtered list for processing
Path('graphify-out/.graphify_new_valuable.txt').write_text('\n'.join(deduped), encoding='utf-8')
