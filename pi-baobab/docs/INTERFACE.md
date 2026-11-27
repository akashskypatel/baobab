# Pi session interface

## Status and scope

This document describes the supported Pi extension, local pairing flow, session data, and local service interface.

The extension sends one approved Pi session to the local Baobab application. The Baobab panel is read only. It does not add Pi messages to Baobab's saved conversation tree or send commands to Pi.

This foundation uses local, single-owner pairing. It does not implement Feature 37, account identity, multi-user authentication, or a `userId` claim. Possession of the one-time Pi code authorizes the browser capability for the exact Pi session. This does not verify multi-user requirements.

## Components

| Component | Responsibility |
|---|---|
| `pi-baobab/src/extension.ts` | Register Pi commands for pairing, status, candidate generation, cancellation, and disable. Read the active visible branch. Register a temporary local provider only for an explicit candidate command. |
| `server/src/routes/piSessions.ts` | Register, approve, authorize, expire, revoke, and stream one local session pair. Keep pairing records, token hashes, snapshots, candidate state, and subscribers in memory. |
| `src/api/piSessions.ts` | Claim a code and use scoped capabilities in authorization headers. Read snapshots, candidate events, and fetch-based server-sent events (SSE). |
| `src/store/usePiSessionStore.ts` | Keep capabilities, the current snapshot, and candidate output in memory only. Reject snapshots or candidates from another pair, branch, epoch, or sequence. |
| `src/components/pi/PiSessionPanel.tsx` | Show consent, the read-only snapshot, and candidate states. Renew the browser lease, reconnect, cancel candidates, and revoke. |
| `src/components/layout/MainLayout.tsx` and `src/components/layout/Sidebar.tsx` | Make the panel available from the landing page without creating a Baobab conversation. |

## Install and start

From the Baobab repository root, install the extension in the local Pi project:

```powershell
$RepoRoot = (Get-Location).Path
$PiExe = Join-Path $env:USERPROFILE '.bun\bin\pi.exe'
if (-not (Test-Path -LiteralPath $PiExe)) { throw 'Set $PiExe to the installed Pi executable.' }
& $PiExe install (Join-Path $RepoRoot 'pi-baobab') --local --approve
```

Pi writes the package entry to the repository's `.pi/settings.json`. This command does not change the user's global Pi configuration. Start Baobab's API and app from the repository root:

```powershell
docker compose up -d --build api app
docker compose ps
```

The app is available at `http://localhost:5173/baobab/`. The API binds to `127.0.0.1:3001`; the app binds to `127.0.0.1:5173`. The API stores its normal application data in the Compose volume. Start Pi from the same repository root so it loads the project-local extension:

```powershell
Set-Location $RepoRoot
& $PiExe
```

In Pi, run `/baobab pair` and confirm the Pi dialog. In Baobab, open **Pair Pi session** from the sidebar, enter the code, review the sharing scope, check the consent box, and select **Approve and connect**. Use `/baobab status` to inspect pairing state and `/baobab disable` to stop synchronization. Closing the panel revokes the pairing and clears its local view.

The panel is read only. It does not control Pi reasoning or run Pi tools. Opening it does not create a Baobab conversation or send a model request. The owner must give fresh consent after a Pi session change. A server restart clears the in-memory pair state.

The existing Fastify server registers the routes under `/api/pi`. Docker publishes port 3001 on `127.0.0.1`. The server listens on `0.0.0.0` inside its container. This binding does not expose the API on other host interfaces.

## Pairing and consent

1. The owner runs `/baobab pair` in an interactive Pi client. The extension creates a 128-bit random code and shows it in a Pi confirmation dialog.
2. After the owner confirms the dialog, Pi sends pairing identifiers and hashes of the code and bridge token to `POST /pairings`. It sends no session text.
3. The owner enters the code in the Baobab panel. Before submission, the panel explains the sharing scope and requires an explicit consent checkbox.
4. The browser sends the code and consent version to `POST /pairings/claim`. The server consumes the code once and returns a 256-bit browser capability. The capability applies only to this pair.
5. Pi observes approval through its authenticated status request. It starts the bridge heartbeat immediately, including when pairing starts after `session_start`. It sends the first snapshot only after approval.

The browser receives no Pi session text before step 4. Opening the panel or starting pairing does not transfer a preview. Anonymous callers cannot list pairs, read a snapshot, or open an event stream. Pair approval requires the one-time code and the panel's explicit consent action. Host and Origin checks are defense in depth. They are not authentication.

The panel asks to share visible user and assistant text from the active branch and future turns from this Pi session. It excludes system messages, tool calls and results, attachments, non-text content, and provider metadata. It does not filter paths, credentials, or secrets written in user or assistant text. Structural filtering cannot remove those values from text.

## Credentials and local boundary

