param(
  [switch]$DryRun,
  [string]$TranslatorEndpoint,
  [string]$ApiKey,
  [string]$OpenChamberPath,
  [string]$Tag
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
function Find-OpenChamberInstall {
  if (-not [string]::IsNullOrWhiteSpace($OpenChamberPath)) {
    return (Resolve-Path -LiteralPath $OpenChamberPath).Path
  }

  $local = Join-Path $env:LOCALAPPDATA 'Programs\@openchamberelectron'
  if (Test-Path -LiteralPath (Join-Path $local 'OpenChamber.exe')) { return $local }
  return $null
}

if ([string]::IsNullOrWhiteSpace($Tag)) {
  $install = Find-OpenChamberInstall
  if ($install) {
    $version = (Get-Item (Join-Path $install 'OpenChamber.exe')).VersionInfo.ProductVersion
    if ($version -match '^\d+\.\d+\.\d+') { $Tag = "v$($Matches[0])" }
  }
}
if ([string]::IsNullOrWhiteSpace($Tag)) { $Tag = 'v1.21.1' }

$tag = $Tag
$sourceBase = "https://raw.githubusercontent.com/openchamber/openchamber/$tag/packages/ui/src/lib/i18n/messages"
$separator = '__OPENCHAMBER_TRANSLATION_SEPARATOR__'

function Read-Utf8File {
  param([string]$Path)
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding $false))
}

function Parse-TsDictBody {
  param([string]$Content, [string]$ExportName)
  $startMarker = "export const $ExportName = {"
  $start = $Content.IndexOf($startMarker)
  if ($start -lt 0) { throw "Cannot find '$startMarker'." }
  $start += $startMarker.Length
  $end = $Content.LastIndexOf('} as const')
  if ($end -lt 0) { $end = $Content.LastIndexOf('};') }
  if ($end -lt $start) { throw "Cannot find the end of $ExportName." }
  return $Content.Substring($start, $end - $start).Trim()
}

