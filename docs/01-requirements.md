# PLC-LadderMCP Requirements

**Document:** `docs/01-requirements.md`  
**Status:** Draft / Baseline  
**Version:** 0.4  
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

### REQ-038 - Automatic Validation for Manual Edits

Every manual Ladder edit in the web application must be validated automatically using the same validation rules used for AI-generated changes before that edit is committed as saved project state.

### REQ-039 - Web Undo / Redo

The V1 manual editor must provide undo and redo for editing actions so the user can safely reverse or reapply recent manual changes during an editing session.

### REQ-040 - Autosave

The V1 web application must autosave valid manual Ladder changes without requiring the user to press a Save button for each edit. Changes that fail required validation must not replace the last valid saved project state.

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

---

## 4. Web Application Requirements

The web application is the V1 control center for project management, Ladder inspection/editing, AI review, validation, and export. It is **not intended to replace GX Works or SamSoar2022 as a complete PLC IDE**.

Initial web responsibilities:

- Show and switch between multiple projects
- Show project metadata and selected PLC model
- Navigate multiple Ladder networks inside a project
- Show Ladder preview
- Provide structured manual Ladder editing
- Automatically validate manual edits using the shared validator
- Autosave valid edits
- Provide undo/redo for manual editing
- Show generated or modified Ladder changes
- Display validation errors and warnings
- Display before/after diff
- Approve or reject AI changes
- Browse version history
- Undo/restore project versions
- Download/export generated PLC files

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

### Step 4 - Validation

The project is checked for:

- Invalid addresses
- Unsupported instructions
- Ladder structure errors
- PLC compatibility
- Logic warnings

### Step 5 - Preview / Manual Edit

The user can see the actual Ladder diagram in the web UI and may make supported structured manual edits. Manual edits are automatically validated and valid changes are autosaved.

### Step 6 - Review

The user sees:

- Ladder changes
- Devices used
- Warnings
- Before/after diff

### Step 7 - Approval

The user approves AI-proposed changes when approval is required.

### Step 8 - Export

The user downloads or exports a project that can be used with GX Works or SamSoar2022.

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
        v                                         |
MCP / Tool Interface                             |
        |                                         |
        +-------------------+---------------------+
                            |
                            v
                  Structured Ladder Model
                            |
                            v
                        Validation
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

> A user can ask an AI to create or modify PLC logic, or make supported structured edits manually in the web application, and receive a real Ladder project/output that can be used in a supported PLC IDE without manually redrawing AI-generated text.

---

## 9. Requirement Status

Current baseline:

- REQ-001 through REQ-021 are the accepted initial PLC-LadderMCP product requirements carried forward from the previous baseline.
- REQ-022 through REQ-035 record the V1 operating and deployment decisions confirmed during the requirements-grilling session.
- REQ-036 through REQ-042 record the V1 web-application decisions confirmed during the web requirements-grilling session.
- REQ-043 through REQ-057 record the current import and Ladder-native Human Review decisions confirmed during requirement grooming.
- GX Works2 and SamSoar2022 import are V1 targets but remain Pending POC until real IDE interchange experiments confirm the supported formats and fidelity.
- GX Works and SamSoar2022 are the first IDE targets.
- AI-first usage remains the primary workflow, while V1 also requires structured manual Ladder editing in the web application.
- MCP is the first preferred AI tool protocol, but the core architecture must remain protocol-independent.
- V1 Web acts as the Ladder project control center and supports project management, structured manual editing, validation, AI review/approval, diff, history, and export.
- V1 supports multiple projects and multiple Ladder networks per project.
- V1 is single-admin/personal-use and has no AI usage quota requirement.
- V1 deployment uses Jenkins, GHCR, Kubernetes, PostgreSQL, staging/production separation, and real-domain HTTPS.
- Automated scheduled PostgreSQL backup is intentionally deferred from V1.

Further technical research is still required before locking down all project file formats, import/export mechanisms, IDE adapters, the exact Ladder intermediate representation, and the detailed staging/production Kubernetes topology.