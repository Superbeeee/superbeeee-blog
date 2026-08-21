/**
 * 全馬 3D 軌跡（POC）
 *
 * 點跑步頁的全馬名稱 → 開一個 3D 路線圖，路線顏色可切換成不同指標。
 * 資料來自 Garmin FIT 檔解析後降取樣的 /tracks/*.json。
 *
 * 刻意不用 three 的 addons：
 * - 線寬：原生 THREE.Line 在多數平台鎖死 1px，一般解法是 Line2/LineMaterial，
 *   但那要多帶三個 addon 檔。這裡改自己疊三角形做成緞帶（ribbon），寬度以
 *   公尺為單位，順便讓 raycast 退回單純的 Mesh 判定。
 * - 鏡頭控制：自己寫一份最小的軌道控制（拖曳轉、滾輪／雙指縮放）。
 *
 * three 走動態 import：擺在最上面當靜態 import 的話，只要它載入失敗，整支模組
 * 就不會執行、連點擊事件都不會綁 —— 畫面上完全沒反應，錯誤只躺在 console 裡。
 * 改成點下去才載，載不動就把錯誤寫在覆蓋層上。
 */
let THREE = null;

async function loadThree() {
  if (!THREE) THREE = await import('/js/vendor/three.module.min.js');
  return THREE;
}

const BG = '#14171c';
const GRID_A = 0x2a3038;
const GRID_B = 0x1e232a;
const START_COLOR = 0xffffff;
const FINISH_COLOR = 0xd4af37;

/**
 * 心率區間用的最大心率。⚠️ 這是估的 —— 取訓練紀錄裡看過的最高值（8/11 間歇
 * 那場的 192），不是實驗室測出來的 HRmax。要換成真值改這一個常數就好。
 */
const MAX_HR = 192;

/* ── 色階 ───────────────────────────────────────────
 * 全部取自 dataviz 設計系統的斜坡，並用它的驗證器對本頁實際的深色底
 * #14171c 跑過 ordinal 四項檢查（明度單調、相鄰 ΔL ≥ 0.06、最暗端對底色
 * 對比 ≥ 2:1、單一色相），四項皆過。
 *
 * 規則：連續量＝單一色相；極性（比基準快還是慢）＝兩個色相 + 灰色中點。
 * 不用彩虹色階 —— 那會在資料裡憑空造出根本不存在的分界。
 */

// 序列（單一色相，深→淺；深色底上「亮＝值大」）
const RAMP_BLUE = ['#184f95', '#2a78d6', '#5598e7', '#86b6ef', '#b7d3f6'];
const RAMP_ORANGE = ['#86310b', '#ba4816', '#e76530', '#fa9672', '#fccbb9'];

// 發散（藍 ↔ 紅，中點是灰 —— 中點放任何色相都會讀成「有事發生」）
const RAMP_DIVERGING = [
  '#235088', '#3d72b7', '#5694e4', '#383835', '#d96d67', '#ad514c', '#803431',
];

function cssRamp(stops) {
  return 'linear-gradient(90deg,' + stops.join(',') + ')';
}

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

