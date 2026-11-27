# Software Requirements Specification
## Interactive Reasoning Control and Scoped Model Adaptation Platform

| Document property | Value |
|---|---|
| Document type | Software Requirements Specification (SRS) |
| Version | 0.4.1 |
| Status | Approved baseline with benchmark amendment |
| Approval | Approved |
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
| Overall implementation status | In progress |
| Total SRS requirements | 425 |
| Verified complete | 3 of 425 |
| Overall completion | 0.7% |
| Implemented, verification pending | 0 |
| In progress | 19 |
| Blocked | 0 |
| Deferred | 0 |
| Not started | 2 |
| Not assessed | 401 |
| Remaining requirements | 422 |
| Functional verification scenarios | 51 |
| Last tracker update | 2026-11-26 |

Initial tracker entry: The initial count of zero verified requirements did not establish that implementation work had not started. Static assessment at baseline `b96b9e77699e9784998295c4782474498a6b93db` found existing Baobab conversation and provider code. The baseline contained no Pi extension source. Section 21.2 records the local tool inventory. The inventory does not verify runtime compatibility. No application code or tests ran during that assessment.

Current foundation status: API and app TypeScript builds passed. The strict Pi extension source check passed against installed Pi 1.6.1 contracts with `--skipLibCheck`. The full declaration check still fails on diagnostics in installed dependency declarations. The Pi session-boundary runner passed its covered synthetic-data assertions.

Three full candidate runner attempts and three controls-only attempts ended in failure. Candidate attempt 3 completed one real F16 candidate generation with one output token and passed its generation-gap, synthetic-cancellation, endpoint-rejection, and provider-ownership scenarios; the run later failed when cancellation-limit prefill expected HTTP 204 and received 429. A separate API-only lifecycle run passed only quiet-read cancellation, revoke, and denied-snapshot checks. The detailed outcomes remain in section 21.4.

The latest isolated synthetic panel flow observed zero pre-consent markers, a connected read-only state with two consented snapshot markers, candidate 1 pending/streaming/completed after the synthetic helper release gate, candidate 2 pending/streaming/cancelled with one fixture-observed transport abort, and revoke clearing both markers. Claim status was not captured, and no claim failure is inferred. This does not verify real-model cancellation, full context, or full FV-002/PI-004/section 23.2 acceptance. One bounded Docker probe returned version 29.6.2 while the task keeper held the engine; after cleanup, the keeper exited normally and Desktop remained present. Requirement counts remain 425: 3 verified, 19 in progress, 0 blocked, 2 not started, and 401 not assessed.

The section 23.1 serving-endpoint condition passed in one local gBench r4 run. The Unsloth import/device check passed its import and callable-symbol checks. It did not load a model or run training or generation.

