param(
  [string]$LlamaServerPath,
  [string]$ModelPath,
  [string]$ChatTemplatePath = 'C:\Users\Akash\.codex\evidence\AGENT_pi-baobab-gemma2b-base-text_REVIEW.jinja',
  [string]$PiPath = (Join-Path $env:USERPROFILE '.bun\bin\pi.exe'),
  [string]$ApiBase = 'http://127.0.0.1:3001/api/pi',
  [string]$ModelId = 'google/gemma-2b',
  [int]$LlamaPort = 9931,
  [ValidateRange(1, 32)][int]$OutputTokens = 32,
  [switch]$KeepTemporaryFiles,
  [switch]$ControlsOnly
)

$ErrorActionPreference = 'Stop'
$script:deadline = [DateTime]::UtcNow.AddMinutes(15)
$script:tempRoot = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP ('baobab-pi-candidate-' + [guid]::NewGuid().ToString('N'))))
$script:tempPrefix = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$script:configDir = Join-Path $script:tempRoot 'pi-config'
$script:sessionDir = Join-Path $script:tempRoot 'pi-sessions'
$script:projectDir = Join-Path $script:tempRoot 'project'
$script:providerProbeExtensionPath = Join-Path $script:projectDir 'AGENT_provider_probe.mjs'
$script:fixturePath = Join-Path $script:tempRoot 'synthetic-session.jsonl'
$script:evidenceDir = Join-Path $env:USERPROFILE ('.codex\evidence\AGENT_pi-candidate-' + [guid]::NewGuid().ToString('N'))
$script:processBefore = Join-Path $script:evidenceDir 'process-before.csv'
$script:processAfter = Join-Path $script:evidenceDir 'process-after.csv'
$script:pi = $null
$script:installer = $null
$script:piStderr = $null
$script:llama = $null
$script:llamaOut = $null
$script:llamaErr = $null
$script:api = $null
$script:sse = $null
$script:fixtureServer = $null
$script:cancelWindowStart = $null
$script:cancelWindowCount = 0
$script:candidateWindowStart = $null
$script:owned = [System.Collections.Generic.List[object]]::new()
$script:syntheticPairs = [System.Collections.Generic.List[object]]::new()
$script:runnerEvents = [System.Collections.Generic.List[object]]::new()
$script:apiRequestDiagnostics = [System.Collections.Generic.List[object]]::new()
$script:success = $false
$script:phase = 'initialize'
$script:primaryFailurePhase = $null
$script:primaryFailure = $null
$script:cleanupFailures = [System.Collections.Generic.List[string]]::new()
$script:clientHeartbeatDueAt = [DateTime]::MaxValue
$script:freeMemoryBytes = 0L
$script:controlsOnly = [bool]$ControlsOnly
$script:rateLimitWindowSeconds = 60
$script:rateLimitSafetyMarginSeconds = 2

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;

public sealed class AgentBaobabLoopbackFixture : IDisposable
{
    private readonly HttpListener listener = new HttpListener();
    private readonly Thread worker;
    private readonly int sentinelPort;
    private readonly string mode;
    private readonly string modelId;
    private readonly int streamTokenLimit;
    private volatile bool stopping;
    private int sentinelCount;
    private int completionCount;
    private int templateCount;
    private int streamingRequestCount;
    private int abortedStreamCount;
    private int completedStreamCount;
    private int streamFailureCount;

    public AgentBaobabLoopbackFixture(int endpointPort, int sentinelPort, string mode, string modelId, int streamTokenLimit)
    {
        this.sentinelPort = sentinelPort;
        this.mode = mode;
        this.modelId = modelId;
        this.streamTokenLimit = Math.Max(1, Math.Min(streamTokenLimit, 32));
        listener.Prefixes.Add("http://127.0.0.1:" + endpointPort + "/");
        listener.Prefixes.Add("http://127.0.0.1:" + sentinelPort + "/");
        worker = new Thread(Run);
        worker.IsBackground = true;
    }

    public int SentinelCount { get { return Interlocked.CompareExchange(ref sentinelCount, 0, 0); } }
    public int CompletionCount { get { return Interlocked.CompareExchange(ref completionCount, 0, 0); } }
    public int TemplateCount { get { return Interlocked.CompareExchange(ref templateCount, 0, 0); } }
    public int StreamingRequestCount { get { return Interlocked.CompareExchange(ref streamingRequestCount, 0, 0); } }
    public int AbortedStreamCount { get { return Interlocked.CompareExchange(ref abortedStreamCount, 0, 0); } }
    public int CompletedStreamCount { get { return Interlocked.CompareExchange(ref completedStreamCount, 0, 0); } }
    public int StreamFailureCount { get { return Interlocked.CompareExchange(ref streamFailureCount, 0, 0); } }
    public bool IsListening { get { return listener.IsListening; } }
    public bool WorkerAlive { get { return worker.IsAlive; } }

    public void Start()
    {
        listener.Start();
        worker.Start();
    }

    private void Run()
    {
        IAsyncResult pending = listener.BeginGetContext(null, null);
        while (!stopping)
        {
            try
            {
                if (!pending.AsyncWaitHandle.WaitOne(250)) continue;
                HttpListenerContext context = listener.EndGetContext(pending);
                Handle(context);
                if (!stopping) pending = listener.BeginGetContext(null, null);
            }
            catch (Exception) { stopping = true; }
        }
    }

    private void Handle(HttpListenerContext context)
    {
        if (context.Request.Url.Port == sentinelPort)
        {
            Interlocked.Increment(ref sentinelCount);
            context.Response.StatusCode = 204;
            context.Response.Close();
            return;
        }

        string path = context.Request.Url.AbsolutePath;
        if (path == "/sentinel")
        {
            Interlocked.Increment(ref sentinelCount);
            context.Response.StatusCode = 204;
            context.Response.Close();
            return;
        }

        if (mode == "discovery" && path == "/v1/models")
        {
            Redirect(context);
            return;
        }

        if (mode == "provider" && (path == "/v1/completions" || path == "/v1/chat/completions"))
        {
            Interlocked.Increment(ref completionCount);
            Redirect(context);
            return;
        }
        if (mode == "stream" && path == "/v1/chat/completions")
        {
            StreamCompletion(context);
            return;
        }
        if (mode == "template" && path == "/apply-template")
        {
            Interlocked.Increment(ref templateCount);
            Redirect(context);
            return;
        }

        if (path == "/v1/models")
        {
            Write(context, 200, "{\"data\":[{\"id\":\"" + modelId + "\"}]}");
            return;
        }
        if (path == "/props")
        {
            Write(context, 200, "{\"default_generation_settings\":{\"n_ctx\":8192}}");
            return;
        }
        if (path == "/apply-template")
        {
            Write(context, 200, "{\"prompt\":\"synthetic candidate context\"}");
            return;
        }
        if (path == "/tokenize")
        {
            Write(context, 200, "{\"tokens\":[1]}");
            return;
        }
        Write(context, 404, "{}");
    }

    private void Redirect(HttpListenerContext context)
    {
        context.Response.StatusCode = 307;
        context.Response.RedirectLocation = "http://127.0.0.1:" + sentinelPort + "/sentinel";
        context.Response.Close();
    }

    private void Write(HttpListenerContext context, int status, string text)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(text);
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        context.Response.ContentLength64 = bytes.Length;
        context.Response.OutputStream.Write(bytes, 0, bytes.Length);
        context.Response.Close();
    }

    private void StreamCompletion(HttpListenerContext context)
    {
        int requestedTokens;
        try
        {
            using (var reader = new System.IO.StreamReader(context.Request.InputStream, context.Request.ContentEncoding))
            using (var document = JsonDocument.Parse(reader.ReadToEnd()))
            {
                JsonElement root = document.RootElement;
                requestedTokens = root.TryGetProperty("max_tokens", out JsonElement legacyLimit)
                    ? legacyLimit.GetInt32()
                    : root.GetProperty("max_completion_tokens").GetInt32();
                if (context.Request.HttpMethod != "POST" || !root.GetProperty("stream").GetBoolean() ||
                    root.GetProperty("model").GetString() != modelId || requestedTokens < 1 || requestedTokens > streamTokenLimit)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    return;
                }
            }
        }
        catch (Exception)
        {
            context.Response.StatusCode = 400;
            context.Response.Close();
            return;
        }
        Interlocked.Increment(ref streamingRequestCount);
        context.Response.StatusCode = 200;
        context.Response.ContentType = "text/event-stream";
        context.Response.SendChunked = true;
        context.Response.KeepAlive = true;
        try
        {
            for (int index = 0; index < requestedTokens && !stopping; index++)
            {
                WriteStreamFrame(context, "{\"id\":\"agent-synthetic\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"" + modelId + "\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"x\"},\"finish_reason\":null}]}");
                Thread.Sleep(250);
            }
            if (!stopping)
            {
                WriteStreamFrame(context, "{\"id\":\"agent-synthetic\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"" + modelId + "\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}");
                byte[] done = Encoding.UTF8.GetBytes("data: [DONE]\n\n");
                context.Response.OutputStream.Write(done, 0, done.Length);
                context.Response.OutputStream.Flush();
                Interlocked.Increment(ref completedStreamCount);
            }
        }
        catch (HttpListenerException)
        {
            if (!stopping) Interlocked.Increment(ref abortedStreamCount);
        }
        catch (IOException)
        {
            if (!stopping) Interlocked.Increment(ref abortedStreamCount);
        }
        catch (ObjectDisposedException)
        {
            if (!stopping) Interlocked.Increment(ref abortedStreamCount);
        }
        catch (Exception)
        {
            Interlocked.Increment(ref streamFailureCount);
        }
        finally
        {
            try { context.Response.Close(); } catch (Exception) { }
        }
    }

    private void WriteStreamFrame(HttpListenerContext context, string json)
    {
        byte[] frame = Encoding.UTF8.GetBytes("data: " + json + "\n\n");
        context.Response.OutputStream.Write(frame, 0, frame.Length);
        context.Response.OutputStream.Flush();
    }

    public void Dispose()
    {
        stopping = true;
        listener.Close();
        worker.Join(1000);
    }
}
'@

