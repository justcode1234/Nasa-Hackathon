param([Parameter(Mandatory=$true)][int]$RootProcessId)
$ErrorActionPreference = 'Stop'
$taskStarted = [DateTime]::UtcNow.ToString('o')
$taskSnapshot = @(Get-CimInstance -ClassName Win32_Process)
if (-not ($taskSnapshot | Where-Object ProcessId -eq $RootProcessId)) {
    throw 'The isolated browser process is no longer running.'
}
$taskIds = [Collections.Generic.HashSet[int]]::new()
[void]$taskIds.Add($RootProcessId)
do {
    $taskAdded = $false
    foreach ($taskEntry in $taskSnapshot) {
        if ($taskIds.Contains([int]$taskEntry.ParentProcessId) -and $taskIds.Add([int]$taskEntry.ProcessId)) {
            $taskAdded = $true
        }
    }
} while ($taskAdded)
$taskProcesses = @(foreach ($taskEntry in $taskSnapshot) {
    if (-not $taskIds.Contains([int]$taskEntry.ProcessId)) { continue }
    try {
        $taskProcess = [Diagnostics.Process]::GetProcessById([int]$taskEntry.ProcessId)
        $taskProcess.Refresh()
        [PSCustomObject]@{
            id = $taskProcess.Id
            parentId = [int]$taskEntry.ParentProcessId
            startedAt = $taskProcess.StartTime.ToUniversalTime().ToString('o')
            workingSetBytes = $taskProcess.WorkingSet64
            privateBytes = $taskProcess.PrivateMemorySize64
            peakWorkingSetBytes = $taskProcess.PeakWorkingSet64
        }
        $taskProcess.Dispose()
    } catch {
        # A short-lived subprocess can exit between the ancestry and memory reads.
        # Missing processes are a measurement limitation, never a zero-memory reading.
    }
})
[PSCustomObject]@{
    startedAt = $taskStarted
    finishedAt = [DateTime]::UtcNow.ToString('o')
    rootProcessId = $RootProcessId
    processes = $taskProcesses
} | ConvertTo-Json -Depth 4 -Compress
