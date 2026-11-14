// PLEX v5.5 - Módulo 3: Estructura de Mercado, Patrones y Aprendizaje por Refuerzo (RL)
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const { CFG, PAT_DIR, PATN, SRCN, loadCal, saveCal, dirWord, jAdd } = window.PLEX_MOD.config;

  const RL_KEY = "iqtri_rl4";
  let rl = Object.assign({ Q: {}, total: 0, hist: [], pl: 0 }, loadCal(RL_KEY) || {});
  if (!rl.seen) rl.seen = {};
  if (!rl.usr) rl.usr = { n: 0, w: 0, l: 0, pl: 0 };
  let rlDirty = false, rlSavedAt = 0;

  const pending = [];
  let bars = [], curBar = null;
  let S = { trend: "R", pos: "M", pat: "NONE", atr: 0, swH: [], swL: [] };
  const patState = {}, patLast = {};
  const STRUCT = ["BRK_UP", "BRK_DN", "DBOT", "DTOP", "PULL_U", "PULL_D", "REJ_B", "REJ_T", "INS_UP", "INS_DN", "RET_UP", "RET_DN"];
  let cdlBarT = 0, cdlNow = { t: 0, names: [], color: "" }, prevTrend = null, lastSwHp = 0, lastSwLp = 0, brk = null;

  const seenInc = nm => { rl.seen[nm] = (rl.seen[nm] || 0) + 1; rlDirty = true; };

  function feedBar(p, hi, lo) {
    const b0 = Math.floor(Date.now() / CFG.barMs) * CFG.barMs;
    if (!curBar || curBar.t !== b0) {
      if (curBar) { bars.push(curBar); if (bars.length > CFG.maxBars) bars.shift(); }
      curBar = { t: b0, o: p, h: hi, l: lo, c: p };
    } else {
      if (hi > curBar.h) curBar.h = hi;
      if (lo < curBar.l) curBar.l = lo;
      curBar.c = p;
    }
  }

  function resetMarket() {
    bars = [];
    curBar = null;
    pending.length = 0;
  }

  function detectCandles(B, atr, trend, pos) {
    const n = B.length, c0 = B[n - 1], c1 = B[n - 2], c2 = B[n - 3];
    const bd = b => Math.abs(b.c - b.o), rg = b => b.h - b.l, upB = b => b.c > b.o, dnB = b => b.c < b.o;
    const uw = b => b.h - Math.max(b.o, b.c), lw = b => Math.min(b.o, b.c) - b.l;
    const out = [], R0 = rg(c0), B0 = bd(c0);
    if (R0 > 0.3 * atr && B0 < 0.1 * R0) out.push("DOJI");
    if (R0 > 0.5 * atr && lw(c0) >= 2 * B0 && lw(c0) > 0.55 * R0 && uw(c0) <= 0.25 * R0 && (trend === "D" || pos === "B")) out.push("HAMMER");
    if (R0 > 0.5 * atr && uw(c0) >= 2 * B0 && uw(c0) > 0.55 * R0 && lw(c0) <= 0.25 * R0 && (trend === "U" || pos === "T")) out.push("SHOOT");
    if (dnB(c1) && upB(c0) && c0.o <= c1.c && c0.c >= c1.o && B0 > bd(c1) && R0 > 0.5 * atr && (trend === "D" || pos !== "T")) out.push("ENG_UP");
    if (upB(c1) && dnB(c0) && c0.o >= c1.c && c0.c <= c1.o && B0 > bd(c1) && R0 > 0.5 * atr && (trend === "U" || pos !== "B")) out.push("ENG_DN");
    if (dnB(c1) && upB(c0) && bd(c1) > 0.6 * atr && B0 < 0.5 * bd(c1) && c0.o > c1.c && c0.c < c1.o) out.push("HARAMI_U");
    if (upB(c1) && dnB(c0) && bd(c1) > 0.6 * atr && B0 < 0.5 * bd(c1) && c0.o < c1.c && c0.c > c1.o) out.push("HARAMI_D");
    if (dnB(c2) && bd(c2) > 0.6 * atr && bd(c1) < 0.3 * bd(c2) && upB(c0) && c0.c > (c2.o + c2.c) / 2) out.push("MORN");
    if (upB(c2) && bd(c2) > 0.6 * atr && bd(c1) < 0.3 * bd(c2) && dnB(c0) && c0.c < (c2.o + c2.c) / 2) out.push("EVEN");
    if (upB(c0) && upB(c1) && upB(c2) && c0.c > c1.c && c1.c > c2.c && bd(c0) > 0.3 * atr && bd(c1) > 0.3 * atr && bd(c2) > 0.3 * atr && uw(c0) < 0.5 * B0) out.push("SOLD3");
    if (dnB(c0) && dnB(c1) && dnB(c2) && c0.c < c1.c && c1.c < c2.c && bd(c0) > 0.3 * atr && bd(c1) > 0.3 * atr && bd(c2) > 0.3 * atr && lw(c0) < 0.5 * B0) out.push("CROW3");
    if (upB(c0) && B0 > 0.8 * atr && uw(c0) < 0.1 * R0 && lw(c0) < 0.1 * R0) out.push("MARU_U");
    if (dnB(c0) && B0 > 0.8 * atr && uw(c0) < 0.1 * R0 && lw(c0) < 0.1 * R0) out.push("MARU_D");
    return out;
  }

  function analyze(p, say) {
    const B = bars, n = B.length;
    if (n < 7 || !curBar || p == null) {
      S = { trend: "R", pos: "M", pat: "NONE", atr: S.atr, swH: [], swL: [] };
      return [];
    }
    const K = CFG.swingK;
    let atr = 0;
    const m = Math.min(14, n);
    for (let i = n - m; i < n; i++) atr += B[i].h - B[i].l;
    atr /= m;
    if (!(atr > 0)) atr = 1e-5;

    const swH = [], swL = [];
    for (let i = K; i < n - K; i++) {
      let hi = true, lo = true;
      for (let j = 1; j <= K; j++) {
        if (!(B[i].h > B[i - j].h && B[i].h >= B[i + j].h)) hi = false;
        if (!(B[i].l < B[i - j].l && B[i].l <= B[i + j].l)) lo = false;
      }
      if (hi) swH.push({ i, p: B[i].h });
      if (lo) swL.push({ i, p: B[i].l });
    }

    let trend = "R";
    if (swH.length >= 2 && swL.length >= 2) {
      const h1 = swH[swH.length - 2].p, h2 = swH[swH.length - 1].p;
      const l1 = swL[swL.length - 2].p, l2 = swL[swL.length - 1].p;
      if (h2 > h1 && l2 > l1) trend = "U";
      else if (h2 < h1 && l2 < l1) trend = "D";
    }
    if (trend === "R") {
      const w = Math.min(12, n), sl = B[n - 1].c - B[n - w].c;
      if (sl > 1.2 * atr) trend = "U"; else if (sl < -1.2 * atr) trend = "D";
    }

    let hi = p, lo = p;
    for (let i = Math.max(0, n - 30); i < n; i++) { if (B[i].h > hi) hi = B[i].h; if (B[i].l < lo) lo = B[i].l; }
    const rel = hi > lo ? (p - lo) / (hi - lo) : 0.5;
    const pos = rel < 0.33 ? "B" : rel > 0.67 ? "T" : "M";
    const now = performance.now();

    if (prevTrend !== null && trend !== prevTrend)
      say("📐", trend === "U" ? "La tendencia pasa a ALCISTA (máximos y mínimos cada vez más altos)" :
        trend === "D" ? "La tendencia pasa a BAJISTA (máximos y mínimos cada vez más bajos)" : "El precio queda LATERAL: sin tendencia clara", "tr" + trend);
    prevTrend = trend;
    const lhp = swH.length ? swH[swH.length - 1].p : 0, llp = swL.length ? swL[swL.length - 1].p : 0;
    if (lastSwHp && lhp && lhp !== lastSwHp) say("📍", `Nuevo máximo de oscilación en ${lhp.toFixed(5)}`, "swh" + lhp);
    if (lastSwLp && llp && llp !== lastSwLp) say("📍", `Nuevo mínimo de oscilación en ${llp.toFixed(5)}`, "swl" + llp);
    lastSwHp = lhp; lastSwLp = llp;

    const last = B[n - 1], prv = B[n - 2], cb = curBar;
    const lastH = swH.length ? swH[swH.length - 1] : null;
    const lastL = swL.length ? swL[swL.length - 1] : null;
    if (brk) {
      brk.ext = Math.max(brk.ext, brk.dir === "U" ? p - brk.lvl : brk.lvl - p);
      if (now - brk.t > 90000) brk = null;
    }
    const act = {};
    if (lastH && p > lastH.p + 0.15 * atr) act.BRK_UP = 1;
    if (lastL && p < lastL.p - 0.15 * atr) act.BRK_DN = 1;
    if (swH.length >= 2) {
      const a = swH[swH.length - 1], b = swH[swH.length - 2];
      if (a.i - b.i >= 2 && Math.abs(a.p - b.p) < 0.35 * atr && p < a.p - 0.5 * atr && p > a.p - 2 * atr) act.DTOP = 1;
    }
    if (swL.length >= 2) {
      const a = swL[swL.length - 1], b = swL[swL.length - 2];
      if (a.i - b.i >= 2 && Math.abs(a.p - b.p) < 0.35 * atr && p > a.p + 0.5 * atr && p < a.p + 2 * atr) act.DBOT = 1;
    }
    if (trend === "U" && last.c < last.o && prv.c < prv.o && cb.c > cb.o && p - cb.o > 0.2 * atr) act.PULL_U = 1;
    if (trend === "D" && last.c > last.o && prv.c > prv.o && cb.c < cb.o && cb.o - p > 0.2 * atr) act.PULL_D = 1;
    const body = Math.abs(last.c - last.o), range = last.h - last.l;
    const upW = last.h - Math.max(last.o, last.c), dnW = Math.min(last.o, last.c) - last.l;
    if (range > 0.6 * atr && upW > 2 * body && upW > 0.5 * range && pos === "T") act.REJ_T = 1;
    if (range > 0.6 * atr && dnW > 2 * body && dnW > 0.5 * range && pos === "B") act.REJ_B = 1;
    if (last.h < prv.h && last.l > prv.l && prv.h - prv.l > 0.5 * atr) {
      if (p > prv.h + 0.1 * atr) act.INS_UP = 1;
      if (p < prv.l - 0.1 * atr) act.INS_DN = 1;
    }
    if (brk && brk.ext > 0.5 * atr) {
      if (brk.dir === "U" && p >= brk.lvl - 0.1 * atr && p <= brk.lvl + 0.3 * atr && cb.c > cb.o) act.RET_UP = 1;
      if (brk.dir === "D" && p <= brk.lvl + 0.1 * atr && p >= brk.lvl - 0.3 * atr && cb.c < cb.o) act.RET_DN = 1;
    }

    const fired = [];
    let cur = "NONE";
    for (const nm of STRUCT) {
      if (act[nm]) {
        if (cur === "NONE") cur = nm;
        if (!patState[nm] && now - (patLast[nm] || 0) > CFG.patCooldownMs) {
          patLast[nm] = now; fired.push(nm); seenInc(nm);
          if (nm === "BRK_UP" && lastH) brk = { dir: "U", lvl: lastH.p, t: now, ext: 0 };
          if (nm === "BRK_DN" && lastL) brk = { dir: "D", lvl: lastL.p, t: now, ext: 0 };
        }
      }
      patState[nm] = !!act[nm];
    }

    if (last.t !== cdlBarT) {
      cdlBarT = last.t;
      const names = detectCandles(B, atr, trend, pos);
      cdlNow = { t: last.t, names, color: last.c >= last.o ? "verde" : "roja" };
      names.forEach(nm => { seenInc(nm); if (PAT_DIR[nm]) fired.push(nm); });
      if (names.some(x => x !== "DOJI")) say("🕯", `Cerró vela ${cdlNow.color}: ${names.map(x => PATN[x]).join(" + ")}`, "cdl" + last.t);
    }

    S = { trend, pos, pat: cur, atr, swH, swL };
    return fired;
  }

  // Motor RL
  const ent = k => rl.Q[k] || (rl.Q[k] = { f: { n: 0, m: 0, v: 0 }, x: { n: 0, m: 0, v: 0 }, W: 0, N: 0 });
  function upd(st, r) {
    st.n = Math.min(st.n + 1, CFG.rlCap);
    const a = 1 / st.n, d = r - st.m;
    st.m += a * d;
    st.v += a * (d * (r - st.m) - st.v);
  }
  const lcb = st => st.m - CFG.rlZ * Math.sqrt(Math.max(st.v, 1e-6) / st.n);

  function keysFor(src, dir, patName) {
    const pat = patName || S.pat;
    const rel = S.trend === "R" ? "R" : ((S.trend === "U") === (dir === "HIGHER") ? "W" : "A");
    return [`${src}|${pat}|${rel}|${S.pos}`, `${src}|${pat}|${rel}`, `${src}|${pat}`, src];
  }

  function policy(keys, mn = CFG.rlMinN) {
    for (const k of keys) {
      const e = rl.Q[k];
      if (!e || e.f.n < mn) continue;
      const lf = lcb(e.f), lx = lcb(e.x);
      if (lf > CFG.rlMinEdge && lf >= lx) return { a: "FOLLOW", k };
      if (lx > CFG.rlMinEdge && lx > lf) return { a: "FADE", k };
      return { a: "SKIP", k };
    }
    return { a: "UNK", k: "" };
  }

  function recordSample(p, expMs, src, dir, keys, patName, isUser = false) {
    if (p == null) return null;
    const s = { exp: performance.now() + expMs, p0: p, dir, keys, src, pat: patName || S.pat, user: isUser, ex: null, tr: null };
    pending.push(s);
    if (pending.length > 200) pending.shift();
    return s;
  }

  function evalPending(t0, p1, pay, sess, say) {
    if (!pending.length || p1 == null) return;
    for (let i = pending.length - 1; i >= 0; i--) {
      const s = pending[i];
      if (t0 < s.exp) continue;
      pending.splice(i, 1);
      if (t0 - s.exp > 5000) continue;
      const up = p1 > s.p0, down = p1 < s.p0, tie = !up && !down;
      const win = s.dir === "HIGHER" ? up : down;
      const rF = tie ? 0 : win ? pay : -1, rX = tie ? 0 : win ? -1 : pay;
      if (s.user) {
        for (const k of s.keys) {
          const e = ent(k);
          upd(e.f, rF); upd(e.x, rX);
          if (!tie) { e.N++; if (win) e.W++; }
        }
        if (!tie) { rl.usr.n++; if (win) rl.usr.w++; else rl.usr.l++; }
        rl.usr.pl += rF;
        const ic = tie ? "➖" : win ? "✅" : "❌";
        say(ic, `Tu operación ${dirWord(s.dir)}: ${tie ? "empate" : win ? "GANÓ" : "PERDIÓ"} · entró ${s.p0.toFixed(5)}, cerró ${p1.toFixed(5)}` +
          (tie ? "" : ` (${rF > 0 ? "+" : ""}${rF.toFixed(2)})`), "ures" + s.exp);
        jAdd({ t: Date.now(), src: "USR", pat: s.pat, dir: s.dir, zone: "", ack: "", p0: s.p0, p1, r: rF });
        rlDirty = true;
        continue;
      }
      for (const k of s.keys) {
        const e = ent(k);
        upd(e.f, rF); upd(e.x, rX);
        if (!tie) { e.N++; if (win) e.W++; }
      }
      rl.total++;
      if (s.ex) {
        const w2 = s.ex === "HIGHER" ? up : down;
        const r = tie ? 0 : w2 ? pay : -1;
        rl.pl += r; rl.hist.push(r);
        if (rl.hist.length > 150) rl.hist.shift();
        const sn = SRCN[s.src] || s.src;
        const bs = sess.bySrc[sn] || (sess.bySrc[sn] = { n: 0, w: 0 });
        if (!tie) { bs.n++; if (w2) { bs.w++; sess.win++; } else sess.loss++; }
        const txt = `${tie ? "Empate" : w2 ? "GANÓ" : "PERDIÓ"} ${dirWord(s.ex)} · entró ${s.p0.toFixed(5)}, cerró ${p1.toFixed(5)}` +
          (tie ? "" : ` (${r > 0 ? "+" : ""}${r.toFixed(2)})`);
        const ic = tie ? "➖" : w2 ? "✅" : "❌";
        if (s.why) s.why.result = { icon: ic, text: txt };
        say(ic, txt, "res" + (s.tr ? s.tr.t : t0));
        if (s.tr) {
          s.tr.r = r;
          jAdd({ t: s.tr.t, src: s.src, pat: s.pat, dir: s.ex, zone: s.tr.zone, ack: s.tr.ack == null ? "" : Math.round(s.tr.ack), p0: s.p0, p1, r });
        }
      }
      rlDirty = true;
    }
  }

  function resetRL() {
    rl = { Q: {}, total: 0, hist: [], pl: 0, seen: {}, usr: { n: 0, w: 0, l: 0, pl: 0 } };
    pending.length = 0;
    saveCal(RL_KEY, rl);
  }

  function saveRLIfDirty(t0) {
    if (rlDirty && t0 - rlSavedAt > 2000) {
      rlDirty = false;
      rlSavedAt = t0;
      saveCal(RL_KEY, rl);
    }
  }

  const ctxPat = () => S.pat !== "NONE" ? S.pat : (cdlNow.names.find(n => PAT_DIR[n]) || "NONE");

  window.PLEX_MOD.brain = {
    getRL: () => rl,
    getState: () => ({ S, bars, curBar, cdlNow }),
    feedBar, resetMarket, analyze,
    keysFor, policy, recordSample, evalPending,
    resetRL, saveRLIfDirty, ctxPat
  };
})();
