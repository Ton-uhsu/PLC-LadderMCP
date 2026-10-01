# TEST-001 — Native PostgreSQL 18.6 / Goose verification

**Status:** Not run
**Requirements:** REQ-016, REQ-023, REQ-033, REQ-040–041, REQ-150, REQ-154
**Dependencies:** TASK-001–002
**Date:** 2026-10-01

The schema/repository have embedded-engine coverage. This test owns the remaining native pg-driver/multiple-connection and actual Goose database execution gate. Local Docker is sufficient; no VPS is required.

## Acceptance

- [ ] Goose Up/repeated Up/Status/Down/Up/Down-to-0/Up on a fresh disposable database completes with expected versions/tables.
- [ ] Native pg competing saves produce one winner and a stale loser; retries do not duplicate revisions.
- [ ] Closing/reopening connections and PostgreSQL restart retain saved IR/head/history.
- [ ] Existing Kysely adoption preserves exact snapshots; drift refusal is transactional.

[Procedure](./procedure.md) · [Results](./results.md) · [Phase](../README.md)
