# Pi session interface

## Status and scope

This document describes the supported Pi extension, local pairing flow, session data, and local service interface.

The extension sends one approved Pi session to the local Baobab application. The Baobab panel is read only. It does not add Pi messages to Baobab's saved conversation tree or send commands to Pi.

This foundation uses local, single-owner pairing. It does not implement Feature 37, account identity, multi-user authentication, or a `userId` claim. Possession of the one-time Pi code authorizes the browser capability for the exact Pi session. This does not verify multi-user requirements.

## Components

| Component | Responsibility |
|---|---|
| `pi-baobab/src/extension.ts` | Register `/baobab pair`, `/baobab status`, and `/baobab disable`. Read the active Pi branch through the installed Pi session API. Send approved snapshots and renew the Pi lease. |
| `server/src/routes/piSessions.ts` | Register, approve, authorize, expire, revoke, and stream one local session pair. Keep pairing records, token hashes, snapshots, and subscribers in memory. |
| `src/api/piSessions.ts` | Claim a code and use the scoped capability in authorization headers. Read snapshots and fetch-based server-sent events (SSE). |
| `src/store/usePiSessionStore.ts` | Keep the capability and current snapshot in memory only. Reject snapshots from another pair or an older sequence. |
| `src/components/pi/PiSessionPanel.tsx` | Show scope, collect consent and the code, display the read-only snapshot, renew the browser lease, reconnect, and revoke. |
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
| `GET /sessions/stream` | Browser capability | Receive snapshots and revocation over SSE. |
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

Ordinary Pi behavior does not depend on Baobab. When no pair exists, the extension only registers its three commands. If the API is unavailable, Pi continues to operate and the extension reports the connection problem. The panel cannot run Pi tools or modify Pi state.

The panel opens from the Baobab sidebar, including on the landing page. Opening it does not create a conversation or send a model request. It occupies the right-hand detail column. The main conversation stays interactive in the remaining width. Closing it cancels a submitted code if a claim is pending. It revokes the active pair and clears the local view.

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

The PowerShell runner automates Pi and API checks with installed Pi 1.6.1. It does not automate the React panel. Use the built-in Traycer browser with an isolated profile for panel checks. Use temporary Pi settings, sessions, and API data. Do not use production data or real model credentials. The tests do not run model inference. A synthetic session file is test data only; actual Pi must load it and invoke the extension. Session tree navigation, fork/clone, browser transport reconnect without fresh pairing, and lease-expiry timing need separate checks. Full FV-002 requires real model operation.

Use isolated Pi settings, sessions, browser storage, and API data for functional checks. Do not use production data or real model credentials. The synthetic session file is test data only; actual Pi must load it and invoke the extension. Full FV-002 requires real model operation.
