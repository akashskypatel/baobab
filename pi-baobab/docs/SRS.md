# Software Requirements Specification
## Interactive Reasoning Control and Scoped Model Adaptation Platform

| Document property | Value |
|---|---|
| Document type | Software Requirements Specification (SRS) |
| Version | 0.1.0 |
| Status | Draft |
| Architecture | Pi, Baobab, TypeScript, Python |
| Writing standard | ASD-STE100 Simplified Technical English |
| Primary verification method | Functional requirement testing |

# 1. Introduction

## 1.1 Purpose

This document specifies the requirements for an interactive reasoning control and model adaptation platform.

The platform shall let users examine, select, modify, and evaluate reasoning that a language model generates.

The platform shall collect user feedback and verified results as training data. The platform shall use this data to improve subsequent model behavior.

The platform shall support independent training scopes. A training scope shall control the data, training operations, and model adapters available to an authorized user.

## 1.2 Objectives

The platform has these objectives:

- Give users control of model reasoning before the model completes a response.
- Generate alternative reasoning paths from a common context.
- Let users correct incorrect or inefficient reasoning.
- Preserve reasoning paths and their associated evidence.
- Convert verified user feedback into training data.
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
| Feedback recorder | Collection of user decisions and execution results |
| Scope manager | Management of training scope and access permissions |
| Dataset manager | Preparation and validation of training data |
| Training engine | Model adaptation and reward model training |
| Evaluation engine | Measurement of model behavior |
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
| Feedback | A user decision about model behavior |
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
| Approved | The user authorizes the branch |
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

**RSN-025 — Manual interruption**

The platform shall let the user interrupt automatic reasoning control.

**RSN-026 — Cancellation**

The platform shall let the user cancel an active reasoning operation.

The platform shall release resources that the cancelled operation no longer uses.

# 5. Inference Requirements

## 5.1 Inference engine integration

**INF-001 — Initial inference engine**

The platform shall support llama.cpp as an initial local inference engine.

**INF-002 — Additional inference engines**

The architecture shall permit support for additional inference engines.

Candidate inference engines include:

- NInfer.
- TensorFold.
- vLLM.
- OpenAI-compatible inference interfaces.
- Other supported local or remote inference engines.

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

The platform shall record authorized user feedback about reasoning branches.

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
- External evaluation.

**FDB-008 — Feedback revision**

The platform shall let authorized users revise feedback.

The platform shall preserve the revision history.

**FDB-009 — Feedback consent**

The platform shall let users control whether their reasoning interactions become training data.

**FDB-010 — Evaluation independence**

The platform shall not represent user preference as proof of technical correctness.

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
| Correction | User modifications and guidance |
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

The platform shall reuse established training frameworks.

Candidate frameworks include PyTorch, Transformers, PEFT, TRL, and Unsloth.

**TRN-010 — Independent framework selection**

The platform shall permit replacement of a training framework without changes to the reasoning record format.

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
2. Collect user feedback.
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

## 13.2 Terminal interface

**UI-014 — Terminal control**

The platform shall provide terminal controls through the Pi extension.

**UI-015 — Terminal status**

The platform shall display the active reasoning mode, training scope, and adapter configuration.

**UI-016 — Graphical interface access**

The platform shall let the user open the graphical interface from Pi.

**UI-017 — Interface consistency**

The graphical and terminal interfaces shall use the same authoritative application state.

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

The initial reference environment shall include:

| Component | Reference configuration |
|---|---|
| Operating system | Windows |
| Processor | AMD Ryzen 7 9800X3D |
| Primary GPU | NVIDIA RTX 4090, 24 GB VRAM |
| Secondary GPU | NVIDIA RTX 3080, 12 GB VRAM |
| System memory | 128 GB |

This configuration does not establish compatibility with all model sizes or training configurations.

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
| Scope management guide | Scope creation, permissions, inheritance, and isolation |
| Adapter management guide | Selection, conversion, deployment, and rollback |
| Compatibility matrix | Supported models, engines, frameworks, and hardware |
| Security description | Trust boundaries, permissions, and protected data |
| Development guide | Development environment and contribution procedures |
| Verification plan | Functional verification methods and acceptance criteria |
| Verification report | Actual results, failures, and verification limitations |
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

