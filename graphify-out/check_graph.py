import json
from pathlib import Path

g = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
nodes = g.get('nodes', [])
edges = g.get('links', g.get('edges', []))
communities = g.get('communities', {})

print(f"Total nodes: {len(nodes)}, edges: {len(edges)}, communities: {len(communities)}")

# Check for App.jsx and main.jsx
app_nodes = [n for n in nodes if 'App' in str(n.get('id','')) or 'main' in str(n.get('id','')).lower()]
print(f"\nApp/main related nodes ({len(app_nodes)}):")
for n in app_nodes[:20]:
    print(f"  {n['id']} [{n.get('type','')}]")
