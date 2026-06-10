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

def build_quarter(nodes, edges, hyperedges, ast_path, detect_path, out_dir_name, label):
    ast = json.loads(Path(ast_path).read_text(encoding='utf-8')) if ast_path and Path(ast_path).exists() else {'nodes':[],'edges':[]}
    detection = json.loads(Path(detect_path).read_text(encoding='utf-8-sig'))
    seen = {n['id'] for n in ast['nodes']}
    merged_nodes = list(ast['nodes'])
    for n in nodes:
        if n['id'] not in seen:
            merged_nodes.append(n)
            seen.add(n['id'])
    merged = {'nodes': merged_nodes, 'edges': ast['edges'] + edges, 'hyperedges': hyperedges, 'input_tokens': 0, 'output_tokens': 0}
    G = build_from_json(merged)
    communities = cluster(G)
    cohesion = score_all(G, communities)
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)
    labels = {cid: 'Community ' + str(cid) for cid in communities}
    questions = suggest_questions(G, communities, labels)
    tokens = {'input': 0, 'output': 0}
    out = Path(f'graphify-out/{out_dir_name}')
    out.mkdir(exist_ok=True)
    report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, label, suggested_questions=questions)
    (out / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
    to_json(G, communities, str(out / 'graph.json'))
    to_html(G, communities, str(out / 'graph.html'))
    (out / '.graphify_analysis.json').write_text(json.dumps({'communities': {str(k): v for k, v in communities.items()}, 'cohesion': {str(k): v for k, v in cohesion.items()}, 'gods': gods, 'surprises': surprises, 'questions': questions}, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'{label}: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')
    return G

# --- DOCS ---
docs_chunk = json.loads(Path('graphify-out/.graphify_chunk_docs.json').read_text(encoding='utf-8-sig'))
save_semantic_cache(docs_chunk['nodes'], docs_chunk['edges'], docs_chunk.get('hyperedges', []))
build_quarter(docs_chunk['nodes'], docs_chunk['edges'], docs_chunk.get('hyperedges', []),
              None, 'graphify-out/.graphify_detect_docs.json', 'docs', 'docs')

# --- TEST ---
test_chunk = json.loads(Path('graphify-out/.graphify_chunk_test.json').read_text(encoding='utf-8-sig'))
save_semantic_cache(test_chunk['nodes'], test_chunk['edges'], test_chunk.get('hyperedges', []))
build_quarter(test_chunk['nodes'], test_chunk['edges'], test_chunk.get('hyperedges', []),
              'graphify-out/.graphify_ast_test.json', 'graphify-out/.graphify_detect_test.json',
              'frontend-test', 'frontend/src/test')

# --- UNIFIED COMBINED GRAPH ---
print('\nBuilding unified combined graph...')
all_nodes_map = {}
all_edges = []

quarter_files = [
    'graphify-out/graph.json',          # backend
    'graphify-out/frontend-q1/graph.json',
    'graphify-out/frontend-q2/graph.json',
    'graphify-out/frontend-q3/graph.json',
    'graphify-out/docs/graph.json',
    'graphify-out/frontend-test/graph.json',
]

G_combined = nx.MultiDiGraph()
for qf in quarter_files:
    p = Path(qf)
    if not p.exists():
        print(f'  skip (missing): {qf}')
        continue
    data = json.loads(p.read_text(encoding='utf-8'))
    Gq = json_graph.node_link_graph(data, edges='links')
    for nid, ndata in Gq.nodes(data=True):
        if nid not in G_combined:
            G_combined.add_node(nid, **ndata)
    for u, v, edata in Gq.edges(data=True):
        G_combined.add_edge(u, v, **edata)
    print(f'  merged {qf}: +{Gq.number_of_nodes()} nodes, +{Gq.number_of_edges()} edges')

print(f'Combined: {G_combined.number_of_nodes()} nodes, {G_combined.number_of_edges()} edges')

communities = cluster(G_combined)
cohesion = score_all(G_combined, communities)
gods = god_nodes(G_combined)
labels = {cid: 'Community ' + str(cid) for cid in communities}
questions = suggest_questions(G_combined, communities, labels)
detection_fake = {'total_files': 0, 'total_words': 99999, 'needs_graph': True, 'warning': None, 'files': {'code': [], 'document': []}}
tokens = {'input': 0, 'output': 0}

report = generate(G_combined, communities, cohesion, labels, gods, [], detection_fake, tokens, 'VitalPaws full project', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
to_json(G_combined, communities, 'graphify-out/graph.json')
to_html(G_combined, communities, 'graphify-out/graph.html')
print(f'Unified graph: {G_combined.number_of_nodes()} nodes, {G_combined.number_of_edges()} edges, {len(communities)} communities')
print('graphify-out/graph.json updated with full project knowledge graph.')
