# TEST-001 procedure

Follow the [local PostgreSQL/Goose guide](../../../guides/local-postgresql-persistence.md). Use disposable test databases, never staging/production data.

1. Start the pinned local PostgreSQL 18.6 Compose service; record actual server and Goose versions.
2. Create separate fresh `plc_ladder_test` and `plc_ladder_goose_test` databases as documented.
3. Set TEST_DATABASE_URL and TEST_GOOSE_DATABASE_URL; provide GOOSE_BIN/PATH and run `npm run db:test`.
4. Confirm both native suites actually ran, rather than reporting SKIP; preserve relevant failures/context in results.
5. Create/save an FX3U project through the human API/Web, stop/start PostgreSQL and backend, then read current and historical snapshots with a fresh human session.
6. On a separate pre-Goose foundation database, exercise adoption and drift refusal; compare project IDs/head/revision/hash/payload before and after.
7. Record environment, commands, result, artifact references and limitations in results. Re-run Goose round trip only with a fresh disposable database. Down deletes owned tables/data and is not project undo.