ARC-021 is In progress because the run saved its performance JSON, but sample quality and Windows locking limitations remain unverified. See the current ARC-021 tracker record. Only ARC-001, ARC-003, and PI-001 are Verified complete. No full FV-002, FV-049, or FV-050 result is claimed.

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
| ARC-001 | 1 | Verified complete | `pi-baobab/src/extension.ts`; `pi-baobab/functional-tests/PiSessionBoundary.ps1`; `C:\Users\Akash\.codex\evidence\AGENT_pi-session-boundary-95a49317c8dd4b089e560998dfcecf79\result.txt` | Pi 1.6.1 installed and loaded the TypeScript extension through its supported extension interface. The actual RPC/API run passed. This verifies the public Pi extension integration slice. It does not verify controller, training, or full model operation. |
| ARC-002, ARC-006 | 2 | In progress | `README.md`; `src/App.tsx`; `src/store/useTreeStore.ts`; `src/hooks/useStreamingResponse.ts`; `src/api/providers/registry.ts`; `src/components/pi/PiSessionPanel.tsx`; `server/src/routes/piSessions.ts` | The Baobab panel uses existing interface and state. Browser checks confirm connected display, revoke, and fresh reauthorization. Transport reconnect and complete behavior remain unverified. |
| ARC-003 | 1 | Verified complete | pi-baobab/src/extension.ts; src/components/pi/PiSessionPanel.tsx; C:\Users\Akash\.codex\evidence\AGENT_baobab-23-2-build-20261126\api-typecheck-build-rerun-after-engine-restart.log; C:\Users\Akash\.codex\evidence\AGENT_baobab-23-2-build-20261126\app-typecheck-build.log | The Pi extension and graphical application use TypeScript. Both TypeScript builds passed. Runtime acceptance is tracked separately. |
| ARC-004 through ARC-005 | 2 | Not assessed | — | — |
| ARC-007 through ARC-010 | 4 | Not assessed | — | — |
| ARC-011 through ARC-012 | 2 | Not started | Repository source inventory at baseline `b96b9e7` | Identify the supported Pi functions and define the TypeScript-to-Python interface only where the verified foundation requires it. |
| ARC-013 through ARC-015 | 3 | Not assessed | — | — |
| ARC-016 | 1 | In progress | C:\Users\Akash\.codex\evidence\AGENT_preflight-summary.txt; C:\Users\Akash\.codex\evidence\AGENT_unsloth-runtime-import-20261126-r1_status.json; C:\Users\Akash\.codex\evidence\AGENT_unsloth-runtime-import-20261126-r1_operation-start.json; C:\Users\Akash\.codex\evidence\AGENT_unsloth-runtime-import-20261126-r2_status.json; C:\Users\Akash\.codex\evidence\AGENT_unsloth-runtime-import-20261126-r2_stdout.json; C:\Users\Akash\.codex\evidence\AGENT_unsloth-runtime-import-20261126-r2_stderr.txt; C:\Users\Akash\.codex\evidence\AGENT_unsloth-runtime-import-20261126-r2_cache-cleanup.json | Pi 1.6.1 loaded the extension. The Unsloth r2 import/device probe passed in Python 3.13.17. FastLanguageModel.from_pretrained, get_peft_model, for_training, SFTConfig, and SFTTrainer were callable. CUDA 13.0 saw RTX 4090 (CC 8.9) and RTX 3080 (CC 8.6). R1 failed before Python on unsupported New-Item -LiteralPath syntax. The pip check failure, GPU ordering warning, and two Torch deprecation warnings remain. No model loaded. No training or generation ran. Full Unsloth runtime and training compatibility remain unverified. See section 21.4. |
| ARC-017 | 1 | In progress | C:\Users\Akash\.codex\evidence\AGENT_preflight-summary.txt; C:\Users\Akash\.codex\tasks\pi-baobab-local-preflight.md; C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-smoke-20261126-r4_status.json; C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-smoke-20261126-r4_models.json; C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-smoke-20261126-r4_completion.json; C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r4_result.txt | The F16 Gemma model passed one raw 8-token llama.cpp smoke. gBench r4 passed one Windows CPU serving configuration and saved its output. This confirms only that local serving path. No baseline, quality, instruction-following, controller, training, or full FV-049/FV-050 result is established. See section 21.4 and linked reports for the model warning, prior gBench failures, and evidence limits. |
| ARC-018 | 1 | In progress | `C:\Users\Akash\.codex\evidence\AGENT_preflight-summary.txt` | The specified path `D:\llama.cpp\llama` does not exist. The detected `llama-cli.exe` and `llama-server.exe` are in `D:\llama.cpp`. Keep the specified path in this SRS until configuration support and documentation are complete. |
| ARC-019 | 1 | In progress | `C:\Users\Akash\.codex\evidence\AGENT_preflight-summary.txt`; `C:\Users\Akash\.codex\evidence\AGENT_gemma2b-integrity-corrected.csv`; `C:\Users\Akash\.codex\evidence\AGENT_gemma-2b-f16.gguf`; `C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-smoke-20261126-r4_status.json` | Nine HF files at pinned snapshot `9cf48e52b224239de00d483ec8eb84fb8d0f3a3a` passed cache integrity checks. The separate 5,018,535,424-byte F16 output (SHA256 `865C522D53F5E84C0A79B39789F43E829023F3D6DEA9D92F5DAD7451CBAC7E5A`) passed one exact llama.cpp load/list/raw 8-token smoke. This verifies only that run. Adapter loading, conversion parity, controller use, training compatibility, and general runtime compatibility remain unverified. The existing GGUF digest is `034B13A5431FB7C438BE09669DEF266835C938E5626774A3092A930109FD5ED7`; upstream expects `084eb1abf609fe1735c2631f818bd24e93d29428fd2ba096852012152e37d14b`. No pre-acquisition hash exists, so the cause is unknown. Keep that file held. |
| ARC-020 | 1 | Not assessed | — | — |
| ARC-021 | 1 | In progress | C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r1_result.txt; C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r2_result.txt; C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r3_result.txt; C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r4_result.txt; C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r4_status.json; C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r4_results\11-26-114131\summary.json; C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r4_results\11-26-114131\performance; C:\Users\Akash\.codex\evidence\AGENT_gbench-local-patch-bundle-20261126\MANIFEST.txt; D:\Projects\gbench | The Windows tokenizer regression test passed (1 passed, 0 skipped). R4 saved output for one successful local serving configuration. ARC-021 remains In progress because wider benchmark functions, repeatability, and Windows locking remain unverified. See section 21.4 and linked reports for r1-r4 outcomes, log-only metrics, test failures, patch provenance, and limitations. |
| PI-001 | 1 | Verified complete | `pi-baobab/package.json`; `pi-baobab/src/extension.ts`; `pi-baobab/functional-tests/PiSessionBoundary.ps1`; `C:\Users\Akash\.codex\evidence\AGENT_pi-session-boundary-95a49317c8dd4b089e560998dfcecf79\result.txt` | The actual Pi 1.6.1 CLI installed the package locally and loaded its extension. This verifies installation support. |
| PI-002 through PI-011 | 10 | In progress | pi-baobab/src/extension.ts; pi-baobab/docs/INTERFACE.md; pi-baobab/functional-tests/PiSessionBoundary.ps1; pi-baobab/functional-tests/PiCandidateBoundary.ps1; src/components/pi/PiSessionPanel.tsx; server/src/routes/piSessions.ts | The Pi session-boundary runner passed its covered synthetic checks. Three full candidate attempts and three controls-only attempts failed overall. Candidate attempt 3 completed one F16 generation with one output token, then failed cancellation-limit prefill (expected HTTP 204, received 429). A separate API-only lifecycle run passed bounded read-cancel, revoke, and denied-snapshot checks. Product-panel attempts 1–5 were partial or failed; attempt 6 passed the bounded synthetic UI flow, including candidate 1 completion through the helper release endpoint, product Cancel with fixture-observed abort, and product Revoke clearing. Claim status was not captured. No full PI-002 through PI-011 requirement is verified; real llama.cpp cancellation and full context remain unverified. See section 21.4 for failure chronology and evidence. |
| RSN-001 through RSN-026 | 26 | Not assessed | — | — |
| TCH-001 through TCH-022 | 22 | Not assessed | — | — |
| INF-001 through INF-017 | 17 | Not assessed | — | — |
| TOOL-001 through TOOL-009 | 9 | Not assessed | — | — |
| SCP-001 through SCP-042 | 42 | Not assessed | — | — |
| FDB-001 through FDB-011 | 11 | Not assessed | — | — |
| DAT-001 through DAT-030 | 30 | Not assessed | — | — |
| TRN-001 through TRN-030 | 30 | Not assessed | — | — |
| TRN-031 | 1 | In progress | `C:\Users\Akash\.codex\evidence\AGENT_preflight-summary.txt`; `C:\Users\Akash\.codex\tasks\pi-baobab-local-preflight.md` | Unsloth 2026.11.12 and its Python environment are identified. The installer manifest reports `pip_check_ok=false` with a click/data-designer issue. Training methods and model formats remain unverified. |
| TRN-032 | 1 | In progress | `C:\Users\Akash\.codex\evidence\AGENT_preflight-summary.txt`; `C:\Users\Akash\.codex\evidence\AGENT_gemma2b-integrity-corrected.csv`; `C:\Users\Akash\.codex\evidence\AGENT_gemma-2b-f16.gguf`; `C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-smoke-20261126-r4_status.json`; `C:\Users\Akash\.codex\tasks\pi-baobab-local-preflight.md` | Nine HF files at the pinned snapshot passed cache integrity checks. A separate F16 GGUF conversion output exists and passed one llama.cpp load/list/raw-token smoke. No Unsloth model load, adapter conversion/load, training, or adapter export ran. Runtime parity and training compatibility remain unverified. The original GGUF has an unresolved digest mismatch and remains held. |
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
| ARC | Architecture inspection, FV-001 through FV-003, FV-023, FV-042, FV-049, FV-050 |
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

## 21.4 Verification execution records

