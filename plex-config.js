
// PLEX v6.1 - Módulo 1: Configuración, Constantes, Almacenamiento y Audio
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const CFG = {
    enabled: true,
    demoOnly: true,
    intervalMs: 40,
    cooldownMs: 1500,
    everyCross: true,
    gapMs: 250,
    width: 400,
    xMin: 0.03,
    xMax: 0.90,
    scanFrom: 0.40,
    minArea: 42,
    sound: true,
    volume: 0.8,
    profile: true,

    // Gestión de operaciones
    oneDirection: true,
    tradeSecs: 30,
    holdMarginMs: 2000,

    // Pausa al tocar la pantalla
    touchPauseMs: 2000,

    // Estrategias originales
    useTriangles: true,
    useCross: true,
    usePatterns: true,

    // Análisis de velas de un minuto
    analysisTimeframeMs: 60000,
    barMs: 60000,
    maxBars: 120,
    swingK: 2,
    patCooldownMs: 8000,
    seqWindowBars: 30,
    seqMinLength: 3,
    seqMaxLength: 10,
    seqMinMatches: 1,
    seqMinOccurrences: 2,
    seqMaxDistance: 0.45,
    seqMaxSamples: 500,

    // Objetivo de entrada de 30 segundos
    entryTimeframeMs: 30000,

    strategyRequireClosedBar: true,

    // Zigzag original
    confirmMs: 500,
    invertDir: true,
    tailPx: 7,
    minTailPx: 3,
    tol: 70,

    // Aprendizaje por refuerzo
    rl: true,
    rlMinN: 8,
    rlRetestMinN: 3,
    usrMinN: 8,
    rlZ: 1.2,
    rlMinEdge: 0,
    rlCap: 60,
    payout: 0.87,
    priceStaleMs: 4000,

    // Zonas de click
    zoneVary: true,
    zoneEps: 0.25,

    // Narración
    storyMax: 40
  };

  const WORDS = {
    LOWER: ["lower", "baja", "bajar", "abajo", "put", "down"],
    HIGHER: ["higher", "sube", "subir", "arriba", "call", "up"]
  };

  const PAT_DIR = {
    BRK_UP: "HIGHER",
    BRK_DN: "LOWER",
    DBOT: "HIGHER",
    DTOP: "LOWER",
    HS_TOP: "LOWER",
    HS_BOTTOM: "HIGHER",
    TRI_ASC: "HIGHER",
    TRI_DESC: "LOWER",
    TRI_SYM_UP: "HIGHER",
    TRI_SYM_DN: "LOWER",
    WEDGE_RISE: "LOWER",
    WEDGE_FALL: "HIGHER",
    RECT_UP: "HIGHER",
    RECT_DN: "LOWER",
    FLAG_UP: "HIGHER",
    FLAG_DN: "LOWER",
    PENNANT_UP: "HIGHER",
    PENNANT_DN: "LOWER",
    CUP_HANDLE_UP: "HIGHER",
    CUP_HANDLE_DN: "LOWER",
    PULL_U: "HIGHER",
    PULL_D: "LOWER",
    REJ_B: "HIGHER",
    REJ_T: "LOWER",
    INS_UP: "HIGHER",
    INS_DN: "LOWER",
    RET_UP: "HIGHER",
    RET_DN: "LOWER",
    HAMMER: "HIGHER",
    SHOOT: "LOWER",
    ENG_UP: "HIGHER",
    ENG_DN: "LOWER",
    HARAMI_U: "HIGHER",
    HARAMI_D: "LOWER",
    MORN: "HIGHER",
    EVEN: "LOWER",
    SOLD3: "HIGHER",
    CROW3: "LOWER",
    MARU_U: "HIGHER",
    MARU_D: "LOWER",

    // Estructura de mercado
    LVL_B: "HIGHER",
    LVL_T: "LOWER",
    TWZ_U: "HIGHER",
    TWZ_D: "LOWER",
    ST_BOS_U: "HIGHER",
    ST_BOS_D: "LOWER",
    ST_CHOCH_U: "HIGHER",
    ST_CHOCH_D: "LOWER",
    ST_SWEEP_H: "LOWER",
    ST_SWEEP_L: "HIGHER",
    ST_RET_U: "HIGHER",
    ST_RET_D: "LOWER",
    SR_SUPPORT_3: "HIGHER",
    SR_RESISTANCE_3: "LOWER",
    CONT_UP: "HIGHER",
    CONT_DN: "LOWER",

  };

  const PATN = {
    NONE: "Sin patrón",
    BRK_UP: "Ruptura al alza",
    BRK_DN: "Ruptura a la baja",
    DBOT: "Doble suelo",
    DTOP: "Doble techo",
    HS_TOP: "Hombro-cabeza-hombro",
    HS_BOTTOM: "Hombro-cabeza-hombro invertido",
    TRI_ASC: "Triángulo ascendente",
    TRI_DESC: "Triángulo descendente",
    TRI_SYM_UP: "Triángulo simétrico al alza",
    TRI_SYM_DN: "Triángulo simétrico a la baja",
    WEDGE_RISE: "Cuña ascendente",
    WEDGE_FALL: "Cuña descendente",
    RECT_UP: "Rectángulo roto al alza",
    RECT_DN: "Rectángulo roto a la baja",
    FLAG_UP: "Bandera alcista",
    FLAG_DN: "Bandera bajista",
    PENNANT_UP: "Banderín alcista",
    PENNANT_DN: "Banderín bajista",
    CUP_HANDLE_UP: "Taza con asa",
    CUP_HANDLE_DN: "Taza con asa invertida",
    PULL_U: "Retroceso alcista",
    PULL_D: "Retroceso bajista",
    REJ_B: "Rechazo abajo",
    REJ_T: "Rechazo arriba",
    INS_UP: "Vela interior alcista",
    INS_DN: "Vela interior bajista",
    RET_UP: "Retest alcista",
    RET_DN: "Retest bajista",
    HAMMER: "Martillo",
    SHOOT: "Estrella fugaz",
    ENG_UP: "Envolvente alcista",
    ENG_DN: "Envolvente bajista",
    HARAMI_U: "Harami alcista",
    HARAMI_D: "Harami bajista",
    MORN: "Estrella de la mañana",
    EVEN: "Estrella de la tarde",
    SOLD3: "Tres soldados",
    CROW3: "Tres cuervos",
    MARU_U: "Marubozu verde",
    MARU_D: "Marubozu rojo",
    DOJI: "Doji",

    LVL_B: "Máximo ascendente",
    LVL_T: "Mínimo descendente",
    TWZ_U: "Suelo con rechazo",
    TWZ_D: "Techo con rechazo",
    ST_BOS_U: "Ruptura de estructura alcista",
    ST_BOS_D: "Ruptura de estructura bajista",
    ST_CHOCH_U: "Cambio de carácter alcista",
    ST_CHOCH_D: "Cambio de carácter bajista",
    ST_SWEEP_H: "Barrido de liquidez superior",
    ST_SWEEP_L: "Barrido de liquidez inferior",
    ST_RET_U: "Retesteo alcista",
    ST_RET_D: "Retesteo bajista",
    SR_SUPPORT_3: "Tercer rebote en soporte",
    SR_RESISTANCE_3: "Tercer rechazo en resistencia",
    CONT_UP: "Continuación de tendencia alcista",
    CONT_DN: "Continuación de tendencia bajista",
    SEQ_UP: "Estructura variable repetida al alza",
    SEQ_DN: "Estructura variable repetida a la baja"
  };

  const PATD = {
    BRK_UP: "El precio rompió el último máximo.",
    BRK_DN: "El precio rompió el último mínimo.",
    DBOT: "Doble suelo: dos rechazos en una zona de mínimos.",
    DTOP: "Doble techo: dos rechazos en una zona de máximos.",
    HS_TOP: "Tres máximos con una cabeza mayor y ruptura bajista del cuello.",
    HS_BOTTOM: "Tres mínimos con una cabeza menor y ruptura alcista del cuello.",
    TRI_ASC: "Resistencia casi horizontal y mínimos ascendentes; confirma al romper arriba.",
    TRI_DESC: "Soporte casi horizontal y máximos descendentes; confirma al romper abajo.",
    TRI_SYM_UP: "Máximos descendentes y mínimos ascendentes; ruptura confirmada al alza.",
    TRI_SYM_DN: "Máximos descendentes y mínimos ascendentes; ruptura confirmada a la baja.",
    WEDGE_RISE: "Máximos y mínimos ascendentes que convergen; confirma al perder soporte.",
    WEDGE_FALL: "Máximos y mínimos descendentes que convergen; confirma al romper resistencia.",
    RECT_UP: "Rango de máximos y mínimos horizontales; cierre confirmado sobre resistencia.",
    RECT_DN: "Rango de máximos y mínimos horizontales; cierre confirmado bajo soporte.",
    FLAG_UP: "Impulso alcista seguido de canal corto descendente y ruptura al alza.",
    FLAG_DN: "Impulso bajista seguido de canal corto ascendente y ruptura a la baja.",
    PENNANT_UP: "Impulso alcista seguido de consolidación convergente y ruptura al alza.",
    PENNANT_DN: "Impulso bajista seguido de consolidación convergente y ruptura a la baja.",
    CUP_HANDLE_UP: "Rim izquierdo, base redondeada, rim derecho y asa poco profunda; cierre rompe el rim.",
    CUP_HANDLE_DN: "Base invertida y asa de rebote poco profunda; cierre rompe el soporte del rim.",
    PULL_U: "Retroceso dentro de una tendencia alcista.",
    PULL_D: "Retroceso dentro de una tendencia bajista.",
    REJ_B: "Mecha inferior: rechazo de precios bajos.",
    REJ_T: "Mecha superior: rechazo de precios altos.",
    INS_UP: "Vela interior rota al alza.",
    INS_DN: "Vela interior rota a la baja.",
    RET_UP: "El precio volvió a probar una ruptura alcista.",
    RET_DN: "El precio volvió a probar una ruptura bajista.",
    HAMMER: "Martillo con mecha inferior larga.",
    SHOOT: "Estrella fugaz con mecha superior larga.",
    ENG_UP: "Envolvente alcista.",
    ENG_DN: "Envolvente bajista.",
    HARAMI_U: "Harami alcista.",
    HARAMI_D: "Harami bajista.",
    MORN: "Estrella de la mañana.",
    EVEN: "Estrella de la tarde.",
    SOLD3: "Tres soldados alcistas.",
    CROW3: "Tres cuervos bajistas.",
    MARU_U: "Marubozu verde.",
    MARU_D: "Marubozu rojo.",
    DOJI: "Vela de indecisión.",

    ST_BOS_U: "Ruptura de estructura al alza.",
    ST_BOS_D: "Ruptura de estructura a la baja.",
    ST_CHOCH_U: "Posible cambio de carácter alcista.",
    ST_CHOCH_D: "Posible cambio de carácter bajista.",
    ST_SWEEP_H: "El precio superó un máximo y retrocedió.",
    ST_SWEEP_L: "El precio perforó un mínimo y recuperó.",
    ST_RET_U: "Retesteo de nivel roto al alza.",
    ST_RET_D: "Retesteo de nivel roto a la baja.",
    SR_SUPPORT_3: "El precio confirmó su tercer rebote en el soporte.",
    SR_RESISTANCE_3: "El precio confirmó su tercer rechazo en la resistencia.",
    CONT_UP: "La tendencia alcista reanudó el avance después de un retroceso.",
    CONT_DN: "La tendencia bajista reanudó la caída después de un rebote.",
    SEQ_UP: "La secuencia variable de las últimas 30 velas se parece a secuencias previas que subieron antes de su vencimiento medido.",
    SEQ_DN: "La secuencia variable de las últimas 30 velas se parece a secuencias previas que bajaron antes de su vencimiento medido."
  };

  const SRCN = {
    TRI: "Triángulo",
    CRUCE: "Cruce",
    PAT: "Patrón",
    SEQ: "Estructura variable",
    USR: "Tú"
  };

  const TRN2 = {
    U: "alcista",
    D: "bajista",
    R: "lateral"
  };

  const POSN2 = {
    B: "baja",
    M: "media",
    T: "alta"
  };

  // Almacenamiento de calibración
  const loadCal = k => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  };

  const saveCal = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };

  const dirWord = d =>
    d === "HIGHER" ? "SUBE" : "BAJA";

  const opposite = d =>
    d === "HIGHER" ? "LOWER" : "HIGHER";

  const hhmmss = t =>
    new Date(t).toLocaleTimeString([], { hour12: false });

  // Diario IndexedDB
  let jdb = null, jdbFailed = false;
  const journalPending = [];

  try {
    const rq = indexedDB.open("IQTriDB", 1);

    rq.onupgradeneeded = e => {
      e.target.result.createObjectStore(
        "journal",
        { autoIncrement: true }
      );
    };

    rq.onsuccess = e => {
      jdb = e.target.result;
      journalPending.splice(0).forEach(jAdd);
    };

    rq.onerror = () => {
      jdbFailed = true;
      journalPending.length = 0;
    };
  } catch (e) {}

  const jAdd = o => {
    if (!jdb) {
      if (!jdbFailed) journalPending.push(o);
      return;
    }

    try {
      jdb.transaction("journal", "readwrite")
        .objectStore("journal")
        .add(o);
    } catch (e) {}
  };

  function jExport(onStatus) {
    if (!jdb) {
      if (onStatus) onStatus(
        jdbFailed
          ? "diario no disponible en este navegador"
          : "diario cargando; intenta de nuevo"
      );
      return;
    }

    let rq;

    try {
      rq = jdb.transaction("journal")
        .objectStore("journal")
        .getAll();
    } catch (e) {
      if (onStatus) onStatus("diario: no se pudo leer");
      return;
    }

    rq.onerror = () => {
      if (onStatus) onStatus("diario: no se pudo leer");
    };

    rq.onsuccess = () => {
      const rows = rq.result || [];
      const cols = [
        "t", "src", "pat", "dir",
        "zone", "ack", "p0", "p1", "r"
      ];

      const csv = [cols.join(",")]
        .concat(rows.map(o =>
          cols.map(c =>
            o[c] == null ? "" : o[c]
          ).join(",")
        ))
        .join("\n");

      const a = document.createElement("a");

      try {
        a.href = URL.createObjectURL(
          new Blob([csv], { type: "text/csv" })
        );
        a.download = "iqtri_journal.csv";
        a.click();
      } catch (e) {
        if (onStatus) onStatus("diario: no se pudo descargar");
        return;
      }

      if (onStatus)
        onStatus("diario: " + rows.length + " filas");
    };
  }

  // Audio WebAudio API
  let actx = null;
  let bus = null;

  const getCtx = () => {
    if (!actx) {
      const AC =
        window.AudioContext ||
        window.webkitAudioContext;

      if (AC) actx = new AC();
    }

    return actx;
  };

  const unlockAudio = () => {
    const c = getCtx();

    if (c && c.state === "suspended")
      c.resume();
  };

  [
    "touchstart", "touchend", "click",
    "pointerdown", "keydown"
  ].forEach(ev =>
    document.addEventListener(
      ev,
      unlockAudio,
      { capture: true, passive: true }
    )
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) unlockAudio();
    }
  );

  function getBus(c) {
    if (!bus || bus.c !== c) {
      const master = c.createGain();
      const comp = c.createDynamicsCompressor();

      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;

      master.connect(comp);
      comp.connect(c.destination);

      const dly = c.createDelay(0.5);
      const fb = c.createGain();
      const lp = c.createBiquadFilter();
      const wet = c.createGain();

      dly.delayTime.value = 0.16;
      fb.gain.value = 0.28;
      wet.gain.value = 0.35;

      lp.type = "lowpass";
      lp.frequency.value = 3500;

      master.connect(dly);
      dly.connect(lp);
      lp.connect(fb);
      fb.connect(dly);
      lp.connect(wet);
      wet.connect(comp);

      bus = { c, master };
    }

    bus.master.gain.value = CFG.volume;
    return bus.master;
  }

  function chime(freq, start, amp) {
    const c = getCtx();
    if (!c) return;

    const out = getBus(c);
    const t = c.currentTime + start;

    [
      [1, 1, 1.1],
      [2.76, 0.22, 0.45],
      [5.4, 0.08, 0.25]
    ].forEach(([m, a, d]) => {
      const osc = c.createOscillator();
      const g = c.createGain();

      osc.type = "sine";
      osc.frequency.value = freq * m;

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(
        amp * a,
        t + 0.006
      );
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        t + d
      );

      osc.connect(g);
      g.connect(out);

      osc.start(t);
      osc.stop(t + d + 0.05);
    });
  }

  function playSound(dir) {
    if (!CFG.sound) return;

    const c = getCtx();
    if (!c) return;

    const go = () => {
      const notes =
        dir === "HIGHER"
          ? [1046.5, 1318.5, 1568, 2093]
          : [1568, 1318.5, 1046.5, 784];

      notes.forEach((f, i) =>
        chime(f, i * 0.09, i === 3 ? 0.55 : 0.45)
      );
    };

    if (c.state === "running") {
      go();
    } else {
      c.resume()
        .then(() => {
          if (c.state === "running") go();
        })
        .catch(() => {});
    }
  }

  function entryAlert(dir) {
    playSound(dir);

    try {
      if (navigator.vibrate)
        navigator.vibrate([40, 60, 40]);
    } catch (e) {}
  }

  window.PLEX_MOD.config = {
    CFG,
    WORDS,
    PAT_DIR,
    PATN,
    PATD,
    SRCN,
    TRN2,
    POSN2,
    loadCal,
    saveCal,
    dirWord,
    opposite,
    hhmmss,
    jAdd,
    jExport,
    unlockAudio,
    playSound,
    entryAlert
  };
})();
