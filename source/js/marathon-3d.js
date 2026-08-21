/**
 * 全馬 3D 心率軌跡（POC）
 *
 * 點跑步頁的全馬名稱 → 開一個全螢幕的 3D 路線圖，線的顏色是當下心率。
 * 資料來自 Garmin FIT 檔解析後降取樣的 /tracks/*.json。
 *
 * 刻意不用 three 的 addons：
 * - 線寬：原生 THREE.Line 在多數平台鎖死 1px，一般解法是 Line2/LineMaterial，
 *   但那要多帶三個 addon 檔。這裡改自己疊三角形做成緞帶（ribbon），寬度以
 *   公尺為單位、跟著鏡頭遠近縮放，順便讓 raycast 退回單純的 Mesh 判定。
 * - 鏡頭控制：自己寫一份最小的軌道控制（拖曳轉、滾輪／雙指縮放）。
 */
import * as THREE from '/js/vendor/three.module.min.js';

const BG = '#14171c';
const GRID_A = 0x2a3038;
const GRID_B = 0x1e232a;

/* ── 小工具 ─────────────────────────────────────── */

function fmtClock(sec) {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(ss).padStart(2, '0');
}

function fmtPace(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return m + ':' + String(s).padStart(2, '0') + '/km';
}

/** 心率色階：綠（輕鬆）→ 黃 → 紅（接近最大心率） */
function hrColor(x, out) {
  const t = Math.max(0, Math.min(1, x));
  return out.setHSL(0.42 * (1 - t), 0.85, 0.45 + t * 0.06);
}

/** 取分位數，用來把色階的上下界壓在資料主體上，避免離群值吃掉整條色帶 */
function quantile(sorted, f) {
  return sorted[Math.floor((sorted.length - 1) * f)];
}

/* ── 最小軌道控制 ───────────────────────────────── */

function createOrbit(camera, dom, target) {
  const state = {
    radius: 1, theta: 0, phi: 1,
    tRadius: 1, tTheta: 0, tPhi: 1,
    minPhi: 0.06, maxPhi: Math.PI / 2.05,
    minRadius: 1, maxRadius: 1e9,
    enabled: true,
  };

  const offset = new THREE.Vector3().copy(camera.position).sub(target);
  state.radius = state.tRadius = offset.length();
  state.theta = state.tTheta = Math.atan2(offset.x, offset.z);
  state.phi = state.tPhi = Math.acos(Math.max(-1, Math.min(1, offset.y / state.radius)));

  const pointers = new Map();
  let lastPinch = 0;

  const onDown = (e) => {
    dom.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) lastPinch = pinchDist();
  };

  function pinchDist() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  const onMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const d = pinchDist();
      if (lastPinch) state.tRadius = clampRadius(state.tRadius * (lastPinch / d));
      lastPinch = d;
      return;
    }
    state.tTheta -= (e.clientX - prev.x) * 0.005;
    state.tPhi = Math.max(state.minPhi, Math.min(state.maxPhi, state.tPhi - (e.clientY - prev.y) * 0.005));
  };

  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
  };

  function clampRadius(r) {
    return Math.max(state.minRadius, Math.min(state.maxRadius, r));
  }

  const onWheel = (e) => {
    e.preventDefault();
    state.tRadius = clampRadius(state.tRadius * (1 + e.deltaY * 0.0012));
  };

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });

  return {
    state,
    setRadiusBounds(min, max) {
      state.minRadius = min;
      state.maxRadius = max;
    },
    update() {
      const k = 0.12;
      state.radius += (state.tRadius - state.radius) * k;
      state.theta += (state.tTheta - state.theta) * k;
      state.phi += (state.tPhi - state.phi) * k;
      const sinPhi = Math.sin(state.phi);
      camera.position.set(
        target.x + state.radius * sinPhi * Math.sin(state.theta),
        target.y + state.radius * Math.cos(state.phi),
        target.z + state.radius * sinPhi * Math.cos(state.theta)
      );
      camera.lookAt(target);
    },
    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
    },
  };
}

/* ── 場景 ───────────────────────────────────────── */

