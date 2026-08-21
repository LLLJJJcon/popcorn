# CONTRACT-014 expression search review repair handoff

## Review findings addressed

- The spaced/punctuated fixture now persists `normalized_expression_text` in
  the real promotion format (NFKC plus outer trim), rather than an idealized
  punctuation-free value.
- Query comparisons, match ranking, trigram scoring, and source overlap now
  apply the same immutable search normalization to stored values and input.
- The GIN expression index uses that identical stored-side normalization.
- The actual trigram predicate uses `OPERATOR(extensions.%)`; the function
  fixes `pg_trgm.similarity_threshold` at 0.2 so the short Chinese typo fixture
  is searchable through the indexed operator.
- Index maintenance receives the minimum required private-function execute
  grant for `service_role`; `anon` and `authenticated` remain denied.

## RED

The strengthened 20-test pgTAP suite failed four assertions on the reviewed
candidate: index/operator alignment, real-format exact ranking, cross-source
count, and UUID tie ordering. The real-format exact row was omitted and its
source count was split to one.

## GREEN

- Clean local reset applied migrations 001–013 successfully.
- A first full-suite run exposed the missing service-role index-maintenance
  permission in the existing atomic promotion test. A dedicated permission
  assertion reproduced it RED; the minimal role grant closed it.
- Focused expression-search pgTAP: 21/21 PASS.
- Full pgTAP after a clean reset: 7 files, 591/591 PASS.
- Added direct coverage for non-null communicative-function filtering,
  register `match_reason`, equal-recency UUID tie breaking, and aligned
  function/index definitions.
- The strengthened ordering assertions compare the RPC's own output without
  applying an outer test-side sort.

## Scope and residual risk

Only migration 013, its focused pgTAP, repair brief, and this handoff changed.
The public signature and generated types are unchanged. The 0.2 threshold is
deliberately contract-frozen for the first personal release; product tuning is
deferred until real usage evidence exists.
