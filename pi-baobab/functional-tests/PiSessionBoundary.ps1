param(
  [string]$PiPath = (Join-Path $env:USERPROFILE '.bun\bin\pi.exe'),
  [string]$ApiBase = 'http://127.0.0.1:3001/api/pi',
  [switch]$KeepTemporaryFiles
)

$ErrorActionPreference = 'Stop'
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP ("baobab-pi-functional-" + [guid]::NewGuid().ToString('N'))))
$tempPrefix = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$project = Join-Path $testRoot 'project'
$config = Join-Path $testRoot 'pi-config'
$sessions = Join-Path $testRoot 'pi-sessions'
$package = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$http = [System.Net.Http.HttpClient]::new()
$piProcess = $null
$installProcess = $null
$ownedProcessRecords = [System.Collections.Generic.List[object]]::new()
$scenarioDeadline = [DateTime]::UtcNow.AddMinutes(12)
$claimWindowStarted = $null
$claimAttemptsInWindow = 0
$scriptSucceeded = $false
$failureMessage = $null
$rpcStderrTask = $null
$installOutputTask = $null
$installErrorTask = $null
$processBeforePath = Join-Path $testRoot 'process-before.csv'
$processAfterPath = Join-Path $testRoot 'process-after.csv'
$failurePath = Join-Path $testRoot 'runner-failure.txt'
$evidenceBase = Join-Path $env:USERPROFILE '.codex\evidence'
$evidencePath = Join-Path $evidenceBase ('AGENT_pi-session-boundary-' + [guid]::NewGuid().ToString('N'))

function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw "$Message Expected $Expected; received $Actual." }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Redact-Diagnostic([string]$Text) {
  if (-not $Text) { return '' }
  return ($Text -replace 'One-time code: [A-F0-9-]+', 'One-time code: [redacted]' -replace '\b[A-F0-9]{8}(?:-[A-F0-9]{8}){3}\b', '[redacted pairing code]' -replace '(?i)Bearer\s+[A-F0-9]{64}', 'Bearer [redacted]' -replace '\b[A-F0-9]{32}\b', '[redacted 32-character secret]' -replace '\b[A-F0-9]{64}\b', '[redacted 64-character secret]')
}

function Save-ProcessInventory([string]$Path) {
  Get-Process | Select-Object Id, ProcessName | Sort-Object Id | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding utf8
}

