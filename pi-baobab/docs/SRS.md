# Software Requirements Specification
## Interactive Reasoning Control and Scoped Model Adaptation Platform

| Document property | Value |
|---|---|
| Document type | Software Requirements Specification (SRS) |
| Version | 0.4.1 |
| Status | Approved baseline with benchmark amendment |
| Approval | The owner approved version 0.3.0. Version 0.4.0 adds the requested benchmark requirements. Version 0.4.1 adds the requested progress tracker. |
| Implementation progress | See [overall implementation status](#211-overall-implementation-status) in section 21.1. |
| Implementation environment | Local Windows system with Codex |
| Architecture | Pi, Baobab, TypeScript, Python |
| Writing standard | ASD-STE100 Simplified Technical English |
| Primary verification method | Functional requirement testing |

# 1. Introduction

## 1.1 Purpose

This document specifies the requirements for an interactive reasoning control and model adaptation platform.

The platform shall let users examine, select, modify, and evaluate reasoning that a language model generates.

The platform shall collect user feedback and verified results as training data. The platform shall use this data to improve subsequent model behavior.

The platform shall support independent training scopes. A training scope shall control the data, training operations, and model adapters available to an authorized user.

The platform shall also let an independently running teacher agent control the reasoning of a student model. The platform shall support autonomous fine-tuning of the student model with authorized teacher feedback.

## 1.2 Objectives

The platform has these objectives:

- Give users control of model reasoning before the model completes a response.
- Generate alternative reasoning paths from a common context.
- Let users correct incorrect or inefficient reasoning.
- Preserve reasoning paths and their associated evidence.
- Convert approved human and teacher feedback into training data.
- Let a separate teacher agent guide a student model without continuous human input.
- Support local model adaptation with limited hardware resources.
- Support independent model adapters for different training scopes.
- Preserve the original model weights.
- Prevent unauthorized access to training data.
- Prevent unapproved tool execution.
- Verify software behavior through functional tests.
- Minimize unnecessary software complexity.

## 1.3 System boundary

The platform includes these components:

| Component | Responsibility |
|---|---|
| Baobab interface | Graphical reasoning control and training management |
| Pi extension | Integration with the Pi agent runtime |
| Reasoning controller | Generation, selection, modification, and continuation of reasoning paths |
| Inference adapter | Communication with an inference engine |
| Feedback recorder | Collection of human decisions, teacher decisions, and execution results |
| Teacher agent interface | Authorized control of student reasoning by an independent agent |
| Scope manager | Management of training scope and access permissions |
| Dataset manager | Preparation and validation of training data |
| Training engine | Model adaptation and reward model training |
| Evaluation engine | Measurement of model capability and inference performance with gBench and independent evaluation data |
| Adapter manager | Storage, selection, deployment, and removal of model adapters |

The platform shall reuse existing Pi and Baobab functions where those functions satisfy the requirements.

The platform shall not implement a replacement inference engine unless an existing inference engine cannot satisfy a required function.

## 1.4 Requirements terminology

The word **shall** identifies a mandatory requirement.

The word **should** identifies a preferred requirement.

The word **may** identifies a permitted function.

Each requirement has a unique identifier. Requirement identifiers shall identify requirements only.

Requirement identifiers shall not determine software names, file names, class names, function names, or other implementation names.

## 1.5 Definitions

| Term | Definition |
|---|---|
| Language model | A model that generates text or other structured output from input tokens |
| Inference | The operation that uses a model to generate output |
| Token | A unit of model input or output |
| Context | The information available to the model during inference |
| Reasoning trace | Reasoning text that the model makes available to the platform |
| Reasoning branch | An independent continuation from a specified context |
| Reasoning step | A recorded part of a reasoning trace |
| Checkpoint | A recorded position from which the platform can request continuation |
| Feedback | A human or automated decision about model behavior |
| Teacher agent | An independently running AI agent that examines and controls student reasoning |
| Student model | The language model that receives reasoning guidance and adaptation |
| Teaching session | A controlled operation in which a teacher agent guides a student model |
| Knowledge distillation | Training a student model with examples or signals from a teacher model |
| Base model | The original model before adaptation |
| Model weights | Numerical parameters that determine model behavior |
| Fine-tuning | Training that changes model behavior for a specified purpose |
| Low-Rank Adaptation (LoRA) | A method that trains additional parameters without changing the base model weights |
| Adapter | A set of trained parameters that changes base model behavior |
| Quantization | A method that represents model parameters with reduced numerical precision |
| Quantized Low-Rank Adaptation (QLoRA) | LoRA training that uses a quantized base model |
| Supervised Fine-Tuning (SFT) | Training that uses examples of preferred model output |
| Direct Preference Optimization (DPO) | Training that uses preferred and rejected output pairs |
| Process Reward Model (PRM) | A model that assigns scores to intermediate reasoning steps |
| Group Relative Policy Optimization (GRPO) | A reinforcement learning method that compares rewards across a group of generated outputs |
| Reward | A numerical value that represents an evaluation result |
| Training scope | A defined boundary for training data, permissions, and model adapters |
| Dataset | A collection of records for training or evaluation |
| Provenance | Information that identifies the source and history of a record |
| Key-value cache (KV cache) | Stored attention data that an inference engine can reuse |
| Application Programming Interface (API) | A defined interface for communication between software components |
| Graphical User Interface (GUI) | An interface that uses graphical controls |
| Terminal User Interface (TUI) | An interface that uses a terminal |
| Graphics Processing Unit (GPU) | A processor that supports parallel calculations |
| Video Random Access Memory (VRAM) | Memory available to a GPU |
| Continuous Integration (CI) | Automated software verification after source changes |
| Regression | A reduction in previously verified software or model behavior |
| Benchmark | A defined set of tasks or workloads with a specified measurement procedure |
| Baseline | A recorded result that supplies a reference for comparison |
| gBench | The Google DeepMind benchmark suite for model capability and serving performance |
| Serving performance | The rate and time at which an inference server processes requests |
| Smoke test | A small set of checks for basic operation failures |
| Held-out data | Evaluation data that does not enter training or teacher guidance |
| Percentage point | The arithmetic difference between two percentages |

Reasoning traces do not necessarily represent all internal model calculations.

# 2. Architecture Requirements

## 2.1 Application architecture

**ARC-001 — Pi integration**

The platform shall integrate with Pi through its supported extension interfaces.

**ARC-002 — Baobab integration**

The platform shall use Baobab as the primary graphical interface.

The platform shall preserve existing Baobab functions that satisfy this specification.

**ARC-003 — Application language**

The Pi extension and graphical application shall use TypeScript.

**ARC-004 — Training language**

The training engine shall use Python.

**ARC-005 — Native computation**

The platform shall use existing native libraries for computationally intensive GPU operations.

**ARC-006 — Separation of responsibilities**

The platform shall separate application control, inference, training, evaluation, and adapter management.

**ARC-007 — Inference independence**

The platform shall not require changes to the graphical interface to support an additional inference engine.

**ARC-008 — Training independence**

The platform shall not require changes to reasoning data when the training engine changes.

**ARC-009 — Local operation**

The platform shall support local operation without a remote service.

**ARC-010 — Optional remote services**

The platform may support remote inference and remote training.

The platform shall not transmit local data without authorization.

**ARC-011 — Existing functions**

The platform shall use existing Pi functions for agent execution, context management, and session management when applicable.

**ARC-012 — Communication**

The platform shall use a documented interface for communication between TypeScript and Python components.

The interface shall support structured requests, results, errors, and cancellation.

**ARC-013 — Source ownership**

Each persistent record type shall have one authoritative source.

The platform shall not maintain unnecessary independent copies of authoritative records.

**ARC-014 — Implementation simplicity**

The implementation shall use the minimum number of components necessary to satisfy the requirements.

New dependencies shall have a documented technical purpose.

**ARC-015 — Dependency licenses**

The project shall identify the applicable licenses of reused software.

The project shall resolve redistribution restrictions before publication.

## 2.2 Local development environment

The owner uses the locally installed Codex coding agent to implement this specification. Codex is a development tool. It is not a required runtime dependency or the required teacher agent.

The owner supplies the following installed tools and local resources. The project shall verify their availability and versions on the local system before it uses them.

| Tool or resource | Owner-specified configuration |
|---|---|
| Codex | Installed locally. Use for implementation and verification. |
| Pi agent | Installed through Bun, a JavaScript runtime and package manager. |
| Unsloth | Installed locally with downloaded models. Use for initial model training. |
| llama.cpp | Installed at `D:\llama.cpp\llama`. Use for initial student inference and adapter deployment. |
| Local model storage | `F:\Users\Akash\Documents\huggingface\hub` |
| Reference model | Gemma 2B, a Gemma model with approximately two billion parameters. Use for local implementation and routine model-dependent functional tests. |
| gBench | Existing local source checkout at `D:\projects\gbench`. Use for model capability and serving performance benchmarks. |

**ARC-016 — Installed tool reuse**

The project shall use the installed Pi agent, Unsloth, and llama.cpp for initial implementation and local verification.

The project shall not reinstall, upgrade, or replace these tools without a documented technical necessity and owner authorization.

**ARC-017 — Local environment verification**

Before implementation depends on an installed tool, the project shall identify its version, executable location or Python environment, and supported interfaces.

The project shall check that the Pi agent installed through Bun can load the extension.

The project shall identify the llama.cpp executables in the specified installation and verify the Unsloth training environment.

The project shall record missing functions or incompatible versions as open conditions.

**ARC-018 — Configurable local paths**

The platform shall support the owner-specified llama.cpp and model storage paths through configuration.

The platform shall not require these absolute paths on other systems.

The project shall document how to set or change the paths.

**ARC-019 — Local model reuse**

The project shall examine the existing local model storage before it requests a model download.

The project shall use compatible local model files where available.

The project shall request owner authorization before it downloads additional model weights or replaces existing model files.

**ARC-020 — Initial integration boundary**

The project shall implement and verify llama.cpp student inference and Unsloth training before it starts integration of other inference or training engines.

The project shall keep the existing interfaces independent of a specific engine.

The project shall not add speculative engine adapters, dependencies, or tests for deferred integrations.

The external teacher-agent interface remains in scope. It shall not require another student inference engine.

**ARC-021 — Local benchmark reuse**

The project shall use the existing gBench checkout at `D:\projects\gbench`.

The platform shall let the user configure this path.

The project shall verify the checkout revision, Python environment, dependencies, and applicable benchmark functions.

The project shall not clone another copy or update the checkout without owner authorization.

The project shall use gBench with the installed llama.cpp server. This operation shall not require integration of another inference engine.

The project shall not replace the installed Unsloth training environment to satisfy gBench dependencies.

# 3. Pi Integration Requirements

**PI-001 — Extension installation**

The platform shall support installation as a Pi extension.

**PI-002 — Normal operation**

The platform shall preserve normal Pi operation when interactive reasoning control is disabled.

**PI-003 — Session synchronization**

The platform shall synchronize relevant Pi session events with the graphical interface.

**PI-004 — Context preservation**

The platform shall preserve the applicable Pi context when it generates reasoning branches.

**PI-005 — Session association**

Each reasoning branch shall identify its associated Pi session.

**PI-006 — Branch selection**

The platform shall synchronize an approved reasoning continuation with the applicable Pi session.

**PI-007 — Existing tools**

The platform shall support tools that Pi makes available to the active session.

**PI-008 — Tool permissions**

The platform shall preserve the existing permissions of the Pi session.

The platform shall not increase tool permissions without authorization.

**PI-009 — Extension controls**

The platform shall let the user perform these operations from Pi:

- Enable interactive reasoning.
- Disable interactive reasoning.
- Open the graphical interface.
- Configure branch generation.
- Stop branch generation.
- Select the active training scope.
- Examine the active adapter.

**PI-010 — Session recovery**

The platform shall restore its association with persistent Pi sessions after a restart.

**PI-011 — Interface independence**

The platform shall preserve Pi operation when the graphical interface disconnects.

The platform shall apply the configured policy when user approval is necessary.

The default policy shall prevent unapproved continuation.

# 4. Interactive Reasoning Requirements

## 4.1 Reasoning generation

**RSN-001 — Candidate generation**

The platform shall generate a configurable number of reasoning branches from a common context.

**RSN-002 — Generation limits**

The platform shall let the user configure these limits:

- Number of reasoning branches.
- Tokens per branch.
- Maximum generation time.
- Maximum total generated tokens.
- Maximum concurrent branches.
- Maximum reasoning depth.

**RSN-003 — Generation parameters**

The platform shall support configuration of generation parameters that the inference engine makes available.

These parameters may include temperature, random seed, and token probability limits.

**RSN-004 — Independent generation**

Each reasoning branch shall have an independent generation state.

A branch shall not modify the generation state of another branch.

**RSN-005 — Concurrent generation**

The platform shall support concurrent branch generation when the inference engine supports this function.

**RSN-006 — Sequential generation**

The platform shall support sequential branch generation when hardware or inference engine limits prevent concurrent generation.

**RSN-007 — Partial generation**

The platform shall support reasoning checkpoints before the model completes its response.

**RSN-008 — Generation status**

The platform shall display the state of each reasoning branch.

The platform shall distinguish these states:

| State | Meaning |
|---|---|
| Pending | Generation does not start |
| Active | The model generates output |
| Paused | Generation stops at a checkpoint |
| Complete | Generation reaches its specified end |
| Approved | A user or authorized policy authorizes the branch |
| Rejected | The user rejects the branch |
| Cancelled | The user or system cancels generation |
| Failed | An error prevents completion |

**RSN-009 — Incremental output**

The platform shall display reasoning text as the inference engine supplies the text.

**RSN-010 — Reasoning availability**

The platform shall identify when an inference engine does not expose reasoning text.

The platform shall not represent generated summaries as original reasoning traces.

## 4.2 Reasoning control

**RSN-011 — Branch selection**

The platform shall let the user select any available reasoning branch.

**RSN-012 — Branch rejection**

The platform shall let the user reject a reasoning branch.

**RSN-013 — Branch retention**

The platform shall let the user retain an unselected branch for subsequent examination.

**RSN-014 — Reasoning modification**

The platform shall let the user modify reasoning text when the inference interface permits modification.

**RSN-015 — Guidance insertion**

The platform shall let the user insert additional instructions at a specified reasoning checkpoint.

**RSN-016 — Reasoning truncation**

The platform shall let the user remove the continuation after a specified checkpoint.

The platform shall preserve the original reasoning trace for comparison.

**RSN-017 — Continuation**

The platform shall continue generation from an approved reasoning checkpoint.

The platform shall identify the continuation method.

**RSN-018 — Continuation methods**

The platform shall distinguish these continuation methods:

- Restoration of inference state.
- Generation from a supplied reasoning prefix.
- Generation from user guidance in the conversation context.

The platform shall not identify these methods as equivalent.

**RSN-019 — Recursive branching**

The platform shall let the user generate additional branches from an existing reasoning checkpoint.

**RSN-020 — Branch comparison**

The platform shall let the user compare reasoning branches from a common context.

**RSN-021 — Branch synthesis**

The platform shall support generation of a new branch from selected information in multiple branches.

The platform shall preserve the source branch identifiers.

**RSN-022 — Original data preservation**

The platform shall preserve the original model output separately from user modifications.

**RSN-023 — Reasoning completion**

The platform shall let the user authorize the model to complete its response.

**RSN-024 — Control modes**

The platform shall support these control modes:

| Mode | Behavior |
|---|---|
| Disabled | Normal Pi operation |
| Manual | The user selects and approves reasoning branches |
| Assisted | The platform recommends branches. The user approves a branch. |
| Automatic | The platform selects branches under an authorized policy |
| Teacher-guided | A separate teacher agent controls reasoning under an authorized policy |

**RSN-025 — Manual interruption**

The platform shall let the user interrupt automatic reasoning control.

**RSN-026 — Cancellation**

The platform shall let the user cancel an active reasoning operation.

The platform shall release resources that the cancelled operation no longer uses.

## 4.3 Independent teacher-agent control

**TCH-001 — Independent agent**

The platform shall let a teacher agent run in a process or agent session separate from the student agent.

The platform shall not require the teacher agent to use Pi or the student inference engine.

**TCH-002 — Model selection**

The platform shall let the user select different models for the teacher and student.

The platform shall support a larger or more capable teacher model and a smaller local student model.

The platform shall not assume that a larger model produces correct results.

**TCH-003 — Connection**

The platform shall provide a documented, machine-readable API for teacher agents.

The API shall support local connections. It shall support remote connections when the user authorizes them.

The platform shall let an external agent connect to an existing student session or start an authorized teaching session.

**TCH-004 — Shared control functions**

The teacher interface shall use the same reasoning controller and permission checks as the human interfaces.

The platform shall not require a graphical interface or human input for each authorized teacher operation.

**TCH-005 — Student observations**

The platform shall let the teacher examine the authorized task context, reasoning branches, checkpoints, generation status, and tool results.

The platform shall identify reasoning text that is not available.

The teacher shall not receive protected data outside its authorized scope.

**TCH-006 — Teacher operations**

The platform shall let an authorized teacher request these operations:

- Generate one or more reasoning branches.
- Pause or cancel generation.
- Examine and compare branches.
- Select, retain, or reject a branch.
- Label reasoning steps.
- Modify a reasoning prefix when the inference interface permits modification.
- Insert guidance at a specified checkpoint.
- Return to a checkpoint and generate alternatives.
- Continue or complete student reasoning.
- Submit preferences, corrections, and outcome evaluations.

The platform shall apply RSN-018 and INF-004 to teacher operations.

**TCH-007 — Interactive operation**

The platform shall make student reasoning checkpoints available to the teacher before the student completes its response.

The platform shall let the teacher intervene at multiple checkpoints in the same response.

The platform shall not require generation of a complete response before each intervention.

**TCH-008 — Teacher decisions**

The teacher shall supply structured decisions that identify the target session, branch, checkpoint, requested operation, and reason for the decision.

The platform shall reject invalid, stale, or unauthorized decisions.

**TCH-009 — Control ownership**

The platform shall permit only one active controller to change a student session at a time.

An authorized user shall be able to take control from the teacher at any time.

The platform shall reject teacher commands from an earlier control period after the user takes control.

**TCH-010 — Authorization policy**

The platform shall require an authorized policy before a teacher starts an autonomous teaching session.

The policy shall specify the permitted scopes, models, tasks, reasoning operations, tools, and training operations.

The policy shall specify which decisions require human approval.

The teacher shall not be able to change this policy.

**TCH-011 — Teaching limits**

The platform shall enforce configurable limits for each teaching session.

These limits shall include task count, branch count, reasoning depth, total tokens, duration, retries, training iterations, and cost when applicable.

The platform shall stop or pause the session when it reaches a limit.

**TCH-012 — Teaching objectives**

The platform shall let an authorized user specify tasks, learning objectives, and acceptance criteria for the student.

The teacher may propose additional tasks within these limits.

The platform shall distinguish generated tasks from tasks that the user supplies.

**TCH-013 — Correction and continuation**

The platform shall let the teacher identify the first incorrect or unsupported reasoning step and supply a correction.

The platform shall preserve the original student output.

The platform shall record subsequent student output separately from the teacher correction.

**TCH-014 — Evidence**

The platform shall let the teacher examine actual execution evidence and request authorized verification operations.

The platform shall not represent a teacher judgment as proof of correctness.

The platform shall mark uncertain or contradictory evaluations for review or exclusion.

**TCH-015 — Tool restrictions**

Teacher approval shall authorize a state-changing tool operation only when the applicable policy permits that operation.

The platform shall enforce TOOL-001 through TOOL-009 for teacher-guided sessions.

The teacher shall not bypass the student tool permissions.

**TCH-016 — Connection failure**

The platform shall pause teacher-controlled continuation when the teacher disconnects or fails to respond within the specified time.

The platform shall preserve available student output and feedback.

The platform shall not silently authorize a pending operation.

**TCH-017 — Recovery**

The platform shall let an authorized user reconnect a teacher or resume a compatible teaching session.

The platform shall recheck permissions, remaining limits, and checkpoint identity before continuation.

Repeated commands shall not cause duplicate tool execution or duplicate training operations.

**TCH-018 — Operation without a teacher**

The platform shall preserve manual, assisted, and automatic reasoning modes when no teacher connects.

**TCH-019 — Teacher identity**

The platform shall record the teacher agent identity, model identity, applicable configuration, and policy version for each teaching session.

The platform shall preserve the association with the student model, adapter version, scope, and task.

**TCH-020 — Human supervision**

The platform shall let authorized users examine, pause, cancel, and resume a teaching session.

The platform shall let users reject or correct teacher feedback before it enters a dataset.

**TCH-021 — Data transmission**

The platform shall check scope permissions before it sends data to a teacher.

The platform shall apply the configured data minimization and remote transmission policies.

The platform shall not send student credentials or unrestricted workspace contents to the teacher.

**TCH-022 — Interface independence**

The platform shall verify the teacher API with a separately running agent.

The platform shall permit other agent harnesses to use the documented interface without changes to the student reasoning controller.

# 5. Inference Requirements

## 5.1 Inference engine integration

**INF-001 — Initial inference engine**

The platform shall use the locally installed llama.cpp as the initial student inference engine.

The project shall verify the applicable functions with the installation in section 2.2.

**INF-002 — Additional inference engines**

The architecture shall permit support for additional inference engines.

Integration of the following student inference engines is deferred until the project satisfies the initial integration acceptance conditions in section 23.7:

- NInfer.
- TensorFold.
- vLLM.
- Generic OpenAI-compatible inference interfaces.
- Other local or remote inference engines.

This deferral does not prevent the project from using the API of the installed llama.cpp server. It does not defer the independent teacher-agent interface.

**INF-003 — Capability identification**

The platform shall identify the functions available through each inference interface.

The platform shall distinguish these capabilities:

| Capability | Description |
|---|---|
| Reasoning access | Access to model reasoning text |
| Partial generation | Generation that stops before response completion |
| Prefix continuation | Generation from supplied partial output |
| State restoration | Restoration of a recorded inference state |
| Parallel generation | Concurrent generation of independent branches |
| Cache sharing | Reuse of applicable inference data across branches |
| Adapter loading | Application of trained model adapters |
| Cancellation | Termination of an inference operation |

**INF-004 — Unsupported operations**

The platform shall prevent operations that the active inference interface does not support.

The platform shall display the applicable limitation.

**INF-005 — Compatibility records**

The platform shall maintain a compatibility record for each supported inference engine and version.

## 5.2 Context and inference state

**INF-006 — Context reuse**

The platform shall reuse previously calculated inference data when the inference engine permits reuse.

**INF-007 — Cache sharing**

The platform shall share common context data between branches when the inference engine supports cache sharing.

**INF-008 — Checkpoint restoration**

The platform shall support restoration of recorded inference state when the inference engine exposes this function.

**INF-009 — State invalidation**

The platform shall invalidate inference state after the first changed token.

The platform shall preserve valid inference state before that token when the inference engine permits preservation.

**INF-010 — State compatibility**

The platform shall check model, tokenizer, adapter, and inference configuration compatibility before state restoration.

**INF-011 — State reconstruction**

The platform shall reconstruct context when it cannot restore the necessary inference state.

The platform shall identify when reconstruction occurs.

**INF-012 — Resource limits**

The platform shall prevent new inference operations when available resources are insufficient.

**INF-013 — Context capacity**

The platform shall permit configuration of context capacity up to the limits of the model and inference engine.

**INF-014 — Long-context target**

The platform shall support configuration of 131,072-token and 262,144-token contexts on compatible inference engines.

The platform shall not claim verified support until functional tests establish support.

**INF-015 — Hardware configuration**

The platform shall permit selection of inference devices that the inference engine makes available.

**INF-016 — Model identity**

Each reasoning operation shall identify the model and adapter versions that produce its output.

**INF-017 — State isolation**

The platform shall prevent unauthorized reuse of inference state between training scopes.

The platform shall invalidate incompatible state after an adapter change.

# 6. Tool Execution Requirements

**TOOL-001 — Default restrictions**

The platform shall prevent state-changing tool execution in unapproved reasoning branches.

**TOOL-002 — Read-only operations**

The platform may permit read-only tool execution in candidate branches under an authorized policy.

**TOOL-003 — Tool approval**

The platform shall let the user approve a branch before that branch performs state-changing operations.

An authorized teacher policy may approve specified operations without individual human approval. TCH-015 shall apply.

**TOOL-004 — Permission enforcement**

Tool approval shall not override Pi permissions or operating system restrictions.

**TOOL-005 — Tool records**

The platform shall record these data for each tool operation:

- Tool identity.
- Associated reasoning branch.
- Input.
- Result.
- Execution status.
- Applicable authorization.

Sensitive data shall follow the applicable retention policy.

**TOOL-006 — Branch isolation**

An unapproved branch shall not modify the persistent state of another branch.

**TOOL-007 — Execution evidence**

The platform shall associate applicable build results, test results, and execution records with the originating reasoning branch.

**TOOL-008 — Result accuracy**

The platform shall distinguish tool output from model-generated descriptions of tool output.

**TOOL-009 — External changes**

The platform shall not represent a reasoning rollback as a reversal of external changes.

The platform shall identify external changes that remain after branch rejection.

# 7. Training Scope Requirements

## 7.1 Scope definition

**SCP-001 — Independent scopes**

The platform shall support multiple independent training scopes.

**SCP-002 — Scope types**

The platform shall support these scope types:

| Scope type | Purpose |
|---|---|
| Global | General model behavior |
| Personal | Preferences and knowledge for one user |
| Organization | Behavior for an organization |
| Team | Shared behavior for a team |
| Workspace | Behavior for a collection of related resources |
| Project | Project-specific knowledge and procedures |
| Repository | Repository-specific behavior |
| Custom | A user-defined training boundary |

**SCP-003 — Scope identity**

Each training scope shall have a unique persistent identifier.

A change to a scope name shall not change its identifier.

**SCP-004 — Scope metadata**

Each training scope shall contain these data:

- Scope identifier.
- Scope type.
- Display name.
- Owner.
- Authorized members.
- Parent relationships, if applicable.
- Data access policy.
- Training policy.
- Adapter policy.
- Retention policy.

**SCP-005 — Scope relationships**

The platform shall support parent and child relationships between training scopes.

**SCP-006 — Independent relationships**

The platform shall support scopes that do not have a parent scope.

The platform shall not require all scope types to use a fixed hierarchy.

**SCP-007 — Relationship validation**

The platform shall prevent circular parent relationships.

**SCP-008 — Scope association**

The platform shall let authorized users associate workspaces, projects, repositories, and Pi sessions with training scopes.

## 7.2 Scope selection

**SCP-009 — Automatic scope identification**

The platform shall identify a training scope from an authorized resource association.

**SCP-010 — Manual scope selection**

The platform shall let an authorized user select a training scope manually.

**SCP-011 — Scope ambiguity**

The platform shall request scope selection when multiple incompatible scope associations apply.

**SCP-012 — Active scope display**

The platform shall display the active scope during reasoning, data collection, training, and inference.

**SCP-013 — Unassigned sessions**

The platform shall not add records from an unassigned session to a shared training scope.

**SCP-014 — Scope change**

The platform shall apply scope changes to subsequent operations.

The platform shall not change the recorded scope of existing data without authorization.

**SCP-015 — Operation scope**

Each training operation shall identify its target scope before execution.

The platform shall preserve this association for the complete operation.

## 7.3 Data isolation and access

**SCP-016 — Scope isolation**

The platform shall prevent unauthorized access to data from another training scope.

**SCP-017 — Independent permissions**

The platform shall support independent permissions for these operations:

- Examine scope data.
- Collect feedback.
- Modify dataset records.
- Approve training data.
- Start training.
- Evaluate adapters.
- Approve adapters.
- Deploy adapters.
- Export data or adapters.
- Manage scope membership.
- Delete scope data.

**SCP-018 — Access enforcement**

The platform shall enforce access permissions in the authoritative application component.

The platform shall not rely on graphical interface restrictions alone.

**SCP-019 — Default inheritance policy**

The platform shall disable cross-scope training data inheritance by default.

**SCP-020 — Authorized inheritance**

The platform shall let an authorized owner enable data inheritance from specified source scopes.

**SCP-021 — Inheritance direction**

The platform shall define the permitted direction of data inheritance.

A parent relationship shall not automatically authorize access in either direction.

**SCP-022 — Sibling isolation**

The platform shall prevent implicit data sharing between scopes that have the same parent.

**SCP-023 — Data transfer**

The platform shall let authorized users transfer approved training records between scopes.

The platform shall preserve source provenance.

**SCP-024 — Explicit promotion**

The platform shall require authorization before it promotes project-specific feedback to a shared or global scope.

**SCP-025 — Derived data restrictions**

The platform shall apply scope restrictions to generated datasets, adapters, reward models, and evaluation artifacts.

**SCP-026 — Scope removal**

The platform shall support removal of a training scope.

The platform shall identify dependent datasets, adapters, and active operations before removal.

**SCP-027 — Permission changes**

The platform shall enforce permission changes on subsequent access requests.

The platform shall identify derived artifacts that require additional review.

**SCP-028 — Training lineage**

The platform shall record all source scopes that contribute data to a training operation.

The platform shall preserve this lineage in the resulting adapter.

## 7.4 Scoped model adaptation

**SCP-029 — Scope-specific adapters**

The platform shall support independent LoRA adapters for each training scope.

**SCP-030 — Multiple adapters**

The platform shall support multiple adapter versions and purposes within one training scope.

**SCP-031 — Independent training**

The platform shall let authorized users train a scope-specific adapter without changing adapters in unrelated scopes.

**SCP-032 — Scope-specific preferences**

The platform shall support independent training objectives for different scopes.

Examples include:

| Scope | Example training objective |
|---|---|
| Personal | Preferred reasoning and response behavior |
| Team | Team engineering practices |
| Workspace | Shared workflows across multiple projects |
| Project | Project requirements and architecture |
| Repository | Repository conventions and implementation practices |
| Global | General reasoning quality |

**SCP-033 — Adapter inheritance**

The platform shall support authorized use of adapters from parent scopes.

The platform shall check permissions and adapter compatibility before use.

**SCP-034 — Adapter composition**

The platform may combine multiple compatible adapters when the inference engine supports adapter composition.

The platform shall not combine incompatible adapters.

**SCP-035 — Adapter precedence**

The platform shall use an explicit policy to resolve competing adapter selections.

The platform shall display the selected adapters and their applicable weights.

**SCP-036 — Conflict resolution**

The platform shall prevent ambiguous adapter activation.

The platform shall require a selection or a documented resolution policy.

**SCP-037 — Scope-specific evaluation**

The platform shall evaluate a scope-specific adapter against evaluation data applicable to that scope.

**SCP-038 — Scope-specific deployment**

The platform shall restrict adapter deployment to authorized scopes.

**SCP-039 — Scope-specific rollback**

The platform shall let authorized users restore an earlier adapter version for a specified scope.

**SCP-040 — No implicit global modification**

Training within a specific scope shall not modify the global adapter or base model.

**SCP-041 — Scope export**

The platform shall support authorized export of scope-specific datasets and adapters.

**SCP-042 — Derived artifact review**

Removal of training data shall not constitute removal of its influence from existing adapters.

The platform shall identify affected adapters for retirement or retraining.

# 8. Feedback and Training Data Requirements

## 8.1 Feedback collection

**FDB-001 — Feedback recording**

The platform shall record authorized human and teacher feedback about reasoning branches.

**FDB-002 — Preference feedback**

The platform shall support selection of preferred and rejected reasoning branches.

**FDB-003 — Correction feedback**

The platform shall support correction of individual reasoning steps and complete reasoning traces.

**FDB-004 — Step evaluation**

The platform shall let the user assign these labels to a reasoning step:

- Correct.
- Incorrect.
- Unsupported.
- Unnecessary.
- Incomplete.
- Not evaluated.

**FDB-005 — Outcome evaluation**

The platform shall record whether a reasoning branch produces the required result.

**FDB-006 — Feedback explanation**

The platform shall let the user supply an explanation for a feedback decision.

**FDB-007 — Feedback sources**

The platform shall distinguish these sources:

- Human evaluation.
- Automated evaluation.
- Tool execution results.
- Model-generated evaluation.
- Teacher-agent evaluation.
- External evaluation.

**FDB-008 — Feedback revision**

The platform shall let authorized users revise feedback.

The platform shall preserve the revision history.

**FDB-009 — Feedback consent**

The platform shall let users control whether their reasoning interactions become training data.

**FDB-010 — Evaluation independence**

The platform shall not represent human preference or teacher preference as proof of technical correctness.

**FDB-011 — Feedback attribution**

Each feedback record shall identify its source and applicable training scope.

## 8.2 Training records

**DAT-001 — Record contents**

Each training record shall contain applicable data from these categories:

| Category | Required information |
|---|---|
| Identity | Record identifier and creation time |
| Scope | Scope identifier and access policy |
| Model | Base model and adapter versions |
| Context | Prompt and applicable context |
| Reasoning | Original reasoning trace |
| Correction | Human or teacher modifications and guidance |
| Teacher | Teacher identity, model, policy, decision, and evidence references, when applicable |
| Branch | Parent branch and checkpoint identifiers |
| Preference | Preferred and rejected outputs |
| Outcome | Verified result and evidence references |
| Configuration | Applicable generation parameters |
| Provenance | Source, revision history, and authorization |

**DAT-002 — Original record preservation**

The platform shall preserve original reasoning records separately from derived training examples.

**DAT-003 — Context reconstruction**

The platform shall preserve sufficient authorized context to reconstruct a training example.

**DAT-004 — Data minimization**

The platform shall exclude information that the selected training objective does not require.

**DAT-005 — Sensitive data**

The platform shall support detection and removal of sensitive data before dataset approval.

**DAT-006 — Secret protection**

The platform shall prevent known passwords, access tokens, and private keys from entering approved training datasets.

**DAT-007 — Data validation**

The platform shall check training records for required fields, valid associations, and permitted scope access.

**DAT-008 — Duplicate records**

The platform shall identify duplicate training examples.

**DAT-009 — Data approval**

The platform shall support an approval state for training records.

Unapproved records shall not enter an approved dataset.

**DAT-010 — Dataset versions**

The platform shall create identifiable dataset versions.

The platform shall preserve the contents of each approved dataset version until authorized removal.

**DAT-011 — Dataset reproducibility**

Each dataset version shall identify its source records and transformation configuration.

**DAT-012 — Dataset exclusion**

The platform shall let authorized users exclude records from subsequent training operations.

**DAT-013 — Dataset export**

The platform shall support export in documented formats suitable for Python training frameworks.

The initial interchange format shall support JSON Lines.

JSON Lines is a text format that stores one structured record on each line.

## 8.3 Training example preparation

**DAT-014 — Supervised examples**

The platform shall generate supervised training examples from approved corrections.

**DAT-015 — Preference examples**

The platform shall generate preference pairs from approved branch comparisons.

**DAT-016 — Common context**

Each preference pair shall identify the common context of its preferred and rejected outputs.

**DAT-017 — Comparable outputs**

The platform shall check that preference outputs are suitable for comparison.

The platform shall not treat an incomplete output as an incorrect output without supporting feedback.

**DAT-018 — Corrected continuations**

The platform shall support training examples that contain a valid reasoning prefix and a corrected continuation.

**DAT-019 — Training token selection**

The platform shall support selection of the output tokens that contribute to the training calculation.

The platform shall not require all context tokens to contribute to this calculation.

**DAT-020 — Step-level examples**

The platform shall generate step-level evaluation examples from approved reasoning labels.

**DAT-021 — Outcome examples**

The platform shall generate outcome-based examples from verified execution results.

**DAT-022 — Contradictory feedback**

The platform shall identify contradictory feedback before dataset approval.

**DAT-023 — Evaluation separation**

The platform shall maintain separate training and evaluation datasets.

The platform shall prevent known duplicate examples from entering both datasets.

**DAT-024 — Related example separation**

The platform shall keep branches from the same source task together during dataset partitioning when separation could cause evaluation contamination.

**DAT-025 — Data rights**

The platform shall exclude records that lack authorization for the selected training purpose.

**DAT-026 — Teacher feedback preparation**

The platform shall convert approved teacher corrections into supervised examples. It shall convert approved teacher preferences into preference pairs.

The platform shall support step-level labels and verified outcome records from teaching sessions.

**DAT-027 — Distillation records**

The platform shall let a teacher supply a preferred solution or reasoning continuation for student training.

The platform shall identify teacher-generated content separately from student-generated content.

The platform shall not require access to private teacher reasoning, teacher weights, or teacher token probabilities.

**DAT-028 — Training format compatibility**

The platform shall prepare teacher-generated examples with the student tokenizer and model format.

The platform shall retain the context necessary to interpret corrections and preference pairs.

The platform shall exclude unavailable or incompatible data rather than fabricate it.

**DAT-029 — Teacher data approval**

The platform shall apply DAT-009 and the applicable scope policy to teacher-generated records.

The platform may approve records automatically when a user authorizes the approval criteria.

The teacher shall not bypass those criteria.

**DAT-030 — Independent evaluation data**

The platform shall prevent teaching tasks, their branches, and their derived examples from entering the independent evaluation dataset for the same training operation.

The platform shall restrict teacher access to protected evaluation answers during training data generation.

# 9. Model Training Requirements

## 9.1 Training engine

**TRN-001 — LoRA training**

The platform shall support LoRA training for compatible base models.

**TRN-002 — Base model preservation**

The platform shall not modify the original base model weights during LoRA training.

**TRN-003 — Quantized training**

The platform shall support QLoRA for compatible model architectures.

**TRN-004 — Supervised training**

The platform shall support SFT with approved training examples.

**TRN-005 — Preference training**

The platform shall support DPO with approved preference pairs.

**TRN-006 — Process reward training**

The platform shall support training of a separate PRM from approved step-level evaluation data.

**TRN-007 — Reinforcement learning**

The platform shall support GRPO with compatible models and documented reward functions.

**TRN-008 — Training methods**

The platform shall identify the training methods available for the selected model.

The platform shall prevent unsupported training operations.

**TRN-009 — Training framework reuse**

The platform shall use the locally installed Unsloth as the initial training framework.

The platform shall reuse its supported PyTorch, Transformers, PEFT, and TRL functions when applicable.

Integration of alternative training engines is deferred until the project satisfies the initial integration acceptance conditions in section 23.7.

**TRN-010 — Independent framework selection**

The platform shall permit replacement of a training framework without changes to the reasoning record format.

**TRN-031 — Local training environment**

The project shall use the existing Unsloth Python environment for initial training.

The project shall verify the training methods and model formats that this environment supports.

The project shall not claim support for a training method until actual execution supplies the necessary evidence.

**TRN-032 — Inference and training compatibility**

The project shall identify a compatible Gemma 2B base model for Unsloth training and llama.cpp inference.

The project shall verify the model identity, tokenizer, and adapter conversion before it activates a trained adapter.

The project shall use existing compatible model files or authorized local conversion operations.

The project shall preserve the original model files.

## 9.2 Training configuration

**TRN-011 — Configurable training**

The platform shall support configuration of applicable training parameters.

These parameters shall include:

| Parameter | Purpose |
|---|---|
| Base model | Model that receives adaptation |
| Training method | Method that determines parameter changes |
| Target scope | Scope that owns the resulting adapter |
| Dataset version | Approved training data |
| Sequence length | Maximum tokens in a training sequence |
| Batch size | Number of examples processed together |
| Learning rate | Magnitude of training changes |
| Training steps | Maximum number of parameter updates |
| LoRA rank | Capacity of the adapter |
| LoRA scaling | Relative magnitude of adapter updates |
| Target modules | Model components that receive adaptation |
| Random seed | Initial value for random operations |
| Checkpoint interval | Frequency of training state storage |
| Device selection | Hardware available to training |

**TRN-012 — Configuration validation**

The platform shall check training configuration before execution.

**TRN-013 — Model compatibility**

The platform shall check base model architecture, tokenizer, and adapter compatibility before training.

**TRN-014 — Scope compatibility**

The platform shall check dataset access and scope permissions before training.

**TRN-015 — Resource configuration**

The platform shall support configuration of GPU memory and system memory limits where the training framework permits configuration.

**TRN-016 — Training profiles**

The platform shall support reusable configurations for compatible training operations.

**TRN-017 — Training sequence length**

The platform shall permit independent configuration of inference context capacity and training sequence length.

**TRN-018 — Training continuation**

The platform shall support continuation of a compatible existing adapter.

The platform shall record the original adapter version.

## 9.3 Training execution

**TRN-019 — Manual execution**

The platform shall let authorized users start a training operation.

**TRN-020 — Scheduled execution**

The platform shall support scheduled training under an authorized policy.

**TRN-021 — Training thresholds**

The platform shall support configuration of the minimum approved data necessary to start automatic training.

**TRN-022 — Training authorization**

The platform shall not start automatic training unless an authorized policy permits training.

**TRN-023 — Training progress**

The platform shall display the status and applicable metrics of an active training operation.

**TRN-024 — Training cancellation**

The platform shall let authorized users cancel an active training operation.

**TRN-025 — Training recovery**

The platform shall support recovery from a compatible training checkpoint.

**TRN-026 — Training failure**

The platform shall record training failures and their available diagnostic information.

**TRN-027 — Training records**

Each completed training operation shall identify these data:

- Training scope.
- Source dataset versions.
- Base model.
- Parent adapter, if applicable.
- Training framework and version.
- Training configuration.
- Hardware configuration.
- Training metrics.
- Resulting artifacts.

**TRN-028 — Training isolation**

A failed or cancelled training operation shall not modify an active adapter.

**TRN-029 — Training completion**

The platform shall register a completed adapter as a candidate adapter.

The platform shall not activate a candidate adapter before approval.

**TRN-030 — Training reproducibility**

The platform shall preserve sufficient configuration and provenance to repeat a training operation.

The platform shall not guarantee identical numerical results across different hardware.

# 10. Model Evaluation Requirements

**EVL-001 — Independent evaluation**

The platform shall evaluate a candidate adapter against data that does not enter its training operation.

**EVL-002 — Base model comparison**

The platform shall support comparison between a candidate adapter and its base model.

**EVL-003 — Previous version comparison**

The platform shall support comparison between a candidate adapter and an approved adapter.

**EVL-004 — Evaluation criteria**

The platform shall support these evaluation criteria:

| Criterion | Measurement |
|---|---|
| Correctness | Percentage of tasks with correct results |
| Reasoning efficiency | Tokens necessary to obtain an acceptable result |
| Reasoning quality | Evaluation of intermediate reasoning |
| Instruction compliance | Percentage of satisfied instructions |
| Tool execution accuracy | Correct use of tools |
| Regression | Difference from established results |
| Scope performance | Performance on scope-specific tasks |
| General performance | Performance on general tasks |
| Context performance | Performance at specified context lengths |
| Resource consumption | Memory and processing requirements |

**EVL-005 — Acceptance configuration**

The platform shall let authorized users configure acceptance thresholds before evaluation.

**EVL-006 — Evaluation repeatability**

The platform shall record the evaluation dataset, model, adapter, parameters, and environment.

**EVL-007 — Evaluation evidence**

The platform shall preserve the actual results of evaluation operations.

**EVL-008 — Failure visibility**

The platform shall identify failed evaluation criteria.

**EVL-009 — Human review**

The platform shall let authorized users examine individual evaluation results.

**EVL-010 — Scope-specific acceptance**

The platform shall support different acceptance criteria for different training scopes.

**EVL-011 — General regression protection**

The platform shall evaluate applicable general model capabilities before adapter deployment.

**EVL-012 — Reward model validation**

The platform shall evaluate a PRM against independent step-level evaluation data.

**EVL-013 — Reward function definition**

The platform shall document the criteria that each automated reward function measures.

**EVL-014 — Evaluation limitations**

The platform shall identify evaluation criteria that lack sufficient evidence.

The platform shall not represent an unverified criterion as a successful result.

## 10.1 Model benchmarks

**EVL-015 — Benchmark suite integration**

The platform shall use [gBench](https://github.com/google-deepmind/gbench) for initial model benchmarks.

The platform shall use its documented command-line interface and result formats.

The project shall reuse existing gBench scoring functions. The project shall not implement a duplicate benchmark suite.

The initial integration shall use gBench remote endpoint mode with the local llama.cpp server and the applicable local tokenizer.

The project shall verify the compatibility of the local server, checkout, and selected benchmark functions.

The project shall report unsupported functions. The project shall not silently substitute a different inference engine.

Reference documentation:

- [Remote endpoint mode](https://github.com/google-deepmind/gbench/blob/main/docs/remote-endpoints.md)
- [Capability evaluations](https://github.com/google-deepmind/gbench/blob/main/docs/eval-suites.md)
- [Golden Set](https://github.com/google-deepmind/gbench/blob/main/docs/golden-set.md)
- [Serving performance](https://github.com/google-deepmind/gbench/blob/main/docs/performance.md)
- [Results](https://github.com/google-deepmind/gbench/blob/main/docs/results.md)

**EVL-016 — Benchmark profiles**

The platform shall provide a small default benchmark profile for Gemma 2B.

The profile shall contain these applicable checks:

| Check | Purpose |
|---|---|
| Golden Set smoke tests | Identify basic capability and interface failures |
| Selected academic evaluations | Measure general knowledge, reasoning, mathematics, and coding capabilities |
| Custom held-out evaluations | Measure the learning objectives of the selected scope |
| Quick serving performance benchmark | Measure request latency and generation rate |

The project shall select tasks that the reference model and inference interface support.

The platform shall let authorized users configure the selected suites, task count, input and output limits, and number of repetitions.

Full benchmark sweeps, stress certification, multimodal suites, and the GemmaClaw agent quality suite are not initial integration requirements.

**EVL-017 — Baseline measurements**

Before the first training operation for a benchmark profile, the platform shall measure the unmodified student base model without an adapter.

Before subsequent training, the platform shall retain or measure the applicable pre-training adapter configuration.

After training, the platform shall measure the candidate adapter with the same base model.

The platform shall compare the candidate against the base model and the pre-training configuration.

The platform may reuse a recorded baseline if all conditions necessary for comparison remain the same.

**EVL-018 — Comparable measurement conditions**

The platform shall use the same benchmark profile, task identifiers, scoring rules, and evaluation limits for each comparison.

The platform shall record these data for each measurement:

- Model identity, tokenizer, quantization, and adapter version.
- gBench revision and applicable dataset versions.
- Inference engine version, chat template, and generation parameters.
- Context capacity, input limits, output limits, and random seeds when supported.
- Hardware, device selection, concurrency, and cache policy.
- Repetition count and applicable warm-up conditions.

The platform shall identify differences that prevent a valid comparison.

The platform shall not attribute results to adapter training if uncontrolled configuration changes prevent that conclusion.

**EVL-019 — Capability measurements**

The platform shall record the capability score and applicable task results for each selected suite.

The platform shall record the number of correct, incorrect, failed, and excluded tasks where applicable.

The platform shall distinguish capability failures from benchmark infrastructure failures.

The platform shall calculate the score difference from each applicable baseline.

For percentage scores, the platform shall report the difference in percentage points.

The platform shall not report an absent score as zero or as a successful result.

**EVL-020 — Scoped capability benchmarks**

The platform shall support an independent benchmark profile for each training scope.

The platform shall use authorized scope-specific tasks and a general capability benchmark to evaluate scope-specific adapters.

The platform shall support gBench custom JSON Lines datasets where the required scoring method is compatible.

The platform shall preserve the scope association and data provenance of all custom evaluation records.

The platform shall enforce scope access and data transmission restrictions during benchmark execution.

**EVL-021 — Evaluation data isolation**

The platform shall exclude benchmark tasks, expected answers, and their derived records from training data.

The platform shall apply DAT-023, DAT-024, and DAT-030 to benchmark data.

The platform shall prevent the teacher agent from using protected evaluation answers to generate training examples.

The platform shall support a separate final held-out evaluation when repeated candidate selection uses the same development benchmark.

The platform shall report known or suspected data contamination.

**EVL-022 — Evidence of improvement**

The platform shall let authorized users define a primary improvement criterion, a minimum improvement threshold, and maximum permitted regressions before training.

The platform shall apply these criteria to the same benchmark tasks for the candidate and its applicable baselines.

The platform shall support correctness, task success, and reasoning efficiency as improvement criteria.

A reduction in generated tokens shall count as an improvement only if the result satisfies the applicable correctness criteria.

The platform shall not claim improvement from training loss, teacher agreement, or serving speed alone.

**EVL-023 — Measurement repeatability**

The platform shall support repeated benchmark measurements.

The platform shall report the sample count and applicable variation statistics.

The platform shall distinguish a measured improvement from a difference that is too small to establish improvement under the configured criteria.

A small smoke test shall not constitute evidence of general model improvement.

The project shall use a representative held-out task set for claims of model improvement.

**EVL-024 — Adapter approval**

The platform shall apply the configured benchmark acceptance criteria before it approves a candidate adapter.

The platform shall not automatically approve an adapter if a required measurement fails, is absent, or is not comparable.

The platform shall preserve the previous approved adapter when a candidate fails acceptance.

The platform shall report the failed criteria and preserve the actual benchmark results.

**EVL-025 — Benchmark records and comparison**

The platform shall preserve the original gBench result files and associate them with the applicable model, adapter, scope, and training operation.

The platform shall display the base model, pre-training adapter, and candidate results side by side.

The platform shall display score differences, serving performance differences, acceptance status, and missing measurements.

The platform shall preserve the benchmark history across adapter versions.

**EVL-026 — Benchmark control**

The platform shall let authorized users start, examine, and cancel a benchmark.

The platform shall support benchmark execution as part of the authorized autonomous training cycle.

The platform shall preserve completed measurements if an operation stops.

The platform shall not treat incomplete measurements as sufficient evidence for adapter approval.

**EVL-027 — Benchmark dependencies and data rights**

The project shall document the gBench revision, required dependencies, applicable licenses, and supported benchmark profiles.

The project shall use the existing checkout and available local data where possible.

The project shall request owner authorization before it downloads additional model weights or benchmark datasets that are not available locally.

The project shall not transmit protected evaluation data to an external service without authorization.

# 11. Adapter Management Requirements

**ADP-001 — Adapter registration**

The platform shall maintain a record for each model adapter.

**ADP-002 — Adapter identity**

Each adapter shall have a unique identifier and version.

**ADP-003 — Adapter provenance**

Each adapter shall identify its base model, source datasets, training scopes, and training configuration.

**ADP-004 — Adapter lifecycle**

The platform shall support these adapter states:

| State | Meaning |
|---|---|
| Candidate | Training completes. Approval is pending. |
| Evaluated | Evaluation results are available. |
| Approved | An authorized policy or user approves the adapter. |
| Active | An inference configuration uses the adapter. |
| Retired | New inference operations cannot select the adapter. |
| Rejected | The adapter does not receive approval. |

**ADP-005 — Deployment approval**

The platform shall require authorized approval before adapter activation.

**ADP-006 — Compatibility check**

The platform shall check model and inference engine compatibility before adapter activation.

**ADP-007 — Adapter selection**

The platform shall select an adapter according to the authorized scope policy.

**ADP-008 — Manual selection**

The platform shall let authorized users select a compatible adapter manually.

**ADP-009 — Adapter replacement**

The platform shall support replacement of an active adapter with an approved version.

**ADP-010 — Rollback**

The platform shall support restoration of a compatible earlier adapter version.

**ADP-011 — Base model restoration**

The platform shall let authorized users perform inference without an adapter.

**ADP-012 — Adapter export**

The platform shall support export of trained adapters in documented formats.

**ADP-013 — Inference conversion**

The platform shall support adapter conversion for compatible inference engines.

The platform shall support the GGUF adapter format for compatible llama.cpp models.

**ADP-014 — Adapter integrity**

The platform shall check adapter integrity before activation.

**ADP-015 — Active configuration**

The platform shall display the active base model and adapter versions.

**ADP-016 — Activation safety**

The platform shall preserve active inference operations when it changes an adapter.

The platform shall use the new adapter only at a compatible operation boundary.

**ADP-017 — Failed activation**

The platform shall preserve the previous valid configuration if adapter activation fails.

**ADP-018 — Unauthorized adapter use**

The platform shall prevent activation of an adapter outside its authorized scopes.

# 12. Continuous Model Improvement Requirements

**LRN-001 — Feedback cycle**

The platform shall support this continuous improvement sequence:

1. Generate reasoning branches.
2. Collect human or teacher feedback.
3. Collect applicable execution evidence.
4. Prepare training examples.
5. Approve a dataset version.
6. Train a candidate adapter.
7. Evaluate the candidate adapter.
8. Approve or reject the candidate adapter.
9. Activate an approved adapter.
10. Collect additional feedback.

**LRN-002 — Independent learning cycles**

The platform shall support an independent improvement cycle for each training scope.

**LRN-003 — Automatic branch evaluation**

The platform shall support automatic branch evaluation with an approved reward model.

**LRN-004 — Evaluation transparency**

The platform shall display the source and value of each available branch score.

**LRN-005 — Human override**

The platform shall let an authorized user override automatic branch selection.

**LRN-006 — Verified outcomes**

Automatic outcome rewards shall use documented evidence criteria.

**LRN-007 — Reasoning efficiency**

The platform shall support rewards that reduce unnecessary reasoning.

The platform shall not reward shorter reasoning without consideration of correctness.

**LRN-008 — Training stability**

The platform shall not modify an active adapter after each individual feedback operation.

**LRN-009 — Automatic deployment**

The platform may activate adapters automatically under an explicitly authorized deployment policy.

The platform shall enforce all applicable acceptance criteria.

**LRN-010 — Learning interruption**

The platform shall let authorized users disable automatic training and automatic deployment independently.

## 12.1 Autonomous teacher-guided improvement

**LRN-011 — Autonomous training cycle**

The platform shall support a complete teacher-guided improvement cycle without human input at each step.

The cycle shall use an authorized teaching and training policy. It shall include these operations:

1. Select an authorized task and student adapter version.
2. Generate student reasoning branches.
3. Let the teacher examine, select, reject, and correct the branches.
4. Continue student reasoning from the selected checkpoint.
5. Collect feedback and applicable execution evidence.
6. Prepare and approve training data under the applicable policy.
7. Train a candidate LoRA adapter for the student.
8. Evaluate the candidate against independent data.
9. Approve or reject the candidate under the applicable policy.
10. Activate an approved adapter if the deployment policy permits activation.
11. Repeat within the configured limits.

**LRN-012 — Scope isolation**

Each autonomous training cycle shall have an explicit target scope.

The platform shall enforce SCP-016 through SCP-028 and SCP-029 through SCP-042 for all teacher operations and derived artifacts.

**LRN-013 — Student-only adaptation**

The platform shall train the selected student adapter.

The platform shall not modify the teacher model, base student model, or unrelated adapters.

**LRN-014 — Independent evaluation**

The platform shall evaluate the student without teacher guidance on independent tasks before adapter approval.

The platform shall compare the candidate with the base model and previous approved adapter when applicable.

The platform shall not use teacher agreement as the sole acceptance criterion for tasks with independently verifiable results.

**LRN-015 — Acceptance failure**

The platform shall reject or retain as inactive a candidate that fails an acceptance criterion.

The platform shall preserve the previous approved adapter.

**LRN-016 — Stop conditions**

The platform shall let authorized users configure stop conditions for the autonomous cycle.

The platform shall stop when the task limit, training limit, cost limit, or specified acceptance target occurs.

The platform shall pause when repeated failures or insufficient approved data prevent safe continuation.

**LRN-017 — Training authorization**

The platform shall apply TRN-022, DAT-009, ADP-005, and the deployment policy to autonomous operations.

The platform shall support separate authorization for teaching, dataset approval, training, and adapter activation.

**LRN-018 — Cycle records**

The platform shall record the tasks, teacher decisions, dataset versions, student adapter versions, evaluation results, and stop conditions for each cycle.

**LRN-019 — Resource separation**

The platform shall support independent teacher and student inference endpoints and resource configurations.

The platform shall not require the teacher model to reside on the student's training hardware.

# 13. User Interface Requirements

## 13.1 Graphical interface

**UI-001 — Reasoning graph**

The graphical interface shall display reasoning branches as a tree or graph.

**UI-002 — Branch relationships**

The graphical interface shall display parent and child relationships between branches.

**UI-003 — Branch status**

The graphical interface shall display the current state of each branch.

**UI-004 — Reasoning editor**

The graphical interface shall let the user examine and modify permitted reasoning text.

**UI-005 — Feedback controls**

The graphical interface shall provide controls for preference, correction, rejection, and outcome evaluation.

**UI-006 — Scope management**

The graphical interface shall let authorized users manage training scopes.

**UI-007 — Training management**

The graphical interface shall let authorized users configure, start, examine, and cancel training operations.

**UI-008 — Dataset examination**

The graphical interface shall let authorized users examine and approve training records.

**UI-009 — Adapter management**

The graphical interface shall display adapter versions, scope associations, and evaluation results.

**UI-010 — Evaluation comparison**

The graphical interface shall display comparative model evaluation results.

**UI-011 — Resource display**

The graphical interface shall display resource measurements that the runtime makes available.

**UI-012 — Error display**

The graphical interface shall display actionable error information.

**UI-013 — Operation confirmation**

The graphical interface shall require confirmation for operations that can permanently remove data.

**UI-018 — Teaching controls**

The graphical interface shall display the teacher identity, student model, active scope, control owner, teaching progress, and available resource limits.

The interface shall let an authorized user start, pause, cancel, or take control of a teaching session.

The interface shall distinguish teacher corrections from student output and human corrections.

## 13.2 Terminal interface

**UI-014 — Terminal control**

The platform shall provide terminal controls through the Pi extension.

**UI-015 — Terminal status**

The platform shall display the active reasoning mode, training scope, and adapter configuration.

**UI-016 — Graphical interface access**

The platform shall let the user open the graphical interface from Pi.

**UI-017 — Interface consistency**

The graphical and terminal interfaces shall use the same authoritative application state.

**UI-019 — Terminal teaching control**

The Pi extension shall let authorized users start, stop, and examine a teaching session without the graphical interface.

# 14. Data Persistence Requirements

**PER-001 — Persistent records**

The platform shall preserve approved persistent records across application restarts.

**PER-002 — Reasoning history**

The platform shall preserve reasoning branch relationships and feedback history.

**PER-003 — Training history**

The platform shall preserve training configurations, results, and artifact associations.

**PER-004 — Schema version**

The platform shall identify the version of each persistent data format.

**PER-005 — Data migration**

The platform shall support migration of compatible earlier data formats.

**PER-006 — Migration safety**

The platform shall preserve source data if migration fails.

**PER-007 — Backup**

The platform shall support backup of persistent application data.

**PER-008 — Restoration**

The platform shall support restoration from a compatible backup.

**PER-009 — Retention**

The platform shall support configurable data retention policies for training scopes.

**PER-010 — Deletion**

The platform shall support authorized deletion of retained data.

**PER-011 — Integrity**

The platform shall identify corrupt or incomplete persistent records.

**PER-012 — Concurrent modification**

The platform shall prevent conflicting record modifications from causing silent data loss.

# 15. Security Requirements

**SEC-001 — Local communication**

The platform shall restrict local communication interfaces to authorized clients.

**SEC-002 — Remote access**

The platform shall require explicit configuration before it accepts remote connections.

**SEC-003 — Authentication**

The platform shall authenticate users when multiple users can access protected resources.

**SEC-004 — Authorization**

The platform shall check authorization before protected operations.

**SEC-005 — Credential protection**

The platform shall store credentials through an appropriate protected storage mechanism.

**SEC-006 — Secret exclusion**

The platform shall prevent known credentials from entering diagnostic records and exported datasets.

**SEC-007 — Remote transmission**

The platform shall require authorization before transmission of protected data to an external service.

**SEC-008 — Access records**

The platform shall record security-relevant operations.

**SEC-009 — Audit records**

The platform shall preserve audit records according to the applicable retention policy.

**SEC-010 — Input validation**

The platform shall validate data at external communication boundaries.

**SEC-011 — Artifact validation**

The platform shall validate imported model adapters and training artifacts before use.

**SEC-012 — Model output restrictions**

The platform shall treat model-generated instructions as untrusted data.

**SEC-013 — Permission boundaries**

The platform shall prevent model output from changing permissions or approval policies.

**SEC-014 — Resource isolation**

The platform shall prevent one training scope from accessing another scope through temporary files or inference state.

**SEC-015 — Shared adapter restrictions**

The platform shall not expose a shared adapter to a user who lacks authorization for its applicable deployment scope.

**SEC-016 — External provider limitations**

The platform shall identify when an external provider can retain transmitted data.

**SEC-017 — Teacher access**

The platform shall authenticate and authorize the teacher as a separate client.

The platform shall restrict its access to the specified sessions, scopes, and operations.

The platform shall reject attempts to increase its own permissions or approve operations outside the applicable policy.

**SEC-018 — Teacher revocation**

The platform shall let authorized users revoke teacher access.

The platform shall reject subsequent commands and stop unauthorized continuation.

**SEC-019 — Untrusted teaching content**

The platform shall treat teacher messages and student output as untrusted data.

Neither may change the approval policy, resource limits, or evaluation criteria through a reasoning instruction.

# 16. Performance and Resource Requirements

**PRF-001 — Resource measurement**

The platform shall record applicable measurements for inference and training operations.

**PRF-002 — Inference measurements**

The platform shall support measurement of:

- Prompt processing rate.
- Generation rate.
- Time to first token.
- Branch generation duration.
- Cache reuse.
- GPU memory consumption.
- System memory consumption.

**PRF-003 — Training measurements**

The platform shall support measurement of:

- Training duration.
- Training loss.
- Reward values, when applicable.
- GPU memory consumption.
- System memory consumption.
- Completed training steps.

**PRF-004 — Branch resource control**

The platform shall limit active branches according to available resources and configured limits.

**PRF-005 — Resource contention**

The platform shall support independent scheduling of inference and training operations.

**PRF-006 — GPU allocation**

The platform shall permit separate GPU selection for inference and training when supported.

**PRF-007 — Multi-GPU operation**

The platform shall use multi-GPU functions that the selected runtime supports.

The platform shall not assume that separate GPU memory devices form one continuous memory device.

**PRF-008 — Resource exhaustion**

The platform shall report insufficient resources without corruption of persistent data.

**PRF-009 — Reduced operation**

The platform shall permit sequential generation when parallel generation exceeds resource limits.

**PRF-010 — Performance baseline**

The project shall establish reference performance measurements on documented hardware.

**PRF-011 — Performance acceptance**

The project shall define measurable performance acceptance criteria before a production release.

**PRF-012 — Reference hardware**

The initial reference environment shall use the installed tools in section 2.2 and shall include:

| Component | Reference configuration |
|---|---|
| Operating system | Windows |
| Processor | AMD Ryzen 7 9800X3D |
| Primary GPU | NVIDIA RTX 4090, 24 GB VRAM |
| Secondary GPU | NVIDIA RTX 3080, 12 GB VRAM |
| System memory | 128 GB |

This configuration does not establish compatibility with all model sizes or training configurations.

**PRF-013 — Serving benchmark measurements**

The platform shall use the applicable gBench quick serving benchmark with llama.cpp.

The platform shall record the following measurements when the server and benchmark interface supply the necessary data:

- Time to first token (TTFT): time from request submission to the first output token.
- Inter-token latency (ITL): time between output tokens.
- Output tokens per second and completed requests per second.
- Total request duration and request failure rate.
- Median and applicable latency percentiles.
- GPU memory and system memory use when available from local measurements.

The platform shall report unavailable measurements.

The platform shall use comparable workload sizes, concurrency, cache conditions, and hardware for each model configuration.

The platform shall report serving performance separately from model capability.

# 17. Reliability and Error Handling Requirements

**REL-001 — Failure isolation**

A failure in one reasoning branch shall not corrupt another branch.

**REL-002 — Training failure isolation**

A training failure shall not prevent unrelated inference operations when sufficient resources remain available.

**REL-003 — Connection recovery**

The platform shall support recovery after communication interruptions.

**REL-004 — Persistent data recovery**

The platform shall preserve valid persistent records after an unexpected process termination.

**REL-005 — Partial result preservation**

The platform shall preserve available reasoning output when a generation operation fails or stops.

**REL-006 — Error identification**

The platform shall distinguish errors from successful operations.

**REL-007 — Diagnostic information**

The platform shall provide sufficient diagnostic information to identify the applicable failure.

**REL-008 — Retry control**

The platform shall prevent uncontrolled repeated operations after persistent failures.

**REL-009 — State consistency**

The platform shall restore a valid application state after an unsuccessful operation.

# 18. Documentation Requirements

## 18.1 Required documentation

**DOC-001 — Writing standard**

Project documentation shall follow ASD-STE100 Simplified Technical English.

The project shall define necessary technical terms in a glossary.

**DOC-002 — Canonical documentation**

The project shall maintain one authoritative documentation source for each subject.

**DOC-003 — Documentation inventory**

The project shall maintain these documents:

| Document | Required contents |
|---|---|
| README | Purpose, supported functions, installation, and initial operation |
| Software Requirements Specification | Functional and non-functional requirements |
| Architecture description | Components, responsibilities, boundaries, and data flow |
| Interface specification | Communication formats, commands, events, and errors |
| Data specification | Persistent records, formats, validation, and migration |
| Reasoning control guide | Generation, branching, correction, and continuation |
| Training guide | Supported training methods and configuration |
| Teacher integration guide | External agent API, authorization, control ownership, teaching policies, recovery, and autonomous training examples |
| Scope management guide | Scope creation, permissions, inheritance, and isolation |
| Adapter management guide | Selection, conversion, deployment, and rollback |
| Compatibility matrix | Supported models, engines, frameworks, and hardware |
| Security description | Trust boundaries, permissions, and protected data |
| Development guide | Development environment and contribution procedures |
| Verification plan | Functional verification methods and acceptance criteria |
| Verification report | Actual results, failures, and verification limitations |
| Benchmark guide | Local gBench setup, benchmark profiles, baseline procedure, scoring, comparison, and interpretation of results |
| Troubleshooting guide | Known failures and recovery procedures |
| Release notes | Changes, compatibility changes, and known limitations |

Related documents may share one file when the resulting structure remains clear.

## 18.2 Documentation maintenance

**DOC-004 — Documentation accuracy**

Documentation shall describe actual supported behavior.

**DOC-005 — Documentation synchronization**

A source change that modifies documented behavior shall include the applicable documentation change.

**DOC-006 — Interface documentation**

The project shall document all supported public interfaces.

**DOC-007 — Configuration documentation**

The project shall document each user-configurable parameter and its applicable limits.

**DOC-008 — Architecture decisions**

The project shall record architecture decisions that affect compatibility, security, data integrity, or significant component boundaries.

The project shall not require a separate decision document for routine implementation choices.

**DOC-009 — Known limitations**

The project shall document known limitations and unresolved compatibility conditions.

**DOC-010 — Verification status**

The project shall distinguish these verification states:

- Verified.
- Partially verified.
- Not verified.
- Failed.
- Not applicable.

**DOC-011 — Requirement traceability**

The project shall maintain associations between requirements and their verification evidence.

**DOC-012 — Implementation terminology**

Documentation identifiers shall not determine implementation names.

Implementation names shall describe their technical purpose.

**DOC-013 — Obsolete documentation**

The project shall remove or correct obsolete documentation.

**DOC-014 — Examples**

The project shall provide representative examples for supported user workflows.

**DOC-015 — Command validity**

Documentation shall provide complete commands that users can execute directly.

**DOC-016 — Unsupported behavior**

Documentation shall not represent proposed or unverified functions as available functions.

**DOC-017 — SRS implementation status**

The project shall maintain the implementation status and completion counts in section 21 of this SRS.

Each implementation agent shall update the applicable requirement records and overall summary after each work cycle and before each handover or commit that changes requirement status.

The project shall use actual verification evidence to calculate completion.

The project shall correct the status when new evidence invalidates a previous verification result.

# 19. Software Verification Requirements

## 19.1 Verification strategy

**TST-001 — Functional verification priority**

The project shall use functional requirement testing as the primary method of software verification.

**TST-002 — Observable behavior**

Functional tests shall verify behavior that a user or external component can observe.

**TST-003 — Requirement coverage**

Each mandatory requirement shall have an applicable verification method.

Verification methods shall include:

| Method | Purpose |
|---|---|
| Functional test | Check observable behavior |
| Integration test | Check communication between actual components |
| System test | Check a complete workflow |
| Performance measurement | Measure resource consumption and processing rate |
| Inspection | Examine documentation, configuration, or source restrictions |
| Analysis | Examine evidence for a specified property |
| Demonstration | Observe behavior in a representative environment |

**TST-004 — Requirement grouping**

One verification scenario may satisfy multiple related requirements.

The project shall not require a separate test for each requirement when one scenario supplies sufficient evidence.

**TST-005 — Independent evidence**

Tests shall provide evidence that does not depend on the implementation's assertion of success.

**TST-006 — Meaningful failure conditions**

Each functional test shall fail when the applicable required behavior does not occur.

**TST-007 — Actual execution**

Verification reports shall distinguish executed tests from tests that the project does not execute.

**TST-008 — Test result preservation**

The project shall preserve actual verification results.

**TST-009 — Verification limitations**

The project shall report requirements that lack sufficient verification evidence.

## 19.2 Unit and implementation test restrictions

**TST-010 — Limited unit tests**

The project shall limit unit tests to functions that require isolated verification.

**TST-011 — Unit test justification**

The project shall add an isolated unit test only when at least one of these conditions applies:

- A defect can cause a security violation.
- A defect can cause data loss or corruption.
- A function contains significant calculation or validation logic.
- A functional test cannot reliably reproduce a necessary failure condition.
- A functional test cannot isolate a necessary boundary condition.
- An isolated test provides necessary regression protection.

**TST-012 — Implementation independence**

Tests shall not depend on private function names, internal call sequences, or component structure without technical necessity.

**TST-013 — Refactoring tolerance**

A change to internal implementation shall not require changes to functional tests when observable behavior remains correct.

**TST-014 — Routine function exclusions**

The project shall not require dedicated unit tests for these functions unless TST-011 applies:

- Simple property access.
- Routine data assignments.
- Basic forwarding functions.
- Trivial constructors.
- Standard library behavior.
- Routine graphical components.
- Internal functions that existing functional tests verify sufficiently.

**TST-015 — Coverage metrics**

The project shall not use source line coverage as the sole measure of verification completeness.

The project shall not require an arbitrary coverage percentage.

**TST-016 — Duplicate verification**

The project shall not add tests that provide no additional meaningful evidence.

**TST-017 — Existing test protection**

The project shall preserve meaningful existing tests.

The project shall not remove valid verification solely to reduce test quantity.

**TST-018 — Test correctness**

The project shall not weaken an assertion to accommodate incorrect software behavior.

**TST-019 — Test corrections**

A change to a test expectation shall have a documented requirement or correctness basis.

**TST-020 — Test expansion**

The project shall extend an existing applicable test before it creates an unnecessary separate test.

## 19.3 Test environment

**TST-021 — Representative operation**

Functional verification shall use representative application configurations and workflows.

**TST-022 — Real inference verification**

The project shall execute initial functional inference tests with the installed llama.cpp engine and the reference model in section 2.2.

The project shall use the actual engine for the applicable inference functions.

**TST-023 — Real training verification**

The project shall execute a complete training, evaluation, and deployment workflow with the installed Unsloth and llama.cpp tools.

The project shall use the reference model in section 2.2 for initial verification.

**TST-024 — Reduced test models**

The project shall use Gemma 2B for local implementation and routine model-dependent functional verification.

The project shall identify the exact model version and local files before execution. The project shall record this information in the verification environment.

The project shall use small training datasets, limited training steps, and short contexts for routine functional tests.

The reference model shall exercise the same applicable application behavior as a larger model.

The project shall not represent the reference model as proof of larger model compatibility or reasoning quality.

**TST-025 — Target model verification**

The project shall verify model-specific compatibility separately from general application behavior.

**TST-026 — Controlled substitutes**

The project may use simulated external interfaces to reproduce specified failure conditions.

Simulated interfaces shall not constitute verification of actual inference or training capability.

**TST-027 — Test data protection**

Tests shall not require private project or team data.

**TST-028 — Verification isolation**

Tests shall not modify production datasets, production adapters, or unrelated user resources.

**TST-029 — Resource-intensive tests**

The project shall maintain a separate verification configuration for resource-intensive GPU operations.

Routine verification shall not require execution of a complete production training workload.

**TST-037 — Reference model limitations**

The project shall use explicit generated reasoning text or partial output for reference model tests when Gemma 2B does not expose a separate reasoning trace.

The project shall verify the applicable generation, selection, correction, and continuation behavior.

The project shall not fabricate a reasoning trace or claim verification of unsupported reasoning functions.

The project shall report any remaining model-specific verification condition.

**TST-038 — Local functional verification**

The project shall execute model-dependent verification on the owner-specified local Windows system.

The project shall record the actual tool versions, model identity, configuration, results, and evidence.

The project shall not substitute a simulated engine for the required initial inference and training integration tests.

The project shall use existing functional scenarios when they supply sufficient evidence. It shall not add separate tests for routine environment checks.

The project shall not require the owner-specific absolute paths or installed models for routine tests that do not use these resources.

**TST-039 — Benchmark integration verification**

The project shall execute at least one actual gBench comparison of Gemma 2B before and after Unsloth adapter training.

The project shall use the installed llama.cpp server for the measurements.

The project shall verify baseline recording, result comparison, scope isolation, and adapter acceptance with the applicable shared functional scenarios.

The project shall not require model improvement for a short integration test to pass.

The project shall verify acceptance and rejection behavior with controlled benchmark records when necessary.

Controlled records shall not constitute evidence that the model improves.

The project shall not add separate unit tests for each gBench metric when shared functional verification supplies sufficient evidence.

## 19.4 Continuous integration

**TST-030 — Routine verification**

CI shall execute the applicable routine functional tests.

**TST-031 — Hardware verification**

The project shall execute applicable hardware-dependent verification before it claims hardware compatibility.

**TST-032 — Regression verification**

The project shall execute applicable regression tests after changes to established behavior.

**TST-033 — Release verification**

A release shall identify the verification results necessary for its supported functions.

**TST-034 — Unexecuted tests**

The project shall not report an unexecuted test as successful.

**TST-035 — Failure reporting**

The project shall report failed tests and unresolved verification conditions.

**TST-036 — Teacher verification**

The project shall verify the teacher interface with an independently running agent and a supported student inference engine.

The project shall verify at least one complete teacher-guided training cycle with a compatible student model.

The project may use a small student model for this verification.

A controlled substitute may reproduce teacher failures and unauthorized requests. It shall not establish actual teacher-model compatibility.

The project shall use shared functional scenarios for human and teacher control where those scenarios supply sufficient evidence.

# 20. Functional Verification Scenarios

The following scenarios define the minimum functional verification groups.

Each group may contain multiple conditions and operations. The project shall add separate scenarios only when existing scenarios cannot provide sufficient evidence.

| ID | Scenario | Required result |
|---|---|---|
| FV-001 | Pi extension installation | The user can install, enable, and disable the extension. |
| FV-002 | Normal Pi operation | Pi operates normally when reasoning control is disabled. |
| FV-003 | Graphical synchronization | The interface displays applicable Pi session events and state. |
| FV-004 | Candidate generation | The platform generates the configured number of independent branches. |
| FV-005 | Reasoning selection | The platform continues the approved branch. Unapproved branches do not execute state-changing tools. |
| FV-006 | Reasoning correction | The platform preserves the original reasoning and uses the approved correction. |
| FV-007 | Recursive branching | The platform generates additional branches from a selected checkpoint. |
| FV-008 | State restoration | The platform restores compatible inference state or identifies the necessary reconstruction. |
| FV-009 | Cache invalidation | A reasoning change prevents reuse of invalid inference state. |
| FV-010 | Branch failure | A failed or cancelled branch does not corrupt another branch. |
| FV-011 | Capability enforcement | The platform prevents an unsupported inference operation and reports the limitation. |
| FV-012 | Tool authorization | The platform prevents unauthorized state-changing operations. |
| FV-013 | Feedback collection | The platform preserves feedback, original reasoning, corrections, and provenance. |
| FV-014 | Dataset preparation | The platform produces approved training examples with valid source associations. |
| FV-015 | Scope creation | Authorized users can create independent and related training scopes. |
| FV-016 | Scope selection | The platform applies the authorized scope for the active resource. |
| FV-017 | Scope isolation | Unauthorized users cannot examine or use data from another scope. |
| FV-018 | Scope inheritance | The platform includes only authorized inherited data. |
| FV-019 | Cross-scope transfer | The platform requires authorization and preserves source provenance. |
| FV-020 | Independent scoped training | Training changes the target scope adapter only. |
| FV-021 | Scoped adapter selection | The platform activates the adapter applicable to the authorized scope. |
| FV-022 | Adapter conflicts | The platform applies a documented selection policy or requests resolution. |
| FV-023 | Supervised training | The platform produces a usable adapter from approved supervised examples. |
| FV-024 | Preference training | The platform produces a usable adapter from approved preference pairs. |
| FV-025 | Process reward training | The platform produces and independently evaluates a reward model. |
| FV-026 | Reinforcement learning | The platform completes a supported training operation with documented reward criteria. |
| FV-027 | Training cancellation | The platform cancels training without modification of the active adapter. |
| FV-028 | Evaluation | The platform produces actual comparative evaluation results. |
| FV-029 | Deployment restrictions | The platform prevents activation of an unapproved or incompatible adapter. |
| FV-030 | Adapter rollback | The platform restores the selected earlier adapter configuration. |
| FV-031 | Training recovery | The platform restores a compatible training checkpoint. |
| FV-032 | Continuous improvement | The platform completes the authorized feedback, training, evaluation, and deployment sequence. |
| FV-033 | Resource exhaustion | The platform reports resource limits without corruption of data. |
| FV-034 | Application recovery | The platform restores persistent records after a restart. |
| FV-035 | Backup and restoration | The platform restores valid data from a compatible backup. |
| FV-036 | Data migration | The platform preserves valid data during a supported format migration. |
| FV-037 | Sensitive data protection | The platform prevents known test secrets from entering approved datasets. |
| FV-038 | Unauthorized communication | The platform rejects unauthorized client access. |
| FV-039 | Derived artifact review | The platform identifies adapters affected by removal of source data. |
| FV-040 | Long-context operation | The platform verifies a specified context capacity with a compatible model. |
| FV-041 | Performance measurement | The platform records actual inference and training measurements. |
| FV-042 | Documentation verification | The project documents supported behavior, interfaces, configuration, and limitations. |
| FV-043 | Independent teacher control | A separate agent connects to a student session, examines partial reasoning, selects and corrects a branch, and continues from the selected checkpoint. The original output remains available. |
| FV-044 | Teacher authorization and control transfer | The platform rejects an unauthorized scope, stale command, unapproved tool operation, and permission change. Human takeover prevents subsequent teacher commands. |
| FV-045 | Teacher failure and limits | A disconnected teacher, repeated command, or exhausted limit does not cause unapproved continuation, duplicate execution, or loss of valid records. |
| FV-046 | Teacher feedback and data isolation | The platform produces approved supervised, preference, and step-level records with teacher and student provenance. It excludes unauthorized data and independent evaluation examples. |
| FV-047 | Autonomous scoped training | A separate teacher guides a student through a complete authorized cycle without per-step human input. Training produces a candidate student adapter in the target scope. Independent evaluation controls activation. The base model, teacher model, and unrelated adapters remain unchanged. |
| FV-048 | Autonomous rejection and recovery | A candidate that fails acceptance remains inactive. The previous approved adapter remains available. The platform stops or pauses at the configured limit and preserves the cycle records. |
| FV-049 | Initial local integration | The installed Pi agent loads the extension. The installed llama.cpp engine generates and continues Gemma 2B output. Unsloth trains a scoped adapter. The project converts the adapter when necessary, loads it in llama.cpp, evaluates it, and verifies rollback. The original model files remain unchanged. |
| FV-050 | Model benchmark comparison | The local gBench checkout measures Gemma 2B through llama.cpp before and after training. The platform preserves original results, records comparable configurations, calculates capability and serving performance differences, and reports the applicable acceptance status. |
| FV-051 | Benchmark acceptance and isolation | The platform prevents automatic approval when a required score fails, is missing, or is not comparable. It rejects unauthorized scope access and excludes protected evaluation data from training. The previous approved adapter remains available. |

The scenario identifiers do not identify individual test files or implementation functions.

# 21. Requirements Progress Tracker and Verification Matrix

## 21.1 Overall implementation status

| Progress measure | Current value |
|---|---:|
| Overall implementation status | Not assessed |
| Total SRS requirements | 425 |
| Verified complete | 0 of 425 |
| Overall completion | 0.0% |
| Implemented, verification pending | 0 |
| In progress | 0 |
| Blocked | 0 |
| Deferred | 0 |
| Not started | 0 |
| Not assessed | 425 |
| Remaining requirements | 425 |
| Functional verification scenarios | 51 |
| Last tracker update | 2026-11-25 |

Initial tracker entry: The SRS does not contain requirement-level implementation or verification evidence. The initial count of zero verified requirements does not establish that implementation work has not started. The next implementation agent shall assess the existing work and record the applicable evidence.

The overall completion percentage is 100 multiplied by the number of verified complete requirements, divided by the total number of unique SRS requirement identifiers. Round the result to one decimal place. Each requirement has equal weight. This percentage measures verified requirement completion. It does not measure development effort or time to release.

The full SRS requirement count includes deferred requirements. Deferral does not increase the completion percentage. The project shall not count verification scenarios as additional requirements. A scenario can verify multiple requirements.

The overall implementation status shall be Complete only when all requirements have verified complete status. If no requirement has an assessment, the status shall be Not assessed. If work remains and a blocker prevents all remaining work in the authorized scope, the status shall be Blocked. If all remaining requirements are deferred under an authorized policy, the status shall be Deferred. In all other cases with remaining work, the status shall be In progress.

Specification approval and implementation completion are separate states.

## 21.2 Requirement status tracker

The tracker shall contain one status for each requirement identifier. The project may use a range of identifiers in one row if all requirements in that row have the same status, applicable evidence, and remaining work.

| Status | Meaning |
|---|---|
| Not assessed | The project has not assessed implementation and evidence. |
| Not started | The project confirms that work on the requirement has not started. |
| In progress | Work or partial verification remains in progress. |
| Implemented, verification pending | The implementation is complete. Sufficient verification evidence is not available. |
| Verified complete | Actual verification evidence establishes that the full requirement is satisfied. |
| Blocked | A known condition prevents the next necessary operation. |
| Deferred | An authorized decision postpones the requirement. |

| Requirement identifiers | Count | Status | Evidence reference | Remaining work or limitation |
|---|---:|---|---|---|
| ARC-001 through ARC-021 | 21 | Not assessed | — | — |
| PI-001 through PI-011 | 11 | Not assessed | — | — |
| RSN-001 through RSN-026 | 26 | Not assessed | — | — |
| TCH-001 through TCH-022 | 22 | Not assessed | — | — |
| INF-001 through INF-017 | 17 | Not assessed | — | — |
| TOOL-001 through TOOL-009 | 9 | Not assessed | — | — |
| SCP-001 through SCP-042 | 42 | Not assessed | — | — |
| FDB-001 through FDB-011 | 11 | Not assessed | — | — |
| DAT-001 through DAT-030 | 30 | Not assessed | — | — |
| TRN-001 through TRN-032 | 32 | Not assessed | — | — |
| EVL-001 through EVL-027 | 27 | Not assessed | — | — |
| ADP-001 through ADP-018 | 18 | Not assessed | — | — |
| LRN-001 through LRN-019 | 19 | Not assessed | — | — |
| UI-001 through UI-019 | 19 | Not assessed | — | — |
| PER-001 through PER-012 | 12 | Not assessed | — | — |
| SEC-001 through SEC-019 | 19 | Not assessed | — | — |
| PRF-001 through PRF-013 | 13 | Not assessed | — | — |
| REL-001 through REL-009 | 9 | Not assessed | — | — |
| DOC-001 through DOC-017 | 17 | Not assessed | — | — |
| TST-001 through TST-039 | 39 | Not assessed | — | — |
| MNT-001 through MNT-012 | 12 | Not assessed | — | — |

### Tracker maintenance

The project shall keep this tracker in the SRS as the authoritative record of requirement completion. Apply DOC-017.

- Assess existing work before assigning implementation status.
- Split a row when the status, evidence, or remaining work differs between its requirements.
- Use the applicable verification methods in section 19. A successful inspection may establish completion of a documentation or architecture requirement.
- Record a reference to actual verification evidence before assigning Verified complete status.
- Record the blocker or authorized deferral for each Blocked or Deferred requirement.
- Keep failed, partial, simulated-only, or unexecuted verification out of the verified complete count unless the applicable verification method supplies sufficient evidence for the full requirement.
- Update the overall status, all counts, completion percentage, and update date from the tracker rows.
- Check that each current requirement identifier occurs once in the tracker. Check that all status counts add up to the total requirement count.
- Include new requirement identifiers when the SRS changes. Do not silently remove requirements to increase the completion percentage.

The project shall preserve the functional verification strategy in section 19. Tracker maintenance does not require a separate test for each requirement.

## 21.3 Requirements verification matrix

The project shall maintain a detailed verification matrix during implementation.

The following table defines the initial verification groups.

| Requirement group | Primary verification |
|---|---|
| ARC | Architecture inspection, FV-001, FV-023, FV-042, FV-049, FV-050 |
| PI | FV-001 through FV-003, FV-005, FV-012, FV-034 |
| RSN | FV-004 through FV-011, FV-013, FV-043 through FV-045 |
| TCH | FV-043 through FV-048, interface and policy inspection |
| INF | FV-004, FV-008 through FV-011, FV-033, FV-040, FV-041, FV-049 |
| TOOL | FV-005, FV-012, FV-044, FV-045, execution evidence inspection |
| SCP | FV-015 through FV-022, FV-039, FV-044, FV-046, FV-047 |
| FDB | FV-013, FV-014, FV-046 |
| DAT | FV-014, FV-017 through FV-019, FV-037, FV-046, data inspection |
| TRN | FV-020, FV-023 through FV-028, FV-031, FV-047 through FV-049 |
| EVL | FV-025, FV-026, FV-028, FV-047, FV-048, FV-050, FV-051, evaluation evidence inspection |
| ADP | FV-021, FV-022, FV-029, FV-030, FV-039, FV-047 through FV-049, FV-051 |
| LRN | FV-025, FV-026, FV-032, FV-047, FV-048, FV-050, FV-051 |
| UI | Applicable functional workflow tests |
| PER | FV-034 through FV-036, FV-039 |
| SEC | FV-012, FV-017 through FV-019, FV-037, FV-038, FV-044 through FV-046 |
| PRF | FV-033, FV-040, FV-041, FV-050 |
| REL | FV-010, FV-027, FV-031, FV-033, FV-034 |
| DOC | FV-042, documentation inspection |
| TST | Verification plan inspection, FV-049 through FV-051, and actual execution records |
| MNT | Source, documentation, and verification evidence inspection |

Each verification record shall contain:

- Requirement identifiers.
- Verification scenario.
- Required initial conditions.
- Expected result.
- Actual result.
- Execution environment.
- Verification status.
- Evidence location.
- Applicable limitations.

# 22. Implementation and Maintenance Constraints

**MNT-001 — Requirement-driven implementation**

Each significant implementation change shall satisfy an applicable requirement or correct a verified defect.

**MNT-002 — Semantic naming**

Source names shall describe technical responsibilities.

The project shall not derive source names from requirement identifiers, milestones, or planning identifiers.

**MNT-003 — Existing implementation reuse**

The project shall examine existing functions before it adds replacement functions.

**MNT-004 — Shared behavior**

The project shall implement common behavior at the applicable shared source.

**MNT-005 — Dependency control**

The project shall not add dependencies when existing dependencies satisfy the requirement.

**MNT-006 — Unnecessary abstraction**

The project shall not add abstractions without a current technical requirement.

**MNT-007 — Defect correction**

The project shall correct the source of a defect rather than conceal its observable effects.

**MNT-008 — Correctness preservation**

Simplification shall not remove required validation, security, error handling, or data protection.

**MNT-009 — Verification independence**

Implementation changes shall not modify acceptance criteria to conceal defects.

**MNT-010 — Compatibility changes**

The project shall document changes that affect existing supported interfaces or persistent data.

**MNT-011 — Obsolete source**

The project shall remove obsolete source when its removal does not violate compatibility requirements.

**MNT-012 — Transparent reporting**

The project shall report implementation failures, verification gaps, and unresolved requirements.

# 23. Development Sequence

The development sequence establishes delivery priorities. It does not define implementation names.

## 23.1 Foundation

Establish the application structure and Pi integration.

Required results:

- Installable Pi extension.
- Functional Baobab communication.
- Session synchronization.
- Documented component boundaries.
- Initial functional verification.
- Verification of the installed Pi, Unsloth, and llama.cpp tools.
- Identification of the local Gemma 2B model files.
- Verification of the local gBench checkout and its llama.cpp endpoint compatibility.

## 23.2 Interactive reasoning

Establish reasoning control with the installed llama.cpp engine and the local reference model.

Required results:

- Multiple reasoning branches.
- Partial generation.
- Reasoning comparison.
- Manual correction.
- Reasoning continuation.
- Tool authorization.
- Inference capability identification.
- Independent teacher interface and control transfer.

## 23.3 Feedback and scope management

Establish persistent feedback and training boundaries.

Required results:

- Scope creation and selection.
- Scope permissions.
- Scope isolation.
- Feedback provenance for human and teacher decisions.
- Training example preparation.
- Dataset approval and versioning.

Scope isolation shall exist before shared training operations become available.

## 23.4 Supervised and preference training

Establish local model adaptation with the installed Unsloth framework and Gemma 2B.

Required results:

- LoRA and QLoRA training.
- Supervised training.
- Preference training.
- Scope-specific adapters.
- Training recovery.
- Evaluation.
- Adapter deployment and rollback.

## 23.5 Automated reasoning evaluation

Establish automatic evaluation of reasoning steps and outcomes.

Required results:

- Process reward model training.
- Independent reward model evaluation.
- Automatic branch recommendations.
- Human override.
- Supported reinforcement learning.

## 23.6 Continuous model improvement

Establish controlled automation.

Required results:

- Scheduled training.
- Independent scope policies.
- Automated evaluation.
- Controlled adapter activation.
- Regression protection.
- Versioned deployment and rollback.
- Autonomous teacher-guided training cycles with independent evaluation.
- Teaching limits, recovery, and human takeover.

## 23.7 Initial integration acceptance and deferred engine support

The project shall complete the initial llama.cpp and Unsloth integration before it starts integration of additional engines.

The initial integration shall satisfy these conditions:

- The installed Pi agent loads the extension.
- llama.cpp generates, selects, corrects, and continues student output through the reasoning controller.
- The platform prepares approved scope-specific training data.
- Unsloth trains a compatible Gemma 2B LoRA adapter.
- The platform converts the adapter when necessary and loads it in llama.cpp.
- Independent evaluation, approval, and rollback operate correctly.
- gBench records a base model baseline and a candidate adapter benchmark.
- The platform applies the benchmark acceptance criteria.
- FV-049 through FV-051 and the applicable shared functional scenarios supply actual verification evidence.

The project shall record all unresolved initial integration conditions.

After the project satisfies these conditions, it may implement additional engine integrations under a separate authorized scope of work.

NInfer, TensorFold, vLLM, generic OpenAI-compatible student inference, and alternative training engines remain deferred.

Each additional engine integration shall establish compatible adapter loading, applicable state restoration, measured performance, and functional verification.

The deferral does not remove any requirement for the initial reasoning controller, scoped training, or independent teacher-agent control.

# 24. Release Acceptance Criteria

A production release shall satisfy all mandatory requirements that apply to its declared release scope.

The project shall not claim completion of the full specification until it satisfies all mandatory requirements.

A release shall satisfy these conditions:

1. Applicable functional workflows operate correctly.
2. Applicable security and scope isolation requirements pass verification.
3. The project records actual verification results.
4. The project documents unsupported configurations.
5. The project documents unresolved compatibility conditions.
6. The project satisfies applicable performance acceptance criteria.
7. Adapter activation and rollback operate correctly.
8. Training preserves the original base model.
9. Failed operations do not corrupt persistent data.
10. Documentation describes the released software accurately.
11. The release has no unresolved defects that violate mandatory acceptance conditions.
12. A release that supports autonomous teaching satisfies the applicable teacher control, scope isolation, independent evaluation, and stop conditions.

The project shall identify each deferred requirement explicitly.

The initial release shall use the llama.cpp and Unsloth integration. The project shall apply section 23.7 before it starts other engine integrations.

# 25. Assumptions and Open Technical Conditions

The following conditions require additional investigation or verification.

| Condition | Required investigation |
|---|---|
| Baobab licensing | Confirm redistribution and modification rights. |
| Pi extension compatibility | Verify the selected Pi version and extension interfaces. |
| Partial reasoning continuation | Verify each inference engine and model combination. |
| Inference state restoration | Verify state compatibility and restoration behavior. |
| Cache sharing | Measure actual cache reuse across reasoning branches. |
| Local installed tools | Verify actual Codex, Pi, Bun, Unsloth, and llama.cpp availability and versions on the owner system. |
| Gemma 2B reference model | Identify the exact local model, tokenizer, training files, and compatible inference files. Verify adapter conversion and loading. |
| NInfer adapter support | Deferred under section 23.7. |
| TensorFold adapter support | Deferred under section 23.7. |
| Other engine support | Deferred under section 23.7. |
| Model training compatibility | Verify each selected model architecture. |
| Windows training support | Verify the installed Unsloth environment on the owner system. |
| Multi-GPU training | Verify supported device allocation and memory distribution. |
| Adapter composition | Verify compatibility and behavior with multiple adapters. |
| Long-context adaptation | Measure adapter effects on long-context model performance. |
| Process reward quality | Establish independent evaluation criteria and sufficient evaluation data. |
| Reinforcement learning | Establish hardware requirements and reward function reliability. |
| Performance thresholds | Establish measured baselines and release acceptance limits. |
| gBench compatibility | Verify the local checkout, selected suites, local tokenizer, and llama.cpp endpoint. Upstream documentation does not establish this combination as verified. |
| Benchmark improvement thresholds | Select representative held-out tasks and acceptance thresholds for each applicable scope. |
| Team deployment | Select the authentication and shared storage configuration. |
| External teacher integration | Verify at least one independent agent and its interface capabilities. |
| Teacher model and training rights | Verify provider terms, data transmission permissions, and rights to use generated output for student training. |
| Teacher effectiveness | Measure student improvement on independent tasks. Verify that teacher feedback does not reduce required general capabilities. |

The project shall not represent these conditions as verified until applicable evidence exists.

# 26. Completion Definition

The platform is complete when authorized users can perform the following operations:

1. Generate alternative model reasoning branches through Pi.
2. Examine the reasoning branches in Baobab.
3. Select, correct, or reject individual branches.
4. Continue inference from an approved reasoning checkpoint.
5. Execute authorized agent tools.
6. Record reasoning feedback and execution evidence.
7. Associate approved training data with an independent training scope.
8. Train a compatible scope-specific model adapter.
9. Evaluate the adapter against independent evaluation data.
10. Activate the approved adapter within its authorized scope.
11. Restore an earlier adapter when necessary.
12. Repeat the improvement cycle without modification of the base model.
13. Connect a separate teacher agent to guide student reasoning without continuous human input.
14. Complete an authorized autonomous teaching and scoped adaptation cycle with independent evaluation and human override.

The platform shall provide documented and independently verified functional behavior.

The project shall minimize unnecessary implementation complexity and unnecessary tests without a reduction in correctness, security, or verification quality.

**End of specification**