function Assert-True([bool]$Value, [string]$Message) {
  if (-not $Value) { throw $Message }
}

function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -ne $Expected) { throw "$Message Expected $Expected, received $Actual." }
}

function Get-RemainingMilliseconds {
  $remaining = [int][Math]::Floor(($script:deadline - [DateTime]::UtcNow).TotalMilliseconds)
  if ($remaining -le 0) { throw 'The candidate functional scenario exceeded its 15-minute deadline.' }
  return $remaining
}

function Save-ProcessInventory([string]$Path) {
  Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding utf8
}

function Redact-EvidenceText([string]$Text) {
  return $Text -replace 'One-time code: [A-F0-9-]+', 'One-time code: [redacted]' -replace '(?i)Bearer\s+[A-F0-9]{64}', 'Bearer [redacted]'
}

function Write-RunnerEvidence([string]$Path, [string]$Text) {
  $safeText = Redact-EvidenceText $Text
  [System.IO.File]::WriteAllText($Path, $safeText, [System.Text.UTF8Encoding]::new($false))
}

function Record-CleanupFailure([string]$Action, [string]$Message) {
  $safeMessage = Redact-EvidenceText $Message
  $script:cleanupFailures.Add("$Action`: $safeMessage")
}

function Invoke-CleanupAction([string]$Action, [scriptblock]$Operation) {
  try {
    & $Operation
    return $true
  } catch {
    Record-CleanupFailure $Action $_.Exception.Message
    return $false
  }
}

function New-RunnerResultRecord([string]$Status, [string]$Phase, [string]$PrimaryFailure) {
  return [ordered]@{
    status = $Status
    phase = $Phase
    primaryFailure = $PrimaryFailure
    cleanupFailures = $script:cleanupFailures.ToArray()
    temporaryRoot = $script:tempRoot
    freePhysicalMemoryBytes = $script:freeMemoryBytes
    executionMode = if ($script:controlsOnly) { 'controls-only synthetic state; no model server' } else { 'bounded F16 candidate run' }
    serverProfile = if ($script:controlsOnly) { 'not used' } else { 'CPU-only, one slot, context 512, output at most 32 tokens' }
    ownedProcesses = $script:owned.ToArray()
    runnerEvents = $script:runnerEvents.ToArray()
    apiRequestDiagnostics = $script:apiRequestDiagnostics.ToArray()
  }
}

function Add-RunnerEvent([string]$Kind, [string]$State = '', [string]$Method = '', [string]$Outcome = '', [string]$Command = '', [int]$Generation = -1, [int]$Sequence = -1, [bool]$Replay = $false, [string]$ProviderState = '', [string]$OwnershipCheck = '', [string]$ReplacementCheck = '', [string]$WarningCode = '') {
  $entry = [ordered]@{ atUtc = [DateTime]::UtcNow.ToString('o'); phase = $script:phase; kind = $Kind }
  if ($State) { $entry.state = $State }
  if ($Method) { $entry.method = $Method }
  if ($Outcome) { $entry.outcome = $Outcome }
  if ($Command) { $entry.command = $Command }
  if ($Generation -ge 0) { $entry.generation = $Generation }
  if ($Sequence -ge 0) { $entry.sequence = $Sequence }
  if ($Replay) { $entry.replay = $true }
  if ($ProviderState) { $entry.providerState = $ProviderState }
  if ($OwnershipCheck) { $entry.ownershipCheck = $OwnershipCheck }
  if ($ReplacementCheck) { $entry.replacementCheck = $ReplacementCheck }
  if ($WarningCode) { $entry.warningCode = $WarningCode }
  $script:runnerEvents.Add($entry)
}

function Record-PiRpcMetadata($Record) {
  if ($Record.type -eq 'response') {
    $command = if ($Record.command -in @('prompt', 'get_state', 'get_commands')) { [string]$Record.command } else { 'other' }
    $outcome = if ($Record.success -eq $true) { 'success' } elseif ($Record.success -eq $false) { 'failure' } else { 'unknown' }
    $disposition = ''
    if ($Record.data -is [System.Collections.IDictionary] -and $Record.data.disposition -in @('started', 'queued', 'handled', 'follow_up', 'steering')) {
      $disposition = [string]$Record.data.disposition
    }
    Add-RunnerEvent 'pi_rpc_response' -State $disposition -Outcome $outcome -Command $command
    return
  }
  if ($Record.type -eq 'extension_ui_request') {
    $method = if ($Record.method -in @('confirm', 'notify')) { [string]$Record.method } else { 'other' }
    $notifyType = if ($Record.notifyType -in @('info', 'warning', 'error')) { [string]$Record.notifyType } else { '' }
    $providerState = ''
    $ownershipCheck = ''
    $replacementCheck = ''
    $warningCode = ''
    if ($Record.method -eq 'notify' -and $Record.message -is [string]) {
      if ($Record.message -match '^AGENT_PROVIDER_STATE:(present|absent)$') { $providerState = $Matches[1] }
      elseif ($Record.message -match '^AGENT_PROVIDER_OWNERSHIP:(refresh-stable|refresh-changed):(replacement-changed|replacement-same):(cleanup-removed|cleanup-present)$') { $ownershipCheck = $Matches[0] }
      elseif ($Record.message -match '^AGENT_PROVIDER_REPLACEMENT:(registered|already-present|cleanup-removed|cleanup-present)$') { $replacementCheck = $Matches[0] }
      elseif ($Record.message -ceq 'A candidate is already active for this Pi session.') { $warningCode = 'candidate_already_active' }
      elseif ($Record.message -ceq 'The Baobab candidate provider is already in use. No provider was replaced.') { $warningCode = 'provider_already_in_use' }
      elseif ($Record.message -ceq 'Pair this Pi session before starting a candidate.') { $warningCode = 'session_not_paired' }
      elseif ($Record.message -ceq 'Wait for an idle, current Pi snapshot before starting a candidate.') { $warningCode = 'snapshot_not_current' }
      elseif ($Record.message -ceq 'The Pi branch changed. Wait for Baobab to receive the current snapshot, then try again.') { $warningCode = 'branch_changed' }
      elseif ($Record.message -ceq 'Candidate generation ended. Check Baobab for the status.') { $warningCode = 'candidate_generation_ended' }
    }
    Add-RunnerEvent 'pi_extension_ui' -State $notifyType -Method $method -ProviderState $providerState -OwnershipCheck $ownershipCheck -ReplacementCheck $replacementCheck -WarningCode $warningCode
    return
  }
  if ($Record.type -eq 'extension_ui_response') {
    $outcome = if ($Record.confirmed -eq $true) { 'confirmed' } elseif ($Record.confirmed -eq $false) { 'declined' } elseif ($Record.cancelled -eq $true) { 'cancelled' } else { 'other' }
    Add-RunnerEvent 'pi_extension_ui_response' -Outcome $outcome
  }
}

function Record-CandidateMetadata($CandidateEvent) {
  $state = if ($CandidateEvent.state -in @('pending', 'streaming', 'completed', 'cancelled', 'error')) { [string]$CandidateEvent.state } else { 'other' }
  $generation = if ($CandidateEvent.generation -is [int] -or $CandidateEvent.generation -is [long]) { [int]$CandidateEvent.generation } else { -1 }
  $sequence = if ($CandidateEvent.sequence -is [int] -or $CandidateEvent.sequence -is [long]) { [int]$CandidateEvent.sequence } else { -1 }
  Add-RunnerEvent 'candidate_sse' -State $state -Generation $generation -Sequence $sequence -Replay ($CandidateEvent.replay -eq $true)
}

function Invoke-PiProviderProbe([string]$Action, [string]$ExpectedOwnership = '', [string]$ExpectedProviderState = '', [string]$ExpectedReplacement = '') {
  $eventStart = $script:runnerEvents.Count
  Invoke-PiPrompt "/baobab-provider-probe $Action"
  $stateResponse = Invoke-RpcResponse @{ type = 'get_state' }
  Assert-True $stateResponse.success 'Pi did not complete the provider registry probe.'
  $events = @($script:runnerEvents.ToArray() | Select-Object -Skip $eventStart)
  if ($ExpectedOwnership) {
    $observed = @($events | Where-Object { $_.ownershipCheck })
    Assert-Equal $observed.Count 1 'Pi did not return one provider ownership result.'
    Assert-Equal $observed[0].ownershipCheck $ExpectedOwnership 'Pi provider ownership check returned an unexpected result.'
  }
  if ($ExpectedProviderState) {
    $observed = @($events | Where-Object { $_.providerState })
    Assert-Equal $observed.Count 1 'Pi did not return one candidate provider catalog result.'
    Assert-Equal $observed[0].providerState $ExpectedProviderState 'The candidate provider catalog state was unexpected.'
  }
  if ($ExpectedReplacement) {
    $observed = @($events | Where-Object { $_.replacementCheck })
    Assert-Equal $observed.Count 1 'Pi did not return one candidate provider replacement result.'
    Assert-Equal $observed[0].replacementCheck $ExpectedReplacement 'The candidate provider replacement result was unexpected.'
  }
}

function Assert-NoNextCandidateEvent([hashtable]$Stream) {
  try {
    $unexpected = Read-SseCandidate $Stream 1000
    throw "A candidate event arrived after the provider conflict: $($unexpected.state)."
  } catch {
    if ($_.Exception.Message -notmatch 'did not produce an event before its deadline') { throw }
  }
}