The pairing code contains 128 random bits and expires after five minutes. The server accepts it once. The Pi bridge token and browser capability each contain 256 random bits. The server stores token hashes in process memory. The browser keeps its capability in the in-memory Zustand store. No pairing code or capability is placed in a URL, cookie, local storage, IndexedDB, or another durable browser store.

Fastify redacts request bodies and Authorization headers from request logs. The server does not persist pair records or snapshots. A server restart clears them. The API is intended for the local application. It is not a network service or a multi-user authentication system.

## Transport

Pi sends HTTP POST requests to `http://127.0.0.1:3001/api/pi`. The browser uses POST for code claim and lease renewal. It uses authenticated GET requests for a snapshot and an SSE stream. The browser uses `fetch` for SSE because the native `EventSource` interface cannot set the Authorization header.

Every capability is sent in an Authorization header. Pairing codes are sent in a POST body. The server checks the Host header and the CORS allowlist as additional local-boundary controls. No secret appears in a URL.

| Request | Authorization | Purpose |
|---|---|---|
| `POST /pairings` | None; metadata and hashes only | Register one pending pair from Pi. |
| `POST /pairings/claim` | One-time code in body and explicit consent version | Consume the code and issue a browser capability. |
| `POST /pairings/cancel` | One-time code in body | Cancel a pending pair or revoke an approved pair. It leaves a bounded tombstone if registration is in flight. It does not return session data. |
| `POST /pairings/cancel-registration` | Pi bridge capability | Cancel the Pi registration attempt or revoke it if the server already accepted it. The server rejects late registration replays. |
| `GET /pairings/status` | Pi bridge capability | Let Pi observe pending or approved state. |
| `POST /sessions/heartbeat` | Pi bridge capability | Renew the Pi lease for the exact pair, session, and epoch. |
| `POST /sessions/client-heartbeat` | Browser capability | Renew the browser lease. |
| `POST /sessions/snapshot` | Pi bridge capability | Replace the current full snapshot. |
| `GET /sessions/snapshot` | Browser capability | Read the current snapshot. A new pair can return no snapshot yet. |
| `GET /sessions/stream` | Browser capability | Receive snapshots, candidate events, and revocation over SSE. |
| `POST /sessions/candidates/events` | Pi bridge capability | Start, stream, and finish one bounded candidate for the exact current branch. |
| `POST /sessions/candidates/status` | Pi bridge capability | Read the candidate state so Pi can stop a cancelled stream. |
| `POST /sessions/candidates/cancel` | Browser capability | Cancel the current candidate for this pair. |
| `POST /sessions/revoke` | Pi bridge or browser capability | Revoke the pair and clear its snapshot and subscribers. |

All routes reject an unsupported Host. Browser requests also pass the configured CORS policy. These checks do not replace the bearer capability. Routes that expose session content require an active browser capability. Routes that change or submit Pi session state require the exact Pi bridge capability.

## Session data and ordering

Each snapshot contains protocol version, pairing ID, bridge ID, Pi session ID, pair epoch, sequence number, state, visible entry count, and entries. An entry contains a stable Pi entry ID, parent ID, role, and text. A snapshot contains the active branch only.

Snapshots are full replacements. The sequence number increases for every submitted snapshot. The server accepts only a sequence greater than the last accepted sequence. The browser ignores a snapshot for another pair or a sequence that it already received. A reconnect reads the current full snapshot before it reopens SSE. A missing sequence does not require replay because later events carry full snapshots.

The extension uses Pi's `SessionManager.getSessionId()` and `getBranch()` methods. It reads finalized message entries. It does not read session-file paths, working-directory metadata, system prompts, tool events, provider settings, or credentials. It includes only user and assistant text parts. Non-text parts are omitted.

`/tree` changes the active branch but keeps the same Pi session ID. The extension sends a replacement snapshot for the selected branch. `/new`, `/resume`, `/fork`, and `/clone` start or select a different session. Pi emits its switch/fork lifecycle events and shuts down the old extension runtime. The extension revokes the old pair. The new session requires a new pairing and new consent. Pi shutdown and extension reload also revoke the pair.

## Expiry, bounds, and recovery

| Resource or lease | Limit |
|---|---:|
| Pending pair lifetime | 5 minutes |
| Active browser capability lifetime | 15 minutes |
| Pi and browser lease lifetime | 90 seconds |
| Pi and browser heartbeat interval | 30 seconds |
| Server expiry sweep | 10 seconds |
| Pending and active pair records | 8 total |
| Registration-cancellation tombstones | 32 per credential map, retained for 5 minutes |
| Pair registration requests | 5 per minute per peer |
| Code claim attempts | 5 per minute per peer |
| Snapshot entries | 200 |
| Complete UTF-8 encoded snapshot, including JSON structure | 512 KiB |
| Pi queued snapshots | 64 events and 1 MiB |
| Browser SSE subscribers | 1 per pair |
| Slow SSE subscriber buffer | 1 MiB |

