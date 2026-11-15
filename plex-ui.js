// PLEX v5.5 - Módulo 4: Interfaz Gráfica, Panel Flotante y Gráficas
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const { CFG, PAT_DIR, PATN, SRCN, TRN2, POSN2, loadCal, saveCal, dirWord, hhmmss, jExport, unlockAudio, playSound } = window.PLEX_MOD.config;
  const vision = window.PLEX_MOD.vision;
  const brain = window.PLEX_MOD.brain;

  const ui = Object.assign({ open: false, x: 4, y: 108 }, loadCal("iqtri_ui") || {});
  if (ui.sound === false) CFG.sound = false;

  const GREEN = "#3ddc84", RED = "#ff5c5c", AMBER = "#ffc857", BLUE = "#5cc8ff";
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const el = (tag, css, parent, txt) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  };

  const box = el("div", `position:fixed;left:${ui.x}px;top:${ui.y}px;z-index:2147483647;font:10px monospace;`);
  const head = el("div", "display:inline-block;background:rgba(0,0,0,.65);color:#0f0;padding:3px 6px;border-radius:6px;white-space:pre;" +
    "touch-action:none;user-select:none;-webkit-user-select:none;line-height:1.3;border:1px solid rgba(255,255,255,.15)", box);

  const body = el("div", "display:none;margin-top:3px;width:300px;max-width:96vw;font-size:11px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:rgba(8,12,20,.94);" +
    "border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px;color:#cfe;box-sizing:border-box", box);

  const tabsBar = el("div", "display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:6px", body);
  const panes = [], tabBtns = [];
  let renderFn = () => {};

  const setTab = i => {
    ui.tab = i;
    panes.forEach((pn, j) => { pn.style.display = j === i ? "block" : "none"; });
    tabBtns.forEach((bt, j) => { bt.style.background = j === i ? "#2a3a58" : "#141c2a"; bt.style.color = j === i ? "#fff" : "#8aa"; });
    saveCal("iqtri_ui", ui);
    body.scrollTop = 0;
  };

  ["📊 Resumen", "📰 En vivo", "🧠 Aprende", "⚙️ Ajustes"].forEach((t, i) => {
    const bt = el("button", "border:0;border-radius:8px;font:10px monospace;padding:8px 0;background:#141c2a;color:#8aa;white-space:nowrap;overflow:hidden", tabsBar, t);
    bt.addEventListener("click", e => { e.stopPropagation(); setTab(i); renderFn(); });
    tabBtns.push(bt);
    panes.push(el("div", "", body));
  });

  const sec = (pn, t) => el("div", "margin:7px 0 2px;color:#9ab;font-weight:bold", pn, t);
  const CARD = "background:#141c2a;border-radius:8px;padding:6px 8px;line-height:1.45";

  // Pestaña 1: Resumen
  const chips = el("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:4px", panes[0]);
  const banner = el("div", "margin-top:5px;padding:5px 7px;border-radius:8px;background:#141c2a;line-height:1.35", panes[0]);
  sec(panes[0], "📈 Estructura del precio");
  const cvBars = el("canvas", "width:100%;height:72px;border-radius:6px;display:block", panes[0]);
  cvBars.width = 280; cvBars.height = 72;
  const barsNote = el("div", "color:#8aa;margin-top:2px;line-height:1.3", panes[0]);
  sec(panes[0], "💰 Resultado de entradas");
  const cvPL = el("canvas", "width:100%;height:36px;border-radius:6px;display:block", panes[0]);
  cvPL.width = 280; cvPL.height = 36;
  sec(panes[0], "📝 Resumen de la sesión");
  const sumBox = el("div", CARD, panes[0]);
  const det = el("details", "margin-top:8px", panes[0]);
  el("summary", "color:#9ab;padding:4px 0", det, "🔧 Detalles técnicos");
  const stat = el("div", "margin-top:3px;white-space:pre-wrap;line-height:1.3;color:#9fc", det);

  // Pestaña 2: En vivo
  sec(panes[1], "👀 Ahora mismo");
  const nowBox = el("div", CARD, panes[1]);
  sec(panes[1], "🎯 Por qué entré (última entrada)");
  const whyBox = el("div", CARD, panes[1]);
  sec(panes[1], "📰 Qué ha pasado");
  const feed = el("div", "line-height:1.4", panes[1]);

  // Pestaña 3: Aprende (diseño compacto)
  sec(panes[2], "🧠 Aprende");
  const seenBox = el("div", "display:flex;flex-wrap:wrap;gap:3px;margin-bottom:7px", panes[2]);
  sec(panes[2], "📊 Rendimiento");
  const tbl = el("div", "", panes[2]);

  // Pestaña 4: Ajustes
  const btns = el("div", "display:grid;grid-template-columns:1fr 1fr;gap:5px", panes[3]);
  const mk = (txt, fn) => {
    const bt = el("button", "background:#1d2535;color:#fff;border:1px solid #4a5670;border-radius:8px;font:11px monospace;padding:9px 3px;width:100%", btns, txt);
    bt.addEventListener("click", e => { e.stopPropagation(); fn(bt); });
    return bt;
  };

  let sndBtn = null, headTxt = "";

  function setupButtons(actions) {
    mk("🔽 Probar baja", () => actions.doTrade("LOWER", true));
    mk("🔼 Probar sube", () => actions.doTrade("HIGHER", true));
    mk("🔔 Probar sonido", () => { unlockAudio(); playSound("HIGHER"); });
    sndBtn = mk("🔊 Sonido " + (CFG.sound ? "✓" : "✗"), () => {
      CFG.sound = !CFG.sound;
      ui.sound = CFG.sound;
      saveCal("iqtri_ui", ui);
      if (sndBtn) sndBtn.textContent = "🔊 Sonido " + (CFG.sound ? "✓" : "✗");
      if (CFG.sound) { unlockAudio(); playSound("HIGHER"); }
      actions.setLastEvent(CFG.sound ? "sonido activado" : "sonido desactivado");
    });
    mk("⬇ Exportar CSV", () => jExport(actions.setLastEvent));
    mk("🎨 Cal ▲", () => { vision.setCalMode("U"); actions.setLastEvent("toca un tramo que SUBE"); });
    mk("🎨 Cal ▼", () => { vision.setCalMode("D"); actions.setLastEvent("toca un tramo que BAJA"); });
    mk("🧹 Borrar cal", () => { vision.clearCal(); vision.setCalMode(null); actions.setLastEvent("calibración borrada"); });
    mk("🗑 Reiniciar RL", () => { brain.resetRL(); actions.setLastEvent("RL: aprendizaje borrado"); });
    mk("🎯 Zonas " + (CFG.zoneVary ? "✓" : "✗"), bt => { CFG.zoneVary = !CFG.zoneVary; bt.textContent = "🎯 Zonas " + (CFG.zoneVary ? "✓" : "✗"); });
    mk("🧩 Patrones " + (CFG.usePatterns ? "✓" : "✗"), bt => { CFG.usePatterns = !CFG.usePatterns; bt.textContent = "🧩 Patrones " + (CFG.usePatterns ? "✓" : "✗"); });
    setTab(ui.tab >= 0 && ui.tab < 4 ? ui.tab : 0);
  }

  function fitBody() {
    const h = window.innerHeight - box.offsetTop - head.offsetHeight - 14;
    body.style.maxHeight = Math.max(160, h) + "px";
  }
  window.addEventListener("resize", fitBody);

  const applyOpen = () => {
    body.style.display = ui.open ? "block" : "none";
    if (ui.open) { fitBody(); renderFn(); }
  };

  let drag = null;
  head.addEventListener("pointerdown", e => {
    drag = { sx: e.clientX, sy: e.clientY, bx: box.offsetLeft, by: box.offsetTop, moved: false };
    try { head.setPointerCapture(e.pointerId); } catch (err) {}
  });
  head.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    ui.x = Math.max(0, Math.min(window.innerWidth - 60, drag.bx + dx));
    ui.y = Math.max(0, Math.min(window.innerHeight - 40, drag.by + dy));
    box.style.left = ui.x + "px";
    box.style.top = ui.y + "px";
    if (ui.open) fitBody();
  });
  head.addEventListener("pointerup", () => {
    if (!drag) return;
    if (!drag.moved) { ui.open = !ui.open; applyOpen(); }
    saveCal("iqtri_ui", ui);
    drag = null;
  });
  head.addEventListener("pointercancel", () => { drag = null; });

  const attach = () => document.documentElement && !box.isConnected && document.documentElement.appendChild(box);
  attach();
  document.addEventListener("DOMContentLoaded", attach);

  function drawBars(S, bars, curBar) {
    const g = cvBars.getContext("2d"), W = cvBars.width, H = cvBars.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#0b111b"; g.fillRect(0, 0, W, H);
    g.font = "11px monospace";
    const all = curBar ? bars.concat([curBar]) : bars.slice();
    const N = Math.min(all.length, 40);
    if (N < 3) { g.fillStyle = "#789"; g.fillText("Reuniendo barras… " + all.length + "/7", 10, 22); return; }
    const off0 = all.length - N, v = all.slice(off0);
    let hi = -1e9, lo = 1e9;
    for (const b of v) { if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l; }
    const rg = (hi - lo) || 1e-6, bw = W / N;
    const y = p => H - 8 - (p - lo) / rg * (H - 22);
    g.setLineDash([3, 3]);
    const lastH = S.swH[S.swH.length - 1], lastL = S.swL[S.swL.length - 1];
    if (lastH) { g.strokeStyle = AMBER; g.beginPath(); g.moveTo(0, y(lastH.p)); g.lineTo(W, y(lastH.p)); g.stroke(); }
    if (lastL) { g.strokeStyle = BLUE; g.beginPath(); g.moveTo(0, y(lastL.p)); g.lineTo(W, y(lastL.p)); g.stroke(); }
    g.setLineDash([]);
    v.forEach((b, i) => {
      const x = i * bw + bw / 2, col = b.c >= b.o ? GREEN : RED;
      g.strokeStyle = g.fillStyle = col;
      g.beginPath(); g.moveTo(x, y(b.h)); g.lineTo(x, y(b.l)); g.stroke();
      g.fillRect(x - bw * 0.3, y(Math.max(b.o, b.c)), bw * 0.6, Math.max(1, Math.abs(y(b.o) - y(b.c))));
    });
    g.fillStyle = AMBER;
    for (const s2 of S.swH) { const i = s2.i - off0; if (i >= 0) g.fillRect(i * bw + bw / 2 - 2, y(s2.p) - 6, 4, 3); }
    g.fillStyle = BLUE;
    for (const s2 of S.swL) { const i = s2.i - off0; if (i >= 0) g.fillRect(i * bw + bw / 2 - 2, y(s2.p) + 3, 4, 3); }
  }

  function drawPL(hist) {
    const g = cvPL.getContext("2d"), W = cvPL.width, H = cvPL.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#0b111b"; g.fillRect(0, 0, W, H);
    g.font = "11px monospace";
    if (hist.length < 2) { g.fillStyle = "#789"; g.fillText("Aún sin entradas evaluadas", 10, 26); return; }
    const cum = []; let t = 0;
    for (const r of hist) { t += r; cum.push(t); }
    let mn = Math.min(0, ...cum), mx = Math.max(0, ...cum);
    if (mx === mn) mx = mn + 1;
    const y = v => H - 5 - (v - mn) / (mx - mn) * (H - 10);
    g.strokeStyle = "#345"; g.beginPath(); g.moveTo(0, y(0)); g.lineTo(W, y(0)); g.stroke();
    g.strokeStyle = t >= 0 ? GREEN : RED; g.lineWidth = 1.5; g.beginPath();
    cum.forEach((v, i) => { const x = i / (cum.length - 1) * (W - 2) + 1; if (i) g.lineTo(x, y(v)); else g.moveTo(x, y(v)); });
    g.stroke(); g.lineWidth = 1;
  }

  function paintHeader(demo, o, zzHead, tradeCount, lastTradeShort, rlTagStr, lastSay) {
    try {
      const lock = o.length ? ` 🔒${o[0].dir === "HIGHER" ? "▲" : "▼"}${o.length}` : "";
      const t = `${zzHead}  ${demo ? "DEMO" : "REAL"}${lock}\n#${tradeCount} ${lastTradeShort || "sin entradas"}${rlTagStr}${lastSay ? "\n💬 " + lastSay.slice(0, 40) : ""}`;
      if (t !== headTxt) { headTxt = t; head.textContent = t; }
      head.style.color = demo ? "#0f0" : "#f55";
    } catch (e) {}
  }

  function initDashboard(getCtxData) {
    renderFn = () => {
      try {
        const d = getCtxData();
        const rl = brain.getRL();
        const { S, bars, curBar, cdlNow } = brain.getState();
        const { wsMsgs, wsQ, priceSrc } = vision.getWsStats();
        const tab = ui.tab || 0, b = d.be, p = d.curPrice, x = d.execStats;

        if (tab === 0) {
          const card = (v, l, c) => `<div style="background:#141c2a;border-radius:8px;padding:4px 2px;text-align:center">` +
            `<div style="font-size:13px;font-weight:bold;color:${c}">${v}</div><div style="color:#8aa;font-size:9px;margin-top:1px">${l}</div></div>`;
          chips.innerHTML =
            card(x.win == null ? "–" : (x.win * 100).toFixed(0) + "%", `Aciertos bot (${x.n})`, x.win == null ? "#cfe" : x.win > b ? GREEN : RED) +
            card((rl.pl >= 0 ? "+" : "") + rl.pl.toFixed(2), "Ganancia", rl.pl >= 0 ? GREEN : RED) +
            card(String(rl.total), rl.total < CFG.rlWarmup ? "Eval /" + CFG.rlWarmup : "Evaluadas", "#cfe") +
            card(rl.usr && rl.usr.n ? `${Math.round(100 * rl.usr.w / rl.usr.n)}%` : "0%", `Tus manuales (${rl.usr ? rl.usr.n : 0})`, rl.usr && rl.usr.n && (rl.usr.w / rl.usr.n) > b ? GREEN : AMBER) +
            card(p == null ? "—" : String(p), p == null ? "Sin precio" : "Precio (" + priceSrc + ")", p == null ? RED : "#cfe") +
            card(S.trend === "U" ? "▲ Alcista" : S.trend === "D" ? "▼ Bajista" : "↔ Lateral", "Tendencia", S.trend === "U" ? GREEN : S.trend === "D" ? RED : AMBER);

          const o = d.openTrades, now = Date.now();
          let st;
          if (!CFG.rl) st = "⚪ Aprendizaje apagado";
          else if (p == null) st = `🔴 Sin precio: esperando datos (ws ${wsMsgs}/${wsQ})`;
          else if (d.isPaused) st = "⏸ En pausa: tocaste la pantalla";
          else if (rl.total < CFG.rlWarmup) st = `🟡 Aprendiendo (${rl.total}/${CFG.rlWarmup}). Opera normal mientras reúne datos`;
          else st = "🟢 Filtrando entradas con lo aprendido";
          const ver = (x.win != null && x.n >= 10) ? (x.win > b ? "<br>👍 Bot por encima del mínimo" : "<br>⚠️ Bot por debajo del mínimo") : "";
          const usrStat = rl.usr && rl.usr.n ? `<br>👤 Tus clics: ${rl.usr.n} operadas (✅${rl.usr.w} ❌${rl.usr.l})` : "<br>👤 Tus clics: Ninguna registrada todavía (haz clics manuales para entrenar al bot).";
          const op = o.length ? "<br>🔒 Abiertas: " + o.map(t => `${t.dir === "HIGHER" ? "▲" : "▼"}${Math.max(0, Math.ceil((t.until - now) / 1000))}s`).join(" ") : "";
          banner.innerHTML = st + usrStat + ver + op + (d.lastEvent ? `<br><span style="color:#8aa">Último: ${esc(d.lastEvent)}</span>` : "");

          drawBars(S, bars, curBar);
          barsNote.innerHTML = (bars.length < 7 ? "Reuniendo barras para analizar…" :
            `Tendencia ${TRN2[S.trend]}, precio en zona ${POSN2[S.pos]}. ` +
            (S.pat !== "NONE" ? `Patrón: <b>${PATN[S.pat]}</b> (${dirWord(PAT_DIR[S.pat])}).` : "Sin patrón activo.")) +
            "<br>🟧 máx · 🟦 mín";
          drawPL(rl.hist);

          const m = Math.round((Date.now() - d.sess.t0) / 60000), dec = d.sess.win + d.sess.loss;
          let h = `Hace ${m} min: <b>${d.sess.signals}</b> señales vistas y <b>${d.sess.trades}</b> entradas bot` +
            (dec ? ` (✅ ${d.sess.win} · ❌ ${d.sess.loss} · ${Math.round(100 * d.sess.win / dec)}%)` : "") + ".";
          if (rl.usr && rl.usr.n) {
            const usWin = Math.round(100 * rl.usr.w / rl.usr.n);
            h += `<br>👤 <b>Tus operaciones manuales:</b> ${rl.usr.n} (✅ ${rl.usr.w} · ❌ ${rl.usr.l} · ${usWin}%). El bot aprende activamente de ellas.`;
          } else {
            h += `<br>👤 <b>Tus operaciones manuales:</b> Ninguna registrada aún. Haz clics manuales para que el bot aprenda de ti.`;
          }
          const ks = Object.keys(d.sess.bySrc);
          if (ks.length) h += "<br>Por origen (ganadas/total): " + ks.map(k => `${k} ${d.sess.bySrc[k].w}/${d.sess.bySrc[k].n}`).join(" · ");
          h += `<br>Omitidas: ${d.sess.skipRL} por lo aprendido, ${d.sess.skipOpp} por sentido contrario, ${d.sess.skipPause} por tocar la pantalla.`;
          const top = Object.keys(rl.seen).sort((a, c) => rl.seen[c] - rl.seen[a]).slice(0, 3);
          if (top.length) h += "<br>Más frecuentes: " + top.map(k => `${PATN[k] || k} ×${rl.seen[k]}`).join(", ") + ".";
          sumBox.innerHTML = h;
          stat.textContent = d.fullText + "\n" + (d.rlLast ? d.rlLast + "\n" : "");

        } else if (tab === 1) {
          const L = [];
          if (p == null) L.push("🔴 Sin precio: esperando datos del mercado.");
          else {
            L.push(`💹 Precio <b>${p.toFixed(5)}</b>` + (curBar && S.atr ? ` · vela actual ${curBar.c >= curBar.o ? "verde" : "roja"} (${(Math.abs(curBar.c - curBar.o) / S.atr).toFixed(1)}× el rango medio)` : ""));
            if (bars.length < 7) L.push(`⏳ Reuniendo barras (${bars.length}/7) para analizar la estructura.`);
            else {
              L.push(`📐 Tendencia <b>${TRN2[S.trend]}</b>, precio en zona ${POSN2[S.pos]} del rango.`);
              L.push(S.pat !== "NONE" ? `🧩 Patrón activo: <b>${PATN[S.pat]}</b> → sugiere ${dirWord(PAT_DIR[S.pat])}.` : "🧩 Sin patrón de acción de precio activo.");
              L.push(cdlNow.names.length ? `🕯 Última vela (${cdlNow.color}): <b>${cdlNow.names.map(n => PATN[n]).join(" + ")}</b>.` : `🕯 Última vela ${cdlNow.color || "–"}: sin patrón.`);
            }
            L.push("🔀 " + esc(d.crossInfo));
            const o = d.openTrades, now = Date.now();
            L.push(o.length ? "🔒 Operación abierta: " + o.map(t => `${t.dir === "HIGHER" ? "▲" : "▼"} ${Math.max(0, Math.ceil((t.until - now) / 1000))}s`).join(" ") : "🎯 Sin operación abierta: esperando señal.");
            L.push(!CFG.rl ? "⚪ Aprendizaje apagado." : rl.total < CFG.rlWarmup ? `🟡 Aprendiendo (${rl.total}/${CFG.rlWarmup}): opera sin filtro.` : "🟢 Filtrando entradas con lo aprendido.");
          }
          nowBox.innerHTML = L.join("<br>");

          if (!d.lastWhy) whyBox.innerHTML = `<span style="color:#789">Aún no ha entrado ninguna operación.</span>`;
          else {
            const w = d.lastWhy, r = w.result;
            whyBox.innerHTML = `<b>${w.dir === "HIGHER" ? "▲" : "▼"} ${esc(w.title)}</b> <span style="color:#8aa">${hhmmss(w.t)}</span><br>` +
              w.lines.map(l => "• " + esc(l)).join("<br>") +
              (r ? `<br>${r.icon} <b>${esc(r.text)}</b>` : "<br>⏳ esperando el resultado…");
          }

          feed.innerHTML = d.story.length ? d.story.slice(0, 25).map(e =>
            `<div style="margin:3px 0"><span style="color:#789">${hhmmss(e.t)}</span> ${e.icon} ${esc(e.text)}</div>`).join("")
            : `<div style="color:#789">Sin eventos todavía…</div>`;

        } else if (tab === 2) {
          const sk = Object.keys(rl.seen).sort((a, c) => rl.seen[c] - rl.seen[a]);
          seenBox.innerHTML = sk.length
            ? sk.map(k => `<span title="${PATN[k] || k}" style="background:#141c2a;border:1px solid #29364a;border-radius:5px;padding:2px 5px;font-size:10px;white-space:nowrap">${PATN[k] || k} <b>×${rl.seen[k]}</b></span>`).join("")
            : `<span style="color:#789;font-size:11px">👀 Sin patrones todavía</span>`;
          const rows = Object.keys(rl.Q).filter(k => k.split("|").length >= 2 && rl.Q[k].N > 0)
            .sort((a, c) => rl.Q[c].N - rl.Q[a].N).slice(0, 14);
          tbl.innerHTML = rows.length ? rows.map(k => {
            const parts = k.split("|"), sc = parts[0], pt = parts[1], e = rl.Q[k], w = e.W / e.N;
            let col, icon, label;
            const us = sc === "USR";
            if (e.N < (us ? CFG.usrMinN : CFG.rlMinN)) { col = "#789"; icon = "⏳"; label = "Pocos datos"; }
            else if (w > b) { col = GREEN; icon = "✅"; label = us ? "Te funciona" : "Seguir"; }
            else if (1 - w > b) { col = AMBER; icon = "🔄"; label = "Invertir"; }
            else { col = RED; icon = "⛔"; label = us ? "No rinde" : "Evitar"; }
            const sourceName = us ? "👤" : (SRCN[sc] || sc);
            return `<div style="background:#111a27;border:1px solid #253247;border-radius:6px;padding:5px 7px;margin:4px 0">` +
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px"><span><b>${sourceName}</b> · ${PATN[pt] || pt}</span><span style="color:${col};white-space:nowrap">${icon} ${label}</span></div>` +
              `<div style="display:flex;align-items:center;gap:6px;margin-top:4px"><div style="position:relative;flex:1;height:5px;background:#1b2433;border-radius:4px;overflow:visible"><div style="width:${(w * 100).toFixed(0)}%;height:100%;background:${col};border-radius:4px"></div><div style="position:absolute;left:${(b * 100).toFixed(1)}%;top:-2px;width:1px;height:9px;background:#fff"></div></div><b style="font-size:10px;color:${col};min-width:32px;text-align:right">${(w * 100).toFixed(0)}%</b><span style="font-size:10px;color:#8aa;white-space:nowrap">n=${e.N}</span></div></div>`;
          }).join("") + `<div style="color:#789;font-size:10px;margin-top:4px">⚪ Mínimo requerido · 👤 Operaciones manuales</div>`
            : `<div style="color:#789;font-size:11px">📚 Aún sin datos. Opera o deja correr PLEX.</div>`;
        }
      } catch (e) {}
    };
    setInterval(() => { if (ui.open) renderFn(); }, 400);
    applyOpen();
  }

  window.PLEX_MOD.ui = {
    box, setupButtons, paintHeader, initDashboard
  };
})();