function Test-PiCandidateProviderCollision([int]$Generation) {
  $script:phase = 'candidate-provider-collision'
  Invoke-PiProviderProbe 'replace-candidate' '' '' 'AGENT_PROVIDER_REPLACEMENT:registered'
  $stream = Open-Sse $script:claim.capability
  try {
    if ($Generation -gt 0) {
      $current = Read-Generation $stream $Generation
      Assert-True $current.replay 'The provider collision check did not start from the current terminal candidate.'
      Assert-Equal $current.state 'error' 'The expected preceding candidate is not terminal.'
    }
    $eventStart = $script:runnerEvents.Count
    Invoke-PiPrompt "/baobab candidate http://127.0.0.1:$LlamaPort $ModelId $OutputTokens"
    $stateResponse = Invoke-RpcResponse @{ type = 'get_state' }
    Assert-True $stateResponse.success 'Pi did not return state after the provider collision command.'
    $metadata = @($script:runnerEvents.ToArray() | Select-Object -Skip $eventStart)
    $warnings = @($metadata | Where-Object { $_.kind -eq 'pi_extension_ui' -and $_.method -eq 'notify' -and $_.warningCode -eq 'provider_already_in_use' })
    Assert-Equal $warnings.Count 1 'Pi did not report the existing candidate provider conflict with its safe reason code.'
    Assert-NoNextCandidateEvent $stream
  } finally { Close-Sse $stream }
  Invoke-PiProviderProbe 'catalog' '' 'present'
  Invoke-PiProviderProbe 'cleanup-candidate' '' '' 'AGENT_PROVIDER_REPLACEMENT:cleanup-removed'
  Invoke-PiProviderProbe 'catalog' '' 'absent'
}

function Add-TaskProcessDescendants([int]$RootProcessId, [string]$Role) {
  $known = [System.Collections.Generic.HashSet[int]]::new()
  foreach ($record in $script:owned) { [void]$known.Add([int]$record.ProcessId) }
  $all = @(Get-CimInstance Win32_Process)
  $frontier = @($RootProcessId)
  while ($frontier.Count -gt 0) {
    $children = @($all | Where-Object { $_.ParentProcessId -in $frontier -and -not $known.Contains([int]$_.ProcessId) })
    $frontier = @()
    foreach ($child in $children) {
      $id = [int]$child.ProcessId
      if ($known.Add($id)) {
        $script:owned.Add(@{ ProcessId = $id; Role = "$Role child"; Tag = 'AGENT_BaobabCandidate' })
        $frontier += $id
      }
    }
  }
}

function Get-Sha256([string]$Value) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
  return [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}

function Get-PiProviderProbeSource {
  return @'
const candidateProviderId = "baobab-local-llama-candidate";
const ownershipProviderId = "baobab-ownership-probe";
let candidateReplacementConfig;

function syntheticProviderConfig(name, modelId) {
  return {
    name,
    baseUrl: "http://127.0.0.1:9931/v1",
    apiKey: "local",
    api: "openai-completions",
    models: [{
      id: modelId,
      name: modelId,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 512,
      maxTokens: 1,
    }],
  };
}

export default function register(pi) {
  pi.registerCommand("baobab-provider-probe", {
    description: "Inspect temporary provider registry ownership",
    handler: async (args, ctx) => {
      const action = args.trim();
      const registry = ctx.modelRegistry;
      if (action === "catalog") {
        const present = registry.getRegisteredProviderConfig(candidateProviderId) !== undefined;
        ctx.ui.notify(`AGENT_PROVIDER_STATE:${present ? "present" : "absent"}`, present ? "warning" : "info");
        return;
      }
      if (action === "ownership") {
        let initialConfig;
        let replacementConfig;
        let refreshStable = false;
        let replacementChanged = false;
        let cleanupRemoved = false;
        try {
          if (registry.getRegisteredProviderConfig(ownershipProviderId) !== undefined) throw new Error();
          pi.registerProvider(ownershipProviderId, syntheticProviderConfig("Synthetic ownership provider", "ownership-probe-model"));
          initialConfig = registry.getRegisteredProviderConfig(ownershipProviderId);
          await registry.refresh({ allowNetwork: false });
          const refreshedConfig = registry.getRegisteredProviderConfig(ownershipProviderId);
          refreshStable = initialConfig !== undefined && initialConfig === refreshedConfig;
          pi.registerProvider(ownershipProviderId, { name: "Synthetic ownership replacement" });
          replacementConfig = registry.getRegisteredProviderConfig(ownershipProviderId);
          replacementChanged = replacementConfig !== undefined && replacementConfig !== refreshedConfig;
          if (replacementChanged && ctx.model?.provider !== ownershipProviderId &&
              registry.getRegisteredProviderConfig(ownershipProviderId) === replacementConfig) {
            pi.unregisterProvider(ownershipProviderId);
          }
          cleanupRemoved = registry.getRegisteredProviderConfig(ownershipProviderId) === undefined;
        } catch { }
        finally {
          const current = registry.getRegisteredProviderConfig(ownershipProviderId);
          const ownedConfig = replacementConfig ?? initialConfig;
          if (ownedConfig && current === ownedConfig && ctx.model?.provider !== ownershipProviderId) {
            pi.unregisterProvider(ownershipProviderId);
          }
        }
        ctx.ui.notify(`AGENT_PROVIDER_OWNERSHIP:${refreshStable ? "refresh-stable" : "refresh-changed"}:${replacementChanged ? "replacement-changed" : "replacement-same"}:${cleanupRemoved ? "cleanup-removed" : "cleanup-present"}`, refreshStable && replacementChanged && cleanupRemoved ? "info" : "error");
        return;
      }
      if (action === "replace-candidate") {
        if (registry.getRegisteredProviderConfig(candidateProviderId) !== undefined) {
          ctx.ui.notify("AGENT_PROVIDER_REPLACEMENT:already-present", "warning");
          return;
        }
        pi.registerProvider(candidateProviderId, syntheticProviderConfig("Synthetic unrelated replacement", "google/gemma-2b"));
        candidateReplacementConfig = registry.getRegisteredProviderConfig(candidateProviderId);
        ctx.ui.notify(candidateReplacementConfig ? "AGENT_PROVIDER_REPLACEMENT:registered" : "AGENT_PROVIDER_REPLACEMENT:already-present", candidateReplacementConfig ? "info" : "error");
        return;
      }
      if (action === "cleanup-candidate") {
        const current = registry.getRegisteredProviderConfig(candidateProviderId);
        if (candidateReplacementConfig && current === candidateReplacementConfig && ctx.model?.provider !== candidateProviderId) {
          pi.unregisterProvider(candidateProviderId);
        }
        const absent = registry.getRegisteredProviderConfig(candidateProviderId) === undefined;
        ctx.ui.notify(`AGENT_PROVIDER_REPLACEMENT:${absent ? "cleanup-removed" : "cleanup-present"}`, absent ? "info" : "error");
      }
    },
  });
}
'@
}

function New-HexSecret([int]$ByteLength) {
  $bytes = [byte[]]::new($ByteLength)
  $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  return [Convert]::ToHexString($bytes).ToLowerInvariant()
}

function Send-Api([string]$Method, [string]$Path, [string]$Bearer, $Body) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$ApiBase$Path")
  if ($Bearer) { $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Bearer) }
  if ($null -ne $Body) {
    $request.Content = [System.Net.Http.StringContent]::new(($Body | ConvertTo-Json -Compress -Depth 32), [System.Text.Encoding]::UTF8, 'application/json')
  }
  $timeout = [System.Threading.CancellationTokenSource]::new([int][Math]::Min(5000, (Get-RemainingMilliseconds)))
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  $bodyTimer = $null
  $response = $null
  $stage = 'headers'
  $diagnostic = [ordered]@{
    atUtc = [DateTime]::UtcNow.ToString('o')
    method = $Method
    route = $Path
    headersReceived = $false
    status = $null
    headersElapsedMilliseconds = $null
    bodyReadCompleted = $false
    bodyReadElapsedMilliseconds = $null
    failedStage = $null
    failureType = $null
    elapsedMilliseconds = $null
  }
  try {
    $response = $script:api.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead, $timeout.Token).GetAwaiter().GetResult()
    $diagnostic.headersReceived = $true
    $diagnostic.status = [int]$response.StatusCode
    $diagnostic.headersElapsedMilliseconds = $timer.ElapsedMilliseconds
    $stage = 'body'
    $bodyTimer = [System.Diagnostics.Stopwatch]::StartNew()
    $text = $response.Content.ReadAsStringAsync($timeout.Token).GetAwaiter().GetResult()
    $diagnostic.bodyReadCompleted = $true
    $diagnostic.bodyReadElapsedMilliseconds = $bodyTimer.ElapsedMilliseconds
    $stage = 'parse'
    $value = if ($text) { $text | ConvertFrom-Json -AsHashtable } else { $null }
    return @{ Status = [int]$response.StatusCode; Value = $value }
  } catch {
    $diagnostic.failedStage = $stage
    $diagnostic.failureType = $_.Exception.GetType().FullName
    if ($bodyTimer) { $diagnostic.bodyReadElapsedMilliseconds = $bodyTimer.ElapsedMilliseconds }
    throw
  } finally {
    $diagnostic.elapsedMilliseconds = $timer.ElapsedMilliseconds
    $script:apiRequestDiagnostics.Add($diagnostic)
    if ($response) { $response.Dispose() }
    $request.Dispose()
    $timeout.Dispose()
  }
}

function Renew-TestBrowserLease {
  if (-not $script:claim -or -not $script:claim.capability) { return }
  $response = Send-Api 'POST' '/sessions/client-heartbeat' $script:claim.capability $null
  Assert-Equal $response.Status 204 'The test browser lease heartbeat failed.'
  $script:clientHeartbeatDueAt = [DateTime]::UtcNow.AddSeconds(25)
}

function Maintain-TestBrowserLease([switch]$Force) {
  if (-not $script:claim -or -not $script:claim.capability) { return }
  if ($Force -or [DateTime]::UtcNow -ge $script:clientHeartbeatDueAt) {
    Renew-TestBrowserLease
  }
}

function Revoke-ApiPairCleanup([string]$Capability) {
  if (-not $script:api -or -not $Capability) { return }
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$ApiBase/sessions/revoke")
  $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Capability)
  $timeout = [System.Threading.CancellationTokenSource]::new(3000)
  try {
    $response = $script:api.SendAsync($request, $timeout.Token).GetAwaiter().GetResult()
    try { return [int]$response.StatusCode } finally { $response.Dispose() }
  } finally { $request.Dispose(); $timeout.Dispose() }
}

