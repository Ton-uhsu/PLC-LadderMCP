# PLC-LadderMCP Requirements

**Document:** `docs/01-requirements.md`  
**Status:** Draft / Baseline  
**Version:** 0.8  
**Project:** PLC-LadderMCP

## 1. Project Goal

PLC-LadderMCP is an AI-first toolchain for creating, reading, modifying, validating, and exporting **real PLC Ladder programs**.

The primary goal is to let a user describe PLC logic to an AI agent and have the AI operate a Ladder tool directly, rather than returning Ladder as plain text or ASCII that the user must manually redraw.

The generated result must be usable in real PLC development software, with initial targets including:

- Mitsubishi GX Works
- SamSoar2022

The long-term design should avoid unnecessary coupling to a single AI model, PLC vendor, or tool protocol.

---

## 2. Core Principle

The system must **not treat plain text as the final Ladder output**.

Example user request:

> When X1 is ON, alternate Y2 and Y3 every 1 second.

An AI may reason internally using structured data, but the final operational result must be an actual Ladder program/project representation that can be previewed, validated, exported, and opened in a supported PLC IDE.

Target interaction:

```text
User
  |
  | Natural-language PLC request
  v
AI Agent
(ChatGPT / Codex / Claude / local model / etc.)
  |
  | MCP / Tool API / other supported protocol
  v
PLC-LadderMCP Tool Server
  |
  v
Ladder Engine
  |
  +--> GX Works compatible project/output
  |
  +--> SamSoar2022 compatible project/output
```

---

## 3. Functional Requirements

### REQ-001 - Native Ladder Output

The system must generate Ladder logic as a real Ladder representation, not only explanatory text, ASCII diagrams, or pseudo-code.

### REQ-002 - PLC IDE Compatibility

Generated output must be importable, openable, or otherwise usable in supported PLC IDEs.

Initial targets:

- GX Works
- SamSoar2022

### REQ-003 - Create New PLC Projects

The AI/tool must be able to create a new PLC project from a user request.

Example:

> Create an FX3U project with a Start/Stop motor circuit.

### REQ-004 - Modify Existing Projects

The system must be able to load an existing project and modify only the requested logic.

Example:

> Add a timeout alarm to Pump 1.

The user should not need to recreate the whole project.

### REQ-005 - Read and Understand Existing Ladder

The tool must expose existing Ladder logic to the AI in a structured form so the AI can understand:

- Rungs
- Contacts
- Coils
- Timers
- Counters
- Registers
- Branches
- Instructions
- Comments
- Device addresses

### REQ-006 - Add / Remove / Modify Rungs

The tool must support targeted Ladder editing operations, including:

- Insert rung
- Delete rung
- Modify rung
- Reorder rung when supported
- Add/remove Ladder elements without rewriting unrelated logic

### REQ-007 - Basic PLC Instructions

Initial instruction support should include at least:

- Normally Open Contact
- Normally Closed Contact
- Output Coil
- SET
- RST
- Timer
- Counter
- MOV
- Compare instructions
- Basic arithmetic
- Common data operations

Instruction support may vary by PLC family.

### REQ-008 - Branch Logic

The Ladder model must support parallel and series logic, including:

- AND conditions
- OR branches
- Parallel branches
- Interlocks
- Nested logic where supported by the target PLC

### REQ-009 - Real Device Addressing

The system must support real PLC device addresses, including common Mitsubishi-style devices such as:

- X
- Y
- M
- D
- T
- C

It should also support special devices when valid for the selected PLC, for example `M8000`.

### REQ-010 - PLC Model Awareness

The user/project must specify or expose the PLC model/family.

The system must account for model-specific differences in:

- Available instructions
- Address ranges
- Special devices
- Timer/counter behavior
- Project format
- IDE compatibility

Example target:

- FX3U

Future PLC models should be extendable without redesigning the whole system.

### REQ-011 - Compile / Validate Before Export

Before producing final output, the system must validate generated or modified Ladder logic.

Validation should include, where possible:

- Unsupported instruction
- Invalid device/address
- Invalid operand
- Invalid Ladder structure
- Target PLC incompatibility
- Export-format errors

### REQ-012 - Logic Error Detection

The system should detect suspicious or potentially unsafe programming patterns, including examples such as:

- Duplicate output coil usage
- SET without an apparent RST path
- Conflicting writes
- Unreachable or impossible conditions
- Invalid timer/counter configuration
- Obvious addressing conflicts

Warnings and errors should be distinguishable.

### REQ-013 - Safe Targeted Modification

When modifying an existing project, the system must avoid rewriting unrelated Ladder logic.

A command such as:

> Add an alarm to Pump 1.

must preserve unrelated pumps, sequences, comments, devices, and rung ordering unless modification is explicitly required.

### REQ-014 - Diff Before / After

The system must be able to show what changed.

Examples:

- Added 2 rungs
- Modified rung 12
- Changed `D100` to `D110`
- Added timer `T3`
- Removed duplicate coil `Y2`

The diff should be available both to the AI and the user-facing web interface.

### REQ-015 - Comments and Labels

The tool should support PLC comments, symbols, labels, and descriptions where the target IDE supports them.

Example:

```text
M100 - Pump 1 Timeout Alarm
T10  - Pump 1 Start Feedback Timeout
```

AI-generated programs should use readable comments by default.

### REQ-016 - Backup / Undo

Before applying modifications to an existing project, the system must preserve a recoverable previous state.

The user must be able to:

- View history
- Undo a change
- Restore a previous project version

### REQ-017 - Human Approval

AI-generated modifications should support a review/approval step before final application or export.

Suggested flow:

```text
AI proposes change
       |
       v
Validate
       |
       v
Show Ladder + Diff
       |
       v
User approves
       |
       v
Apply / Export
```

The system may later provide configurable auto-apply behavior, but manual approval should be the safe default.

### REQ-018 - AI Tool Interface

PLC-LadderMCP must expose programmable operations that AI agents can call.

Potential tool operations include:

```text
create_project()
open_project()
get_project_info()
get_rungs()
get_rung()
insert_rung()
delete_rung()
add_contact()
add_coil()
add_timer()
add_counter()
add_branch()
set_comment()
validate_project()
get_diff()
export_project()
```

Exact tool names and schemas will be defined later.

### REQ-019 - Structured Internal Ladder Representation

AI models should not be expected to directly generate or edit proprietary binary PLC project files.

The system should use an intermediate structured Ladder representation.

Example concept:

```text
Project
  Program
    Rung
      Branch
        Contact
        Timer
        Coil
```

The Ladder Engine is responsible for translating this representation to and from vendor-specific project formats.

This internal representation should be vendor-neutral where practical.

### REQ-020 - Multiple IDE Export Targets

The same logical Ladder representation should be capable of supporting multiple PLC IDE targets.

Initial targets:

1. GX Works
2. SamSoar2022

Future possible targets may include other PLC vendors or IEC 61131-3 environments.

Vendor-specific behavior must remain isolated from the core Ladder model as much as practical.

### REQ-021 - AI-First Interface

The primary way to use the system must be through an AI agent calling PLC-LadderMCP tools.

The user should **not be required to manually operate the web UI to create Ladder logic**.

Primary workflow:

```text
User -> AI -> MCP / Tool API -> Ladder Engine -> PLC Project
```

The web application also supports structured manual Ladder editing, while AI-driven creation and modification remain the primary workflow.

MCP is the initial preferred protocol, but the architecture should not be permanently coupled to MCP.

Future integrations may expose the same Ladder Engine through:

- MCP
- REST API
- CLI
- SDK
- Other agent/tool protocols

### REQ-022 - Single-Admin V1

V1 is intended for personal use by one administrator. User registration, multiple human accounts, role-based access control, and account-management workflows are not required for V1.

### REQ-023 - Restart Persistence Boundary

Saved/applied Ladder projects must survive backend restarts and redeployments. Pending AI Changes / Human Review items may remain process-local and may be lost on restart in V1.

### REQ-024 - DevOps Learning Objective

PLC-LadderMCP must also serve as a practical learning project for Docker, Jenkins, and Kubernetes from V1 rather than adding those technologies only after the application is complete.

### REQ-025 - Jenkins CI/CD From V1

Jenkins must be the primary CI/CD system for V1 and should drive the build, test, container-image, and Kubernetes deployment workflow.

### REQ-026 - Kubernetes as Primary Runtime

Kubernetes must be the primary deployment/runtime platform for V1 rather than an optional later migration target.

### REQ-027 - Single-Node kubeadm Cluster

The initial Kubernetes environment must use a single-node cluster created with `kubeadm` on the project VPS so the deployment can be used to study standard Kubernetes concepts directly.

### REQ-028 - Jenkins Outside the Kubernetes Cluster

Jenkins must run outside the Kubernetes cluster on the same VPS, isolated as a Docker container, and deploy application workloads into the cluster.

### REQ-029 - GitHub Container Registry

Container images produced by the V1 pipeline must be stored in GitHub Container Registry (GHCR) and pulled from GHCR by the Kubernetes deployment.

### REQ-030 - Frontend and Backend on Kubernetes

Both the frontend and backend must be deployed on Kubernetes in V1. GitHub Pages is not the primary production deployment target for the frontend once this V1 deployment model is implemented.

### REQ-031 - Separate Staging and Production

V1 must provide separate staging and production environments. The exact isolation mechanism (for example namespaces versus separate clusters) remains a design decision and is not fixed by this requirement.

### REQ-032 - Real Domain and HTTPS

V1 must use a real domain and HTTPS. TLS should be issued through Let's Encrypt at the Kubernetes Ingress boundary.

### REQ-033 - PostgreSQL From V1

V1 must use PostgreSQL for durable application state that requires database persistence. The detailed schema and ownership of each data category remain design decisions.

### REQ-034 - No AI Usage Quota in V1

Because V1 is for single-user personal use, per-day or per-month AI usage quotas are not required for V1.

### REQ-035 - No Automated PostgreSQL Backup in V1

Automated scheduled PostgreSQL backups are not required for V1. This does not remove the project history/undo requirement in REQ-016 and does not prevent backups from being added later.

### REQ-036 - Web Control Center

The V1 web application must serve as the control center for Ladder projects. It must provide project navigation and access to Ladder viewing/editing, validation, AI change review, approval/rejection, diff inspection, history, and export workflows.

### REQ-037 - Structured Manual Ladder Editor

V1 must provide a manual Ladder editor in the web application. The editor must be structured around Ladder semantics and supported elements such as contacts, coils, timers, branches, and networks rather than operating as an unrestricted freeform canvas.

A full IDE-style drag-and-drop canvas is not required for V1.

### REQ-038 - Shared Validator for Manual Edits

Manual Ladder editing in the web application must use the same validator and validation rules as AI-generated logic when the user explicitly runs Compile.

Manual edits must not trigger mandatory full validation on every edit. The editor may persist draft changes while compile state is tracked separately under REQ-133 and REQ-134.

### REQ-039 - Web Undo / Redo

The V1 manual editor must provide undo and redo for editing actions so the user can safely reverse or reapply recent manual changes during an editing session.

### REQ-040 - Autosave Draft Edits

The V1 web application must autosave structured manual Ladder edits without requiring the user to press a Save button for each edit.

Autosave does not imply that the current draft is compiled or valid for export. Compile state must remain separate, and any logic change after a successful compile must invalidate that compile result under REQ-134.

### REQ-041 - Multiple Projects

V1 must support multiple Ladder projects. Projects must remain independently selectable and maintain their own Ladder data, validation state, review/export context, and history where applicable.

### REQ-042 - Multiple Networks per Project

A V1 project must support multiple Ladder networks rather than being limited to a single network. The web application must allow the user to navigate and edit those networks within the selected project.

### REQ-043 - Import Existing GX Works2 and SamSoar2022 Projects

V1 should support importing existing projects from both GX Works2 and SamSoar2022 into PLC-LadderMCP so they can be represented in the canonical Ladder model and worked on without recreating the logic manually.