function Test-OwnedTemporaryRoot([string]$Path) {
  $resolved = [System.IO.Path]::GetFullPath($Path)
  return $resolved.StartsWith($tempPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
    [System.IO.Path]::GetFileName($resolved).StartsWith('baobab-pi-functional-', [System.StringComparison]::OrdinalIgnoreCase)
}

function New-SessionFixture([string]$Path, [string]$SessionId, [string]$VisibleText, [bool]$IncludeMarkers) {
  $stamp = [DateTime]::UtcNow.ToString('o')
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add((@{ type = 'session'; version = 3; id = $SessionId; timestamp = $stamp; cwd = $project } | ConvertTo-Json -Compress -Depth 8))
  if ($IncludeMarkers) {
    $lines.Add((@{ type = 'message'; id = '10000001'; parentId = $null; timestamp = $stamp; message = @{ role = 'system'; content = 'SYSTEM_MARKER'; timestamp = $now } } | ConvertTo-Json -Compress -Depth 8))
  }
  $userId = if ($IncludeMarkers) { '10000002' } else { '20000001' }
  $userParentId = if ($IncludeMarkers) { '10000001' } else { $null }
  $lines.Add((@{ type = 'message'; id = $userId; parentId = $userParentId; timestamp = $stamp; message = @{ role = 'user'; content = $VisibleText; timestamp = $now + 1 } } | ConvertTo-Json -Compress -Depth 8))
  if ($IncludeMarkers) {
    $lines.Add((@{ type = 'message'; id = '10000003'; parentId = $userId; timestamp = $stamp; message = @{ role = 'assistant'; content = @(@{ type = 'toolCall'; id = 'test-call'; name = 'read'; arguments = @{ marker = 'TOOL_CALL_ARGUMENT_MARKER' } }); api = 'openai-completions'; provider = 'synthetic'; model = 'synthetic'; usage = @{ input = 0; output = 0; cacheRead = 0; cacheWrite = 0; totalTokens = 0; cost = @{ input = 0; output = 0; cacheRead = 0; cacheWrite = 0; total = 0 } }; stopReason = 'toolUse'; timestamp = $now + 2 } } | ConvertTo-Json -Compress -Depth 8))
    $lines.Add((@{ type = 'message'; id = '10000004'; parentId = '10000003'; timestamp = $stamp; message = @{ role = 'toolResult'; toolCallId = 'test-call'; toolName = 'read'; content = @(@{ type = 'text'; text = 'TOOL_RESULT_MARKER' }); isError = $false; timestamp = $now + 3 } } | ConvertTo-Json -Compress -Depth 8))
    $lines.Add((@{ type = 'message'; id = '10000005'; parentId = '10000004'; timestamp = $stamp; message = @{ role = 'assistant'; content = @(@{ type = 'text'; text = 'VISIBLE_ASSISTANT_MARKER' }); api = 'openai-completions'; provider = 'synthetic'; model = 'synthetic'; usage = @{ input = 0; output = 0; cacheRead = 0; cacheWrite = 0; totalTokens = 0; cost = @{ input = 0; output = 0; cacheRead = 0; cacheWrite = 0; total = 0 } }; stopReason = 'stop'; timestamp = $now + 4 } } | ConvertTo-Json -Compress -Depth 8))
  }
  [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

function New-HexSecret([int]$ByteLength) {
  $bytes = [byte[]]::new($ByteLength)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToHexString($bytes).ToLowerInvariant()
}

function Get-Sha256Hex([string]$Value) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
  return [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}

function New-PairRegistration([string]$PairId, [string]$SessionId, [string]$CodeHash, [string]$BridgeTokenHash) {
  return @{
    protocolVersion = 1
    pairingId = $PairId
    bridgeId = [guid]::NewGuid().ToString()
    sessionId = $SessionId
    pairingCodeHash = $CodeHash
    bridgeTokenHash = $BridgeTokenHash
  }
}

function Test-CancellationTombstones {
  $code = (New-HexSecret 16).ToUpperInvariant()
  $codeRegistration = New-PairRegistration ([guid]::NewGuid().ToString()) 'synthetic-cancel-code' (Get-Sha256Hex $code) (Get-Sha256Hex (New-HexSecret 32))
  $codeCancel = Send-Api 'POST' '/pairings/cancel' '' @{ code = $code }
  Assert-Equal $codeCancel.Status 204 'Pre-registration code cancellation failed.'
  $lateCodeRegistration = Send-Api 'POST' '/pairings' '' $codeRegistration
  $replayedCodeRegistration = Send-Api 'POST' '/pairings' '' $codeRegistration
  Assert-Equal $lateCodeRegistration.Status 410 'A registration arriving after code cancellation was accepted.'
  Assert-Equal $replayedCodeRegistration.Status 410 'A replayed canceled code registration was accepted.'

  $bridgeToken = New-HexSecret 32
  $bridgeRegistration = New-PairRegistration ([guid]::NewGuid().ToString()) 'synthetic-cancel-bridge' (Get-Sha256Hex (New-HexSecret 16)) (Get-Sha256Hex $bridgeToken)
  $bridgeCancelRequest = New-ApiRequest 'POST' '/pairings/cancel-registration' $bridgeToken @{ pairingId = $bridgeRegistration.pairingId } ''
  try {
    $bridgeCancel = $http.SendAsync($bridgeCancelRequest).GetAwaiter().GetResult()
    try { Assert-Equal ([int]$bridgeCancel.StatusCode) 204 'Bridge registration cancellation failed.' }
    finally { $bridgeCancel.Dispose() }
  } finally {
    $bridgeCancelRequest.Dispose()
  }
  $lateBridgeRegistration = Send-Api 'POST' '/pairings' '' $bridgeRegistration
  $replayedBridgeRegistration = Send-Api 'POST' '/pairings' '' $bridgeRegistration
  Assert-Equal $lateBridgeRegistration.Status 410 'A registration arriving after bridge cancellation was accepted.'
  Assert-Equal $replayedBridgeRegistration.Status 410 'A replayed canceled bridge registration was accepted.'
}

function Read-RpcRecord([int]$TimeoutMilliseconds = 15000) {
  $remainingMilliseconds = [int][Math]::Floor(($scenarioDeadline - [DateTime]::UtcNow).TotalMilliseconds)
  if ($remainingMilliseconds -le 0) { throw 'The Pi functional scenario exceeded its total deadline.' }
  $waitMilliseconds = [Math]::Min($TimeoutMilliseconds, $remainingMilliseconds)
  $task = $piProcess.StandardOutput.ReadLineAsync()
  if (-not $task.Wait($waitMilliseconds)) { throw 'Pi RPC did not return a record before the deadline.' }
  $line = $task.Result
  if ($null -eq $line) {
    $diagnostic = if ($rpcStderrTask -and $rpcStderrTask.IsCompleted) { Redact-Diagnostic $rpcStderrTask.Result } else { '' }
    throw "Pi RPC closed its output stream. $diagnostic"
  }
  return $line | ConvertFrom-Json -AsHashtable
}

function Send-Rpc($Record) {
  $piProcess.StandardInput.WriteLine(($Record | ConvertTo-Json -Compress -Depth 32))
  $piProcess.StandardInput.Flush()
}

function Invoke-RpcCommand($Command) {
  $id = [guid]::NewGuid().ToString('N')
  $Command.id = $id
  Send-Rpc $Command
  while ([DateTime]::UtcNow -lt $scenarioDeadline) {
    $record = Read-RpcRecord
    if ($record.type -eq 'response' -and $record.id -eq $id) { return $record }
  }
  throw 'The Pi RPC command exceeded the total scenario deadline.'
}

function Start-PairPrompt {
  $promptId = [guid]::NewGuid().ToString('N')
  Send-Rpc @{ id = $promptId; type = 'prompt'; message = '/baobab pair' }
  while ([DateTime]::UtcNow -lt $scenarioDeadline) {
    $record = Read-RpcRecord
    if ($record.type -eq 'extension_ui_request' -and $record.method -eq 'confirm') { return @{ id = $record.id; message = $record.message; promptId = $promptId } }
  }
  throw 'The Pi pairing dialog exceeded the total scenario deadline.'
}

function Show-PairRequest($Dialog) {
  $safeMessage = [regex]::Replace($Dialog.message, 'One-time code: [A-F0-9-]+', 'One-time code: [hidden]')
  Write-Host $safeMessage
}

function Finish-PairPrompt($Dialog, [bool]$Confirmed) {
  Send-Rpc @{ type = 'extension_ui_response'; id = $Dialog.id; confirmed = $Confirmed }
  while ([DateTime]::UtcNow -lt $scenarioDeadline) {
    $record = Read-RpcRecord
    if ($record.type -eq 'response' -and $record.id -eq $Dialog.promptId) {
      Assert-Equal $record.command 'prompt' 'Pi returned a response for an unexpected command.'
      Assert-True $record.success 'Pi did not complete the pairing command response.'
      return
    }
  }
  throw 'The Pi pairing command response exceeded the total scenario deadline.'
}

function Invoke-ExtensionPrompt([string]$Message) {
  $response = Invoke-RpcCommand @{ type = 'prompt'; message = $Message }
  Assert-True $response.success "Pi rejected extension command $Message."
}

function New-ApiRequest([string]$Method, [string]$Path, [string]$Bearer, $Body, [string]$Origin) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$ApiBase$Path")
  if ($Bearer) { $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Bearer) }
  if ($Origin) { $request.Headers.TryAddWithoutValidation('Origin', $Origin) | Out-Null }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Compress -Depth 32
    $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
  }
  return $request
}

