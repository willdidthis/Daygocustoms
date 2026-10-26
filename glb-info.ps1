# Prints what's inside a .glb: node / mesh / material names, triangle counts and the embedded images' sizes.
# Usage: glb-info.ps1 <file.glb>
param([string]$Path)
$b = [System.IO.File]::ReadAllBytes($Path)
$jsonLen = [BitConverter]::ToUInt32($b, 12)
$json = [System.Text.Encoding]::UTF8.GetString($b, 20, $jsonLen) | ConvertFrom-Json
"{0}  ({1:N1} MB)  generator: {2}" -f (Split-Path $Path -Leaf), ($b.Length / 1MB), $json.asset.generator
"nodes {0} · meshes {1} · materials {2} · images {3} · textures {4}" -f @($json.nodes).Count, @($json.meshes).Count, @($json.materials).Count, @($json.images).Count, @($json.textures).Count
$imgBytes = 0
$i = 0
foreach ($im in @($json.images)) {
  if ($null -eq $im) { continue }
  $bv = $json.bufferViews[$im.bufferView]
  $imgBytes += $bv.byteLength
  "  image {0}: {1} {2:N0} KB {3}" -f $i, $im.mimeType, ($bv.byteLength / 1KB), $im.name
  $i++
}
"images total {0:N1} MB" -f ($imgBytes / 1MB)
$tris = 0
foreach ($m in @($json.meshes)) {
  foreach ($p in $m.primitives) {
    if ($null -ne $p.indices) { $tris += $json.accessors[$p.indices].count / 3 } else { $tris += $json.accessors[$p.attributes.POSITION].count / 3 }
  }
}
"triangles {0:N0}" -f $tris
"materials: " + ((@($json.materials) | ForEach-Object { $_.name }) -join ' | ')
"nodes: " + ((@($json.nodes) | Where-Object { $_.name } | Select-Object -First 400 | ForEach-Object { $_.name }) -join ' | ')