This capability is **Pending POC**. The implementation scope must be confirmed by real import/export experiments with both IDEs before the supported file formats and fidelity are treated as locked requirements.

Where the source format makes the data available, the importer should preserve useful project metadata such as:

- PLC family/model
- Ladder programs and networks
- Device comments
- Labels/symbols
- Network/rung comments
- Other metadata required to preserve the meaning of the imported project

Unsupported or lossy fields must be reported rather than silently discarded.

### REQ-044 - AI Modification of Imported Projects

After a supported GX Works2 or SamSoar2022 project is imported, AI agents must be able to read the resulting Ladder representation and propose targeted modifications to it using the same Ladder Engine and validation path used for projects created inside PLC-LadderMCP.

Imported projects must not become a read-only special case. AI-proposed changes to imported projects must enter the Human Review workflow before application.

### REQ-045 - Ladder-Native Human Review

Human Review must present AI-proposed changes as actual rendered Ladder diagrams rather than requiring the user to review raw Ladder IR, JSON, or text-only diffs.

The default review view should show the proposed post-change Ladder with changed elements highlighted. The user must also be able to inspect explicit Before and After Ladder views.

The review UI should keep the user's navigation position stable and must not force automatic scrolling to changed elements.

### REQ-046 - Per-Network Approval and Rejection

When one AI request changes multiple Ladder networks, Human Review must allow each changed network to be approved or rejected independently.

V1 does not require element-by-element approval inside a single network. The network is the primary review/approval unit.

### REQ-047 - Rejection Feedback

When rejecting a proposed network change, the user must be able to provide a short feedback/reason message.

That feedback must be available to the AI when generating a corrected proposal.

### REQ-048 - Rework Rejected Networks Only

When a reviewed batch contains both approved and rejected networks, AI rework must target only the rejected networks unless the user explicitly requests otherwise.

Networks that have already been approved must remain locked against modification during that rework cycle.

### REQ-049 - Approved Networks as Read-Only Context

During rework of rejected networks, the AI may read approved networks as context so it can understand shared devices, labels, dependencies, and surrounding sequence logic.

Approved networks must be treated as read-only context and must not be modified by that rework operation.

### REQ-050 - Validation Gate Before Human Review

AI-generated changes must pass required Ladder validation before entering the normal Human Review queue.

A proposal that fails required validation must not be presented as an approvable review item. Instead, the system should attempt repair first and, if it still cannot produce a valid proposal, expose a separate validation-failed state with actionable errors.

### REQ-051 - Automatic Repair Retry Limit

When an AI-generated proposal fails required validation, the system should allow the AI workflow to automatically repair and revalidate the proposal up to **3 attempts** before stopping.

After the third failed repair attempt, the proposal must remain non-approvable and the validation errors must be shown to the user.

### REQ-052 - Standard Ladder Diff Highlight Semantics

Ladder diff visualization must use consistent change semantics:

- Green — added Ladder logic/elements
- Red — removed Ladder logic/elements
- Yellow — modified Ladder logic/elements

The UI must not rely on color alone; added, removed, and modified states should also be identifiable through labels, icons, patterns, or equivalent accessible cues.

### REQ-053 - Changed-Network Review List

When an AI proposal affects multiple networks, Human Review must provide a list/sidebar of the affected networks so the user can navigate directly between review items.

The list should also expose each network's current review state, such as pending, approved, rejected, or validation failed where applicable.

### REQ-054 - Per-Network Change Summary

Each changed network in Human Review should include a short human-readable summary of what the AI changed in that network.

The summary supplements the Ladder diff; it does not replace the rendered Ladder review.

### REQ-055 - Added Network Review

A network created entirely by AI must be shown explicitly as an **Added Network** in Human Review.

The newly created Ladder network must be rendered and independently approvable or rejectable using the same per-network review flow.

### REQ-056 - Removed Network Review

A network proposed for deletion must be shown explicitly as a **Removed Network** in Human Review.

The user must still be able to inspect the existing Ladder for that network before deciding whether to approve or reject its removal.

### REQ-057 - Network Move / Reorder Review

If AI proposes moving or reordering an existing network, Human Review must identify that as a distinct move/reorder change rather than presenting it ambiguously as an add/delete pair.

The affected network must remain independently approvable or rejectable.

### REQ-058 - AI Change Batch

One user prompt that produces one or more AI-proposed Ladder changes must be tracked as a single **change batch**.

A change batch may contain changes to multiple networks, while each affected network remains independently reviewable under the per-network approval rules.

### REQ-059 - Partial Batch Status

A change batch containing a mixture of network review states must expose an aggregate partial status rather than appearing fully approved or completed.

For example, if some networks are approved while others remain pending or rejected, the batch should be represented as partially approved until the current review work is resolved.

### REQ-060 - Deferred Apply Until Review Round Completion

Approving an individual network must not immediately mutate the saved project state.

Approval should mark and lock that network for the current review round. Approved changes are applied only when the current review round reaches its apply step, so a sequence of individual button presses cannot leave the saved project in a half-reviewed state.

### REQ-061 - Apply Approved Networks After Review Round

At the end of a review round, networks approved in that round may be applied to the project even when other networks in the same change batch were rejected.

Rejected networks must enter a rework cycle while remaining associated with the original change batch. Previously approved/applied networks must not be unnecessarily regenerated.

### REQ-062 - Proposal Revision History

When a rejected network is revised by AI, the system must preserve a revision history for that network proposal.

Each revision should retain enough information to inspect its Ladder diff, rejection feedback, validation result, and relationship to the prior revision.

### REQ-063 - Latest Revision Only Actionable

Older proposal revisions must remain viewable for history and audit purposes but must be read-only.

Only the latest active revision of a network proposal may be approved or rejected.

### REQ-064 - Significant Scope Change Warning

If a revised proposal changes materially more Ladder logic than the original request or rejection feedback reasonably implies, the system must display a clear **significant scope change** warning.

The warning does not automatically block review, but it must make the expanded change scope visible before approval.

### REQ-065 - Pending Review Conflict Protection