function Send-Api([string]$Method, [string]$Path, [string]$Bearer = '', $Body = $null, [string]$Origin = '') {
  if ($Method -eq 'POST' -and $Path -eq '/pairings/claim') { Reserve-ClaimSlots }
  $request = New-ApiRequest $Method $Path $Bearer $Body $Origin
  try {
    $response = $http.SendAsync($request).GetAwaiter().GetResult()
    try {
      $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      return @{ Status = [int]$response.StatusCode; Text = $text }
    } catch {
      $response.Dispose()
      throw
    } finally {
      $response.Dispose()
    }
  } finally {
    $request.Dispose()
  }
}

function Reserve-ClaimSlots([int]$Attempts = 1) {
  if ($Attempts -lt 1 -or $Attempts -gt 5) { throw 'The requested claim attempt count is outside the production limit.' }
  $now = [DateTime]::UtcNow
  if ($null -eq $script:claimWindowStarted -or ($now - $script:claimWindowStarted).TotalSeconds -ge 60.2) {
    $script:claimWindowStarted = $now
    $script:claimAttemptsInWindow = 0
  }
  if ($script:claimAttemptsInWindow + $Attempts -gt 5) {
    $remaining = 60 - ($now - $script:claimWindowStarted).TotalSeconds
    if ($remaining -gt 0) { Start-Sleep -Milliseconds ([int][Math]::Ceiling($remaining * 1000) + 200) }
    if ([DateTime]::UtcNow -ge $script:scenarioDeadline) { throw 'The Pi claim pacing exceeded the total scenario deadline.' }
    $script:claimWindowStarted = [DateTime]::UtcNow
    $script:claimAttemptsInWindow = 0
  }
  $script:claimAttemptsInWindow += $Attempts
}