function buildScene(mount, track, opts) {
  const w = mount.clientWidth;
  const h = mount.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 400000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  mount.appendChild(renderer.domElement);

  // 經緯度 → 公尺（以起點為原點的局部平面近似；42 km 的範圍內誤差可忽略）
  const lat0 = track.lat[0];
  const lon0 = track.lon[0];
  const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const n = track.n;

  const px = new Float64Array(n);
  const pz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = (track.lon[i] - lon0) * mPerLon;
    pz[i] = -(track.lat[i] - lat0) * 110540;
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    if (px[i] < minX) minX = px[i];
    if (px[i] > maxX) maxX = px[i];
    if (pz[i] < minZ) minZ = pz[i];
    if (pz[i] > maxZ) maxZ = pz[i];
  }
  const extent = Math.max(maxX - minX, maxZ - minZ);

  // 東京馬全程高低差只有 40 公尺左右，攤在 12 公里見方的路線上等於全平。
  // 不誇張就看不到起伏，誇張過頭放大的是 GPS 誤差而不是資訊。
  const exaggeration = opts.exaggeration;
  const yOf = (i) => track.ele[i] * exaggeration;

  // 心率 → 顏色。上下界取 2%／98% 分位，避免起跑前的低心率把色帶拉歪。
  const hrSorted = track.hr.filter((v) => v != null).slice().sort((a, b) => a - b);
  const hrMin = quantile(hrSorted, 0.02);
  const hrMax = quantile(hrSorted, 0.98);
  const colorAt = (() => {
    const c = new THREE.Color();
    return (i) => hrColor((track.hr[i] - hrMin) / (hrMax - hrMin || 1), c);
  })();

  // 緞帶：沿路線左右各推半個寬度，逐段疊兩個三角形
  const half = Math.max(extent * 0.0022, 4);
  const pos = new Float32Array(n * 2 * 3);
  const col = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1;
    const b = i === n - 1 ? n - 1 : i + 1;
    let dx = px[b] - px[a];
    let dz = pz[b] - pz[a];
    const len = Math.hypot(dx, dz) || 1;
    // 法線 = 前進方向在水平面上轉 90°
    const nx = (-dz / len) * half;
    const nz = (dx / len) * half;
    const y = yOf(i);
    const o = i * 6;
    pos[o] = px[i] + nx; pos[o + 1] = y; pos[o + 2] = pz[i] + nz;
    pos[o + 3] = px[i] - nx; pos[o + 4] = y; pos[o + 5] = pz[i] - nz;
    const c = colorAt(i);
    col[o] = col[o + 3] = c.r;
    col[o + 1] = col[o + 4] = c.g;
    col[o + 2] = col[o + 5] = c.b;
  }
  const idx = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const v = i * 2;
    const o = i * 6;
    idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2;
    idx[o + 3] = v + 1; idx[o + 4] = v + 3; idx[o + 5] = v + 2;
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  ribbonGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ribbonGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  const ribbonMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  scene.add(ribbon);

  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = yOf(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const baseY = minY - extent * 0.02;

  // 簾幕：從路線垂到地面的半透明面，讓高度差讀得出來
  const cPos = new Float32Array((n - 1) * 6 * 3);
  const cCol = new Float32Array((n - 1) * 6 * 3);
  for (let i = 0; i < n - 1; i++) {
    const ay = yOf(i), by = yOf(i + 1);
    const o = i * 18;
    const v = [
      px[i], baseY, pz[i], px[i], ay, pz[i], px[i + 1], by, pz[i + 1],
      px[i], baseY, pz[i], px[i + 1], by, pz[i + 1], px[i + 1], baseY, pz[i + 1],
    ];
    for (let k = 0; k < 18; k++) cPos[o + k] = v[k];
    const c = colorAt(i);
    for (let k = 0; k < 6; k++) {
      cCol[o + k * 3] = c.r;
      cCol[o + k * 3 + 1] = c.g;
      cCol[o + k * 3 + 2] = c.b;
    }
  }
  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  curtainGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  const curtainMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.18,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const curtain = new THREE.Mesh(curtainGeo, curtainMat);
  scene.add(curtain);

  const grid = new THREE.GridHelper(Math.max(extent * 1.6, 200), 24, GRID_A, GRID_B);
  grid.position.set((minX + maxX) / 2, baseY, (minZ + maxZ) / 2);
  scene.add(grid);

  // 起／終點標記：懸空的倒錐 + 細柱，避免被路線本身蓋住
  const markR = Math.max(extent * 0.012, 2);
  const disposables = [];
  const bobs = [];
  const addMarker = (i, color) => {
    const y = yOf(i);
    const lift = markR * 5;
    const coneGeo = new THREE.ConeGeometry(markR, markR * 2.4, 20);
    const mat = new THREE.MeshBasicMaterial({ color });
    const cone = new THREE.Mesh(coneGeo, mat);
    cone.rotation.x = Math.PI;
    cone.position.set(px[i], y + lift, pz[i]);
    scene.add(cone);
    const stemGeo = new THREE.BoxGeometry(markR * 0.1, lift, markR * 0.1);
    const stemMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(px[i], y + lift / 2, pz[i]);
    scene.add(stem);
    disposables.push(coneGeo, mat, stemGeo, stemMat);
    bobs.push({ mesh: cone, base: y + lift });
  };
  addMarker(0, 0x23d3a0);
  addMarker(n - 1, 0xff6b6b);

  // 取景：把包圍盒八個角投影到鏡頭的 right / up 軸上量實際需要的畫面，
  // 用外接球會嚴重高估 —— 馬拉松路線又長又扁，斜看時佔的畫面比球小得多。
  const box = new THREE.Box3().setFromObject(ribbon);
  const center = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(0.5, 0.55, 0.67).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  let halfW = 0, halfH = 0;
  for (const cx of [box.min.x, box.max.x])
    for (const cy of [box.min.y, box.max.y])
      for (const cz of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(cx, cy, cz).sub(center);
        halfW = Math.max(halfW, Math.abs(v.dot(right)));
        halfH = Math.max(halfH, Math.abs(v.dot(up)));
      }
  const vFov = (camera.fov * Math.PI) / 180;
  const fit = () => {
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return Math.max(halfW / Math.tan(hFov / 2), halfH / Math.tan(vFov / 2)) * 1.25;
  };
  camera.position.copy(center).addScaledVector(dir, fit());

  const orbit = createOrbit(camera, renderer.domElement, center);
  orbit.setRadiusBounds(extent * 0.08, extent * 6);

  /* hover：射線打到緞帶後，在附近找最接近的取樣點 */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverIdx = -1;
  const onPointerMove = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ribbon)[0];
    if (!hit) {
      if (hoverIdx !== -1) { hoverIdx = -1; opts.onHover(null); }
      return;
    }
    // 索引緩衝每段兩個三角形，第 i 段的頂點是 2i / 2i+1，除以 2 取整就回到取樣點序號
    const i = Math.min(n - 1, Math.max(0, Math.floor(hit.face.a / 2)));
    if (i !== hoverIdx) {
      hoverIdx = i;
      opts.onHover({
        i,
        t: track.t[i], dist: track.dist[i], hr: track.hr[i],
        ele: track.ele[i], pace: track.pace[i],
      });
    }
  };
  renderer.domElement.addEventListener('pointermove', onPointerMove);

  const onResize = () => {
    const nw = mount.clientWidth, nh = mount.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  };
  window.addEventListener('resize', onResize);

  let raf = 0;
  const tick = () => {
    const s = performance.now() / 620;
    bobs.forEach((b, k) => { b.mesh.position.y = b.base + Math.sin(s + k * 1.6) * markR * 0.5; });
    orbit.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    hrMin, hrMax,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      orbit.dispose();
      ribbonGeo.dispose(); ribbonMat.dispose();
      curtainGeo.dispose(); curtainMat.dispose();
      grid.geometry.dispose(); grid.material.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/* ── 覆蓋層 ─────────────────────────────────────── */

const cache = new Map();
let active = null;

async function loadTrack(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch((err) => { cache.delete(url); throw err; }));
  }
  return cache.get(url);
}

