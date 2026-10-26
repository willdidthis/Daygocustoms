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
// apply a build patch on top of the stock build and settle it instantly (tweens don't run while the page is hidden)
window.__build = async (patch, base) => {
  apexApp.setApplied({ ...(base || DEFAULT_BUILD), tod: null, ...patch }); await new Promise((r) => setTimeout(r, 1500));
  apexStage.applyBuild(apexStage.getBuild(), {}, true); const d = apexStage._debug(); if (d.winAt) d.winAt();
  await new Promise((r) => setTimeout(r, 300)); return Object.keys(patch).length;
};
try { window.TB = window.TB || JSON.parse(sessionStorage.getItem('__TB') || 'null'); } catch (e) { /* none saved */ }
window.__devReady = true;