function Claim-Concurrently([string]$Code) {
  Reserve-ClaimSlots 2
  $body = @{ code = $Code; consentToVisibleText = $true; consentVersion = 1 }
  $requests = @(
    (New-ApiRequest 'POST' '/pairings/claim' '' $body ''),
    (New-ApiRequest 'POST' '/pairings/claim' '' $body '')
  )
  try {
    $tasks = @($requests | ForEach-Object { $http.SendAsync($_) })
    [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tasks, 10000) | Out-Null
    $results = foreach ($task in $tasks) {
      $response = $task.GetAwaiter().GetResult()
      try {
        @{ Status = [int]$response.StatusCode; Text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() }
      } finally {
        $response.Dispose()
      }
    }
    return ,$results
  } finally {
    foreach ($request in $requests) { $request.Dispose() }
  }
}

function Claim-CancelConcurrently([string]$Code) {
  Reserve-ClaimSlots
  $claimBody = @{ code = $Code; consentToVisibleText = $true; consentVersion = 1 }
  $claimRequest = New-ApiRequest 'POST' '/pairings/claim' '' $claimBody ''
  $cancelRequest = New-ApiRequest 'POST' '/pairings/cancel' '' @{ code = $Code } ''
  try {
    $claimTask = $http.SendAsync($claimRequest)
    $cancelTask = $http.SendAsync($cancelRequest)
    [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]@($claimTask, $cancelTask), 10000) | Out-Null
    $claimResponse = $claimTask.GetAwaiter().GetResult()
    $cancelResponse = $cancelTask.GetAwaiter().GetResult()
    try {
      $claimStatus = [int]$claimResponse.StatusCode
      $claimText = $claimResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      Assert-True ($claimStatus -eq 200 -or $claimStatus -eq 401) 'The in-flight claim returned an unexpected status.'
      Assert-Equal ([int]$cancelResponse.StatusCode) 204 'Concurrent code cancellation did not complete.'
      if ($claimStatus -eq 200) {
        $lateCapability = ($claimText | ConvertFrom-Json -AsHashtable).capability
        $lateRead = Send-Api 'GET' '/sessions/snapshot' $lateCapability
        Assert-Equal $lateRead.Status 401 'A claim response restored access after concurrent cancellation.'
      }
    } finally {
      $claimResponse.Dispose()
      $cancelResponse.Dispose()
    }
  } finally {
    $claimRequest.Dispose()
    $cancelRequest.Dispose()
  }
}

function Wait-ForSnapshot([string]$Capability, [int]$TimeoutSeconds = 20) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $result = Send-Api 'GET' '/sessions/snapshot' $Capability
    if ($result.Status -eq 200) {
      return @{
        Snapshot = $result.Text | ConvertFrom-Json -AsHashtable
        Bytes = [System.Text.Encoding]::UTF8.GetByteCount($result.Text)
      }
    }
    if ($result.Status -ne 204) { throw "Snapshot request failed with HTTP $($result.Status)." }
    Start-Sleep -Milliseconds 250
  }
  throw 'Pi did not publish a snapshot before the deadline.'
}

