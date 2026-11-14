// PLEX v5.5 - Módulo 1: Configuración, Constantes, Almacenamiento y Audio
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const CFG = {
    enabled: true,
    demoOnly: true,
    intervalMs: 40,         // objetivo de ciclo (el bucle descuenta lo que tarda cada análisis)
    cooldownMs: 1500,       // solo si everyCross = false
    everyCross: true,
    gapMs: 250,
    width: 400,             // resolución de análisis (más bajo = más rápido)
    xMin: 0.03, xMax: 0.90,
    scanFrom: 0.40,
    minArea: 42,
    sound: true,
    volume: 0.8,            // volumen del aviso de entrada (0 a 1)
    profile: true,

    // --- un solo sentido ---
    oneDirection: true,
    tradeSecs: 30,
    holdMarginMs: 2000,

    // --- pausa al tocar la pantalla ---
    touchPauseMs: 2000,

    // --- señales ---
    useTriangles: true,
    useCross: true,
    usePatterns: true,      // patrones de estructura (ruptura, doble techo/suelo, retroceso, rechazo)

    // --- zigzag ---
    confirmMs: 500,         // el nuevo color debe mantenerse este tiempo (0 = al instante)
    invertDir: true,
    tailPx: 7,
    minTailPx: 3,
    tol: 70,

    // --- aprendizaje por refuerzo ---
    rl: true,
    rlMode: "gate",         // "gate" = filtra/invierte según lo aprendido | "learn" = solo aprende (los patrones nunca operan)
    rlWarmup: 60,           // muestras evaluadas antes de filtrar TRI/CRUCE
    rlMinN: 15,             // muestras mínimas por contexto para fiarse
    usrMinN: 8,             // muestras mínimas de TUS operaciones para que el bot se fíe de ellas
    rlZ: 1.8,               // margen de confianza
    rlMinEdge: 0,
    rlCap: 300,
    rlUnknown: "skip",
    payout: 0.87,
    priceStaleMs: 4000,

    // --- estructura de mercado (barras propias construidas con el precio en vivo) ---
    barMs: 10000,           // duración de cada barra
    maxBars: 90,
    swingK: 2,              // una barra es swing si supera a K barras a cada lado
    patCooldownMs: 8000,    // mínimo entre disparos del mismo patrón

    // --- zonas de click ---
    zoneVary: true,         // varía el punto de click dentro del botón (cuadrícula 3x3)
    zoneEps: 0.25,          // 25% explora zonas al azar, el resto usa la mejor (acepta más / confirma antes)

    // --- narración ---
    storyMax: 40            // eventos que se guardan en la pestaña En vivo
  };

  const WORDS = {
    LOWER:  ["lower", "baja", "bajar", "abajo", "put", "down"],
    HIGHER: ["higher", "sube", "subir", "arriba", "call", "up"]
  };

  const PAT_DIR = {
    BRK_UP: "HIGHER", BRK_DN: "LOWER", DBOT: "HIGHER", DTOP: "LOWER",
    PULL_U: "HIGHER", PULL_D: "LOWER", REJ_B: "HIGHER", REJ_T: "LOWER",
    INS_UP: "HIGHER", INS_DN: "LOWER", RET_UP: "HIGHER", RET_DN: "LOWER",
    HAMMER: "HIGHER", SHOOT: "LOWER", ENG_UP: "HIGHER", ENG_DN: "LOWER",
    HARAMI_U: "HIGHER", HARAMI_D: "LOWER", MORN: "HIGHER", EVEN: "LOWER",
    SOLD3: "HIGHER", CROW3: "LOWER", MARU_U: "HIGHER", MARU_D: "LOWER"
  };

  const PATN = {
    NONE: "Sin patrón", BRK_UP: "Ruptura al alza", BRK_DN: "Ruptura a la baja",
    DBOT: "Doble suelo", DTOP: "Doble techo", PULL_U: "Retroceso alcista", PULL_D: "Retroceso bajista",
    REJ_B: "Rechazo abajo", REJ_T: "Rechazo arriba", INS_UP: "Vela interior ↑", INS_DN: "Vela interior ↓",
    RET_UP: "Retest alcista", RET_DN: "Retest bajista",
    HAMMER: "Martillo", SHOOT: "Estrella fugaz", ENG_UP: "Envolvente alcista", ENG_DN: "Envolvente bajista",
    HARAMI_U: "Harami alcista", HARAMI_D: "Harami bajista", MORN: "Estrella de la mañana", EVEN: "Estrella de la tarde",
    SOLD3: "Tres soldados", CROW3: "Tres cuervos", MARU_U: "Marubozu verde", MARU_D: "Marubozu rojo", DOJI: "Doji"
  };

  const PATD = {
    BRK_UP: "el precio rompió el último máximo: mandan los compradores",
    BRK_DN: "el precio rompió el último mínimo: mandan los vendedores",
    DBOT: "doble suelo: rebotó dos veces en el mismo mínimo",
    DTOP: "doble techo: chocó dos veces con el mismo máximo",
    PULL_U: "en tendencia alcista retrocedió y ya vuelve a subir",
    PULL_D: "en tendencia bajista rebotó y ya vuelve a bajar",
    REJ_B: "mecha larga abajo en zona baja: rechazo de precios bajos",
    REJ_T: "mecha larga arriba en zona alta: rechazo de precios altos",
    INS_UP: "la vela interior se rompió hacia arriba: sale de la compresión al alza",
    INS_DN: "la vela interior se rompió hacia abajo: sale de la compresión a la baja",
    RET_UP: "tras romper un máximo volvió a probarlo y rebota",
    RET_DN: "tras romper un mínimo volvió a probarlo y cae",
    HAMMER: "mecha inferior larga tras caída: los compradores rechazaron los precios bajos",
    SHOOT: "mecha superior larga tras subida: los vendedores rechazaron los precios altos",
    ENG_UP: "una vela verde cubre por completo a la roja anterior",
    ENG_DN: "una vela roja cubre por completo a la verde anterior",
    HARAMI_U: "vela verde pequeña dentro de una roja grande: la caída pierde fuerza",
    HARAMI_D: "vela roja pequeña dentro de una verde grande: la subida pierde fuerza",
    MORN: "caída, duda y vela verde fuerte: posible giro al alza",
    EVEN: "subida, duda y vela roja fuerte: posible giro a la baja",
    SOLD3: "tres velas verdes seguidas cerrando más alto",
    CROW3: "tres velas rojas seguidas cerrando más bajo",
    MARU_U: "vela verde fuerte sin mechas: dominan los compradores",
    MARU_D: "vela roja fuerte sin mechas: dominan los vendedores",
    DOJI: "indecisión: compradores y vendedores empatados"
  };

  const SRCN = { TRI: "Triángulo", CRUCE: "Cruce", PAT: "Patrón", USR: "Tú" };
  const TRN2 = { U: "alcista", D: "bajista", R: "lateral" };
  const POSN2 = { B: "baja", M: "media", T: "alta" };

  // Almacenamiento
  const loadCal = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const saveCal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const dirWord = d => (d === "HIGHER" ? "SUBE" : "BAJA");
  const opposite = d => (d === "HIGHER" ? "LOWER" : "HIGHER");
  const hhmmss = t => new Date(t).toLocaleTimeString([], { hour12: false });

  // Diario IndexedDB
  let jdb = null;
  try {
    const rq = indexedDB.open("IQTriDB", 1);
    rq.onupgradeneeded = e => { e.target.result.createObjectStore("journal", { autoIncrement: true }); };
    rq.onsuccess = e => { jdb = e.target.result; };
  } catch (e) {}
  const jAdd = o => { try { if (jdb) jdb.transaction("journal", "readwrite").objectStore("journal").add(o); } catch (e) {} };
  function jExport(onStatus) {
    if (!jdb) { if (onStatus) onStatus("diario no disponible"); return; }
    const rq = jdb.transaction("journal").objectStore("journal").getAll();
    rq.onsuccess = () => {
      const rows = rq.result || [];
      const cols = ["t", "src", "pat", "dir", "zone", "ack", "p0", "p1", "r"];
      const csv = [cols.join(",")].concat(rows.map(o => cols.map(c => (o[c] == null ? "" : o[c])).join(","))).join("\n");
      try {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "iqtri_journal.csv";
        a.click();
      } catch (e) {}
      if (onStatus) onStatus("diario: " + rows.length + " filas");
    };
  }

  // Audio WebAudio API
  let actx = null, bus = null;
  const getCtx = () => {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
    return actx;
  };
  const unlockAudio = () => { const c = getCtx(); if (c && c.state === "suspended") c.resume(); };
  ["touchstart", "touchend", "click", "pointerdown", "keydown"].forEach(ev =>
    document.addEventListener(ev, unlockAudio, { capture: true, passive: true })
  );
  document.addEventListener("visibilitychange", () => { if (!document.hidden) unlockAudio(); });

  function getBus(c) {
    if (!bus || bus.c !== c) {
      const master = c.createGain(), comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
      master.connect(comp); comp.connect(c.destination);
      const dly = c.createDelay(0.5), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
      dly.delayTime.value = 0.16; fb.gain.value = 0.28; wet.gain.value = 0.35;
      lp.type = "lowpass"; lp.frequency.value = 3500;
      master.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(wet); wet.connect(comp);
      bus = { c, master };
    }
    bus.master.gain.value = CFG.volume;
    return bus.master;
  }

  function chime(freq, start, amp) {
    const c = getCtx(), out = getBus(c), t = c.currentTime + start;
    [[1, 1, 1.1], [2.76, 0.22, 0.45], [5.4, 0.08, 0.25]].forEach(([m, a, d]) => {
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = "sine"; osc.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + d + 0.05);
    });
  }

  function playSound(dir) {
    if (!CFG.sound) return;
    const c = getCtx();
    if (!c) return;
    const go = () => {
      const notes = dir === "HIGHER" ? [1046.5, 1318.5, 1568, 2093] : [1568, 1318.5, 1046.5, 784];
      notes.forEach((f, i) => chime(f, i * 0.09, i === 3 ? 0.55 : 0.45));
    };
    if (c.state === "running") go();
    else c.resume().then(() => { if (c.state === "running") go(); }).catch(() => {});
  }

  function entryAlert(dir) {
    playSound(dir);
    try { if (navigator.vibrate) navigator.vibrate([40, 60, 40]); } catch (e) {}
  }

  window.PLEX_MOD.config = {
    CFG, WORDS, PAT_DIR, PATN, PATD, SRCN, TRN2, POSN2,
    loadCal, saveCal, dirWord, opposite, hhmmss,
    jAdd, jExport, unlockAudio, playSound, entryAlert
  };
})();