The extension replaces a snapshot with a `sync_limited` state only when the complete UTF-8 encoded JSON snapshot exceeds 512 KiB or the active branch exceeds 200 visible entries. It sends no partial entry list. There is no separate per-entry byte limit. The 1 MiB queue can hold at least one valid maximum-size snapshot. Queue overflow drops queued copies and requests a fresh full snapshot after a successful heartbeat. A rejected or expired capability stops synchronization.

SSE preserves the CORS headers that Fastify approved for the browser Origin. A false return from `ServerResponse.write()` signals normal backpressure. It does not close the stream. The server closes a slow subscriber only when its queued bytes would exceed 1 MiB.

The browser reconnects with backoff while its capability remains valid. The panel marks a disconnected snapshot as stale. It clears the local snapshot when the owner revokes or the capability expires. Closing the panel or unmounting it clears its in-memory capability and snapshot, stops the browser heartbeat immediately, and makes a revoke request with a three-second timeout. Claim, snapshot, heartbeat, and code-cancel requests use finite timeouts. Revoke errors do not restore local state. A pending claim is aborted on close or unmount. A late claim response is revoked and does not restore panel state. Reloading the page also discards the in-memory capability. The owner must pair again. A server restart clears all pair state. Pi then stops the old pair when its next authorized request fails. Disable clears the local queue before it sends revocation. The server removes the pair and rejects requests with its old token and epoch.

Ordinary Pi behavior does not depend on Baobab. When no pair exists, the extension registers its commands but does not register the candidate provider or contact llama-server. If the API is unavailable, Pi continues to operate and the extension reports the connection problem. The panel cannot run Pi tools or modify Pi state.

The panel opens from the Baobab sidebar, including on the landing page. Opening it does not create a conversation or send a model request. It occupies the right-hand detail column. The main conversation stays interactive in the remaining width. Closing it cancels a submitted code if a claim is pending. It revokes the active pair and clears the local view.

## Local candidate generation

The candidate command runs only in an approved, connected Pi pair. Pi must be idle. The command starts one candidate from the last visible entry in the current active branch.

Use this command in Pi:

~~~text
/baobab candidate http://127.0.0.1:9931 google/gemma-2b 32
~~~

The arguments are the loopback server root URL, exact model ID, and output-token limit. The extension uses one fixed candidate instruction. The server must have exactly one model in its /v1/models list, and the list must contain the selected ID. The command reads the active context size from GET /props. The output-token limit must be 1 through 128.

The command registers the namespaced provider baobab-local-llama-candidate only after the user starts the command and the pair is approved. It uses the installed Pi provider API with the openai-completions interface. It refuses to replace a provider with that ID. It does not change Pi's active model, user settings, or session. It uses Pi's modelRegistry.streamSimple() with no tools and a fetch function that rejects redirects and requests outside the selected loopback origin. Discovery, template, tokenization, and model requests share this boundary. It does not persist the provider catalog. It removes the temporary provider after the request only when the public registered configuration still has the reference captured at registration and the user did not select the provider. A catalog refresh may rebuild the composed provider object. The registered configuration reference stays stable across that refresh and changes if another extension replaces the registration. Later use is an explicit Pi model choice, not an automatic candidate request.

The command reads the visible snapshot that the owner approved for this pair. It includes only visible user and assistant text plus the fixed candidate instruction. This text may contain paths, credentials, or secrets. Structural filtering omits system and tool metadata. It cannot remove sensitive values from visible text. The local model may repeat sensitive text in its output. The output is model output, not a hidden reasoning trace. It is not written to the Pi session and cannot execute tools. This text-only candidate does not preserve the full Pi context and does not complete PI-004.

Before inference, Pi checks the exact model ID with GET /v1/models. The first slice requires one served model. It reads n_ctx from GET /props. It sends the candidate message to POST /apply-template and the returned prompt to POST /tokenize. The token count plus the output-token limit must fit within the server context size. These route checks use three-second timeouts. The candidate has a 120-second total limit. See the llama.cpp server API documentation at https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md. The installed server build must pass each route check. If a route is unavailable, Pi stops before inference.

One bounded candidate run on the exact local F16 build completed one candidate generation with one output token after model discovery, `/props`, `/apply-template`, and `/tokenize` checks. This proves those route calls for that request only. The overall runner later failed in cancellation-limit prefill; no full candidate run passed. This does not establish general route compatibility, native Gemma serialization, parity, or quality. A separate synthetic fixture observed client-abort behavior, but real llama.cpp cancellation remains unverified. If a required route is unavailable or returns invalid data, Pi reports a capability error and sends no chat completion request. Pi does not infer context, tool, reasoning, continuation, or restoration support from `/v1/models`. The [llama.cpp server API documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) lists these routes.