function Read-SseSnapshot([string]$Capability) {
  $request = New-ApiRequest 'GET' '/sessions/stream' $Capability $null 'http://localhost:5173'
  $response = $null
  try {
    $response = $http.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    Assert-Equal ([int]$response.StatusCode) 200 'The authenticated SSE request failed.'
    $allowOrigin = $response.Headers.GetValues('Access-Control-Allow-Origin') | Select-Object -First 1
    Assert-Equal $allowOrigin 'http://localhost:5173' 'The hijacked SSE response did not preserve the approved CORS origin.'
    $reader = [System.IO.StreamReader]::new($response.Content.ReadAsStream())
    $eventName = ''
    $eventData = ''
    $streamDeadline = [DateTime]::UtcNow.AddSeconds(12)
    while ([DateTime]::UtcNow -lt $streamDeadline) {
      $remaining = [int][Math]::Floor(($streamDeadline - [DateTime]::UtcNow).TotalMilliseconds)
      if ($remaining -le 0) { throw 'SSE snapshot delivery exceeded its total deadline.' }
      $lineTask = $reader.ReadLineAsync()
      if (-not $lineTask.Wait([Math]::Min(5000, $remaining))) { throw 'SSE did not deliver an event before the deadline.' }
      $line = $lineTask.Result
      if ($null -eq $line) { break }
      if ($line.Length -eq 0) {
        if ($eventData) { break }
        $eventName = ''
        continue
      }
      if ($line.StartsWith('event:')) { $eventName = $line.Substring(6).Trim() }
      if ($line.StartsWith('data:')) { $eventData = $line.Substring(5).TrimStart() }
    }
    if (-not $eventData) { throw 'SSE snapshot delivery exceeded its total deadline.' }
    Assert-Equal $eventName 'snapshot' 'The SSE stream did not deliver a snapshot event.'
    Assert-True ($eventData.Length -gt 16384) 'The SSE snapshot did not exceed the normal stream backpressure threshold.'
    return $eventData | ConvertFrom-Json -AsHashtable
  } finally {
    if ($response) { $response.Dispose() }
    $request.Dispose()
  }
}

function Get-ApprovedPairing([bool]$Race = $true) {
  $dialog = Start-PairPrompt
  $code = [regex]::Match($dialog.message, 'One-time code: ([A-F0-9-]+)').Groups[1].Value
  Assert-True ($code.Length -gt 0) 'Pi did not display a new one-time code.'
  Show-PairRequest $dialog
  Finish-PairPrompt $dialog $true
  $negativeConsent = Send-Api 'POST' '/pairings/claim' '' @{ code = $code; consentToVisibleText = $false; consentVersion = 1 }
  Assert-Equal $negativeConsent.Status 400 'The API accepted a claim without explicit consent.'
  $anonymousBeforeConsent = Send-Api 'GET' '/sessions/snapshot' ''
  Assert-Equal $anonymousBeforeConsent.Status 401 'Session content was readable before consent.'
  if ($Race) {
    $claims = Claim-Concurrently $code
    $successes = @($claims | Where-Object Status -eq 200)
    $failures = @($claims | Where-Object Status -eq 401)
    Assert-Equal $successes.Count 1 'Exactly one simultaneous one-time code claim must succeed.'
    Assert-Equal $failures.Count 1 'The competing one-time code claim must fail.'
    $claim = $successes[0].Text | ConvertFrom-Json -AsHashtable
  } else {
    $response = Send-Api 'POST' '/pairings/claim' '' @{ code = $code; consentToVisibleText = $true; consentVersion = 1 }
    Assert-Equal $response.Status 200 'The one-time code claim failed.'
    $claim = $response.Text | ConvertFrom-Json -AsHashtable
  }
  return @{ Claim = $claim; Code = $code }
}

function Assert-SnapshotMarkers($Snapshot, [string[]]$ExpectedText, [string[]]$ExcludedText) {
  $json = $Snapshot | ConvertTo-Json -Compress -Depth 32
  foreach ($marker in $ExpectedText) { Assert-True ($json.Contains($marker)) "Expected text did not arrive: $marker" }
  foreach ($marker in $ExcludedText) { Assert-True (-not $json.Contains($marker)) "Filtered content appeared: $marker" }
}