function Read-RpcRecord([int]$TimeoutMilliseconds = 15000) {
  Maintain-TestBrowserLease
  $wait = [Math]::Min($TimeoutMilliseconds, (Get-RemainingMilliseconds))
  $read = $script:pi.StandardOutput.ReadLineAsync()
  if (-not $read.Wait($wait)) { throw 'Pi RPC did not return a record before its deadline.' }
  Maintain-TestBrowserLease
  $line = $read.Result
  if ($null -eq $line) { throw 'Pi RPC closed its output stream.' }
  $record = $line | ConvertFrom-Json -AsHashtable
  Record-PiRpcMetadata $record
  return $record
}

function Send-Rpc($Value) {
  $script:pi.StandardInput.WriteLine(($Value | ConvertTo-Json -Compress -Depth 32))
  $script:pi.StandardInput.Flush()
}

function Invoke-RpcResponse([hashtable]$Command) {
  $id = [guid]::NewGuid().ToString('N')
  $Command.id = $id
  Send-Rpc $Command
  while ($true) {
    $record = Read-RpcRecord
    if ($record.type -eq 'response' -and $record.id -eq $id) { return $record }
  }
}

function Invoke-PiPrompt([string]$Message) {
  $result = Invoke-RpcResponse @{ type = 'prompt'; message = $Message }
  Assert-True $result.success 'Pi rejected an extension command.'
}

function Wait-PairDialog([string]$PromptId) {
  while ($true) {
    $record = Read-RpcRecord
    if ($record.type -eq 'extension_ui_request' -and $record.method -eq 'confirm') { return $record }
    if ($record.type -eq 'response' -and $record.id -eq $PromptId) { throw 'Pi completed pairing without a confirmation request.' }
  }
}

function New-PiPair {
  $promptId = [guid]::NewGuid().ToString('N')
  Send-Rpc @{ id = $promptId; type = 'prompt'; message = '/baobab pair' }
  $dialog = Wait-PairDialog $promptId
  $match = [regex]::Match([string]$dialog.message, 'One-time code: ([A-F0-9-]+)')
  Assert-True $match.Success 'Pi did not show a pairing code.'
  $code = $match.Groups[1].Value
  Send-Rpc @{ type = 'extension_ui_response'; id = $dialog.id; confirmed = $true }
  while ($true) {
    $record = Read-RpcRecord
    if ($record.type -eq 'response' -and $record.id -eq $promptId) {
      Assert-True $record.success 'Pi pairing command did not finish.'
      break
    }
  }
  $claim = Send-Api 'POST' '/pairings/claim' '' @{ code = $code; consentToVisibleText = $true; consentVersion = 1 }
  Assert-Equal $claim.Status 200 'The synthetic pair claim did not succeed.'
  return @{ Code = $code; Claim = $claim.Value }
}

function Wait-ForSnapshot([string]$Capability) {
  $until = [DateTime]::UtcNow.AddSeconds(20)
  while ([DateTime]::UtcNow -lt $until) {
    Maintain-TestBrowserLease
    $response = Send-Api 'GET' '/sessions/snapshot' $Capability $null
    if ($response.Status -eq 200) { return $response.Value }
    Start-Sleep -Milliseconds 100
  }
  throw 'Pi did not publish an approved visible snapshot.'
}

function Open-Sse([string]$Capability) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, "$ApiBase/sessions/stream")
  $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Capability)
  $request.Headers.Accept.ParseAdd('text/event-stream')
  $timeout = [System.Threading.CancellationTokenSource]::new([int][Math]::Min(5000, (Get-RemainingMilliseconds)))
  $response = $null
  $reader = $null
  $readLifetime = $null
  try {
    $response = $script:api.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead, $timeout.Token).GetAwaiter().GetResult()
    Assert-Equal ([int]$response.StatusCode) 200 'The authenticated candidate stream did not open.'
    $reader = [System.IO.StreamReader]::new($response.Content.ReadAsStream())
    $readLifetime = [System.Threading.CancellationTokenSource]::new()
    return @{ Request = $request; Response = $response; Reader = $reader; ReadLifetime = $readLifetime; PendingRead = $null; Closed = $false; CloseStatus = $null }
  } catch {
    if ($reader) { $reader.Dispose() }
    if ($response) { $response.Dispose() }
    $request.Dispose()
    if ($readLifetime) { $readLifetime.Dispose() }
    throw
  } finally { $timeout.Dispose() }
}

function Close-Sse($Stream) {
  if (-not $Stream -or $Stream.Closed) { return }
  $pending = $Stream.PendingRead
  $completedAfterCancel = ($null -eq $pending -or $pending.IsCompleted)
  $completedAfterDispose = $completedAfterCancel
  if ($Stream.ReadLifetime -and -not $Stream.ReadLifetime.IsCancellationRequested) { $Stream.ReadLifetime.Cancel() }
  if ($pending -and -not $pending.IsCompleted) {
    try { [void]$pending.Wait(1000) } catch [System.AggregateException] { }
    $completedAfterCancel = $pending.IsCompleted
  }
  if ($pending -and -not $pending.IsCompleted) {
    $Stream.Reader.Dispose()
    $Stream.Response.Dispose()
    $Stream.Request.Dispose()
    try { [void]$pending.Wait(1000) } catch [System.AggregateException] { }
    $completedAfterDispose = $pending.IsCompleted
  }
  if ($pending -and -not $pending.IsCompleted) { throw 'The pending candidate SSE read remained active after cancellation and response disposal.' }
  if ($pending) {
    try { $null = $pending.GetAwaiter().GetResult() }
    catch [System.OperationCanceledException] { }
    catch [System.ObjectDisposedException] { }
    catch [System.IO.IOException] { }
  }
  $Stream.Reader.Dispose()
  $Stream.Response.Dispose()
  $Stream.Request.Dispose()
  if ($Stream.ReadLifetime) { $Stream.ReadLifetime.Dispose() }
  $Stream.PendingRead = $null
  $Stream.CloseStatus = @{ readCompletedAfterCancel = $completedAfterCancel; readCompletedAfterDispose = $completedAfterDispose }
  $Stream.Closed = $true
}

function Read-SseCandidate($Stream, [int]$TimeoutMilliseconds = 120000) {
  $until = [DateTime]::UtcNow.AddMilliseconds([Math]::Min($TimeoutMilliseconds, (Get-RemainingMilliseconds)))
  $eventName = ''
  $data = [System.Collections.Generic.List[string]]::new()
  while ([DateTime]::UtcNow -lt $until) {
    Maintain-TestBrowserLease
    $remaining = [int][Math]::Max(1, ($until - [DateTime]::UtcNow).TotalMilliseconds)
    $lineTask = $Stream.Reader.ReadLineAsync($Stream.ReadLifetime.Token).AsTask()
    $Stream.PendingRead = $lineTask
    while (-not $lineTask.IsCompleted -and [DateTime]::UtcNow -lt $until) {
      $wait = $remaining
      if ($script:claim -and $script:claim.capability) {
        $heartbeatWait = [int][Math]::Max(1, ($script:clientHeartbeatDueAt - [DateTime]::UtcNow).TotalMilliseconds)
        $wait = [Math]::Min($wait, $heartbeatWait)
      }
      [void]$lineTask.Wait($wait)
      Maintain-TestBrowserLease
      $remaining = [int][Math]::Max(1, ($until - [DateTime]::UtcNow).TotalMilliseconds)
    }
    if (-not $lineTask.IsCompleted) {
      Close-Sse $Stream
      throw 'Pi candidate stream did not produce an event before its deadline.'
    }
    $Stream.PendingRead = $null
    $line = $lineTask.GetAwaiter().GetResult()
    if ($null -eq $line) { throw 'The candidate event stream closed early.' }
    if ($line.StartsWith('event:')) { $eventName = $line.Substring(6).Trim(); continue }
    if ($line.StartsWith('data:')) { $data.Add($line.Substring(5).TrimStart()); continue }
    if ($line.Length -eq 0 -and $data.Count -gt 0) {
      $payload = ($data -join "`n") | ConvertFrom-Json -AsHashtable
      $data.Clear()
      if ($eventName -eq 'candidate' -and $payload.type -eq 'candidate') {
        Record-CandidateMetadata $payload
        return $payload
      }
      $eventName = ''
    } elseif ($line.Length -eq 0) { $eventName = '' }
  }
  throw 'Pi candidate stream exceeded its absolute event deadline.'
}

function Read-Generation([hashtable]$Stream, [int]$Generation, [string]$CandidateId = '') {
  while ($true) {
    $event = Read-SseCandidate $Stream
    if ($event.generation -lt $Generation) { continue }
    Assert-Equal $event.generation $Generation 'Candidate generation changed unexpectedly.'
    if ($CandidateId) { Assert-Equal $event.candidateId $CandidateId 'Candidate ID changed within a generation.' }
    Assert-Equal $event.pairingId $script:claim.pairingId 'Candidate pairing identity changed.'
    Assert-Equal $event.bridgeId $script:claim.bridgeId 'Candidate bridge identity changed.'
    Assert-Equal $event.sessionId $script:claim.sessionId 'Candidate session identity changed.'
    Assert-Equal $event.pairEpoch $script:claim.pairEpoch 'Candidate pair epoch changed.'
    Assert-Equal $event.snapshotSequence $script:expectedSnapshot.sequence 'Candidate snapshot sequence changed.'
    Assert-Equal $event.baseEntryId $script:expectedSnapshot.entries[-1].id 'Candidate base entry changed.'
    Assert-Equal $event.modelId $ModelId 'Candidate model ID changed.'
    return $event
  }
}