function buildOverlay(meta) {
  const root = document.createElement('div');
  root.className = 'route3d';
  root.innerHTML = [
    '<div class="route3d__bar">',
    '  <div class="route3d__id">',
    '    <strong class="route3d__name"></strong>',
    '    <span class="route3d__sub"></span>',
    '  </div>',
    '  <div class="route3d__legend">',
    '    <span class="route3d__legend-min"></span>',
    '    <i class="route3d__ramp"></i>',
    '    <span class="route3d__legend-max"></span>',
    '    <span class="route3d__legend-label">bpm</span>',
    '  </div>',
    '  <button class="route3d__close" type="button" aria-label="關閉">✕</button>',
    '</div>',
    '<div class="route3d__stage"><div class="route3d__mount"></div>',
    '  <div class="route3d__status">載入軌跡中…</div>',
    '  <dl class="route3d__readout" hidden>',
    '    <div><dt>時間</dt><dd data-f="t">—</dd></div>',
    '    <div><dt>距離</dt><dd data-f="dist">—</dd></div>',
    '    <div><dt>心率</dt><dd data-f="hr">—</dd></div>',
    '    <div><dt>配速</dt><dd data-f="pace">—</dd></div>',
    '    <div><dt>高度</dt><dd data-f="ele">—</dd></div>',
    '  </dl>',
    '</div>',
    '<p class="route3d__hint">拖曳旋轉 · 滾輪／雙指縮放 · 滑過路線看該點數據</p>',
  ].join('');
  root.querySelector('.route3d__name').textContent = meta.name + ' ' + meta.year;
  return root;
}

