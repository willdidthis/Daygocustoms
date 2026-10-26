# Copies the baked tree pictures into the website folder at 640 px tall (from 1024): they're the far forest's photo cards, so
# the smaller ones look the same in the game and download about 2.3x faster. The full-size originals stay in trees\.
# Usage: shrink-trees.ps1 <source folder> <destination folder>
param([string]$Src = 'trees', [string]$Dst = 'website\trees', [int]$Height = 640)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $Dst | Out-Null
Get-ChildItem (Join-Path $Src '*.png') | ForEach-Object {
  $out = Join-Path $Dst $_.Name
  $im = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    if ($im.Height -le $Height) { Copy-Item $_.FullName $out -Force; return }
    $w = [int][Math]::Round($im.Width * $Height / $im.Height)
    $bmp = New-Object System.Drawing.Bitmap($w, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingMode = 'SourceCopy'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.SmoothingMode = 'HighQuality'
    $g.DrawImage($im, 0, 0, $w, $Height); $g.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  } finally { $im.Dispose() }
}