The server keeps one candidate per pair in process memory. Each event binds to pairingId, bridgeId, sessionId, pairEpoch, candidateId, candidate generation, baseEntryId, snapshotSequence, and an increasing sequence number. A generation starts at one and increases for each candidate in the pair. Failed starts can leave gaps when Pi advances its local generation but the server cannot store the terminal fallback. The server accepts only a generation greater than its high-water mark. A pending event uses sequence zero. Every later event uses the next number. Streaming events carry text deltas. Replay events carry the current full candidate. Terminal events carry no new text. The server and browser reject retired generations. The browser accepts a higher pending generation after a gap. A new SSE attempt ignores callbacks from an older stream attempt. Error codes are endpoint_unavailable, model_unavailable, context_limit, capability_unavailable, provider_error, output_limit, request_timeout, stale_session, and user_cancelled. Codes do not contain prompt text or raw server messages.

| Candidate limit | Value |
|---|---:|
| Active candidates per pair | 1 |
| Candidate lifetime | 120 seconds |
| Candidate prompt after template rendering | 512 KiB UTF-8 |
| Output tokens | 1–128, selected by the user |
| Candidate text | 64 KiB UTF-8 |
| Candidate delta | 8 KiB UTF-8 |
| Candidate events | 1,024, including start and terminal events |
| Candidate status polling | 500 ms while a candidate is active |
| Candidate starts | 6 per minute per local peer |
| Candidate status requests | 180 per minute per local peer |
| Candidate cancellation requests | 12 per minute per local peer |
| Candidate cancellation tombstones | 256 in memory for up to 5 minutes |

Pi stops the candidate when the owner cancels, changes the branch or session, starts a normal turn, disables the pair, or loses the pair lease. The server rejects late deltas. A new session requires fresh pairing and consent. Candidate output stays in memory. It does not change the canonical Pi snapshot or Baobab's saved conversation tree.

This first slice does not compare multiple candidates, edit a candidate, continue an accepted candidate, restore inference state, run tools, or transfer control to a teacher. These functions remain unverified.

## Functional verification plan

Use installed Pi 1.6.1 and a temporary project, configuration directory, session directory, and Baobab data directory. Do not use the user's Pi configuration, session files, database, saved browser storage, or model credentials. Do not start model inference. A synthetic session file is test data only; actual Pi must load it and emit the real extension events.

### Isolated setup

1. Create an isolated data directory and temporary Compose override. Use this PowerShell block from the repository root:

```powershell
$testRoot = Join-Path $env:TEMP ('baobab-pi-functional-' + [guid]::NewGuid().ToString('N'))
$data = Join-Path $testRoot 'baobab-data'
$composeOverride = Join-Path $testRoot 'compose.override.yml'
$composeProject = 'baobab-pi-functional-' + [guid]::NewGuid().ToString('N')
New-Item -ItemType Directory -Force -Path $data | Out-Null
$env:BAOBAB_TEST_DATA = $data
@'
services:
  api:
    volumes:
      - type: bind
        source: ${BAOBAB_TEST_DATA}
        target: /data
'@ | Set-Content -LiteralPath $composeOverride -Encoding utf8
$images = @(docker compose --project-name $composeProject -f docker-compose.yml -f $composeOverride config --images)
if ($LASTEXITCODE -ne 0) { throw 'Compose could not resolve the test configuration.' }
$missingImages = [System.Collections.Generic.List[string]]::new()
foreach ($image in $images) {
  docker image inspect $image --format '{{.Id}}' | Out-Null
  if ($LASTEXITCODE -ne 0) { $missingImages.Add($image) | Out-Null }
}
if ($missingImages.Count -gt 0) {
  docker compose --project-name $composeProject -f docker-compose.yml -f $composeOverride build api app
  if ($LASTEXITCODE -ne 0) { throw 'The isolated app/API image build failed.' }
}
docker compose --project-name $composeProject -f docker-compose.yml -f $composeOverride up --pull never --no-build --detach api app
if ($LASTEXITCODE -ne 0) { throw 'The isolated Baobab test project did not start.' }
```

The override replaces the API's `/data` mount with the temporary directory. Use the same `--project-name $composeProject` for every Compose command. Use `config --images` to derive the image tags for this project, then pass each tag to `docker image inspect`. `docker image inspect` does not take a Compose project option. The build command uses the same project name and override files. The `--no-build` option prevents an implicit build during startup. Both API port 3001 and app port 5173 bind to host loopback. The API data mount uses the temporary `$data` directory.

2. Run the shared API/Pi checks from the repository root:

```powershell
& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File .\pi-baobab\functional-tests\PiSessionBoundary.ps1
```

