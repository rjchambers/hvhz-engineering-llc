# Admin pipeline overhaul (order → work orders)

Goal: revamp the cumbersome admin work-order pipeline GUI. No schema changes;
all data retained. Branch: `claude/epic-pascal-5arig9`.

## Plan

- [x] 1. Canonical status module `src/lib/work-order-status.ts`
      - labels, badge classes, board columns, ordered pipeline steps
      - legal transition map + `isLegalTransition()` (kanban drags that skip
        the workflow require an explicit override confirm)
      - `work-order-helpers.ts` re-exports for existing consumers (tech/PE/portal)
- [x] 2. Data layer `src/hooks/useWorkOrders.ts` (react-query, already installed)
      - list query w/ filters + pagination, single-WO query, sibling WOs
      - role directory (techs/engineers w/ name resolution), partners
      - mutations: update/dispatch/bulk dispatch/delete/upload result,
        with query invalidation; realtime → throttled invalidate
- [x] 3. Unified Pipeline hub (`/admin` board view, `/admin/work-orders` table view,
      same component): KPI stage counts, shared filter bar (search/status/service),
      Board ⇄ Table toggle, guarded drag & drop, bulk dispatch, pagination
- [x] 4. Work-order detail page `/admin/work-orders/:id`
      - replaces the cramped Sheet; `?id=` deep links redirect here
      - status header + stage timeline, OrderInfoPanel, sibling work orders
        of the same order, dispatch/assignment card (in-house + lab email),
        result upload, admin overrides w/ AlertDialog (no window.confirm)
- [x] 5. Extracted components: DispatchFields (shared single/bulk),
      WorkOrderStatusBadge, WorkOrderStages, PipelineBoard, PipelineTable,
      BulkDispatchDialog, AdminActionsCard
- [x] 6. Tests for the transition machine; lint + tsc + vitest + build green
- [x] 7. Push, draft PR, subscribe to PR activity

## Review

- All work-order data untouched: no migrations, no status renames, same
  Supabase tables/columns/edge functions. GUI + client data-layer only.
- 87 vitest tests pass (incl. new `work-order-status.test.ts`); eslint clean
  on every changed file; `vite build` succeeds. `tsc --noEmit` still has
  pre-existing failures in untouched files (AuthCallback, PEProfile,
  PEReviewDetail, portal Dashboard) — the repo doesn't gate on tsc.
- Old deep links `/admin/work-orders?id=<uuid>` redirect to the new
  `/admin/work-orders/:id` detail page.
- Board drags that skip pipeline stages now require an explicit
  override confirm; matching legal-transition map unit-tested.
- Known follow-ups (out of scope, unchanged behavior): order→WO fan-out
  duplicated across 4 edge functions; `orders.status` uses both `paid` and
  `pending_dispatch`; stale generated Supabase types missing
  `wo_number`/`order_number`.