function close() {
  if (!active) return;
  active.scene?.dispose();
  active.root.remove();
  document.removeEventListener('keydown', active.onKey);
  document.body.style.overflow = active.prevOverflow;
  active = null;
}

async function open(meta) {
  close();
  const root = buildOverlay(meta);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  active = { root, onKey, scene: null, prevOverflow: document.body.style.overflow };
  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  root.querySelector('.route3d__close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  const status = root.querySelector('.route3d__status');
  const readout = root.querySelector('.route3d__readout');
  const fields = {};
  readout.querySelectorAll('[data-f]').forEach((el) => { fields[el.dataset.f] = el; });

  let track;
  try {
    track = await loadTrack(meta.track);
  } catch (err) {
    status.textContent = '軌跡載入失敗：' + err.message;
    return;
  }
  if (!active || active.root !== root) return; // 載入期間被關掉了

  status.remove();
  root.querySelector('.route3d__sub').textContent =
    [meta.time, track.distanceKm + ' km', track.n.toLocaleString() + ' 點'].join(' · ');

  const onHover = (p) => {
    if (!p) { readout.hidden = true; return; }
    readout.hidden = false;
    fields.t.textContent = fmtClock(p.t);
    fields.dist.textContent = (p.dist / 1000).toFixed(2) + ' km';
    fields.hr.textContent = p.hr != null ? p.hr + ' bpm' : '—';
    fields.pace.textContent = fmtPace(p.pace);
    fields.ele.textContent = p.ele.toFixed(1) + ' m';
  };

  const scene = buildScene(root.querySelector('.route3d__mount'), track, {
    exaggeration: 22,
    onHover,
  });
  active.scene = scene;
  root.querySelector('.route3d__legend-min').textContent = scene.hrMin;
  root.querySelector('.route3d__legend-max').textContent = scene.hrMax;
}

/* ── 綁定：跑步頁圖表上可點的賽事 ───────────────── */

function bind() {
  const chart = document.getElementById('marathon-chart');
  if (!chart) return;
  chart.addEventListener('click', (e) => {
    const hit = e.target.closest('[data-track]');
    if (!hit) return;
    open({
      name: hit.dataset.name,
      year: hit.dataset.year,
      time: hit.dataset.time,
      track: hit.dataset.track,
    });
  });
  chart.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const hit = e.target.closest('[data-track]');
    if (!hit) return;
    e.preventDefault();
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind);
} else {
  bind();
}
