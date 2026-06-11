import json, glob
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html
from graphify.cache import save_semantic_cache

# --- Merge chunks (new extractions only) ---
chunks = sorted(glob.glob('graphify-out/.graphify_chunk_*.json'))
all_nodes, all_edges, all_hyperedges = [], [], []
for c in chunks:
    d = json.loads(Path(c).read_text(encoding="utf-8-sig"))
    all_nodes += d.get('nodes', [])
    all_edges += d.get('edges', [])
    all_hyperedges += d.get('hyperedges', [])

seen = set()
deduped_nodes = []
for n in all_nodes:
    if n['id'] not in seen:
        seen.add(n['id'])
        deduped_nodes.append(n)

semantic_new = {'nodes': deduped_nodes, 'edges': all_edges, 'hyperedges': all_hyperedges}
save_semantic_cache(deduped_nodes, all_edges, all_hyperedges)
print(f'New semantic: {len(deduped_nodes)} nodes, {len(all_edges)} edges')

# --- Merge with cached ---
cached_path = Path('graphify-out/.graphify_cached.json')
if cached_path.exists():
    cached = json.loads(cached_path.read_text(encoding='utf-8'))
    cached_nodes = cached.get('nodes', [])
    cached_edges = cached.get('edges', [])
    cached_hyperedges = cached.get('hyperedges', [])
else:
    cached_nodes, cached_edges, cached_hyperedges = [], [], []

all_sem_nodes = cached_nodes + [n for n in deduped_nodes if n['id'] not in {x['id'] for x in cached_nodes}]
all_sem_edges = cached_edges + all_edges
all_sem_hyperedges = cached_hyperedges + all_hyperedges
print(f'Total semantic (cache+new): {len(all_sem_nodes)} nodes, {len(all_sem_edges)} edges')

# --- Merge AST + semantic ---
ast = json.loads(Path('graphify-out/.graphify_ast.json').read_text(encoding='utf-8'))
seen = {n['id'] for n in ast['nodes']}
merged_nodes = list(ast['nodes'])
for n in all_sem_nodes:
    if n['id'] not in seen:
        merged_nodes.append(n)
        seen.add(n['id'])

merged = {
    'nodes': merged_nodes,
    'edges': ast['edges'] + all_sem_edges,
    'hyperedges': all_sem_hyperedges,
    'input_tokens': 0,
    'output_tokens': 0,
}
Path('graphify-out/.graphify_extract.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Merged: {len(merged_nodes)} nodes, {len(merged["edges"])} edges ({len(ast["nodes"])} AST + {len(all_sem_nodes)} semantic)')

# --- Build, cluster, analyze ---
detection = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8-sig'))
G = build_from_json(merged)
communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: 'Community ' + str(cid) for cid in communities}
questions = suggest_questions(G, communities, labels)
tokens = {'input': 0, 'output': 0}

out_dir = Path('graphify-out/frontend-q3')
out_dir.mkdir(exist_ok=True)

report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, 'frontend/src (services/context/hooks/utils/constants/models)', suggested_questions=questions)
(out_dir / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
to_json(G, communities, str(out_dir / 'graph.json'))
to_html(G, communities, str(out_dir / 'graph.html'))

analysis = {
    'communities': {str(k): v for k, v in communities.items()},
    'cohesion': {str(k): v for k, v in cohesion.items()},
    'gods': gods,
    'surprises': surprises,
    'questions': questions,
}
(out_dir / '.graphify_analysis.json').write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')
print(f'Output: {out_dir}')
print('Done.')