The script creates a temporary Pi project, configuration, sessions, and synthetic JSONL fixtures. It installs the extension only in that temporary project. It starts installed Pi 1.6.1 in offline RPC mode without a model. It sends actual Pi RPC dialog responses and synthetic-only consent for the test data. It exercises the actual Pi extension, actual Fastify routes, one-time approval races, cancellation tombstones and replay, content filtering, SSE CORS, large UTF-8 snapshots, limits, revocation, and session switching. The script keeps pairing codes and bearer values in process memory and does not print or write them to files. It tags the Pi process as `AGENT_BaobabSection23_1`, records before/after process inventories and owned PIDs, and terminates only processes it starts. It removes its resolved temporary root only after a passing run. It preserves failed fixtures and sanitized diagnostics in the external evidence directory. The script does not test the React panel.

3. Open `http://localhost:5173` in the built-in Traycer browser. Use the sidebar Pi action from the landing page. Check the consent copy, code field, connected state, close/revoke behavior, stale state, reconnect, and clearing after expiry. These panel checks are operator-driven. The PowerShell functional runner does not automate browser interaction.

4. After the checks finish, stop only the test Compose project and remove only its generated temporary directory:

```powershell
docker compose --project-name $composeProject -f docker-compose.yml -f $composeOverride down --volumes
Remove-Item -LiteralPath $testRoot -Recurse -Force
```

Use the temporary project, Pi configuration, session, and API data directories shown above. Do not use user Pi settings, sessions, databases, saved browser storage, or model credentials. Do not run model inference in this foundation check. Pi must load the synthetic session file and produce the actual extension events.

### Shared functional checks

| Scenario | Action | Required observation |
|---|---|---|
| FV-001: startup | Start Pi without pairing and use normal session navigation. | Pi starts and remains usable. No session text reaches Baobab. |
| FV-002: model operation | Do not run in this foundation check. | Remains unverified until a compatible model is configured and real inference runs. |
| FV-003: session synchronization | Pair a synthetic session with explicit consent. | The panel receives only visible user/assistant text from the active branch. Pi and browser states identify the same session. |
| FV-042: control and recovery | Disable pairing, disconnect/reconnect the browser, stop/restart the API, then pair again. | Disable clears the view and server state. Reconnect uses a current snapshot only. Restart loses volatile state. A new code and consent restore sync. |
| Denied browser | Request snapshot and SSE without Authorization; use a wrong, expired, and already-used code. | Content routes return 401. Claim returns no capability. No Pi text reaches the caller. |
| Approval race | Submit the same valid code twice at the same time. | Exactly one claim returns a capability. The other claim fails. The code cannot be replayed. |
| No pre-consent content | Register a pair and inspect browser state and server events before code claim. | No snapshot or Pi entry text is returned or streamed. |
| Pair after startup | Start Pi first, then run `/baobab pair` and approve in Baobab. | Pi begins its heartbeat after approval and the first authorized snapshot arrives. |
| Branch switch | Use `/tree` to select another branch in the same session. | The pair remains active. A greater sequence replaces the displayed branch. |
| Session switch | Use `/new`, `/resume`, `/fork`, and `/clone` in separate checks. | The old pair stops and its snapshot clears. The new session sends no text before a fresh code and consent. |
| Snapshot and SSE byte bounds | Send synthetic ASCII and non-ASCII text whose complete serialized snapshots are below, at, and above 512 KiB. Include an in-limit snapshot larger than 16 KiB. | UTF-8 byte size determines the same result at the Pi, server, and browser. The in-limit large snapshot arrives over SSE. An over-limit snapshot has no partial entry list. Queue overflow does not relabel a valid snapshot as too large. |
| Entry-count bound | Use synthetic active branches with 200 and 201 visible entries. | The 200-entry branch syncs if its complete JSON is within 512 KiB. The 201-entry branch returns `sync_limited` with no partial entry list. |
| Pair cancellation | Cancel the Pi confirmation, disable pairing during confirmation or registration, and switch Pi sessions while registration is pending. | No canceled or stale attempt becomes active. Any registration that completed during cancellation is revoked after the request settles. |
| Claim cancellation | Close the panel while claim is pending and send the code to the cancellation endpoint. Repeat after a claim completes but before the capability is stored. | Cancellation removes either the pending or approved pair. The late claim cannot restore local state or send session text. |
| Panel close and pending claim | Close the panel during claim and close it after an active pair. | A late claim cannot restore store state. Closing an active panel immediately clears the capability and snapshot and stops browser heartbeat before bounded remote revoke. |
| Lease and revoke | Stop browser heartbeat, stop Pi heartbeat, revoke from each client, and wait past lease expiry. | Expired or revoked capabilities fail. The server removes the snapshot and closes SSE. Old requests cannot restore the pair. |

### Execution boundary