| Verification | Initial conditions and expected result | Actual result | Environment and evidence | Coverage and limits |
|---|---|---|---|---|
| TypeScript build (ARC-003) | Use the reviewed source in the isolated Compose project. The API and app TypeScript builds shall exit zero. | API npm run build exited 0. App npm run build exited 0; Vite built 2,500 modules. The first typecheck exposed three compiler findings. The approved fixes resolved them. | Docker project baobab-pi-23-2-build-agent-20261126; API log/exit: C:\Users\Akash\.codex\evidence\AGENT_baobab-23-2-build-20261126\api-typecheck-build-rerun-after-engine-restart.log and api-typecheck-build-rerun-after-engine-restart.exit.txt; app log/exit: app-typecheck-build.log and app-typecheck-build.exit.txt in the same directory. | Pass for ARC-003. It does not verify runtime behavior. Existing API engine/audit warnings and Vite chunk warnings remain. |
| Candidate source typecheck (PI-002 through PI-011; not acceptance) | Typecheck the Pi extension against installed Pi 1.6.1 declarations with the existing compiler. Use no-pull, no-network, and read-only mounts. | The full declaration check exited 2 with errors in installed dependency declarations. The approved strict source-only check used /app/node_modules/.bin/tsc with --resolveJsonModule and --skipLibCheck and exited 0. One launcher invocation exited before container creation because the Docker Linux engine pipe was unavailable; one later launch used a missing compiler path and exited 1 before source diagnostics. | API build log/exit is in section 21.4. Full declaration log/exit: C:\Users\Akash\.codex\evidence\AGENT_baobab-23-2-build-20261126\pi-declaration-typecheck.log and pi-declaration-typecheck.exit.txt. Source-only pass exit and compiler/image/cleanup records: C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\pi-extension-source-typecheck-r15.exit.txt, typecheck-image-used.txt, typecheck-container-after-r15.txt, and typecheck-process-after-r15.csv. | The strict source-only check passed against exported Pi contracts. The full dependency declaration set still fails. This check does not establish clean dependency declarations. |
| Runner evidence-writer check (supporting only) | Exercise result-list serialization, redaction, writer-failure capture, and continued cleanup with synthetic data. | All four assertions passed. The temporary check directory was removed. No Pi, API, model, or application runtime ran. | Check source SHA-256 `D7F2F17BC1B75E1761F09EC7B61D00F544F1E2A652C9E9D810F73B5F3ACBD0AE`; output `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\writer-cleanup-check.log`; exit, source, and process records are in that evidence directory. | This check verifies only runner evidence handling. It does not verify the Baobab product or candidate behavior. |
| Loopback fixture preflight (supporting only) | Compile the embedded synthetic streaming fixture. Check a bounded successful response, an early client abort, invalid and over-limit requests, and fixture cleanup. | The first attempt passed normal three-delta completion but failed to observe a client abort. Its result did not save the stream counters. The second attempt passed normal completion, early abort before natural completion, malformed and over-limit request rejection, and fixture cleanup. Its counters recorded one request/one completion for normal streaming and one request/one abort for cancellation. No fixture failure occurred. All three listeners and workers closed. No process deltas occurred. | First result: `C:\Users\Akash\.codex\evidence\AGENT_fixture-preflight-ea53d64548d6416380155e8037eee0cd\result.json`. Second result: `C:\Users\Akash\.codex\evidence\AGENT_fixture-preflight-c1d47db2ab6a4671b69b18a97ed51c15\result.json`; source, invocation, and process records are in `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126`. | This fixture-only evidence verifies only its local HTTP stream and cleanup behavior. It does not verify llama.cpp cancellation, candidate product behavior, or model behavior. |
| Pi provider registry ownership (PI-002 through PI-011; partial) | Inspect installed Pi 1.6.1 public registry methods and runtime refresh behavior. | `registerProvider` stores an effective extension config and schedules an offline refresh. Refresh rebuilds the composed provider object. `getRegisteredProviderConfig` returns the stored config object. Re-registration creates a new config object; unregister removes it. The extension now compares this stable config identity before cleanup and still checks `run.keepProvider` and the selected model. | Installed source and declarations: `C:\Users\Akash\node_modules\@earendil-works\pi-coding-agent\dist\core\model-runtime.js`, `model-runtime.d.ts`, `model-registry.js`, and `model-registry.d.ts`. | The installed API/source review and candidate attempt 3 support this limited ownership path. Attempt 3 observed config identity through refresh and replacement, then observed that terminal cleanup removed the candidate provider. User-selected provider preservation remains unverified. PI acceptance remains unverified. |
| Candidate runner attempt 1 (PI-002 through PI-011; no acceptance) | Run one bounded Pi candidate attempt with the approved F16 model, generic template, CPU-only llama-server, one slot, 512 context, and at most 32 output tokens. | The runner failed in its `finally` block while calling `WriteAllText` with five arguments. It produced no `result.txt` or `PASS` record. The llama-server log shows the model loaded and one task used 47 prompt-evaluation tokens and 1 output token. The API log shows the rate-limited start/fallback and later candidate-event requests. It does not record their bodies or assertion results. No browser client-heartbeat request appears. At about 90 seconds, the Pi bridge heartbeat returned 410 and the SSE stream closed. The runner did not wait for Pi cleanup after terminal events. | Runner invocation and Compose logs: `C:\Users\Akash\.codex\evidence\AGENT_baobab-23-2-build-20261126\candidate-runner-invocation.log`, `api-after-candidate-attempt.log`, `app-after-candidate-attempt.log`; server log and process-before inventory in `C:\Users\Akash\.codex\evidence\AGENT_pi-candidate-1caa3725932e4f0aa888a7f6e38cca1f`; cleanup record `C:\Users\Akash\.codex\evidence\AGENT_pi-candidate-1caa3725932e4f0aa888a7f6e38cca1f\manual-cleanup-and-outcome.txt`. Failed synthetic fixture remains under the task temp root. | No scripted assertion is accepted as passed. Manual cleanup stopped baseline-absent PID 35896 after its command line matched this run's evidence directory. PID 35896 and port 9931 are absent. No Pi, llama-server, or runner process remains. Compose containers and network were removed. |
| Candidate runner attempt 2 (PI-002 through PI-011; no acceptance) | Run one follow-up attempt with the reviewed lease renewal and Pi completion barrier. Use the approved F16 model, generic template, CPU-only llama-server, one slot, 512 context, and at most 32 output tokens. | The runner exited `FAIL` in phase `browser-cancellation` with `Pi candidate stream did not produce an event before its deadline.` Its preceding generation-gap scenario returned before the runner entered this phase. The llama-server log records one task with 47 prompt-evaluation tokens and 1 output token. The result does not retain per-candidate events. No cancellation assertion was accepted, and the missing later event has no established cause. Cleanup recorded zero failures. | Result and process evidence: `C:\Users\Akash\.codex\evidence\AGENT_pi-candidate-6ba371685be44297a86bcd9dc9352dfb\result.json`, `process-before.csv`, `process-after.csv`, `llama-server.log`; host wrapper output and inventory: `C:\Users\Akash\.codex\evidence\AGENT_baobab-23-2-run-20261126\runner-host-result.json`, `runner-host-process-before.csv`, `runner-host-process-after.csv`; API/app logs `api-after-runner-failure.log`, `app-after-runner-failure.log`. | No complete candidate requirement is accepted as passed. Owned PIDs 11068, 10352, 13108, 34896, and 2804 are absent. The llama listener and Compose containers/network are absent. Ports 3001, 5173, and 9931 are closed. The failed synthetic fixture remains. The isolated DATA_DIR was removed. Full FV-002 and candidate acceptance remain unverified. |
| Candidate runner attempt 3 (PI-002 through PI-011; no acceptance) | Run the reviewed Pi candidate runner once with the approved F16 model, generic template, CPU-only llama-server, one slot, 512 context, and at most 32 output tokens. Use fresh loopback-only API/app data. | The runner exited `FAIL` in `generation-replay-and-rate-limits`. A synthetic cancellation-limit prefill expected HTTP 204 and received 429. Before failure, provider refresh ownership passed. The F16 generation-gap scenario completed generation 2. The llama-server recorded 47 prompt-evaluation tokens and 1 output token. Synthetic browser and Pi cancellation scenarios reached `cancelled`; the runner recorded an abort event for each fixture. Endpoint rejection cases for generations 5 through 8 reached error states. The provider-collision and remaining rate-limit cases did not run. | Runner result and safe metadata: `C:\Users\Akash\.codex\evidence\AGENT_pi-candidate-737b2d90fd8343c1b7c03145f842c650\result.json` and `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\candidate-run-safe-summary.json`; llama and Pi logs and process inventories are in the same run directory. API/app logs, outer process inventories, and isolated Compose evidence are in `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126`. | No complete candidate requirement is accepted as passed. Cleanup failures in the runner result are zero. All runner-owned PIDs and the llama listener are absent. Fresh Compose containers, network, temporary data, and ports 3001, 5173, and 9931 were removed. The host wrapper recorded two unrelated OS/Waterfox process additions and did not stop them. Real llama.cpp cancellation and full FV-002 remain unverified. |
| Candidate controls-only attempt 1 (PI-002 through PI-011; no acceptance) | Run the reviewed controls-only mode with actual Pi 1.6.1, a fresh temporary API data directory, and no model server. Check cancellation limits, failed terminal tombstones, generation high-water replay, and provider collision cleanup. | The external driver exited `FAIL` before starting an API container. Docker could not connect to `npipe:////./pipe/dockerDesktopLinuxEngine`. The API image inspection therefore failed. No Pi process, API service, runner scenario, model server, or request ran. The driver removed its temporary root. No task-owned process, container, network, or port remained. Two other or unknown process additions were recorded; the driver did not stop them. | Driver: `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_candidate-controls-driver-review.ps1`, SHA-256 `97EC1EAE26AD4F57F05835EA2617073898B5B7D8DEC3A89787D9B7507B36753B`. Result: `C:\Users\Akash\.codex\evidence\AGENT_candidate-controls-1667e13a504748cb800181538fff6544\result.json`; process records are in the same folder. | Environment setup failed before the controls-only runner began. No control scenario is verified. The previously accepted provider ownership evidence remains from full runner attempt 3. Counts and PI requirement statuses do not change. |
| Candidate controls-only attempt 2 (PI-002 through PI-011; partial, overall FAIL) | Run the reviewed controls-only mode with actual Pi 1.6.1, fresh loopback API data, and no model server. Exercise cancellation limits, failed tombstones, generation high-water replay, and candidate-provider collision cleanup. | Docker Desktop became ready within the approved 75-second window. The existing API image was used without build or pull. The runner paired a synthetic Pi session, completed the cancellation/replay routine, and completed the provider-collision routine. Safe events record generation 5 replay, a provider conflict warning, the conflicting provider present, and owner cleanup absent. The runner then failed in `final-revoke` with an operation-cancelled exception. The API log records revoke HTTP 204 and snapshot HTTP 401 before cleanup. The client-side failure cause is unknown. | Readiness: `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\docker-readiness-controls-attempt2.txt`. Outer result: `C:\Users\Akash\.codex\evidence\AGENT_candidate-controls-9e972168a3cf42ef8a3e2277b195b4a4\result.json`; API log and runner output are in the same folder. Inner result and `pre-cleanup.json`: `C:\Users\Akash\.codex\evidence\AGENT_pi-candidate-b340a3f01bf2474ab205713de8337e66\result.json`. | The controls routines reached completion before the final-revoke failure. The overall controls-only runner did not pass. Inner cleanup failures were zero. The outer driver removed its Compose project, data root, and API listener. All recorded task PIDs were absent. The inner candidate-run temp root remains for failure inspection. No model server or inference ran. No requirement status changed. |
| Candidate controls-only attempt 3 (partial; overall FAIL) | Run the reviewed controls-only mode with actual Pi 1.6.1, fresh loopback API data, and no model server. Exercise the remaining cancellation, replay, and provider-collision checks. | The runner reached `candidate-provider-collision`, then failed because the pending candidate stream read did not stop after the stream closed. Safe records show the provider-conflict warning and successful Pi command response. The cause of the pending read is not established. No overall controls run passed. | Outer result, API log, and runner output: `C:\Users\Akash\.codex\evidence\AGENT_candidate-controls-2cc7d69127c04ccab3dc780535c73c30`. Inner result: `C:\Users\Akash\.codex\evidence\AGENT_pi-candidate-6c9b2ad2a23047c9aca944ed40c9e492\result.json`. | The driver removed its temporary root, Compose project, network, and API listener. No task-owned process remained; one other or unknown process addition was recorded and not stopped. No model server ran. The failed pending read does not verify complete controls acceptance. |
| API-only lifecycle setup failure (no probe; no acceptance) | Use the existing API image with a unique Compose project, temporary data, and no build or pull. Start the API lifecycle check and verify health and cleanup. | The runner called Docker without the `compose` subcommand. Docker exited 125 with `unknown flag: --project-name` before Compose configuration. No API container, network, or probe ran. Temporary data and ports were removed. | `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_sse-api-compose-state.json`; `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_sse-api-setup-failure-cleanup-verification.json`. | Setup failure only. API lifecycle behavior remains unverified. No requirement status changed. |
| Product-panel browser attempt 1 (partial; no acceptance) | Use the approved isolated Traycer browser, temporary Pi 1.6.1 helper, app/API project, synthetic branch, and loopback stream fixture. Check pre-consent visibility, actual code entry and consent, candidate states, cancellation, and revoke. | The isolated browser loaded the app and clicked Pair Pi session. The first synthetic-marker count failed because the Traycer locator rejected the regular-expression target. No helper pairing request ran. No code was fetched or entered. No consent, claim, session transfer, candidate command, or fixture stream occurred. The helper stopped with zero candidates and zero fixture requests. Its Pi process exited 0. The driver removed the Compose project and temporary root. It recorded 29 other process additions; no unrelated process was stopped. | Browser record: `C:\Users\Akash\.codex\evidence\AGENT_product-panel-88fb427d2e5a47679571c5cf8c6e9e5f\browser-outcome.txt`. Helper and driver records are in the same directory: `helper-result.json`, `driver-result.json`, process inventories, Compose logs, and safe readiness data. | This attempt does not verify panel pairing, candidate UI, or revoke. The underlying locator failure is recorded. No full-flow retry or requirement promotion occurred. |
| Product-panel browser attempt 2 (partial; no acceptance) | Use the reviewed helper r2, driver r1, corrected browser steps r3, and an isolated Traycer browser. Check pre-consent visibility, actual code entry and consent, candidate states, cancellation, and revoke. | The app loaded and the `Pair Pi session` control opened the panel. Both exact synthetic marker counts were zero before consent. The next `/start` request failed in Traycer evaluation argument validation because the call nested `body: undefined`. The request did not reach the helper. No Pi pair, code transfer, consent, claim, session-text transfer, candidate, or provider request occurred. The helper recorded only `preconsent=empty`. It stopped with Pi exit 0 and zero fixture requests. | `C:\Users\Akash\.codex\evidence\AGENT_product-panel-576ae34583484d0a8d8ba7186f07ce99\browser-outcome.txt`; `helper-result.json`; `driver-result.json`; process inventories and Compose logs in the same directory. | Driver cleanup removed the unique Compose project, temporary data, helper, Pi process, fixture listeners, and app/API ports. The driver recorded two unrelated process additions, Traycer and Waterfox; it stopped neither. The isolated browser session was closed. This attempt does not verify pairing, candidate UI, cancellation, or revoke. No retry or requirement promotion occurred. |
| Product-panel browser attempt 3 (partial; no acceptance) | Use the approved r5 steps in the isolated Traycer browser with the reviewed helper/driver, synthetic Pi session, and local stream fixture. Check exact pre-consent markers, actual code entry/consent, snapshot markers, candidate states, cancellation, and revoke. | The app loaded and the panel opened. Both exact pre-consent marker counts were zero. The volatile code was entered in the password field; the consent checkbox was checked; and the actual approval button was clicked. The connected-label wait failed before observing the label because its timeout exceeded the Traycer locator limit of 30,000 ms. The claim outcome and post-consent snapshot were not observed. No candidate started; fixture requests remained zero. | Readiness record: `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\docker-readiness-panel-attempt3.txt`. Browser outcome: `C:\Users\Akash\.codex\evidence\AGENT_product-panel-c93a959c482a4e6cb17b122a0aa10a81\browser-outcome.txt`; helper and driver results are in the same directory. | Helper cleanup completed; Pi exited 0; fixture listeners/workers closed; no task containers, networks, listeners, or owned survivors remain; temporary root removed. Four other process additions (Traycer, Waterfox, and two associated processes) were recorded and not stopped. The isolated browser session was closed. This attempt does not verify pairing, snapshot display, candidate states, cancellation, or revoke. No retry or requirement promotion occurred. |
| Product-panel browser attempt 4 (partial; no acceptance) | Use the approved r6 steps in the isolated Traycer browser with the reviewed helper/driver, synthetic Pi session, and local stream fixture. Check pre-consent visibility, pairing consent, both initial snapshot markers, candidate states, cancellation, and revoke. | Pre-consent marker counts were 0/0. The code-field fill, consent check, approval click, connected-label wait, and both snapshot-marker waits completed. Candidate 1 reached pending, streaming, and completed. The browser cell then exceeded 120 seconds without returning a result object. Safe helper records show two candidate starts, two fixture requests completed naturally, zero aborts, and zero failures. The browser did not record candidate 2 cancellation or revoke. | Browser result: `C:\Users\Akash\.codex\evidence\AGENT_product-panel-6b8c8345848d4e9fa7a8957e07c80cc4\browser-outcome.txt`; helper result: `C:\Users\Akash\.codex\evidence\AGENT_product-panel-6b8c8345848d4e9fa7a8957e07c80cc4\helper-result.json`; driver result: `C:\Users\Akash\.codex\evidence\AGENT_product-panel-6b8c8345848d4e9fa7a8957e07c80cc4\driver-result.json`; process inventories and Compose logs are in the same directory. | Product-panel attempt 5 opened the app, observed zero pre-consent markers, started pairing, and completed code entry, consent, and approval. Cell 5 failed at its initial remainingTimeout guard before the connected waitFor call. No connection or snapshot marker was observed. Claim status is unavailable; no claim failure is inferred. The helper stopped and its resources were cleaned. No complete panel flow is verified. Cleanup completed with no owned survivors, containers, networks, listeners, or temporary root. Three unrelated process additions were recorded and not stopped. The isolated browser session was closed. No retry or requirement promotion occurred. |
| Panel deadline-budget sanity check (supporting only) | In an isolated `about:blank` browser context, check a positive 25-second cap, a 100-millisecond near-deadline budget, and expired-budget rejection. Make no network requests. | All three assertions returned true. The isolated browser session closed. | Source: `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_panel-budget-sanity-r1.md`; SHA-256 `6390D69F4680954B8D51F762ADE99326F3BB6490C22FCE25020E1944767213FC`. Result: `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_panel-budget-sanity-r1-result.txt`. | This check verifies only duration arithmetic. It does not verify a browser action, product flow, or panel acceptance. |
| Product-panel r9 readiness (no panel run) | Verify ports 3001/5173, existing API/app image identities, and restore the existing Docker engine once within 75 seconds. Do not build or pull. | Ports were free. The readiness result has `dockerProbes: []` because the wrapper stored image-inspection results in that field and did not retain the overwritten polling responses; the empty array does not prove that no info probe ran. The readiness after-snapshot recorded Docker Desktop PID 40376 as a child of PowerShell PID 25004; both were present in that snapshot. A later diagnostic snapshot found both absent. The launcher did not capture Desktop stdout/stderr or exit code. Shell cleanup could have ended the child, but an application exit is also possible; the evidence does not distinguish them. The effective context was `desktop-linux` at the expected pipe, with no endpoint overrides. `docker version` and `docker info` each exited 1 because the pipe path was not found. No Desktop/backend process remained in the later snapshot. WSL metadata says `timedOut=false`, exit `-1`, and output reports no running distributions; no timeout or termination was recorded, and the exit status is unexplained. The targeted log tail had no matching engine-start/error lines. No Compose project, app/API container, helper, Pi process, or panel flow started. | Readiness record and inventories: `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_panel-r9-readiness-785cf68364f74e9a97367dff6fa432f5`. Read-only diagnostics: `C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_docker-readonly-diagnostic-r2\result.json`, process inventories, and targeted log samples. | Setup failure only. No panel state was observed. Ports 3001 and 5173 remain free. Do not retry readiness or the panel flow under this release. Requirement counts do not change. |
| Docker startup observer r4 (diagnostic; no application flow) | Start Docker Desktop once if no existing process is present. Wait up to 75 seconds. Run one docker info probe with a five-second bound. Check the recorded process identity from a separate read-only command while the observer is active. | Desktop PID 38532 remained alive at the 75-second deadline. The single docker info probe exited 0 within five seconds and returned version 29.6.2. The result records no primary or cleanup error. The separate check found PID 38532 at the expected executable path with parent PowerShell PID 7208. Its creation timestamp differed from the observer record by 500 nanoseconds. The check ran before the 75-second observation ended. | Observer result, launch status, process inventories, stdout/stderr, and targeted log sample: C:\Users\Akash\.codex\evidence\AGENT_docker-start-observation-19721636b88c4134b5e69ed5c0d27ff5. Source: C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_docker-startup-observer-r4.ps1, SHA-256 1946DA0D26A249833FB002971A2E7B2F15118385604631CEBA340942D659DDCC. Traycer shell ID e1b94066-bea5-43a7-9616-b2739428190c. | The engine answered during this observation. The result does not establish current Docker state or application acceptance. PowerShell returned to its prompt after writing the result. The Traycer shell then exited with code 0 at 2026-11-27T07:39:01.986Z. The agent did not stop the shell. No process check ran after the script returned because the shell exited. No container, API/app service, helper, Pi process, panel flow, build, or pull ran. The shell exit cause is unknown. Requirement counts did not change. |
| API-only lifecycle attempt 2 (setup failure; no probe) | Run the reviewed API-only driver and lifecycle probe against the existing API image with loopback access. Use the driver's readiness check. Do not build or pull. | The driver failed in docker-readiness because the Docker Desktop Linux engine pipe was missing. The observer PowerShell and Traycer shell had exited before this attempt. Image inspection, Compose configuration/startup, and the API probe did not run. The driver found no new task process and closed its checked ports. It did not verify the pre-existing container baseline. Its default before/after arrays were empty, so their equality is not evidence that existing containers were unchanged. The final docker ps diagnostic also failed while the engine was unavailable. The temporary root was removed. The evidence does not establish that shell exit caused the missing pipe. | Outcome and inventory interpretation: C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_sse-api-only-run-outcome.json and AGENT_sse-api-only-run-inventory-interpretation.txt. Driver shell log: C:\Users\Akash\.traycer\commands\0887bc7c-c427-4510-a2c6-c04aa784edb2\bc7ccead-7b85-4637-aa1c-c88c9b4215d3\output.log. Driver SHA-256 8926471BC568F05F30722539E8219028AA2D6F5696EB51721A5AFEBB61B8C49D; probe SHA-256 A8EADD987C6BCE7EDFDC28B64D2A6D3BF7F2C114D6E00CF1307FDED3FEF05459. | Setup failure only. No API lifecycle assertion ran. This invocation created no Compose resource. The pre-existing container set remains unknown. The temporary root and task processes are absent. Ports were closed at exit. Requirement counts did not change. |
| Docker startup keeper r1 (bounded engine observation; keeper active) | Run the reviewed wrapper once in a monitored Traycer shell. Allow r4 to start Desktop only if absent and issue one bounded docker info request. Keep the same PowerShell process active. | The liveness summary at 2026-11-27T08:28:08Z showed holding status and an advanced heartbeat. Traycer shell 8e5467fa-50de-4571-b595-6d2cee6c1a4c remained running at 08:29:39Z and emitted a later heartbeat. Keeper and observer PID 40316 were present. Desktop PID 35464 was present at the expected path with parent PID 40316. Its normalized process creation time differed from the recorded value by 0.0007 ms. The single docker info probe exited 0 within five seconds and returned 29.6.2. The observer recorded no primary or cleanup error. | Keeper liveness summary: C:\Users\Akash\.codex\evidence\AGENT_docker-lived-observation-e79285cb5fff46599fc29bd29114c89a\keeper-liveness-summary-r1.json. Keeper status and release path are in the same root. Observer result: C:\Users\Akash\.codex\evidence\AGENT_docker-lived-observation-e79285cb5fff46599fc29bd29114c89a\AGENT_docker-start-observation-877a02fcc8f64ddfb2299fcdafede283\result.json. Traycer shell output is under C:\Users\Akash\.traycer\commands\0887bc7c-c427-4510-a2c6-c04aa784edb2\8e5467fa-50de-4571-b595-6d2cee6c1a4c. | Docker answered while its recorded PowerShell parent was active. This does not verify image availability, containers, API, app, Pi, model, panel, or section 23.2 acceptance. The later API-only lifecycle and panel attempts have separate execution records. After API and panel cleanup, the task-owned release signal was written. The Traycer shell exited normally with code 0. A separate post-release CIM check found Desktop PID 35464 present at its recorded executable path. No process stop action occurred. The later Desktop lifetime and any exit cause remain unknown. Requirement counts did not change. |
| API-only SSE lifecycle run (bounded pass; no requirement promotion) | Run the reviewed API-only lifecycle check through the local API. Use temporary data and the existing image. Do not build or pull. | Quiet-read cancellation completed. Revoke returned 204. The denied snapshot returned 401 with complete response bodies. The run matched five existing containers through cleanup and released its ports. The field readCompletedAfterDispose=false is a pre-cancel state flag. It does not mean a read continued after disposal. | Raw result: C:\Users\Akash\.codex\evidence\AGENT_sse-lifecycle-3ab3fe815f3947a785ea81e4b10158ff\result.json; process-before.csv and process-after.csv are in the same directory. | This verifies only the listed API-only lifecycle checks. It does not verify browser state, model behavior, or full FV-002 / PI-004 / section 23.2 acceptance. Counts did not change. |
| Product-panel attempt 5 (partial; flow timed out before connection) | Use the approved r9 steps, r3 helper, and r1 driver with an isolated Traycer browser, temporary Pi/API data, and synthetic fixture. Allow no more than two streams. | Cell 1 opened the app. Cell 2 found zero pre-consent markers. Cell 3 started the actual Pi pairing prompt. Cell 4 entered the real volatile code, checked consent, and clicked Approve. Cell 5 threw panel_deadline_expired in its initial remainingTimeout guard before the Connected read-only waitFor call. No connection or snapshot marker was observed. The claim status was not captured in the sanitized browser, helper, or driver records, so no claim failure is inferred. It did not start either candidate, cancel, or revoke. The reviewed shutdown cell found the flow deadline expired. A task-owned helper shutdown request then returned 204. | Safe browser outcome: C:\Users\Akash\.codex\evidence\AGENT_product-panel-e15cb97d757f4fd987831ab914441c45\browser-outcome-r1.json. R9 timing diagnosis: C:\Users\Akash\.codex\evidence\AGENT_baobab-pi-candidate-review-20261126\AGENT_product-panel-r9-timing-diagnosis-r1.md. Driver result and helper counters: driver-result.json and helper-result.json in the same directory. Source hashes are in browser-outcome-r1.json. | The driver exited with helper_stopped_cleanly and exit code 0. Containers, networks, listeners, and owned survivors were zero. The temporary root was removed. Two other or unknown process additions were recorded and left running. The isolated browser session closed. This attempt is not a complete panel pass. No retry or requirement promotion occurred. |
| Synthetic browser/store generation recovery (partial; no UI acceptance) | In the isolated built-in browser, keep the Pi panel closed and test the store with synthetic generation events. Clear the state in `finally`. | Generation 2 was accepted. A delayed generation 1 delta was ignored. Replay restored generation 2. Cleanup verified that capability, snapshot, and candidate were null. | `C:\Users\Akash\.codex\evidence\AGENT_baobab-23-2-build-20261126\browser-store-generation-gap.txt`; isolated browser profile at `http://localhost:5173/baobab/`. | Synthetic in-memory store behavior only. No API request, model call, or product panel interaction occurred. It does not verify candidate UI behavior or section 23.2 acceptance. |
| Pi extension install and session boundary (ARC-001, PI-001; partial FV-001/FV-003/FV-042) | Start from a fresh temporary Pi project, config, session, and API process. Use a synthetic session fixture. The installed Pi shall load the extension and exercise the scoped pairing/API protocol. | Follow-up run status is `PASS`. It installed and loaded the extension with Pi 1.6.1. The assertions covered anonymous denial, false consent, claim race and replay, tombstones, snapshot filtering and byte limits, authenticated SSE and a second snapshot connection, cancellation, revoke, disable, and session switching. The first run failed at a Boolean assertion and is preserved. | Pi 1.6.1; Bun 1.4.0; synthetic JSONL; isolated API/app; success record `C:\Users\Akash\.codex\evidence\AGENT_pi-session-boundary-95a49317c8dd4b089e560998dfcecf79\result.txt`; API log `C:\Users\Akash\.codex\evidence\AGENT_baobab-foundation-20261126\api-functional-run.log`; initial failure `C:\Users\Akash\.codex\evidence\AGENT_pi-session-boundary-fe135a4d3aa749af8a26a46bdb38f524`. | Complete for the foundation integration slice of ARC-001 and installation support PI-001. Partial for FV-001, FV-003, and FV-042. No model ran. It does not verify normal inference (FV-002), full graphical synchronization, or the remaining PI requirements. |
| Browser connected, revoke, and reauthorization (partial FV-003/FV-042) | Use an isolated browser profile, empty Baobab landing page, fresh Pi 1.6.1 session with synthetic JSONL, and loopback-only API. Pairing shall require explicit consent and show only approved text. Revoke shall clear the view. | The landing panel opened without a conversation or model request. Submit stayed disabled before consent. After fresh consent, it showed `Connected · read only` and both synthetic visible markers. Revoke showed the revoked state and removed the markers. A new Pi code and consent restored the same synthetic session. Pi shutdown then cleared the view. | Built-in Traycer browser at `http://localhost:5173/baobab/`; DOM record `C:\Users\Akash\.codex\evidence\AGENT_baobab-foundation-20261126\browser-connected-flow.txt`; API summary/log `C:\Users\Akash\.codex\evidence\AGENT_baobab-foundation-20261126\api-browser-ui-summary.txt`, `api-browser-ui.log`; helper state/process records in the same evidence directory. | Connected, revoke, snapshot clearing, and fresh reauthorization passed. Browser transport reconnect without fresh pairing, expiry UI, full FV-042, and FV-002 remain unverified. The browser used native DOM click events after locator clicks did not change the two React controls. Screenshots were not used. |
| llama.cpp model smoke (ARC-017/TRN-032 partial) | Load the separate converted F16 Gemma file, list the served model, and return one raw 8-token completion. | One server load/list/raw completion passed in 12.838 seconds. Alias was `google/gemma-2b`; response predicted 8 tokens. PID 27216 exited and port 9931 closed. The server warned that `</s>` was overridden. | Run r4 status, models, completion, server log, and process evidence under `C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-smoke-20261126-r4_*`. | Model smoke only. No gBench, training, adapter load, parity, quality, controller, or full FV-049/FV-050 acceptance ran. The after-port CSV is missing. |
| Unsloth import and device probe (ARC-016 partial) | Run one bounded import-only probe in the installed Studio Python environment. Use isolated generated-code, Hugging Face, and Torch caches. Do not load weights or start a trainer. | R1 stopped before Python because New-Item -LiteralPath is unsupported in this PowerShell command. No import ran in r1. Reviewed r2 exited 0 in 28.4 seconds. Imports passed. FastLanguageModel.from_pretrained, get_peft_model, for_training, SFTConfig, and SFTTrainer were callable. CUDA 13.0 was available with an RTX 4090 (CC 8.9, 25,479,479,296 bytes) and RTX 3080 (CC 8.6, 12,659,458,048 bytes). No CUDA query error occurred. | R1 operation-start, preflight, status, postcheck, and cleanup files; r2 status, stdout, stderr, preflight, cache cleanup, and before/after process records under C:\Users\Akash\.codex\evidence\AGENT_unsloth-runtime-import-20261126-r1_ and ...-r2_. | Import/device evidence only. The GPU ordering warning and two Torch deprecation warnings remain. The existing pip_check_ok=false condition remains. Cache and owned-process cleanup completed. No model load, trainer call, training, generation, or general compatibility test ran. ARC-016 remains In progress. |
| gBench endpoint attempts (ARC-021) | Start the existing Windows gBench CLI against the healthy local llama.cpp server. Verify tokenizer loading, endpoint readiness, planned chat requests, and result persistence. | R1 failed before requests because Python lacked fcntl. R2 failed because tokenizer-path validation rejected the local F: path. The focused Windows tokenizer test passed (1 passed, 0 skipped). R3 logged 14 generations, then failed to persist the performance file with WinError 123. R4 exited 0: one configuration succeeded, 12/12 measured requests completed, 0 failed/empty, 16 tokens each, and its performance JSON was saved. The server logged 2 warmups plus 12 measured generations (224 tokens total). | R1-R4 logs and results. R4 report SHA-256 213CA8FACB0F290C4C532BDD02380AE1AFEB2BDE5170FC856BE86AEFD99908F1; status and saved output under C:\Users\Akash\.codex\evidence\AGENT_gbench-gemma2b-endpoint-20261126-r4_results\11-26-114131\. Patch manifest: C:\Users\Akash\.codex\evidence\AGENT_gbench-local-patch-bundle-20261126\MANIFEST.txt. Existing-file test transcript: C:\Users\Akash\.codex\evidence\AGENT_gbench-artifact-path-existing-file-pytest-20261126.txt. PIDs 30480/5648 exited; port 9931 closed. | One local Windows CPU serving path passed. Results are not a baseline: one iteration, low confidence, TTFT/TPOT P50 and P99 invalid, ITL n=180, and throughput repeatability unassessed. Five file tests failed on Windows fcntl locking, and one lazy-quality monkeypatch test failed. The transcripts are labeled transcriptions. Cross-process locking, broader benchmark functions, quality, and instruction following remain unverified. The generic template is not native Gemma serialization. No full gBench suite passed. |
| Product-panel browser attempt 6 (bounded synthetic flow; no requirement promotion) | Use the reviewed r10 steps, helper r3, and driver r1 with an isolated Traycer browser, temporary Pi/API data, existing images, and the synthetic stream fixture. Check no pre-consent text, actual code/consent, initial snapshot, completion, cancellation, transport abort, and revoke. | The browser observed zero pre-consent markers, filled the actual pairing field with the volatile code, checked consent, and approved. It observed the connected read-only state and both synthetic snapshot markers. Candidate 1 reached pending and streaming; the synthetic helper /candidate/release-first endpoint allowed the fixture to complete; no product UI release control was used. Candidate 2 reached pending and streaming; the real cancel control produced a visible cancelled state and one fixture-observed transport abort before natural completion. Fixture metrics were 2 requests, 1 completed, 1 aborted, and 0 failures. Revoke cleared both markers. Claim status was not captured; no claim failure is inferred. | Safe browser result: `C:\Users\Akash\.codex\evidence\AGENT_product-panel-ba8b451e81d94a798199141f75583752\browser-safe-result-r2.json` (SHA-256 `D65B8EE6A61B4284F4150F3C0E4E324AACA3410D91EC6414069EF41E8EF9F57E`). Driver/helper results and process/Compose records are in the same directory. Steps r10 SHA-256 `9A5FBBCC9A8CC83F24E19387F7FDEC4578CA91E533BB678D698973F669058C79`; helper r3 SHA-256 `62AD586542AE931925F1C37B2937F8C8A0D933C94BD858FA614D7FEA66AA30BE`; driver r1 SHA-256 `79A5FE171E98114327E87D4FE2262DBD43D5C209754FD83DF87F1DBB01BA2603`. | The driver/helper reported exit 0, cleanup complete, no remaining task containers, networks, listeners, or owned processes, and a removed temporary root. Four other or unknown process additions were recorded and left running. Ports 3001, 5173, 61441, and 61440 closed. The isolated browser session closed. This checks only the synthetic panel and fixture transport. Real-model cancellation, complete context behavior, and full FV-002/PI-004/section 23.2 acceptance remain unverified. Requirement counts did not change. |
| Docker startup keeper r2 (single bounded engine observation; released) | Run the reviewed same-process keeper with the reviewed observer. Allow one bounded engine-info probe. Hold the keeper through the isolated panel attempt, then release the exact task-owned signal after cleanup. | The single probe exited 0 and returned Docker version 29.6.2. Keeper PID 36648 held through the panel run. After the release signal, Traycer shell `bfdd6163-7333-4b09-a546-c3dfbbe04704` exited 0 and keeper PID 36648 was absent. Desktop PID 35464 remained present at its recorded executable path. No process stop occurred. | Keeper status, observer result, and release audit: `C:\Users\Akash\.codex\evidence\AGENT_docker-lived-observation-72cc08dfd2514c43a17adfcb1db01357`; post-release audit SHA-256 `F8BF5B5FAB696AD7E746C26C06FC6461BC060FC899018AE03229CF1547DF22C2`. Panel driver project: `baobab-panel-ba8b451e81`. | This is one engine availability observation only. It does not establish model or application acceptance. The prior missing-pipe cause remains unknown. Desktop was not stopped. Requirement counts did not change. |
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

