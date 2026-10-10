[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Host,
    [string]$User = "root",
    [ValidateRange(1, 65535)]
    [int]$Port = 22,
    [string]$IdentityFile,
    [string]$KnownHostsFile,
    [ValidatePattern("^[a-z_][a-z0-9_-]*$")]
    [string]$DeployUser = "arkadii"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "OpenSSH Client is required. Install it with: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0"
}
if (-not $Host -or $Host -notmatch '^[A-Za-z0-9.-]+$') {
    throw "Host must be a hostname or IP address without spaces or shell characters."
}

$bootstrapScript = Join-Path $PSScriptRoot "bootstrap-ovh.sh"
if (-not (Test-Path -LiteralPath $bootstrapScript)) {
    throw "Missing Linux bootstrap script: $bootstrapScript"
}

$sshArguments = @("-p", "$Port", "-o", "StrictHostKeyChecking=yes")
if ($IdentityFile) {
    $sshArguments += @("-i", (Resolve-Path -LiteralPath $IdentityFile))
}
if ($KnownHostsFile) {
    $sshArguments += @("-o", "UserKnownHostsFile=$(Resolve-Path -LiteralPath $KnownHostsFile)")
}

$remoteCommand = "sudo env DEPLOY_USER='$DeployUser' DEPLOY_ROOT='/srv/arkadii-quest' bash -s"
Get-Content -LiteralPath $bootstrapScript -Raw | & ssh @sshArguments "$User@$Host" $remoteCommand
if ($LASTEXITCODE -ne 0) {
    throw "OVH bootstrap failed with SSH exit code $LASTEXITCODE."
}