The PowerShell runner automates Pi and API checks with installed Pi 1.6.1. It does not automate the React panel. Use the built-in Traycer browser with an isolated profile for panel checks. Use temporary Pi settings, sessions, and API data. Do not use production data or real model credentials. The candidate runner performs bounded local model inference. The separate browser/store check uses synthetic state and does not call the model. A synthetic session file is test data only; actual Pi must load it and invoke the extension. Session tree navigation, fork/clone, browser transport reconnect without fresh pairing, and lease-expiry timing need separate checks. One bounded request does not verify full FV-002.

Use isolated Pi settings, sessions, browser storage, and API data for functional checks. Do not use production data or real model credentials. The synthetic session file is test data only; actual Pi must load it and invoke the extension. Full FV-002 requires real model operation.
### Current verification summary — 2026-11-27

- The API and app TypeScript builds passed. The Pi extension strict source-only typecheck passed against installed Pi 1.6.1 declarations with `--skipLibCheck`; the full dependency declaration check still reports errors inside installed dependency declarations.
- The installed Pi 1.6.1 session-boundary runner passed its covered synthetic-data checks. The three full candidate runner attempts and three controls-only attempts failed overall. One candidate attempt completed an F16 generation with one output token before a later HTTP 429 rate-limit assertion failure. The separate API-only lifecycle check passed its bounded read-cancel, revoke, and denied-snapshot checks.
- The latest isolated browser flow used actual Pi pairing, code entry, and consent. It observed zero pre-consent markers and the consented snapshot. Candidate 1 completed after the synthetic helper /candidate/release-first gate; this was not a product UI action. Candidate 2 was cancelled through the product Cancel control, the UI showed cancelled, and the synthetic fixture observed one transport abort. The product Revoke control cleared both markers. Claim status was not captured. This does not establish real llama.cpp cancellation, full context preservation, or full FV-002/PI-004/section 23.2 acceptance.
- Section 21.4 of `pi-baobab/docs/SRS.md` records the exact run chronology, evidence, cleanup, and limits. Requirement totals remain 425, with 3 verified; no status promotion follows from this summary.

## Section 23.2 candidate functional checks

Use installed Pi 1.6.1, the existing converted F16 Gemma file, a loopback llama-server, and synthetic visible branch text. Use temporary Pi settings, session files, Baobab data, and browser state. Do not download, modify, or replace model files. Do not run training.

Run the candidate functional check after the isolated API and app from the setup steps are healthy. Start a fresh task-owned Compose project so its in-memory rate limits and data volume are separate. The script requires at least 8 GiB of free system memory. It verifies the approved F16 SHA-256 `865C522D53F5E84C0A79B39789F43E829023F3D6DEA9D92F5DAD7451CBAC7E5A`. It starts CPU-only llama-server with one slot and a 512-token context. It limits output to 32 tokens. It uses the accepted generic base-text template with SHA-256 `AD5F8CB5867ACAB6983E73AA1E4CB14272D43ECF81F8B69B32A2483FEA15C05B`. The template checks provider transport and event flow. The run does not establish native Gemma serialization, quality, or performance. The script starts a temporary Pi RPC process and uses generated settings and a synthetic session. It starts loopback redirect and chat-stream fixtures. It does not contact an external redirect destination.

The runner fills the candidate-start and cancellation limits. Pi's first candidate start is refused. The server cannot store its terminal fallback. The browser receives no event for generation one. The runner waits for the limit window to expire, then checks that Pi sends generation two and the server accepts it. This check uses a fresh isolated API process. It does not use the original mismatching GGUF.

```powershell
& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File .\pi-baobab\functional-tests\PiCandidateBoundary.ps1 `
  -LlamaServerPath 'D:\llama.cpp\llama-server.exe' `
  -ModelPath 'C:\Users\Akash\.codex\evidence\AGENT_gemma-2b-f16.gguf' `
  -ChatTemplatePath 'C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-base-text_REVIEW.jinja'
