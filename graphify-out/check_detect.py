import json
from pathlib import Path
d = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8-sig'))
print('total_files:', d['total_files'])
print('total_words:', d.get('total_words', 0))
code = d.get('files', {}).get('code', [])
print('code files:', len(code))
print('sample:', code[:5] if code else [])
