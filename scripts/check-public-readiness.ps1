[CmdletBinding()]
param(
    [string]$EnvFile = ".env.public"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
node (Join-Path $PSScriptRoot "check-public-readiness.mjs") --env-file (Join-Path $root $EnvFile)
exit $LASTEXITCODE
