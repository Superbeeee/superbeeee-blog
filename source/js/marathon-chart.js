(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // 圖表座標常數
  const W = 600;
  const H = 380;
  const PLOT_TOP = 20;
  const PLOT_BOTTOM = 340;
  const INSET = 50;

  // Y 軸時間範圍：3:00 (180 min) ~ 4:30 (270 min)
  const TIME_MIN = 180;
  const TIME_MAX = 270;
  const Y_TICKS = [180, 210, 240, 270];

  function el(name, attrs, children) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const k in attrs) node.setAttribute(k, attrs[k]);
    }
    if (children) {
      children.forEach(c => c && node.appendChild(c));
    }
    return node;
  }

  function timeToY(min) {
    return PLOT_TOP + (min - TIME_MIN) / (TIME_MAX - TIME_MIN) * (PLOT_BOTTOM - PLOT_TOP);
  }

  function formatTick(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h + ':' + String(m).padStart(2, '0');
  }

  function buildSvg(data) {
    const N = data.length;
    const plotWidth = W - INSET * 2;
    const points = data.map((m, i) => Object.assign({}, m, {
      x: INSET + (i / (N - 1)) * plotWidth,
      y: timeToY(m.minutes)
    }));

    const svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      class: 'marathon-stats__svg',
      preserveAspectRatio: 'xMidYMid meet'
    });

    // grid lines
    Y_TICKS.forEach(t => {
      const y = timeToY(t);
      svg.appendChild(el('line', {
        x1: 0, x2: W, y1: y, y2: y,
        class: t === TIME_MAX ? 'ms-grid ms-grid--solid' : 'ms-grid'
      }));
    });

    // connecting line
    svg.appendChild(el('polyline', {
      class: 'ms-line',
      points: points.map(p => p.x + ',' + p.y).join(' ')
    }));

    // data points + labels
    points.forEach(p => {
      if (p.isMajor) {
        const star = el('g', {
          transform: 'translate(' + p.x + ',' + p.y + ')',
          class: 'ms-star'
        });
        star.appendChild(el('path', {
          d: 'M0 -12 L3.5 -3.7 L12.4 -3 L5.4 2.7 L7.5 12 L0 7 L-7.5 12 L-5.4 2.7 L-12.4 -3 L-3.5 -3.7 Z'
        }));
        svg.appendChild(star);
      } else {
        svg.appendChild(el('circle', {
          cx: p.x, cy: p.y, r: 5, class: 'ms-dot'
        }));
      }

      const time = el('text', {
        x: p.x,
        y: p.y - (p.isMajor ? 18 : 14),
        'text-anchor': 'middle',
        class: p.isPB ? 'ms-time ms-time--pb' : 'ms-time'
      });
      time.textContent = p.time;
      svg.appendChild(time);

      // 有軌跡資料的賽事才可點；marathon-3d.js 用 data-track 做事件委派
      const nameCls = [p.isPB ? 'ms-xlabel ms-xlabel--pb' : 'ms-xlabel'];
      if (p.track) nameCls.push('ms-xlabel--track');
      const name = el('text', {
        x: p.x,
        y: PLOT_BOTTOM + 22,
        'text-anchor': 'middle',
        class: nameCls.join(' ')
      });
      if (p.track) {
        name.setAttribute('data-track', p.track);
        name.setAttribute('data-name', p.name);
        name.setAttribute('data-year', p.year);
        name.setAttribute('data-time', p.time);
        name.setAttribute('role', 'button');
        name.setAttribute('tabindex', '0');
        name.setAttribute('aria-label', p.name + p.year + '：看 3D 心率軌跡');
      }
      name.textContent = p.name;
      svg.appendChild(name);

      const year = el('text', {
        x: p.x,
        y: PLOT_BOTTOM + 36,
        'text-anchor': 'middle',
        class: p.isPB ? 'ms-xlabel ms-xlabel--year ms-xlabel--pb' : 'ms-xlabel ms-xlabel--year'
      });
      year.textContent = p.year;
      svg.appendChild(year);
    });

    return svg;
  }

  function buildYAxis() {
    const axis = document.createElement('div');
    axis.className = 'marathon-stats__y-axis';
    Y_TICKS.forEach(t => {
      const span = document.createElement('span');
      span.className = 'marathon-stats__y-label';
      span.textContent = formatTick(t);
      span.style.top = (timeToY(t) / H * 100) + '%';
      axis.appendChild(span);
    });
    return axis;
  }

  // 視窗較窄時，每次顯示固定的賽事數量，其餘可橫向滑動查看
  const VISIBLE_ON_NARROW = 5;
  const NARROW_THRESHOLD = 600;

  function fitChart(scroll, svg, data) {
    const N = data.length;
    if (N <= VISIBLE_ON_NARROW) {
      svg.style.width = '100%';
      return;
    }
    const containerWidth = scroll.clientWidth;
    if (containerWidth >= NARROW_THRESHOLD) {
      svg.style.width = '100%';
      return;
    }
    // 強制顯示 N-1 / VISIBLE-1 倍的寬度，確保最多 VISIBLE 場可見
    const ratio = (N - 1) / (VISIBLE_ON_NARROW - 1);
    svg.style.width = (containerWidth * ratio) + 'px';
  }

  function render(container, data) {
    const wrap = document.createElement('div');
    wrap.className = 'marathon-stats__chart-wrap';

    wrap.appendChild(buildYAxis());

    const scroll = document.createElement('div');
    scroll.className = 'marathon-stats__scroll';
    const svg = buildSvg(data);
    scroll.appendChild(svg);
    wrap.appendChild(scroll);

    container.appendChild(wrap);

    function refit() {
      fitChart(scroll, svg, data);
      // 維持貼齊右邊（顯示最新成績）
      requestAnimationFrame(() => {
        if (scroll.scrollWidth > scroll.clientWidth) {
          scroll.scrollLeft = scroll.scrollWidth;
        }
      });
    }

    refit();
    window.addEventListener('resize', refit);
  }

  function init() {
    const container = document.getElementById('marathon-chart');
    if (!container) return;
    const dataEl = document.getElementById('marathon-data');
    if (!dataEl) return;
    let data;
    try {
      data = JSON.parse(dataEl.textContent);
    } catch (err) {
      console.error('marathon-chart: invalid data', err);
      return;
    }
    markPb(data);
    render(container, data);
    updatePbBadge(data);
  }

  function markPb(data) {
    if (!data.length) return;
    const best = data.reduce((acc, cur) => cur.minutes < acc.minutes ? cur : acc);
    data.forEach(r => { r.isPB = (r === best); });
  }

  function updatePbBadge(data) {
    const badgeEl = document.querySelector('[data-pb-badge]');
    if (!badgeEl || !data.length) return;
    const best = data.find(r => r.isPB);
    if (!best) return;
    badgeEl.textContent = 'PB ' + best.time + ' / ' + best.name + ' ' + best.year;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
