# Dev helper: receives PNG snapshots the game page renders itself (POST a data: URL to http://localhost:8766/snap?name=x)
# and saves them to the given folder — for looking at renders while the browser window isn't on screen. Local only.
# Usage: snap-server.ps1 <folder>
param([string]$Dir)
New-Item -ItemType Directory -Force $Dir | Out-Null
$l = New-Object System.Net.HttpListener; $l.Prefixes.Add('http://localhost:8766/'); $l.Start()
"listening on 8766 -> $Dir"
while ($l.IsListening) {
  $c = $l.GetContext(); $q = $c.Request; $r = $c.Response
  $r.Headers.Add('Access-Control-Allow-Origin', '*'); $r.Headers.Add('Access-Control-Allow-Headers', '*')
  if ($q.HttpMethod -eq 'POST') {
    $name = ($q.QueryString['name'] -replace '[^\w\-]', '_'); if (-not $name) { $name = 'snap' }
    $body = (New-Object System.IO.StreamReader($q.InputStream)).ReadToEnd()
    $b64 = $body -replace '^data:image/\w+;base64,', ''
    [System.IO.File]::WriteAllBytes((Join-Path $Dir "$name.png"), [Convert]::FromBase64String($b64))
  }
  $r.StatusCode = 200; $r.Close()
  if ($q.QueryString['quit']) { break }
}
$l.Stop()
