
// PLEX v6.1 - Módulo 4: Interfaz gráfica y control de estrategias
window.PLEX_MOD = window.PLEX_MOD || {};

(() => {
  const {
    CFG, PAT_DIR, PATN, PATD, SRCN, TRN2, POSN2,
    loadCal, saveCal, dirWord, hhmmss, jExport,
    unlockAudio, playSound
  } = window.PLEX_MOD.config;

  const vision = window.PLEX_MOD.vision;
  const brain = window.PLEX_MOD.brain;

  const ui = Object.assign(
    { open:false, x:4, y:108 },
    loadCal("iqtri_ui") || {}
  );

  if (ui.sound === false) CFG.sound = false;

  const GREEN="#3ddc84", RED="#ff5c5c", AMBER="#ffc857";
  const BLUE="#5cc8ff", GREY="#8aa";
  const FONT="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  const esc=t=>String(t).replace(/&/g,"&amp;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const PGLYPH={
    NONE:"–", BRK_UP:"⇑", BRK_DN:"⇓", DBOT:"W", DTOP:"M",
    PULL_U:"↗", PULL_D:"↘", REJ_B:"⊥", REJ_T:"⊤",
    INS_UP:"▣", INS_DN:"▣", RET_UP:"↻", RET_DN:"↻",
    HAMMER:"🔨", SHOOT:"🌠", ENG_UP:"🟩", ENG_DN:"🟥",
    HARAMI_U:"◩", HARAMI_D:"◩", MORN:"🌅", EVEN:"🌇",
    SOLD3:"3▲", CROW3:"3▼", MARU_U:"█", MARU_D:"█", DOJI:"✚",
    LVL_B:"⤒", LVL_T:"⤓", TWZ_U:"⩔", TWZ_D:"⩔",
    ST_BOS_U:"⬆", ST_BOS_D:"⬇",
    ST_CHOCH_U:"↗", ST_CHOCH_D:"↘",
    ST_SWEEP_H:"⌃", ST_SWEEP_L:"⌄",
    ST_RET_U:"↻", ST_RET_D:"↺",
    CONT_UP:"↗", CONT_DN:"↘"
  };

  const SRC_ICON={
    TRI:"🔺", CRUCE:"🔀", PAT:"🧩", USR:"👤"
  };

  const pGlyph=k=>PGLYPH[k]||"•";
  const pCol=k=>PAT_DIR[k]==="HIGHER" ? GREEN :
    PAT_DIR[k]==="LOWER" ? RED : "#9ab";

  const el=(tag,css,parent,txt)=>{
    const e=document.createElement(tag);
    if(css)e.style.cssText=css;
    if(txt!=null)e.textContent=txt;
    if(parent)parent.appendChild(e);
    return e;
  };

  const CARD="background:#141c2a;border-radius:10px;padding:8px 10px";
  const ELL="white-space:nowrap;overflow:hidden;text-overflow:ellipsis";

  const chip=(txt,col)=>
    `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:#0f1724;border:1px solid rgba(255,255,255,.12);color:${col};font-size:10px;white-space:nowrap">${txt}</span>`;

  const kpi=(v,l,c)=>
    `<div style="background:#141c2a;border-radius:10px;padding:7px 2px;text-align:center;min-width:0">`+
    `<div style="font-size:16px;font-weight:bold;color:${c};line-height:1.1;${ELL}">${v}</div>`+
    `<div style="color:${GREY};font-size:9px;margin-top:2px;${ELL}">${l}</div></div>`;

  const tile=(icon,v,l,c)=>
    `<div style="background:#141c2a;border-radius:10px;padding:6px 2px;text-align:center;min-width:0">`+
    `<div style="font-size:15px;line-height:1">${icon}</div>`+
    `<div style="font-size:12px;font-weight:bold;color:${c||"#cfe"};margin-top:3px;padding:0 3px;${ELL}">${v}</div>`+
    `<div style="color:${GREY};font-size:9px;margin-top:1px;padding:0 3px;${ELL}">${l}</div></div>`;

  const secT=(pn,t)=>el(
    "div","margin:10px 0 4px;color:#9ab;font-weight:bold;font-size:11px",pn,t
  );

  const box=el(
    "div",
    `position:fixed;left:${ui.x}px;top:${ui.y}px;z-index:2147483647;font:10px ${FONT};`
  );

  const head=el(
    "div",
    "display:inline-block;background:rgba(0,0,0,.7);color:#cfe;padding:4px 7px;border-radius:8px;"+
    "touch-action:none;user-select:none;-webkit-user-select:none;line-height:1.3;border:1px solid rgba(255,255,255,.15)",
    box
  );
  const headExpandedStyle=
    "display:inline-block;background:rgba(0,0,0,.7);color:#cfe;padding:4px 7px;border-radius:8px;"+
    "touch-action:none;user-select:none;-webkit-user-select:none;line-height:1.3;border:1px solid rgba(255,255,255,.15)";
  const headCompactStyle=
    "display:block;width:172px;box-sizing:border-box;padding:9px 10px;border-radius:20px;"+
    "touch-action:none;user-select:none;-webkit-user-select:none;line-height:1.15;color:#eaf6ff;"+
    "background:linear-gradient(145deg,rgba(13,25,42,.97),rgba(8,13,24,.96));"+
    "border:1px solid rgba(117,190,255,.44);"+
    "box-shadow:0 8px 26px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12)";
  const headMobileStyle=
    "display:block;width:148px;height:52px;box-sizing:border-box;padding:6px 9px;border-radius:16px;"+
    "touch-action:none;user-select:none;-webkit-user-select:none;line-height:1.1;color:#eaf6ff;"+
    "background:linear-gradient(145deg,rgba(13,25,42,.97),rgba(8,13,24,.96));"+
    "border:1px solid rgba(117,190,255,.5);"+
    "box-shadow:0 5px 16px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.12)";
  const watchStyle=document.createElement("style");
  watchStyle.textContent=
    "@keyframes plexUiWatchPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.58;transform:scale(.82)}}";
  (document.head||document.documentElement).appendChild(watchStyle);

  const body=el(
    "div",
    "display:none;margin-top:3px;width:300px;max-width:96vw;font:12px "+FONT+
    ";overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;"+
    "background:rgba(8,12,20,.95);border:1px solid rgba(255,255,255,.15);"+
    "border-radius:10px;padding:7px;color:#cfe;box-sizing:border-box",
    box
  );

  const tabsBar=el(
    "div","display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:6px",body
  );

  const panes=[],tabBtns=[];
  let renderFn=()=>{};

  const setTab=i=>{
    ui.tab=i;
    panes.forEach((pn,j)=>{
      pn.style.display=j===i?"block":"none";
    });
    tabBtns.forEach((bt,j)=>{
      bt.style.background=j===i?"#2a3a58":"#141c2a";
      bt.style.color=j===i?"#fff":"#8aa";
    });
    saveCal("iqtri_ui",ui);
    body.scrollTop=0;
  };

  [["📊","Resumen"],["📰","En vivo"],["🧠","Aprende"],["⚙️","Ajustes"]]
    .forEach(([ic,lb],i)=>{
      const bt=el(
        "button",
        `border:0;border-radius:10px;font-family:${FONT};padding:6px 0;background:#141c2a;color:#8aa`,
        tabsBar
      );
      bt.innerHTML=
        `<div style="font-size:15px;line-height:1">${ic}</div>`+
        `<div style="font-size:9px;margin-top:2px">${lb}</div>`;

      bt.addEventListener("click",e=>{
        e.stopPropagation();
        setTab(i);
        renderFn();
      });

      tabBtns.push(bt);
      panes.push(el("div","",body));
    });

  // RESUMEN
  const stBar=el("div","",panes[0]);
  const kpis=el(
    "div","display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:6px",panes[0]
  );
  const mkt=el("div",CARD+";margin-top:6px",panes[0]);
  const meter=el("div",CARD+";margin-top:6px",panes[0]);
  const motifCard=el("div",CARD+";margin-top:6px;padding:6px 8px",panes[0]);
  const motifHead=el(
    "div","color:#cfe;font-size:10px;font-weight:bold;margin-bottom:3px",motifCard
  );
  const cvMotif=el(
    "canvas","width:100%;height:84px;border-radius:6px;display:block",motifCard
  );
  cvMotif.width=280;
  cvMotif.height=84;
  el(
    "div",`color:${GREY};font-size:9px;margin-top:3px`,motifCard,
    "Velas en vivo · actual (verde/rojo) · candidatos históricos (azul/violeta)"
  );
  const chartCard=el("div",CARD+";margin-top:6px;padding:6px",panes[0]);
  const cvBars=el("canvas","width:100%;height:72px;border-radius:6px;display:block",chartCard);
  cvBars.width=280;
  cvBars.height=72;

  const barTimeframeLabel=el(
    "div",`color:${GREY};font-size:9px;margin-top:3px`,chartCard
  );

  el("div",`color:${GREY};font-size:9px;margin-top:3px`,chartCard,
    "S soporte (verde) · R resistencia (rojo): entrada al 3er retesteo · 🟧 máximo · 🟦 mínimo");

  const plCard=el("div",CARD+";margin-top:6px;padding:6px 8px",panes[0]);
  const plHead=el(
    "div","display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;color:#9ab;font-size:11px",
    plCard
  );

  el("span","",plHead,"💰 Resultado de entradas");
  const plVal=el("b","",plHead);
  const cvPL=el("canvas","width:100%;height:36px;border-radius:6px;display:block",plCard);
  cvPL.width=280;
  cvPL.height=36;

  const detS=el("details","margin-top:8px",panes[0]);
  el("summary","color:#9ab;padding:5px 0",detS,"📝 Sesión");
  const sumBox=el("div",CARD+";line-height:1.5;font-size:11px",detS);

  const detT=el("details","margin-top:4px",panes[0]);
  el("summary","color:#9ab;padding:5px 0",detT,"🔧 Detalles técnicos");
  const stat=el(
    "div","margin-top:3px;white-space:pre-wrap;line-height:1.3;color:#9fc;font:10px monospace",
    detT
  );

  // EN VIVO
  const nowStatus=el("div","",panes[1]);
  const nowGrid=el(
    "div","display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px",panes[1]
  );

  secT(panes[1],"🎯 Última entrada");
  const whyCard=el("div",CARD,panes[1]);
  const whyHead=el("div","",whyCard);
  const whyDet=el("details","margin-top:4px",whyCard);

  el("summary",`color:${GREY};font-size:11px;padding:3px 0`,whyDet,"Ver motivos");
  const whyBody=el("div","line-height:1.5;font-size:11px;color:#bcd",whyDet);

  const feedT=secT(panes[1],"📰 Qué ha pasado");
  el("span","color:#789;font-weight:normal;font-size:9px;margin-left:6px",
    feedT,"toca para ver completo");

  const feed=el("div","",panes[1]);
  const expanded=new Set();
  let feedHtml="";

  feed.addEventListener("click",e=>{
    e.stopPropagation();
    const r=e.target.closest("[data-t]");
    if(!r)return;

    const k=r.dataset.t;
    if(expanded.has(k))expanded.delete(k);
    else expanded.add(k);

    feedHtml="";
    renderFn();
  });

  // APRENDIZAJE
  const seenTitle=secT(panes[2],"🧩 Patrones vistos");
  seenTitle.style.marginTop="2px";

  const seenBox=el(
    "div","display:grid;grid-template-columns:repeat(6,1fr);gap:3px",panes[2]
  );

  const seenInfo=el(
    "div",
    `margin:4px 0 2px;padding:5px 7px;border-radius:8px;background:#141c2a;color:${GREY};font-size:11px;line-height:1.35;min-height:16px`,
    panes[2]
  );

  secT(panes[2],"📊 Rendimiento");
  const tbl=el("div","",panes[2]);

  const legDet=el("details","margin-top:6px",panes[2]);
  el("summary",`color:${GREY};font-size:10px;padding:3px 0`,legDet,"Leyenda");

  el(
    "div","color:#789;font-size:10px;line-height:1.5;white-space:pre-line",legDet,
    "✅ Seguir · 🔄 Invertir · ⛔ Evitar · ⏳ Pocos datos · │ mínimo\n"+
    "🔺 Triángulo · 🔀 Cruce · 🧩 Patrón · 👤 Tú · 🎯 Estrategia"
  );

  let seenHtml="",seenInfoHtml="",tblHtml="";

  seenBox.addEventListener("click",e=>{
    e.stopPropagation();
    const c=e.target.closest("[data-k]");
    if(!c)return;

    ui.sel=ui.sel===c.dataset.k?null:c.dataset.k;
    seenHtml="";
    seenInfoHtml="";
    renderFn();
  });

  // AJUSTES
  const btns=el(
    "div","display:grid;grid-template-columns:1fr 1fr;gap:5px",panes[3]
  );

  const mkSec=t=>el(
    "div",`grid-column:1/-1;color:${GREY};font-size:10px;margin-top:4px`,btns,t
  );

  const mk=(txt,fn)=>{
    const bt=el(
      "button",
      `background:#1d2535;color:#fff;border:1px solid #4a5670;border-radius:10px;font:11px ${FONT};padding:10px 3px;width:100%`,
      btns,txt
    );

    bt.addEventListener("click",e=>{
      e.stopPropagation();
      fn(bt);
    });

    return bt;
  };

  const paintToggle=(bt,label,on)=>{
    bt.textContent=label+(on?" ✓":" ✗");
    bt.style.borderColor=on?GREEN:"#4a5670";
    bt.style.color=on?GREEN:"#fff";
  };

  let sndBtn=null,headTxt="",settingsStatus=null;
  let headerState=null,watchContext=()=>null;

  function setupButtons(actions){
    mkSec("Pruebas");
    mk("🔽 Probar baja",()=>actions.doTrade("LOWER",true));
    mk("🔼 Probar sube",()=>actions.doTrade("HIGHER",true));
    mk("🔔 Probar sonido",()=>{
      unlockAudio();
      playSound("HIGHER");
    });

    sndBtn=mk("",()=>{
      CFG.sound=!CFG.sound;
      ui.sound=CFG.sound;
      saveCal("iqtri_ui",ui);
      paintToggle(sndBtn,"🔊 Sonido",CFG.sound);

      if(CFG.sound){
        unlockAudio();
        playSound("HIGHER");
      }

      actions.setLastEvent(
        CFG.sound?"sonido activado":"sonido desactivado"
      );
    });

    paintToggle(sndBtn,"🔊 Sonido",CFG.sound);

    mkSec("Opciones generales");

    const zb=mk("",bt=>{
      CFG.zoneVary=!CFG.zoneVary;
      paintToggle(bt,"🎯 Zonas",CFG.zoneVary);
    });
    paintToggle(zb,"🎯 Zonas",CFG.zoneVary);

    const pb=mk("",bt=>{
      CFG.usePatterns=!CFG.usePatterns;
      paintToggle(bt,"🧩 Patrones",CFG.usePatterns);
    });
    paintToggle(pb,"🧩 Patrones",CFG.usePatterns);

    mkSec("Calibración y datos");
    settingsStatus=el(
      "div",
      CARD+";grid-column:1/-1;color:#9ab;font-size:10px;line-height:1.4",
      btns,
      "Calibración y diario listos."
    );

    mk("🎨 Cal ▲",()=>{
      vision.setCalMode("U");
      actions.setLastEvent("toca un tramo que SUBE");
    });

    mk("🎨 Cal ▼",()=>{
      vision.setCalMode("D");
      actions.setLastEvent("toca un tramo que BAJA");
    });

    mk("🧹 Borrar cal",()=>{
      vision.clearCal();
      vision.setCalMode(null);
      actions.setLastEvent("calibración borrada");
    });

    mk("⬇ Exportar CSV",()=>jExport(actions.setLastEvent));

    mk("🗑 Reiniciar aprendizaje",()=>{
      brain.resetRL();
      actions.setLastEvent("Aprendizaje y modelo de estructura variable borrados");
    });

    setTab(ui.tab>=0&&ui.tab<4?ui.tab:0);
  }

  function fitBody(){
    const room=window.innerHeight-box.offsetTop-head.offsetHeight-14;
    const safe=window.innerHeight*0.70-box.offsetTop-head.offsetHeight;
    body.style.maxHeight=Math.max(160,Math.min(room,safe))+"px";
  }

  window.addEventListener("resize",()=>{
    if(ui.open)fitBody();
    else applyOpen();
  });

  const applyOpen=()=>{
    head.style.cssText=ui.open
      ? headExpandedStyle
      : window.innerWidth<=600 ? headMobileStyle : headCompactStyle;
    body.style.display=ui.open?"block":"none";
    if(ui.open){
      fitBody();
      renderExpandedHeader();
      renderFn();
    }else{
      ui.x=Math.max(0,Math.min(window.innerWidth-head.offsetWidth,ui.x));
      ui.y=Math.max(0,Math.min(window.innerHeight-head.offsetHeight,ui.y));
      box.style.left=ui.x+"px";
      box.style.top=ui.y+"px";
      renderCompactHeader();
    }
  };

  let drag=null;

  head.addEventListener("pointerdown",e=>{
    drag={
      sx:e.clientX,sy:e.clientY,
      bx:box.offsetLeft,by:box.offsetTop,
      moved:false
    };

    try{head.setPointerCapture(e.pointerId);}catch(err){}
  });

  head.addEventListener("pointermove",e=>{
    if(!drag)return;

    const dx=e.clientX-drag.sx;
    const dy=e.clientY-drag.sy;

    if(!drag.moved&&Math.hypot(dx,dy)<6)return;

    drag.moved=true;

    const maxX=Math.max(0,window.innerWidth-(ui.open?box.offsetWidth:head.offsetWidth));
    const maxY=Math.max(0,window.innerHeight-(ui.open?box.offsetHeight:head.offsetHeight));
    ui.x=Math.max(0,Math.min(maxX,drag.bx+dx));
    ui.y=Math.max(0,Math.min(maxY,drag.by+dy));

    box.style.left=ui.x+"px";
    box.style.top=ui.y+"px";

    if(ui.open)fitBody();
  });

  head.addEventListener("pointerup",()=>{
    if(!drag)return;

    if(!drag.moved){
      ui.open=!ui.open;
      applyOpen();
    }

    saveCal("iqtri_ui",ui);
    drag=null;
  });

  head.addEventListener("pointercancel",()=>{drag=null;});

  const attach=()=>{
    if(document.documentElement&&!box.isConnected)
      document.documentElement.appendChild(box);
  };

  attach();
  document.addEventListener("DOMContentLoaded",attach);

  function drawBars(S,bars,curBar){
    const g=cvBars.getContext("2d");
    const W=cvBars.width,H=cvBars.height;

    g.clearRect(0,0,W,H);
    g.fillStyle="#0b111b";
    g.fillRect(0,0,W,H);
    g.font="11px monospace";

    const all=curBar?bars.concat([curBar]):bars.slice();
    const N=Math.min(all.length,40);

    if(N<3){
      g.fillStyle="#789";
      g.fillText("Reuniendo barras… "+all.length+"/7",10,22);
      return;
    }

    const off0=all.length-N;
    const v=all.slice(off0);

    let hi=-1e9,lo=1e9;

    for(const b of v){
      if(b.h>hi)hi=b.h;
      if(b.l<lo)lo=b.l;
    }

    const rg=(hi-lo)||1e-6;
    const bw=W/N;
    const y=p=>H-8-(p-lo)/rg*(H-22);

    const retests=S.retests||{};
    const drawRetestLevel=(state,label,color)=>{
      if(!state||!Number.isFinite(state.level)||state.level<lo||state.level>hi)
        return;

      const yy=y(state.level);
      g.strokeStyle=color;
      g.fillStyle=color;
      g.lineWidth=1.5;
      g.setLineDash([4,2]);
      g.beginPath();
      g.moveTo(0,yy);
      g.lineTo(W,yy);
      g.stroke();
      g.setLineDash([]);
      g.font="9px sans-serif";
      g.fillText(`${label} ${Math.min(3,state.touches)}/3`,4,Math.max(9,yy-3));
    };

    drawRetestLevel(retests.resistance,"R",RED);
    drawRetestLevel(retests.support,"S",GREEN);
    g.lineWidth=1;

    g.setLineDash([3,3]);

    const lastH=S.swH[S.swH.length-1];
    const lastL=S.swL[S.swL.length-1];

    if(lastH){
      g.strokeStyle=AMBER;
      g.beginPath();
      g.moveTo(0,y(lastH.p));
      g.lineTo(W,y(lastH.p));
      g.stroke();
    }

    if(lastL){
      g.strokeStyle=BLUE;
      g.beginPath();
      g.moveTo(0,y(lastL.p));
      g.lineTo(W,y(lastL.p));
      g.stroke();
    }

    g.setLineDash([]);

    v.forEach((b,i)=>{
      const x=i*bw+bw/2;
      const col=b.c>=b.o?GREEN:RED;

      g.strokeStyle=g.fillStyle=col;
      g.beginPath();
      g.moveTo(x,y(b.h));
      g.lineTo(x,y(b.l));
      g.stroke();

      g.fillRect(
        x-bw*0.3,
        y(Math.max(b.o,b.c)),
        bw*0.6,
        Math.max(1,Math.abs(y(b.o)-y(b.c)))
      );
    });

    g.fillStyle=AMBER;

    for(const s2 of S.swH){
      const i=s2.i-off0;
      if(i>=0)g.fillRect(i*bw+bw/2-2,y(s2.p)-6,4,3);
    }

    g.fillStyle=BLUE;

    for(const s2 of S.swL){
      const i=s2.i-off0;
      if(i>=0)g.fillRect(i*bw+bw/2-2,y(s2.p)+3,4,3);
    }
  }

  function drawMotif(v){
    const g=cvMotif.getContext("2d");
    const W=cvMotif.width,H=cvMotif.height;
    const chart=v&&v.chart;

    g.clearRect(0,0,W,H);
    g.fillStyle="#0b111b";
    g.fillRect(0,0,W,H);

    if(!chart||!Array.isArray(chart.current)||chart.current.length<2){
      motifHead.textContent="Buscando estructura en vivo…";
      g.fillStyle="#789";
      g.font="10px sans-serif";
      g.fillText("Esperando velas con movimiento para comparar",8,42);
      return;
    }

    const repeats=Array.isArray(chart.repeats)?chart.repeats:[];
    const validCandles=candles=>
      Array.isArray(candles)&&
      candles.length===chart.current.length&&
      candles.every(c=>
        c&&Number.isFinite(c.o)&&Number.isFinite(c.h)&&
        Number.isFinite(c.l)&&Number.isFinite(c.c)&&
        c.h>=Math.max(c.o,c.c)&&c.l<=Math.min(c.o,c.c)
      );
    const current=validCandles(chart.current)?chart.current:null;
    const history=repeats.slice(0,2)
      .filter(validCandles)
      .map((candles,i)=>({
        candles,
        color:i===0?"#58a6ff":"#b58cff",
        offset:i===0?-1.5:1.5
      }));

    if(!current){
      motifHead.textContent="Motivo repetido: datos incompletos";
      return;
    }

    motifHead.textContent=v.status==="signal"
      ? `Motivo de ${v.length} velas · ${v.occurrences} apariciones · `+
        `${v.direction==="HIGHER"?"sesgo alcista":"sesgo bajista"}`
      : v.status==="no-consensus"
        ? `Estructura observada · ${v.occurrences} apariciones · sin dirección común`
        : `Buscando en vivo · ${v.length} velas`+
          (history.length
            ? ` · candidato cercano ${v.distance.toFixed(2)}`
            : " · aún sin antecedente");

    const candles=[current,...history.map(item=>item.candles)];
    const values=candles.flatMap(series=>
      series.flatMap(c=>[c.l,c.h])
    );
    let min=Math.min(0,...values),max=Math.max(0,...values);
    if(max===min){max+=1;min-=1;}

    const padX=8,padY=9;
    const x=i=>padX+(i+0.5)/current.length*(W-2*padX);
    const y=value=>H-padY-(value-min)/(max-min)*(H-2*padY);
    const candleWidth=Math.max(3,Math.min(8,(W-2*padX)/current.length*0.42));

    g.strokeStyle="#334155";
    g.lineWidth=1;
    g.setLineDash([2,3]);
    g.beginPath();
    g.moveTo(padX,y(0));
    g.lineTo(W-padX,y(0));
    g.stroke();
    g.setLineDash([]);

    history.forEach(series=>{
      g.globalAlpha=0.8;
      g.strokeStyle=series.color;
      g.lineWidth=1;
      series.candles.forEach((c,i)=>{
        const cx=x(i)+series.offset;
        const yo=y(c.o),yc=y(c.c);
        const top=Math.min(yo,yc);
        const height=Math.max(1.5,Math.abs(yc-yo));
        g.beginPath();
        g.moveTo(cx,y(c.h));
        g.lineTo(cx,y(c.l));
        g.stroke();
        g.strokeRect(cx-candleWidth/2,top,candleWidth,height);
      });
    });

    g.globalAlpha=1;
    current.forEach((c,i)=>{
      const cx=x(i),yo=y(c.o),yc=y(c.c);
      const top=Math.min(yo,yc);
      const height=Math.max(1.5,Math.abs(yc-yo));
      const color=c.c>=c.o?GREEN:RED;
      g.strokeStyle=color;
      g.fillStyle=color;
      g.beginPath();
      g.moveTo(cx,y(c.h));
      g.lineTo(cx,y(c.l));
      g.stroke();
      g.fillRect(cx-candleWidth/2,top,candleWidth,height);
    });
    g.lineWidth=1;
  }

  function drawPL(hist){
    const g=cvPL.getContext("2d");
    const W=cvPL.width,H=cvPL.height;

    g.clearRect(0,0,W,H);
    g.fillStyle="#0b111b";
    g.fillRect(0,0,W,H);
    g.font="11px monospace";

    if(hist.length<2){
      g.fillStyle="#789";
      g.fillText("Aún sin entradas evaluadas",10,26);
      return;
    }

    const cum=[];
    let t=0;

    for(const r of hist){
      t+=r;
      cum.push(t);
    }

    let mn=Math.min(0,...cum);
    let mx=Math.max(0,...cum);

    if(mx===mn)mx=mn+1;

    const y=v=>H-5-(v-mn)/(mx-mn)*(H-10);

    g.strokeStyle="#345";
    g.beginPath();
    g.moveTo(0,y(0));
    g.lineTo(W,y(0));
    g.stroke();

    g.strokeStyle=t>=0?GREEN:RED;
    g.lineWidth=1.5;
    g.beginPath();

    cum.forEach((v,i)=>{
      const x=i/(cum.length-1)*(W-2)+1;
      if(i)g.lineTo(x,y(v));
      else g.moveTo(x,y(v));
    });

    g.stroke();
    g.lineWidth=1;
  }

  function paintHeader(demo,o,zzHead,tradeCount,lastTradeShort,rlTagStr,lastSay){
    headerState={demo,o,zzHead,tradeCount,lastTradeShort,rlTagStr,lastSay};
    if(ui.open)renderExpandedHeader();
    else renderCompactHeader();
  }

  function renderExpandedHeader(){
    if(!headerState)return;

    try{
      const {demo,o,zzHead,tradeCount,lastTradeShort,rlTagStr}=headerState;
      const P="display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;white-space:nowrap;";
      const zz=/▲/.test(zzHead)?GREEN:/▼/.test(zzHead)?RED:"#9ab";

      const lock=o.length
        ? `<span style="${P}background:#3a2f12;color:${AMBER}">🔒${o[0].dir==="HIGHER"?"▲":"▼"}${o.length>1?"×"+o.length:""}</span>`
        : "";

      const html=
        `<div style="display:flex;gap:4px;align-items:center">`+
        `<span style="${P}background:${demo?"#12351f":"#4a1616"};color:${demo?GREEN:RED};font-weight:bold">${demo?"DEMO":"REAL"}</span>`+
        `<span style="${P}background:#141c2a;color:${zz}">${esc(zzHead)}</span>${lock}</div>`+
        `<div style="margin-top:3px;color:#9ab;${ELL};max-width:250px">#${tradeCount} ${esc(lastTradeShort||"sin entradas")}`+
        `<span style="color:#cfe">${esc(rlTagStr)}</span></div>`;

      if(html!==headTxt){
        headTxt=html;
        head.innerHTML=html;
      }
    }catch(e){}
  }

  function renderCompactHeader(){
    if(ui.open||!headerState)return;

    try{
      const d=watchContext()||{};
      const {S}=brain.getState();
      const price=Number.isFinite(d.curPrice)?d.curPrice.toFixed(5):"—";
      const trend=S.trend==="U"
        ? {icon:"▲",label:"ALCISTA",color:GREEN}
        : S.trend==="D"
          ? {icon:"▼",label:"BAJISTA",color:RED}
          : {icon:"↔",label:"LATERAL",color:AMBER};
      const stats=d.execStats||{};
      const win=stats.win==null?"—":`${Math.round(stats.win*100)}%`;
      const winColor=stats.win==null?GREY:
        Number.isFinite(d.be)&&stats.win<d.be?AMBER:GREEN;
      const opened=Array.isArray(d.openTrades)?d.openTrades:[];
      const seconds=opened.length
        ? Math.max(0,Math.ceil((opened[0].until-Date.now())/1000))
        : null;
      const status=d.isPaused
        ? {text:"PAUSA",color:AMBER}
        : d.curPrice==null
          ? {text:"BUSCANDO PRECIO",color:AMBER}
          : {text:opened.length?"OPERACIÓN ABIERTA":"EN VIVO",color:GREEN};
      head.title=
        `${headerState.demo?"DEMO":"REAL"} · ${price} · ${trend.label} · `+
        `acierto ${win} (${stats.n||0})`+
        (opened.length?` · operación abierta ${seconds}s`:` · ${status.text}`);
      const html=window.innerWidth<=600
        ? `<div style="display:flex;height:100%;flex-direction:column;justify-content:center;gap:5px">`+
          `<div style="display:flex;align-items:center;justify-content:space-between;gap:5px;min-width:0">`+
            `<span style="display:flex;align-items:center;gap:4px;min-width:0;color:${status.color};font-size:9px;font-weight:bold;white-space:nowrap">`+
              `<i style="width:6px;height:6px;flex:none;border-radius:50%;background:${status.color};box-shadow:0 0 6px ${status.color};animation:plexUiWatchPulse 1.8s ease-in-out infinite"></i>`+
              `${headerState.demo?"DEMO":"REAL"} #${headerState.tradeCount}</span>`+
            `<span style="flex:none;padding:3px 5px;border-radius:9px;background:#111b2b;color:${trend.color};font-size:9px;font-weight:bold;white-space:nowrap">`+
              `${trend.icon} ${trend.label}</span>`+
          `</div>`+
          `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;min-width:0">`+
            `<b style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px">${price}</b>`+
            `<span style="flex:none;color:${opened.length?status.color:winColor};font-size:9px;font-weight:bold;white-space:nowrap">`+
              `${opened.length?`${win} · ${seconds}s`:`🎯 ${win} (${stats.n||0})`}</span>`+
          `</div>`+
        `</div>`
        :
        `<div style="display:flex;align-items:center;gap:5px">`+
          `<span style="width:7px;height:7px;flex:none;border-radius:50%;background:${status.color};box-shadow:0 0 8px ${status.color};animation:plexUiWatchPulse 1.8s ease-in-out infinite"></span>`+
          `<b style="font-size:10px;letter-spacing:1.2px">PLEX</b>`+
          `<span style="margin-left:auto;padding:3px 6px;border-radius:9px;background:${headerState.demo?"#12351f":"#4a1616"};`+
            `color:${headerState.demo?GREEN:RED};font-size:8px;font-weight:bold">${headerState.demo?"DEMO":"REAL"}</span>`+
        `</div>`+
        `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">`+
          `<div><div style="font-size:8px;color:#8aa;letter-spacing:.7px">PRECIO</div>`+
            `<b style="font-size:17px;letter-spacing:.2px">${price}</b></div>`+
          `<div style="text-align:right;padding:5px 7px;border-radius:12px;background:#111b2b;border:1px solid ${trend.color}55">`+
            `<b style="display:block;color:${trend.color};font-size:11px">${trend.icon} ${trend.label}</b>`+
            `<span style="font-size:8px;color:#8aa">vela 1 min</span></div>`+
        `</div>`+
        `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:7px;padding-top:6px;`+
          `border-top:1px solid rgba(255,255,255,.09);font-size:9px">`+
          `<span style="color:${winColor}">🎯 ${win}<span style="color:#678"> (${stats.n||0})</span></span>`+
          `<span style="color:${status.color};font-weight:bold">${opened.length?`⏳ ${seconds}s`:status.text}</span>`+
        `</div>`;

      if(html!==headTxt){
        headTxt=html;
        head.innerHTML=html;
      }
    }catch(e){
      console.error("[PLEX compact UI]",e);
    }
  }

  function statusOf(d,rl,p){
    if(!CFG.rl)
      return {
        ic:"⚪",t:"Aprendizaje apagado",
        c:"#9ab",bg:"#1b2433"
      };

    if(p==null)
      return {
        ic:"🔴",t:"Sin precio todavía",
        c:RED,bg:"#3a1a1a"
      };

    if(d.isPaused)
      return {
        ic:"⏸",t:"En pausa: tocaste la pantalla",
        c:AMBER,bg:"#3a2f12"
      };

    return {
      ic:"🧠",
      t:`Aprendizaje activo · ${rl.total} muestras`+
        (rl.usr&&rl.usr.n?` · analiza tu estilo (${rl.usr.n} entradas)`:""),
      c:GREEN,bg:"#12351f"
    };
  }

  const statusHtml=s=>
    `<div style="background:${s.bg};border-radius:10px;padding:7px 10px">`+
    `<div style="color:${s.c};font-weight:bold;font-size:12px">${s.ic} ${esc(s.t)}</div>`+
    (s.pct!=null?
      `<div style="height:4px;background:#0b111b;border-radius:3px;margin-top:5px">`+
      `<div style="width:${(s.pct*100).toFixed(0)}%;height:100%;background:${s.c};border-radius:3px"></div></div>`
      :"")+
    `</div>`;

  function initDashboard(getCtxData){
    watchContext=getCtxData;
    renderFn=()=>{
      try{
        const d=getCtxData();
        const rl=brain.getRL();
        const {S,bars,curBar,cdlNow}=brain.getState();
        const {wsMsgs,wsQ,priceSrc}=vision.getWsStats();

        const tab=ui.tab||0;
        const b=d.be,p=d.curPrice,x=d.execStats;
        const st=statusOf(d,rl,p);

        const trendTxt=S.trend==="U"?"▲ Alcista":
          S.trend==="D"?"▼ Bajista":"↔ Lateral";

        const trendCol=S.trend==="U"?GREEN:
          S.trend==="D"?RED:AMBER;

        if(tab===0){
          stBar.innerHTML=statusHtml(st);

          kpis.innerHTML=
            kpi(x.win==null?"–":(x.win*100).toFixed(0)+"%",
              `Aciertos (${x.n})`,
              x.win==null?"#cfe":x.win>b?GREEN:RED)+
            kpi((rl.pl>=0?"+":"")+rl.pl.toFixed(2),
              "Ganancia",rl.pl>=0?GREEN:RED)+
            kpi(String(rl.total),"Evaluadas","#cfe")+
            kpi(
              rl.usr&&rl.usr.n?
                Math.round(100*rl.usr.w/rl.usr.n)+"%":"–",
              `Tuyas (${rl.usr?rl.usr.n:0})`,
              rl.usr&&rl.usr.n&&(rl.usr.w/rl.usr.n)>b?GREEN:AMBER
            );

          mkt.innerHTML=
            `<div style="display:flex;align-items:baseline;justify-content:space-between">`+
            `<b style="font-size:18px;color:#fff">${p==null?"—":p.toFixed(5)}</b>`+
            `<span style="color:${GREY};font-size:9px">${p==null?"sin precio":esc(priceSrc)}</span></div>`+
            `<div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">`+
            chip(trendTxt,trendCol)+
            chip("Zona "+POSN2[S.pos],"#9ab")+
            (S.pat!=="NONE"?
              chip(`${pGlyph(S.pat)} ${esc(PATN[S.pat]||S.pat)}`,pCol(S.pat)):"")+
            `</div>`;

          const bias=S.bias||0;
          const bc=Math.max(-4,Math.min(4,bias));
          const mcol=bias>=2?GREEN:bias<=-2?RED:AMBER;
          const mtxt=bias>=2?"Alcista":bias<=-2?"Bajista":"Neutral";

          const left=bc>=0?50:50+bc/4*50;
          const wid=Math.abs(bc)/4*50;

          let cd=0;

          for(const nm of cdlNow.names){
            if(nm!=="DOJI"&&PAT_DIR[nm])
              cd+=PAT_DIR[nm]==="HIGHER"?1:-1;
          }

          const dot=(ic,lb,v)=>
            `<div style="text-align:center;min-width:0">`+
            `<div style="width:26px;height:26px;margin:0 auto;border-radius:50%;`+
            `background:${v>0?"#12351f":v<0?"#3a1a1a":"#1b2433"};`+
            `border:1px solid ${v>0?GREEN:v<0?RED:"#34425a"};`+
            `display:flex;align-items:center;justify-content:center;font-size:13px">${ic}</div>`+
            `<div style="color:${GREY};font-size:9px;margin-top:2px">${lb}</div></div>`;

          const patV=S.pat!=="NONE"&&PAT_DIR[S.pat]?
            (PAT_DIR[S.pat]==="HIGHER"?1:-1):0;

          meter.innerHTML=
            `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">`+
            `<span style="color:#9ab;font-size:11px">🧭 Acción del precio</span>`+
            `<b style="color:${mcol}">${mtxt} ${bias>0?"+":""}${bias}</b></div>`+
            `<div style="position:relative;height:8px;background:#0b111b;border-radius:4px">`+
            `<div style="position:absolute;left:${left}%;width:${wid}%;top:0;bottom:0;background:${mcol};border-radius:4px"></div>`+
            `<div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#fff"></div></div>`+
            `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2px;margin-top:8px">`+
            dot("📐","Tend.",S.trend==="U"?1:S.trend==="D"?-1:0)+
            dot("🧱","Nivel",S.lvl==="S"?1:S.lvl==="R"?-1:0)+
            dot("⚡","Moment.",S.mom||0)+
            dot("🕯","Velas",cd>0?1:cd<0?-1:0)+
            dot("🧩","Patrón",patV)+
            `</div>`;

          // Indicador de estructura.
          if(S.structure){
            const seq=S.structure.sequence||"R";
            const ev=S.structure.event||"NONE";

            meter.innerHTML+=
              `<div style="margin-top:7px;padding-top:6px;border-top:1px solid #29364a;font-size:10px;color:#9ab">`+
              `Estructura: <b style="color:#cfe">${esc(seq)}</b>`+
              ` · Evento: <b style="color:${ev==="NONE"?GREY:pCol(ev)}">${esc(PATN[ev]||ev)}</b>`+
              `</div>`;
          }

          if(S.variablePattern){
            const v=S.variablePattern;
            const dir=v.direction==="HIGHER"?"ALCISTA":
              v.direction==="LOWER"?"BAJISTA":"—";
            const color=v.direction==="HIGHER"?GREEN:
              v.direction==="LOWER"?RED:AMBER;
            let status;

            if(v.status==="signal")
              status=`${dir} · secuencia de ${v.length} velas repetida ${v.occurrences} veces`;
            else if(v.status==="no-consensus")
              status=`${v.occurrences} apariciones de ${v.length} velas, sin dirección consistente`;
            else if(v.status==="gap")
              status="Esperando velas continuas";
            else if(v.status==="warming")
              status=`Buscando en vivo · ventana ${v.bars}/30 velas cerradas`;
            else
              status=`Buscando motivo · candidato de ${v.length||"—"} velas`;

            meter.innerHTML+=
              `<div style="margin-top:7px;padding-top:6px;border-top:1px solid #29364a;font-size:10px;color:#9ab">`+
              `🧠 Estructura variable (${v.bars}/30 velas · venc. ${Math.round((v.horizonMs||30000)/1000)} s): `+
              `<b style="color:${color}">${esc(status)}</b>`+
              (v.status==="signal"||v.status==="no-consensus"
                ? ` · ${v.matches} repeticiones previas`
                : "")+
              `</div>`;
          }

          const timeframeMs =
            curBar && Number.isFinite(curBar.timeframe)
              ? curBar.timeframe
              : CFG.analysisTimeframeMs;
          const timeframeSeconds=Math.round(timeframeMs/1000);
          const timeframeText=timeframeSeconds%60===0
            ? `${timeframeSeconds/60} min`
            : `${timeframeSeconds} s`;

          barTimeframeLabel.textContent=
            `Análisis: ${timeframeText} por vela`;

          drawBars(S,bars,curBar);
          drawMotif(S.variablePattern);
          drawPL(rl.hist);

          plVal.textContent=(rl.pl>=0?"+":"")+rl.pl.toFixed(2);
          plVal.style.color=rl.pl>=0?GREEN:RED;

          const m=Math.round((Date.now()-d.sess.t0)/60000);
          const dec=d.sess.win+d.sess.loss;

          let h=
            `⏱ ${m} min · <b>${d.sess.signals}</b> señales · <b>${d.sess.trades}</b> entradas`+
            (dec?
              `<br>✅ ${d.sess.win} · ❌ ${d.sess.loss} · ${Math.round(100*d.sess.win/dec)}%`:"");

          if(rl.usr&&rl.usr.n)
            h+=`<br>👤 Tuyas: ${rl.usr.n} (✅ ${rl.usr.w} · ❌ ${rl.usr.l})`;

          const ks=Object.keys(d.sess.bySrc);

          if(ks.length)
            h+="<br>"+ks.map(k=>
              `${k} ${d.sess.bySrc[k].w}/${d.sess.bySrc[k].n}`
            ).join(" · ");

          h+=
            `<br><span style="color:${GREY}">Omitidas: ${d.sess.skipProbability} por probabilidad · ${d.sess.skipOpp} por sentido · ${d.sess.skipPause} por pausa</span>`;

          sumBox.innerHTML=h;
          stat.textContent=
            d.fullText+"\n"+
            (d.rlLast?d.rlLast+"\n":"")+
            `ws ${wsMsgs}/${wsQ}`;

        }else if(tab===1){
          nowStatus.innerHTML=statusHtml(st);
          nowStatus.innerHTML+=
            `<div style="margin-top:4px;color:#9ab;font-size:10px">`+
            `${esc(d.lastEvent||"Esperando una señal…")}</div>`;

          const o=d.openTrades,now=Date.now();
          const zzM=/(▲|▼)/.exec(d.crossInfo||"");
          const zzD=/→\s*(HIGHER|LOWER)/.exec(d.crossInfo||"");

          nowGrid.innerHTML=
            tile("💹",p==null?"—":p.toFixed(5),
              curBar&&S.atr?
                `vela ${curBar.c>=curBar.o?"verde":"roja"}`:"precio",
              curBar&&curBar.c>=curBar.o?GREEN:RED)+
            tile("📐",trendTxt,"Zona "+POSN2[S.pos],trendCol)+
            tile("🧩",S.pat!=="NONE"?esc(PATN[S.pat]||S.pat):"—",
              "patrón",S.pat!=="NONE"?pCol(S.pat):GREY)+
            tile("🕯",cdlNow.names.length?
              cdlNow.names.map(n=>esc(PATN[n]||n)).join("+"):"—",
              "última vela",cdlNow.names.length?"#cfe":GREY)+
            tile("🔀",zzM?zzM[1]:"—",
              zzD?"señal "+dirWord(zzD[1]):"zigzag",
              zzM?(zzM[1]==="▲"?GREEN:RED):GREY)+
            tile("🎯",o.length?
              o.map(t=>`${t.dir==="HIGHER"?"▲":"▼"}${Math.max(0,Math.ceil((t.until-now)/1000))}s`).join(" "):
              "Libre",
              o.length?"abierta":"esperando",o.length?AMBER:GREY);

          if(!d.lastWhy){
            whyHead.innerHTML=
              `<span style="color:#789">Aún no ha entrado ninguna operación.</span>`;
            whyDet.style.display="none";
          }else{
            const w=d.lastWhy,r=w.result;
            const wc=w.dir==="HIGHER"?GREEN:RED;

            whyHead.innerHTML=
              `<div style="display:flex;align-items:center;gap:6px">`+
              `<b style="color:${wc};font-size:13px">${w.dir==="HIGHER"?"▲ SUBE":"▼ BAJA"}</b>`+
              `<span style="flex:1;color:#9ab;font-size:10px;${ELL}">${esc(w.title.replace(/^(SUBE|BAJA) por /,""))}</span>`+
              `<span style="color:#789;font-size:9px">${hhmmss(w.t).slice(3)}</span>`+
              `<span style="font-size:15px">${r?r.icon:"⏳"}</span></div>`;

            whyDet.style.display="block";
            whyBody.innerHTML=
              w.lines.map(l=>"• "+esc(l)).join("<br>")+
              (r?`<br><b>${esc(r.text)}</b>`:"");
          }

          const fh=d.story.length?
            d.story.slice(0,10).map(e=>{
              const open=expanded.has(String(e.t));

              return `<div data-t="${e.t}" style="display:flex;gap:6px;align-items:${open?"flex-start":"center"};padding:6px 7px;margin:2px 0;background:#111a27;border-radius:8px;font-size:11px">`+
                `<span style="flex:none;font-size:13px">${e.icon}</span>`+
                `<span style="flex:1;min-width:0;${open?"white-space:normal;line-height:1.4":ELL}">${esc(e.text)}</span>`+
                `<span style="flex:none;color:#789;font-size:9px">${hhmmss(e.t).slice(3)}</span></div>`;
            }).join("")
            :`<div style="color:#789">Sin eventos todavía…</div>`;

          if(fh!==feedHtml){
            feedHtml=fh;
            feed.innerHTML=fh;
          }

        }else if(tab===2){
          const sk=Object.keys(rl.seen)
            .sort((a,c)=>rl.seen[c]-rl.seen[a]);

          seenTitle.textContent=
            "🧩 Patrones vistos"+(sk.length?` (${sk.length})`:"");

          const sh=sk.length?
            sk.map(k=>{
              const on=ui.sel===k;

              return `<div data-k="${k}" style="display:flex;align-items:center;justify-content:center;gap:3px;background:${on?"#2a3a58":"#141c2a"};`+
                `border:1px solid ${on?"#5a7aa8":"#29364a"};border-radius:8px;padding:6px 0;white-space:nowrap">`+
                `<span style="font-size:13px;color:${pCol(k)};line-height:1">${pGlyph(k)}</span>`+
                `<b style="font-size:10px;color:#cfe">${rl.seen[k]}</b></div>`;
            }).join("")
            :`<span style="color:#789;font-size:11px;grid-column:1/-1">👀 Sin patrones todavía</span>`;

          if(sh!==seenHtml){
            seenHtml=sh;
            seenBox.innerHTML=sh;
          }

          const sel=ui.sel&&rl.seen[ui.sel]!=null?ui.sel:null;

          const ih=sel?
            `<span style="color:${pCol(sel)};font-size:13px">${pGlyph(sel)}</span> `+
            `<b style="color:#cfe">${esc(PATN[sel]||sel)}</b> ×${rl.seen[sel]}`+
            (PAT_DIR[sel]?` → ${dirWord(PAT_DIR[sel])}`:"")+
            (PATD[sel]?`<br>${esc(PATD[sel])}`:"")
            :"👆 Toca un icono para ver qué significa";

          if(ih!==seenInfoHtml){
            seenInfoHtml=ih;
            seenInfo.innerHTML=ih;
          }

          const rows=Object.keys(rl.Q)
            .filter(k=>k.split("|").length>=2&&rl.Q[k].N>0)
            .sort((a,c)=>rl.Q[c].N-rl.Q[a].N)
            .slice(0,10);

          const th=rows.length?
            rows.map(k=>{
              const parts=k.split("|");
              const sc=parts[0],pt=parts[1],e=rl.Q[k];
              const n=e.recentN||e.N;
              const w=e.recentN?e.recentW/e.recentN:e.W/e.N;

              let col,icon;
              const us=sc==="USR";

              if(n<(us?CFG.usrMinN:CFG.rlMinN)){
                col="#789";icon="⏳";
              }else if(w>b){
                col=GREEN;icon="✅";
              }else if(1-w>b){
                col=AMBER;icon="🔄";
              }else{
                col=RED;icon="⛔";
              }

              const pc=pCol(pt);
              const nm=PATN[pt]||pt;

              return `<div style="display:flex;align-items:center;gap:5px;background:#111a27;border:1px solid #253247;border-radius:8px;padding:6px 7px;margin:2px 0;font-size:10px">`+
                `<span style="flex:none">${icon}</span>`+
                `<span style="flex:none" title="${esc(SRCN[sc]||sc)}">${SRC_ICON[sc]||esc(sc)}</span>`+
                `<span style="flex:1;min-width:0;${ELL}"><span style="color:${pc}">${pGlyph(pt)}</span> ${esc(nm)}</span>`+
                `<div style="position:relative;flex:none;width:36px;height:4px;background:#1b2433;border-radius:3px">`+
                `<div style="width:${(w*100).toFixed(0)}%;height:100%;background:${col};border-radius:3px"></div>`+
                `<div style="position:absolute;left:${(b*100).toFixed(1)}%;top:-2px;width:1px;height:8px;background:#fff"></div></div>`+
                `<b style="flex:none;width:26px;text-align:right;color:${col}" title="Acierto reciente">${(w*100).toFixed(0)}%</b>`+
                `<span style="flex:none;width:28px;text-align:right;color:#8aa" title="${e.N} casos totales">${n}</span></div>`;
            }).join("")
            :`<div style="color:#789;font-size:11px">📚 Aún sin datos. Opera o deja correr PLEX.</div>`;

          if(th!==tblHtml){
            tblHtml=th;
            tbl.innerHTML=th;
          }
        }
      }catch(e){
        console.error("[PLEX UI]",e);
      }
    };

    setInterval(()=>{
      if(ui.open)renderFn();
      else renderCompactHeader();
    },400);

    applyOpen();
  }

  window.PLEX_MOD.ui={
    box,
    setupButtons,
    paintHeader,
    setSettingsStatus:text=>{
      if(settingsStatus) settingsStatus.textContent=String(text);
    },
    initDashboard
  };
})();
