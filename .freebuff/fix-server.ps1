$ErrorActionPreference = 'SilentlyContinue'

# Kill every node process whose command line runs server.js
$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
foreach ($p in $procs) {
  if ($p.CommandLine -like '*server.js*') {
    Stop-Process -Id $p.ProcessId -Force
    Write-Output ("killed node pid=" + $p.ProcessId)
  }
}
Start-Sleep -Seconds 1

# Run node DIRECTLY (npm.cmd wrapper exits and can drag the child down).
# PORT=5000 is forced because this machine has PORT=0 set globally.
$env:PORT = '5000'
$proc = Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory 'app' `
  -RedirectStandardOutput '.freebuff/preview-9747b0ce-ed05-4c21-821a-90cde057ecc7.log' `
  -RedirectStandardError '.freebuff/preview-9747b0ce-ed05-4c21-821a-90cde057ecc7.log.err' `
  -WindowStyle Hidden -PassThru
Write-Output ("started node pid=" + $proc.Id)