function Parse-Entries {
  param([string]$Body)
  $entries = [ordered]@{}
  $i = 0
  while ($i -lt $Body.Length) {
    while ($i -lt $Body.Length -and ([char]::IsWhiteSpace($Body[$i]) -or $Body[$i] -eq ',')) { $i++ }
    if ($i -ge $Body.Length) { break }
    if ($Body[$i] -ne "'" -and $Body[$i] -ne '"') { $i++; continue }

    $quote = $Body[$i++]
    $key = New-Object System.Text.StringBuilder
    while ($i -lt $Body.Length -and $Body[$i] -ne $quote) {
      if ($Body[$i] -eq '\' -and ($i + 1) -lt $Body.Length) { [void]$key.Append($Body[$i + 1]); $i += 2; continue }
      [void]$key.Append($Body[$i++])
    }
    $i++
    while ($i -lt $Body.Length -and [char]::IsWhiteSpace($Body[$i])) { $i++ }
    if ($i -ge $Body.Length -or $Body[$i] -ne ':') { continue }
    $i++
    while ($i -lt $Body.Length -and [char]::IsWhiteSpace($Body[$i])) { $i++ }
    if ($i -ge $Body.Length -or ($Body[$i] -ne "'" -and $Body[$i] -ne '"')) {
      while ($i -lt $Body.Length -and $Body[$i] -ne ',') { $i++ }
      continue
    }

    $quote = $Body[$i++]
    $value = New-Object System.Text.StringBuilder
    while ($i -lt $Body.Length -and $Body[$i] -ne $quote) {
      if ($Body[$i] -eq '\' -and ($i + 1) -lt $Body.Length) {
        $next = $Body[$i + 1]
        switch ($next) {
          'n' { [void]$value.Append("`n") }
          'r' { [void]$value.Append("`r") }
          't' { [void]$value.Append("`t") }
          default { [void]$value.Append($next) }
        }
        $i += 2
        continue
      }
      [void]$value.Append($Body[$i++])
    }
    $i++
    $entries[$key.ToString()] = $value.ToString()
  }
  return $entries
}

function Escape-TsString {
  param([string]$Value)
  return $Value -replace '\\', '\\' -replace '"', '\"' -replace "`r", '\r' -replace "`n", '\n'
}

function Protect-Placeholders {
  param([string]$Value)
  $tokens = @()
  $protected = [regex]::Replace($Value, '\{[^{}]+\}', {
    param($match)
    $token = "ZXOCPH$($tokens.Count)QX"
    $tokens += [pscustomobject]@{ Token = $token; Value = $match.Value }
    return $token
  })
  return [pscustomobject]@{ Value = $protected; Tokens = $tokens }
}

function Restore-Placeholders {
  param([string]$Value, [object[]]$Tokens)
  foreach ($token in $Tokens) { $Value = $Value.Replace($token.Token, $token.Value) }
  return $Value
}

function Translate-Batch {
  param([object[]]$Items)
  $prepared = @()
  foreach ($item in $Items) {
    $safe = Protect-Placeholders -Value $item.Value
    $prepared += [pscustomobject]@{ Key = $item.Key; Value = $safe.Value; Tokens = $safe.Tokens }
  }

  $body = @{
    q = $prepared.Value -join "`n$separator`n"
    source = 'en'
    target = 'ru'
    format = 'text'
  }
  if (-not [string]::IsNullOrWhiteSpace($ApiKey)) { $body.api_key = $ApiKey }
  $response = Invoke-RestMethod -UseBasicParsing -Method Post -Uri $TranslatorEndpoint -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 90
  $translated = $response.translatedText
  if ([string]::IsNullOrWhiteSpace($translated)) { throw 'Translation endpoint returned an empty response.' }
  $parts = $translated -split [regex]::Escape($separator)
  if ($parts.Count -ne $prepared.Count) { throw "Translation response split into $($parts.Count) parts; expected $($prepared.Count)." }

  $results = @()
  for ($i = 0; $i -lt $prepared.Count; $i++) {
    $results += [pscustomobject]@{
      Key = $prepared[$i].Key
      Value = Restore-Placeholders -Value $parts[$i].Trim() -Tokens $prepared[$i].Tokens
    }
  }
  return $results
}

function Translate-Entries {
  param([System.Collections.IDictionary]$Entries)
  $items = @($Entries.GetEnumerator() | ForEach-Object { [pscustomobject]@{ Key = $_.Key; Value = $_.Value } })
  $translated = [ordered]@{}
  $batch = @()
  $length = 0
  foreach ($item in $items) {
    if ($batch.Count -gt 0 -and ($batch.Count -ge 20 -or ($length + $item.Value.Length) -gt 3500)) {
      foreach ($result in (Translate-Batch -Items $batch)) { $translated[$result.Key] = $result.Value }
      $batch = @()
      $length = 0
      Start-Sleep -Milliseconds 250
    }
    $batch += $item
    $length += $item.Value.Length
  }
  if ($batch.Count -gt 0) {
    foreach ($result in (Translate-Batch -Items $batch)) { $translated[$result.Key] = $result.Value }
  }
  return $translated
}

function Append-Entries {
  param([string]$Path, [System.Collections.IDictionary]$Entries)
  if ($Entries.Count -eq 0) { return }
  $content = Read-Utf8File -Path $Path
  $end = $content.LastIndexOf('} as const')
  if ($end -lt 0) { throw "Cannot find object end in $Path." }
  $lines = foreach ($entry in $Entries.GetEnumerator()) {
    '  "' + (Escape-TsString -Value $entry.Key) + '": "' + (Escape-TsString -Value $entry.Value) + '",'
  }
  $content = $content.Substring(0, $end).TrimEnd() + "`r`n" + ($lines -join "`r`n") + "`r`n" + $content.Substring($end)
  Write-Utf8NoBom -Path $Path -Content $content
}

$ruMainPath = Join-Path $scriptDir 'i18n\messages\ru.ts'
$ruSettingsPath = Join-Path $scriptDir 'i18n\messages\ru.settings.ts'
$enMain = (Invoke-WebRequest -UseBasicParsing -Uri "$sourceBase/en.ts" -TimeoutSec 60).Content
$enSettings = (Invoke-WebRequest -UseBasicParsing -Uri "$sourceBase/en.settings.ts" -TimeoutSec 60).Content
$ruMain = Read-Utf8File -Path $ruMainPath
$ruSettings = Read-Utf8File -Path $ruSettingsPath

$englishMainEntries = Parse-Entries -Body (Parse-TsDictBody -Content $enMain -ExportName 'dict')
$englishSettingsEntries = Parse-Entries -Body (Parse-TsDictBody -Content $enSettings -ExportName 'settingsDict')
$russianEntries = Parse-Entries -Body (Parse-TsDictBody -Content $ruMain -ExportName 'dict')
$russianSettingsEntries = Parse-Entries -Body (Parse-TsDictBody -Content $ruSettings -ExportName 'settingsDict')
foreach ($entry in $russianSettingsEntries.GetEnumerator()) { $russianEntries[$entry.Key] = $entry.Value }

$missingSettings = [ordered]@{}
foreach ($entry in $englishSettingsEntries.GetEnumerator()) {
  if (-not $russianEntries.Contains($entry.Key)) { $missingSettings[$entry.Key] = $entry.Value }
}
$missingMain = [ordered]@{}
foreach ($entry in $englishMainEntries.GetEnumerator()) {
  if (-not $russianEntries.Contains($entry.Key)) { $missingMain[$entry.Key] = $entry.Value }
}

$missingCount = $missingSettings.Count + $missingMain.Count
Write-Host "OpenChamber ${tag}: $missingCount untranslated keys found." -ForegroundColor Cyan
if ($DryRun -or $missingCount -eq 0) { exit 0 }
if ([string]::IsNullOrWhiteSpace($TranslatorEndpoint)) {
  throw 'TranslatorEndpoint is required. Use a LibreTranslate-compatible POST /translate endpoint; pass -ApiKey when the service requires one.'
}

Write-Host "Translating $($missingSettings.Count) settings keys..." -ForegroundColor Cyan
$translatedSettings = Translate-Entries -Entries $missingSettings
Write-Host "Translating $($missingMain.Count) UI keys..." -ForegroundColor Cyan
$translatedMain = Translate-Entries -Entries $missingMain

Append-Entries -Path $ruSettingsPath -Entries $translatedSettings
Append-Entries -Path $ruMainPath -Entries $translatedMain
Write-Host "Added $missingCount machine-translated keys. Run update-translation.cmd to rebuild the Russian bundle." -ForegroundColor Green
