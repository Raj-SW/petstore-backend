import json
from pathlib import Path

data = json.loads(Path('graphify-out/.graphify_incremental.json').read_text(encoding='utf-8'))
new_files = data.get('new_files', {})
deleted = data.get('deleted_files', [])
new_total = data.get('new_total', 0)
all_changed = [f for files in new_files.values() for f in files]

print(f'new_total: {new_total}')
print(f'deleted: {len(deleted)}')
print(f'changed files by category:')
for cat, files in new_files.items():
    if files:
        print(f'  {cat}: {len(files)} files')

# Show only the non-graphify-out, non-.claude files
filtered = [f for f in all_changed if 'graphify-out' not in f and '.claude' not in f and '.vs' not in f]
print(f'\nMeaningful changed files ({len(filtered)}):')
for f in filtered[:30]:
    print(f'  {f}')
if len(filtered) > 30:
    print(f'  ... and {len(filtered)-30} more')

print(f'\nDeleted files ({len(deleted)}):')
for f in list(deleted)[:10]:
    print(f'  {f}')