function Invoke-PiCandidateCompletionBarrier([string]$CandidateId, [int]$Generation, [string]$ExpectedState) {
  $barrier = Invoke-RpcResponse @{ type = 'prompt'; message = '/baobab cancel' }
  Assert-True $barrier.success 'Pi did not finish candidate cleanup after its terminal event.'
  $stream = Open-Sse $script:claim.capability
  try {
    $replay = Read-Generation $stream $Generation $CandidateId
    Assert-Equal $replay.state $ExpectedState 'The cleanup barrier changed the server terminal state.'
    Assert-True $replay.replay 'The post-cleanup browser stream did not restore the current terminal candidate.'
  } finally { Close-Sse $stream }
  Invoke-PiProviderProbe 'catalog' '' 'absent'
}

function Invoke-CandidateToTerminal([string]$Capability, [string]$Endpoint, [int]$ExpectedGeneration, [string]$ExpectedState) {
  $stream = Open-Sse $Capability
  try {
    if (-not $script:candidateWindowStart) { $script:candidateWindowStart = [DateTime]::UtcNow }
    Invoke-PiPrompt "/baobab candidate $Endpoint $ModelId $OutputTokens"
    $text = [System.Text.StringBuilder]::new()
    $candidateId = ''
    $sawPending = $false
    $sawStreaming = $false
    $lastSequence = -1
    while ($true) {
      $event = Read-Generation $stream $ExpectedGeneration $candidateId
      if (-not $candidateId) { $candidateId = $event.candidateId }
      Assert-Equal $event.sequence ($lastSequence + 1) 'Candidate event sequence was not monotonic.'
      $lastSequence = $event.sequence
      if ($event.state -eq 'pending') { $sawPending = $true }
      if ($event.state -eq 'streaming') { $sawStreaming = $true; if ($event.delta) { [void]$text.Append([string]$event.delta) } }
      if ($event.state -in @('completed', 'cancelled', 'error')) {
        Assert-True $sawPending 'The candidate stream omitted its pending state.'
        if ($ExpectedState -eq 'completed') {
          Assert-True $sawStreaming 'The candidate returned no stream deltas.'
          Assert-True ($text.Length -gt 0) 'The candidate returned no text.'
        }
        Assert-Equal $event.state $ExpectedState 'The candidate reached an unexpected terminal state.'
        if ($ExpectedState -in @('completed', 'error')) {
          Invoke-PiCandidateCompletionBarrier $candidateId $ExpectedGeneration $ExpectedState
        }
        return @{ Event = $event; CandidateId = $candidateId; TextBytes = [System.Text.Encoding]::UTF8.GetByteCount($text.ToString()); SawStreaming = $sawStreaming }
      }
    }
  } finally { Close-Sse $stream }
}

function Start-LoopbackStreamingFixture {
  $ports = @()
  for ($index = 0; $index -lt 2; $index++) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $probe.Start()
    $ports += $probe.LocalEndpoint.Port
    $probe.Stop()
  }
  if ($ports[0] -eq $ports[1]) { throw 'Could not reserve distinct loopback ports for the synthetic streaming fixture.' }
  $server = [AgentBaobabLoopbackFixture]::new($ports[0], $ports[1], 'stream', $ModelId, $OutputTokens)
  $script:fixtureServer = $server
  $server.Start()
  return @{ Server = $server; Endpoint = "http://127.0.0.1:$($ports[0])" }
}

function Stop-LoopbackStreamingFixture($Fixture) {
  if (-not $Fixture -or -not $Fixture.Server) { return }
  $Fixture.Server.Dispose()
  if ($Fixture.Server.IsListening -or $Fixture.Server.WorkerAlive) { throw 'The synthetic streaming fixture listener or worker remained active after cleanup.' }
  if ([object]::ReferenceEquals($script:fixtureServer, $Fixture.Server)) { $script:fixtureServer = $null }
}

function Assert-LoopbackStreamAborted($Server) {
  $stopAt = [DateTime]::UtcNow.AddSeconds(5)
  while ($Server.AbortedStreamCount -eq 0 -and [DateTime]::UtcNow -lt $stopAt) {
    Maintain-TestBrowserLease
    Start-Sleep -Milliseconds 100
  }
  Assert-Equal $Server.StreamingRequestCount 1 'Pi did not open exactly one synthetic provider stream.'
  Assert-Equal $Server.AbortedStreamCount 1 'Cancellation did not close the synthetic provider response.'
  Assert-Equal $Server.CompletedStreamCount 0 'The synthetic provider stream completed naturally before cancellation.'
  Assert-Equal $Server.StreamFailureCount 0 'The synthetic provider fixture encountered an unexpected server-side failure.'
  Add-RunnerEvent 'synthetic_provider_fixture' -State 'cancelled' -Outcome 'one_request_aborted_without_natural_completion'
}

function Read-FirstCandidateDelta([hashtable]$Stream, [int]$Generation) {
  $candidateId = ''
  while ($true) {
    $event = Read-Generation $Stream $Generation $candidateId
    if (-not $candidateId) { $candidateId = $event.candidateId }
    if ($event.state -eq 'streaming') { return $event }
    if ($event.state -in @('completed', 'cancelled', 'error')) {
      throw 'The synthetic cancellation candidate terminated before its first delta.'
    }
  }
}

function Test-SyntheticCandidateCancellation([int]$Generation, [switch]$BrowserCancel, [switch]$RejectSecondCommand) {
  $script:phase = if ($BrowserCancel) { 'browser-cancellation-fixture' } else { 'pi-cancellation-fixture' }
  $fixture = Start-LoopbackStreamingFixture
  $stream = $null
  try {
    if (-not $script:candidateWindowStart) { $script:candidateWindowStart = [DateTime]::UtcNow }
    $stream = Open-Sse $script:claim.capability
    Invoke-PiPrompt "/baobab candidate $($fixture.Endpoint) $ModelId $OutputTokens"
    $firstDelta = Read-FirstCandidateDelta $stream $Generation
    if ($BrowserCancel) {
      $response = Send-BrowserCancel $script:claim.capability $script:claim.pairingId $firstDelta.candidateId $Generation $script:claim.pairEpoch
      Assert-Equal $response.Status 204 'The browser could not cancel the active synthetic candidate.'
    } else {
      if ($RejectSecondCommand) {
        $eventStart = $script:runnerEvents.Count
        Invoke-PiPrompt "/baobab candidate $($fixture.Endpoint) $ModelId $OutputTokens"
        $metadata = @($script:runnerEvents.ToArray() | Select-Object -Skip $eventStart)
        $activeWarnings = @($metadata | Where-Object { $_.kind -eq 'pi_extension_ui' -and $_.warningCode -eq 'candidate_already_active' })
        Assert-Equal $activeWarnings.Count 1 'Pi did not identify the rejected second candidate command.'
        Assert-Equal $fixture.Server.StreamingRequestCount 1 'The rejected second command opened another provider request.'
        $stillActive = Read-Generation $stream $Generation $firstDelta.candidateId
        Assert-Equal $stillActive.state 'streaming' 'The rejected command replaced or ended the active candidate.'
      }
      $response = Invoke-RpcResponse @{ type = 'prompt'; message = '/baobab cancel' }
      Assert-True $response.success 'The Pi cancel command did not wait for synthetic provider cleanup.'
    }
    $terminal = Read-Generation $stream $Generation $firstDelta.candidateId
    while ($terminal.state -notin @('cancelled', 'error', 'completed')) {
      $terminal = Read-Generation $stream $Generation $firstDelta.candidateId
    }
    Assert-Equal $terminal.state 'cancelled' 'The synthetic provider stream did not reach the cancelled state.'
    if ($BrowserCancel) {
      $response = Invoke-RpcResponse @{ type = 'prompt'; message = '/baobab cancel' }
      Assert-True $response.success 'The Pi cleanup barrier did not finish after browser cancellation.'
    }
    Assert-LoopbackStreamAborted $fixture.Server
    Invoke-PiProviderProbe 'catalog' '' 'absent'
  } finally {
    if ($stream) { Close-Sse $stream }
    Stop-LoopbackStreamingFixture $fixture
  }
}

function New-SyntheticApiPair {
  $code = (New-HexSecret 16).ToUpperInvariant()
  $bridge = New-HexSecret 32
  $pairingId = [guid]::NewGuid().ToString()
  $bridgeId = [guid]::NewGuid().ToString()
  $sessionId = [guid]::NewGuid().ToString()
  $registered = Send-Api 'POST' '/pairings' '' @{
    protocolVersion = 1
    pairingId = $pairingId
    bridgeId = $bridgeId
    sessionId = $sessionId
    pairingCodeHash = (Get-Sha256 $code)
    bridgeTokenHash = (Get-Sha256 $bridge)
  }
  Assert-Equal $registered.Status 201 'The synthetic API pair could not register.'
  $claimed = Send-Api 'POST' '/pairings/claim' '' @{ code = $code; consentToVisibleText = $true; consentVersion = 1 }
  Assert-Equal $claimed.Status 200 'The synthetic API pair could not claim consent.'
  $claim = $claimed.Value
  $snapshot = @{
    protocolVersion = 1; pairingId = $pairingId; bridgeId = $bridgeId; sessionId = $sessionId
    pairEpoch = $claim.pairEpoch; sequence = 1; state = 'idle'; entryCount = 1
    entries = @(@{ id = 'synthetic-base'; parentId = $null; role = 'user'; text = 'Synthetic visible test text.' })
  }
  $sent = Send-Api 'POST' '/sessions/snapshot' $bridge $snapshot
  Assert-Equal $sent.Status 204 'The synthetic API snapshot did not publish.'
  $pair = @{ PairingId = $pairingId; BridgeId = $bridgeId; SessionId = $sessionId; Epoch = $claim.pairEpoch; Bridge = $bridge; Claim = $claim }
  $script:syntheticPairs.Add($pair)
  return $pair
}