V1 must prevent a new AI proposal from silently modifying a network that already has an unresolved proposal in Human Review.

If a new request targets such a network, the system must report a conflict and block the overlapping proposal until the existing review is resolved, cancelled, or otherwise explicitly handled.

### REQ-066 - Parallel Non-Overlapping Batches

Multiple change batches may proceed in parallel when they do not modify the same Ladder networks.

The existence of one active review batch must not unnecessarily block unrelated work on non-overlapping networks.

### REQ-067 - Cross-Network Dependency Warning

Even when two active batches modify different networks, the system should detect shared devices, labels, or other relevant logical dependencies between them.

Potential cross-network or cross-batch dependency conflicts must be surfaced as warnings and evaluated by validation. Shared dependencies do not automatically require blocking every case.

### REQ-068 - Integration Validation Before Apply

Immediately before approved proposal changes are applied to saved project state, the system must validate them against the **latest full project state**.

If integration introduces a new error or conflict, such as duplicate coils, conflicting writes, invalid dependencies, or incompatible logic, apply must stop and the affected proposal must enter an **Integration Conflict** state for resolution and review.

### REQ-069 - Stale Proposal Protection

Each AI proposal must retain enough base-version information to determine whether the project has changed since that proposal was generated.

A proposal affected by relevant project changes must be marked **Stale** and must not be applied directly until it is revalidated or regenerated against the current project state.

### REQ-070 - Manual Regeneration of Stale Proposals

A stale proposal must not be silently regenerated automatically in V1.

When regeneration is required, the user must explicitly trigger it so that newly generated Ladder logic is visible as a new proposal/revision and reviewed again.

### REQ-071 - Dependency-Aware Stale Check

A project version change alone must not force every outstanding proposal to regenerate.

The stale check should evaluate the networks, devices, labels, and dependencies relevant to the proposal. If unrelated project changes occurred, the proposal may be revalidated and continue without full regeneration.

### REQ-072 - Metadata-Only Changes Do Not Invalidate Logic Proposals

Changes limited to comments, descriptions, or other metadata that do not alter Ladder execution behavior should not by themselves make a logic proposal stale.

Changes to device mappings, instructions, network structure, execution behavior, or other logic-affecting dependencies may invalidate the proposal.

### REQ-073 - Rejected Batch Revision Continuity

If all proposals in a change batch are rejected, corrected proposals must continue as revisions under the same original batch rather than creating a new unrelated batch.

This preserves traceability from the original user prompt through every rejection, feedback cycle, and corrected proposal.

### REQ-074 - Batch Cancellation History

The user must be able to cancel an active change batch.

A cancelled batch must be marked **Cancelled**, must no longer permit proposals from that batch to be applied, and must retain its prompt, proposals, revisions, feedback, and validation history for later inspection.

### REQ-075 - Retry Cancelled Batch as New Batch

A cancelled batch must not be reopened in place.

The user may choose **Retry from this batch**, which creates a new change batch and records a reference back to the cancelled source batch.

### REQ-076 - Retry Uses Intent and Feedback, Not Old Proposal State

When retrying from a cancelled batch, the new batch should carry forward the original user intent, relevant rejection feedback, and appropriate context.

The old proposal state itself must not be reused as the authoritative starting point because the current project state may have changed.

### REQ-077 - Per-Network Lifecycle Status

Each network proposal inside a change batch must expose its own lifecycle status independently of the batch aggregate status.

Relevant states may include, as applicable:

- Pending Review
- Approved
- Applied
- Rejected
- Rework
- Validation Failed
- Integration Conflict
- Stale
- Cancelled

The exact state-machine representation may be refined in solution design, but the user must be able to tell where each network is in the review/apply lifecycle.

### REQ-078 - Batch Status Derived from Network States

The aggregate status of a change batch must be derived from its network proposal states rather than being manually assigned by the user.

For example, a batch with unresolved networks remains active, a mixture of applied and unresolved/rejected networks may be partially applied, and a batch becomes completed only when all of its network-level work has reached a terminal state appropriate to that batch.

### REQ-079 - Full Change Audit Trail

The system must preserve a traceable audit history for AI change batches.

The audit trail should include at least:

- Original user prompt
- Change-batch identity and lineage
- Affected networks
- AI proposal and revision history
- Ladder diffs
- Validation and integration-validation results
- User approvals and rejections
- Rejection feedback
- Apply events
- Cancellation events
- Retry relationships between batches

The audit trail must support debugging and later review of why and how Ladder logic changed.

### REQ-080 - Round-Trip Import/Export POC

GX Works2 and SamSoar2022 support must each be proven with a real round-trip POC:

```text
IDE export
  -> PLC-LadderMCP import
  -> Ladder IR
  -> PLC-LadderMCP export
  -> IDE import
```

A POC is not considered complete merely because one export direction works; both IDE targets must demonstrate an end-to-end usable Ladder round trip for the tested fixture set.

### REQ-081 - Semantic Round-Trip Equivalence

Round-trip verification does not require exported files to be byte-for-byte identical to their source files.

The success criterion is semantic equivalence of Ladder logic and behavior. Normalization performed by the IDE, such as device-name formatting, step numbering, headers, or non-behavioral formatting changes, is acceptable when execution semantics remain equivalent.

### REQ-082 - Initial POC Fixture Coverage

The first round-trip fixture set must cover at least:

- Normally Open contact
- Normally Closed contact
- Output Coil
- SET / RST
- Timer
- Counter
- MOV
- Compare
- AND branch logic
- OR branch logic

Nested branches may be validated in a later fixture set after the basic round-trip set is stable.

### REQ-083 - Common and Vendor-Specific Compatibility Fixtures

The POC suite must contain both:

1. **Common fixtures** representing equivalent logic supported by both GX Works2 and SamSoar2022.
2. **Vendor-specific fixtures** for instructions or features that exist in only one target environment or have vendor-specific semantics.

The system must not require every vendor-specific instruction to be portable across IDEs in order to claim round-trip support for its original vendor.

### REQ-084 - Preserve Unsupported Instructions on Import

