# Servidor local para testar o Aprova antes de publicar.
# Uso:  .\serve.ps1    → abre em http://localhost:5173
# Ctrl+C para parar.
param([string]$Root = $PSScriptRoot, [int]$Port = 5173)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "serving $Root on http://localhost:$Port/"
$types = @{ ".html"="text/html"; ".css"="text/css"; ".js"="text/javascript";
            ".json"="application/json"; ".svg"="image/svg+xml"; ".md"="text/plain" }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $path = Join-Path $Root $rel
    if (Test-Path $path -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $ct = $types[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = "$ct; charset=utf-8"
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