function Send-CandidateEvent($Pair, [string]$CandidateId, [int]$Generation, [int]$Sequence, [string]$State, [string]$Delta = '', [string]$ErrorCode = '') {
  if ($State -eq 'pending' -and -not $script:candidateWindowStart) { $script:candidateWindowStart = [DateTime]::UtcNow }
  $body = @{
    protocolVersion = 1; pairingId = $Pair.PairingId; bridgeId = $Pair.BridgeId; sessionId = $Pair.SessionId
    pairEpoch = $Pair.Epoch; candidateId = $CandidateId; generation = $Generation
    baseEntryId = 'synthetic-base'; snapshotSequence = 1; sequence = $Sequence; state = $State
    modelId = $ModelId
  }
  if ($Delta) { $body.delta = $Delta }
  if ($ErrorCode) { $body.errorCode = $ErrorCode }
  return Send-Api 'POST' '/sessions/candidates/events' $Pair.Bridge $body
}

function Send-BrowserCancel($Capability, $PairingId, $CandidateId, $Generation, $Epoch) {
  $now = [DateTime]::UtcNow
  if (-not $script:cancelWindowStart -or ($now - $script:cancelWindowStart).TotalSeconds -ge $script:rateLimitWindowSeconds) {
    $script:cancelWindowStart = $now
    $script:cancelWindowCount = 0
  }
  $script:cancelWindowCount++
  return Send-Api 'POST' '/sessions/candidates/cancel' $Capability @{ pairingId = $PairingId; candidateId = $CandidateId; generation = $Generation; pairEpoch = $Epoch }
}

function Test-GenerationRaceAndRateLimit {
  Wait-CancellationWindow
  $pair = New-SyntheticApiPair
  for ($attempt = 1; $attempt -le 12; $attempt++) {
    $filled = Send-BrowserCancel $pair.Claim.capability $pair.PairingId "tombstone-limit-$attempt" 4 $pair.Epoch
    Assert-Equal $filled.Status 204 'The synthetic cancellation limiter prefill failed.'
  }
  $failedId = [guid]::NewGuid().ToString()
  Assert-Equal (Send-CandidateEvent $pair $failedId 4 1 'error' '' 'endpoint_unavailable').Status 429 'The rate-limited terminal fallback unexpectedly stored a tombstone.'
  $secondId = [guid]::NewGuid().ToString()
  Assert-Equal (Send-CandidateEvent $pair $secondId 5 0 'pending').Status 204 'A generation gap after a failed terminal fallback was not accepted.'
  $lateFailedStart = Send-CandidateEvent $pair $failedId 4 0 'pending'
  Assert-Equal $lateFailedStart.Status 409 'The server accepted a generation older than its recovered high-water mark.'
  Assert-Equal (Send-CandidateEvent $pair $failedId 4 2 'streaming' 'stale generation').Status 409 'The server accepted a delayed failed generation delta.'
  $stream = Open-Sse $pair.Claim.capability
  try {
    do { $current = Read-SseCandidate $stream } until ($current.generation -eq 5)
    Assert-Equal $current.candidateId $secondId 'Reconnect replayed a retired candidate.'
    Assert-Equal $current.state 'pending' 'Reconnect did not replay the current candidate state.'
  } finally { Close-Sse $stream }
  $limited = Send-BrowserCancel $pair.Claim.capability $pair.PairingId $secondId 5 $pair.Epoch
  Assert-Equal $limited.Status 429 'The candidate cancellation limiter did not reject request 13.'
}

function Fill-CandidateStartLimit {
  $pair = New-SyntheticApiPair
  for ($generation = 1; $generation -le 6; $generation++) {
    $candidateId = [guid]::NewGuid().ToString()
    Assert-Equal (Send-CandidateEvent $pair $candidateId $generation 0 'pending').Status 204 'A synthetic in-limit candidate start failed.'
    Assert-Equal (Send-CandidateEvent $pair $candidateId $generation 1 'completed').Status 204 'A synthetic candidate did not reach terminal state.'
  }
}

function Wait-CandidateStartWindow {
  if (-not $script:candidateWindowStart) { return }
  $waitSeconds = $script:rateLimitWindowSeconds + $script:rateLimitSafetyMarginSeconds
  while (([DateTime]::UtcNow - $script:candidateWindowStart).TotalSeconds -lt $waitSeconds) {
    Maintain-TestBrowserLease
    $sleep = [int][Math]::Min(5000, (Get-RemainingMilliseconds))
    if ($script:claim -and $script:claim.capability) {
      $heartbeatWait = [int][Math]::Max(1, ($script:clientHeartbeatDueAt - [DateTime]::UtcNow).TotalMilliseconds)
      $sleep = [Math]::Min($sleep, $heartbeatWait)
    }
    Start-Sleep -Milliseconds $sleep
  }
  Maintain-TestBrowserLease
  $script:candidateWindowStart = [DateTime]::UtcNow
}

function Wait-CancellationWindow {
  if (-not $script:cancelWindowStart) { return }
  $waitSeconds = $script:rateLimitWindowSeconds + $script:rateLimitSafetyMarginSeconds
  while (([DateTime]::UtcNow - $script:cancelWindowStart).TotalSeconds -lt $waitSeconds) {
    Maintain-TestBrowserLease
    $sleep = [int][Math]::Min(5000, (Get-RemainingMilliseconds))
    if ($script:claim -and $script:claim.capability) {
      $heartbeatWait = [int][Math]::Max(1, ($script:clientHeartbeatDueAt - [DateTime]::UtcNow).TotalMilliseconds)
      $sleep = [Math]::Min($sleep, $heartbeatWait)
    }
    Start-Sleep -Milliseconds $sleep
  }
  Maintain-TestBrowserLease
  $script:cancelWindowStart = [DateTime]::UtcNow
  $script:cancelWindowCount = 0
}

function Assert-NoCandidateEvent([string]$Capability) {
  $stream = Open-Sse $Capability
  try {
    try {
      $event = Read-SseCandidate $stream 1000
      throw "A candidate event arrived for the refused start: $($event.generation)."
    } catch {
      if ($_.Exception.Message -notmatch 'did not produce an event before its deadline') { throw }
    }
  } finally { Close-Sse $stream }
}

function Test-PiGenerationGapRecovery {
  Fill-CandidateStartLimit
  for ($attempt = 1; $attempt -le 12; $attempt++) {
    $cancelled = Send-BrowserCancel $script:claim.capability $script:claim.pairingId "rate-limit-$attempt" 1 $script:claim.pairEpoch
    Assert-Equal $cancelled.Status 204 'The synthetic cancellation prefill did not reach the documented limit.'
  }
  $stream = Open-Sse $script:claim.capability
  try {
    Invoke-PiPrompt "/baobab candidate http://127.0.0.1:$LlamaPort $ModelId $OutputTokens"
    $cancelBarrier = Invoke-RpcResponse @{ type = 'prompt'; message = '/baobab cancel' }
    Assert-True $cancelBarrier.success 'The Pi command did not wait for cleanup after the refused candidate start.'
  } finally { Close-Sse $stream }
  Assert-NoCandidateEvent $script:claim.capability
  Wait-CandidateStartWindow
  $success = Invoke-CandidateToTerminal $script:claim.capability "http://127.0.0.1:$LlamaPort" 2 'completed'
  Assert-True ($success.TextBytes -le 65536) 'Recovered candidate text exceeded the documented UTF-8 byte bound.'
  Add-RunnerEvent 'model_candidate' -State 'completed' -Outcome 'approved_f16_gemma_single_completion'
}

function Test-RedirectFailure([string]$Mode, [int]$Generation) {
  $portPair = @()
  for ($i = 0; $i -lt 2; $i++) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $probe.Start()
    $portPair += $probe.LocalEndpoint.Port
    $probe.Stop()
  }
  if ($portPair[0] -eq $portPair[1]) { throw 'Could not reserve distinct loopback ports for the redirect fixture.' }
  $server = [AgentBaobabLoopbackFixture]::new($portPair[0], $portPair[1], $Mode, $ModelId, $OutputTokens)
  try {
    $server.Start()
    $result = Invoke-CandidateToTerminal $script:claim.capability "http://127.0.0.1:$($portPair[0])" $Generation 'error'
    Assert-Equal $server.SentinelCount 0 'A candidate request followed a redirect to another local origin.'
    if ($Mode -eq 'discovery') {
      Assert-Equal $result.Event.errorCode 'endpoint_unavailable' 'Discovery redirect did not fail closed.'
    } elseif ($Mode -eq 'template') {
      Assert-Equal $result.Event.errorCode 'endpoint_unavailable' 'Prompt-template redirect did not fail closed.'
      Assert-Equal $server.TemplateCount 1 'The prompt-bearing template request was not attempted.'
    } else {
      Assert-Equal $result.Event.errorCode 'provider_error' 'Provider redirect did not fail closed.'
      Assert-True ($server.CompletionCount -gt 0) 'The provider redirect test did not reach chat completion.'
    }
  } finally {
    $server.Dispose()
    if ($server.IsListening -or $server.WorkerAlive) { throw 'The loopback fixture listener or worker remained active after cleanup.' }
  }
}

function Test-UnavailableEndpoint([int]$Generation) {
  $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $probe.Start()
  $port = $probe.LocalEndpoint.Port
  $probe.Stop()
  if (-not $script:candidateWindowStart) { $script:candidateWindowStart = [DateTime]::UtcNow }
  $result = Invoke-CandidateToTerminal $script:claim.capability "http://127.0.0.1:$port" $Generation 'error'
  Assert-Equal $result.Event.errorCode 'endpoint_unavailable' 'The unavailable endpoint did not fail closed.'
}