When an imported project contains an instruction or feature that PLC-LadderMCP does not yet understand, the system should continue importing the rest of the project when safe rather than rejecting the entire project automatically.

The unsupported portion must be represented explicitly as an **Unsupported / Vendor-Specific** node or equivalent preserved structure, retain the original raw source needed for later round-trip handling, and must not be silently rewritten by AI.

### REQ-085 - Safe Vendor Passthrough for Unsupported Nodes

Unsupported or vendor-specific nodes whose raw source has been preserved should be exportable back to their original vendor through passthrough when the surrounding edits have not invalidated that passthrough.

If a surrounding structural change makes preservation unsafe or ambiguous, the system must block or warn rather than silently emitting potentially incorrect Ladder logic.

### REQ-086 - Cross-Vendor Export Compatibility Gate

When exporting a project to a different target vendor, PLC-LadderMCP must detect vendor-specific instructions, structures, or capabilities that the destination does not support.

Cross-vendor export must be blocked when a real incompatibility would make the resulting logic invalid or semantically incorrect. The system must identify the affected network/instruction and distinguish portable content from vendor-specific content.

### REQ-087 - Lossy Metadata Import Warning

An import may succeed with warnings when Ladder behavior is preserved but non-behavioral metadata such as comments, labels, symbols, or descriptions cannot be fully retained.

The system must report which metadata was lost, normalized, or reduced rather than silently discarding it.

### REQ-088 - Logic-Fidelity Failure Is Read-Only

If an imported network cannot be represented faithfully enough in Ladder IR to preserve expected behavior, the project may be opened for diagnostic inspection but must enter a **read-only diagnostic** state for the affected unsafe scope.

The system must prevent AI modification, apply, or export of logic whose behavior cannot be represented faithfully until the fidelity issue is resolved.

### REQ-089 - Separate Import and Export Verification

Adapter verification must record import and export capability independently for each target IDE.

At minimum, evidence must distinguish:

- IDE -> PLC-LadderMCP import result
- PLC-LadderMCP -> IDE export result
- End-to-end round-trip result

A passing result in one direction must not be interpreted as proof that the opposite direction also works.

### REQ-090 - Adapter Compatibility Matrix

The project must maintain a compatibility matrix at the instruction/feature level for GX Works2 and SamSoar2022.

The matrix should record states such as `PASS`, `FAIL`, `PARTIAL`, or `N/A` and distinguish import, export, and round-trip verification where applicable.

### REQ-091 - POC Fixture and Evidence Persistence via PostgreSQL/PostgREST

POC fixtures, test evidence, and compatibility results must be persisted in PostgreSQL and exposed to the application through PostgREST rather than relying on local files as the primary evidence store.

Stored evidence should include enough metadata to identify the target vendor, fixture type, verification direction, result state, warnings/errors, and checksum or equivalent integrity information.

### REQ-092 - Store Actual Fixture Files in PostgreSQL

The actual GX Works2 and SamSoar2022 interchange files used by POC runs must be stored in PostgreSQL, not only referenced by filesystem paths.

The stored file content must be retrievable through the application's PostgreSQL/PostgREST data path so a fixture can be reproduced without depending on the original developer workstation.

### REQ-093 - Append-Only POC Run History

Repeated POC or regression runs must create new run records rather than overwriting previous results.

Historical runs must remain available so changes such as `FAIL -> PASS` or `PASS -> FAIL` can be inspected over time, while the application may additionally expose the latest result for convenience.

### REQ-094 - Full POC Artifact Retention

Each POC run must retain the artifacts required to debug parser and serializer behavior, including at least:

- Original source interchange file
- File generated by PLC-LadderMCP
- Expected Ladder IR
- Actual Ladder IR

These artifacts must be associated with the same POC run record in PostgreSQL/PostgREST.

### REQ-095 - Canonical Topology-Based Ladder IR

The canonical Ladder IR must represent Ladder as logical topology rather than using a vendor instruction list as the authoritative model.

Core structural concepts should include nodes such as `series`, `parallel`, `contact`, `coil`, and typed instruction nodes. Vendor instruction lists such as `LD / AND / OUT` may be generated or parsed by adapters, but must not be the primary canonical representation.

### REQ-096 - Typed Operands and Devices

Operands and PLC devices in Ladder IR must use typed structured representations rather than relying only on strings such as `D100` or `K10`.

The model must be able to distinguish concepts such as PLC devices, constants, labels/references, and instruction-specific operands so validation and vendor conversion can reason about their meaning.

### REQ-097 - Stable Ladder Node Identity

Every editable Ladder logic node must have a stable identity that can survive movement or reordering where the logical element remains the same.

Stable node IDs must support precise diffing, Human Review, undo/redo, revision history, source mapping, and targeted AI edits without depending only on visual position.

### REQ-098 - Typed Instruction Schemas

Core instructions must be represented through typed schemas appropriate to their instruction family rather than only as a generic `opcode + args[]` structure.

Examples include typed models for move/data-transfer, compare, timer, counter, and arithmetic instructions with explicit fields and operand constraints.

### REQ-099 - Explicit Vendor-Specific Extension Nodes

Features that cannot be represented faithfully using the vendor-neutral core must use an explicit vendor-specific extension representation.

Such nodes should retain enough information to identify the vendor, opcode/capability, and preserved raw source or payload needed for safe same-vendor passthrough under REQ-084 and REQ-085.

Vendor-specific semantics must not silently leak into unrelated core node types.

### REQ-100 - Deterministic Execution Order

Ladder IR must preserve deterministic logical execution order independently of its visual rendering coordinates.

Validation, network reordering, diffing, and adapter compilation must be able to determine execution order from the model itself rather than inferring it from the renderer layout.

### REQ-101 - Network Name Metadata Only in V1

At the canonical network-container level, V1 only requires a network `name` as first-class metadata separate from the logic tree.

Additional network-level description/comment metadata is not required for V1. This does not remove device comments, labels, imported vendor metadata, or other metadata preservation required elsewhere in this specification.

### REQ-102 - Single Main Program in V1

V1 only needs one Ladder program named `Main` per project, with multiple networks inside that program.

