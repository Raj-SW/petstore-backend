import json
from pathlib import Path
from collections import deque, defaultdict

g = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
nodes = {n['id']: n for n in g['nodes']}
links = g['links']

adj = defaultdict(set)
for l in links:
    adj[l['source']].add(l['target'])
    adj[l['target']].add(l['source'])

queries = ['auth', 'product', 'cart', 'appointment', 'order']

avg_per_file = 2379

print("Per-query comparison: graphify subgraph vs loading raw files\n")
print(f"{'Query':<15} {'Subgraph nodes':<17} {'Subgraph tokens':<18} {'Raw files':<12} {'Raw tokens':<14} {'Savings'}")
print("-" * 95)

total_subgraph = 0
total_raw = 0

for query in queries:
    seeds = [nid for nid in nodes if query in nid.lower()][:3]
    if not seeds:
        continue
    visited = set(seeds)
    q = deque([(s, 0) for s in seeds])
    while q:
        nid, depth = q.popleft()
        if depth < 2:
            for nb in adj[nid]:
                if nb not in visited:
                    visited.add(nb)
                    q.append((nb, depth+1))

    subgraph_nodes = list(visited)
    subgraph_edges = [l for l in links if l['source'] in visited and l['target'] in visited]
    subgraph_tokens = len(subgraph_nodes) * 30 + len(subgraph_edges) * 15

    source_files = set(nodes[n].get('source_file','') for n in subgraph_nodes if n in nodes)
    source_files = [f for f in source_files if f]
    raw_tokens = len(source_files) * avg_per_file

    savings = round((1 - subgraph_tokens / max(raw_tokens, 1)) * 100)
    total_subgraph += subgraph_tokens
    total_raw += raw_tokens

    print(f"{query:<15} {len(subgraph_nodes):<17} {subgraph_tokens:<18} {len(source_files):<12} {raw_tokens:<14} {savings}%")

print("-" * 95)
avg_savings = round((1 - total_subgraph / max(total_raw, 1)) * 100)
print(f"\nAverage savings per query: {avg_savings}%")
print(f"Full codebase raw tokens: ~792,086")
print(f"GRAPH_REPORT.md tokens:  ~8,427 (broad nav)")
print(f"graphify query result:   ~1,000-4,000 tokens (targeted)")
