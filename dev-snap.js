// Dev-only inspection helpers for the game page (not part of the website). Load from the console:
//   const s = document.createElement('script'); s.src = 'tools/dev-snap.js'; document.head.appendChild(s);
// __snap(name, camPos, camTarget): renders one frame offscreen and posts it to tools/snap-server.ps1 (port 8766) — works
// even while the window is hidden. __views(prefix, ['f34','side',…]) a set of standard angles. __pick(x, y) what's under a
// pixel of the last snapshot camera. __wait(fn) polls until fn() is truthy.
window.__wait = (fn, ms = 40000) => new Promise((r) => { const t0 = Date.now(); const iv = setInterval(() => { let ok = false; try { ok = fn(); } catch (e) { /* not yet */ } if (ok || Date.now() - t0 > ms) { clearInterval(iv); r(ok); } }, 250); });
window.__snap = async (name, pos, tgt, opts = {}) => {
  const d = apexStage._debug(), R = d.renderer, cam = d.camera;
  if (pos) { cam.position.set(...pos); cam.lookAt(...tgt); cam.updateMatrixWorld(); }
  const W = opts.w || 900, H = opts.h || 560, s0 = R.getSize(new d.THREE.Vector2()), pr = R.getPixelRatio(), asp = cam.aspect, vo = cam.view && { ...cam.view };
  R.setPixelRatio(1); R.setSize(W, H, false); cam.aspect = W / H; cam.clearViewOffset(); cam.updateProjectionMatrix();
  d.scene.updateMatrixWorld(true); R.render(d.scene, cam);
  const url = R.domElement.toDataURL('image/png');
  R.setPixelRatio(pr); R.setSize(s0.x, s0.y, false); cam.aspect = asp; if (vo && vo.enabled) cam.setViewOffset(vo.fullWidth, vo.fullHeight, vo.offsetX, vo.offsetY, vo.width, vo.height); cam.updateProjectionMatrix();
  await fetch('http://localhost:8766/snap?name=' + name, { method: 'POST', body: url });
  window.__lastCam = { pos, tgt, W, H }; return url.length;
};
window.__V = () => { const d = apexStage._debug(), P = d.P, mid = (P.front + P.rear) / 2; return {
  f34: [[P.front + 4.2, 2.2, 5.6], [mid + 0.6, 0.9, 0]], side: [[mid, 1.2, 8.5], [mid, 0.9, 0]], r34: [[P.rear - 4.0, 2.3, -5.4], [mid - 0.5, 0.9, 0]],
  front: [[P.front + 6, 1.3, 0], [P.front, 1.0, 0]], rear: [[P.rear - 6, 1.6, 0], [P.rear, 1.0, 0]], top: [[mid, 9, 0.01], [mid, 0, 0]],
  under: [[mid + 0.5, -2.2, 3.5], [mid, 0.6, 0]], dside: [[mid, 1.2, -8.5], [mid, 0.9, 0]], wheel: [[P.xF + 1.6, 0.8, 3.2], [P.xF, 0.6, 0.8]],
  f34l: [[P.front + 3.2, 2.0, -4.6], [mid + 0.6, 0.9, 0]], bed: [[P.rear - 1.5, P.roofTop + 1.6, 2.2], [P.rear + 1.2, 0.8, 0]],
  cab: [[P.cowlX - 0.9, P.roofTop + 0.35, 2.6], [P.cowlX - 1.3, 1.05, -0.1]], engine: [[P.front + 1.5, P.hoodY + 1.8, 1.5], [P.front - 0.8, P.hoodY - 0.2, 0]],
}; };
window.__views = async (prefix, list) => { const V = __V(); for (const k of list) await __snap(prefix + '-' + k, ...V[k]); return list.length; };
window.__pick = (px, py) => {
  const d = apexStage._debug(), L = window.__lastCam || { W: 900, H: 560 }, cam = d.camera.clone();
  if (L.pos) { cam.position.set(...L.pos); cam.lookAt(...L.tgt); }
  cam.aspect = L.W / L.H; cam.clearViewOffset(); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const rc = new d.THREE.Raycaster(); rc.setFromCamera(new d.THREE.Vector2((px / L.W) * 2 - 1, -((py / L.H) * 2 - 1)), cam);
  return rc.intersectObject(d.scene, true).filter((h) => h.object.isMesh && (() => { for (let p = h.object; p; p = p.parent) if (!p.visible) return false; return true; })()).slice(0, 3).map((h) => {
    const o = h.object, m = Array.isArray(o.material) ? o.material[h.face.materialIndex] : o.material, lin = [];
    for (let p = o; p && lin.length < 3; p = p.parent) lin.push((p.name || '·').slice(0, 36));
    return { d: +h.distance.toFixed(2), zone: o.userData.zone, part: o.userData.part, mat: m && m.name, col: m && m.color && m.color.getHexString(), map: !!(m && m.map), lin: lin.join(' < ') };
  });
};
// like __pick, with the mesh name, its texture coordinates and the world point
window.__pick2 = (px, py) => {
  const d = apexStage._debug(), L = window.__lastCam || { W: 900, H: 560 }, cam = d.camera.clone();
  if (L.pos) { cam.position.set(...L.pos); cam.lookAt(...L.tgt); }
  cam.aspect = L.W / L.H; cam.clearViewOffset(); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const rc = new d.THREE.Raycaster(); rc.setFromCamera(new d.THREE.Vector2((px / L.W) * 2 - 1, -((py / L.H) * 2 - 1)), cam);
  return rc.intersectObject(d.scene, true).filter((h) => h.object.isMesh && (() => { for (let p = h.object; p; p = p.parent) if (!p.visible) return false; return true; })()).slice(0, 3).map((h) => {
    const o = h.object, m = Array.isArray(o.material) ? o.material[h.face.materialIndex] : o.material;
    return { d: +h.distance.toFixed(2), name: (o.name || '').replace('LOD_A_', '').slice(0, 40), zone: o.userData.zone, mat: ((o.userData.baseMat || m) || {}).name, uv: h.uv ? [+h.uv.x.toFixed(3), +h.uv.y.toFixed(3)] : null, p: h.point.toArray().map((v) => +v.toFixed(3)) };
  });
};
// every paintable / lamp zone in its own flat colour (unzoned body grey), as a contact sheet — returns the legend
window.__zoneSheet = async (name, views) => {
  const d = apexStage._debug(), T = d.THREE, Z = d.model.zones, saved = [], legend = [];
  const pal = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000']; let i = 0;
  Object.entries(Z).forEach(([id, list]) => { const c = pal[i++ % pal.length]; legend.push(`${id}=${c}(${list.length})`); list.forEach((m) => { saved.push([m, m.material]); m.material = new T.MeshBasicMaterial({ color: c }); }); });
  d.model.parts.meshes.forEach((m) => { if (!m.userData.zone && m.visible) { saved.push([m, m.material]); m.material = new T.MeshLambertMaterial({ color: 0x777777 }); } });
  await __sheet(name, views); saved.forEach(([m, mt]) => { m.material = mt; });
  return legend.join(' ');
};
// full-throttle acceleration run on the current map, physics stepped by hand (works with the page hidden): 0-60, 0-100,
// quarter mile, speed after `secs`. patch: build changes for the run (restored after)
window.__accel = (patch = {}, secs = 16) => {
  const d = apexStage._debug(), b0 = d.build;
  apexStage.applyBuild({ ...b0, ...patch }, {}, true);
  if (apexStage.isDriving()) apexStage.stopDrive(); apexStage.startDrive(); // (a clean start every run)
  const dr = d.drive; apexStage.setIgnition(true);
  const st = dr.area && dr.area.start; if (st) { dr.x = st.x; dr.z = st.z; dr.yaw = st.yaw || 0; dr.y = dr.area.H(dr.x, dr.z); } if (window.__accelYaw !== undefined) dr.yaw = window.__accelYaw;
  Object.assign(dr, { u: 0, vz: 0, r: 0, steer: 0, gear: 0, rpm: 800, vy: 0, air: false, ws: null, hsPrev: null });
  apexStage.driveKey('w', true);
  let t = 0, t60 = null, t100 = null, q = null, dist = 0, v = 0; const dt = 1 / 60;
  while (t < secs) { d.step(dt); t += dt; v = Math.hypot(dr.u, dr.vz); dist += v * dt; if (!t60 && v >= 26.82) t60 = +t.toFixed(2); if (!t100 && v >= 44.7) t100 = +t.toFixed(2); if (!q && dist >= 402.3) q = `${t.toFixed(2)}s @ ${(v * 2.237).toFixed(0)} mph`; }
  apexStage.driveKey('w', false);
  apexStage.applyBuild(b0, {}, true);
  return { t60, t100, quarter: q, [`mph@${secs}s`]: +(v * 2.237).toFixed(0), dist: Math.round(dist) };
};
// load a lineup vehicle (make, model, gen) and wait for its model
window.__load = async (make, model, gen) => { apexApp.loadVehicle(apexApp.lineupVehicle(make, model, gen)); const url = (STOCK_MODELS_URL[`${make}|${model}|${gen}`] || ''); await __wait(() => { const m = apexStage._debug().model; return m && (!url || url.endsWith(m.name)); }); await new Promise((r) => setTimeout(r, 400)); return apexStage._debug().model.name; };
window.STOCK_MODELS_URL = { 'Doyoda|Dundra|1st Gen': 'car.glb', 'Dord|D-D50|12th Gen': 'dord-d50-12.glb', 'Dord|D-D50|13th Gen': 'dord-d50-13.glb', 'Dord|D-D50|13th Gen Daptor': 'dord-d50-13-daptor.glb', 'Dord|D-D50|14th Gen': 'dord-d50-14.glb', 'Dexus|ISD|2nd Gen': 'dexus-isd.glb' };
// several views into one 2-column contact sheet (each W×H) → one JPEG on the snapshot server
window.__sheet = async (name, list, W = 640, H = 400) => {
  const d = apexStage._debug(), R = d.renderer, cam = d.camera, V = __V(), cv = document.createElement('canvas'), x = cv.getContext('2d');
  cv.width = W * 2; cv.height = H * Math.ceil(list.length / 2);
  const s0 = R.getSize(new d.THREE.Vector2()), pr = R.getPixelRatio(), asp = cam.aspect, vo = cam.view && { ...cam.view }, p0 = cam.position.clone(), q0 = cam.quaternion.clone();
  R.setPixelRatio(1); R.setSize(W, H, false); cam.aspect = W / H; cam.clearViewOffset(); cam.updateProjectionMatrix();
  list.forEach((v, i) => { const [pos, tgt] = typeof v === 'string' ? V[v] : v; cam.position.set(...pos); cam.lookAt(...tgt); cam.updateMatrixWorld(); d.scene.updateMatrixWorld(true); R.render(d.scene, cam); x.drawImage(R.domElement, (i % 2) * W, Math.floor(i / 2) * H, W, H); });
  R.setPixelRatio(pr); R.setSize(s0.x, s0.y, false); cam.aspect = asp; if (vo && vo.enabled) cam.setViewOffset(vo.fullWidth, vo.fullHeight, vo.offsetX, vo.offsetY, vo.width, vo.height); cam.position.copy(p0); cam.quaternion.copy(q0); cam.updateProjectionMatrix();
  await fetch('http://localhost:8766/snap?name=' + name, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) }); return list.length;
};
// one sheet across several builds: items = [[patch, view, label?], …] — each patch is applied (on top of the current build) before its view
window.__multi = async (name, items, W = 480, H = 320, wait = 900) => {
  const d = apexStage._debug(), R = d.renderer, cam = d.camera, V = __V(), cv = document.createElement('canvas'), x = cv.getContext('2d');
  cv.width = W * 2; cv.height = H * Math.ceil(items.length / 2);
  for (let i = 0; i < items.length; i++) {
    const [patch, v, label] = items[i]; if (patch) { apexApp.applyPatch(patch); await new Promise((r) => setTimeout(r, wait)); }
    if (window.gsap) gsap.globalTimeline.getChildren().forEach((t) => t.progress(1));
    const s0 = R.getSize(new d.THREE.Vector2()), pr = R.getPixelRatio(), asp = cam.aspect, vo = cam.view && { ...cam.view }, p0 = cam.position.clone(), q0 = cam.quaternion.clone();
    R.setPixelRatio(1); R.setSize(W, H, false); cam.aspect = W / H; cam.clearViewOffset(); cam.updateProjectionMatrix();
    const [pos, tgt] = typeof v === 'string' ? V[v] : v; cam.position.set(...pos); cam.lookAt(...tgt); cam.updateMatrixWorld(); d.scene.updateMatrixWorld(true); R.render(d.scene, cam);
    x.drawImage(R.domElement, (i % 2) * W, Math.floor(i / 2) * H, W, H);
    if (label) { x.font = 'bold 15px Arial'; x.fillStyle = '#000a'; x.fillRect((i % 2) * W, Math.floor(i / 2) * H, x.measureText(label).width + 12, 22); x.fillStyle = '#fff'; x.fillText(label, (i % 2) * W + 6, Math.floor(i / 2) * H + 16); }
    R.setPixelRatio(pr); R.setSize(s0.x, s0.y, false); cam.aspect = asp; if (vo && vo.enabled) cam.setViewOffset(vo.fullWidth, vo.fullHeight, vo.offsetX, vo.offsetY, vo.width, vo.height); cam.position.copy(p0); cam.quaternion.copy(q0); cam.updateProjectionMatrix();
  }
  await fetch('http://localhost:8766/snap?name=' + name, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) }); return items.length;
};
// apply a build patch on top of the stock build and settle it instantly (tweens don't run while the page is hidden)
window.__build = async (patch, base) => {
  apexApp.setApplied({ ...(base || DEFAULT_BUILD), tod: null, ...patch }); await new Promise((r) => setTimeout(r, 1500));
  apexStage.applyBuild(apexStage._debug().build, {}, true); // (getBuild() is the multiplayer copy: no badges / decal)
  const d = apexStage._debug(); if (d.winAt) d.winAt();
  await new Promise((r) => setTimeout(r, 300)); return Object.keys(patch).length;
};
// drive-sim test bench (page hidden so only these steps run): teleport onto a stretch of ground, hold a speed, step the physics
// and measure what reaches the body. o: { x, z, yaw, speed, secs, steer (-1…1), steerAt (s) }
window.__run = (o) => {
  const d = apexStage._debug(), dr = d.drive, P = d.P, b = d.build, dt = 1 / 60, tv = travelOf(b), INCH_ = 0.0254;
  const bpF = tv.front * bumpShare(tv.front) * INCH_, bpR = tv.rear * bumpShare(tv.rear) * INCH_;
  Object.assign(dr, { x: o.x, z: o.z, yaw: o.yaw || 0, u: o.speed, vz: 0, r: 0, y: -100, vy: 0, pitch: 0, roll: 0, pitchV: 0, rollV: 0, ws: null, air: false, flipped: false, airT: 0, maxAir: 0, steer: 0, chop: 0, lurchT: 0, gear: o.gear ?? 3, manual: false, shiftT: 0, ign: true });
  const N = Math.round((o.secs || 8) / dt); let a2 = 0, n = 0, pMax = 0, rMax = 0, air = 0, bott = 0, wasB = false, vs = 0, flipT = -1, uMin = [9, 9, 9, 9], uMax = [-9, -9, -9, -9], vyPrev = 0, pv2 = 0, rv2 = 0, bodyHits = 0;
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    apexStage.driveKey('w', dr.u < o.speed - 0.3); apexStage.driveKey('s', false);
    let st = o.steer && t >= (o.steerAt || 0) && t < (o.steerAt || 0) + (o.steerFor || 99) ? o.steer : 0;
    if (!o.steer && o.keep !== false) { // lane keeping: head back toward the lane's centre line (+yaw turns toward −z)
      const want = Math.max(-0.25, Math.min(0.25, -0.12 * (o.z - dr.z))), e = want - dr.yaw - dr.steer * 0.6;
      st = e > 0.03 ? 1 : e < -0.03 ? -1 : 0;
    }
    apexStage.driveKey('a', st > 0); apexStage.driveKey('d', st < 0);
    d.step(dt);
    if (o.trace && i % (o.trace) === 0) (window.__trace = window.__trace || []).push([+t.toFixed(2), +dr.x.toFixed(1), +(dr.z - o.z).toFixed(2), +(dr.u * 3.6).toFixed(0), +(dr.yaw * 57.3).toFixed(0), +(dr.roll * 57.3).toFixed(0), +(dr.pitch * 57.3).toFixed(0), dr.air ? 'A' : '', dr.flipped ? 'F' : '']);
    if (dr.flipped) { if (flipT < 0) flipT = t; continue; }
    if (i > 30) { const a = (dr.vy - vyPrev) / dt; a2 += a * a; pv2 += dr.pitchV * dr.pitchV; rv2 += dr.rollV * dr.rollV; n++; }
    vyPrev = dr.vy; pMax = Math.max(pMax, Math.abs(dr.pitch)); rMax = Math.max(rMax, Math.abs(dr.roll)); if (dr.air) air++; vs += dr.u;
    let isB = false; (dr.ws || []).forEach((w, k) => { const front = d.P.spots[k].x > (d.P.xF + d.P.xR) / 2; if (w.u > (front ? bpF : bpR)) isB = true; uMin[k] = Math.min(uMin[k], w.u); uMax[k] = Math.max(uMax[k], w.u); });
    if (isB && !wasB) bott++; wasB = isB;
  }
  ['w', 'a', 'd', 's'].forEach((k) => apexStage.driveKey(k, false));
  const r = (v, k = 1) => +v.toFixed(k);
  return { aRms: r(Math.sqrt(a2 / Math.max(1, n))), pitchMax: r(pMax * 57.3), rollMax: r(rMax * 57.3), pvRms: r(Math.sqrt(pv2 / Math.max(1, n)), 2), rvRms: r(Math.sqrt(rv2 / Math.max(1, n)), 2), airPct: r((100 * air) / N), bottoms: bott,
    travelIn: uMax.map((m, k) => r((m - uMin[k]) / INCH_)), vAvg: r((vs / N) * 3.6), flipAt: flipT < 0 ? null : r(flipT), endZ: r(dr.z - o.z, 2), travelF: r(tv.front), travelR: r(tv.rear) };
};
// jump bench: swaps the ground for a pre-runner tabletop (h m tall, lip°, top m, 18° landing), runs at the posted speed and
// reports the pitch leaving the lip, its rate, the lowest nose-down angle in the air and the pitch at touchdown
window.__jump = (o = {}) => {
  const d = apexStage._debug(), dr = d.drive, dt = 1 / 60, G = AIR_G, DR = Math.PI / 180;
  const h = o.h || 4, lip = o.lip || 22, top = o.top || 40, Lu = (2 * h) / Math.tan(lip * DR), Ll = (2 * h) / Math.tan(18 * DR);
  const prof = (t) => (t < 0 ? 0 : t < Lu ? h * (t / Lu) ** 2 : t < Lu + top ? h : t < Lu + top + Ll ? h * (1 - (t - Lu - top) / Ll) ** 2 : 0);
  const X = h + (top + 0.3 * Ll) * Math.sin(lip * DR) - h * 0.49, U = o.u || (top + 0.3 * Ll) * Math.sqrt((0.5 * G) / Math.max(0.5, X));
  const H0 = dr.area.H; dr.area.H = (x) => prof(x);
  Object.assign(dr, { x: -45, z: 0, yaw: 0, u: U, vz: 0, r: 0, y: -100, vy: 0, pitch: 0, roll: 0, pitchV: 0, rollV: 0, ws: null, air: false, flipped: false, airT: 0, maxAir: 0, steer: 0, chop: 0, lurchT: 0, gear: 3, manual: false, shiftT: 0, ign: true });
  let tk = null, pMin = 0; const out = { U: +(U * 2.237).toFixed(0) };
  for (let i = 0; i < 60 * 9; i++) { const t = i * dt; apexStage.driveKey('w', dr.x < Lu ? dr.u < U : !!o.gas); d.step(dt);
    if (dr.air && !tk) { tk = t; Object.assign(out, { tkPitch: +(dr.pitch * 57.3).toFixed(1), tkPv: +(dr.pitchV * 57.3).toFixed(0), tkU: +(dr.u * 2.237).toFixed(0) }); }
    if (tk && dr.air) pMin = Math.min(pMin, dr.pitch);
    if (tk && !dr.air && t > tk + 0.2) { Object.assign(out, { air: +(t - tk).toFixed(2), landPitch: +(dr.pitch * 57.3).toFixed(1), landU: +(dr.u * 2.237).toFixed(0) }); break; } }
  apexStage.driveKey('w', false); dr.area.H = H0; out.pMinAir = +(pMin * 57.3).toFixed(1); return out;
};
window.SB = { stock: {}, bilstein: { shock: 'bilstein-5100', lift: 3 }, mid: { shock: 'king-25', uca: 'tc-uca', lift: 3, bumpStop: 'fox20' }, lt: { lift: 6, shock: 'king-30', uca: 'camburg-uca', lca: 'lt4', bypassF: 'b35-5', bypassR: 'b35-5', rearLink: 'trailing', bumpStop: 'king25' } };
window.WT = [{ label: 'med40', x: 80, z: 0, speed: 11.1, secs: 12 }, { label: 'med60', x: 80, z: 0, speed: 16.7, secs: 9 }, { label: 'med80', x: 80, z: 0, speed: 22.2, secs: 7 }, { label: 'big40', x: 80, z: -14, speed: 11.1, secs: 12 }, { label: 'big60', x: 80, z: -14, speed: 16.7, secs: 9 }, { label: 'rand60', x: -70, z: -46, speed: 16.7, secs: 14 }];
window.TT = [{ label: 'turn70', x: -100, z: -110, speed: 19.4, secs: 4, steer: 1, steerAt: 0.5, keep: false }, { label: 'slal70', x: -100, z: -110, speed: 19.4, secs: 4, steer: 1, steerAt: 0.5, steerFor: 0.7, keep: false }];
window.__matrix = async (tests, builds = SB) => { const out = []; for (const [name, patch] of Object.entries(builds)) { await __setBuild(patch); for (const t of tests) out.push([name, t.label, __run(t)]); } return out; };
window.__fmt = (res) => res.map(([n, l, r]) => `${n.padEnd(8)} ${l.padEnd(7)} a=${String(r.aRms).padEnd(5)} p=${String(r.pitchMax).padEnd(5)} r=${String(r.rollMax).padEnd(5)} pv=${r.pvRms} air=${r.airPct}% bot=${r.bottoms} v=${r.vAvg} flip=${r.flipAt} trav=${r.travelIn.join('/')} dz=${r.endZ}`).join('\n');
// whoops map + a truck in drive mode, ready for __run / __matrix
window.__bench = async (make = 'Doyoda', model = 'Dundra', gen = '1st Gen') => { await apexStage.setEnvironment('kloppenheim_06_puresky', '2k'); await __load(make, model, gen); await __setBuild({}); apexApp.startDrive(); await new Promise((r) => setTimeout(r, 2500)); return apexStage.isDriving(); };
// performance on the flat lot: 0–60 mph, quarter-mile-ish top speed after 20 s, 60–0 braking distance, and the steady lateral
// g on a full-lock circle at ~50 mph
window.__perf = () => {
  const d = apexStage._debug(), dr = d.drive, dt = 1 / 60, out = {};
  const reset = (u = 0, x = -95, z = -100, yaw = 0) => Object.assign(dr, { x, z, yaw, u, vz: 0, r: 0, y: -100, vy: 0, pitch: 0, roll: 0, pitchV: 0, rollV: 0, ws: null, air: false, flipped: false, steer: 0, chop: 0, lurchT: 0, gear: u > 20 ? 4 : 0, manual: false, shiftT: 0, spinX: 0 });
  reset(); let t = 0; apexStage.driveKey('w', true);
  for (let i = 0; i < 720; i++) { d.step(dt); t += dt; if (!out.zeroTo60 && Math.hypot(dr.u, dr.vz) * 2.237 >= 60) out.zeroTo60 = +t.toFixed(2); if (!out.zeroTo100 && dr.u * 2.237 >= 100) out.zeroTo100 = +t.toFixed(2); }
  out.mph12s = +(dr.u * 2.237).toFixed(0); apexStage.driveKey('w', false);
  reset(26.8); apexStage.driveKey('s', true); let x0 = dr.x, i = 0;
  for (; i < 600 && dr.u > 0.3; i++) d.step(dt); out.brake60 = +((dr.x - x0) * 3.281).toFixed(0) + ' ft'; out.brakeT = +(i / 60).toFixed(2); apexStage.driveKey('s', false);
  // full lock from 50 mph: the peak sideways g the tires reach (and the body roll / whether it tips)
  reset(22.4, 330, 150); let pk = 0, rMax = 0; for (let j = 0; j < 150; j++) { apexStage.driveKey('w', dr.u < 22.4); apexStage.driveKey('a', true); d.step(dt); pk = Math.max(pk, Math.abs(dr.r * dr.u)); rMax = Math.max(rMax, Math.abs(dr.roll)); }
  ['w', 'a'].forEach((k) => apexStage.driveKey(k, false)); out.peakLatG = +(pk / 9.81).toFixed(2); out.rollMax = +(rMax * 57.3).toFixed(1); out.flipped = dr.flipped;
  return out;
};
// landing test on the flat lot: drop from h metres (wheels hanging) rolling at `speed` m/s, step 4 s and measure the landing:
// peak compression (in, worst corner), bottom-outs (past full bump), rebound overshoot above the final ride height (cm),
// bounces (body heave swings > 1.5 cm after touchdown), settle time (s, body within 1 cm and slow), peak body g
window.__drop = (h = 1.2, speed = 8) => {
  const d = apexStage._debug(), dr = d.drive, dt = 1 / 60, b = d.build, tv = travelOf(b), INCH_ = 0.0254;
  const bpF = tv.front * bumpShare(tv.front) * INCH_, bpR = tv.rear * bumpShare(tv.rear) * INCH_;
  Object.assign(dr, { x: -95, z: -100, yaw: 0, u: speed, vz: 0, r: 0, y: -100, vy: 0, pitch: 0, roll: 0, pitchV: 0, rollV: 0, ws: null, air: false, flipped: false, steer: 0, chop: 0, lurchT: 0, gear: 2, manual: false, shiftT: 0 });
  d.step(dt); const y0 = dr.y; dr.y = y0 + h; dr.vy = 0; dr.ws.forEach((w) => { w.u = -0.05; w.du = 0; });
  const ys = [], N = 240; let land = -1, uPk = 0, bott = 0, wasB = false, gPk = 0, vyPrev = 0;
  for (let i = 0; i < N; i++) {
    apexStage.driveKey('w', dr.u < speed - 0.3); d.step(dt); ys.push(dr.y);
    if (land < 0 && i > 2 && !dr.air) land = i;
    if (land >= 0) { gPk = Math.max(gPk, Math.abs(dr.vy - vyPrev) / dt / 9.81);
      let isB = false; dr.ws.forEach((w, k) => { const front = d.P.spots[k].x > (d.P.xF + d.P.xR) / 2; uPk = Math.max(uPk, w.u / (front ? bpF : bpR)); if (w.u > (front ? bpF : bpR)) isB = true; }); if (isB && !wasB) bott++; wasB = isB; }
    vyPrev = dr.vy;
  }
  apexStage.driveKey('w', false);
  const rest = ys.slice(-30).reduce((a, v) => a + v, 0) / 30, after = ys.slice(Math.max(0, land));
  let over = 0, swings = 0, ext = 0, settle = null; const minI = after.indexOf(Math.min(...after));
  after.forEach((y, i) => { if (i > minI) over = Math.max(over, y - rest); });
  for (let i = 1; i < after.length - 1; i++) { const a = after[i] - rest; if ((after[i] - after[i - 1]) * (after[i + 1] - after[i]) < 0 && Math.abs(a - ext) > 0.015) { swings++; ext = a; } }
  for (let i = after.length - 1; i >= 0; i--) if (Math.abs(after[i] - rest) > 0.01) { settle = +((i + 1) / 60).toFixed(2); break; }
  return { compPct: Math.round(uPk * 100), bottoms: bott, overCm: +(over * 100).toFixed(1), swings, settle, gPk: +gPk.toFixed(1), flipped: dr.flipped };
};
window.DT = [0.6, 1.2, 2.0, 3.0];
window.__drops = async (builds = SB, hs = DT) => { const out = []; for (const [name, patch] of Object.entries(builds)) { await __setBuild(patch); out.push(name.padEnd(9) + hs.map((h) => { const r = __drop(h); return `${h}m: ${r.compPct}%${r.bottoms ? ' BOT' + r.bottoms : ''} +${r.overCm}cm sw${r.swings} ${r.settle}s ${r.gPk}g`; }).join(' | ')); } return out.join('\n'); };
window.__setBuild = async (patch) => { apexApp.setApplied({ ...DEFAULT_BUILD, tod: null, ...patch }); await new Promise((r) => setTimeout(r, 1200)); apexStage.applyBuild(apexStage.getBuild(), {}, true); return apexStage.getBuild().shock; };
try { window.TB = window.TB || JSON.parse(sessionStorage.getItem('__TB') || 'null'); } catch (e) { /* none saved */ }
window.__devReady = true;