The IR structure should remain extensible so multiple programs can be added later without redesigning the canonical Ladder model.

### REQ-103 - Nested Branch Support in Canonical IR

The canonical Ladder IR must support nested branch structures from V1, including series and parallel logic nested inside other branches.

Adapter capability checks determine whether a particular nested structure can be exported to a selected PLC model/IDE. A target limitation must not force the core IR itself to lose nested-branch expressiveness.

### REQ-104 - PLC-Model-Level Capability Validation

Instruction and Ladder capability must be evaluated at the PLC-model level, not only at vendor or IDE level.

Validation and export must account for differences between PLC models in supported instructions, device ranges, operand behavior, special devices, and other relevant limitations.

### REQ-105 - Instruction Operand Constraints

The capability model must describe instruction-specific operand constraints sufficiently for validation.

Constraints may include operand count, accepted operand/device types, valid address ranges, constant or preset ranges, and PLC-model-specific restrictions.

### REQ-106 - Data-Driven PLC Capability Profiles

PLC capability rules must be represented through maintainable data/profile definitions rather than being scattered as hard-coded checks throughout the application.

Adding or refining support for a PLC model should primarily extend its capability profile and associated adapter behavior rather than require unrelated core rewrites.

### REQ-107 - Special Device Capability Metadata

PLC capability profiles must include supported special devices, such as Mitsubishi special relays/registers where applicable, together with their meaning and model-specific restrictions.

This information must be usable by both validation and AI-facing tooling so special devices are not treated as ordinary unrestricted addresses.

### REQ-108 - Explicit Timer and Counter Semantics

Timer and counter nodes must preserve semantic information needed to understand their behavior rather than storing only a textual form such as `T0 K10`.

Where applicable, the model/capability layer must represent concepts such as time base or unit, preset semantics, retentive behavior, counter range, and PLC-model-specific rules.

### REQ-109 - Typed Data Width and Signedness

Instructions whose behavior depends on data representation, including compare, arithmetic, and data-move operations, must preserve relevant data-width and signedness semantics where applicable.

Examples include distinctions such as WORD/DWORD and signed/unsigned behavior so validation and vendor conversion can detect incompatible operands or semantics.

### REQ-110 - Imported Source Mapping

When Ladder IR is created from an imported IDE interchange file, parsed nodes should retain traceability to their original source records, lines, or source fragments where practical.

Source mapping must support parser debugging, unsupported-node diagnostics, fidelity analysis, and round-trip POC investigation.

### REQ-111 - Versioned Ladder IR Schema and Migration

The canonical Ladder IR must include an explicit schema version.

When later releases introduce incompatible IR schema changes, the application must provide a migration path for previously persisted projects rather than assuming all stored projects already use the newest structure.

### REQ-112 - Validation Severity Levels

Validator results must use at least three severity levels: `ERROR`, `WARNING`, and `INFO`.

Each level must have a clear operational meaning. `ERROR` represents an invalid state that blocks the protected operation, `WARNING` identifies suspicious or potentially unsafe logic that may still be intentional, and `INFO` provides non-blocking diagnostic context.

### REQ-113 - Errors Block Apply and Export

Any current validation result containing one or more `ERROR` diagnostics must block Apply and Export until the error is resolved or the selected target/logic is changed so that validation passes.

Warnings and informational diagnostics do not block Apply/Export by default unless a more specific requirement or PLC capability rule says otherwise.

### REQ-114 - Duplicate Output Coil Detection

If the same output device is written by ordinary `OUT` coils in more than one location, the validator must report an `ERROR` by default because scan order can cause one write to override another.

A PLC capability profile may override the default only when the target explicitly supports a well-defined valid case.

### REQ-115 - SET Without RST Warning

If a device is written by `SET` and the validator cannot find a corresponding `RST` path for that device, the validator must emit a `WARNING`, not an automatic `ERROR`.

This recognizes that a permanently latched state may be intentional while still making the missing reset path visible to the user.

### REQ-116 - Multiple Writers Warning

If the same device is written from multiple locations or by mixed write semantics such as `OUT`, `SET`, `RST`, or equivalent instructions, the validator must emit a `WARNING` by default and identify every relevant writer and the scan-order implications.

Reading the same device as a contact does not count as an additional writer. A mixed-writer case becomes an `ERROR` only when the selected PLC capability profile defines the combination as invalid.

### REQ-117 - Impossible / Contradictory Condition Warning

If the validator can prove that a path contains contradictory conditions that cannot be simultaneously true, such as the same device used as both NO and NC in the same required series path, it must emit a `WARNING` and identify the affected network/path.

The condition does not automatically block Apply/Export because intentionally disabled logic may exist during development.

### REQ-118 - Invalid Device Address Is Error

If a device or address is outside the valid range or otherwise unsupported by the selected PLC model, the validator must emit an `ERROR` and block Apply/Export.

### REQ-119 - Unsupported Instruction Is Error

If an instruction is not supported by the selected PLC model or applicable capability profile, the validator must emit an `ERROR` and block Apply/Export.

### REQ-120 - Invalid Operand Type Is Error

If an instruction exists for the target PLC but an operand has an incompatible type, device class, width, or semantic category, the validator must emit an `ERROR` and block Apply/Export.

### REQ-121 - Invalid Operand Count Is Error

If an instruction has fewer or more operands than allowed by its typed instruction schema and PLC capability rules, the validator must emit an `ERROR` and block Apply/Export.

### REQ-122 - Invalid Timer / Counter Preset Is Error

Timer and counter presets that are negative where forbidden, outside the supported range, incompatible with the selected time base, or otherwise invalid for the selected PLC model must produce an `ERROR` and block Apply/Export.

### REQ-123 - Duplicate Timer / Counter Definition Warning

If the same timer or counter device, such as `T0` or `C0`, is defined or driven as a timer/counter from more than one location, the validator must emit a `WARNING` by default and identify all defining locations.

Using a timer/counter device as a contact or other read-only reference does not count as a duplicate definition.

### REQ-124 - Read-Only / Reserved Device Write Is Error

