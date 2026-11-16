
// PLEX v6.2 - Motor de Ejecución + Gestión de Riesgo
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const {
    CFG, WORDS, PAT_DIR, PATN, PATD, TRN2, POSN2,
    loadCal, saveCal, dirWord, opposite, entryAlert
  } = window.PLEX_MOD.config;

  const vision = window.PLEX_MOD.vision;
  const brain = window.PLEX_MOD.brain;
  const ui = window.PLEX_MOD.ui;

  let lastTrade = 0, prev = null, lastEvent = "", avgMs = 0, tradeCount = 0;
  let crossInfo = "", zzHead = "ZZ –", lastTradeShort = "", fullText = "", rlLast = "";

  let openTrades = (loadCal("iqtri_open") || []).filter(o => o && o.until > Date.now());

  const pruneOpen = () => {
    const now = Date.now(), n = openTrades.length;
    openTrades = openTrades.filter(o => o.until > now);
    if (openTrades.length !== n) saveCal("iqtri_open", openTrades);
    return openTrades;
  };

  const story = [], sayKeys = {};
  let lastSay = "", lastWhy = null;

  const sess = {
    t0: Date.now(), signals: 0, trades: 0, win: 0, loss: 0,
    skipRL: 0, skipOpp: 0, skipPause: 0, bySrc: {}
  };

  function say(icon, text, key) {
    const now = Date.now(), k = key || text;
    if (sayKeys[k] && now - sayKeys[k] < 4000) return;

    sayKeys[k] = now;
    if (Object.keys(sayKeys).length > 300) {
      for (const x in sayKeys) {
        if (now - sayKeys[x] > 10000) delete sayKeys[x];
      }
    }

    story.unshift({ t: now, icon, text });
    if (story.length > CFG.storyMax) story.pop();
    lastSay = icon + " " + text;
  }

  let lastP = null, lastPAt = 0, pxAt = 0;

  const curPrice = () =>
    lastP != null && performance.now() - lastPAt < CFG.priceStaleMs
      ? lastP
      : null;

  let Zs = loadCal("iqtri_zones");

  if (!Array.isArray(Zs) || Zs.length !== 9) {
    Zs = Array.from({ length: 9 }, () => ({ n: 0, ok: 0, ms: 0 }));
  }

  let lastTouch = -1e9;

  ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "mousedown", "wheel"].forEach(ev =>
    document.addEventListener(ev, e => {
      if (!e.isTrusted) return;
      if (ui.box.contains(e.target)) return;
      if (e.type === "pointermove" && e.pointerType === "mouse" && !e.buttons) return;
      lastTouch = performance.now();
    }, { capture: true, passive: true })
  );

  const isPaused = () =>
    CFG.touchPauseMs > 0 && performance.now() - lastTouch < CFG.touchPauseMs;

  document.addEventListener("pointerup", e => {
    if (!vision.getCalMode() || ui.box.contains(e.target)) return;
    lastEvent = vision.sampleAt(e.clientX, e.clientY);
    ui.setSettingsStatus(lastEvent);
  }, true);

  let demoAt = 0, demoVal = false;

  const isDemo = () => {
    const now = Date.now();

    if (now - demoAt > 3000 && document.body) {
      demoVal = /demo account|cuenta demo|cuenta de práctica/i.test(document.body.innerText);
      demoAt = now;
    }

    return demoVal;
  };

  let payoutVal = 0, payoutAt = 0;

  const payoutNow = () => {
    const now = Date.now();

    if (now - payoutAt > 5000 && document.body) {
      payoutAt = now;
      const m = document.body.innerText.match(/Rendim[\s\S]{0,40}?\+\s*(\d{1,3})\s*%/i);
      if (m) payoutVal = +m[1] / 100;
    }

    return payoutVal || CFG.payout;
  };

  let expAt = 0, expVal = 0;

  const expiryBase = () => {
    const now = Date.now();

    if (now - expAt > 2000 && document.body) {
      expAt = now;
      const m = document.body.innerText.match(/Tiempo[\s\S]{0,8}?(\d+)\s*(min|m|s)\b/i);

      if (m) {
        const n = +m[1];
        expVal = /^s/i.test(m[2]) ? n * 1000 : n * 60000;
      }
    }

    return expVal || CFG.tradeSecs * 1000;
  };

  const expiryMs = () => expiryBase() + CFG.holdMarginMs;

  const be = () => 1 / (1 + payoutNow());

  const execStats = () => {
    const rl = brain.getRL();
    const dec = rl.hist.filter(r => r !== 0);
    const w = dec.filter(r => r > 0).length;

    return {
      n: dec.length,
      win: dec.length ? w / dec.length : null
    };
  };

  function rlTag() {
    if (!CFG.rl) return "";
    if (curPrice() == null) return " RL?";

    const rl = brain.getRL();
    const x = execStats();
    const usrTxt = rl.usr && rl.usr.n ? ` 👤${rl.usr.n}` : "";

    return rl.total < CFG.rlWarmup
      ? ` RL ${rl.total}/${CFG.rlWarmup}${usrTxt}`
      : ` RL✓${x.win != null ? " " + Math.round(x.win * 100) + "%" : ""}${usrTxt}`;
  }

  function paint() {
    ui.paintHeader(
      isDemo(), pruneOpen(), zzHead,
      tradeCount, lastTradeShort, rlTag(), lastSay
    );
  }

  const show = t => {
    fullText = t;
    paint();
  };

  function bgColor(e) {
    const m = (getComputedStyle(e).backgroundColor || "").match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;

    const a = m.length > 3 ? parseFloat(m[3]) : 1;
    return a < 0.5 ? null : [+m[0], +m[1], +m[2]];
  }

  function findButton(dir) {
    const words = WORDS[dir];

    const cands = [...document.querySelectorAll("button,[role=button],div,span,p")].filter(e => {
      const t = (e.textContent || "").trim().toLowerCase();
      if (!t || t.length > 12 || !words.includes(t)) return false;

      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top > window.innerHeight * 0.45;
    });

    if (cands.length) {
      const e = cands[cands.length - 1];
      return e.closest("button,[role=button]") || e;
    }

    const boxes = [...document.querySelectorAll("button,[role=button],div")].filter(e => {
      const r = e.getBoundingClientRect();

      return r.width > 120 && r.width < 420 &&
        r.height > 40 && r.height < 120 &&
        r.top > window.innerHeight * 0.55 &&
        r.bottom < window.innerHeight * 0.92;
    });

    const wantRed = dir === "LOWER";

    const hits = boxes.filter(e => {
      const c = bgColor(e);
      if (!c) return false;

      return wantRed
        ? (c[0] > 170 && c[1] < 120 && c[2] < 120)
        : (c[1] > 130 && c[0] < 100 && c[2] < 150);
    });

    if (hits.length) {
      hits.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return ra.width * ra.height - rb.width * rb.height;
      });

      return hits[0];
    }

    return null;
  }

  const btnCache = {};

  function getButton(dir) {
    const b = btnCache[dir];

    if (b && b.isConnected && b.getBoundingClientRect().width > 0)
      return b;

    const f = findButton(dir);
    if (f) btnCache[dir] = f;

    return f;
  }

  function click(e, fx, fy) {
    const r = e.getBoundingClientRect();

    const o = {
      bubbles: true, cancelable: true, view: window,
      clientX: r.left + r.width * fx,
      clientY: r.top + r.height * fy,
      button: 0
    };

    e.dispatchEvent(new PointerEvent("pointerdown", o));
    e.dispatchEvent(new MouseEvent("mousedown", o));
    e.dispatchEvent(new PointerEvent("pointerup", o));
    e.dispatchEvent(new MouseEvent("mouseup", o));
    e.dispatchEvent(new MouseEvent("click", o));
  }

  function pickZone() {
    const low = [];

    for (let i = 0; i < 9; i++) {
      if (Zs[i].n < 3) low.push(i);
    }

    if (low.length)
      return low[(Math.random() * low.length) | 0];

    if (Math.random() < CFG.zoneEps)
      return (Math.random() * 9) | 0;

    let best = 4, bs = -1e9;

    for (let i = 0; i < 9; i++) {
      const z = Zs[i];
      const s = (z.ok / z.n) * 1000 -
        (z.ok ? z.ms / z.ok : 2500);

      if (s > bs) {
        bs = s;
        best = i;
      }
    }

    return best;
  }

  const countClose = () => {
    try {
      return (document.body.innerText.match(/Cerrar/gi) || []).length;
    } catch (e) {
      return 0;
    }
  };

  function watchAck(tr) {
    const before = countClose(), t1 = performance.now();
    let done = false, iv = null;

    const finish = ok => {
      if (done) return;

      done = true;
      clearInterval(iv);

      if (vision.getAckCb() === cb)
        vision.setAckCb(null);

      if (ok) tr.ack = performance.now() - t1;

      const z = Zs[tr.zone];
      z.n++;

      if (ok) {
        z.ok++;
        z.ms += tr.ack;
      }

      saveCal("iqtri_zones", Zs);
    };

    const cb = () => finish(true);
    vision.setAckCb(cb);

    iv = setInterval(() => {
      if (countClose() > before) finish(true);
      else if (performance.now() - t1 > 2500) finish(false);
    }, 100);
  }

  function doTrade(dir, force, t0, src, why) {
    if (CFG.demoOnly && !isDemo()) {
      lastEvent = "bloqueado: cuenta real o cuenta demo no detectada";
      say("🔒", "Operación bloqueada: no se pudo confirmar cuenta demo", "demoblock");
      return null;
    }

    if (src && isPaused()) {
      lastEvent = `${src} ${dirWord(dir)} ignorada: pantalla tocada`;
      sess.skipPause++;

      say("⏸", `Omitida ${dirWord(dir)}: tocaste la pantalla`, "pz");
      return null;
    }

    if (!force && Date.now() - lastTrade < CFG.cooldownMs) {
      lastEvent = "en cooldown";
      return null;
    }

    if (src && CFG.oneDirection) {
      const now = Date.now();
      const opp = pruneOpen().find(o => o.dir !== dir);

      if (opp) {
        const sl = Math.max(0, Math.ceil((opp.until - now) / 1000));

        lastEvent = `${src} ${dirWord(dir)} ignorada: hay ${dirWord(opp.dir)} abierta (${sl}s)`;
        sess.skipOpp++;

        say(
          "⛔",
          `Omitida ${dirWord(dir)}: ya hay una ${dirWord(opp.dir)} abierta${opp.by === "user" ? " (tuya)" : ""} (${sl}s) y solo opero en un sentido`,
          "opp" + dir
        );

        return null;
      }
    }

    const btn = getButton(dir);

    if (!btn) {
      lastEvent = "no encontré botón " + dir;
      return null;
    }

    const zone = CFG.zoneVary && src ? pickZone() : 4;
    const fx = [0.2, 0.5, 0.8][zone % 3] + (Math.random() - 0.5) * 0.08;
    const fy = [0.25, 0.5, 0.75][(zone / 3) | 0] + (Math.random() - 0.5) * 0.08;

    const tr = { t: Date.now(), dir, zone, ack: null, r: null };

    click(btn, fx, fy);
    watchAck(tr);

    lastTrade = tr.t;
    openTrades.push({ dir, until: lastTrade + expiryMs() });
    saveCal("iqtri_open", openTrades);

    tradeCount++;
    if (src) sess.trades++;

    entryAlert(dir);

    if (why) {
      lastWhy = why;
      say("🟢", `ENTRADA #${tradeCount} ${dirWord(dir)} — ${why.lines[2]}`, "ent" + tr.t);
    }

    const lat = t0 ? performance.now() - t0 : 0;

    lastTradeShort = `${dirWord(dir)} ${src || "TEST"} ${new Date().toLocaleTimeString([], { hour12: false })}`;

    lastEvent = `ENTRADA #${tradeCount} ${dir}${src ? " [" + src + "]" : ""} z${zone}` +
      (CFG.profile && t0 ? ` (${lat.toFixed(0)}ms)` : "");

    paint();
    return tr;
  }

  let candSign = 0, stableSign = 0, candSince = 0;

  const dirFor = s => {
    const d = s === 1 ? "HIGHER" : "LOWER";
    return CFG.invertDir ? opposite(d) : d;
  };

  const srcLabel = (src, dir, pn) =>
    src === "TRI"
      ? (dir === "HIGHER" ? "Triángulo verde ▲" : "Triángulo rojo ▼")
      : src === "CRUCE"
        ? `Cruce del zigzag (tramo ${candSign === 1 ? "▲ sube" : "▼ baja"})`
        : (PATN[pn] || pn);

  function signal(src, dir, force, t0, patName) {
    const isPat = src === "PAT";
    const isSeq = src === "SEQ";
    const rl = brain.getRL();
    const { S, cdlNow } = brain.getState();

    sess.signals++;

    const label = srcLabel(src, dir, patName);
    lastEvent = `Señal detectada: ${label} → ${dirWord(dir)}`;

    say(
      isPat ? "🧩" : isSeq ? "🧠" : src === "TRI" ? "🔺" : "🔀",
      `${label} → sugiere ${dirWord(dir)}` +
      ((isPat || isSeq) && PATD[patName] ? `: ${PATD[patName]}` : ""),
      "sig" + label + dir
    );

    let fd = dir;
    let mode = "free";
    let stat = "";
    let from = "Lo aprendido";
    const ready = CFG.rl && curPrice() != null;
    const keys = brain.keysFor(src, dir, patName);

    const smp = ready && !isPaused()
      ? brain.recordSample(curPrice(), expiryBase(), src, dir, keys, patName, false)
      : null;

    if (isPat && !(ready && CFG.rlMode === "gate")) {
      lastEvent = `${label}: patrón en modo de aprendizaje`;
      return null;
    }

    if (isSeq) {
      mode = "model";
    } else if (ready && CFG.rlMode === "gate" &&
      (isPat || rl.total >= CFG.rlWarmup)) {

      let d = brain.policy(isPat ? keys.slice(0, 3) : keys);

      if (d.a === "UNK") {
        const u = brain.policy(
          brain.keysFor("USR", dir, isPat ? patName : brain.ctxPat()),
          CFG.usrMinN
        );

        if (u.a === "FOLLOW" || u.a === "FADE") {
          d = u;
          from = "Tus operaciones";
        }
      }

      const e = d.k ? rl.Q[d.k] : null;

      if (e && e.N) {
        stat = `${Math.round(100 * e.W / e.N)}% de acierto ${from === "Lo aprendido" ? "si se sigue" : "en tus entradas de este contexto"} (${e.N} casos; mínimo ${(be() * 100).toFixed(1)}%)`;
      }

      rlLast = `RL ${isPat ? patName : src} ${dirWord(dir)}: ${d.a}${d.k ? " [" + d.k + "]" : ""}${from === "Lo aprendido" ? "" : " (tú)"}`;

      if (isPat) {
        if (d.a !== "FOLLOW" && d.a !== "FADE") {
          lastEvent = `${label}: falta evidencia de aprendizaje`;
          say("📚", `${label}: aún sin evidencia suficiente, solo aprende`, "learn" + label);
          return null;
        }
      } else if (d.a === "SKIP" ||
        (d.a === "UNK" && CFG.rlUnknown === "skip")) {
        sess.skipRL++;
        lastEvent = `RL omite ${src} ${dirWord(dir)}`;

        say(
          "⏭",
          `Omitida ${label}: ` +
          (d.a === "SKIP"
            ? `lo aprendido no la respalda (${stat})`
            : "aún no hay datos suficientes de este contexto"),
          "skip" + label + dir
        );

        return null;
      }

      mode = d.a === "FADE" ? "fade" :
        d.a === "FOLLOW" ? "follow" : "unk";

      if (d.a === "FADE")
        fd = opposite(dir);

    } else if (!ready) {
      mode = "noprice";
    } else if (!isSeq && CFG.rlMode === "gate") {
      mode = "warm";
    }

    const decision =
      mode === "model" ? "La similitud y su límite estadístico respaldan la dirección" :
      mode === "follow" ? `${from}: ${stat} → la sigo` :
      mode === "fade" ? `${from}: ${stat}; rinde más al revés → entro ${dirWord(fd)}` :
      mode === "warm" ? `Aún aprendiendo (${rl.total}/${CFG.rlWarmup}): opero la señal sin filtro` :
      mode === "unk" ? "Contexto nuevo: opero la señal sin filtro" :
      mode === "noprice" ? "Sin precio todavía: opero sin filtro" :
      "Modo aprendizaje: opero la señal sin filtro";

    const ctx =
      `Contexto: tendencia ${TRN2[S.trend]}, zona ${POSN2[S.pos]}` +
      (S.pat !== "NONE" ? `, patrón ${PATN[S.pat]}` : "") +
      (cdlNow.names.length
        ? `, última vela ${cdlNow.names.map(x => PATN[x]).join("+")}`
        : "");

    const why = {
      t: Date.now(),
      dir: fd,
      title: `${dirWord(fd)} por ${label}`,
      result: null,
      lines: [
        `Señal: ${label} → sugería ${dirWord(dir)}` +
          (isPat && PATD[patName] ? ` (${PATD[patName]})` : ""),
        ctx,
        decision,
        `Regla: un solo sentido; expira en ${Math.round(expiryBase() / 1000)} s`
      ]
    };

    if (isSeq && S.variablePattern) {
      const v=S.variablePattern;
      why.lines.push(
        `Modelo variable: secuencia de ${v.length} velas, `+
        `${v.matches} repeticiones previas consistentes `+
        `(${v.occurrences} apariciones en total) dentro de las últimas 30.`
      );
    }

    why.lines.push(
      "Monto: se usa el valor configurado en la plataforma; no se modifica."
    );

    const tr = doTrade(
      fd,
      force,
      t0,
      isPat ? "PAT:" + patName : src,
      why
    );

    if (tr) {
      if (smp) {
        smp.ex = fd;
        smp.tr = tr;
        smp.why = why;
      }

      return fd;
    }

    return null;
  }

  function userTrade(dir) {
    const p = curPrice();
    const { S } = brain.getState();

    if (!CFG.rl || p == null) {
      say("👤", `Tú entraste ${dirWord(dir)}, pero sin precio no puedo aprender de ella`, "unp" + dir);
      return;
    }

    const pat = brain.ctxPat();
    const keys = brain.keysFor("USR", dir, pat);

    brain.recordSample(p, expiryBase(), "USR", dir, keys, pat, true);

    openTrades.push({
      dir,
      until: Date.now() + expiryMs(),
      by: "user"
    });

    saveCal("iqtri_open", openTrades);

    say(
      "👤",
      `Tú entraste ${dirWord(dir)}: tendencia ${TRN2[S.trend]}, zona ${POSN2[S.pos]}` +
      (pat !== "NONE" ? `, patrón ${PATN[pat]}` : "") +
      ". Aprendo de su resultado.",
      "usr" + Date.now()
    );
  }

  document.addEventListener("click", e => {
    if (!e.isTrusted || ui.box.contains(e.target)) return;

    for (const d of ["HIGHER", "LOWER"]) {
      const bt = getButton(d);

      if (bt && bt.contains(e.target)) {
        userTrade(d);
        return;
      }
    }
  }, true);

  function crossStep(leg) {
    if (!leg) {
      crossInfo = "zigzag: sin trazo";
      zzHead = "ZZ –";
      return;
    }

    const now = performance.now();

    if (leg.dir !== candSign) {
      candSign = leg.dir;
      candSince = now;
    }

    const held = now - candSince;
    const state = candSign === 1 ? "▲ sube" : "▼ baja";
    const dir = dirFor(candSign);

    if (candSign !== stableSign) {
      if (held >= CFG.confirmMs) {
        const first = stableSign === 0;
        stableSign = candSign;

        if (!first)
          signal("CRUCE", dir, CFG.everyCross, now);

        crossInfo = `zigzag: ${state} → ${dir} (cambio OK)`;
      } else {
        crossInfo = `zigzag: ${state} → ${dir} ${(held / 1000).toFixed(1)}/${(CFG.confirmMs / 1000).toFixed(1)}s`;
      }
    } else {
      crossInfo = `zigzag: ${state} → ${dir}`;
    }

    zzHead = `ZZ ${candSign === 1 ? "▲" : "▼"}→${dirWord(dir)}${candSign !== stableSign ? "…" : ""}`;
  }

  // =========================================================
  // PRECIO Y VELAS
  // Las velas se construyen localmente con los ticks observados.
  // No se presupone que IQ Option entregue OHLC histórico.
  // =========================================================

  let lastBarFeed = 0;

  function updPrice(t0) {
    if (t0 - pxAt < 100) return;

    pxAt = t0;

    const r = vision.readPrice();
    if (!r || !Number.isFinite(r.p)) return;

    if (vision.isAssetChanged()) {
      brain.resetMarket();
      lastBarFeed = 0;
    }

    lastP = r.p;
    lastPAt = t0;
    const barMeta = Object.assign(
      {},
      r,
      {
        asset:vision.getWsStats().asset,
        horizonMs:expiryBase()
      }
    );

    // Pasamos los datos disponibles sin inventar OHLC del servidor.
    // brain.feedBar puede usar los tres primeros argumentos y,
    // si está actualizado, el cuarto objeto con metadatos de la vela.
    const barKey = Number.isFinite(r.barStart) ? r.barStart : 0;

    if (!barKey || barKey !== lastBarFeed) {
      brain.feedBar(r.p,r.hi,r.lo,barMeta);
      lastBarFeed = barKey;
    } else {
      // Actualiza el precio dentro de la misma vela local.
      brain.feedBar(r.p,r.hi,r.lo,barMeta);
    }
  }

  ui.setupButtons({
    doTrade,
    setLastEvent: txt => {
      lastEvent = txt;
      ui.setSettingsStatus(txt);
    }
  });

  ui.initDashboard(() => ({
    be: be(),
    curPrice: curPrice(),
    execStats: execStats(),
    openTrades: pruneOpen(),
    isPaused: isPaused(),
    lastEvent,
    sess,
    fullText,
    rlLast,
    crossInfo,
    lastWhy,
    story
  }));

  let anAt = 0, fired = [];

  function tick() {
    const t0 = performance.now();

    if (!CFG.enabled)
      return show("PLEX: OFF");

    // El precio y el análisis no dependen del aprendizaje RL.
    updPrice(t0);

    brain.evalPending(t0, curPrice(), payoutNow(), sess, say);
    brain.saveRLIfDirty(t0);

    // El análisis se ejecuta aunque RL esté desactivado.
    if (t0 - anAt > 250) {
      anAt = t0;

      if (typeof brain.analyze === "function") {
        fired = brain.analyze(
          curPrice(),
          say,
          expiryBase()
        ) || [];
      }
    }

    if (isPaused()) {
      prev = null;
      stableSign = 0;
      candSign = 0;
      fired = [];
      zzHead = "ZZ ⏸";

      return show("PLEX ⏸ pausa: tocaste la pantalla");
    }

    if (CFG.usePatterns && fired.length) {
      const f = fired;
      fired = [];

      for (const nm of f) {
        const dir = PAT_DIR[nm];

        if (dir === "HIGHER" || dir === "LOWER") {
          signal(nm==="SEQ_UP" || nm==="SEQ_DN" ? "SEQ" : "PAT",
            dir, false, t0, nm);
        }
      }
    }

    const img = vision.snapshot();
    const { diag, lineStat } = vision.getWsStats();

    if (!img)
      return show("PLEX " + diag);

    const { down, up } = vision.findTriangles(img);

    if (CFG.useCross)
      crossStep(vision.findLastLeg(img));

    if (CFG.useTriangles && prev) {
      const nd = vision.fresh(down, prev.down).map(t => ({ ...t, dir: "LOWER" }));
      const nu = vision.fresh(up, prev.up).map(t => ({ ...t, dir: "HIGHER" }));
      const all = nd.concat(nu).sort((a, b) => a.x - b.x);

      if (all.length) {
        all.forEach((t, i) => {
          if (i === 0) {
            signal("TRI", t.dir, CFG.everyCross, t0);
          } else {
            setTimeout(() => signal("TRI", t.dir, CFG.everyCross, 0), i * CFG.gapMs);
          }
        });
      }
    }

    prev = { down, up };

    const dt = performance.now() - t0;
    avgMs = avgMs ? avgMs * 0.9 + dt * 0.1 : dt;

    show(
      `PLEX ▲${up.length} ▼${down.length} · ${diag}` +
      (CFG.useCross ? `\n${crossInfo}\n${lineStat}` : "") +
      (CFG.profile ? `\nciclo: ${avgMs.toFixed(1)}ms` : "")
    );
  }

  (function loop() {
    const s = performance.now();

    try {
      tick();
    } catch (e) {
      show("PLEX error: " + e.message);
      console.error("[PLEX core]", e);
    }

    setTimeout(loop, Math.max(4, CFG.intervalMs - (performance.now() - s)));
  })();

  show("PLEX v6.2 Modular activo");
})();
