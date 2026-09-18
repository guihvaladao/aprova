# Servidor local para testar o APROVA DOPAMINE antes de publicar.
# Uso:  .\serve.ps1          → procura uma porta livre a partir da 5173
#       .\serve.ps1 -Port 8080
# Ctrl+C para parar.
param([string]$Root = $PSScriptRoot, [int]$Port = 5173)

# O Windows às vezes deixa a porta reservada no http.sys mesmo depois que o
# processo morre. Em vez de falhar, tenta as próximas até achar uma livre.
$listener = $null
foreach ($try in $Port..($Port + 20)) {
  $candidate = New-Object System.Net.HttpListener
  $candidate.Prefixes.Add("http://localhost:$try/")
  try {
    $candidate.Start()
    $listener = $candidate
    $Port = $try
    break
  } catch {
    $candidate.Close()
  }
}
if (-not $listener) {
  Write-Host "Nenhuma porta livre entre $Port e $($Port + 20). Passe outra com -Port." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  APROVA DOPAMINE rodando em  http://localhost:$Port/" -ForegroundColor Green
Write-Host "  pasta: $Root"
Write-Host "  Ctrl+C para parar."
Write-Host ""

$types = @{ ".html"="text/html"; ".css"="text/css"; ".js"="text/javascript";
            ".json"="application/json"; ".svg"="image/svg+xml"; ".md"="text/plain";
            ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg";
            ".webp"="image/webp"; ".ico"="image/x-icon" }
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
      # charset só faz sentido em texto; em imagem atrapalha
      if ($ct -like 'text/*' -or $ct -like '*json*' -or $ct -like '*javascript*' -or $ct -like '*svg*') {
        $ctx.Response.ContentType = "$ct; charset=utf-8"
      } else {
        $ctx.Response.ContentType = $ct
      }
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
