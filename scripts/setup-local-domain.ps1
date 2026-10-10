[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Get-EnvFileValues([string]$Path) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*(?!#)(?<name>[A-Za-z_][A-Za-z0-9_]*)=(?<value>.*)$') {
            $values[$Matches.name] = $Matches.value.Trim()
        }
    }
    return $values
}

function Get-Value([hashtable]$Values, [string]$Name, [string]$Default) {
    if ($Values.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($Values[$Name])) {
        return $Values[$Name]
    }
    return $Default
}

function Write-Pem([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell session. It updates the Windows hosts file and trusted Root certificate store."
}

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw "PowerShell 7 or later is required. Install it from https://aka.ms/powershell and rerun this script."
}

$root = Split-Path -Parent $PSScriptRoot
$envValues = Get-EnvFileValues (Join-Path $root ".env")
$appDomain = Get-Value $envValues "APP_DOMAIN" "arkadii.game.local"
$grafanaDomain = Get-Value $envValues "GRAFANA_DOMAIN" "grafana.$appDomain"
$prometheusDomain = Get-Value $envValues "PROMETHEUS_DOMAIN" "prometheus.$appDomain"
$domains = @($appDomain, $grafanaDomain, $prometheusDomain)

$certDirectory = Join-Path $root "docker/nginx/certs"
$caKeyPath = Join-Path $certDirectory "arkadii-quest-local-ca.key"
$caCertPath = Join-Path $certDirectory "arkadii-quest-local-ca.crt"
$serverKeyPath = Join-Path $certDirectory "arkadii-quest-local.key"
$serverCertPath = Join-Path $certDirectory "arkadii-quest-local.crt"
New-Item -ItemType Directory -Path $certDirectory -Force | Out-Null

if ((Test-Path -LiteralPath $caKeyPath) -and (Test-Path -LiteralPath $caCertPath)) {
    $caKey = [Security.Cryptography.RSA]::Create()
    $caKey.ImportFromPem((Get-Content -LiteralPath $caKeyPath -Raw))
    $caCertificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new($caCertPath)
} else {
    $caKey = [Security.Cryptography.RSA]::Create(4096)
    $caRequest = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
        "CN=Arkadii Quest Local Development CA",
        $caKey,
        [Security.Cryptography.HashAlgorithmName]::SHA256,
        [Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $caRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true))
    $caRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
        [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,
        $true
    ))
    $caCertificate = $caRequest.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddYears(10))
    Write-Pem $caKeyPath $caKey.ExportPkcs8PrivateKeyPem()
    Write-Pem $caCertPath $caCertificate.ExportCertificatePem()
}

$serverKey = [Security.Cryptography.RSA]::Create(2048)
$serverRequest = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
    "CN=$appDomain",
    $serverKey,
    [Security.Cryptography.HashAlgorithmName]::SHA256,
    [Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$serverRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $false))
$serverRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
    [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,
    $true
))
$ekuOids = [Security.Cryptography.OidCollection]::new()
[void]$ekuOids.Add([Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1"))
$serverRequest.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($ekuOids, $false))
$san = [Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
foreach ($domain in $domains) { $san.AddDnsName($domain) }
$serverRequest.CertificateExtensions.Add($san.Build())
$serial = [byte[]]::new(16)
[Security.Cryptography.RandomNumberGenerator]::Fill($serial)
$signatureGenerator = [Security.Cryptography.X509Certificates.X509SignatureGenerator]::CreateForRSA($caKey, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
$signedServerCertificate = $serverRequest.Create(
    $caCertificate.SubjectName,
    $signatureGenerator,
    [DateTimeOffset]::UtcNow.AddDays(-1),
    [DateTimeOffset]::UtcNow.AddDays(825),
    $serial
)
$serverCertificate = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::CopyWithPrivateKey($signedServerCertificate, $serverKey)
Write-Pem $serverKeyPath $serverKey.ExportPkcs8PrivateKeyPem()
Write-Pem $serverCertPath $serverCertificate.ExportCertificatePem()

$rootStore = [Security.Cryptography.X509Certificates.X509Store]::new("Root", [Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine)
$rootStore.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
try {
    if ($rootStore.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint, $caCertificate.Thumbprint, $false).Count -eq 0) {
        $rootStore.Add($caCertificate)
    }
} finally {
    $rootStore.Close()
}

$hostsPath = Join-Path $env:SystemRoot "System32/drivers/etc/hosts"
$hostNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($line in Get-Content -LiteralPath $hostsPath) {
    $tokens = (($line -replace '#.*$', '').Trim() -split '\s+')
    if ($tokens.Count -gt 1) {
        foreach ($name in $tokens[1..($tokens.Count - 1)]) { [void]$hostNames.Add($name) }
    }
}
$missingDomains = @($domains | Where-Object { -not $hostNames.Contains($_) })
if ($missingDomains.Count -gt 0) {
    Add-Content -LiteralPath $hostsPath -Value ("127.0.0.1`t" + ($missingDomains -join " "))
}

Write-Host "Local HTTPS domains are ready:"
foreach ($domain in $domains) { Write-Host "  https://$domain" }
