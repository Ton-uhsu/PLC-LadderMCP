# PLC-LadderMCP Requirements

**Document:** `docs/01-requirements.md`  
**Status:** Draft / Baseline  
**Version:** 0.2  
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

The web application acts primarily as a supporting interface for:

- Ladder preview
- Project management
- Validation results
- Diff review
- Approval
- Version history
- Undo
- Download / Export

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

---

## 4. Web Application Requirements

A web application will be deployed from the GitHub project.

The web application is **not intended to replace GX Works or SamSoar2022**.

Initial web responsibilities:

- Show project list
- Show Ladder preview
- Show project metadata
- Show PLC model
- Show generated/modified rungs
- Display validation errors and warnings
- Display before/after diff
- Approve or reject AI changes
- Browse version history
- Undo/restore versions
- Download/export generated PLC files

A full drag-and-drop Ladder editor is not required for the initial version.

---

## 5. Initial User Experience

Example workflow:

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

### Step 5 - Preview

The user can see the actual Ladder diagram in the web UI.

### Step 6 - Review

The user sees:

- Ladder changes
- Devices used
- Warnings
- Before/after diff

### Step 7 - Approval

The user approves the change.

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
- Full Ladder drag-and-drop editor
- Support for every PLC vendor
- Support for every PLC instruction
- Multi-user account management / RBAC
- AI usage quota management
- Automated scheduled PostgreSQL backups

These may be considered later.

---

## 8. Initial Scope Summary

The first useful version of PLC-LadderMCP should prove this complete path:

```text
Natural-language request
        |
        v
AI Agent
        |
        v
MCP / Tool Interface
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

> A user can ask an AI to create or modify PLC logic and receive a real Ladder project/output that can be used in a supported PLC IDE without manually redrawing the Ladder from AI-generated text.

---

## 9. Requirement Status

Current baseline:

- REQ-001 through REQ-021 are the accepted initial PLC-LadderMCP product requirements carried forward from the previous baseline.
- REQ-022 through REQ-035 record the V1 operating and deployment decisions confirmed during the requirements-grilling session.
- GX Works and SamSoar2022 are the first IDE targets.
- AI-first usage is required.
- MCP is the first preferred AI tool protocol, but the core architecture must remain protocol-independent.
- Web UI is a management, preview, review, and export interface rather than the primary Ladder authoring interface.
- V1 is single-admin/personal-use and has no AI usage quota requirement.
- V1 deployment uses Jenkins, GHCR, Kubernetes, PostgreSQL, staging/production separation, and real-domain HTTPS.
- Automated scheduled PostgreSQL backup is intentionally deferred from V1.

Further technical research is still required before locking down all project file formats, import/export mechanisms, IDE adapters, the exact Ladder intermediate representation, and the detailed staging/production Kubernetes topology.