```

The generation-gap scenario keeps a separate candidate completion check against the approved F16 Gemma file. Browser and Pi cancellation use a bounded synthetic chat-stream fixture through the actual Pi provider and Baobab API. The fixture sends OpenAI-compatible streamed chat chunks and waits for cancellation. The runner checks that the provider request aborts before natural completion. This verifies cancellation handling and command ownership. It does not verify llama.cpp cancellation or model behavior.

The script checks actual Pi provider streaming, refused-start recovery, unchanged session state, normal extension commands, browser and Pi cancellation, duplicate-command completion ownership, unavailable endpoints, discovery/template/completion redirect rejection, generation replay ordering, cancellation rate limits, and revoke. A temporary Pi extension uses public registry APIs to check config identity across refresh and replacement. It checks that candidate cleanup removes its registration and that a conflicting provider stays registered until its owner removes it. The runner also records bounded RPC and candidate-state metadata. It does not save RPC IDs, notification text, prompt text, or candidate output in that metadata. It records only enumerated codes for known static extension warnings. It renews the test browser lease during waits and SSE reads. It waits for Pi cleanup after completed and error events, then reconnects the authenticated browser SSE and checks that replay retains the terminal state. It writes sanitized `pre-cleanup.json` before teardown and `result.json` after cleanup. The record separates scenario failures from cleanup failures. It records task-owned process inventories and external evidence. A failure preserves the temporary fixture for inspection. The runner uses a direct SSE subscriber and revokes its test pair when it exits.

The controls-only mode uses actual Pi 1.6.1 and temporary API data. It does not start llama-server or load a model. It checks cancellation limits, failed terminal tombstones, generation high-water recovery, replay, and candidate-provider collision cleanup. All three controls-only attempts failed overall: attempt 1 stopped before API startup because the Docker Linux engine pipe was unavailable; attempt 2 reached cancellation/replay and provider-collision checks, then failed during final revoke with an operation-cancelled exception; attempt 3 reached provider collision, then failed because a pending stream read did not stop after the stream closed. The causes remain unestablished. A separate API-only lifecycle run passed only its bounded read-cancellation, revoke, and denied-snapshot checks. This is not a controls-only pass and does not verify candidate inference or the panel. See SRS section 21.4 for the chronology.

All three full candidate runner attempts failed overall. Attempt 1 failed in its result writer; its server log records one task with 47 prompt-evaluation tokens and one output token, but no candidate assertion is accepted from that run. Attempt 2 timed out in browser-cancellation after its earlier generation-gap scenario returned without a retained per-candidate event. Attempt 3 completed one F16 generation with one output token and passed its generation-gap and other bounded partial scenarios, then failed when cancellation-limit prefill expected HTTP 204 and received 429. No full candidate runner passed. The second fixture preflight passed normal three-delta streaming, early client abort, malformed and over-limit request rejection, and fixture cleanup. The latest product-panel flow separately verified cancellation against that synthetic fixture. These fixture results do not verify real llama.cpp cancellation or model behavior.

### Separate browser and store checks

The PowerShell runner checks API/SSE events. It does not mount the React store. Use a separate temporary Pi session and an isolated Traycer browser profile for panel checks. Pair the session in the browser. Keep the browser as the only SSE subscriber while you run a candidate from Pi. Check the pending, streaming, completed, cancelled, and error states. Reconnect the stream and check that it restores only the current candidate.

Use the built-in Traycer browser on the isolated Baobab app page to verify the browser store's generation-gap recovery. Close the Pi session panel first so its session effect is not mounted. This synthetic state check does not call the API or persist data. The store begins at generation zero. No event is sent for the failed generation one start. It accepts generation two. It ignores a delayed generation one delta. A replay for generation two restores the current state. The `finally` block always clears the synthetic pairing, including when an assertion fails.

```javascript
async () => {
  const { usePiSessionStore } = await import('/baobab/src/store/usePiSessionStore.ts');
  const store = usePiSessionStore;
  const claim = {
    capability: 'a'.repeat(64),
    expiresAt: Date.now() + 60000,
    pairingId: 'synthetic-pair',
    bridgeId: 'synthetic-bridge',
    sessionId: 'synthetic-session',
    pairEpoch: 'synthetic-epoch',
    scope: 'visible-branch-and-turn-text',
  };
  try {
    store.getState().setPairing(claim);
    store.getState().setSnapshot({
      protocolVersion: 1,
      pairingId: claim.pairingId,
      bridgeId: claim.bridgeId,
      sessionId: claim.sessionId,
      pairEpoch: claim.pairEpoch,
      sequence: 7,
      state: 'idle',
      entryCount: 1,
      entries: [{ id: 'base-entry', parentId: null, role: 'user', text: 'Synthetic visible text.' }],
    });
    const base = {
      type: 'candidate',
      pairingId: claim.pairingId,
      bridgeId: claim.bridgeId,
      sessionId: claim.sessionId,
      pairEpoch: claim.pairEpoch,
      baseEntryId: 'base-entry',
      snapshotSequence: 7,
      modelId: 'synthetic-model',
    };
    store.getState().setCandidateEvent({ ...base, candidateId: 'candidate-2', generation: 2, sequence: 0, state: 'pending' });
    store.getState().setCandidateEvent({ ...base, candidateId: 'candidate-1', generation: 1, sequence: 1, state: 'streaming', delta: 'stale' });
    const afterStale = store.getState().candidate;
    store.getState().setCandidateEvent({ ...base, candidateId: 'candidate-2', generation: 2, sequence: 0, state: 'pending', text: '', replay: true });
    const result = {
      generation: store.getState().candidateGeneration,
      candidateId: store.getState().candidate?.candidateId,
      staleDeltaIgnored: afterStale?.candidateId === 'candidate-2' && afterStale.text === '',
      replayRecovered: store.getState().candidate?.generation === 2,
    };
    if (result.generation !== 2 || result.candidateId !== 'candidate-2' || !result.staleDeltaIgnored || !result.replayRecovered) {
      throw new Error('Candidate generation recovery failed.');
    }
    return result;
  } finally {
    store.getState().clearPairing();
  }
}
```

This browser/store check is separate from the automated Pi/API/SSE runner. Neither check verifies full FV-002, full PI-004, model quality, or full section 23.2 acceptance.

| Check | Action | Required observation |
|---|---|---|
| Stored terminal-before-start recovery | Accept a terminal fallback before its pending start, then send the matching late start. | The terminal fallback stores a tombstone and advances the high-water mark without publishing an event. The matching late start is rejected. A later higher generation is accepted. |
| Refused terminal fallback recovery | Fill the per-peer start and cancellation limits so Pi's first start and terminal fallback are refused. Wait for the limit window, then send a higher generation. After the higher generation is accepted, send the refused generation's late start and delta. | No event or high-water update occurs for the refused fallback. The higher generation is accepted. The now-retired lower start and delta are rejected. This is the case covered by the current runner. |
| Candidate provider discovery | Pair an idle Pi session. Run the candidate command with a loopback endpoint, an exact model ID, and an output limit. | Pi finds one matching model. It reads the server context from props. It does not change the active Pi model or save provider settings. |
| Redirect rejection | Use a task-owned loopback fixture server. Return redirects from model discovery, prompt templating, and model completion. Route each redirect to a local sentinel endpoint. | Each request fails closed. The completion test reaches the model request. The sentinel receives zero requests. No external destination is contacted. |
| Context bound | Use a short synthetic branch and then a branch that exceeds the configured server context after template rendering and tokenization. | The short branch fits before inference. The long branch returns a context error and sends no chat request. An unavailable props, template, or tokenize route also stops before chat. |
| Candidate stream | Run the bounded candidate command against the existing local F16 model. | Baobab receives pending, streaming, and terminal events for the exact pair, session, base entry, snapshot sequence, epoch, and generation. The Pi session snapshot and Pi session file do not change. |
| Candidate completion cleanup | After a completed or error event, send `/baobab cancel` as a cleanup barrier, then reconnect the authenticated browser SSE. | The Pi completion promise settles. The replay shows the same terminal state. The next candidate starts only after local cleanup completes. |
| Provider registry ownership | In the temporary Pi extension, register a synthetic provider, call the public offline refresh, replace its config, then clean up by reference identity. Check the candidate provider catalog after normal completion. Register a conflict and run the candidate command. | The config reference stays stable across refresh and changes after replacement. Normal candidate cleanup removes its own registration. The conflicting provider remains registered and the candidate command reports a warning without a new candidate event. The test extension removes only the config reference it owns. User-selected provider preservation remains unverified. |
| Synthetic sensitive-looking text | Use a fake path and a fake secret string in a synthetic visible message. Do not use a real credential. | The UI warns that visible text may contain sensitive values. Structural filters do not remove those values from the text. The candidate request remains local. |
| No tool or hidden-context transfer | Use visible test text and record tool calls. | The model receives only visible user/assistant text and the fixed candidate instruction. The provider call has no tool definitions. No tool runs. The candidate is labeled model output, not hidden reasoning. The test makes no claim that paths or secrets inside text are filtered. |
| Cancellation | Cancel from Baobab, then repeat with /baobab cancel. Also revoke pairing while output streams. | The provider request aborts. The candidate reaches a terminal state. No later delta is accepted. Revoke clears the candidate and snapshot. |
| Stale session or branch | Change the active branch or session while a candidate runs. Deliver a delayed event from the old candidate. | The old candidate is cancelled. The server rejects the delayed event. The browser does not restore stale output. |
| Candidate replay race | Finish one generation, start a higher generation, then attempt to deliver an older generation after the higher one is visible. Reconnect the stream. | The server rejects the older generation. The browser keeps the higher generation. The reconnect replay restores only the current generation. |
| Unavailable endpoint or model | Stop the task-owned server or request a model ID that is not in its model list. | Baobab shows a bounded error state. Pi remains usable. The command does not change the active model or session. |
| Provider collision | Register a provider with the candidate provider ID before the command. | The command reports the conflict. It does not replace or remove the existing provider. |
| Disabled Pi behavior | Start Pi with no approved pair and with the local server unavailable. Use normal Pi navigation and commands. | The extension does not query or connect to llama-server. Pi remains usable. |
| Output and event bounds | Stream synthetic output at and above the configured UTF-8 byte and event limits. | The server enforces the cumulative output, per-event, event-count, and duration limits. A terminal error prevents later deltas from restoring output. |

The candidate slice does not verify multiple branches, side-by-side comparison, manual correction, accepted continuation, or full Pi context preservation. It does not verify tool authorization for a later continuation. It does not complete FV-002, PI-004, PI-006 through PI-008, FV-005, FV-006, FV-049, or FV-050.
