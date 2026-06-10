# Graph Report - docs  (2026-06-10)

## Corpus Check
- Corpus is ~13,113 words - fits in a single context window. You may not need a graph.

## Summary
- 35 nodes · 69 edges · 7 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]

## God Nodes (most connected - your core abstractions)
1. `Invoicing & Transactions Design Spec` - 15 edges
2. `Inventory Management Design Spec` - 10 edges
3. `InvoiceService` - 8 edges
4. `inventory.controller.js` - 7 edges
5. `Invoicing & Transactions Implementation Plan` - 6 edges
6. `Invoice Model` - 6 edges
7. `payment.controller.js` - 6 edges
8. `Inventory Management Implementation Plan` - 5 edges
9. `StockMovement Model` - 5 edges
10. `invoice.controller.js` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Inventory Management Implementation Plan` --describes--> `Subsystem A — Inventory Management`  [INFERRED]
  docs/superpowers/plans/2026-06-03-inventory-management.md → docs/CHANGELOG.md
- `Invoicing & Transactions Implementation Plan` --describes--> `Subsystem B — Invoicing & Transactions`  [INFERRED]
  docs/superpowers/plans/2026-06-03-invoicing-transactions.md → docs/CHANGELOG.md
- `Inventory Management Design Spec` --references--> `Inventory Management Implementation Plan`  [INFERRED]
  docs/superpowers/specs/2026-06-03-inventory-management-design.md → docs/superpowers/plans/2026-06-03-inventory-management.md
- `Inventory Management Implementation Plan` --describes--> `StockMovement Model`  [EXTRACTED]
  docs/superpowers/plans/2026-06-03-inventory-management.md → docs/superpowers/specs/2026-06-03-inventory-management-design.md
- `Inventory Management Implementation Plan` --describes--> `AdminInventory Page`  [EXTRACTED]
  docs/superpowers/plans/2026-06-03-inventory-management.md → docs/superpowers/specs/2026-06-03-inventory-management-design.md

## Hyperedges (group relationships)
- **Inventory Management Feature Cluster** — model_stockmovement, controller_inventory, feature_stockmovement_logging, feature_lowstock_alerts, page_admininventory [EXTRACTED 0.95]
- **Invoicing & Transactions Feature Cluster** — model_invoice, model_transaction, service_invoiceservice, feature_autoinvoice, feature_pdf_generation, controller_invoice, controller_transaction [EXTRACTED 0.95]
- **Admin Frontend Pages Cluster** — page_admininventory, page_admininvoices, page_admintransactions, layout_adminlayout [INFERRED 0.85]

## Communities (7 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.29
Nodes (8): payment.controller.js, Auto Invoice on Payment Confirmation, INV-YYYY-NNNN Invoice Number Sequence, isAdmin Guard on processRefund, PDF Invoice Generation (pdfkit), Counter Model, payment.routes.js, InvoiceService

### Community 1 - "Community 1"
Cohesion: 0.60
Nodes (6): invoiceApi.js, transactionApi.js, AdminInvoices Page, AdminTransactions Page, Invoicing & Transactions Implementation Plan, Invoicing & Transactions Design Spec

### Community 2 - "Community 2"
Cohesion: 0.40
Nodes (6): invoice.controller.js, transaction.controller.js, Snapshotted Line Items on Invoice, Invoice Model, Transaction Model, admin.routes.js

### Community 3 - "Community 3"
Cohesion: 0.47
Nodes (6): inventoryApi.js, admin.controller.js, AdminLayout.jsx, Product Model, AdminInventory Page, Inventory Management Design Spec

### Community 4 - "Community 4"
Cohesion: 0.67
Nodes (3): Subsystem A — Inventory Management, Subsystem B — Invoicing & Transactions, VitalPaws Feature Changelog

### Community 5 - "Community 5"
Cohesion: 0.67
Nodes (3): inventory.controller.js, Low-Stock Alerts, Inventory Management Implementation Plan

### Community 6 - "Community 6"
Cohesion: 0.67
Nodes (3): order.controller.js, Stock Movement Logging, StockMovement Model

## Knowledge Gaps
- **6 isolated node(s):** `admin.controller.js`, `Stock Movement Logging`, `Low-Stock Alerts`, `isAdmin Guard on processRefund`, `INV-YYYY-NNNN Invoice Number Sequence` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Invoicing & Transactions Design Spec` connect `Community 1` to `Community 0`, `Community 2`, `Community 6`?**
  _High betweenness centrality (0.392) - this node is a cross-community bridge._
- **Why does `Inventory Management Design Spec` connect `Community 3` to `Community 2`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Why does `admin.routes.js` connect `Community 2` to `Community 1`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Invoicing & Transactions Implementation Plan` (e.g. with `Subsystem B — Invoicing & Transactions` and `Invoicing & Transactions Design Spec`) actually correct?**
  _`Invoicing & Transactions Implementation Plan` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `admin.controller.js`, `Stock Movement Logging`, `Low-Stock Alerts` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._