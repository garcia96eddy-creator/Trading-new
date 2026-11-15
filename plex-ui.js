// PLEX v5.6 - Módulo 4: Interfaz Gráfica, Panel Flotante y Gráficas
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const {
    CFG, PAT_DIR, PATN, SRCN, TRN2, POSN2,
    loadCal, saveCal, dirWord, hhmmss,
    jExport, unlockAudio, playSound
  } = window.PLEX_MOD.config;

  const vision = window.PLEX_MOD.vision;
  const brain = window.PLEX_MOD.brain;

  const ui = Object.assign(
    { open: false, x: 4, y: 108 },
    loadCal("iqtri_ui") || {}
  );

  if (ui.sound === false) CFG.sound = false;

  const GREEN = "#3ddc84";
  const RED = "#ff5c5c";
  const AMBER = "#ffc857";
  const BLUE = "#5cc8ff";

  const esc = t => String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const el = (tag, css, parent, txt) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  };

  const box = el(
    "div",
    `position:fixed;left:${ui.x}px;top:${ui.y}px;z-index:2147483647;font:10px monospace;`
  );

  const head = el(
    "div",
    "display:inline-block;background:rgba(0,0,0,.65);color:#0f0;padding:3px 6px;border-radius:6px;white-space:pre;" +
    "touch-action:none;user-select:none;-webkit-user-select:none;line-height:1.3;border:1px solid rgba(255,255,255,.15)",
    box
  );

  const body = el(
    "div",
    "display:none;margin-top:3px;width:300px;max-width:96vw;font-size:11px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:rgba(8,12,20,.94);" +
    "border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px;color:#cfe;box-sizing:border-box",
    box
  );

  const tabsBar = el(
    "div",
    "display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:6px",
    body
  );

  const panes = [];
  const tabBtns = [];

  let renderFn = () => {};

  const setTab = i => {
    ui.tab = i;

    panes.forEach((pn, j) => {
      pn.style.display = j === i ? "block" : "none";
    });

    tabBtns.forEach((bt, j) => {
      bt.style.background = j === i ? "#2a3a58" : "#141c2a";
      bt.style.color = j === i ? "#fff" : "#8aa";
    });

    saveCal("iqtri_ui", ui);
    body.scrollTop = 0;
  };

  ["📊 Resumen", "📰 En vivo", "🧠 Aprende", "⚙️ Ajustes"].forEach((t, i) => {
    const bt = el(
      "button",
      "border:0;border-radius:8px;font:10px monospace;padding:8px 0;background:#141c2a;color:#8aa;white-space:nowrap;overflow:hidden",
      tabsBar,
      t
    );

    bt.addEventListener("click", e => {
      e.stopPropagation();
      setTab(i);
      renderFn();
    });

    tabBtns.push(bt);
    panes.push(el("div", "", body));
  });

  const sec = (pn, t) =>
    el("div", "margin:7px 0 2px;color:#9ab;font-weight:bold", pn, t);

  const CARD =
    "background:#141c2a;border-radius:8px;padding:6px 8px;line-height:1.45";

  // =========================================================
  // PESTAÑA 1: RESUMEN
  // =========================================================

  const chips = el(
    "div",
    "display:grid;grid-template-columns:repeat(3,1fr);gap:4px",
    panes[0]
  );

  const banner = el(
    "div",
    "margin-top:5px;padding:5px 7px;border-radius:8px;background:#141c2a;line-height:1.35",
    panes[0]
  );

  sec(panes[0], "📈 Estructura del precio");

  const cvBars = el(
    "canvas",
    "width:100%;height:72px;border-radius:6px;display:block",
    panes[0]
  );

  cvBars.width = 280;
  cvBars.height = 72;

  const barsNote = el(
    "div",
    "color:#8aa;margin-top:2px;line-height:1.3",
    panes[0]
  );

  sec(panes[0], "💰 Resultado de entradas");

  const cvPL = el(
    "canvas",
    "width:100%;height:36px;border-radius:6px;display:block",
    panes[0]
  );

  cvPL.width = 280;
  cvPL.height = 36;

  sec(panes[0], "📝 Resumen de la sesión");

  const sumBox = el("div", CARD, panes[0]);

  const det = el("details", "margin-top:8px", panes[0]);

  el("summary", "color:#9ab;padding:4px 0", det, "🔧 Detalles técnicos");

  const stat = el(
    "div",
    "margin-top:3px;white-space:pre-wrap;line-height:1.3;color:#9fc",
    det
  );

  // =========================================================
  // PESTAÑA 2: EN VIVO
  // =========================================================

  sec(panes[1], "👀 Ahora mismo");

  const nowBox = el("div", CARD, panes[1]);

  sec(panes[1], "🎯 Por qué entré (última entrada)");

  const whyBox = el("div", CARD, panes[1]);

  sec(panes[1], "📰 Qué ha pasado");

  const feed = el("div", "line-height:1.4", panes[1]);

  // =========================================================
  // PESTAÑA 3: APRENDE - DISEÑO COMPACT