try {
  $script:phase = 'preflight'
  New-Item -ItemType Directory -Force -Path $script:tempRoot,$script:configDir,$script:sessionDir,$script:projectDir,$script:evidenceDir | Out-Null
  Assert-True ($script:tempRoot.StartsWith($script:tempPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.Path]::GetFileName($script:tempRoot).StartsWith('baobab-pi-candidate-', [System.StringComparison]::OrdinalIgnoreCase)) 'The temporary test root is outside its task-owned temporary scope.'
  Save-ProcessInventory $script:processBefore
  $apiUri = [Uri]$ApiBase
  Assert-True ($apiUri.Scheme -eq 'http' -and $apiUri.Host -in @('127.0.0.1', 'localhost') -and $apiUri.Port -eq 3001) 'The Baobab API must use host loopback port 3001.'
  Assert-True ($apiUri.AbsolutePath -eq '/api/pi' -and -not $apiUri.Query -and -not $apiUri.UserInfo) 'ApiBase must be the loopback /api/pi root without credentials or query data.'
  Assert-True (Test-Path -LiteralPath $PiPath) 'The installed Pi executable was not found.'
  Assert-True ($OutputTokens -ge 1 -and $OutputTokens -le 32) 'OutputTokens must be between 1 and 32.'
  if (-not $ControlsOnly) {
    Assert-True (Test-Path -LiteralPath $LlamaServerPath) 'The existing llama-server executable was not found.'
    Assert-True (Test-Path -LiteralPath $ModelPath) 'The existing converted F16 model file was not found.'
    Assert-True (Test-Path -LiteralPath $ChatTemplatePath) 'The reviewed generic base-text template was not found.'
    Assert-Equal (Get-FileHash -Algorithm SHA256 -LiteralPath $ModelPath).Hash '865C522D53F5E84C0A79B39789F43E829023F3D6DEA9D92F5DAD7451CBAC7E5A' 'The model file is not the approved converted F16 output.'
    Assert-Equal (Get-FileHash -Algorithm SHA256 -LiteralPath $ChatTemplatePath).Hash 'AD5F8CB5867ACAB6983E73AA1E4CB14272D43ECF81F8B69B32A2483FEA15C05B' 'The chat template is not the reviewed generic base-text template.'
    $availableMemoryBytes = [int64](Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1024
    Assert-True ($availableMemoryBytes -ge 8GB) 'The CPU-only F16 check requires at least 8 GiB of free system memory.'
    $script:freeMemoryBytes = $availableMemoryBytes
  } else {
    $candidatePortListeners = @(Get-NetTCPConnection -State Listen -LocalPort $LlamaPort -ErrorAction SilentlyContinue)
    Assert-Equal $candidatePortListeners.Count 0 'The controls-only check requires its unused candidate port to remain closed.'
  }
  $health = Invoke-RestMethod -Uri ($apiUri.GetLeftPart([System.UriPartial]::Authority) + '/api/health') -TimeoutSec 5
  Assert-True ($null -ne $health) 'The isolated Baobab API is not healthy.'

  $handler = [System.Net.Http.SocketsHttpHandler]::new()
  $handler.AllowAutoRedirect = $false
  $handler.UseProxy = $false
  $handler.MaxResponseDrainSize = 0
  $handler.ResponseDrainTimeout = [TimeSpan]::FromSeconds(1)
  $script:api = [System.Net.Http.HttpClient]::new($handler)
  $script:api.Timeout = [System.Threading.Timeout]::InfiniteTimeSpan

  $fixtureText = 'Synthetic visible branch for the Baobab candidate functional check.'
  $stamp = [DateTime]::UtcNow.ToString('o')
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $fixtureLines = @(
    (@{ type = 'session'; version = 3; id = [guid]::NewGuid().ToString(); timestamp = $stamp; cwd = $script:projectDir } | ConvertTo-Json -Compress -Depth 8),
    (@{ type = 'message'; id = '10000001'; parentId = $null; timestamp = $stamp; message = @{ role = 'user'; content = $fixtureText; timestamp = $now } } | ConvertTo-Json -Compress -Depth 8)
  )
  [System.IO.File]::WriteAllLines($script:fixturePath, $fixtureLines, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($script:providerProbeExtensionPath, (Get-PiProviderProbeSource), [System.Text.UTF8Encoding]::new($false))

  if (-not $ControlsOnly) {
    $script:phase = 'llama-server-start'
    $serverArgs = @('--model', (Resolve-Path $ModelPath).Path, '--host', '127.0.0.1', '--port', [string]$LlamaPort, '--ctx-size', '512', '--parallel', '1', '--n-gpu-layers', '0', '--alias', $ModelId, '--jinja', '--chat-template-file', (Resolve-Path $ChatTemplatePath).Path, '--log-file', (Join-Path $script:evidenceDir 'llama-server.log'))
    $serverStart = [System.Diagnostics.ProcessStartInfo]::new((Resolve-Path $LlamaServerPath).Path)
    foreach ($argument in $serverArgs) { $serverStart.ArgumentList.Add([string]$argument) }
    $serverStart.WorkingDirectory = $script:tempRoot
    $serverProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $LlamaPort)
    try { $serverProbe.Start() } catch { throw "Loopback llama-server port $LlamaPort is already in use." } finally { $serverProbe.Stop() }
    $serverStart.RedirectStandardOutput = $true
    $serverStart.RedirectStandardError = $true
    $serverStart.UseShellExecute = $false
    $serverStart.EnvironmentVariables['AGENT_WORKSTREAM'] = 'AGENT_BaobabCandidate'
    $script:llama = [System.Diagnostics.Process]::Start($serverStart)
    $script:owned.Add(@{ ProcessId = $script:llama.Id; Role = 'Loopback llama-server'; Tag = 'AGENT_BaobabCandidate' })
    Add-TaskProcessDescendants $script:llama.Id 'Loopback llama-server'
    $script:llamaOut = $script:llama.StandardOutput.ReadToEndAsync()
    $script:llamaErr = $script:llama.StandardError.ReadToEndAsync()
    $healthUri = "http://127.0.0.1:$LlamaPort/health"
    $serverDeadline = [DateTime]::UtcNow.AddMinutes(3)
    $healthy = $false
    while ([DateTime]::UtcNow -lt $serverDeadline) {
      if ($script:llama.HasExited) { throw 'The task-owned llama-server exited before health became ready.' }
      try { $null = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2; $healthy = $true; break } catch { Start-Sleep -Milliseconds 500 }
    }
    Assert-True $healthy 'The task-owned llama-server did not become healthy within three minutes.'
    Add-TaskProcessDescendants $script:llama.Id 'Loopback llama-server'
    $serverProps = Invoke-RestMethod -Uri "http://127.0.0.1:$LlamaPort/props" -TimeoutSec 3
    Assert-Equal $serverProps.default_generation_settings.n_ctx 512 'The llama-server did not use the bounded 512-token context.'
  }

  $script:phase = 'pi-extension-install'
  $package = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $installStart = [System.Diagnostics.ProcessStartInfo]::new((Resolve-Path $PiPath).Path)
  foreach ($argument in @('install', $package, '--local', '--approve')) { $installStart.ArgumentList.Add($argument) }
  $installStart.WorkingDirectory = $script:projectDir
  $installStart.RedirectStandardOutput = $true
  $installStart.RedirectStandardError = $true
  $installStart.UseShellExecute = $false
  $installStart.EnvironmentVariables['PI_CODING_AGENT_DIR'] = $script:configDir
  $installStart.EnvironmentVariables['PI_CODING_AGENT_SESSION_DIR'] = $script:sessionDir
  $installStart.EnvironmentVariables['AGENT_WORKSTREAM'] = 'AGENT_BaobabCandidate'
  $script:installer = [System.Diagnostics.Process]::Start($installStart)
  $script:owned.Add(@{ ProcessId = $script:installer.Id; Role = 'Temporary Pi extension install'; Tag = 'AGENT_BaobabCandidate' })
  Add-TaskProcessDescendants $script:installer.Id 'Temporary Pi installer'
  $installOut = $script:installer.StandardOutput.ReadToEndAsync()
  $installErr = $script:installer.StandardError.ReadToEndAsync()
  if (-not $script:installer.WaitForExit([Math]::Min(60000, (Get-RemainingMilliseconds)))) { throw 'The project-local Pi install exceeded 60 seconds.' }
  if ($script:installer.ExitCode -ne 0) { throw 'The project-local Pi extension install failed.' }
  Add-TaskProcessDescendants $script:installer.Id 'Temporary Pi installer'
  $script:installer.Dispose()
  $script:installer = $null

  $script:phase = 'pi-rpc-start'
  $piStart = [System.Diagnostics.ProcessStartInfo]::new((Resolve-Path $PiPath).Path)
  foreach ($argument in @('--mode', 'rpc', '--approve', '--name', 'AGENT_BaobabCandidate', '--session-dir', $script:sessionDir, '--session', $script:fixturePath, '--offline', '--no-mcp', '--no-context-files', '--extension', $script:providerProbeExtensionPath)) { $piStart.ArgumentList.Add($argument) }
  $piStart.WorkingDirectory = $script:projectDir
  $piStart.RedirectStandardInput = $true
  $piStart.RedirectStandardOutput = $true
  $piStart.RedirectStandardError = $true
  $piStart.UseShellExecute = $false
  $piStart.EnvironmentVariables['PI_CODING_AGENT_DIR'] = $script:configDir
  $piStart.EnvironmentVariables['PI_CODING_AGENT_SESSION_DIR'] = $script:sessionDir
  $piStart.EnvironmentVariables['AGENT_WORKSTREAM'] = 'AGENT_BaobabCandidate'
  $script:pi = [System.Diagnostics.Process]::Start($piStart)
  $script:owned.Add(@{ ProcessId = $script:pi.Id; Role = 'Temporary Pi RPC process'; Tag = 'AGENT_BaobabCandidate' })
  Add-TaskProcessDescendants $script:pi.Id 'Temporary Pi RPC'
  $script:piStderr = $script:pi.StandardError.ReadToEndAsync()
  $state = Invoke-RpcResponse @{ type = 'get_state' }
  Assert-True $state.success 'Pi did not start in temporary RPC mode.'
  Add-TaskProcessDescendants $script:pi.Id 'Temporary Pi RPC'
  $script:phase = 'provider-refresh-ownership'
  Invoke-PiProviderProbe 'ownership' 'AGENT_PROVIDER_OWNERSHIP:refresh-stable:replacement-changed:cleanup-removed'
  $script:phase = 'pairing'
  $pair = New-PiPair
  $script:claim = $pair.Claim
  Maintain-TestBrowserLease -Force
  $snapshot = Wait-ForSnapshot $script:claim.capability
  Assert-Equal $snapshot.sessionId $script:claim.sessionId 'The visible snapshot belongs to a different Pi session.'
  $script:expectedSnapshot = $snapshot
  $startingSequence = $snapshot.sequence
  $sessionHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath $script:fixturePath).Hash

  if ($ControlsOnly) {
    $script:phase = 'controls-cancellation-generation-replay'
    Test-GenerationRaceAndRateLimit
    $script:phase = 'controls-provider-collision-cleanup'
    Test-PiCandidateProviderCollision 0
  } else {
    $script:phase = 'failed-start-generation-recovery'
    Test-PiGenerationGapRecovery
    $afterSuccess = Wait-ForSnapshot $script:claim.capability
    Assert-Equal $afterSuccess.sequence $startingSequence 'Candidate generation changed the Pi session snapshot.'
    Assert-Equal (Get-FileHash -Algorithm SHA256 -LiteralPath $script:fixturePath).Hash $sessionHashBefore 'Candidate generation changed the Pi session file.'
    Invoke-PiPrompt '/baobab status'

    $script:phase = 'browser-cancellation'
    Wait-CancellationWindow
    Test-SyntheticCandidateCancellation 3 -BrowserCancel

    $script:phase = 'pi-cancellation'
    Test-SyntheticCandidateCancellation 4 -RejectSecondCommand

    $script:phase = 'endpoint-rejection'
    Test-UnavailableEndpoint 5
    Test-RedirectFailure 'discovery' 6
    Test-RedirectFailure 'template' 7
    Wait-CandidateStartWindow
    Test-RedirectFailure 'provider' 8
    $script:phase = 'generation-replay-and-rate-limits'
    Test-GenerationRaceAndRateLimit
    Test-PiCandidateProviderCollision 8
  }
  $script:phase = 'final-revoke-capability'
  $revoked = Send-Api 'POST' '/sessions/revoke' $script:claim.capability $null
  Assert-Equal $revoked.Status 204 'The synthetic Pi pair did not revoke.'
  $script:phase = 'final-revoke-revoked-snapshot'
  $stillAuthorized = Send-Api 'GET' '/sessions/snapshot' $script:claim.capability $null
  Assert-Equal $stillAuthorized.Status 401 'The revoked capability still reads the Pi snapshot.'
  $script:success = $true
} catch {
  $script:primaryFailurePhase = $script:phase
  $script:primaryFailure = Redact-EvidenceText $_.Exception.Message
} finally {
  Invoke-CleanupAction 'write pre-cleanup evidence' {
    $preStatus = if ($script:success -and -not $script:primaryFailure) { 'scenario_passed_pending_cleanup' } else { 'scenario_failed' }
    $prePhase = $script:primaryFailurePhase ?? $script:phase
    $preRecord = New-RunnerResultRecord $preStatus $prePhase $script:primaryFailure
    $preJson = ConvertTo-Json -InputObject $preRecord -Depth 8
    Write-RunnerEvidence (Join-Path $script:evidenceDir 'pre-cleanup.json') $preJson
  }
  Invoke-CleanupAction 'close candidate SSE stream' { Close-Sse $script:sse; $script:sse = $null }
  Invoke-CleanupAction 'close redirect fixture' {
    if ($script:fixtureServer) { $script:fixtureServer.Dispose(); $script:fixtureServer = $null }
  }
  if ($script:api) {
    $capabilities = [System.Collections.Generic.List[string]]::new()
    if ($script:claim -and $script:claim.capability) { $capabilities.Add($script:claim.capability) }
    foreach ($pair in $script:syntheticPairs) { if ($pair.Claim.capability) { $capabilities.Add($pair.Claim.capability) } }
    foreach ($capability in ($capabilities | Select-Object -Unique)) {
      Invoke-CleanupAction 'revoke an owned test pairing' {
        $status = Revoke-ApiPairCleanup $capability
        if ($status -notin @(204, 401)) { throw "Test pairing cleanup returned HTTP $status." }
      }
    }
  }
  Invoke-CleanupAction 'record Pi process descendants' {
    if ($script:pi -and -not $script:pi.HasExited) { Add-TaskProcessDescendants $script:pi.Id 'Temporary Pi RPC' }
  }
  Invoke-CleanupAction 'record llama-server process descendants' {
    if ($script:llama -and -not $script:llama.HasExited) { Add-TaskProcessDescendants $script:llama.Id 'Loopback llama-server' }
  }
  if ($script:installer) {
    Invoke-CleanupAction 'stop the temporary Pi installer' {
      if (-not $script:installer.HasExited) {
        $script:installer.Kill($true)
        if (-not $script:installer.WaitForExit(5000)) { throw 'The owned Pi installer process did not exit.' }
      }
    }
    Invoke-CleanupAction 'save Pi installer stdout' {
      if ($installOut -and $installOut.IsCompleted) { Write-RunnerEvidence (Join-Path $script:evidenceDir 'pi-install-stdout.txt') $installOut.Result }
    }
    Invoke-CleanupAction 'save Pi installer stderr' {
      if ($installErr -and $installErr.IsCompleted) { Write-RunnerEvidence (Join-Path $script:evidenceDir 'pi-install-stderr.txt') $installErr.Result }
    }
    Invoke-CleanupAction 'dispose Pi installer handle' { $script:installer.Dispose(); $script:installer = $null }
  }
  if ($script:pi) {
    Invoke-CleanupAction 'stop the temporary Pi process' {
      if (-not $script:pi.HasExited) {
        try { $script:pi.StandardInput.Close() } catch { }
        if (-not $script:pi.WaitForExit(5000)) {
          $script:pi.Kill($true)
          if (-not $script:pi.WaitForExit(5000)) { throw 'The owned Pi process did not exit.' }
        }
      }
    }
    Invoke-CleanupAction 'save Pi stderr' {
      if ($script:piStderr -and $script:piStderr.IsCompleted) { Write-RunnerEvidence (Join-Path $script:evidenceDir 'pi-stderr.txt') $script:piStderr.Result }
    }
    Invoke-CleanupAction 'dispose Pi process handle' { $script:pi.Dispose(); $script:pi = $null }
  }
  if ($script:llama) {
    Invoke-CleanupAction 'stop llama-server' {
      if (-not $script:llama.HasExited) {
        $script:llama.Kill($true)
        if (-not $script:llama.WaitForExit(10000)) { throw 'The owned llama-server process did not exit.' }
      }
    }
    Invoke-CleanupAction 'save llama-server stdout' {
      if ($script:llamaOut -and $script:llamaOut.IsCompleted) { Write-RunnerEvidence (Join-Path $script:evidenceDir 'llama-stdout.txt') $script:llamaOut.Result }
    }
    Invoke-CleanupAction 'save llama-server stderr' {
      if ($script:llamaErr -and $script:llamaErr.IsCompleted) { Write-RunnerEvidence (Join-Path $script:evidenceDir 'llama-stderr.txt') $script:llamaErr.Result }
    }
    Invoke-CleanupAction 'dispose llama-server handle' { $script:llama.Dispose(); $script:llama = $null }
  }
  Invoke-CleanupAction 'verify llama-server listener closed' {
    if ($script:owned | Where-Object Role -eq 'Loopback llama-server') {
      $openListeners = @(Get-NetTCPConnection -State Listen -LocalPort $LlamaPort -ErrorAction SilentlyContinue)
      if ($openListeners.Count -gt 0) { throw "A listener remains on task-owned llama port $LlamaPort after cleanup." }
    }
  }
  if ($script:api) {
    Invoke-CleanupAction 'dispose API client' { $script:api.Dispose(); $script:api = $null }
  }
  Invoke-CleanupAction 'verify owned processes exited' {
    foreach ($record in $script:owned) {
      if (Get-Process -Id $record.ProcessId -ErrorAction SilentlyContinue) {
        throw "Owned process $($record.ProcessId) remains after cleanup."
      }
    }
  }
  if ($script:success -and -not $script:primaryFailure -and $script:cleanupFailures.Count -eq 0 -and -not $KeepTemporaryFiles) {
    Invoke-CleanupAction 'remove task temporary root' {
      $resolvedTempRoot = [System.IO.Path]::GetFullPath($script:tempRoot)
      if (-not ($resolvedTempRoot.StartsWith($script:tempPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.Path]::GetFileName($resolvedTempRoot).StartsWith('baobab-pi-candidate-', [System.StringComparison]::OrdinalIgnoreCase))) {
        throw 'The temporary cleanup target left its task-owned scope.'
      }
      Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
      if (Test-Path -LiteralPath $resolvedTempRoot) { throw 'The temporary test root remains after cleanup.' }
    }
  }
  Invoke-CleanupAction 'save process-after inventory' {
    if (Test-Path -LiteralPath $script:evidenceDir) { Save-ProcessInventory $script:processAfter }
  }
  Invoke-CleanupAction 'write final result record' {
    $finalStatus = if ($script:success -and -not $script:primaryFailure -and $script:cleanupFailures.Count -eq 0) { 'PASS' } else { 'FAIL' }
    $finalPhase = $script:primaryFailurePhase ?? $script:phase
    $finalRecord = New-RunnerResultRecord $finalStatus $finalPhase $script:primaryFailure
    $finalJson = ConvertTo-Json -InputObject $finalRecord -Depth 8
    Write-RunnerEvidence (Join-Path $script:evidenceDir 'result.json') $finalJson
  }
}

if (-not $script:success -or $script:primaryFailure -or $script:cleanupFailures.Count -gt 0) {
  $details = @($script:primaryFailure) + @($script:cleanupFailures)
  throw "Pi candidate functional check failed. Evidence: $script:evidenceDir. $($details -join '; ')"
}
Write-Host "Pi candidate functional check passed. Evidence: $script:evidenceDir"
