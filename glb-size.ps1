# Where a .glb's bytes go: per attribute kind (POSITION / NORMAL / TEXCOORD / indices …) and images.
# Usage: glb-size.ps1 <file.glb>
param([string]$Path)
$b = [System.IO.File]::ReadAllBytes($Path)
$jsonLen = [BitConverter]::ToUInt32($b, 12)
$j = [System.Text.Encoding]::UTF8.GetString($b, 20, $jsonLen) | ConvertFrom-Json
$size = @{}
$add = { param($k, $n) if ($size.ContainsKey($k)) { $size[$k] += $n } else { $size[$k] = $n } }
$seen = @{}
$compSize = @{ 5120 = 1; 5121 = 1; 5122 = 2; 5123 = 2; 5125 = 4; 5126 = 4 }
$nComp = @{ SCALAR = 1; VEC2 = 2; VEC3 = 3; VEC4 = 4; MAT4 = 16 }
$verts = 0
foreach ($m in @($j.meshes)) { foreach ($p in $m.primitives) {
  foreach ($a in $p.attributes.PSObject.Properties) {
    $ai = $a.Value; if ($seen.ContainsKey("a$ai")) { continue }; $seen["a$ai"] = 1
    $acc = $j.accessors[$ai]; & $add $a.Name ($acc.count * $compSize[[int]$acc.componentType] * $nComp[$acc.type])
    if ($a.Name -eq 'POSITION') { $verts += $acc.count }
  }
  if ($null -ne $p.indices -and -not $seen.ContainsKey("i$($p.indices)")) { $seen["i$($p.indices)"] = 1; $acc = $j.accessors[$p.indices]; & $add ("indices" + $compSize[[int]$acc.componentType] * 8) ($acc.count * $compSize[[int]$acc.componentType]) }
  if ($p.targets) { & $add 'morphTargets' 1 }
} }
foreach ($im in @($j.images)) { if ($null -ne $im.bufferView) { & $add 'images' $j.bufferViews[$im.bufferView].byteLength } }
if ($j.animations) { & $add 'animations' @($j.animations).Count }
if ($j.skins) { & $add 'skins' @($j.skins).Count }
"{0}: {1:N1} MB, {2:N0} vertices, extensionsUsed: {3}" -f (Split-Path $Path -Leaf), ($b.Length / 1MB), $verts, ($j.extensionsUsed -join ',')
$size.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "  {0,-16} {1,10:N2} MB" -f $_.Key, ($_.Value / 1MB) }
