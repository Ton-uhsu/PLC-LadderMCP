# PLC-LadderMCP Project Roadmap

**Status:** Implementation roadmap derived from accepted Requirements V1.0; sequencing is adjustable, product scope is frozen.\
**Version:** 1.0\
**Updated:** 2026-10-01\
**Inspected implementation:** `88b376703e69d26d5b545af7515fb5bb0cca8661`\
**Canonical requirements:** [01-requirements.md](./01-requirements.md), REQ-001–159\
**Architecture:** [03-solution-design.md](./03-solution-design.md)

## 1. Current focus

ทำ local UI ใน **Phase 02** ต่อ: TASK-004 มี Project settings/network controls และ automated domain/API tests แล้ว; ยังรอ browser acceptance และ durable workflow context checks. TASK-005 มี canvas-first editor/recursive renderer พร้อม domain/SQL/browser tests แล้ว แต่ยัง Partial ตาม acceptance ที่เหลือ. งานถัดไปคือ **TASK-006 + TASK-007: explicit Compile และ diagnostics** ตาม dependencies. ยังไม่เริ่ม VPS deployment.

ผู้ใช้ต้องการทำ local/UI ก่อนงาน VPS. สามารถเตรียม UI layout, Ladder rendering, structured interactions และ tests ด้วย local dev ได้ก่อน Docker. แต่ UI ที่ต้องพึ่ง workflow API ต้องแสดง unavailable เมื่อ API ยังไม่มี; ไม่ใช้ fake Compile/Apply/Export success และไม่ถือ in-memory draft เป็น PostgreSQL autosave. **TEST-001 เป็น gate ก่อนยืนยัน native database integration ของ Phase 03/04** และก่อน release; สามารถเริ่ม Docker local verification เมื่อผู้ใช้พร้อมโดยไม่ต้องใช้ VPS

คำว่า UI พร้อม, schema พร้อม, workflow พร้อม และ verified in real IDE เป็นคนละสถานะ. ตารางที่สร้างแล้วไม่ได้หมายความว่า Review/Compile/Export API ใช้งานได้แล้ว

## 2. Baseline ที่มีจริง

| Area | Current evidence | Remaining boundary |
| --- | --- | --- |
| Canonical docs | Requirements V1.0 และ stack/deployment/auth/persistence designs มีแล้ว | ไม่มีการเปลี่ยน REQ จาก roadmap นี้ |
| Project persistence | Kysely + pg, immutable IR v0.2 revisions, human API, UUID picker และ debounced serialized Web autosave | ทำงานเมื่อ DATABASE_URL พร้อม; native PostgreSQL tests ยังไม่รัน |
| Database migrations | Goose Up/Down 4 ชุด, 27 domain tables, adoption จาก Kysely, CLI validate/embedded SQL tests | workflow APIs และ PostgREST roles/functions ยังขาด |
| Ladder engine | IR v0.2, FX3U compiler/validator/capability catalog และ fixtures | V1 modeling/diagnostics/package separation ยังไม่ครบ |
| Web | Login, project/network views, basic database manual editor, legacy AI review/history/export | legacy และ database workflows ยังแยกกัน; typed V1 instruction completeness/rendered review/Compile history ยังขาด; canvas/editor slice ผ่าน browser QA แล้ว; settings/default-target และ workflow integration ยังรอ |
| IDE evidence | มีบันทึก real GX Works2 verification บาง topology/opcode/operand ใน canonical evidence | ไม่ใช่ blanket compatibility; import/SamSoar/round-trip scope ยัง Pending POC |
| Production | GitHub Pages และ local backend เป็น development baseline | ยังไม่ใช่ V1 Jenkins/GHCR/Kubernetes production target |

แหล่งรายละเอียด: [local persistence guide](./guides/local-postgresql-persistence.md), [capability contract](./contracts/fx3u-capability-catalog.md), [IDE research](./research/plc-ide-import-export.md), [verification matrix](./evidence/fx3u-verification-matrix.md). บันทึก execution ก่อน roadmap อยู่ใน [TASKS.md](../TASKS.md), WORK-001–006

## 3. Phase overview

Phase README เป็นเจ้าของ task index; task files เป็นเจ้าของ completion checks/evidence. ตารางนี้แสดงเฉพาะ phase summary ไม่ copy task backlog