If an instruction attempts to write to a special device, reserved address, or system device that the selected PLC capability profile marks as read-only or non-writable, the validator must emit an `ERROR` and block Apply/Export.

### REQ-125 - Network Without Action Warning

If a Ladder network contains conditions but no executable destination/action such as a coil, timer, counter, or instruction, the validator must emit a `WARNING` and identify the affected network.

### REQ-126 - Invalid Ladder Topology Is Error

If Ladder topology is structurally incomplete or invalid, such as an unclosed branch, disconnected/floating node, incomplete path, or other structure that cannot be compiled into valid Ladder, the validator must emit an `ERROR` and block Apply/Export.

### REQ-127 - Always-ON Output Warning

If an output/action is directly driven by an always-true condition, such as an always-ON system relay for the selected PLC model, the validator must emit a `WARNING` explaining that the output may remain active for every scan while the PLC is in the relevant run state.

### REQ-128 - Unreachable Output Warning

If static analysis can determine that an output or action can never be activated by the current logic, the validator must emit a `WARNING` and identify the affected network/path.

### REQ-129 - Direct Feedback Loop Warning

If a device is both read as a condition and written as an output in a direct feedback pattern, the validator must emit a `WARNING` by default when the pattern is potentially suspicious.

The validator should distinguish recognized normal patterns, such as conventional self-holding/seal-in logic, from feedback loops that are more likely to be unintended. A normal self-holding pattern must not be treated as an error solely because the output device is also used as a contact.

### REQ-130 - Multiple Register Writers Warning

If multiple networks or instructions write the same register or data destination, the validator must emit a `WARNING` by default and identify all writer locations and relevant scan-order implications.

### REQ-131 - Overlapping Register Range Warning

If two write operations target overlapping memory ranges even when their starting addresses differ, the validator must emit a `WARNING` and identify the overlapping range.

For example, a DWORD write spanning `D100-D101` overlaps a separate write to `D101`.

### REQ-132 - Stable Validation Codes

Every validation diagnostic must include a stable machine-readable code in addition to severity and human-readable text.

Examples include codes such as `V_DUPLICATE_COIL` and `V_INVALID_ADDRESS`. Diagnostics should also carry enough location/context data for UI, AI tools, tests, Human Review, and logs to identify the relevant network, node, device, or instruction without parsing message text.

### REQ-133 - Manual Compile Validation

Manual Ladder editing must not run mandatory full validation automatically after every edit.

The user explicitly runs **Compile** when they want to validate the current project state. Before manual project state is eligible for Export, the latest successful compile result must correspond to the current logic revision.

AI proposal validation required by REQ-050 and integration validation required by REQ-068 remain automatic safety gates for their respective AI review/apply workflows.

### REQ-134 - Compile Result Invalidation on Logic Change

After a project compiles successfully, any subsequent logic-affecting Ladder change must immediately make that compile result stale.

A stale compile result must not be treated as evidence that the current logic is valid. The project must return to a `Compile Required` or equivalent state and must be compiled again before protected operations such as Export.

Metadata-only changes that do not affect Ladder execution semantics do not need to invalidate compile status unless the target format requires recompilation for that metadata.

### REQ-135 - Navigable Compile Diagnostics

Compile results must present a severity summary such as `0 Errors / 3 Warnings / 2 Info` and expose the individual diagnostics.

Each diagnostic should be navigable from the compile result UI to the affected network and, where possible, directly to the relevant node, device, instruction, or path.

### REQ-136 - Compile Run History

Each explicit Compile operation must create a compile-run history record rather than only replacing the previous result.

A compile-run record should include at least:

- Timestamp
- Project identity
- Project revision or content hash
- Selected PLC model/target
- Overall result such as PASS/FAIL
- Error, warning, and info counts
- Full diagnostic list with stable validation codes and locations
- User identity when user accounts exist

Compile history should reference the corresponding project revision rather than duplicating a complete Ladder snapshot for every compile when a revision/history record already provides that state.

---

## 4. Web Application Requirements

The web application is the V1 control center for project management, Ladder inspection/editing, AI review, validation, and export. It is **not intended to replace GX Works or SamSoar2022 as a complete PLC IDE**.

Initial web responsibilities:

- Show and switch between multiple projects
- Show project metadata and selected PLC model
- Navigate multiple Ladder networks inside a project
- Show Ladder preview
- Provide structured manual Ladder editing
- Autosave manual draft edits
- Provide an explicit Compile action using the shared validator
- Show compile state such as Compile Required, Passed, or Failed
- Invalidate the previous compile result after logic-affecting edits
- Provide undo/redo for manual editing
- Show generated or modified Ladder changes
- Display validation errors, warnings, and information
- Display navigable compile diagnostics
- Display before/after diff
- Approve or reject AI changes
- Browse version and compile history
- Undo/restore project versions
- Download/export generated PLC files only when required validation/compile gates pass

A full unrestricted IDE-style drag-and-drop Ladder canvas is not required for V1. Manual editing should operate through structured Ladder operations so the same Ladder model and validation rules can be shared with AI-driven changes.

---

## 5. Initial User Experience

Example AI-driven workflow:

### Step 1 - User asks the AI

> Use FX3U. When X1 turns ON, alternate Y2 and Y3 every one second.

### Step 2 - AI calls PLC-LadderMCP

The AI selects the PLC model and uses Ladder tools to create the required logic.

### Step 3 - Ladder Engine builds the project

The engine creates the structured Ladder model and target-specific project output.

### Step 4 - AI Proposal Validation

AI-generated proposals are validated before Human Review as required by REQ-050. Validation checks include:

- Invalid addresses
- Unsupported instructions
- Ladder structure errors
- PLC compatibility
- Logic warnings

### Step 5 - Preview / Manual Edit

The user can see the actual Ladder diagram in the web UI and may make supported structured manual edits. Draft edits may autosave without running a full compile after each edit.

When the user wants to validate the current manual project state, the user presses **Compile**. Any later logic change makes that compile result stale and requires another Compile before export.

### Step 6 - Review

The user sees:

