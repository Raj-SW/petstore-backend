# Graph Report - frontend/src/test  (2026-06-10)

## Corpus Check
- Corpus is ~1,665 words - fits in a single context window. You may not need a graph.

## Summary
- 25 nodes · 21 edges · 6 communities (3 shown, 3 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 5|Community 5]]

## God Nodes (most connected - your core abstractions)
1. `CurrencyContext (CurrencyProvider, useCurrency)` - 4 edges
2. `exchangeRatesService (fetchRates, detectCurrency, FALLBACK_RATES)` - 3 edges
3. `CurrencyContext Test Suite` - 2 edges
4. `Price Component Test Suite` - 2 edges
5. `Price Component` - 2 edges
6. `consoleSpy` - 1 edges
7. `cachedRates` - 1 edges
8. `fetchSpy` - 1 edges
9. `freshRates` - 1 edges
10. `before` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Price Component` --references--> `CurrencyContext (CurrencyProvider, useCurrency)`  [INFERRED]
  frontend/src/Components/HelperComponents/Price/Price.jsx → frontend/src/context/CurrencyContext.jsx
- `CurrencyContext (CurrencyProvider, useCurrency)` --references--> `exchangeRatesService (fetchRates, detectCurrency, FALLBACK_RATES)`  [INFERRED]
  frontend/src/context/CurrencyContext.jsx → frontend/src/Services/api/exchangeRatesService.js
- `CurrencyContext Test Suite` --tests--> `CurrencyContext (CurrencyProvider, useCurrency)`  [EXTRACTED]
  frontend/src/test/CurrencyContext.test.jsx → frontend/src/context/CurrencyContext.jsx
- `CurrencyContext Test Suite` --mocks--> `exchangeRatesService (fetchRates, detectCurrency, FALLBACK_RATES)`  [EXTRACTED]
  frontend/src/test/CurrencyContext.test.jsx → frontend/src/Services/api/exchangeRatesService.js
- `exchangeRatesService Test Suite` --tests--> `exchangeRatesService (fetchRates, detectCurrency, FALLBACK_RATES)`  [EXTRACTED]
  frontend/src/test/exchangeRatesService.test.js → frontend/src/Services/api/exchangeRatesService.js

## Hyperedges (group relationships)
- **Currency Behavior Test Coverage** — test_currencycontext_test, test_exchangeratesservice_test, test_price_test [INFERRED 0.95]
- **Currency System Under Test** — context_currencycontext, services_exchangeratesservice, components_price [INFERRED 0.85]

## Communities (6 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.25
Nodes (6): after, before, cached, cachedRates, fetchSpy, freshRates

### Community 1 - "Community 1"
Cohesion: 0.47
Nodes (6): Price Component, CurrencyContext (CurrencyProvider, useCurrency), exchangeRatesService (fetchRates, detectCurrency, FALLBACK_RATES), CurrencyContext Test Suite, exchangeRatesService Test Suite, Price Component Test Suite

## Knowledge Gaps
- **10 isolated node(s):** `consoleSpy`, `cachedRates`, `fetchSpy`, `freshRates`, `before` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `CurrencyContext (CurrencyProvider, useCurrency)` (e.g. with `Price Component` and `exchangeRatesService (fetchRates, detectCurrency, FALLBACK_RATES)`) actually correct?**
  _`CurrencyContext (CurrencyProvider, useCurrency)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `consoleSpy`, `cachedRates`, `fetchSpy` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._