| Phase | Current status | Outcome / exit boundary |
| --- | --- | --- |
| [01 — Foundation](./roadmap/phase-01-foundation/README.md) | Partial | IR/project/schema foundation + native PostgreSQL/Goose verification |
| [02 — Local UI](./roadmap/phase-02-local-ui/README.md) | Partial; next focus | Project/network management, structured editor, topology-correct preview และ Compile diagnostic UX |
| [03 — Durable workflows](./roadmap/phase-03-durable-workflows/README.md) | Planned; legacy prototypes exist | Exact-revision Compile, per-network Review, atomic Apply, restore และ audit |
| [04 — IDE/evidence/export](./roadmap/phase-04-ide-evidence-export/README.md) | Partial | Fidelity-aware import, gated retained export และ PostgREST-backed POC evidence |
| [05 — Stack/local containers](./roadmap/phase-05-stack-local-containers/README.md) | Planned | Accepted stack migration เป็น slices; local images/integration และ CI build assets |
| [06 — VPS deployment](./roadmap/phase-06-vps-deployment/README.md) | Planned; not started | Jenkins/GHCR/kubeadm, staging/production, persistent storage, auth และ HTTPS |
| [07 — V1 acceptance](./roadmap/phase-07-v1-acceptance/README.md) | Planned | Requirement-traceable end-to-end acceptance จาก local workflows ถึง real IDE และ deployed runtime |

ยังไม่ให้เปอร์เซ็นต์ V1 เพราะ acceptance ที่ทดสอบครบยังไม่ได้รวมทุก requirement. Done ของ TASK-001/002 เป็น narrowly scoped delivered foundations; ไม่ใช่ผลสรุปว่า requirements ทั้งกลุ่มเสร็จ. Partial/Planned checks จะยังไม่ติ๊กแม้มีบาง code path จนมี task-specific evidence

## 4. Sequencing และ dependencies

1. ใช้ Phase 01 ที่มีแล้วเป็นฐาน; เติม IR/profile gaps ผ่าน TASK-003 เมื่อ editor/validator/adapter ต้องใช้ ไม่ต้อง broad rewrite ก่อนเห็น gap
2. ทำ Phase 02 project/network + structured editor/renderer ก่อน. Compile UI เตรียม interaction ได้ แต่ completion ต้องเชื่อม TASK-007. Session undo/redo แยกจาก historical restore
3. ทำ TEST-001 กับ PostgreSQL local ก่อนปิด durable integration. Phase 03 ต่อ schema เข้ากับ domain APIs: Compile, semantic batch/review/Apply และ history/audit. Keep AI writes proposal-only ตลอด transition
4. Phase 04 import fidelity, export gating และ evidence เป็น feedback loop กับ IDE POC. จะล็อก format/support ต่อเมื่อมีผลจริง; POC contract/setup ทำควบคู่ adapters ได้. Export ต้องใช้ current successful Compile และ selected-adapter gate
5. Phase 05 ปรับ stack เป็น work slices พร้อม regression tests และทำ local container assets. Shared schema/validator/transport changes อาจต้องทำก่อน task ที่เกี่ยวข้องเมื่อพบ incompatibility; ไม่เปลี่ยน target architecture เพื่อหลีกเลี่ยง migration
6. เริ่ม Phase 06 เมื่อ local application/container checks พร้อมและผู้ใช้พร้อมงาน VPS. ความพร้อม VPS ไม่ block การพัฒนา local/UI แต่ production deployment ยังเป็น V1 requirement
7. เก็บ acceptance evidence ระหว่างทุก phase แล้วปิด Phase 07 เมื่อครบทั้ง application/IDE/security/runtime gates

ไม่มีวันที่ release หรือ duration ที่เดาไว้. เลือก next WORK จาก owning task และใช้ spec-architect readiness ก่อนแก้ source; roadmap ไม่ได้อนุมัติเปิดทุก phase พร้อมกัน

## 5. Requirement traceability

ทุกกลุ่ม REQ-001–159 มี work owner ด้านล่าง. Mapping เป็น coverage plan ไม่ใช่ compliance certificate; exact IDs และ checks อยู่ใน task files

