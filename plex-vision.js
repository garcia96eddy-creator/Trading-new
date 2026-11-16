
// PLEX v5.6 - Módulo 2: Visión, WebSocket, OHLC, Precio y ZigZag
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const { CFG, loadCal, saveCal } = window.PLEX_MOD.config;

  // =========================================================
  // WEBSOCKET Y REGISTRO DE PRECIOS
  // =========================================================
  const wsAct = {};
  let wsMsgs = 0;
  let wsQ = 0;
  let wsPickId = null;
  let assetChanged = false;
  let ackCb = null;

  const BAR_MS = Math.max(1000, +CFG.analysisTimeframeMs || 60000);

  let localBar = null;
  let lastPrice = null;
  let lastPriceAt = 0;

  function updateLocalBar(price, timestamp) {
    if (!isFinite(price) || price <= 0) return;

    const start = Math.floor(timestamp / BAR_MS) * BAR_MS;

    if (!localBar || localBar.start !== start) {
      const previous = localBar;

      localBar = {
        start,
        end: start + BAR_MS,
        o: price,
        h: price,
        l: price,
        c: price,
        ticks: 1,
        closedPrevious: !!previous
      };
    } else {
      localBar.h = Math.max(localBar.h, price);
      localBar.l = Math.min(localBar.l, price);
      localBar.c = price;
      localBar.ticks++;
    }

    lastPrice = price;
    lastPriceAt = timestamp;
  }

  function onWsMsg(ev) {
    try {
      const d = ev.data;
      if (typeof d !== "string") return;

      wsMsgs++;

      if (
        ackCb &&
        /"name":"(option|position-changed|buyComplete|option-opened)"/.test(
          d.length > 600 ? d.slice(0, 600) : d
        )
      ) {
        ackCb();
      }

      const isC = d.indexOf("candle-generated") !== -1;
      const isQ = !isC && d.indexOf("quote-generated") !== -1;

      if (!isC && !isQ) return;

      const j = JSON.parse(d);
      const m = (j && j.msg) || j;

      if (!m) return;

      const id =
        m.active_id != null
          ? m.active_id
          : m.asset_id;

      if (id == null) return;

      let v = isC
        ? m.close
        : (
            m.value != null
              ? m.value
              : (
                  m.bid != null && m.ask != null
                    ? (+m.bid + +m.ask) / 2
                    : null
                )
          );

      v = +v;

      if (!isFinite(v) || v <= 0) return;

      const now = performance.now();
      const wallNow = Date.now();

      const a = wsAct[id] || (
        wsAct[id] = {
          p: 0,
          t: 0,
          c: 0,
          pc: 0,
          ws: now,
          minSize: 1e9,
          kind: "",
          hi: 0,
          lo: 0
        }
      );

      if (isC) {
        const sz = +m.size || 0;

        if (sz && sz < a.minSize)
          a.minSize = sz;

        if (sz && sz > a.minSize)
          return;

        a.kind = "c";
      } else if (a.kind === "c") {
        return;
      }

      a.p = v;
      a.t = now;
      a.c++;

      a.hi = a.hi
        ? Math.max(a.hi, v)
        : v;

      a.lo = a.lo
        ? Math.min(a.lo, v)
        : v;

      // OHLC local construido con precios observados por WebSocket.
      updateLocalBar(v, wallNow);

      if (now - a.ws > 10000) {
        a.pc = a.c;
        a.c = 0;
        a.ws = now;
      }

      wsQ++;
    } catch (e) {}
  }

  try {
    const NativeWS = window.WebSocket;

    if (NativeWS && !NativeWS.__iqtri) {
      const WS = function (url, protocols) {
        const ws =
          protocols !== undefined
            ? new NativeWS(url, protocols)
            : new NativeWS(url);

        try {
          ws.addEventListener("message", onWsMsg);
        } catch (e) {}

        return ws;
      };

      WS.prototype = NativeWS.prototype;

      [
        "CONNECTING",
        "OPEN",
        "CLOSING",
        "CLOSED"
      ].forEach(k => {
        WS[k] = NativeWS[k];
      });

      WS.__iqtri = true;
      window.WebSocket = WS;
    }
  } catch (e) {}

  function wsPrice() {
    const now = performance.now();

    let bestId = null;
    let bs = -1;

    for (const id in wsAct) {
      const a = wsAct[id];

      if (now - a.t > 3000) continue;

      const s = a.c + a.pc;

      if (s > bs) {
        bs = s;
        bestId = id;
      }
    }

    const cur =
      wsPickId != null
        ? wsAct[wsPickId]
        : null;

    const curOk =
      cur && now - cur.t <= 3000;

    if (
      !curOk ||
      (
        bestId != null &&
        bestId !== wsPickId &&
        bs > 2 * (cur.c + cur.pc) + 5
      )
    ) {
      if (bestId !== wsPickId) {
        wsPickId = bestId;
        assetChanged = true;
        localBar = null;
      }
    }

    const a =
      wsPickId != null
        ? wsAct[wsPickId]
        : null;

    if (!a || now - a.t > 3000)
      return null;

    const r = {
      p: a.p,
      hi: a.hi || a.p,
      lo: a.lo || a.p
    };

    a.hi = a.lo = a.p;

    const wallNow = Date.now();

    if (
      localBar &&
      localBar.start !==
        Math.floor(wallNow / BAR_MS) * BAR_MS
    ) {
      localBar = null;
    }

    if (!localBar)
      updateLocalBar(a.p, wallNow);

    if (localBar) {
      r.o = localBar.o;
      r.barHigh = localBar.h;
      r.barLow = localBar.l;
      r.barClose = localBar.c;
      r.barStart = localBar.start;
      r.barEnd = localBar.end;
      r.barTicks = localBar.ticks;
      r.barTimeframeMs = BAR_MS;
      r.barSource = "local-ws";
    }

    return r;
  }

  // =========================================================
  // PRECIO DOM
  // =========================================================
  let pxEl = null;
  let pxFindAt = 0;
  let priceSrc = "";

  const PX_RE = /^\d{1,3}[.,]\d{4,6}$/;

  function readPriceDom() {
    try {
      const norm = s =>
        (s || "").replace(
          /[\s\u200b-\u200f\u2060\ufeff]/g,
          ""
        );

      if (pxEl && pxEl.isConnected) {
        const t = norm(pxEl.textContent);

        if (PX_RE.test(t))
          return parseFloat(t.replace(",", "."));
      }

      const now = performance.now();

      if (now - pxFindAt < 1000)
        return null;

      pxFindAt = now;
      pxEl = null;

      const w = window.innerWidth;

      for (
        const el of document.querySelectorAll(
          "div,span,p,b,text,tspan"
        )
      ) {
        if (el.children.length > 6)
          continue;

        const raw = el.textContent;

        if (!raw || raw.length > 24)
          continue;

        const t = norm(raw);

        if (
          t.length < 6 ||
          t.length > 10 ||
          !PX_RE.test(t)
        ) {
          continue;
        }

        const r = el.getBoundingClientRect();

        if (
          r.width === 0 ||
          r.height === 0 ||
          r.left < w * 0.4
        ) {
          continue;
        }

        pxEl = el;

        return parseFloat(
          t.replace(",", ".")
        );
      }
    } catch (e) {}

    return null;
  }

  function readPrice() {
    const w = wsPrice();

    if (w) {
      priceSrc = "ws";
      return w;
    }

    const d = readPriceDom();

    if (d != null) {
      priceSrc = "dom";

      const now = Date.now();
      updateLocalBar(d, now);

      return {
        p: d,
        hi: d,
        lo: d,
        o: localBar ? localBar.o : d,
        barHigh: localBar ? localBar.h : d,
        barLow: localBar ? localBar.l : d,
        barClose: localBar ? localBar.c : d,
        barStart: localBar ? localBar.start : now,
        barEnd: localBar ? localBar.end : now + BAR_MS,
        barTicks: localBar ? localBar.ticks : 1,
        barTimeframeMs: BAR_MS,
        barSource: "local-dom"
      };
    }

    priceSrc = "";
    return null;
  }

  function getLocalOHLC() {
    if (!localBar) return null;

    return {
      open: localBar.o,
      high: localBar.h,
      low: localBar.l,
      close: localBar.c,
      start: localBar.start,
      end: localBar.end,
      ticks: localBar.ticks,
      timeframeMs: BAR_MS,
      source: "local-ticks"
    };
  }

  // =========================================================
  // CALIBRACIÓN Y LUTS DE COLOR
  // =========================================================
  let calUp = loadCal("iqtri_up");
  let calDn = loadCal("iqtri_dn");
  let calMode = null;
  let calVer = 1;

  const clearCal = () => {
    try {
      localStorage.removeItem("iqtri_up");
      localStorage.removeItem("iqtri_dn");
    } catch (e) {}

    calUp = calDn = null;
    calVer++;
  };

  function rgb2hsv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    if (max === 0 || d === 0)
      return null;

    let h;

    if (max === r)
      h = ((g - b) / d + 6) % 6;
    else if (max === g)
      h = (b - r) / d + 2;
    else
      h = (r - g) / d + 4;

    return {
      h: h * 60,
      s: d / max,
      v: max / 255
    };
  }

  function classifyTri(r, g, b) {
    const c = rgb2hsv(r, g, b);

    if (!c || c.s < 0.55)
      return 0;

    if (
      (c.h < 18 || c.h > 340) &&
      c.v > 0.3 &&
      c.v < 0.78
    ) {
      return 1;
    }

    if (
      c.h > 95 &&
      c.h < 145 &&
      c.v > 0.2 &&
      c.v < 0.55
    ) {
      return 2;
    }

    return 0;
  }

  const near = (r, g, b, c, t) => {
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;

    return dr * dr + dg * dg + db * db < t * t;
  };

  function lineClass(r, g, b) {
    const t = CFG.tol;

    if (calUp && near(r, g, b, calUp, t))
      return 1;

    if (calDn && near(r, g, b, calDn, t))
      return 2;

    const c = rgb2hsv(r, g, b);

    if (!c) return 0;

    if (
      !calUp &&
      c.h >= 15 &&
      c.h <= 45 &&
      c.s > 0.6 &&
      c.v > 0.55
    ) {
      return 1;
    }

    if (
      !calDn &&
      c.h >= 190 &&
      c.h <= 225 &&
      c.s > 0.35 &&
      c.v > 0.55
    ) {
      return 2;
    }

    return 0;
  }

  const LUT = new Uint8Array(32768);
  const lineLUT = new Uint8Array(32768);

  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        LUT[
          (r << 10) | (g << 5) | b
        ] = classifyTri(
          r * 8 + 4,
          g * 8 + 4,
          b * 8 + 4
        );
      }
    }
  }

  let lutVer = 0;

  function buildLineLUT() {
    if (lutVer === calVer)
      return;

    lutVer = calVer;

    for (let r = 0; r < 32; r++) {
      for (let g = 0; g < 32; g++) {
        for (let b = 0; b < 32; b++) {
          lineLUT[
            (r << 10) | (g << 5) | b
          ] = lineClass(
            r * 8 + 4,
            g * 8 + 4,
            b * 8 + 4
          );
        }
      }
    }
  }

  // =========================================================
  // CAPTURA CANVAS
  // =========================================================
  let off = null;
  let offCtx = null;
  let canvasCache = [];
  let canvasCacheAt = 0;

  let maskBuf = new Uint8Array(0);
  let stackBuf = new Int32Array(0);
  let lineBuf = new Uint8Array(0);
  let cU = new Uint16Array(0);
  let cD = new Uint16Array(0);

  let diag = "";
  let lineStat = "";

  function getCanvases() {
    const now = performance.now();

    if (
      now - canvasCacheAt > 1000 ||
      canvasCache.some(c => !c.isConnected)
    ) {
      canvasCache = [
        ...document.querySelectorAll("canvas")
      ].filter(
        c => c.width > 200 && c.height > 200
      );

      canvasCacheAt = now;
    }

    return canvasCache;
  }

  function snapshot() {
    const cs = getCanvases();

    if (!cs.length) {
      diag = "canvas:0";
      return null;
    }

    const big = cs.reduce(
      (a, b) =>
        b.width * b.height > a.width * a.height
          ? b
          : a
    );

    const k = CFG.width / big.width;
    const H = Math.round(big.height * k);

    const dx0 = Math.floor(
      CFG.width * CFG.scanFrom
    );

    const dw =
      Math.floor(CFG.width * CFG.xMax) - dx0;

    if (!off) {
      off = document.createElement("canvas");
      offCtx = off.getContext(
        "2d",
        { willReadFrequently: true }
      );
    }

    if (
      off.width !== dw ||
      off.height !== H
    ) {
      off.width = dw;
      off.height = H;
    }

    offCtx.clearRect(0, 0, dw, H);

    for (const c of cs) {
      try {
        offCtx.drawImage(
          c,
          dx0 / k,
          0,
          dw / k,
          H / k,
          0,
          0,
          dw,
          H
        );
      } catch (e) {}
    }

    const img = offCtx.getImageData(
      0, 0, dw, H
    );

    img.ox = dx0;

    diag =
      `canvas:${cs.length} ` +
      `${big.width}x${big.height}`;

    return img;
  }

  function sampleAt(cx, cy) {
    const cs = getCanvases();

    if (!cs.length) {
      calMode = null;
      return "cal: sin canvas";
    }

    const big = cs.reduce(
      (a, b) =>
        b.width * b.height > a.width * a.height
          ? b
          : a
    );

    const r = big.getBoundingClientRect();

    const px0 = Math.round(
      (cx - r.left) * big.width / r.width
    );

    const py0 = Math.round(
      (cy - r.top) * big.height / r.height
    );

    const R = 6;
    const x0 = Math.max(0, px0 - R);
    const y0 = Math.max(0, py0 - R);

    const w = Math.min(
      big.width - x0,
      2 * R + 1
    );

    const h = Math.min(
      big.height - y0,
      2 * R + 1
    );

    if (w <= 0 || h <= 0) {
      calMode = null;
      return "cal: toque fuera del gráfico";
    }

    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;

    const tc = t.getContext(
      "2d",
      { willReadFrequently: true }
    );

    for (const c of cs) {
      try {
        tc.drawImage(
          c,
          x0,
          y0,
          w,
          h,
          0,
          0,
          w,
          h
        );
      } catch (e) {}
    }

    let d;

    try {
      d = tc.getImageData(0, 0, w, h).data;
    } catch (e) {
      calMode = null;
      return "cal: el gráfico no permite leer colores";
    }

    let best = null;
    let bestScore = 0;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;

      const c = rgb2hsv(
        d[i],
        d[i + 1],
        d[i + 2]
      );

      if (!c || c.s < 0.5)
        continue;

      const score = c.s * c.v;

      if (score > bestScore) {
        bestScore = score;
        best = {
          r: d[i],
          g: d[i + 1],
          b: d[i + 2]
        };
      }
    }

    if (!best) {
      calMode = null;
      return "cal: no vi color, toca más cerca";
    }

    const modeWas = calMode;

    if (calMode === "U") {
      calUp = best;
      saveCal("iqtri_up", best);
    } else {
      calDn = best;
      saveCal("iqtri_dn", best);
    }

    calVer++;
    calMode = null;

    return (
      `cal ${modeWas === "U" ? "▲ SUBE" : "▼ BAJA"}: ` +
      `rgb(${best.r},${best.g},${best.b})`
    );
  }

  // =========================================================
  // DETECCIÓN DE TRIÁNGULOS
  // =========================================================
  function findTriangles(img) {
    const {
      width: W,
      height: H,
      data,
      ox
    } = img;

    const N = W * H;

    if (maskBuf.length < N) {
      maskBuf = new Uint8Array(N);
      stackBuf = new Int32Array(N);
    }

    const mask = maskBuf;
    const stack = stackBuf;

    mask.fill(0, 0, N);

    for (
      let p = 0, i = 0;
      p < N;
      p++, i += 4
    ) {
      if (data[i + 3] > 200) {
        mask[p] = LUT[
          ((data[i] >> 3) << 10) |
          ((data[i + 1] >> 3) << 5) |
          (data[i + 2] >> 3)
        ];
      }
    }

    const down = [];
    const up = [];

    for (let p0 = 0; p0 < N; p0++) {
      const cls = mask[p0];

      if (cls === 0 || cls > 2)
        continue;

      const done = cls + 2;

      let sp = 0;
      let area = 0;
      let minX = W;
      let maxX = 0;
      let minY = H;
      let maxY = 0;

      stack[sp++] = p0;
      mask[p0] = done;

      while (sp) {
        const q = stack[--sp];
        const cx = q % W;
        const cy = (q / W) | 0;

        area++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        let n;

        if (cx < W - 1) {
          n = q + 1;

          if (mask[n] === cls) {
            mask[n] = done;
            stack[sp++] = n;
          }
        }

        if (cx > 0) {
          n = q - 1;

          if (mask[n] === cls) {
            mask[n] = done;
            stack[sp++] = n;
          }
        }

        if (cy < H - 1) {
          n = q + W;

          if (mask[n] === cls) {
            mask[n] = done;
            stack[sp++] = n;
          }
        }

        if (cy > 0) {
          n = q - W;

          if (mask[n] === cls) {
            mask[n] = done;
            stack[sp++] = n;
          }
        }
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const fill = area / (w * h);
      const ratio = w / h;

      if (
        area >= CFG.minArea &&
        fill > 0.3 &&
        fill < 0.8 &&
        ratio > 0.6 &&
        ratio < 2.6
      ) {
        (cls === 1 ? down : up).push({
          x: ox + minX + w / 2,
          y: minY + h / 2
        });
      }
    }

    return { down, up };
  }

  const fresh = (list, before) =>
    list.filter(t =>
      !before.some(
        p =>
          p.x >= t.x - 4 &&
          p.x <= t.x + 30
      )
    );

  // =========================================================
  // ZIGZAG ORIGINAL
  // =========================================================
  function findLastLeg(img) {
    buildLineLUT();

    const {
      width: W,
      height: H,
      data
    } = img;

    const N = W * H;

    if (lineBuf.length < N)
      lineBuf = new Uint8Array(N);

    if (cU.length < W) {
      cU = new Uint16Array(W);
      cD = new Uint16Array(W);
    }

    cU.fill(0, 0, W);
    cD.fill(0, 0, W);

    let totU = 0;
    let totD = 0;

    for (let y = 0, p = 0; y < H; y++) {
      for (let x = 0; x < W; x++, p++) {
        const i = p << 2;

        if (data[i + 3] <= 200)
          continue;

        const c = lineLUT[
          ((data[i] >> 3) << 10) |
          ((data[i + 1] >> 3) << 5) |
          (data[i + 2] >> 3)
        ];

        if (c === 1) {
          cU[x]++;
          totU++;
        } else if (c === 2) {
          cD[x]++;
          totD++;
        }
      }
    }

    lineStat =
      `px ▲:${totU} ▼:${totD}` +
      `${calUp ? " calUp" : ""}` +
      `${calDn ? " calDn" : ""}`;

    let u = 0;
    let d = 0;

    for (
      let x = W - 1;
      x >= 0 && u + d < CFG.tailPx;
      x--
    ) {
      u += cU[x];
      d += cD[x];
    }

    if (
      u + d < CFG.minTailPx ||
      u === d
    ) {
      return null;
    }

    return {
      dir: u > d ? 1 : -1
    };
  }

  // =========================================================
  // EXPORTACIONES
  // =========================================================
  window.PLEX_MOD.vision = {
    getWsStats: () => ({
      wsMsgs,
      wsQ,
      priceSrc,
      diag,
      lineStat,
      asset: wsPickId,
      lastPrice,
      lastPriceAt
    }),

    isAssetChanged: () => {
      const c = assetChanged;
      assetChanged = false;
      return c;
    },

    setAckCb: cb => {
      ackCb = cb;
    },

    getAckCb: () => ackCb,

    readPrice,
    getLocalOHLC,
    snapshot,
    findTriangles,
    fresh,
    findLastLeg,

    getCalMode: () => calMode,

    setCalMode: m => {
      calMode = m;
    },

    clearCal,
    sampleAt
  };
})();