- Ladder changes
- Devices used
- Validation/compile diagnostics
- Before/after diff

### Step 7 - Approval

The user approves AI-proposed changes when approval is required. Integration validation still runs automatically immediately before approved proposal changes are applied under REQ-068.

### Step 8 - Export

The user downloads or exports a project only after the current project state satisfies the required validation and compile gates.

---

## 6. Design Constraints

The project should follow these constraints.

### AI-independent

The system must not depend on a single AI provider.

Potential clients include:

- ChatGPT
- Codex
- Claude
- Local LLMs
- Other MCP-compatible agents

### Vendor-extensible

PLC vendor support should be adapter-based where possible.

Concept:

```text
                 Ladder Core
                     |
        +------------+------------+
        |                         |
 Mitsubishi Adapter        SamSoar Adapter
        |                         |
    GX Works                 SamSoar2022
```

### Deterministic Tool Operations

Critical Ladder editing should use deterministic structured tool calls.

Example:

```text
insert_rung(
  after = 12,
  conditions = [...],
  output = ...
)
```

rather than asking an LLM to manually rewrite proprietary project files.

### Shared Ladder Editing Semantics

AI-driven changes and manual web editing should operate on the same structured Ladder representation and share the same validation semantics where practical.

Manual editing does not require full validation after every edit; it invokes the shared validator through explicit Compile, while AI proposal/integration safety gates may invoke it automatically.

### Project Safety

Existing PLC projects must not be destructively modified without preserving a previous version.

---

## 7. Out of Scope for Initial Version

The following are not required for the first implementation:

- Complete replacement for GX Works
- Complete replacement for SamSoar2022
- Full PLC simulator
- Direct PLC online monitoring
- Direct Write-to-PLC
- Online editing of a running PLC
- Automatic control of real industrial equipment
- Full unrestricted IDE-style Ladder canvas
- Support for every PLC vendor
- Support for every PLC instruction
- Multi-user account management / RBAC
- AI usage quota management
- Automated scheduled PostgreSQL backups

These may be considered later.

---

## 8. Initial Scope Summary

The first useful version of PLC-LadderMCP should prove both AI-driven and manual web editing paths against the same Ladder model:

```text
Natural-language request                    Manual web edit
        |                                         |
        v                                         v
AI Agent                                    Structured Editor
        |                                         |
        v                                         v
MCP / Tool Interface                         Draft Project State
        |                                         |
        +-------------------+---------------------+
                            |
                            v
                  Structured Ladder Model
                            |
             +--------------+--------------+
             |                             |
             v                             v
     AI safety validation             Manual Compile
             |                             |
             +--------------+--------------+
                            |
                            v
                   Visual Ladder Preview
                            |
                            v
                          Export
                            |
                            v
               Open in GX Works / SamSoar2022
```

The V1 deployment path must additionally prove:

```text
GitHub
   |
   v
Jenkins
   |
   +--> build / test
   +--> container images
   v
GHCR
   |
   v
Kubernetes (kubeadm, single-node VPS)
   |
   +--> Frontend
   +--> Backend
   +--> PostgreSQL-backed durable state
   |
   v
Ingress + real domain + HTTPS
```

The key success criterion is:

> A user can ask an AI to create or modify PLC logic, or make supported structured edits manually in the web application, compile/validate the relevant project state, and receive a real Ladder project/output that can be used in a supported PLC IDE without manually redrawing AI-generated text.

---

## 9. Requirement Status

Current baseline:

- REQ-001 through REQ-021 are the accepted initial PLC-LadderMCP product requirements carried forward from the previous baseline.
- REQ-022 through REQ-035 record the V1 operating and deployment decisions confirmed during the requirements-grilling session.
- REQ-036 through REQ-042 record the V1 web-application decisions confirmed during the web requirements-grilling session. REQ-038 and REQ-040 were refined in Version 0.8 to reflect explicit manual Compile rather than full auto-validation on each edit.
- REQ-043 through REQ-057 record the import and Ladder-native Human Review decisions confirmed during requirement grooming.
- REQ-058 through REQ-079 record the AI change-batch, review lifecycle, rework, conflict, stale-proposal, cancellation/retry, and audit decisions confirmed during requirement grooming.
- REQ-080 through REQ-094 record the GX Works2 / SamSoar2022 round-trip POC, compatibility, unsupported-node preservation, fidelity, and PostgreSQL/PostgREST evidence-retention decisions confirmed during requirement grooming.
- REQ-095 through REQ-111 record the canonical Ladder IR, typed operand/instruction, stable identity, nested-branch, PLC capability-profile, timer/counter semantics, source-mapping, and schema-version decisions confirmed during requirement grooming.
- REQ-112 through REQ-136 record the validator severity model, PLC safety diagnostics, stable diagnostic codes, explicit manual Compile workflow, compile invalidation, navigable diagnostics, and compile-run history decisions confirmed during requirement grooming.
- GX Works2 and SamSoar2022 import are V1 targets but remain Pending POC until real IDE interchange experiments confirm the supported formats and fidelity.
- GX Works and SamSoar2022 are the first IDE targets.
- AI-first usage remains the primary workflow, while V1 also requires structured manual Ladder editing in the web application.
- MCP is the first preferred AI tool protocol, but the core architecture must remain protocol-independent.
- V1 Web acts as the Ladder project control center and supports project management, structured manual editing, explicit manual Compile, AI review/approval, diff, history, and export.
- V1 supports multiple projects and multiple Ladder networks per project.
- V1 uses a single `Main` Ladder program per project while keeping the IR extensible for multiple programs later.
- V1 is single-admin/personal-use and has no AI usage quota requirement.
- V1 deployment uses Jenkins, GHCR, Kubernetes, PostgreSQL, staging/production separation, and real-domain HTTPS.
- POC fixture files and run artifacts are retained in PostgreSQL and exposed through PostgREST, with append-only run history.
- Automated scheduled PostgreSQL backup is intentionally deferred from V1.

Further technical research is still required before locking down all project file formats, import/export mechanisms, IDE adapters, final capability-profile contents, and the detailed staging/production Kubernetes topology.
