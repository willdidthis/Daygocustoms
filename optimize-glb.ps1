# Shrinks a .glb so it uploads to GitHub through the website (25 MB per file) and downloads faster, without changing how it
# looks in the game:
#   - drops UV sets three.js never reads (TEXCOORD_2+, and TEXCOORD_1 unless a material uses it) and tangents
#   - drops vertex colours that are all white; packs the rest into bytes
#   - normals → bytes, UVs in 0…1 → 16-bit (KHR_mesh_quantization — the game expands them back to floats when it loads)
#   - 32-bit indices → 16-bit wherever they fit
#   - opaque PNG textures → JPEG (q 88), anything over 2048 px scaled down
# Usage: optimize-glb.ps1 <in.glb> <out.glb> [-NoQuantize]
param([string]$In, [string]$Out, [switch]$NoQuantize)
Add-Type -ReferencedAssemblies System.Web.Extensions, System.Drawing -TypeDefinition @'
using System; using System.IO; using System.Collections; using System.Collections.Generic; using System.Linq;
using System.Web.Script.Serialization; using System.Drawing; using System.Drawing.Imaging;
public static class GlbOpt {
  static Dictionary<string, object> J; static byte[] Bin;
  static ArrayList Arr(string k) { if (!J.ContainsKey(k)) J[k] = new ArrayList(); return (ArrayList)J[k]; }
  static Dictionary<string, object> D(object o) { return (Dictionary<string, object>)o; }
  static int I(object o) { return Convert.ToInt32(o); }
  static int NComp(string t) { switch (t) { case "SCALAR": return 1; case "VEC2": return 2; case "VEC3": return 3; case "VEC4": return 4; case "MAT2": return 4; case "MAT3": return 9; default: return 16; } }
  static int CSize(int ct) { return ct == 5120 || ct == 5121 ? 1 : ct == 5122 || ct == 5123 ? 2 : 4; }
  // an accessor's values as doubles (normalised integers mapped back to their float range)
  static double[] Read(int ai) {
    var a = D(Arr("accessors")[ai]); int n = I(a["count"]), nc = NComp((string)a["type"]), ct = I(a["componentType"]), cs = CSize(ct);
    bool norm = a.ContainsKey("normalized") && (bool)a["normalized"];
    var r = new double[n * nc]; if (!a.ContainsKey("bufferView")) return r;
    var bv = D(Arr("bufferViews")[I(a["bufferView"])]); int off = (bv.ContainsKey("byteOffset") ? I(bv["byteOffset"]) : 0) + (a.ContainsKey("byteOffset") ? I(a["byteOffset"]) : 0);
    int stride = bv.ContainsKey("byteStride") ? I(bv["byteStride"]) : nc * cs;
    for (int i = 0; i < n; i++) for (int c = 0; c < nc; c++) {
      int p = off + i * stride + c * cs; double v;
      switch (ct) {
        case 5126: v = BitConverter.ToSingle(Bin, p); break;
        case 5125: v = BitConverter.ToUInt32(Bin, p); break;
        case 5123: v = BitConverter.ToUInt16(Bin, p); if (norm) v /= 65535.0; break;
        case 5122: v = BitConverter.ToInt16(Bin, p); if (norm) v = Math.Max(v / 32767.0, -1); break;
        case 5121: v = Bin[p]; if (norm) v /= 255.0; break;
        default: v = (sbyte)Bin[p]; if (norm) v = Math.Max(v / 127.0, -1); break;
      }
      r[i * nc + c] = v;
    }
    return r;
  }
  static MemoryStream Out; static ArrayList NewViews;
  static int AddView(byte[] data, int stride, int target) {
    while (Out.Length % 4 != 0) Out.WriteByte(0);
    var bv = new Dictionary<string, object> { { "buffer", 0 }, { "byteOffset", (int)Out.Length }, { "byteLength", data.Length } };
    if (stride > 0) bv["byteStride"] = stride; if (target > 0) bv["target"] = target;
    Out.Write(data, 0, data.Length); NewViews.Add(bv); return NewViews.Count - 1;
  }
  // write values as componentType ct (vertex attributes padded to 4-byte strides); returns the new accessor fields
  static void Write(Dictionary<string, object> a, double[] v, int nc, int ct, bool norm, bool vertex, int target) {
    int cs = CSize(ct), elem = nc * cs, stride = vertex ? (elem + 3) / 4 * 4 : elem, n = v.Length / nc;
    var data = new byte[n * stride];
    for (int i = 0; i < n; i++) for (int c = 0; c < nc; c++) {
      double x = v[i * nc + c]; int p = i * stride + c * cs;
      switch (ct) {
        case 5126: Buffer.BlockCopy(BitConverter.GetBytes((float)x), 0, data, p, 4); break;
        case 5125: Buffer.BlockCopy(BitConverter.GetBytes((uint)x), 0, data, p, 4); break;
        case 5123: Buffer.BlockCopy(BitConverter.GetBytes((ushort)(norm ? Math.Round(Math.Max(0, Math.Min(1, x)) * 65535) : x)), 0, data, p, 2); break;
        case 5122: Buffer.BlockCopy(BitConverter.GetBytes((short)(norm ? Math.Round(Math.Max(-1, Math.Min(1, x)) * 32767) : x)), 0, data, p, 2); break;
        case 5121: data[p] = (byte)(norm ? Math.Round(Math.Max(0, Math.Min(1, x)) * 255) : x); break;
        default: data[p] = (byte)(sbyte)(norm ? Math.Round(Math.Max(-1, Math.Min(1, x)) * 127) : x); break;
      }
    }
    a["bufferView"] = AddView(data, vertex && stride != elem ? stride : 0, target); // (byte VEC3 → 4-byte strides)
    a.Remove("byteOffset"); a["componentType"] = ct; if (norm) a["normalized"] = true; else a.Remove("normalized");
  }
  static void TexCoords(object o, HashSet<int> used) {
    if (o is Dictionary<string, object>) { var d = D(o); if (d.ContainsKey("texCoord")) used.Add(I(d["texCoord"])); else if (d.ContainsKey("index")) used.Add(0); foreach (var v in d.Values) TexCoords(v, used); }
    else if (o is ArrayList) foreach (var v in (ArrayList)o) TexCoords(v, used);
  }
  public static string Run(string inPath, string outPath, bool quantize) {
    var b = File.ReadAllBytes(inPath); int jl = BitConverter.ToInt32(b, 12);
    var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 1000 };
    J = ser.Deserialize<Dictionary<string, object>>(System.Text.Encoding.UTF8.GetString(b, 20, jl));
    int bl = BitConverter.ToInt32(b, 20 + jl); Bin = new byte[bl]; Buffer.BlockCopy(b, 28 + jl, Bin, 0, bl);
    var log = new List<string>();
    var usedTC = new HashSet<int>(); if (J.ContainsKey("materials")) TexCoords(J["materials"], usedTC);
    int keepTC = usedTC.Contains(1) ? 1 : 0;
    Out = new MemoryStream(); NewViews = new ArrayList();
    var accs = Arr("accessors"); var done = new Dictionary<int, int>(); bool anyQ = false; long dropped = 0;
    var newAccs = new ArrayList(); Func<int, Dictionary<string, object>> clone = (ai) => new Dictionary<string, object>(D(accs[ai]));
    Func<int, int> copyAcc = (ai) => { if (done.ContainsKey(ai)) return done[ai]; var a = clone(ai); var v = Read(ai); var oa = D(accs[ai]);
      bool norm = oa.ContainsKey("normalized") && (bool)oa["normalized"]; if (oa.ContainsKey("bufferView")) Write(a, v, NComp((string)a["type"]), I(a["componentType"]), norm, false, 0); newAccs.Add(a); done[ai] = newAccs.Count - 1; return done[ai]; };
    foreach (Dictionary<string, object> mesh in Arr("meshes")) foreach (Dictionary<string, object> pr in (ArrayList)mesh["primitives"]) {
      var at = D(pr["attributes"]); var keys = at.Keys.ToList(); var na = new Dictionary<string, object>();
      foreach (var k in keys) {
        int ai = I(at[k]); var oa = D(accs[ai]); int n = I(oa["count"]);
        if (k == "TANGENT" || (k.StartsWith("TEXCOORD_") && int.Parse(k.Substring(9)) > keepTC)) { dropped += n * NComp((string)oa["type"]) * CSize(I(oa["componentType"])); continue; }
        string key = k + ":" + ai; if (done.ContainsKey(ai)) { na[k] = done[ai]; continue; }
        var v = Read(ai); var a = clone(ai); int nc = NComp((string)a["type"]);
        if (k == "COLOR_0") {
          bool white = v.All(x => x >= 0.98); if (white) { dropped += v.Length * 4; continue; }
          Write(a, v, nc, 5121, true, true, 34962);
        } else if (k == "NORMAL" && quantize && nc == 3) { Write(a, v, 3, 5120, true, true, 34962); anyQ = true; a.Remove("min"); a.Remove("max"); }
        else if (k.StartsWith("TEXCOORD_") && quantize && v.All(x => x >= 0 && x <= 1)) { Write(a, v, nc, 5123, true, true, 34962); anyQ = true; a.Remove("min"); a.Remove("max"); }
        else Write(a, v, nc, I(a["componentType"]), oa.ContainsKey("normalized") && (bool)oa["normalized"], true, 34962);
        newAccs.Add(a); done[ai] = newAccs.Count - 1; na[k] = done[ai];
      }
      pr["attributes"] = na;
      if (pr.ContainsKey("indices")) { int ai = I(pr["indices"]);
        if (done.ContainsKey(ai)) pr["indices"] = done[ai];
        else { var v = Read(ai); var a = clone(ai); int ct = v.Length > 0 && v.Max() < 65535 ? 5123 : 5125; Write(a, v, 1, ct, false, false, 34963); a.Remove("min"); a.Remove("max"); newAccs.Add(a); done[ai] = newAccs.Count - 1; pr["indices"] = done[ai]; } }
      if (pr.ContainsKey("targets")) foreach (Dictionary<string, object> t in (ArrayList)pr["targets"]) foreach (var k in t.Keys.ToList()) t[k] = copyAcc(I(t[k]));
    }
    // everything else that points at accessors (skins, animations)
    if (J.ContainsKey("skins")) foreach (Dictionary<string, object> s in Arr("skins")) if (s.ContainsKey("inverseBindMatrices")) s["inverseBindMatrices"] = copyAcc(I(s["inverseBindMatrices"]));
    if (J.ContainsKey("animations")) foreach (Dictionary<string, object> an in Arr("animations")) foreach (Dictionary<string, object> sm in (ArrayList)an["samplers"]) { sm["input"] = copyAcc(I(sm["input"])); sm["output"] = copyAcc(I(sm["output"])); }
    // images: opaque PNGs → JPEG, big ones scaled down
    long imgIn = 0, imgOut = 0;
    if (J.ContainsKey("images")) foreach (Dictionary<string, object> im in Arr("images")) {
      if (!im.ContainsKey("bufferView")) continue;
      var bv = D(Arr("bufferViews")[I(im["bufferView"])]); int off = bv.ContainsKey("byteOffset") ? I(bv["byteOffset"]) : 0, len = I(bv["byteLength"]);
      var data = new byte[len]; Buffer.BlockCopy(Bin, off, data, 0, len); imgIn += len;
      byte[] outData = data; string mime = im.ContainsKey("mimeType") ? (string)im["mimeType"] : "image/png";
      try {
        using (var ms = new MemoryStream(data)) using (var src = new Bitmap(ms)) {
          int w = src.Width, h = src.Height; double k = Math.Min(1.0, 2048.0 / Math.Max(w, h)); int nw = Math.Max(1, (int)Math.Round(w * k)), nh = Math.Max(1, (int)Math.Round(h * k));
          bool alpha = false;
          if (Image.IsAlphaPixelFormat(src.PixelFormat)) { var bd = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb); var row = new byte[w * 4];
            for (int y = 0; y < h && !alpha; y++) { System.Runtime.InteropServices.Marshal.Copy(bd.Scan0 + y * bd.Stride, row, 0, w * 4); for (int x = 0; x < w; x++) if (row[x * 4 + 3] < 250) { alpha = true; break; } } src.UnlockBits(bd); }
          if (len > 48 * 1024 && (!alpha || k < 1)) {
            using (var dst = new Bitmap(nw, nh, alpha ? PixelFormat.Format32bppArgb : PixelFormat.Format24bppRgb)) {
              using (var g = Graphics.FromImage(dst)) { g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy; g.DrawImage(src, 0, 0, nw, nh); }
              using (var o = new MemoryStream()) {
                if (alpha) { dst.Save(o, ImageFormat.Png); }
                else { var enc = ImageCodecInfo.GetImageEncoders().First(e => e.MimeType == "image/jpeg"); var ps = new EncoderParameters(1); ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 88L); dst.Save(o, enc, ps); }
                if (o.Length < len) { outData = o.ToArray(); mime = alpha ? "image/png" : "image/jpeg"; }
              }
            }
          }
        }
      } catch (Exception e) { log.Add("image kept: " + e.Message); }
      im["bufferView"] = AddView(outData, 0, 0); im["mimeType"] = mime; imgOut += outData.Length;
    }
    J["accessors"] = newAccs; J["bufferViews"] = NewViews;
    while (Out.Length % 4 != 0) Out.WriteByte(0);
    D(Arr("buffers")[0])["byteLength"] = (int)Out.Length; D(Arr("buffers")[0]).Remove("uri");
    if (anyQ) { var used = Arr("extensionsUsed"); if (!used.Contains("KHR_mesh_quantization")) used.Add("KHR_mesh_quantization"); var req = Arr("extensionsRequired"); if (!req.Contains("KHR_mesh_quantization")) req.Add("KHR_mesh_quantization"); }
    var js = System.Text.Encoding.UTF8.GetBytes(ser.Serialize(J)); int jpad = (4 - js.Length % 4) % 4;
    var bin = Out.ToArray();
    using (var f = new FileStream(outPath, FileMode.Create)) using (var w = new BinaryWriter(f)) {
      w.Write(0x46546C67u); w.Write(2u); w.Write((uint)(12 + 8 + js.Length + jpad + 8 + bin.Length));
      w.Write((uint)(js.Length + jpad)); w.Write(0x4E4F534Au); w.Write(js); for (int i = 0; i < jpad; i++) w.Write((byte)0x20);
      w.Write((uint)bin.Length); w.Write(0x004E4942u); w.Write(bin);
    }
    log.Insert(0, string.Format("{0:N1} MB -> {1:N1} MB  (dropped {2:N1} MB of unused data; images {3:N1} -> {4:N1} MB; kept TEXCOORD_0{5})", b.Length / 1048576.0, new FileInfo(outPath).Length / 1048576.0, dropped / 1048576.0, imgIn / 1048576.0, imgOut / 1048576.0, keepTC == 1 ? "+1" : ""));
    return string.Join("\n", log);
  }
}
'@
[GlbOpt]::Run((Resolve-Path $In).Path, [System.IO.Path]::GetFullPath($Out), -not $NoQuantize)
