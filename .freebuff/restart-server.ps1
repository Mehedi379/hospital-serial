$ErrorActionPreference = 'SilentlyContinue'
# Kill every node process running server.js
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
  if ($_.CommandLine -like '*server.js*') { Stop-Process -Id $_.ProcessId -Force }
}
Start-Sleep -Milliseconds 800
# Start node directly (npm.cmd wrapper can drag the child down on exit)
$env:PORT = '5000'
$p = Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory (Join-Path $PSScriptRoot '..\app') `
  -RedirectStandardOutput (Join-Path $PSScriptRoot 'preview-9747b0ce-ed05-4c21-821a-90cde057ecc7.log') `
  -RedirectStandardError (Join-Path $PSScriptRoot 'preview-9747b0ce-ed05-4c21-821a-90cde057ecc7.log.err') `
  -WindowStyle Hidden -PassThru
Write-Output ("started pid=" + $p.Id)
