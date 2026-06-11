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

# --- Load new chunks ---
chunk1 = json.loads(Path('graphify-out/.graphify_chunk_update1.json').read_text(encoding='utf-8-sig'))
chunk2 = json.loads(Path('graphify-out/.graphify_chunk_update2.json').read_text(encoding='utf-8-sig'))

# Save new semantic extractions to cache
save_semantic_cache(chunk1['nodes'], chunk1['edges'], chunk1.get('hyperedges', []))
save_semantic_cache(chunk2['nodes'], chunk2['edges'], chunk2.get('hyperedges', []))

# Merge chunk nodes/edges
all_new_nodes = chunk1['nodes'] + chunk2['nodes']
all_new_edges = chunk1['edges'] + chunk2['edges']
all_new_hyperedges = chunk1.get('hyperedges', []) + chunk2.get('hyperedges', [])

# Dedupe new nodes
seen = set()
deduped_new = []
for n in all_new_nodes:
    if n['id'] not in seen:
        seen.add(n['id'])
        deduped_new.append(n)

print(f'New semantic: {len(deduped_new)} nodes, {len(all_new_edges)} edges')

# --- Load AST update ---
ast = json.loads(Path('graphify-out/.graphify_ast_update.json').read_text(encoding='utf-8'))
print(f'New AST: {len(ast["nodes"])} nodes, {len(ast["edges"])} edges')

# Merge AST + semantic (new only)
ast_ids = {n['id'] for n in ast['nodes']}
merged_new_nodes = list(ast['nodes'])
for n in deduped_new:
    if n['id'] not in ast_ids:
        merged_new_nodes.append(n)
        ast_ids.add(n['id'])

new_extraction_edges = ast['edges'] + all_new_edges
print(f'Merged new: {len(merged_new_nodes)} nodes, {len(new_extraction_edges)} edges')

# --- Load existing unified graph and merge ---
print('\nLoading existing unified graph...')
existing_data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G_existing = json_graph.node_link_graph(existing_data, edges='links')
print(f'Existing graph: {G_existing.number_of_nodes()} nodes, {G_existing.number_of_edges()} edges')

# Build new-nodes-only graph and merge in
G_new = build_from_json({
    'nodes': merged_new_nodes,
    'edges': new_extraction_edges,
    'hyperedges': all_new_hyperedges,
    'input_tokens': 0,
    'output_tokens': 0,
})
print(f'New subgraph: {G_new.number_of_nodes()} nodes, {G_new.number_of_edges()} edges')

before_nodes = G_existing.number_of_nodes()
for nid, ndata in G_new.nodes(data=True):
    if nid not in G_existing:
        G_existing.add_node(nid, **ndata)
for u, v, edata in G_new.edges(data=True):
    G_existing.add_edge(u, v, **edata)

added = G_existing.number_of_nodes() - before_nodes
print(f'Added {added} new nodes -> combined: {G_existing.number_of_nodes()} nodes, {G_existing.number_of_edges()} edges')

# --- Re-cluster and regenerate ---
print('\nRe-clustering...')
communities = cluster(G_existing)
cohesion = score_all(G_existing, communities)
gods = god_nodes(G_existing)
surprises = surprising_connections(G_existing, communities)
labels = {cid: 'Community ' + str(cid) for cid in communities}
questions = suggest_questions(G_existing, communities, labels)
detection_fake = {
    'total_files': 0, 'total_words': 99999,
    'needs_graph': True, 'warning': None,
    'files': {'code': [], 'document': []}
}
tokens = {'input': 0, 'output': 0}

report = generate(G_existing, communities, cohesion, labels, gods, surprises,
                  detection_fake, tokens, 'VitalPaws full project (updated)', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
to_json(G_existing, communities, 'graphify-out/graph.json')
to_html(G_existing, communities, 'graphify-out/graph.html')

Path('graphify-out/.graphify_analysis.json').write_text(
    json.dumps({
        'communities': {str(k): v for k, v in communities.items()},
        'cohesion': {str(k): v for k, v in cohesion.items()},
        'gods': gods, 'surprises': surprises, 'questions': questions,
    }, indent=2, ensure_ascii=False),
    encoding='utf-8'
)

print(f'\nUpdated unified graph: {G_existing.number_of_nodes()} nodes, {G_existing.number_of_edges()} edges, {len(communities)} communities')
print('graphify-out/graph.json updated.')