| Frozen requirement group | Owning phase(s) / work |
| --- | --- |
| REQ-001–021 — Ladder core, AI interface, editing, diff, recovery, IDE targets | 01 core; 02 editor; 03 review/history; 04 adapters/export |
| REQ-022–035 — single admin, persistence and deployment | 01 persistence; 03 auth/audit; 05 local images; 06 production; quotas/scheduled backups remain excluded |
| REQ-036–042 — Web/manual editing/autosave/projects/networks | 02 UI + 01 revision foundation + 03 workflow integration |
| REQ-043–044 — import and reviewed AI modification | 04 import + 03 semantic review |
| REQ-045–079 — Ladder review/batch/rework/stale/Apply/audit | 02 rendered diff support + 03 durable workflow |
| REQ-080–094 — POC/fidelity/compatibility/PostgREST evidence | 04 IDE/evidence/export |
| REQ-095–111 — canonical IR, profiles, source maps and schema versions | 01 core + 02 editor/renderer + 04 import fidelity |
| REQ-112–136 — shared validator, diagnostics, explicit Compile/history | 02 diagnostics UX + 03 revision-pinned Compile |
| REQ-137–140 — atomic semantic batch and mandatory review | 03 semantic batch/review/Apply |
| REQ-141–149 — versioned artifacts, target configuration and export gates | 02 settings + 03 Compile + 04 retained export |
| REQ-150–159 — base revision, proposal-only AI, idempotency/dependencies/auth | 01 revision foundations + 03 batch/auth + 05 transport migration + 06 deployment auth |

## 6. Readiness blockers / open implementation details

- [Native PostgreSQL and actual Goose database execution](./roadmap/phase-01-foundation/test-001-native-postgresql/README.md) ยังไม่รัน. Embedded PGlite/CLI validate เป็น supporting coverage ไม่ใช่ native multi-session proof
- [Durable batch/review/Apply](./roadmap/phase-03-durable-workflows/task-008-batch-review-apply.md) ต้องกำหนด HTTP/domain contracts ตาม accepted lifecycle ก่อน wiring UI; ห้ามนำ legacy approve-and-apply มาใช้แทน deferred per-network Apply
- [Compile integration](./roadmap/phase-03-durable-workflows/task-007-compile-persistence.md) ต้องจัดการ edit-during-Compile/metadata-equivalent reuse และ latest eligibility. Browser `Valid` ไม่ใช่ Compile PASS
- [IDE fidelity/POC](./roadmap/phase-04-ide-evidence-export/task-010-import-fidelity.md) ยังจำกัดตาม format/fixture/operand. Pending evidence ไม่ต้องถาม product requirements ใหม่โดยอัตโนมัติ
- [Stack alignment](./roadmap/phase-05-stack-local-containers/task-013-stack-alignment.md) เป็น separate planned work; current package versions ยังไม่เท่ากับ accepted tech baseline
- [VPS platform](./roadmap/phase-06-vps-deployment/task-015-vps-platform.md) ยังมี storage/naming/manifest/resource sizing decisions. Goose ถูกเลือกแล้ว; deployment design เดิมยังมี migration-tool open item ต้อง reconcile ใน owning deployment work โดยไม่ reopen product scope

## 7. Status ownership and updates

- `01-requirements.md` owns product scope; roadmap ห้าม invent/relax requirements
- `03-solution-design.md` และ `designs/*` own architecture; task files link ไม่ทำ design copy
- `02-project-roadmap.md` owns project-level focus/sequencing/phase summaries; phase README owns task navigation; task/Test owns checks and actual status/evidence
- `TASKS.md` owns active execution ผ่าน WORK IDs. New WORK links owning TASK/TEST; ไม่ copy backlog ทั้งชุดลง operational board
- `contracts/*`, `research/*`, `evidence/*` ยังคงเป็น canonical technical/evidence sources เดิม. ไม่มีการย้ายหรือ rewrite จากงานนี้
- Update task evidence/status หลัง verification แล้ว update phase/project summary เท่าที่จำเป็น. Do not fabricate POC/native results or count procedure text as passed acceptance

ใช้ [repo-docs-architect](https://github.com/Ton-uhsu/CODEX_SKILL/blob/main/repo-docs-architect/SKILL.md) สำหรับ document ownership และ [spec-architect](https://github.com/Ton-uhsu/CODEX_SKILL/blob/main/spec-architect/SKILL.md) สำหรับ implementation readiness/WORK handoff. Grilling ใช้เฉพาะ genuine unresolved requirement/design decisions; ไม่เริ่มเก็บ REQ ใหม่แทน frozen V1.0
