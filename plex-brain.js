
// PLEX v6.2 - Módulo 3: Estructura de Mercado, Acción del Precio y RL
// Velas locales + aprendizaje original.
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const {
    CFG, PAT_DIR, PATN, PATD, SRCN,
    loadCal, saveCal, dirWord, jAdd
  } = window.PLEX_MOD.config;

  Object.assign(PAT_DIR, {
    LVL_B:"HIGHER", LVL_T:"LOWER", TWZ_U:"HIGHER", TWZ_D:"LOWER",
    ST_BOS_U:"HIGHER", ST_BOS_D:"LOWER",
    ST_CHOCH_U:"HIGHER", ST_CHOCH_D:"LOWER",
    ST_SWEEP_H:"LOWER", ST_SWEEP_L:"HIGHER",
    ST_RET_U:"HIGHER", ST_RET_D:"LOWER",
    SR_SUPPORT_3:"HIGHER", SR_RESISTANCE_3:"LOWER",
    CONT_UP:"HIGHER", CONT_DN:"LOWER",
    SEQ_UP:"HIGHER", SEQ_DN:"LOWER"
  });

  Object.assign(PATN, {
    LVL_B:"Rebote en soporte", LVL_T:"Rebote en resistencia",
    TWZ_U:"Pinzas de suelo", TWZ_D:"Pinzas de techo",
    ST_BOS_U:"BOS alcista", ST_BOS_D:"BOS bajista",
    ST_CHOCH_U:"CHOCH alcista", ST_CHOCH_D:"CHOCH bajista",
    ST_SWEEP_H:"Barrido de máximo", ST_SWEEP_L:"Barrido de mínimo",
    ST_RET_U:"Retesteo alcista", ST_RET_D:"Retesteo bajista",
    SR_SUPPORT_3:"Tercer rebote en soporte",
    SR_RESISTANCE_3:"Tercer rechazo en resistencia",
    CONT_UP:"Continuación de tendencia alcista",
    CONT_DN:"Continuación de tendencia bajista"
  });

  Object.assign(PATD, {
    LVL_B:"el precio tocó un soporte probado varias veces y ya rebota hacia arriba",
    LVL_T:"el precio tocó una resistencia probada varias veces y ya cae",
    TWZ_U:"dos velas con el mismo mínimo: el suelo se defiende y gira al alza",
    TWZ_D:"dos velas con el mismo máximo: el techo se defiende y gira a la baja",
    ST_BOS_U:"el precio rompe un máximo estructural confirmado",
    ST_BOS_D:"el precio rompe un mínimo estructural confirmado",
    ST_CHOCH_U:"ruptura alcista contra la estructura bajista previa",
    ST_CHOCH_D:"ruptura bajista contra la estructura alcista previa",
    ST_SWEEP_H:"la mecha supera un máximo y el precio vuelve debajo",
    ST_SWEEP_L:"la mecha pierde un mínimo y el precio vuelve encima",
    ST_RET_U:"el precio retestea y sostiene el nivel roto al alza",
    ST_RET_D:"el precio retestea y rechaza el nivel roto a la baja",
    SR_SUPPORT_3:"el precio confirmó su tercer rebote en un soporte de un minuto",
    SR_RESISTANCE_3:"el precio confirmó su tercer rechazo en una resistencia de un minuto",
    CONT_UP:"la tendencia alcista reanuda el avance después de un retroceso",
    CONT_DN:"la tendencia bajista reanuda la caída después de un rebote"
  });

  const RL_KEY = "iqtri_rl4";
  let rl = Object.assign(
    { Q:{}, total:0, hist:[], pl:0 },
    loadCal(RL_KEY) || {}
  );

  if (!rl.seen) rl.seen = {};
  if (!rl.usr) rl.usr = { n:0, w:0, l:0, pl:0 };
  if (!rl.userFlow || typeof rl.userFlow!=="object" ||
      Array.isArray(rl.userFlow))
    rl.userFlow = {samples:[],lastActionAt:0};
  if (!Array.isArray(rl.userFlow.samples))
    rl.userFlow.samples=[];

  let rlDirty = false, rlSavedAt = 0;
  const pending = [];
  let bars = [], curBar = null;
  const seqStoragePrefix = "iqtri_seq30:";
  let seqAssetKey = "", seqSamples = [], seqPending = [];
  let seqDirty = false, seqSavedAt = 0;
  let seqLastBarStart = 0;
  let seqState = {
    status:"warming", bars:0, samples:0, matches:0,
    occurrences:0, length:0, direction:"", distance:0,
    horizonMs:CFG.entryTimeframeMs,
    minMatches:CFG.seqMinMatches,
    requiredOccurrences:CFG.seqMinOccurrences,
    chart:null
  };

  let S = {
    trend:"R", pos:"M", pat:"NONE", atr:0, swH:[], swL:[],
    bias:0, lvl:"N", lvlT:0, mom:0,
    retests:{support:null,resistance:null},
    variablePattern:seqState,
    structurePattern:null,
    structure:{
      trend:"R", sequence:"R", event:"NONE",
      bias:0, lastHigh:0, lastLow:0
    }
  };

  const patState = {}, patLast = {};
  let structBreak = null;
  let lastStructurePatternSignal=null;
  let continuationState={
    direction:null,
    pullbackBar:0,
    lastSignalBar:0
  };
  let retestState = {
    support:null,
    resistance:null,
    lastBar:0
  };

  const STRUCT = [
    "ST_CHOCH_U","ST_CHOCH_D","ST_BOS_U","ST_BOS_D",
    "ST_SWEEP_H","ST_SWEEP_L","ST_RET_U","ST_RET_D",
    "SR_SUPPORT_3","SR_RESISTANCE_3",
    "CONT_UP","CONT_DN",
    "HS_TOP","HS_BOTTOM","TRI_ASC","TRI_DESC",
    "TRI_SYM_UP","TRI_SYM_DN","WEDGE_RISE","WEDGE_FALL",
    "RECT_UP","RECT_DN","FLAG_UP","FLAG_DN","PENNANT_UP","PENNANT_DN",
    "CUP_HANDLE_UP","CUP_HANDLE_DN",
    "BRK_UP","BRK_DN","DBOT","DTOP","PULL_U","PULL_D",
    "REJ_B","REJ_T","INS_UP","INS_DN","RET_UP","RET_DN",
    "LVL_B","LVL_T"
  ];

  let cdlBarT = 0;
  let cdlNow = { t:0, names:[], color:"" };
  let prevTrend = null, lastSwHp = 0, lastSwLp = 0;
  let brk = null, lastBB = 0;

  const seenInc = nm => {
    rl.seen[nm] = (rl.seen[nm] || 0) + 1;
    rlDirty = true;
  };

  // =========================================================
  // VELAS LOCALES
  // Recibe metadatos de Vision si están disponibles.
  // No supone que el servidor entregue OHLC histórico.
  // =========================================================

  function feedBar(p, hi, lo, meta) {
    meta = meta && typeof meta === "object" ? meta : {};

    if (!Number.isFinite(p)) return;
    if (Object.prototype.hasOwnProperty.call(meta,"asset"))
      setAsset(meta.asset,meta.horizonMs);

    const tf = Math.max(
      1000,
      Number(meta.barTimeframeMs) ||
      Number(CFG.analysisTimeframeMs) ||
      Number(CFG.barMs) ||
      60000
    );

    const suppliedStart = Number(meta.barStart);

    const b0 = Number.isFinite(suppliedStart) && suppliedStart > 0
      ? suppliedStart
      : Math.floor(Date.now() / tf) * tf;

    const o = Number.isFinite(meta.o) ? meta.o : p;

    const highCandidates = [
      Number(meta.barHigh),
      Number(hi),
      p
    ].filter(Number.isFinite);

    const lowCandidates = [
      Number(meta.barLow),
      Number(lo),
      p
    ].filter(Number.isFinite);

    const h = Math.max(...highCandidates);
    const l = Math.min(...lowCandidates);

    if (!curBar || curBar.t !== b0) {
      if (curBar) {
        bars.push(curBar);

        if (bars.length > CFG.maxBars)
          bars.shift();
      }

      curBar = {
        t:b0,
        o,
        h,
        l,
        c:Number.isFinite(meta.barClose) ? meta.barClose : p,
        source:meta.barSource || "local",
        timeframe:tf
      };

      return;
    }

    // Actualización de la vela que todavía está abierta.
    if (h > curBar.h) curBar.h = h;
    if (l < curBar.l) curBar.l = l;

    curBar.c = Number.isFinite(meta.barClose)
      ? meta.barClose
      : p;

    curBar.source = meta.barSource || curBar.source || "local";
    curBar.timeframe = tf;
  }

  function resetMarket() {
    bars = [];
    curBar = null;
    pending.length = 0;
    seqPending.length = 0;
    seqLastBarStart = 0;

    if (!seqAssetKey) {
      seqSamples = [];
    }

    structBreak = null;
    lastStructurePatternSignal=null;
    brk = null;
    continuationState={direction:null,pullbackBar:0,lastSignalBar:0};
    retestState = {support:null,resistance:null,lastBar:0};

    S.structure = {
      trend:"R", sequence:"R", event:"NONE",
      bias:0, lastHigh:0, lastLow:0
    };
    S.structurePattern=null;
    S.retests={support:null,resistance:null};

    prevTrend = null;
    lastSwHp = 0;
    lastSwLp = 0;
    cdlBarT = 0;
    cdlNow = { t:0, names:[], color:"" };

    for (const k in patState)
      delete patState[k];
  }

  function setAsset(asset,horizonMs) {
    const raw = typeof asset === "string" || typeof asset === "number"
      ? String(asset).trim().slice(0,100)
      : "";
    const tf = Math.max(1000,Number(CFG.analysisTimeframeMs)||60000);
    const horizon = Math.max(
      1000,Number(horizonMs)||Number(CFG.entryTimeframeMs)||30000
    );
    const next = raw ? `${raw}|${tf}|${horizon}` : "";

    if (next === seqAssetKey) return;

    if (seqDirty && seqAssetKey)
      saveCal(seqStoragePrefix+encodeURIComponent(seqAssetKey),seqSamples);

    seqDirty=false;
    seqSavedAt=0;
    seqAssetKey = next;
    seqSamples = next
      ? loadCal(seqStoragePrefix+encodeURIComponent(next)) || []
      : [];
    seqSamples = Array.isArray(seqSamples)
      ? seqSamples.filter(s =>
          s &&
          Array.isArray(s.x) &&
          Number.isInteger(s.length) &&
          s.length >= CFG.seqMinLength &&
          s.length <= CFG.seqMaxLength &&
          s.x.length === s.length*4 &&
          s.x.every(Number.isFinite) &&
          [-1,0,1].includes(s.r) &&
          Number.isFinite(s.endBarStart)
        )
      : [];
    if (seqSamples.length>CFG.seqMaxSamples)
      seqSamples=seqSamples.slice(-CFG.seqMaxSamples);
    seqPending = [];
    seqLastBarStart = 0;
    seqState = {
      status:"warming", bars:0, samples:seqSamples.length, matches:0,
      occurrences:0, length:0, direction:"", distance:0,
      horizonMs:horizon,
      minMatches:CFG.seqMinMatches,
      requiredOccurrences:CFG.seqMinOccurrences,
      chart:null
    };
  }

  function sequenceFeatures(window) {
    if (!Array.isArray(window) ||
        window.length<CFG.seqMinLength ||
        window.length>CFG.seqMaxLength)
      return null;

    const size = window.length;

    const tf = Math.max(1000,Number(CFG.analysisTimeframeMs)||60000);
    const returns = [];
    let rangeSum = 0;

    for (let i=0; i<size; i++) {
      const b = window[i];
      if (!b || !(b.c>0) || !Number.isFinite(b.o) ||
          !Number.isFinite(b.h) || !Number.isFinite(b.l))
        return null;

      if (i && b.t-window[i-1].t>tf*1.5)
        return null;

      const previous = i ? window[i-1].c : b.o;
      if (!(previous>0)) return null;

      returns.push(Math.log(b.c/previous));
      rangeSum += Math.max(0,b.h-b.l);
    }

    const vol = Math.sqrt(
      returns.reduce((sum,r) => sum+r*r,0)/size
    );
    const avgRange = rangeSum/size;
    if (!(vol>1e-8) || !(avgRange>0)) return null;

    const features = [];

    for (let i=0; i<size; i++) {
      const b = window[i];
      const range = Math.max(b.h-b.l,avgRange*0.01);
      const normalizedReturn = Math.max(-4,Math.min(4,returns[i]/vol));
      const normalizedRange = Math.max(
        -3,Math.min(3,Math.log(range/avgRange))
      );
      const body = Math.max(-1,Math.min(1,(b.c-b.o)/range));
      const closePosition = Math.max(
        -1,Math.min(1,2*(b.c-b.l)/range-1)
      );

      features.push(
        normalizedReturn,
        normalizedRange,
        body,
        closePosition
      );
    }

    return features;
  }

  function sequenceDistance(a,b) {
    const size = a && a.length/4;
    if (!Array.isArray(a) || !Array.isArray(b) ||
        !Number.isInteger(size) || b.length!==size*4)
      return Infinity;

    let sum = 0;

    for (let i=0; i<size; i++) {
      const j = i*4;
      sum += 0.50*(a[j]-b[j])**2+
        0.15*(a[j+1]-b[j+1])**2+
        0.20*(a[j+2]-b[j+2])**2+
        0.15*(a[j+3]-b[j+3])**2;
    }

    return Math.sqrt(sum/size);
  }

  function sequenceCandles(features) {
    if (!Array.isArray(features) || features.length%4!==0)
      return null;

    const candles=[];
    let closePath=0;

    for (let i=0; i<features.length; i+=4) {
      const range=Math.exp(features[i+1]);
      const close=closePath+features[i]*0.5;
      const open=close-features[i+2]*range;
      const low=close-((features[i+3]+1)/2)*range;
      const high=low+range;

      candles.push({
        o:open,
        h:Math.max(high,open,close),
        l:Math.min(low,open,close),
        c:close
      });
      closePath=close;
    }

    return candles;
  }

  function sequenceCandlesFromBars(window) {
    if (!Array.isArray(window) || !window.length)
      return null;
    if (!window.every(b=>
      b&&Number.isFinite(b.o)&&Number.isFinite(b.h)&&
      Number.isFinite(b.l)&&Number.isFinite(b.c)
    ))
      return null;

    const base=window[0].o;
    const avgRange=window.reduce((sum,b)=>sum+Math.max(0,b.h-b.l),0)/window.length;
    const scale=avgRange>0 ? avgRange : Math.max(Math.abs(base)*1e-8,1e-8);

    if (!Number.isFinite(base) || !Number.isFinite(scale) || !(scale>0))
      return null;

    return window.map(b=>({
      o:(b.o-base)/scale,
      h:(b.h-base)/scale,
      l:(b.l-base)/scale,
      c:(b.c-base)/scale
    }));
  }

  function sequenceStep(B,current,p,horizonMs,say) {
    if (!current || !Number.isFinite(p))
      return null;

    const newBar=current.t!==seqLastBarStart;
    if (newBar) seqLastBarStart=current.t;

    const horizon = Math.max(
      1000,Number(horizonMs)||Number(CFG.entryTimeframeMs)||30000
    );
    const timeframe = Number(current.timeframe)||
      Number(CFG.analysisTimeframeMs)||60000;
    const windowMs = CFG.seqWindowBars*timeframe;
    const currentEnd = B.length ? B[B.length-1].t : 0;
    const barsSeen = Math.min(B.length,CFG.seqWindowBars);
    const liveBars=B.concat(current);
    const recentSamples = seqSamples.filter(s =>
      currentEnd-s.endBarStart>=0 &&
      currentEnd-s.endBarStart+(s.length-1)*timeframe<=windowMs
    );
    const predictions = [], repeated = [];
    const liveCharts={};
    let searchChart=null;
    const maxLength = Math.min(CFG.seqMaxLength,liveBars.length);
    const signalMaxLength = Math.min(CFG.seqMaxLength,B.length);

    for (let length=CFG.seqMinLength; length<=maxLength; length++) {
      const liveWindow=liveBars.slice(-length);
      const liveFeatures=sequenceFeatures(liveWindow);
      const liveCandles=sequenceCandlesFromBars(liveWindow)||
        (liveFeatures ? sequenceCandles(liveFeatures) : null);
      if (!liveCandles) continue;

      const visualCandidates=liveFeatures
        ? recentSamples
          .filter(s=>
            s.length===length &&
            current.t-s.endBarStart>=length*timeframe
          )
          .map(s=>({s,d:sequenceDistance(liveFeatures,s.x)}))
          .sort((a,b)=>a.d-b.d)
        : [];
      const visualRepeats=[];

      for (const candidate of visualCandidates) {
        if (visualRepeats.every(x=>
          Math.abs(x.s.endBarStart-candidate.s.endBarStart)>=length*timeframe
        ))
          visualRepeats.push(candidate);

        if (visualRepeats.length>=2) break;
      }

      liveCharts[length]={
        current:liveCandles,
        repeats:visualRepeats.map(x=>
          x.s.candles||sequenceCandles(x.s.x)
        ).filter(Array.isArray)
      };

      const distance=visualRepeats.length
        ? visualRepeats[0].d : Infinity;
      if (!searchChart || distance<searchChart.distance ||
          (!Number.isFinite(distance) &&
            !Number.isFinite(searchChart.distance) &&
            length>searchChart.length)) {
        searchChart={
          length,
          distance,
          chart:liveCharts[length]
        };
      }
    }

    for (let length=CFG.seqMinLength; length<=signalMaxLength; length++) {
      const currentFeatures=sequenceFeatures(B.slice(-length));
      if (!currentFeatures) continue;

      const candidates=recentSamples
        .filter(s =>
          s.length===length &&
          currentEnd-s.endBarStart>=length*timeframe
        )
        .map(s=>({s,d:sequenceDistance(currentFeatures,s.x)}))
        .filter(x=>x.d<=CFG.seqMaxDistance)
        .sort((a,b)=>a.d-b.d);
      const chosen=[];

      for (const candidate of candidates) {
        if (chosen.every(x =>
          Math.abs(x.s.endBarStart-candidate.s.endBarStart)>=length*timeframe
        ))
          chosen.push(candidate);

        if (chosen.length>=CFG.seqMinMatches) break;
      }

      if (chosen.length<CFG.seqMinMatches) continue;

      const ups=chosen.filter(x=>x.s.r===1).length;
      const downs=chosen.filter(x=>x.s.r===-1).length;
      const match={
        length,
        matches:chosen.length,
        distance:chosen.reduce((sum,x)=>sum+x.d,0)/chosen.length,
        chart:liveCharts[length]||{
          current:sequenceCandles(currentFeatures),
          repeats:chosen.map(x=>x.s.candles||sequenceCandles(x.s.x))
        }
      };

      repeated.push(match);

      if (ups===chosen.length || downs===chosen.length) {
        predictions.push(Object.assign({},match,{
          direction:ups===chosen.length ? "HIGHER":"LOWER"
        }));
      }
    }

    predictions.sort((a,b)=>a.distance-b.distance || b.length-a.length);
    repeated.sort((a,b)=>a.distance-b.distance || b.length-a.length);
    const best=predictions[0]||null;
    const closest=repeated[0]||null;
    const status=best ? "signal" :
      closest ? "no-consensus" :
      barsSeen<CFG.seqWindowBars ? "warming" : "searching";

    if (newBar) {
      for (let length=CFG.seqMinLength; length<=signalMaxLength; length++) {
        const closedWindow=B.slice(-length);
        const features=sequenceFeatures(closedWindow);
        if (!features) continue;

        seqPending.push({
          exp:performance.now()+horizon,
          p0:p,
          x:features,
          candles:sequenceCandlesFromBars(closedWindow),
          length,
          endBarStart:B[B.length-1].t
        });
      }
    }

    const displayMatch=best||closest;
    const displayChartLength=displayMatch
      ? displayMatch.length : searchChart ? searchChart.length : 0;
    const chart=liveCharts[displayChartLength]||
      searchChart&&searchChart.chart||null;

    seqState = {
      status,
      bars:barsSeen,
      samples:recentSamples.length,
      matches:displayMatch ? displayMatch.matches : 0,
      occurrences:best
        ? best.matches+1
        : closest ? closest.matches+1 : 0,
      length:displayChartLength,
      direction:best ? best.direction : "",
      distance:displayMatch ? displayMatch.distance :
        searchChart&&Number.isFinite(searchChart.distance)
          ? searchChart.distance : 0,
      horizonMs:horizon,
      minMatches:CFG.seqMinMatches,
      requiredOccurrences:CFG.seqMinOccurrences,
      chart
    };

    if (!best || !newBar) return null;

    const name=best.direction==="HIGHER" ? "SEQ_UP":"SEQ_DN";
    say(
      "🧠",
      `${PATN[name]} · secuencia de ${best.length} velas: `+
      `${best.matches} repeticiones previas coinciden; `+
      `${best.matches+1} apariciones en total`,
      "seq"+current.t+best.direction
    );
    return name;
  }

  function evalSequencePending(t0,p1) {
    if (!seqPending.length || p1==null) return;

    for (let i=seqPending.length-1; i>=0; i--) {
      const s=seqPending[i];
      if (t0<s.exp) continue;

      seqPending.splice(i,1);
      if (t0-s.exp>5000) continue;

      const r=p1>s.p0 ? 1 : p1<s.p0 ? -1 : 0;
      seqSamples.push({
        x:s.x,
        candles:s.candles,
        length:s.length,
        r,
        endBarStart:s.endBarStart,
        t:Date.now()
      });

      if (seqSamples.length>CFG.seqMaxSamples)
        seqSamples.shift();

      seqState.samples++;
      seqDirty=true;
    }
  }

  const ema = (arr, n) => {
    const k = 2 / (n + 1);
    let e = arr[0];

    for (let i = 1; i < arr.length; i++)
      e = arr[i] * k + e * (1-k);

    return e;
  };

  function levelNear(swH, swL, p, atr) {
    const tol = 0.35 * atr;
    const all = swH.concat(swL);
    let best = null;

    for (const s of all) {
      let touches = 0, sum = 0, nH = 0, nL = 0;

      for (const q of all) {
        if (Math.abs(q.p - s.p) <= tol) {
          touches++;
          sum += q.p;

          if (swH.indexOf(q) >= 0) nH++;
          else nL++;
        }
      }

      if (touches < 2) continue;

      const lp = sum / touches;
      const dist = Math.abs(p-lp);

      if (dist > 0.6*atr) continue;

      if (!best || dist < best.dist) {
        const k = nL > nH ? "S" :
          nH > nL ? "R" : (lp <= p ? "S" : "R");

        best = { k, p:lp, t:touches, dist };
      }
    }

    return best;
  }

  function retestLevel(pivots, side, p, atr) {
    const tol=0.35*atr;
    const candidates=pivots.filter(s=>
      Number.isFinite(s.p) &&
      Math.abs(s.p-p)<=4*atr &&
      (side==="support" ? s.p<=p+tol : s.p>=p-tol)
    );
    let best=null;

    for (const seed of candidates) {
      const cluster=candidates.filter(s=>Math.abs(s.p-seed.p)<=tol);
      const level=cluster.reduce((sum,s)=>sum+s.p,0)/cluster.length;
      const distance=Math.abs(p-level);

      if (!best || distance<best.distance ||
          (distance===best.distance && cluster.length>best.pivots)) {
        best={level,distance,pivots:cluster.length};
      }
    }

    return best;
  }

  function updateRetests(last, swH, swL, p, atr) {
    const tolerance=0.25*atr;
    const update=(key,side,candidate)=>{
      let state=retestState[key];

      if (!candidate) {
        if (state && Math.abs(p-state.level)>1.5*atr)
          retestState[key]=null;
        return null;
      }

      if (!state || Math.abs(candidate.level-state.level)>tolerance) {
        state={
          level:candidate.level,
          touches:0,
          armed:true,
          triggered:false,
          lastTouchBar:0,
          pivotTouches:candidate.pivots
        };
        retestState[key]=state;
      }

      state.pivotTouches=candidate.pivots;

      if (last.t!==retestState.lastBar) {
        const contact=last.l<=state.level+tolerance &&
          last.h>=state.level-tolerance;
        const bounce=side==="support"
          ? last.c>state.level && last.c>last.o
          : last.c<state.level && last.c<last.o;
        const departed=side==="support"
          ? last.l>state.level+tolerance
          : last.h<state.level-tolerance;

        if (departed) {
          state.armed=true;
        } else if (contact && bounce && state.armed &&
                   state.lastTouchBar!==last.t) {
          state.touches++;
          state.lastTouchBar=last.t;
          state.armed=false;
          if (state.touches>=3 && !state.triggered) {
            state.triggered=true;
            return side==="support" ? "SR_SUPPORT_3":"SR_RESISTANCE_3";
          }
        }
      }

      return null;
    };

    if (retestState.lastBar===last.t) {
      return {
        signal:null,
        support:retestState.support,
        resistance:retestState.resistance
      };
    }

    const supportSignal=update(
      "support","support",retestLevel(swL,"support",p,atr)
    );
    const resistanceSignal=update(
      "resistance","resistance",retestLevel(swH,"resistance",p,atr)
    );
    retestState.lastBar=last.t;

    return {
      signal:supportSignal||resistanceSignal,
      support:retestState.support,
      resistance:retestState.resistance
    };
  }

  function updateContinuation(state,trend,last,curBar,p,emaValue,atr,lastH,lastL) {
    if (trend!=="U" && trend!=="D") {
      state.direction=null;
      state.pullbackBar=0;
      return null;
    }

    if (state.direction!==trend) {
      state.direction=trend;
      state.pullbackBar=0;
      state.lastSignalBar=0;
    }

    const tolerance=0.25*atr;
    const supportIntact=!lastL || last.l>lastL.p-0.1*atr;
    const resistanceIntact=!lastH || last.h<lastH.p+0.1*atr;
    const pullback=trend==="U"
      ? last.c<last.o && last.l<=emaValue+tolerance && supportIntact
      : last.c>last.o && last.h>=emaValue-tolerance && resistanceIntact;

    if (pullback)
      state.pullbackBar=last.t;

    if (!state.pullbackBar || curBar.t<=state.pullbackBar ||
        state.lastSignalBar===curBar.t)
      return null;

    const resumed=trend==="U"
      ? p>last.h+0.05*atr && p>emaValue && curBar.c>curBar.o
      : p<last.l-0.05*atr && p<emaValue && curBar.c<curBar.o;

    if (!resumed) return null;

    state.lastSignalBar=curBar.t;
    return trend==="U" ? "CONT_UP":"CONT_DN";
  }

  function detectCandles(B, atr, trend, pos) {
    const n = B.length;
    const c0 = B[n-1], c1 = B[n-2], c2 = B[n-3];

    const bd = b => Math.abs(b.c-b.o);
    const rg = b => b.h-b.l;
    const upB = b => b.c>b.o;
    const dnB = b => b.c<b.o;
    const uw = b => b.h-Math.max(b.o,b.c);
    const lw = b => Math.min(b.o,b.c)-b.l;

    const out = [], R0 = rg(c0), B0 = bd(c0);

    if (R0>0.3*atr && B0<0.1*R0) out.push("DOJI");

    if (R0>0.5*atr && lw(c0)>=2*B0 &&
        lw(c0)>0.55*R0 && uw(c0)<=0.25*R0 &&
        (trend==="D" || pos==="B"))
      out.push("HAMMER");

    if (R0>0.5*atr && uw(c0)>=2*B0 &&
        uw(c0)>0.55*R0 && lw(c0)<=0.25*R0 &&
        (trend==="U" || pos==="T"))
      out.push("SHOOT");

    if (dnB(c1) && upB(c0) && c0.o<=c1.c &&
        c0.c>=c1.o && B0>bd(c1) && R0>0.5*atr &&
        (trend==="D" || pos!=="T"))
      out.push("ENG_UP");

    if (upB(c1) && dnB(c0) && c0.o>=c1.c &&
        c0.c<=c1.o && B0>bd(c1) && R0>0.5*atr &&
        (trend==="U" || pos!=="B"))
      out.push("ENG_DN");

    if (dnB(c1) && upB(c0) && bd(c1)>0.6*atr &&
        B0<0.5*bd(c1) && c0.o>c1.c && c0.c<c1.o)
      out.push("HARAMI_U");

    if (upB(c1) && dnB(c0) && bd(c1)>0.6*atr &&
        B0<0.5*bd(c1) && c0.o<c1.c && c0.c>c1.o)
      out.push("HARAMI_D");

    if (dnB(c2) && bd(c2)>0.6*atr &&
        bd(c1)<0.3*bd(c2) && upB(c0) &&
        c0.c>(c2.o+c2.c)/2)
      out.push("MORN");

    if (upB(c2) && bd(c2)>0.6*atr &&
        bd(c1)<0.3*bd(c2) && dnB(c0) &&
        c0.c<(c2.o+c2.c)/2)
      out.push("EVEN");

    if (upB(c0) && upB(c1) && upB(c2) &&
        c0.c>c1.c && c1.c>c2.c &&
        bd(c0)>0.3*atr && bd(c1)>0.3*atr &&
        bd(c2)>0.3*atr && uw(c0)<0.5*B0)
      out.push("SOLD3");

    if (dnB(c0) && dnB(c1) && dnB(c2) &&
        c0.c<c1.c && c1.c<c2.c &&
        bd(c0)>0.3*atr && bd(c1)>0.3*atr &&
        bd(c2)>0.3*atr && lw(c0)<0.5*B0)
      out.push("CROW3");

    if (upB(c0) && B0>0.8*atr &&
        uw(c0)<0.1*R0 && lw(c0)<0.1*R0)
      out.push("MARU_U");

    if (dnB(c0) && B0>0.8*atr &&
        uw(c0)<0.1*R0 && lw(c0)<0.1*R0)
      out.push("MARU_D");

    if (dnB(c1) && upB(c0) &&
        Math.abs(c1.l-c0.l)<0.1*atr && R0>0.4*atr)
      out.push("TWZ_U");

    if (upB(c1) && dnB(c0) &&
        Math.abs(c1.h-c0.h)<0.1*atr && R0>0.4*atr)
      out.push("TWZ_D");

    return out;
  }

  function detectStructurePattern(B,swH,swL,atr,current) {
    if(B.length<8||!current||!(atr>0))return {pattern:null,signal:null};

    const pivots=swH.map(x=>({i:x.i,t:B[x.i].t,p:x.p,type:"H"}))
      .concat(swL.map(x=>({i:x.i,t:B[x.i].t,p:x.p,type:"L"})))
      .sort((a,b)=>a.i-b.i);
    const turns=[];
    for(const pivot of pivots){
      const prev=turns[turns.length-1];
      if(prev&&prev.type===pivot.type){
        if((pivot.type==="H"&&pivot.p>prev.p)||
           (pivot.type==="L"&&pivot.p<prev.p))
          turns[turns.length-1]=pivot;
      }else{
        turns.push(pivot);
      }
    }

    const lastClosed=B[B.length-1];
    const candidates=[];
    const lineValue=(line,t)=>{
      const span=line.b.t-line.a.t;
      return span
        ? line.a.p+(line.b.p-line.a.p)*(t-line.a.t)/span
        : line.a.p;
    };
    const makeCandidate=(
      id,name,direction,points,lines,rank,progress,confirmable=true,signals=null
    )=>{
      const span=points[points.length-1].i-points[0].i;
      if(span<3||span>30)return;
      const last=points[points.length-1];
      if(current.t-last.t>12*(Number(current.timeframe)||CFG.analysisTimeframeMs))
        return;

      const breakLine=lines.find(line=>line.kind==="neckline"||line.kind==="break");
      let candidateDirection=direction;
      let signalId=id;
      let closeLevel=breakLine?lineValue(breakLine,lastClosed.t):NaN;
      let confirmed=false;
      if(direction==="EITHER"){
        const upper=lines.find(line=>line.kind==="upperBreak");
        const lower=lines.find(line=>line.kind==="lowerBreak");
        const upperLevel=upper?lineValue(upper,lastClosed.t):NaN;
        const lowerLevel=lower?lineValue(lower,lastClosed.t):NaN;
        if(confirmable&&Number.isFinite(upperLevel)&&
           lastClosed.c>upperLevel+0.08*atr){
          candidateDirection="HIGHER";
          signalId=signals.up;
          closeLevel=upperLevel;
          confirmed=true;
        }else if(confirmable&&Number.isFinite(lowerLevel)&&
                 lastClosed.c<lowerLevel-0.08*atr){
          candidateDirection="LOWER";
          signalId=signals.down;
          closeLevel=lowerLevel;
          confirmed=true;
        }else{
          candidateDirection="NEUTRAL";
        }
      }else{
        confirmed=confirmable&&Number.isFinite(closeLevel)&&
          (direction==="LOWER"
            ? lastClosed.c<closeLevel-0.08*atr
            : lastClosed.c>closeLevel+0.08*atr);
      }
      if(!confirmable&&Number.isFinite(closeLevel)&&
         (direction==="LOWER"
           ? lastClosed.c<closeLevel-0.08*atr
           : lastClosed.c>closeLevel+0.08*atr))
        return;
      const key=points.map(x=>x.t).join("|");
      candidates.push({
        id,name,direction:candidateDirection,key,signalId,
        status:confirmed?"confirmed":"forming",
        progress,points,lines,rank,
        confirmation:{t:lastClosed.t,p:lastClosed.c,level:closeLevel}
      });
    };
    const recent=turns.filter(x=>x.i>=B.length-34).slice(-7);

    if(recent.length>=3){
      const a=recent[recent.length-3];
      const b=recent[recent.length-2];
      const c=recent[recent.length-1];
      if(a.type==="H"&&b.type==="L"&&c.type==="H"&&
         c.p>a.p+0.25*atr&&
         swH.filter(x=>x.i>=B.length-34&&x.i<a.i)
           .every(x=>x.p<c.p-0.1*atr)&&current.c<c.p+0.2*atr){
        makeCandidate("HS_TOP","Hombro-cabeza-hombro","LOWER",
          [Object.assign({tag:"H"},a),Object.assign({tag:"V"},b),Object.assign({tag:"C"},c)],
          [{kind:"neckline",a:{t:b.t,p:b.p},b:{t:current.t,p:b.p}}],
          5,"cabeza detectada; falta hombro derecho",false);
      }
      if(a.type==="L"&&b.type==="H"&&c.type==="L"&&
         c.p<a.p-0.25*atr&&
         swL.filter(x=>x.i>=B.length-34&&x.i<a.i)
           .every(x=>x.p>c.p+0.1*atr)&&current.c>c.p-0.2*atr){
        makeCandidate("HS_BOTTOM","Hombro-cabeza-hombro invertido","HIGHER",
          [Object.assign({tag:"H"},a),Object.assign({tag:"V"},b),Object.assign({tag:"C"},c)],
          [{kind:"neckline",a:{t:b.t,p:b.p},b:{t:current.t,p:b.p}}],
          5,"cabeza invertida; falta hombro derecho",false);
      }
    }

    const recentHighs=swH.filter(x=>x.i>=B.length-34)
      .map(x=>Object.assign({t:B[x.i].t},x));
    for(let second=recentHighs.length-1;second>0;second--){
      const right=recentHighs[second];
      for(let first=second-1;first>=0;first--){
        const left=recentHighs[first];
        if(right.i-left.i<3||right.i-left.i>30||
           Math.abs(left.p-right.p)>0.55*atr)continue;
        const troughs=swL.filter(x=>x.i>left.i&&x.i<right.i)
          .map(x=>Object.assign({t:B[x.i].t},x));
        if(!troughs.length)continue;
        const valley=troughs.reduce((x,y)=>y.p<x.p?y:x);
        if(Math.min(left.p,right.p)-valley.p<0.65*atr||
           current.c>Math.max(left.p,right.p)+0.3*atr)continue;
        makeCandidate("DTOP","Doble techo","LOWER",
          [Object.assign({tag:"1"},left),
            Object.assign({tag:"valle"},valley),
            Object.assign({tag:"2"},right)],
          [{kind:"neckline",a:{t:valley.t,p:valley.p},
            b:{t:current.t,p:valley.p}}],
          4,"2/2 techos; esperando ruptura del valle");
        break;
      }
    }

    const recentLows=swL.filter(x=>x.i>=B.length-34)
      .map(x=>Object.assign({t:B[x.i].t},x));
    for(let second=recentLows.length-1;second>0;second--){
      const right=recentLows[second];
      for(let first=second-1;first>=0;first--){
        const left=recentLows[first];
        if(right.i-left.i<3||right.i-left.i>30||
           Math.abs(left.p-right.p)>0.55*atr)continue;
        const peaks=swH.filter(x=>x.i>left.i&&x.i<right.i)
          .map(x=>Object.assign({t:B[x.i].t},x));
        if(!peaks.length)continue;
        const peak=peaks.reduce((x,y)=>y.p>x.p?y:x);
        if(peak.p-Math.max(left.p,right.p)<0.65*atr||
           current.c<Math.min(left.p,right.p)-0.3*atr)continue;
        makeCandidate("DBOT","Doble suelo","HIGHER",
          [Object.assign({tag:"1"},left),
            Object.assign({tag:"pico"},peak),
            Object.assign({tag:"2"},right)],
          [{kind:"neckline",a:{t:peak.t,p:peak.p},
            b:{t:current.t,p:peak.p}}],
          4,"2/2 suelos; esperando ruptura del pico");
        break;
      }
    }

    for(let second=recentHighs.length-1;second>0;second--){
      const right=recentHighs[second];
      const handles=recentLows.filter(x=>x.i>right.i&&x.i-right.i<=8);
      if(!handles.length)continue;
      const handle=handles[handles.length-1];
      for(let first=second-1;first>=0;first--){
        const left=recentHighs[first];
        const cupBars=right.i-left.i;
        if(cupBars<8||cupBars>30||
           Math.abs(left.p-right.p)>0.55*atr)continue;
        const bottoms=swL.filter(x=>x.i>left.i&&x.i<right.i)
          .map(x=>Object.assign({t:B[x.i].t},x));
        if(!bottoms.length)continue;
        const bottom=bottoms.reduce((x,y)=>y.p<x.p?y:x);
        const rim=Math.max(left.p,right.p);
        const depth=rim-bottom.p;
        if(depth<1.5*atr||handle.p<=right.p-depth*0.5||
           handle.p>right.p+0.1*atr)continue;
        makeCandidate("CUP_HANDLE_UP","Taza con asa","HIGHER",
          [
            Object.assign({tag:"R"},left),
            Object.assign({tag:"C"},bottom),
            Object.assign({tag:"R"},right),
            Object.assign({tag:"A"},handle)
          ].sort((a,b)=>a.i-b.i),
          [{kind:"break",a:{t:left.t,p:rim},b:{t:current.t,p:rim}}],
          7,"taza y asa formadas; esperando ruptura del rim");
        break;
      }
    }

    for(let second=recentLows.length-1;second>0;second--){
      const right=recentLows[second];
      const handles=recentHighs.filter(x=>x.i>right.i&&x.i-right.i<=8);
      if(!handles.length)continue;
      const handle=handles[handles.length-1];
      for(let first=second-1;first>=0;first--){
        const left=recentLows[first];
        const cupBars=right.i-left.i;
        if(cupBars<8||cupBars>30||
           Math.abs(left.p-right.p)>0.55*atr)continue;
        const tops=swH.filter(x=>x.i>left.i&&x.i<right.i)
          .map(x=>Object.assign({t:B[x.i].t},x));
        if(!tops.length)continue;
        const top=tops.reduce((x,y)=>y.p>x.p?y:x);
        const rim=Math.min(left.p,right.p);
        const depth=top.p-rim;
        if(depth<1.5*atr||handle.p>=right.p+depth*0.5||
           handle.p<right.p-0.1*atr)continue;
        makeCandidate("CUP_HANDLE_DN","Taza con asa invertida","LOWER",
          [
            Object.assign({tag:"R"},left),
            Object.assign({tag:"C"},top),
            Object.assign({tag:"R"},right),
            Object.assign({tag:"A"},handle)
          ].sort((a,b)=>a.i-b.i),
          [{kind:"break",a:{t:left.t,p:rim},b:{t:current.t,p:rim}}],
          7,"taza invertida y asa formadas; esperando ruptura");
        break;
      }
    }

    if(recent.length>=5){
      const q=recent.slice(-5);
      const [a,b,c,d,e]=q;
      if(q.every((x,i)=>x.type===(i%2===0?"H":"L"))&&
         c.p>a.p+0.25*atr&&c.p>e.p+0.25*atr&&
         Math.abs(a.p-e.p)<=0.8*atr){
        makeCandidate("HS_TOP","Hombro-cabeza-hombro","LOWER",
          [Object.assign({tag:"H"},a),Object.assign({tag:"V"},b),
            Object.assign({tag:"C"},c),Object.assign({tag:"V"},d),
            Object.assign({tag:"H"},e)],
          [{kind:"neckline",a:{t:b.t,p:b.p},b:{t:d.t,p:d.p}}],
          7,"hombros y cabeza completos; esperando ruptura del cuello");
      }
      if(q.every((x,i)=>x.type===(i%2===0?"L":"H"))&&
         c.p<a.p-0.25*atr&&c.p<e.p-0.25*atr&&
         Math.abs(a.p-e.p)<=0.8*atr){
        makeCandidate("HS_BOTTOM","Hombro-cabeza-hombro invertido","HIGHER",
          [Object.assign({tag:"H"},a),Object.assign({tag:"V"},b),
            Object.assign({tag:"C"},c),Object.assign({tag:"V"},d),
            Object.assign({tag:"H"},e)],
          [{kind:"neckline",a:{t:b.t,p:b.p},b:{t:d.t,p:d.p}}],
          7,"hombros y cabeza completos; esperando ruptura del cuello");
      }
    }

    const highs=swH.filter(x=>x.i>=B.length-34).slice(-3)
      .map(x=>({i:x.i,t:B[x.i].t,p:x.p,type:"H",tag:"R"}));
    const lows=swL.filter(x=>x.i>=B.length-34).slice(-3)
      .map(x=>({i:x.i,t:B[x.i].t,p:x.p,type:"L",tag:"S"}));
    if(highs.length>=2&&lows.length>=2){
      const span=Math.max(highs[highs.length-1].i,lows[lows.length-1].i)-
        Math.min(highs[0].i,lows[0].i);
      const top=Math.max(...highs.map(x=>x.p));
      const bottom=Math.min(...lows.map(x=>x.p));
      const lastHigh=highs[highs.length-1];
      const lastLow=lows[lows.length-1];
      const topLine={kind:"resistance",a:highs[0],b:lastHigh};
      const bottomLine={kind:"support",a:lows[0],b:lastLow};
      const topNow=lineValue(topLine,lastClosed.t);
      const bottomNow=lineValue(bottomLine,lastClosed.t);

      if(span<=30&&Math.max(...highs.map(x=>x.p))-Math.min(...highs.map(x=>x.p))<=0.55*atr&&
         lastLow.p-lows[0].p>=0.45*atr&&
         Math.max(...lows.map(x=>x.p))<Math.min(...highs.map(x=>x.p))){
        makeCandidate("TRI_ASC","Triángulo ascendente","HIGHER",
          highs.concat(lows).sort((x,y)=>x.i-y.i),
          [
            {kind:"resistance",a:highs[0],b:lastHigh},
            {kind:"support",a:lows[0],b:lastLow},
            {kind:"break",a:{t:highs[0].t,p:top},b:{t:lastClosed.t,p:topNow}}
          ],6,`${highs.length} techos; mínimos ascendentes`);
      }
      if(span<=30&&Math.max(...lows.map(x=>x.p))-Math.min(...lows.map(x=>x.p))<=0.55*atr&&
         highs[0].p-lastHigh.p>=0.45*atr&&
         Math.min(...highs.map(x=>x.p))>Math.max(...lows.map(x=>x.p))){
        makeCandidate("TRI_DESC","Triángulo descendente","LOWER",
          highs.concat(lows).sort((x,y)=>x.i-y.i),
          [
            {kind:"support",a:lows[0],b:lastLow},
            {kind:"resistance",a:highs[0],b:lastHigh},
            {kind:"break",a:{t:lows[0].t,p:bottom},b:{t:lastClosed.t,p:bottomNow}}
          ],6,`${lows.length} suelos; máximos descendentes`);
      }

      const highDelta=lastHigh.p-highs[0].p;
      const lowDelta=lastLow.p-lows[0].p;
      const startT=Math.max(highs[0].t,lows[0].t);
      const endT=Math.max(lastHigh.t,lastLow.t);
      const gapStart=lineValue(topLine,startT)-lineValue(bottomLine,startT);
      const gapEnd=lineValue(topLine,endT)-lineValue(bottomLine,endT);

      if(span<=30&&highDelta<=-0.35*atr&&lowDelta>=0.35*atr&&
         gapStart>0.8*atr&&gapEnd>0&&gapEnd<0.8*gapStart){
        const upperBreak={
          kind:"upperBreak",a:topLine.a,b:topLine.b
        };
        const lowerBreak={
          kind:"lowerBreak",a:bottomLine.a,b:bottomLine.b
        };
        makeCandidate("TRI_SYM","Triángulo simétrico","EITHER",
          highs.concat(lows).sort((x,y)=>x.i-y.i),
          [upperBreak,lowerBreak],6,
          "máximos descendentes y mínimos ascendentes",true,
          {up:"TRI_SYM_UP",down:"TRI_SYM_DN"});
      }

      if(highs.length>=2&&lows.length>=2&&span<=30){
        const risingGapStart=lineValue(topLine,startT)-lineValue(bottomLine,startT);
        const risingGapEnd=lineValue(topLine,current.t)-lineValue(bottomLine,current.t);
        if(highDelta>=0.35*atr&&lowDelta>highDelta+0.1*atr&&
           risingGapStart>0.8*atr&&risingGapEnd>0&&
           risingGapEnd<0.8*risingGapStart){
          makeCandidate("WEDGE_RISE","Cuña ascendente","LOWER",
            highs.concat(lows).sort((x,y)=>x.i-y.i),
            [
              {kind:"resistance",a:topLine.a,b:topLine.b},
              {kind:"neckline",a:bottomLine.a,b:bottomLine.b}
            ],6,"máximos y mínimos ascendentes que convergen");
        }

        const fallingGapEnd=lineValue(topLine,current.t)-lineValue(bottomLine,current.t);
        if(highDelta<=-0.35*atr&&highDelta<lowDelta-0.1*atr&&
           risingGapStart>0.8*atr&&fallingGapEnd>0&&
           fallingGapEnd<0.8*risingGapStart){
          makeCandidate("WEDGE_FALL","Cuña descendente","HIGHER",
            highs.concat(lows).sort((x,y)=>x.i-y.i),
            [
              {kind:"neckline",a:topLine.a,b:topLine.b},
              {kind:"support",a:bottomLine.a,b:bottomLine.b}
            ],6,"máximos y mínimos descendentes que convergen");
        }
      }

      if(span<=30&&highs.length>=2&&lows.length>=2&&
         Math.max(...highs.map(x=>x.p))-Math.min(...highs.map(x=>x.p))<=0.55*atr&&
         Math.max(...lows.map(x=>x.p))-Math.min(...lows.map(x=>x.p))<=0.55*atr&&
         top-bottom>=0.8*atr){
        const upperBreak={
          kind:"upperBreak",
          a:{t:highs[0].t,p:top},
          b:{t:lastClosed.t,p:top}
        };
        const lowerBreak={
          kind:"lowerBreak",
          a:{t:lows[0].t,p:bottom},
          b:{t:lastClosed.t,p:bottom}
        };
        makeCandidate("RECT","Rectángulo","EITHER",
          highs.concat(lows).sort((x,y)=>x.i-y.i),
          [upperBreak,lowerBreak],6,
          "rango horizontal; esperando ruptura",true,
          {up:"RECT_UP",down:"RECT_DN"});
      }
    }

    for(const windowEnd of [B.length-1,B.length-2]){
      for(const consolidationBars of [5,4]){
        const consolidationStart=windowEnd-consolidationBars+1;
        const poleStart=consolidationStart-5;
        if(poleStart<0)continue;
        const consolidation=B.slice(consolidationStart,windowEnd+1);
        const lastSample=consolidation.length-1;
        const highsInConsolidation=consolidation.map((bar,i)=>({
          i:consolidationStart+i,t:bar.t,p:bar.h,type:"H",tag:"R"
        }));
        const lowsInConsolidation=consolidation.map((bar,i)=>({
          i:consolidationStart+i,t:bar.t,p:bar.l,type:"L",tag:"S"
        }));
        const highChange=highsInConsolidation[lastSample].p-
          highsInConsolidation[0].p;
        const lowChange=lowsInConsolidation[lastSample].p-
          lowsInConsolidation[0].p;
        const highLine={
          kind:"resistance",
          a:highsInConsolidation[0],
          b:highsInConsolidation[lastSample]
        };
        const lowLine={
          kind:"support",
          a:lowsInConsolidation[0],
          b:lowsInConsolidation[lastSample]
        };
        const pole=B.slice(poleStart,consolidationStart);
        const poleHigh=pole.reduce((best,bar,i)=>
          bar.h>best.p?{p:bar.h,i:poleStart+i,t:bar.t}:best,
          {p:-Infinity,i:-1,t:0});
        const poleLow=pole.reduce((best,bar,i)=>
          bar.l<best.p?{p:bar.l,i:poleStart+i,t:bar.t}:best,
          {p:Infinity,i:-1,t:0});
        const minConsolidationLow=Math.min(...lowsInConsolidation.map(x=>x.p));
        const maxConsolidationHigh=Math.max(...highsInConsolidation.map(x=>x.p));
        const poleUp=poleHigh.p-B[poleStart].o;
        const poleDown=B[poleStart].o-poleLow.p;
        const bullRetracement=(poleHigh.p-minConsolidationLow)/poleUp;
        const bearRetracement=(maxConsolidationHigh-poleLow.p)/poleDown;
        const converging=highChange<-0.15*atr&&lowChange>0.15*atr&&
          lineValue(highLine,lastClosed.t)>lineValue(lowLine,lastClosed.t);
        const parallel=highChange<0&&lowChange<0&&
          Math.abs(highChange-lowChange)<=0.35*atr;
        const risingParallel=highChange>0&&lowChange>0&&
          Math.abs(highChange-lowChange)<=0.35*atr;
        const patternPoints=[
          {i:poleStart,t:B[poleStart].t,p:B[poleStart].o,tag:"P"},
          poleHigh,poleLow,
          highsInConsolidation[0],highsInConsolidation[lastSample],
          lowsInConsolidation[0],lowsInConsolidation[lastSample]
        ].filter(point=>point.i>=0)
          .sort((a,b)=>a.i-b.i);

        if(poleUp>=1.5*atr&&poleHigh.i>=poleStart+2&&
           bullRetracement>=0.05&&bullRetracement<=0.65){
          const breakout={
            kind:"break",a:highLine.a,
            b:{t:lastClosed.t,p:lineValue(highLine,lastClosed.t)}
          };
          const formationLines=[highLine,lowLine,breakout];
          if(parallel)
            makeCandidate("FLAG_UP","Bandera alcista","HIGHER",
              patternPoints,formationLines,5,
              "impulso alcista y canal de pausa");
          if(converging)
            makeCandidate("PENNANT_UP","Banderín alcista","HIGHER",
              patternPoints,formationLines,5,
              "impulso alcista y consolidación convergente");
        }

        if(poleDown>=1.5*atr&&poleLow.i>=poleStart+2&&
           bearRetracement>=0.05&&bearRetracement<=0.65){
          const breakout={
            kind:"break",a:lowLine.a,
            b:{t:lastClosed.t,p:lineValue(lowLine,lastClosed.t)}
          };
          const formationLines=[highLine,lowLine,breakout];
          if(risingParallel)
            makeCandidate("FLAG_DN","Bandera bajista","LOWER",
              patternPoints,formationLines,5,
              "impulso bajista y canal de pausa");
          if(converging)
            makeCandidate("PENNANT_DN","Banderín bajista","LOWER",
              patternPoints,formationLines,5,
              "impulso bajista y consolidación convergente");
        }
      }
    }

    candidates.sort((a,b)=>
      b.rank-a.rank||
      Number(b.status==="confirmed")-Number(a.status==="confirmed")||
      b.points[b.points.length-1].i-a.points[a.points.length-1].i
    );
    const pattern=candidates[0]||null;
    const confirmedPattern=candidates.find(x=>x.status==="confirmed")||null;
    let signal=null;
    if(!confirmedPattern)
      lastStructurePatternSignal=null;
    if(confirmedPattern){
      const previousPoints=lastStructurePatternSignal
        ? lastStructurePatternSignal.points : [];
      const currentPoints=confirmedPattern.points.map(point=>point.t);
      const shared=currentPoints.filter(t=>previousPoints.includes(t)).length;
      const overlap=shared/Math.max(1,Math.min(
        currentPoints.length,previousPoints.length
      ));
      const sameFormation=lastStructurePatternSignal&&
        (lastStructurePatternSignal.id===confirmedPattern.signalId
          ? overlap>=0.5
          : overlap>=0.8);
      if(!sameFormation)
        signal=confirmedPattern.signalId;
    }

    return {pattern,signal,confirmedPattern};
  }

  function analyze(p, say, horizonMs) {
    const B = bars, n = B.length;
    const sequenceSignal = sequenceStep(B,curBar,p,horizonMs,say);

    if (n<7 || !curBar || p==null) {
      S = {
        trend:"R", pos:"M", pat:"NONE", atr:S.atr,
        swH:[], swL:[], bias:0, lvl:"N", lvlT:0, mom:0,
        retests:retestState,
        variablePattern:seqState,
        structurePattern:null,
        structure:{
          trend:"R", sequence:"R", event:"NONE",
          bias:0, lastHigh:0, lastLow:0
        }
      };

      return [];
    }

    const K = CFG.swingK;
    let atr = 0;
    const m = Math.min(14,n);

    for (let i=n-m; i<n; i++)
      atr += B[i].h-B[i].l;

    atr /= m;
    if (!(atr>0)) atr=1e-5;

    // Pivotes confirmados.
    const swH=[], swL=[];

    for (let i=K; i<n-K; i++) {
      let hi=true, lo=true;

      for (let j=1; j<=K; j++) {
        if (!(B[i].h>B[i-j].h && B[i].h>=B[i+j].h))
          hi=false;

        if (!(B[i].l<B[i-j].l && B[i].l<=B[i+j].l))
          lo=false;
      }

      if (hi) swH.push({i,p:B[i].h});
      if (lo) swL.push({i,p:B[i].l});
    }

    let trend="R";

    if (swH.length>=2 && swL.length>=2) {
      const h1=swH[swH.length-2].p;
      const h2=swH[swH.length-1].p;
      const l1=swL[swL.length-2].p;
      const l2=swL[swL.length-1].p;

      if (h2>h1 && l2>l1) trend="U";
      else if (h2<h1 && l2<l1) trend="D";
    }

    if (trend==="R") {
      const w=Math.min(12,n);
      const sl=B[n-1].c-B[n-w].c;

      if (sl>1.2*atr) trend="U";
      else if (sl<-1.2*atr) trend="D";
    }

    let hi=p, lo=p;

    for (let i=Math.max(0,n-30); i<n; i++) {
      if (B[i].h>hi) hi=B[i].h;
      if (B[i].l<lo) lo=B[i].l;
    }

    const rel=hi>lo ? (p-lo)/(hi-lo) : 0.5;
    const pos=rel<0.33 ? "B" : rel>0.67 ? "T" : "M";
    const now=performance.now();

    if (prevTrend!==null && trend!==prevTrend) {
      say(
        "📐",
        trend==="U" ? "La tendencia pasa a ALCISTA" :
        trend==="D" ? "La tendencia pasa a BAJISTA" :
        "El precio queda LATERAL: sin tendencia clara",
        "tr"+trend
      );
    }

    prevTrend=trend;

    const lhp=swH.length ? swH[swH.length-1].p : 0;
    const llp=swL.length ? swL[swL.length-1].p : 0;

    if (lastSwHp && lhp && lhp!==lastSwHp)
      say("📍",`Nuevo máximo de oscilación en ${lhp.toFixed(5)}`,"swh"+lhp);

    if (lastSwLp && llp && llp!==lastSwLp)
      say("📍",`Nuevo mínimo de oscilación en ${llp.toFixed(5)}`,"swl"+llp);

    lastSwHp=lhp;
    lastSwLp=llp;

    const lv=levelNear(swH,swL,p,atr);
    const closes=B.map(b=>b.c);
    closes.push(p);

    const e9=ema(closes,9);
    const e9p=ema(closes.slice(0,-3),9);
    const slope=(e9-e9p)/atr;

    const mom=slope>0.25 && p>e9 ? 1 :
      slope<-0.25 && p<e9 ? -1 : 0;

    const last=B[n-1], prv=B[n-2], cb=curBar;
    const lastH=swH.length ? swH[swH.length-1] : null;
    const lastL=swL.length ? swL[swL.length-1] : null;
    const continuationSignal=updateContinuation(
      continuationState,trend,last,cb,p,e9,atr,lastH,lastL
    );

    if (brk) {
      brk.ext=Math.max(
        brk.ext,
        brk.dir==="U" ? p-brk.lvl : brk.lvl-p
      );

      if (now-brk.t>90000) brk=null;
    }

    const retests=updateRetests(last,swH,swL,p,atr);
    const structureResult=detectStructurePattern(B,swH,swL,atr,cb);
    const structurePattern=structureResult.pattern;

    const act={};
    if (continuationSignal)
      act[continuationSignal]=1;
    if(structureResult.signal)
      act[structureResult.signal]=1;

    // Estructura HH/HL o LH/LL.
    const hPrev=swH.length>=2 ? swH[swH.length-2].p : 0;
    const lPrev=swL.length>=2 ? swL[swL.length-2].p : 0;

    const seqUp=!!(
      hPrev && lPrev && lastH && lastL &&
      lastH.p>hPrev && lastL.p>lPrev
    );

    const seqDown=!!(
      hPrev && lPrev && lastH && lastL &&
      lastH.p<hPrev && lastL.p<lPrev
    );

    const structTrend=seqUp ? "U" : seqDown ? "D" : "R";

    const breakUp=!!(lastH && p>lastH.p+0.12*atr);
    const breakDown=!!(lastL && p<lastL.p-0.12*atr);

    if (breakUp) {
      if (structTrend==="D" || trend==="D")
        act.ST_CHOCH_U=1;
      else
        act.ST_BOS_U=1;

      act.BRK_UP=1;
    }

    if (breakDown) {
      if (structTrend==="U" || trend==="U")
        act.ST_CHOCH_D=1;
      else
        act.ST_BOS_D=1;

      act.BRK_DN=1;
    }

    if (CFG.strategyRequireClosedBar) {
      if (lastH && last.h>lastH.p+0.08*atr &&
          last.c<lastH.p-0.02*atr)
        act.ST_SWEEP_H=1;

      if (lastL && last.l<lastL.p-0.08*atr &&
          last.c>lastL.p+0.02*atr)
        act.ST_SWEEP_L=1;
    } else {
      if (lastH && cb.h>lastH.p+0.08*atr &&
          p<lastH.p-0.02*atr)
        act.ST_SWEEP_H=1;

      if (lastL && cb.l<lastL.p-0.08*atr &&
          p>lastL.p+0.02*atr)
        act.ST_SWEEP_L=1;
    }

    // Retesteos posteriores a la ruptura.
    if (structBreak && now-structBreak.t<=90000) {
      if (
        structBreak.dir==="U" &&
        cb.l<=structBreak.level+0.15*atr &&
        p>structBreak.level+0.05*atr
      )
        act.ST_RET_U=1;

      if (
        structBreak.dir==="D" &&
        cb.h>=structBreak.level-0.15*atr &&
        p<structBreak.level-0.05*atr
      )
        act.ST_RET_D=1;
    }

    if (breakUp)
      structBreak={dir:"U",level:lastH.p,t:now};

    if (breakDown)
      structBreak={dir:"D",level:lastL.p,t:now};

    if (structBreak && now-structBreak.t>90000)
      structBreak=null;

    if (
      trend==="U" &&
      last.c<last.o &&
      prv.c<prv.o &&
      cb.c>cb.o &&
      p-cb.o>0.2*atr
    )
      act.PULL_U=1;

    if (
      trend==="D" &&
      last.c>last.o &&
      prv.c>prv.o &&
      cb.c<cb.o &&
      cb.o-p>0.2*atr
    )
      act.PULL_D=1;

    const body=Math.abs(last.c-last.o);
    const range=last.h-last.l;
    const upW=last.h-Math.max(last.o,last.c);
    const dnW=Math.min(last.o,last.c)-last.l;

    if (range>0.6*atr && upW>2*body &&
        upW>0.5*range && pos==="T")
      act.REJ_T=1;

    if (range>0.6*atr && dnW>2*body &&
        dnW>0.5*range && pos==="B")
      act.REJ_B=1;

    if (last.h<prv.h && last.l>prv.l &&
        prv.h-prv.l>0.5*atr) {
      if (p>prv.h+0.1*atr) act.INS_UP=1;
      if (p<prv.l-0.1*atr) act.INS_DN=1;
    }

    if (brk && brk.ext>0.5*atr) {
      if (
        brk.dir==="U" &&
        p>=brk.lvl-0.1*atr &&
        p<=brk.lvl+0.3*atr &&
        cb.c>cb.o
      )
        act.RET_UP=1;

      if (
        brk.dir==="D" &&
        p<=brk.lvl+0.1*atr &&
        p>=brk.lvl-0.3*atr &&
        cb.c<cb.o
      )
        act.RET_DN=1;
    }

    if (lv) {
      if (
        lv.k==="S" &&
        cb.l<=lv.p+0.2*atr &&
        p-cb.l>0.3*atr &&
        cb.c>cb.o
      )
        act.LVL_B=1;

      if (
        lv.k==="R" &&
        cb.h>=lv.p-0.2*atr &&
        cb.h-p>0.3*atr &&
        cb.c<cb.o
      )
        act.LVL_T=1;
    }

    const fired=[];
    if (sequenceSignal) fired.push(sequenceSignal);
    let cur="NONE";

    for (const nm of STRUCT) {
      if (act[nm]) {
        if (cur==="NONE") cur=nm;

        const confirmedStructureSignal=structureResult.signal===nm;
        const cooldownElapsed=!patLast[nm]||
          now-patLast[nm]>CFG.patCooldownMs;
        if (
          cooldownElapsed&&
          (confirmedStructureSignal||!patState[nm])
        ) {
          patLast[nm]=now;
          fired.push(nm);
          seenInc(nm);
          if(confirmedStructureSignal)
            lastStructurePatternSignal={
              id:nm,
              points:structureResult.confirmedPattern.points
                .map(point=>point.t)
            };

          if (nm==="BRK_UP" && lastH)
            brk={dir:"U",lvl:lastH.p,t:now,ext:0};

          if (nm==="BRK_DN" && lastL)
            brk={dir:"D",lvl:lastL.p,t:now,ext:0};
        }
      }

      patState[nm]=!!act[nm];
    }

    if (retests.signal) {
      const nm=retests.signal;
      patLast[nm]=now;
      fired.push(nm);
      seenInc(nm);
    }

    if (last.t!==cdlBarT) {
      cdlBarT=last.t;
      const names=detectCandles(B,atr,trend,pos);

      cdlNow={
        t:last.t,
        names,
        color:last.c>=last.o ? "verde" : "roja"
      };

      names.forEach(nm=>{
        seenInc(nm);
        if (PAT_DIR[nm]) fired.push(nm);
      });

      if (names.some(x=>x!=="DOJI")) {
        say(
          "🕯",
          `Cerró vela ${cdlNow.color}: ${names.map(nm=>PATN[nm]).join(" + ")}`,
          "cdl"+last.t
        );
      }
    }

    // Confluencia: tendencia, nivel, momentum, velas y estructura.
    let bias=0;
    const parts=[];

    if (trend!=="R") {
      bias+=trend==="U" ? 1 : -1;
      parts.push("tendencia "+(trend==="U" ? "alcista":"bajista"));
    }

    if (lv) {
      bias+=lv.k==="S" ? 1 : -1;
      parts.push(`${lv.k==="S" ? "soporte":"resistencia"} de ${lv.t} toques`);
    }

    if (mom) {
      bias+=mom;
      parts.push("momentum "+(mom>0 ? "alcista":"bajista"));
    }

    let cd=0;

    for (const nm of cdlNow.names) {
      if (nm!=="DOJI" && PAT_DIR[nm])
        cd+=PAT_DIR[nm]==="HIGHER" ? 1 : -1;
    }

    cd=Math.max(-2,Math.min(2,cd));

    if (cd) {
      bias+=cd;
      parts.push("velas "+(cd>0 ? "alcistas":"bajistas"));
    }

    if (cur!=="NONE" && PAT_DIR[cur]) {
      bias+=PAT_DIR[cur]==="HIGHER" ? 1 : -1;
      parts.push(PATN[cur]);
    }

    const structEvent=[
      "ST_CHOCH_U","ST_CHOCH_D","ST_BOS_U","ST_BOS_D",
      "ST_SWEEP_H","ST_SWEEP_L","ST_RET_U","ST_RET_D"
    ].find(x=>act[x]) || "NONE";

    const structDir =
      ["ST_CHOCH_U","ST_BOS_U","ST_SWEEP_L","ST_RET_U"].includes(structEvent) ? 1 :
      ["ST_CHOCH_D","ST_BOS_D","ST_SWEEP_H","ST_RET_D"].includes(structEvent) ? -1 : 0;

    const structBias=structTrend==="U" ? 1 :
      structTrend==="D" ? -1 : 0;

    bias+=structBias;

    if (structDir) bias+=structDir;

    if (structEvent!=="NONE") {
      say(
        "🏗️",
        `Estructura: ${PATN[structEvent]} · ${
          seqUp ? "HH/HL" : seqDown ? "LH/LL" : "sin secuencia confirmada"
        }`,
        "st"+structEvent
      );
    }

    const bb=bias>=2 ? 1 : bias<=-2 ? -1 : 0;

    if (bb!==lastBB) {
      if (bb!==0) {
        say(
          "🧭",
          `Acción del precio: confluencia ${
            bb>0 ? "ALCISTA":"BAJISTA"
          } (${bias>0?"+":""}${bias}): ${parts.join(", ")}`,
          "pa"+bb
        );
      }

      lastBB=bb;
    }

    S={
      trend,pos,pat:cur,atr,swH,swL,bias,
      lvl:lv ? lv.k : "N",
      lvlT:lv ? lv.t : 0,
      mom,
      retests:{
        support:retests.support,
        resistance:retests.resistance
      },
      variablePattern:seqState,
      structurePattern,
      structure:{
        trend:structTrend,
        sequence:seqUp ? "HH/HL" : seqDown ? "LH/LL" : "R",
        event:structEvent,
        // El evento confirmado pesa más que la tendencia aislada.
        bias:2*structDir+structBias,
        lastHigh:lastH ? lastH.p : 0,
        lastLow:lastL ? lastL.p : 0
      }
    };

    return fired;
  }

  // =========================================================
  // APRENDIZAJE POR REFUERZO
  // =========================================================

  const ent=k=>rl.Q[k] || (rl.Q[k]={
    f:{n:0,m:0,v:0},
    x:{n:0,m:0,v:0},
    W:0,
    N:0,
    recentW:0,
    recentN:0
  });

  function upd(st,r) {
    st.n=Math.min(st.n+1,CFG.rlCap);
    const a=1/st.n, d=r-st.m;
    st.m+=a*d;
    st.v+=a*(d*(r-st.m)-st.v);
  }

  const lcb=st=>{
    const n=Math.min(st.n,CFG.rlCap);
    return n>0
      ? st.m-CFG.rlZ*Math.sqrt(Math.max(st.v,1e-6)/n)
      : -Infinity;
  };

  function updateHits(e,win) {
    if (!Number.isFinite(e.recentN) || !Number.isFinite(e.recentW)) {
      e.recentN=Math.min(Number(e.N)||0,CFG.rlCap);
      e.recentW=e.N ? (e.W/e.N)*e.recentN : 0;
    }

    if (e.recentN<CFG.rlCap) {
      e.recentN++;
      if (win) e.recentW++;
    } else {
      e.recentW+=(win ? 1:0)-e.recentW/e.recentN;
    }

    e.N=(Number(e.N)||0)+1;
    if (win) e.W=(Number(e.W)||0)+1;
  }

  function confOf(dir) {
    const a=(S.bias||0)*(dir==="HIGHER" ? 1 : -1);
    return a>=2 ? "C+" : a<=-2 ? "C-" : "C0";
  }

  function keysFor(src,dir,patName) {
    const pat=patName || S.pat;

    const rel=S.trend==="R" ? "R" :
      ((S.trend==="U")===(dir==="HIGHER") ? "W":"A");

    const st=S.structure
      ? S.structure.sequence+":"+S.structure.event
      : "R:NONE";

    const base=[
      `${src}|${pat}|${rel}|${S.pos}|${st}`,
      `${src}|${pat}|${rel}`,
      `${src}|${pat}`,
      src
    ];

    if (src==="PAT") return base;

    return [
      `${src}|${pat}|${rel}|${S.pos}|${confOf(dir)}`
    ].concat(base);
  }

  function recordUserFlow(dir,at=Date.now()) {
    if (!["HIGHER","LOWER"].includes(dir)) return;

    const timeframe=curBar && Number.isFinite(curBar.timeframe)
      ? curBar.timeframe
      : CFG.analysisTimeframeMs;
    const phase=curBar && Number.isFinite(curBar.t) && timeframe>0
      ? Math.max(0,Math.min(1,(at-curBar.t)/timeframe))
      : null;
    const flow=rl.userFlow;

    flow.samples.push({at,dir,phase,timeframe});
    if (flow.samples.length>CFG.rlCap)
      flow.samples.shift();
    flow.lastActionAt=at;
    flow.lastActionPhase=phase;
    flow.lastActionTimeframe=timeframe;
    rlDirty=true;
  }

  function userFlowFor() {
    const flow=rl.userFlow;
    if (!flow || !Array.isArray(flow.samples)) return null;

    const samples=flow.samples.filter(s=>
      s && Number.isFinite(s.at) &&
      (s.dir==="HIGHER"||s.dir==="LOWER") &&
      Number.isFinite(s.phase)
    ).slice(-5);
    if (samples.length<2) return null;

    const intervals=[];
    for(let i=1;i<samples.length;i++){
      const gap=samples[i].at-samples[i-1].at;
      if(gap>0)intervals.push(gap);
    }
    if(!intervals.length)return null;

    intervals.sort((a,b)=>a-b);
    const mid=intervals.length>>1;
    const intervalMs=intervals.length%2
      ? intervals[mid]
      : (intervals[mid-1]+intervals[mid])/2;
    const higher=samples.filter(s=>s.dir==="HIGHER").length;
    const lower=samples.length-higher;
    const latest=samples[samples.length-1];
    const timeframe=Number(flow.lastActionTimeframe)||
      Number(latest.timeframe)||CFG.analysisTimeframeMs;
    const basePhase=Number.isFinite(flow.lastActionPhase)
      ? flow.lastActionPhase
      : latest.phase;
    const phase=(basePhase+(intervalMs%timeframe)/timeframe)%1;

    return {
      direction:higher===lower
        ? latest.dir
        : higher>lower ? "HIGHER":"LOWER",
      phase,
      intervalMs,
      entries:samples.length,
      lastActionAt:Number(flow.lastActionAt)||latest.at
    };
  }

  function markUserFlowAction(at=Date.now()) {
    if (!rl.userFlow || typeof rl.userFlow!=="object")
      rl.userFlow={samples:[],lastActionAt:0};

    const timeframe=curBar && Number.isFinite(curBar.timeframe)
      ? curBar.timeframe
      : CFG.analysisTimeframeMs;
    rl.userFlow.lastActionPhase=curBar && Number.isFinite(curBar.t)
      ? Math.max(0,Math.min(1,(at-curBar.t)/timeframe))
      : null;
    rl.userFlow.lastActionTimeframe=timeframe;
    rl.userFlow.lastActionAt=at;
    rlDirty=true;
  }

  function policy(keys,mn=CFG.rlMinN) {
    for (const k of keys) {
      const e=rl.Q[k];

      if (!e || e.f.n<mn) continue;

      const lf=lcb(e.f);
      const lx=lcb(e.x);

      if (lf>CFG.rlMinEdge && lf>=lx)
        return {a:"FOLLOW",k};

      if (lx>CFG.rlMinEdge && lx>lf)
        return {a:"FADE",k};

      return {a:"SKIP",k};
    }

    return {a:"UNK",k:""};
  }

  function probFor(src,dir,patName,mn=CFG.rlMinN) {
    for (const k of keysFor(src,dir,patName)) {
      const e=rl.Q[k];
      const recentN=e && (e.recentN || e.N);
      if (e && recentN>=mn) {
        return {
          key:k,
          n:recentN,
          p:e.recentN ? e.recentW/e.recentN : e.W/e.N,
          lcb:lcb(e.f)
        };
      }
    }

    return null;
  }

  function recordSample(p,expMs,src,dir,keys,patName,isUser=false) {
    if (p==null) return null;

    if (isUser) recordUserFlow(dir);

    const s={
      exp:performance.now()+expMs,
      p0:p,
      dir,
      keys,
      src,
      pat:patName || S.pat,
      user:isUser,
      ex:null,
      tr:null
    };

    pending.push(s);

    if (pending.length>200)
      pending.shift();

    return s;
  }

  function evalPending(t0,p1,pay,sess,say) {
    evalSequencePending(t0,p1);
    if (!pending.length || p1==null) return;

    for (let i=pending.length-1; i>=0; i--) {
      const s=pending[i];

      if (t0<s.exp) continue;

      pending.splice(i,1);

      if (t0-s.exp>5000) continue;

      const up=p1>s.p0;
      const down=p1<s.p0;
      const tie=!up && !down;
      const win=s.dir==="HIGHER" ? up : down;

      const rF=tie ? 0 : win ? pay : -1;
      const rX=tie ? 0 : win ? -1 : pay;

      if (s.user) {
        for (const k of s.keys) {
          const e=ent(k);
          upd(e.f,rF);
          upd(e.x,rX);

          if (!tie) updateHits(e,win);
        }

        if (!tie) {
          rl.usr.n++;

          if (win) rl.usr.w++;
          else rl.usr.l++;
        }

        rl.usr.pl+=rF;

        const ic=tie ? "➖" : win ? "✅" : "❌";

        say(
          ic,
          `Tu operación ${dirWord(s.dir)}: ${
            tie ? "empate" : win ? "GANÓ":"PERDIÓ"
          } · entró ${s.p0.toFixed(5)}, cerró ${p1.toFixed(5)}`+
          (tie ? "" : ` (${rF>0?"+":""}${rF.toFixed(2)})`),
          "ures"+s.exp
        );

        jAdd({
          t:Date.now(),
          src:"USR",
          pat:s.pat,
          dir:s.dir,
          zone:"",
          ack:"",
          p0:s.p0,
          p1,
          r:rF
        });

        rlDirty=true;
        continue;
      }

      for (const k of s.keys) {
        const e=ent(k);
        upd(e.f,rF);
        upd(e.x,rX);

        if (!tie) updateHits(e,win);
      }

      rl.total++;

      if (s.ex) {
        const w2=s.ex==="HIGHER" ? up : down;
        const r=tie ? 0 : w2 ? pay : -1;

        rl.pl+=r;
        rl.hist.push(r);

        if (rl.hist.length>150)
          rl.hist.shift();

        const sn=SRCN[s.src] || s.src;
        const bs=sess.bySrc[sn] ||
          (sess.bySrc[sn]={n:0,w:0});

        if (!tie) {
          bs.n++;

          if (w2) {
            bs.w++;
            sess.win++;
          } else {
            sess.loss++;
          }
        }

        const txt=
          `${tie ? "Empate" : w2 ? "GANÓ":"PERDIÓ"} ${
            dirWord(s.ex)
          } · entró ${s.p0.toFixed(5)}, cerró ${p1.toFixed(5)}`+
          (tie ? "" : ` (${r>0?"+":""}${r.toFixed(2)})`);

        const ic=tie ? "➖" : w2 ? "✅" : "❌";

        if (s.why)
          s.why.result={icon:ic,text:txt};

        say(ic,txt,"res"+(s.tr ? s.tr.t : t0));

        if (s.tr) {
          s.tr.r=r;

          jAdd({
            t:s.tr.t,
            src:s.src,
            pat:s.pat,
            dir:s.ex,
            zone:s.tr.zone,
            ack:s.tr.ack==null ? "" : Math.round(s.tr.ack),
            p0:s.p0,
            p1,
            r
          });
        }
      }

      rlDirty=true;
    }
  }

  function resetRL() {
    rl={
      Q:{},
      total:0,
      hist:[],
      pl:0,
      seen:{},
      usr:{n:0,w:0,l:0,pl:0},
      userFlow:{samples:[],lastActionAt:0}
    };

    pending.length=0;
    saveCal(RL_KEY,rl);
    seqSamples=[];
    seqPending=[];
    seqDirty=false;
    seqState={
      status:"warming", bars:0, samples:0, matches:0,
      occurrences:0, length:0, direction:"", distance:0,
      horizonMs:CFG.entryTimeframeMs,
      minMatches:CFG.seqMinMatches,
      requiredOccurrences:CFG.seqMinOccurrences,
      chart:null
    };

    if (seqAssetKey)
      saveCal(seqStoragePrefix+encodeURIComponent(seqAssetKey),seqSamples);
  }

  function saveRLIfDirty(t0) {
    if (rlDirty && t0-rlSavedAt>2000) {
      rlDirty=false;
      rlSavedAt=t0;
      saveCal(RL_KEY,rl);
    }

    if (seqDirty && seqAssetKey && t0-seqSavedAt>2000) {
      seqDirty=false;
      seqSavedAt=t0;
      saveCal(
        seqStoragePrefix+encodeURIComponent(seqAssetKey),
        seqSamples
      );
    }
  }

  const ctxPat=()=>
    S.pat!=="NONE" ? S.pat :
    (cdlNow.names.find(n=>PAT_DIR[n]) || "NONE");

  window.PLEX_MOD.brain={
    getRL:()=>rl,
    getState:()=>({S,bars,curBar,cdlNow}),
    feedBar,
    setAsset,
    resetMarket,
    analyze,
    keysFor,
    policy,
    probFor,
    recordSample,
    evalPending,
    resetRL,
    saveRLIfDirty,
    userFlowFor,
    markUserFlowAction,
    ctxPat
  };
})();