The project shall execute functional inference tests with at least one supported local inference engine.

**TST-023 — Real training verification**

The project shall execute a complete training, evaluation, and deployment workflow with a compatible model.

**TST-024 — Reduced test models**

The project may use small models for routine functional verification.

Reduced test models shall exercise the same required application behavior.

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

The scenario identifiers do not identify individual test files or implementation functions.

# 21. Requirements Verification Matrix

The project shall maintain a detailed verification matrix during implementation.

The following table defines the initial verification groups.

| Requirement group | Primary verification |
|---|---|
| ARC | Architecture inspection, FV-001, FV-023, FV-042 |
| PI | FV-001 through FV-003, FV-005, FV-012, FV-034 |
| RSN | FV-004 through FV-011, FV-013 |
| INF | FV-004, FV-008 through FV-011, FV-033, FV-040, FV-041 |
| TOOL | FV-005, FV-012, execution evidence inspection |
| SCP | FV-015 through FV-022, FV-039 |
| FDB | FV-013, FV-014 |
| DAT | FV-014, FV-017 through FV-019, FV-037, data inspection |
| TRN | FV-020, FV-023 through FV-028, FV-031 |
| EVL | FV-025, FV-026, FV-028, evaluation evidence inspection |
| ADP | FV-021, FV-022, FV-029, FV-030, FV-039 |
| LRN | FV-025, FV-026, FV-032 |
| UI | Applicable functional workflow tests |
| PER | FV-034 through FV-036, FV-039 |
| SEC | FV-012, FV-017 through FV-019, FV-037, FV-038 |
| PRF | FV-033, FV-040, FV-041 |
| REL | FV-010, FV-027, FV-031, FV-033, FV-034 |
| DOC | FV-042, documentation inspection |
| TST | Verification plan inspection and actual execution records |

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

## 23.2 Interactive reasoning

Establish reasoning control with a supported local inference engine.

Required results:

- Multiple reasoning branches.
- Partial generation.
- Reasoning comparison.
- Manual correction.
- Reasoning continuation.
- Tool authorization.
- Inference capability identification.

## 23.3 Feedback and scope management

Establish persistent feedback and training boundaries.

Required results:

- Scope creation and selection.
- Scope permissions.
- Scope isolation.
- Feedback provenance.
- Training example preparation.
- Dataset approval and versioning.

Scope isolation shall exist before shared training operations become available.

## 23.4 Supervised and preference training

Establish local model adaptation.

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

## 23.7 Expanded inference support

Establish additional supported inference integrations when necessary.

Required results:

- Verified engine compatibility.
- Compatible adapter loading.
- Applicable state restoration.
- Documented performance results.
- Updated functional verification.

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

The project shall identify each deferred requirement explicitly.

# 25. Assumptions and Open Technical Conditions

The following conditions require additional investigation or verification.

| Condition | Required investigation |
|---|---|
| Baobab licensing | Confirm redistribution and modification rights. |
| Pi extension compatibility | Verify the selected Pi version and extension interfaces. |
| Partial reasoning continuation | Verify each inference engine and model combination. |
| Inference state restoration | Verify state compatibility and restoration behavior. |
| Cache sharing | Measure actual cache reuse across reasoning branches. |
| NInfer adapter support | Verify adapter loading and continuation capabilities. |
| TensorFold adapter support | Verify adapter loading and continuation capabilities. |
| Model training compatibility | Verify each selected model architecture. |
| Windows training support | Verify the selected training framework configuration. |
| Multi-GPU training | Verify supported device allocation and memory distribution. |
| Adapter composition | Verify compatibility and behavior with multiple adapters. |
| Long-context adaptation | Measure adapter effects on long-context model performance. |
| Process reward quality | Establish independent evaluation criteria and sufficient evaluation data. |
| Reinforcement learning | Establish hardware requirements and reward function reliability. |
| Performance thresholds | Establish measured baselines and release acceptance limits. |
| Team deployment | Select the authentication and shared storage configuration. |

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

The platform shall provide documented and independently verified functional behavior.

The project shall minimize unnecessary implementation complexity and unnecessary tests without a reduction in correctness, security, or verification quality.

**End of specification**