$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Node.js орнатылмаған. nodejs.org сайтынан Node.js LTS орнатыңыз.' -ForegroundColor Red; exit 1 }
Set-Location $PSScriptRoot
node .\server.js
