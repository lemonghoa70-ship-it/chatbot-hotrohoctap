$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:5173/")
$listener.Start()
Write-Host "Server running at http://127.0.0.1:5173/"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $rawPath = $request.Url.LocalPath
        if ($rawPath -eq "/" -or $rawPath -eq "") { $rawPath = "/index.html" }
        $localPath = "d:\CHAT-BOT\hoi-bai-9" + $rawPath.Replace('/', '\')
        
        if (Test-Path -Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            if ($localPath.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($localPath.EndsWith(".js") -or $localPath.EndsWith(".mjs")) { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($localPath.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($localPath.EndsWith(".md")) { $response.ContentType = "text/markdown; charset=utf-8" }
            elseif ($localPath.EndsWith(".json")) { $response.ContentType = "application/json; charset=utf-8" }
            elseif ($localPath.EndsWith(".png")) { $response.ContentType = "image/png" }
            elseif ($localPath.EndsWith(".jpg") -or $localPath.EndsWith(".jpeg")) { $response.ContentType = "image/jpeg" }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
}