try {
  $http.Timeout = [TimeSpan]::FromSeconds(5)
  $ApiBase = $ApiBase.TrimEnd('/')
  foreach ($directory in @($testRoot, $project, $config, $sessions)) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
  Save-ProcessInventory $processBeforePath
  $health = Send-Api 'GET' '/sessions/snapshot' ''
  Assert-Equal $health.Status 401 'Anonymous snapshot access must fail.'
  $anonymousStream = Send-Api 'GET' '/sessions/stream' ''
  Assert-Equal $anonymousStream.Status 401 'Anonymous stream access must fail.'
  $wrongCode = Send-Api 'POST' '/pairings/claim' '' @{ code = ('0' * 32); consentToVisibleText = $true; consentVersion = 1 }
  Assert-Equal $wrongCode.Status 401 'A wrong pairing code must fail.'
  Test-CancellationTombstones

  $smallFixture = Join-Path $testRoot 'synthetic-session.jsonl'
  $largeFixture = Join-Path $testRoot 'synthetic-unicode-session.jsonl'
  $overLimitFixture = Join-Path $testRoot 'synthetic-over-limit-session.jsonl'
  New-SessionFixture $smallFixture '30000000-0000-4000-8000-000000000001' (('A' * 20000) + ' UTF8_MARKER_é_🙂') $true
  New-SessionFixture $largeFixture '30000000-0000-4000-8000-000000000002' ('é' * 250000) $false
  New-SessionFixture $overLimitFixture '30000000-0000-4000-8000-000000000003' ('é' * 270000) $false

  $install = [System.Diagnostics.ProcessStartInfo]::new($PiPath)
  $install.ArgumentList.Add('install')
  $install.ArgumentList.Add($package)
  $install.ArgumentList.Add('--local')
  $install.ArgumentList.Add('--approve')
  $install.WorkingDirectory = $project
  $install.RedirectStandardOutput = $true
  $install.RedirectStandardError = $true
  $install.UseShellExecute = $false
  $install.EnvironmentVariables['PI_CODING_AGENT_DIR'] = $config
  $install.EnvironmentVariables['PI_CODING_AGENT_SESSION_DIR'] = $sessions
  $install.EnvironmentVariables['AGENT_WORKSTREAM'] = 'AGENT_BaobabSection23_1'
  $installProcess = [System.Diagnostics.Process]::Start($install)
  $ownedProcessRecords.Add([pscustomobject]@{ ProcessId = $installProcess.Id; Role = 'Pi project-local extension install'; Tag = 'AGENT_BaobabSection23_1' })
  $installOutputTask = $installProcess.StandardOutput.ReadToEndAsync()
  $installErrorTask = $installProcess.StandardError.ReadToEndAsync()
  if (-not $installProcess.WaitForExit(30000)) { $installProcess.Kill(); $installProcess.WaitForExit(5000); throw 'Local Pi extension install timed out.' }
  $installOutputText = Redact-Diagnostic $installOutputTask.GetAwaiter().GetResult()
  $installErrorText = Redact-Diagnostic $installErrorTask.GetAwaiter().GetResult()
  if ($installProcess.ExitCode -ne 0) { throw "Pi rejected the project-local extension package. $installErrorText $installOutputText" }
  $installProcess.Dispose()
  $installProcess = $null
  if (-not (Test-Path (Join-Path $project '.pi\settings.json'))) { throw 'Pi did not write project-local package settings.' }

  $start = [System.Diagnostics.ProcessStartInfo]::new($PiPath)
  foreach ($argument in @('--mode', 'rpc', '--approve', '--name', 'AGENT_BaobabSection23_1', '--session-dir', $sessions, '--session', $smallFixture, '--offline', '--no-mcp', '--no-context-files')) { $start.ArgumentList.Add($argument) }
  $start.WorkingDirectory = $project
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.UseShellExecute = $false
  $start.EnvironmentVariables['PI_CODING_AGENT_DIR'] = $config
  $start.EnvironmentVariables['PI_CODING_AGENT_SESSION_DIR'] = $sessions
  $start.EnvironmentVariables['AGENT_WORKSTREAM'] = 'AGENT_BaobabSection23_1'
  $piProcess = [System.Diagnostics.Process]::Start($start)
  $ownedProcessRecords.Add([pscustomobject]@{ ProcessId = $piProcess.Id; Role = 'Pi functional RPC process'; Tag = 'AGENT_BaobabSection23_1' })
  $rpcStderrTask = $piProcess.StandardError.ReadToEndAsync()
  $state = Invoke-RpcCommand @{ type = 'get_state' }
  Assert-True $state.success 'Installed Pi did not start in isolated RPC mode.'

  $cancelDialog = Start-PairPrompt
  $cancelCode = [regex]::Match($cancelDialog.message, 'One-time code: ([A-F0-9-]+)').Groups[1].Value
  Assert-True ($cancelCode.Length -gt 0) 'Pi did not display its one-time code in the confirmation request.'
  Show-PairRequest $cancelDialog
  Finish-PairPrompt $cancelDialog $false
  $cancelPending = Send-Api 'POST' '/pairings/cancel' '' @{ code = $cancelCode }
  Assert-Equal $cancelPending.Status 204 'Canceling an unregistered Pi code did not return safely.'
  $cancelClaim = Send-Api 'POST' '/pairings/claim' '' @{ code = $cancelCode; consentToVisibleText = $true; consentVersion = 1 }
  Assert-Equal $cancelClaim.Status 401 'Canceling the Pi confirmation must not register a pair.'

  $pairing = Get-ApprovedPairing
  $claim = $pairing.Claim
  $code = $pairing.Code
  $capability = $claim.capability
  Assert-True ($capability -match '^[0-9a-f]{64}$') 'The claim did not return a scoped capability.'

  $snapshotResult = Wait-ForSnapshot $capability
  $snapshot = $snapshotResult.Snapshot
  Assert-Equal $snapshot.pairingId $claim.pairingId 'The snapshot pairing identity changed.'
  Assert-Equal $snapshot.bridgeId $claim.bridgeId 'The snapshot bridge identity changed.'
  Assert-Equal $snapshot.sessionId $claim.sessionId 'The snapshot session identity changed.'
  Assert-Equal $snapshot.pairEpoch $claim.pairEpoch 'The snapshot epoch changed.'
  Assert-SnapshotMarkers $snapshot @('UTF8_MARKER_é_🙂', 'VISIBLE_ASSISTANT_MARKER') @('SYSTEM_MARKER', 'TOOL_CALL_ARGUMENT_MARKER', 'TOOL_RESULT_MARKER')
  Assert-True (@($snapshot.entries | Where-Object { $_.text.Length -gt 16384 }).Count -gt 0) 'The fixture did not exercise an in-limit large event.'

  $sseSnapshot = Read-SseSnapshot $capability
  Assert-Equal $sseSnapshot.pairingId $claim.pairingId 'The SSE snapshot belonged to another pair.'
  $reconnectedSnapshot = Read-SseSnapshot $capability
  Assert-Equal $reconnectedSnapshot.sequence $sseSnapshot.sequence 'Reconnect did not return the current snapshot.'

  $replay = Send-Api 'POST' '/pairings/claim' '' @{ code = $code; consentToVisibleText = $true; consentVersion = 1 }
  Assert-Equal $replay.Status 401 'A consumed pairing code must not be replayed.'
  $revocation = Send-Api 'POST' '/sessions/revoke' $capability
  Assert-Equal $revocation.Status 204 'Browser revocation failed.'
  $afterRevoke = Send-Api 'GET' '/sessions/snapshot' $capability
  Assert-Equal $afterRevoke.Status 401 'A revoked capability still read the snapshot.'
  Invoke-ExtensionPrompt '/baobab disable'

  $largeSwitch = Invoke-RpcCommand @{ type = 'switch_session'; sessionPath = $largeFixture }
  Assert-True ($largeSwitch.success -and -not $largeSwitch.data.cancelled) 'Pi did not switch to the synthetic Unicode session.'
  $largePair = Get-ApprovedPairing $false
  $largeCapability = $largePair.Claim.capability
  $largeResult = Wait-ForSnapshot $largeCapability
  Assert-Equal $largeResult.Snapshot.state 'idle' 'The in-limit Unicode snapshot was rejected.'
  Assert-True ($largeResult.Bytes -gt 16384 -and $largeResult.Bytes -lt (512 * 1024)) 'The Unicode fixture did not exercise the in-limit byte boundary.'
  Assert-True ($largeResult.Snapshot.entries[0].text.StartsWith('é')) 'The Unicode fixture changed during Pi synchronization.'
  $largeCancel = Send-Api 'POST' '/pairings/cancel' '' @{ code = $largePair.Code }
  Assert-Equal $largeCancel.Status 204 'Code cancellation after approval failed.'
  $largeCancelledRead = Send-Api 'GET' '/sessions/snapshot' $largeCapability
  Assert-Equal $largeCancelledRead.Status 401 'A code-cancelled pair still served its snapshot.'
  Invoke-ExtensionPrompt '/baobab disable'
  $afterDisable = Send-Api 'GET' '/sessions/snapshot' $largeCapability
  Assert-Equal $afterDisable.Status 401 'Pi disable left the browser capability active.'

  $overLimitSwitch = Invoke-RpcCommand @{ type = 'switch_session'; sessionPath = $overLimitFixture }
  Assert-True ($overLimitSwitch.success -and -not $overLimitSwitch.data.cancelled) 'Pi did not switch to the over-limit synthetic session.'
  $overLimitPair = Get-ApprovedPairing $false
  $overLimitCapability = $overLimitPair.Claim.capability
  $overLimitResult = Wait-ForSnapshot $overLimitCapability
  Assert-Equal $overLimitResult.Snapshot.state 'sync_limited' 'An over-limit UTF-8 snapshot was not rejected.'
  Assert-Equal $overLimitResult.Snapshot.entries.Count 0 'An over-limit snapshot contained partial text.'

  $switchResponse = Invoke-RpcCommand @{ type = 'new_session' }
  Assert-True $switchResponse.success 'Pi new-session command failed.'
  $oldSessionRead = Send-Api 'GET' '/sessions/snapshot' $overLimitCapability
  Assert-Equal $oldSessionRead.Status 401 'A Pi session switch left the previous capability active.'

  $raceDialog = Start-PairPrompt
  $raceCode = [regex]::Match($raceDialog.message, 'One-time code: ([A-F0-9-]+)').Groups[1].Value
  Show-PairRequest $raceDialog
  Finish-PairPrompt $raceDialog $true
  Claim-CancelConcurrently $raceCode
  Invoke-ExtensionPrompt '/baobab disable'

  $scriptSucceeded = $true
} catch {
  $failureMessage = Redact-Diagnostic $_.Exception.Message
  $diagnostics = @()
  if ($rpcStderrTask -and $rpcStderrTask.IsCompleted) { $diagnostics += (Redact-Diagnostic $rpcStderrTask.Result) }
  if ($installOutputTask -and $installOutputTask.IsCompleted) { $diagnostics += (Redact-Diagnostic $installOutputTask.Result) }
  if ($installErrorTask -and $installErrorTask.IsCompleted) { $diagnostics += (Redact-Diagnostic $installErrorTask.Result) }
  if ($diagnostics.Count -gt 0) { $failureMessage += "`n" + ($diagnostics -join "`n") }
} finally {
  if ($piProcess) {
    if (-not $piProcess.HasExited) {
      try { $piProcess.StandardInput.Close() } catch { }
      if (-not $piProcess.WaitForExit(5000)) {
        $piProcess.Kill()
        if (-not $piProcess.WaitForExit(5000)) {
          $scriptSucceeded = $false
          $failureMessage = "Owned Pi process $($piProcess.Id) did not exit after shutdown and termination requests."
        }
      }
    }
    $piProcess.Dispose()
  }
  if ($installProcess) {
    if (-not $installProcess.HasExited) {
      $installProcess.Kill()
      if (-not $installProcess.WaitForExit(5000)) {
        $scriptSucceeded = $false
        $failureMessage = "Owned Pi install process $($installProcess.Id) did not exit after termination."
      }
    }
    $installProcess.Dispose()
  }
  $http.Dispose()
  if (Test-Path $testRoot) {
    try { Save-ProcessInventory $processAfterPath } catch { $failureMessage = Redact-Diagnostic $_.Exception.Message; $scriptSucceeded = $false }
    $ownedProcessRecords | Export-Csv -LiteralPath (Join-Path $testRoot 'owned-processes.csv') -NoTypeInformation -Encoding utf8
    $result = if ($scriptSucceeded) { 'PASS' } else { 'FAIL: ' + $failureMessage }
    Set-Content -LiteralPath (Join-Path $testRoot 'result.txt') -Value $result -Encoding utf8
    try {
      New-Item -ItemType Directory -Force -Path $evidencePath | Out-Null
      if ($scriptSucceeded) {
        Copy-Item -LiteralPath $processBeforePath,$processAfterPath,(Join-Path $testRoot 'owned-processes.csv'),(Join-Path $testRoot 'result.txt') -Destination $evidencePath
      } else {
        if ($failureMessage) { Set-Content -LiteralPath $failurePath -Value $failureMessage -Encoding utf8 }
        Copy-Item -LiteralPath $testRoot -Destination $evidencePath -Recurse -Force
      }
    } catch {
      $failureMessage = Redact-Diagnostic $_.Exception.Message
      $scriptSucceeded = $false
    }
    if (-not $KeepTemporaryFiles -and $scriptSucceeded -and (Test-Path -LiteralPath $testRoot)) {
      $resolvedTemporaryRoot = (Resolve-Path -LiteralPath $testRoot).Path
      if (Test-OwnedTemporaryRoot $resolvedTemporaryRoot) {
        Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
      }
    }
  }
}

if ($scriptSucceeded) {
  Write-Host "Pi session boundary functional checks passed. Process evidence: $evidencePath"
} else {
  if ($failureMessage) { throw $failureMessage }
  throw "Pi session boundary checks failed. Evidence: $evidencePath"
}
