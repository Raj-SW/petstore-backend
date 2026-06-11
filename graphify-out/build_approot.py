import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html
from graphify.cache import save_semantic_cache
from networkx.readwrite import json_graph
import networkx as nx

# --- Load the new chunk ---
chunk = json.loads(Path('graphify-out/.graphify_chunk_approot.json').read_text(encoding='utf-8-sig'))
save_semantic_cache(chunk['nodes'], chunk['edges'], chunk.get('hyperedges', []))
print(f'New semantic: {len(chunk["nodes"])} nodes, {len(chunk["edges"])} edges')

# --- Merge with cached ---
cached_path = Path('graphify-out/.graphify_cached.json')
if cached_path.exists():
    cached = json.loads(cached_path.read_text(encoding='utf-8'))
    cached_nodes = cached.get('nodes', [])
    cached_edges = cached.get('edges', [])
    cached_hyperedges = cached.get('hyperedges', [])
else:
    cached_nodes, cached_edges, cached_hyperedges = [], [], []

all_sem_nodes = cached_nodes + [n for n in chunk['nodes'] if n['id'] not in {x['id'] for x in cached_nodes}]
all_sem_edges = cached_edges + chunk['edges']
all_sem_hyperedges = cached_hyperedges + chunk.get('hyperedges', [])
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

out_dir = Path('graphify-out/frontend-approot')
out_dir.mkdir(exist_ok=True)

report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens,
                  'frontend/src (App + main + routing)', suggested_questions=questions)
(out_dir / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
to_json(G, communities, str(out_dir / 'graph.json'))
to_html(G, communities, str(out_dir / 'graph.html'))

(out_dir / '.graphify_analysis.json').write_text(
    json.dumps({'communities': {str(k): v for k, v in communities.items()},
                'cohesion': {str(k): v for k, v in cohesion.items()},
                'gods': gods, 'surprises': surprises, 'questions': questions},
               indent=2, ensure_ascii=False),
    encoding='utf-8'
)
print(f'frontend-approot: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')

# --- Rebuild unified combined graph ---
print('\nRebuilding unified combined graph...')

quarter_files = [
    'graphify-out/frontend-q1/graph.json',
    'graphify-out/frontend-q2/graph.json',
    'graphify-out/frontend-q3/graph.json',
    'graphify-out/frontend-approot/graph.json',
    'graphify-out/docs/graph.json',
    'graphify-out/frontend-test/graph.json',
]

# Load backend graph first (it's the base)
backend_data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G_combined = json_graph.node_link_graph(backend_data, edges='links')
print(f'  loaded backend graph: {G_combined.number_of_nodes()} nodes, {G_combined.number_of_edges()} edges')

for qf in quarter_files:
    p = Path(qf)
    if not p.exists():
        print(f'  skip (missing): {qf}')
        continue
    data = json.loads(p.read_text(encoding='utf-8'))
    Gq = json_graph.node_link_graph(data, edges='links')
    before = G_combined.number_of_nodes()
    for nid, ndata in Gq.nodes(data=True):
        if nid not in G_combined:
            G_combined.add_node(nid, **ndata)
    for u, v, edata in Gq.edges(data=True):
        G_combined.add_edge(u, v, **edata)
    added = G_combined.number_of_nodes() - before
    print(f'  merged {qf}: +{added} new nodes (total {G_combined.number_of_nodes()})')

print(f'Combined: {G_combined.number_of_nodes()} nodes, {G_combined.number_of_edges()} edges')

communities_c = cluster(G_combined)
cohesion_c = score_all(G_combined, communities_c)
gods_c = god_nodes(G_combined)
labels_c = {cid: 'Community ' + str(cid) for cid in communities_c}
questions_c = suggest_questions(G_combined, communities_c, labels_c)
detection_fake = {'total_files': 0, 'total_words': 99999, 'needs_graph': True, 'warning': None,
                  'files': {'code': [], 'document': []}}
tokens_c = {'input': 0, 'output': 0}

report_c = generate(G_combined, communities_c, cohesion_c, labels_c, gods_c, [],
                    detection_fake, tokens_c, 'VitalPaws full project', suggested_questions=questions_c)
Path('graphify-out/GRAPH_REPORT.md').write_text(report_c, encoding='utf-8')
to_json(G_combined, communities_c, 'graphify-out/graph.json')
to_html(G_combined, communities_c, 'graphify-out/graph.html')

print(f'Unified graph updated: {G_combined.number_of_nodes()} nodes, {G_combined.number_of_edges()} edges, {len(communities_c)} communities')
print('graphify-out/graph.json updated with full project knowledge graph (including App + routing).')