function fmtPaceDelta(sec) {
  const s = Math.round(Math.abs(sec));
  const sign = sec > 0 ? '慢 ' : sec < 0 ? '快 ' : '';
  return sign + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** 分位數，用來把色階上下界壓在資料主體上，不讓離群值吃掉整條色帶 */
function quantile(sorted, f) {
  return sorted[Math.floor((sorted.length - 1) * f)];
}

function sortedFinite(arr) {
  return arr.filter((v) => v != null && isFinite(v)).slice().sort((a, b) => a - b);
}

/* ── 指標：路線顏色可以代表什麼 ─────────────────────
 * 每個指標 build() 回傳 { scale, values, stops, legend }：
 *   scale 'seq'  → values 已正規化到 0..1
 *   scale 'div'  → values 是 -1..1，0 代表基準線
 *   scale 'zone' → values 是 0..4 的整數區間
 */

/** 每點速度（m/s）。配速本身是長尾分佈（停下來時趨近無限大），改用速度就有界。 */
function speeds(track) {
  return track.pace.map((p) => (p && isFinite(p) ? 1000 / p : 0));
}

/** 每次心跳前進的公尺數 = 速度 ÷ 每秒心跳數。跑步經濟性的粗略代理值。 */
function metresPerBeat(track, spd) {
  return spd.map((s, i) => {
    const hr = track.hr[i];
    return hr ? (s * 60) / hr : null;
  });
}

const METRICS = {
  hrzone: {
    label: '心率區間',
    build(track) {
      // 標準五區間（%HRmax）：<60 / 60–70 / 70–80 / 80–90 / ≥90
      const edges = [0.6, 0.7, 0.8, 0.9].map((f) => Math.round(MAX_HR * f));
      const zoneOf = (hr) => {
        if (hr == null) return 0;
        let z = 0;
        while (z < edges.length && hr >= edges[z]) z++;
        return z;
      };
      const bands = ['< ' + edges[0]];
      for (let i = 0; i < edges.length - 1; i++) bands.push(edges[i] + '–' + (edges[i + 1] - 1));
      bands.push('≥ ' + edges[edges.length - 1]);
      return {
        scale: 'zone',
        values: track.hr.map(zoneOf),
        stops: RAMP_BLUE,
        legend: {
          kind: 'swatches',
          note: 'bpm（以最大心率 ' + MAX_HR + ' 估算）',
          items: RAMP_BLUE.map((c, i) => ({ color: c, label: 'Z' + (i + 1), sub: bands[i] })),
        },
      };
    },
  },

  speed: {
    label: '配速',
    build(track) {
      const spd = speeds(track);
      const s = sortedFinite(spd.filter((v) => v > 0));
      const lo = quantile(s, 0.02);
      const hi = quantile(s, 0.98);
      return {
        scale: 'seq',
        values: spd.map((v) => (v - lo) / (hi - lo || 1)),
        stops: RAMP_ORANGE,
        legend: {
          kind: 'ramp',
          stops: RAMP_ORANGE,
          min: fmtPace(1000 / lo),
          max: fmtPace(1000 / hi),
          note: '亮＝快',
        },
      };
    },
  },

  split: {
    label: '快慢',
    build(track) {
      // 相對全程均速的配速差。正＝比均速慢（紅），負＝比均速快（藍）。
      const total = track.t[track.n - 1] - track.t[0];
      const avgPace = (total / (track.dist[track.n - 1] - track.dist[0])) * 1000;
      const diff = track.pace.map((p) => (p && isFinite(p) ? p - avgPace : 0));
      // 上下界取對稱：發散色階兩臂範圍不等的話，中點就不是零了
      const lim = quantile(sortedFinite(diff.map(Math.abs)), 0.95) || 1;
      return {
        scale: 'div',
        values: diff.map((d) => Math.max(-1, Math.min(1, d / lim))),
        stops: RAMP_DIVERGING,
        legend: {
          kind: 'ramp',
          stops: RAMP_DIVERGING,
          min: fmtPaceDelta(-lim),
          mid: '均速 ' + fmtPace(avgPace),
          max: fmtPaceDelta(lim),
          note: '相對全程均速',
        },
      };
    },
  },

  drift: {
    label: '心跳效率',
    build(track) {
      // 每跳前進公尺數，跟前 10K 的基準比。掉下去＝同樣心跳跑不了那麼遠，
      // 也就是心率漂移（cardiac drift）在路線上的位置。
      const mpb = metresPerBeat(track, speeds(track));
      const baseSrc = [];
      for (let i = 0; i < track.n; i++) {
        if (track.dist[i] <= 10000 && mpb[i]) baseSrc.push(mpb[i]);
      }
      const sortedBase = sortedFinite(baseSrc);
      const base = sortedBase.length ? quantile(sortedBase, 0.5) : 1;
      const rel = mpb.map((v) => (v ? (v - base) / base : 0));
      const lim = quantile(sortedFinite(rel.map(Math.abs)), 0.95) || 1;
      return {
        scale: 'div',
        values: rel.map((d) => Math.max(-1, Math.min(1, d / lim))),
        // 效率「掉了」是壞事，要落在紅端 → 把發散色階反過來
        stops: RAMP_DIVERGING.slice().reverse(),
        legend: {
          kind: 'ramp',
          stops: RAMP_DIVERGING.slice().reverse(),
          min: '−' + Math.round(lim * 100) + '%',
          mid: '前 10K 基準',
          max: '+' + Math.round(lim * 100) + '%',
          note: '每跳前進距離',
        },
      };
    },
  },
};

const METRIC_ORDER = ['hrzone', 'speed', 'split', 'drift'];

/** 依 scale 把值換成色階位置，再在相鄰色階點之間線性內插 */
function makeColorFn(metric, Color) {
  const stops = metric.stops.map((hex) => new Color(hex));
  const last = stops.length - 1;
  if (metric.scale === 'zone') return (i) => stops[metric.values[i]] || stops[0];
  const out = new Color();
  return (i) => {
    const v = metric.values[i];
    const t = metric.scale === 'div' ? (v + 1) / 2 : v;
    const x = Math.max(0, Math.min(1, t)) * last;
    const k = Math.min(last - 1, Math.floor(x));
    return out.copy(stops[k]).lerp(stops[k + 1], x - k);
  };
}

/* ── 最小軌道控制 ───────────────────────────────── */

function createOrbit(camera, dom, target) {
  const state = {
    radius: 1, theta: 0, phi: 1,
    tRadius: 1, tTheta: 0, tPhi: 1,
    minPhi: 0.06, maxPhi: Math.PI / 2.05,
    minRadius: 1, maxRadius: 1e9,
  };

  const offset = new THREE.Vector3().copy(camera.position).sub(target);
  state.radius = state.tRadius = offset.length();
  state.theta = state.tTheta = Math.atan2(offset.x, offset.z);
  state.phi = state.tPhi = Math.acos(Math.max(-1, Math.min(1, offset.y / state.radius)));

  const pointers = new Map();
  let lastPinch = 0;

  function pinchDist() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clampRadius(r) {
    return Math.max(state.minRadius, Math.min(state.maxRadius, r));
  }

  const onDown = (e) => {
    dom.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) lastPinch = pinchDist();
  };

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

/* ── 起／終點的浮動箭頭 ─────────────────────────── */

function makeArrow(scene, x, y, z, size, color, disposables) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const headH = size * 2.6;
  const shaftH = size * 3.2;
  const gap = size * 1.4; // 箭尖跟路線之間留空隙，才看得出是「指著」而不是插在上面

  const headGeo = new THREE.ConeGeometry(size, headH, 20);
  const head = new THREE.Mesh(headGeo, mat);
  head.rotation.x = Math.PI; // 尖端朝下
  head.position.y = gap + headH / 2;
  group.add(head);

  const shaftGeo = new THREE.CylinderGeometry(size * 0.26, size * 0.26, shaftH, 12);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = gap + headH + shaftH / 2;
  group.add(shaft);

  group.position.set(x, y, z);
  scene.add(group);

  // 落點的小圓點不浮動，免得箭頭飄起來後看不出到底指哪一點
  const dotGeo = new THREE.SphereGeometry(size * 0.42, 12, 12);
  const dot = new THREE.Mesh(dotGeo, mat);
  dot.position.set(x, y, z);
  scene.add(dot);

  disposables.push(headGeo, shaftGeo, dotGeo, mat);
  return group;
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

  // 經緯度 → 公尺（以起點為原點的局部平面近似；42 km 範圍內誤差可忽略）
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

  // 東京馬全程高低差只有 40 公尺左右，攤在 10 公里見方的路線上等於全平。
  // 不誇張看不到起伏，誇張過頭放大的是 GPS 誤差而不是資訊。
  const yOf = (i) => track.ele[i] * opts.exaggeration;

  /* 緞帶：沿路線左右各推半個寬度，逐段疊兩個三角形 */
  const half = Math.max(extent * 0.0022, 4);
  const pos = new Float32Array(n * 2 * 3);
  const ribbonCol = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1;
    const b = i === n - 1 ? n - 1 : i + 1;
    const dx = px[b] - px[a];
    const dz = pz[b] - pz[a];
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * half; // 法線 = 前進方向在水平面上轉 90°
    const nz = (dx / len) * half;
    const y = yOf(i);
    const o = i * 6;
    pos[o] = px[i] + nx; pos[o + 1] = y; pos[o + 2] = pz[i] + nz;
    pos[o + 3] = px[i] - nx; pos[o + 4] = y; pos[o + 5] = pz[i] - nz;
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
  ribbonGeo.setAttribute('color', new THREE.BufferAttribute(ribbonCol, 3));
  ribbonGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  const ribbonMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  scene.add(ribbon);

  let minY = Infinity;
  for (let i = 0; i < n; i++) minY = Math.min(minY, yOf(i));
  const baseY = minY - extent * 0.02;

  /* 簾幕：從路線垂到地面的半透明面，讓高度差讀得出來 */
  const cPos = new Float32Array((n - 1) * 6 * 3);
  const curtainCol = new Float32Array((n - 1) * 6 * 3);
  for (let i = 0; i < n - 1; i++) {
    const ay = yOf(i), by = yOf(i + 1);
    const o = i * 18;
    const v = [
      px[i], baseY, pz[i], px[i], ay, pz[i], px[i + 1], by, pz[i + 1],
      px[i], baseY, pz[i], px[i + 1], by, pz[i + 1], px[i + 1], baseY, pz[i + 1],
    ];
    for (let k = 0; k < 18; k++) cPos[o + k] = v[k];
  }
  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  curtainGeo.setAttribute('color', new THREE.BufferAttribute(curtainCol, 3));
  const curtainMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.18,
    side: THREE.DoubleSide, depthWrite: false,
  });
  scene.add(new THREE.Mesh(curtainGeo, curtainMat));

  /** 換指標只要重寫顏色緩衝，幾何完全不用動 */
  function paint(metric) {
    const colorAt = makeColorFn(metric, THREE.Color);
    for (let i = 0; i < n; i++) {
      const c = colorAt(i);
      const o = i * 6;
      ribbonCol[o] = ribbonCol[o + 3] = c.r;
      ribbonCol[o + 1] = ribbonCol[o + 4] = c.g;
      ribbonCol[o + 2] = ribbonCol[o + 5] = c.b;
    }
    for (let i = 0; i < n - 1; i++) {
      const c = colorAt(i);
      const o = i * 18;
      for (let k = 0; k < 6; k++) {
        curtainCol[o + k * 3] = c.r;
        curtainCol[o + k * 3 + 1] = c.g;
        curtainCol[o + k * 3 + 2] = c.b;
      }
    }
    ribbonGeo.attributes.color.needsUpdate = true;
    curtainGeo.attributes.color.needsUpdate = true;
  }

  const grid = new THREE.GridHelper(Math.max(extent * 1.6, 200), 24, GRID_A, GRID_B);
  grid.position.set((minX + maxX) / 2, baseY, (minZ + maxZ) / 2);
  scene.add(grid);

  const markR = Math.max(extent * 0.012, 2);
  const disposables = [];
  const arrows = [
    makeArrow(scene, px[0], yOf(0), pz[0], markR, START_COLOR, disposables),
    makeArrow(scene, px[n - 1], yOf(n - 1), pz[n - 1], markR, FINISH_COLOR, disposables),
  ];

  // 取景：把包圍盒八個角投影到鏡頭的 right / up 軸上量實際需要的畫面。
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
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dist = Math.max(halfW / Math.tan(hFov / 2), halfH / Math.tan(vFov / 2)) * 1.25;
  camera.position.copy(center).addScaledVector(dir, dist);

  const orbit = createOrbit(camera, renderer.domElement, center);
  orbit.setRadiusBounds(extent * 0.08, extent * 6);

  /* hover：射線打到緞帶，索引換算回取樣點 */
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
    // 每段兩個三角形，頂點是 2i / 2i+1，除以 2 取整就回到取樣點序號
    const i = Math.min(n - 1, Math.max(0, Math.floor(hit.face.a / 2)));
    if (i !== hoverIdx) {
      hoverIdx = i;
      opts.onHover({ i, t: track.t[i], dist: track.dist[i], hr: track.hr[i], ele: track.ele[i], pace: track.pace[i] });
    }
  };
  renderer.domElement.addEventListener('pointermove', onPointerMove);

  // 用 ResizeObserver 而不是 window resize：進出全螢幕時視窗尺寸沒變、
  // 變的是這個容器，監聽 window 會漏掉。
  const ro = new ResizeObserver(() => {
    const nw = mount.clientWidth, nh = mount.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
  ro.observe(mount);

  let raf = 0;
  const bobBase = arrows.map((a) => a.position.y);
  const tick = () => {
    const s = performance.now() / 700;
    arrows.forEach((a, k) => {
      a.position.y = bobBase[k] + Math.sin(s + (k * Math.PI) / 2) * markR * 0.9;
    });
    orbit.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    paint,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
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

const ICON_EXPAND =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">'
  + '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"'
  + ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_COLLAPSE =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">'
  + '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"'
  + ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function buildOverlay(meta) {
  const root = document.createElement('div');
  root.className = 'route3d';
  const tabs = METRIC_ORDER.map((id, i) =>
    '<button class="route3d__tab' + (i === 0 ? ' is-on' : '') + '" type="button"'
    + ' data-metric="' + id + '">' + METRICS[id].label + '</button>').join('');
  root.innerHTML = [
    '<div class="route3d__panel" role="dialog" aria-modal="true" aria-label="3D 軌跡">',
    '  <div class="route3d__bar">',
    '    <div class="route3d__id">',
    '      <strong class="route3d__name"></strong>',
    '      <span class="route3d__sub"></span>',
    '    </div>',
    '    <button class="route3d__btn route3d__full" type="button" aria-label="全螢幕">' + ICON_EXPAND + '</button>',
    '    <button class="route3d__btn route3d__close" type="button" aria-label="關閉">✕</button>',
    '  </div>',
    '  <div class="route3d__stage">',
    '    <div class="route3d__mount"></div>',
    '    <div class="route3d__tabs" role="group" aria-label="路線顏色代表">' + tabs + '</div>',
    '    <div class="route3d__legend"></div>',
    '    <div class="route3d__status">載入軌跡中…</div>',
    '    <dl class="route3d__readout" hidden>',
    '      <div><dt>時間</dt><dd data-f="t">—</dd></div>',
    '      <div><dt>距離</dt><dd data-f="dist">—</dd></div>',
    '      <div><dt>心率</dt><dd data-f="hr">—</dd></div>',
    '      <div><dt>配速</dt><dd data-f="pace">—</dd></div>',
    '      <div><dt>高度</dt><dd data-f="ele">—</dd></div>',
    '    </dl>',
    '  </div>',
    '  <p class="route3d__hint">拖曳旋轉 · 滾輪／雙指縮放 · 滑過路線看該點數據</p>',
    '</div>',
  ].join('');
  root.querySelector('.route3d__name').textContent = meta.name + ' ' + meta.year;
  return root;
}

function renderLegend(host, legend) {
  if (legend.kind === 'swatches') {
    host.innerHTML =
      '<div class="route3d__swatches">'
      + legend.items.map((it) =>
        '<span class="route3d__swatch"><i style="background:' + it.color + '"></i>'
        + '<b>' + it.label + '</b><em>' + it.sub + '</em></span>').join('')
      + '</div><span class="route3d__legend-note">' + legend.note + '</span>';
    return;
  }
  host.innerHTML =
    '<div class="route3d__scale">'
    + '<span>' + legend.min + '</span>'
    + '<i class="route3d__ramp" style="background:' + cssRamp(legend.stops) + '"></i>'
    + '<span>' + legend.max + '</span>'
    + '</div>'
    + '<span class="route3d__legend-note">'
    + (legend.mid ? legend.mid + ' · ' : '') + legend.note + '</span>';
}

function close() {
  if (!active) return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  active.scene?.dispose();
  active.root.remove();
  document.removeEventListener('keydown', active.onKey);
  document.removeEventListener('fullscreenchange', active.onFsChange);
  document.body.style.overflow = active.prevOverflow;
  active = null;
}

/** 視窗 ⇄ 全螢幕。Safari 舊前綴不處理，沒有 API 就把按鈕收起來。 */
function wireFullscreen(panel, btn) {
  if (!panel.requestFullscreen) {
    btn.remove();
    return () => {};
  }
  const sync = () => {
    const on = document.fullscreenElement === panel;
    btn.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
    btn.setAttribute('aria-label', on ? '離開全螢幕' : '全螢幕');
  };
  btn.addEventListener('click', () => {
    if (document.fullscreenElement === panel) document.exitFullscreen().catch(() => {});
    else panel.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', sync);
  return sync;
}

async function open(meta) {
  close();
  const root = buildOverlay(meta);
  const panel = root.querySelector('.route3d__panel');
  // 全螢幕時 Esc 交給瀏覽器退出全螢幕，別順手把整個視窗也關掉
  const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) close(); };
  const onFsChange = wireFullscreen(panel, root.querySelector('.route3d__full'));
  active = { root, onKey, onFsChange, scene: null, prevOverflow: document.body.style.overflow };
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
    [track] = await Promise.all([loadTrack(meta.track), loadThree()]);
  } catch (err) {
    status.textContent = '載入失敗：' + err.message;
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

  // 四個指標一次算完（每個都只是掃一遍陣列），切換就不用等
  const built = {};
  METRIC_ORDER.forEach((id) => { built[id] = METRICS[id].build(track); });

  const legendHost = root.querySelector('.route3d__legend');
  const tabs = [...root.querySelectorAll('.route3d__tab')];
  const select = (id) => {
    tabs.forEach((t) => {
      const on = t.dataset.metric === id;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-pressed', String(on));
    });
    scene.paint(built[id]);
    renderLegend(legendHost, built[id].legend);
  };
  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.metric)));
  select(METRIC_ORDER[0]);
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