Status: In progress. API and app builds passed. The actual Pi 1.6.1 RPC/API runner passed with synthetic session data. Browser checks confirmed landing access, connection, revoke, and fresh reauthorization. Browser transport reconnect and expiry remain unverified.

The Unsloth import/device check confirmed callable imports and two CUDA devices. It did not load the Gemma model or verify training compatibility. Section 21.4 records the r1 launcher failure and r2 result.

Required results:

- Installable Pi extension.
- Functional Baobab communication.
- Session synchronization.
- Documented component boundaries.
- Initial functional verification.
- Verification of the installed Pi, Unsloth, and llama.cpp tools.
- Identification of the local Gemma 2B model files.
- Verification of the local gBench checkout and its llama.cpp endpoint compatibility.

Traceability: This boundary addresses applicable portions of ARC-001 through ARC-021 and PI-001 through PI-011. It does not complete requirements that need later training, Python integration, or recovery behavior. Use shared scenarios FV-001, FV-002, FV-003, and FV-042. Use only the foundation checks in FV-049 and FV-050 for local tool and endpoint compatibility. Section 21.3 maps the full verification groups. Section 23.7 retains full initial-integration acceptance, including FV-049 through FV-051.

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

Status: The first candidate slice remains in progress. API and app TypeScript builds passed, and the strict Pi source-only typecheck passed; the full dependency declaration check still reports errors in installed declarations. The Pi session-boundary runner passed its covered synthetic checks. Three full candidate attempts and three controls-only attempts failed overall. Candidate attempt 3 completed one F16 generation with one output token and partial scenarios, then failed cancellation-limit prefill (expected HTTP 204, received 429). A separate API-only lifecycle run passed only its bounded read-cancel, revoke, and denied-snapshot assertions. Product-panel attempt 6 passed the bounded synthetic UI and fixture flow: candidate 1 completed after the helper release gate; product Cancel led to a fixture-observed transport abort; product Revoke cleared the snapshot. Claim status was not captured. This does not verify real llama.cpp cancellation or full context. See section 21.4 for the complete chronology. The slice does not change Pi active model, write to its session, or run tools. Output is model output, not hidden reasoning. Visible text may contain secrets. Structural filtering cannot remove secrets from text.

Candidate events use a separate, generation-ordered channel. Discovery and model requests reject redirects outside the selected loopback origin. This text-only slice does not preserve full Pi context and does not complete PI-004. The updated runner keeps F16 completion separate from synthetic loopback cancellation and rejected-command checks. Real llama.cpp cancellation and complete candidate acceptance remain unverified.

Traceability: This slice supplies partial implementation for PI-002, PI-003, PI-005, and PI-009, and supports shared scenarios FV-001, FV-002, FV-003, FV-011, FV-012, and FV-042. No requirement is Verified from source inspection. Multiple branches, comparison, manual correction, accepted continuation, tool authorization, state restoration, teacher control transfer, and full FV-002/FV-049/FV-050 remain unverified.

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
