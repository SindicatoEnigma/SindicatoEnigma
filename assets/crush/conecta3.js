(() => {
"use strict";

const ROWS = 10, COLS = 7;
const TYPES = ["figura_1","figura_2","figura_3","figura_4","figura_5"];
const ASSET = "../assets/crush/";
const DEFAULT_IMAGES = Object.fromEntries(TYPES.map(type => [type, `${ASSET}imagenes/${type}.svg`]));
const SPECIAL_IMAGES = {arrowH:`${ASSET}imagenes/flecha_horizontal.svg`,arrowV:`${ASSET}imagenes/flecha_vertical.svg`,star:`${ASSET}imagenes/estrella.svg`,red:`${ASSET}imagenes/especial_rojo.svg`};
const SOUND_FILES = {
  swap:"intercambio", clear:"eliminacion", cascade:"cascada", combo:"combo",
  arrow:"especial_flecha", star:"especial_estrella", red:"especial_rojo",
  win:"victoria", lose:"derrota"
};

const $ = id => document.getElementById(id);
const boardEl = $("board");
let board = [];
let busy = false;
let ended = false;
let score = 0;
let totalCleared = 0;
let startTime = 0;
let elapsedBeforePause = 0;
let timerHandle = null;
let config = {nombre:"Conecta 3",modo:"tiempo",minutos:3,meta:0,images:{...DEFAULT_IMAGES}};
let dragStart = null;
let dragPointerId = null;
let soundEnabled = true;
let audioUnlocked = false;
let audioContext = null;
let activeAudio = [];
let lastTurnTime = 0;

function resolveAssetPath(path) {
  const clean=String(path||"").trim();
  if(!clean) throw new Error("Hay una ruta de imagen vacía en [FIGURAS].");
  if(/^https?:\/\//i.test(clean) || clean.startsWith("data:")) return clean;
  return new URL(clean.startsWith("../") ? clean : `../${clean}`, location.href).href;
}
function parseConfig(text) {
  const result={}, images={...DEFAULT_IMAGES}, configuredImages=new Set();
  let section="";
  text.split(/\r?\n/).forEach(line=>{
    const trimmed=line.trim();
    if(!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) return;
    const header=trimmed.match(/^\[([^\]]+)\]$/);
    if(header){section=header[1].trim().toUpperCase();return;}
    const idx=trimmed.indexOf("="); if(idx<0)return;
    const key=trimmed.slice(0,idx).trim().toLowerCase();
    const value=trimmed.slice(idx+1).trim();
    if(section==="FIGURAS") {
      const match=key.match(/^figura_?([1-5])$/);
      if(match) {
        const ext=value.split(/[?#]/)[0].toLowerCase();
        if(!/\.(png|jpe?g|svg)$/.test(ext)) throw new Error(`Formato de imagen no admitido para ${key}. Usa PNG, JPG, JPEG o SVG.`);
        images[`figura_${match[1]}`]=resolveAssetPath(value);
        configuredImages.add(`figura_${match[1]}`);
      }
    } else result[key]=value;
  });
  if(configuredImages.size && configuredImages.size!==5) throw new Error("La sección [FIGURAS] debe definir las cinco imágenes: figura1 a figura5.");
  const modo=(result.modo||"tiempo").toLowerCase();
  const minutos=Number(result.minutos??3), meta=Number(result.meta??0);
  if(!["tiempo","puntos"].includes(modo)) throw new Error("El modo debe ser 'tiempo' o 'puntos'.");
  if(!Number.isFinite(minutos)||minutos<0||!Number.isFinite(meta)||meta<0) throw new Error("Los valores de minutos o meta no son válidos.");
  if(modo==="tiempo"&&minutos<=0) throw new Error("El modo tiempo necesita minutos mayores que cero.");
  if(modo==="puntos"&&meta<=0) throw new Error("El modo puntos necesita una meta mayor que cero.");
  return {nombre:result.nombre||"Conecta 3",modo,minutos,meta,images};
}
async function loadConfig() {
  const params = new URLSearchParams(location.search);
  const requested = params.get("datos") || "assets/crush/configuraciones/nivel_001.txt";
  const path = requested.startsWith("../") ? requested : `../${requested}`;
  try {
    const response = await fetch(new URL(path, location.href));
    if (!response.ok) throw new Error(`No se pudo cargar ${requested} (${response.status}).`);
    config = parseConfig(await response.text());
  } catch (err) {
    console.error(err);
    showMessage("No se pudo cargar la configuración", `${err.message} Se usará una configuración de respaldo de 3 minutos.`);
    config = {nombre:"Conecta 3 — respaldo",modo:"tiempo",minutos:3,meta:0,images:{...DEFAULT_IMAGES}};
  }
  $("level-name").textContent = config.nombre;
  $("timer-label").textContent = config.modo === "tiempo" ? "TIEMPO RESTANTE" : "TIEMPO";
  $("mode-description").textContent = config.modo === "tiempo"
    ? `Consigue la mayor puntuación en ${config.minutos} minutos.`
    : `Alcanza ${config.meta.toLocaleString("es-MX")} puntos. El cronómetro cuenta hacia arriba.`;
  $("target").textContent = config.modo === "puntos" ? `META: ${config.meta.toLocaleString("es-MX")}` : "";
  startGame();
}

function randomType() { return TYPES[Math.floor(Math.random()*TYPES.length)]; }
function newPiece(type=randomType(), special=null) { return {type,special}; }
function copyBoard() { return board.map(row => row.map(p => p ? {...p} : null)); }
function sameType(a,b) { return a && b && a.type === b.type; }
function inBounds(r,c) { return r>=0 && r<ROWS && c>=0 && c<COLS; }
function cellId(r,c) { return `tile-${r}-${c}`; }

function initialBoard() {
  let attempts=0;
  do {
    board = Array.from({length:ROWS},()=>Array(COLS).fill(null));
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
      let type;
      do {
        type=randomType();
      } while ((c>=2 && board[r][c-1]?.type===type && board[r][c-2]?.type===type) ||
               (r>=2 && board[r-1][c]?.type===type && board[r-2][c]?.type===type));
      board[r][c]=newPiece(type);
    }
    attempts++;
  } while (!hasPossibleMove() && attempts<100);
}

function renderBoard(options={}) {
  boardEl.innerHTML="";
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    const p=board[r][c];
    const cell=document.createElement("button");
    cell.type="button"; cell.className="tile"; cell.id=cellId(r,c);
    cell.dataset.r=r; cell.dataset.c=c; cell.setAttribute("role","gridcell");
    cell.setAttribute("aria-label",p?`${p.type}${p.special?", especial "+p.special:""}`:"Vacío");
    if(p) {
      const img=document.createElement("img");
      img.className="piece-image"; img.src=config.images?.[p.type]||DEFAULT_IMAGES[p.type];
      img.alt=""; img.draggable=false; cell.appendChild(img);
      if(p.special) {
        const badge=document.createElement("img");
        badge.className="special-icon"; badge.src=SPECIAL_IMAGES[p.special]; badge.alt=""; badge.draggable=false;
        cell.appendChild(badge); cell.classList.add("special");
      }
    }
    if(options.falling) cell.classList.add("falling");
    boardEl.appendChild(cell);
  }
}
function showHint(text) { $("game-hint").textContent=text; }

// Control exclusivo por arrastre: funciona con dedo, lápiz o ratón.
boardEl.addEventListener("pointerdown", event=>{
  const tile=event.target.closest(".tile");
  if(!tile||busy||ended||event.button>0)return;
  unlockAudio();
  dragStart={r:Number(tile.dataset.r),c:Number(tile.dataset.c)};
  dragPointerId=event.pointerId;
  try { boardEl.setPointerCapture(event.pointerId); } catch(_) {}
  tile.classList.add("drag-origin");
  event.preventDefault();
});
boardEl.addEventListener("pointerup", event=>{
  if(!dragStart||event.pointerId!==dragPointerId)return;
  const from=dragStart; dragStart=null; dragPointerId=null;
  boardEl.querySelectorAll(".drag-origin,.drag-target").forEach(el=>el.classList.remove("drag-origin","drag-target"));
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest(".tile");
  if(!target||busy||ended)return;
  const to={r:Number(target.dataset.r),c:Number(target.dataset.c)};
  if(Math.abs(from.r-to.r)+Math.abs(from.c-to.c)!==1){showHint("Arrastra únicamente a una casilla vecina.");return;}
  if(from.r!==to.r||from.c!==to.c) swap(from,to);
});
boardEl.addEventListener("pointermove",event=>{
  if(!dragStart||event.pointerId!==dragPointerId)return;
  boardEl.querySelectorAll(".drag-target").forEach(el=>el.classList.remove("drag-target"));
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest(".tile");
  if(target) target.classList.add("drag-target");
});
function cancelDrag(){dragStart=null;dragPointerId=null;boardEl.querySelectorAll(".drag-origin,.drag-target").forEach(el=>el.classList.remove("drag-origin","drag-target"));}
boardEl.addEventListener("pointercancel",cancelDrag);
function showHint(text) { $("game-hint").textContent=text; }
function swap(a,b) {
  if(busy || ended) return;
  const p1=board[a.r][a.c], p2=board[b.r][b.c];
  if(!p1 || !p2) return;
  busy=true;
  playSound("swap");
  board[a.r][a.c]=p2; board[b.r][b.c]=p1;
  renderBoard();
  if(p1.special==="red" || p2.special==="red" || (p1.special && p2.special)) {
    processSpecialSwap(a,b,p1,p2).then(finishTurn);
    return;
  }
  const matches=findMatches();
  if(!matches.length) {
    setTimeout(()=>{
      board[a.r][a.c]=p1; board[b.r][b.c]=p2;
      renderBoard(); markInvalid(a,b); playSound("swap");
      busy=false; showHint("Ese intercambio no forma una combinación. Intenta otro movimiento.");
    },150);
    return;
  }
  processTurn(matches,b).then(finishTurn);
}
function markInvalid(a,b) {
  [a,b].forEach(pos=>$(cellId(pos.r,pos.c))?.classList.add("invalid"));
}
function findMatches() {
  const groups=[];
  for(let r=0;r<ROWS;r++) {
    let c=0;
    while(c<COLS) {
      const type=board[r][c]?.type;
      if(!type){c++;continue;}
      let end=c+1;
      while(end<COLS && board[r][end]?.type===type) end++;
      if(end-c>=3) groups.push({type,cells:Array.from({length:end-c},(_,i)=>({r,c:c+i})),orientation:"H"});
      c=end;
    }
  }
  for(let c=0;c<COLS;c++) {
    let r=0;
    while(r<ROWS) {
      const type=board[r][c]?.type;
      if(!type){r++;continue;}
      let end=r+1;
      while(end<ROWS && board[end][c]?.type===type) end++;
      if(end-r>=3) groups.push({type,cells:Array.from({length:end-r},(_,i)=>({r:r+i,c})),orientation:"V"});
      r=end;
    }
  }
  return mergeGroups(groups);
}
function mergeGroups(groups) {
  const byType=new Map();
  groups.forEach(g=>{
    const key=g.type;
    if(!byType.has(key)) byType.set(key,{type:key,cells:new Map(),h:0,v:0});
    const x=byType.get(key);
    g.cells.forEach(p=>x.cells.set(`${p.r},${p.c}`,p));
    if(g.orientation==="H") x.h=Math.max(x.h,g.cells.length);
    else x.v=Math.max(x.v,g.cells.length);
  });
  return [...byType.values()].map(g=>({...g,cells:[...g.cells.values()]}));
}
function chooseAnchor(group, preferred) {
  if(preferred && group.cells.some(p=>p.r===preferred.r&&p.c===preferred.c)) return preferred;
  return group.cells[Math.floor(group.cells.length/2)];
}
function addSpecialEffects(queue, pos, piece) {
  if(!piece?.special) return;
  const key=`${pos.r},${pos.c}`;
  if(queue.has(key)) return;
  queue.set(key,{...pos,special:piece.special});
}
function clearArea(set, r1,c1,r2,c2) {
  for(let r=Math.max(0,r1);r<=Math.min(ROWS-1,r2);r++)
    for(let c=Math.max(0,c1);c<=Math.min(COLS-1,c2);c++) set.add(`${r},${c}`);
}
function expandSpecial(pos, piece, clearSet, activated, queue) {
  const key=`${pos.r},${pos.c}`;
  if(activated.has(key)) return;
  activated.add(key);
  if(piece.special==="arrowH") {
    for(let c=0;c<COLS;c++) clearSet.add(`${pos.r},${c}`);
    playSound("arrow");
  } else if(piece.special==="arrowV") {
    for(let r=0;r<ROWS;r++) clearSet.add(`${r},${pos.c}`);
    playSound("arrow");
  } else if(piece.special==="star") {
    clearArea(clearSet,pos.r-2,pos.c-2,pos.r+2,pos.c+2);
    playSound("star");
  } else if(piece.special==="red") {
    const type=piece.type;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r][c]?.type===type) clearSet.add(`${r},${c}`);
    playSound("red");
  }
}
function processSpecialSwap(a,b,p1,p2) {
  return new Promise(resolve=>{
    const clearSet=new Set(), activated=new Set(), queue=new Map();
    const isRed=p1.special==="red" || p2.special==="red";
    if(isRed) {
      const redPos=p1.special==="red"?b:a; // after swap, red piece has moved to the other cell
      const other=p1.special==="red"?p2:p1;
      const redPiece=board[redPos.r][redPos.c];
      const otherPos=p1.special==="red"?a:b;
      if(other.special) {
        if(other.special==="arrowH" || other.special==="arrowV") {
          const row=otherPos.r,col=otherPos.c;
          if(other.special==="arrowH") for(let c=0;c<COLS;c++) clearSet.add(`${row},${c}`);
          else for(let r=0;r<ROWS;r++) clearSet.add(`${r},${col}`);
        } else if(other.special==="star") clearArea(clearSet,otherPos.r-2,otherPos.c-2,otherPos.r+2,otherPos.c+2);
        // La roja siempre desaparece, incluso cuando activa la habilidad de otra especial.
      }
      const targetType=other.type;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r][c]?.type===targetType) clearSet.add(`${r},${c}`);
      clearSet.add(`${redPos.r},${redPos.c}`);
      clearSet.add(`${otherPos.r},${otherPos.c}`);
      playSound("red");
    } else {
      const special1=p1.special, special2=p2.special;
      const posA=b, posB=a; // piezas intercambiadas ocupan las posiciones opuestas
      if(special1?.startsWith("arrow") && special2?.startsWith("arrow")) {
        for(let c=0;c<COLS;c++) clearSet.add(`${posA.r},${c}`);
        for(let r=0;r<ROWS;r++) clearSet.add(`${r},${posA.c}`);
        for(let c=0;c<COLS;c++) clearSet.add(`${posB.r},${c}`);
        for(let r=0;r<ROWS;r++) clearSet.add(`${r},${posB.c}`);
      } else if((special1==="star" && special2?.startsWith("arrow")) || (special2==="star" && special1?.startsWith("arrow"))) {
        const starPos=special1==="star"?posA:posB;
        const arrowPiece=special1==="star"?p2:p1;
        const arrowPos=special1==="star"?posB:posA;
        clearArea(clearSet,starPos.r-2,starPos.c-2,starPos.r+2,starPos.c+2);
        if(arrowPiece.special==="arrowH") for(let c=0;c<COLS;c++) clearSet.add(`${arrowPos.r},${c}`);
        else for(let r=0;r<ROWS;r++) clearSet.add(`${r},${arrowPos.c}`);
      } else if(special1==="star" && special2==="star") {
        clearArea(clearSet,posA.r-2,posA.c-2,posA.r+2,posA.c+2);
        clearArea(clearSet,posB.r-2,posB.c-2,posB.r+2,posB.c+2);
      } else {
        addSpecialEffects(queue,posA,board[posA.r][posA.c]);
        addSpecialEffects(queue,posB,board[posB.r][posB.c]);
      }
      playSound("combo");
    }
    clearSet.add(`${a.r},${a.c}`); clearSet.add(`${b.r},${b.c}`);
    const turn={types:new Set(),cleared:0,multiplier:1,combo:0};
    resolve(clearAndCascade(clearSet,turn,queue,activated).then(()=>awardTurn(turn)));
  });
}
async function processTurn(firstMatches, preferred) {
  const turn={types:new Set(),cleared:0,multiplier:1,combo:0};
  let matches=firstMatches;
  let first=true;
  while(matches.length) {
    const clearSet=new Set(), queue=new Map(), activated=new Set();
    for(const group of matches) {
      turn.types.add(group.type);
      const anchor=chooseAnchor(group,first?preferred:null);
      let special=null;
      if(group.cells.length>=5) special="star";
      else if(group.cells.length===4) special=group.h>=4?"arrowH":"arrowV";
      if(special) {
        // El ancla sobrevive como pieza especial; se excluye del conjunto eliminado.
        const piece=board[anchor.r][anchor.c];
        piece.special=special;
        group.cells.forEach(p=>{if(p.r!==anchor.r||p.c!==anchor.c) clearSet.add(`${p.r},${p.c}`);});
      } else group.cells.forEach(p=>clearSet.add(`${p.r},${p.c}`));
      group.cells.forEach(p=>{
        const piece=board[p.r][p.c];
        if(piece?.special && (p.r!==anchor.r || p.c!==anchor.c || !special)) addSpecialEffects(queue,p,piece);
      });
    }
    await clearAndCascade(clearSet,turn,queue,activated);
    turn.multiplier=Math.max(1,turn.types.size);
    if(turn.multiplier>=4 && !turn.redCreated) {
      const candidate=findRedAnchor();
      if(candidate) { board[candidate.r][candidate.c].special="red"; turn.redCreated=true; }
    }
    renderBoard();
    first=false;
    matches=findMatches();
    if(matches.length) { turn.combo++; playSound("cascade"); await delay(190); }
  }
  awardTurn(turn);
}
function findRedAnchor() {
  // Conserva una pieza que siga en el tablero y no tenga ya una especial.
  for(let r=ROWS-1;r>=0;r--) for(let c=COLS-1;c>=0;c--) if(board[r][c] && !board[r][c].special) return {r,c};
  return null;
}
async function clearAndCascade(initialClear,turn,queue,activated) {
  const clearSet=new Set(initialClear);
  // Encadena especiales que queden dentro del área eliminada.
  let changed=true;
  while(changed) {
    changed=false;
    for(const key of [...clearSet]) {
      const [r,c]=key.split(",").map(Number);
      const piece=board[r]?.[c];
      if(piece?.special && !activated.has(key)) {
        const before=clearSet.size;
        expandSpecial({r,c},piece,clearSet,activated,queue);
        if(clearSet.size>before) changed=true;
      }
    }
  }
  if(!clearSet.size) return;
  clearSet.forEach(key=>{
    const [r,c]=key.split(",").map(Number), piece=board[r][c];
    if(piece) { turn.types.add(piece.type); turn.cleared++; $(cellId(r,c))?.classList.add("breaking"); }
  });
  playSound("clear");
  await delay(500);
  clearSet.forEach(key=>{const [r,c]=key.split(",").map(Number);board[r][c]=null;});
  for(let c=0;c<COLS;c++) {
    const remaining=[];
    for(let r=ROWS-1;r>=0;r--) if(board[r][c]) remaining.push(board[r][c]);
    for(let r=ROWS-1;r>=0;r--) board[r][c]=remaining[ROWS-1-r] || newPiece();
  }
  renderBoard({falling:true});
  await delay(500);
}
function awardTurn(turn) {
  turn.multiplier=Math.max(1,turn.types.size);
  const points=10*turn.cleared*turn.multiplier;
  score+=points;
  totalCleared+=turn.cleared;
  $("score").textContent=score.toLocaleString("es-MX");
  $("multiplier").textContent=`×${turn.multiplier}`;
  showHint(turn.cleared ? `${turn.cleared} figuras eliminadas · ×${turn.multiplier} · +${points.toLocaleString("es-MX")} puntos` : "¡Encuentra una combinación!");
  if(turn.combo>=2 || turn.multiplier>=3) playSound("combo");
  renderBoard();
}
async function finishTurn() {
  if(ended) return;
  // Si una cascada automática produce otra línea, resuélvela antes de liberar el tablero.
  let safety=0;
  while(findMatches().length && safety++<20) {
    const matches=findMatches();
    const turn={types:new Set(),cleared:0,multiplier:1,combo:0};
    await processTurn(matches,null);
    break;
  }
  busy=false;
    renderBoard();
  if(!hasPossibleMove()) {
    showHint("Sin movimientos disponibles: reorganizando el tablero.");
    initialBoard(); renderBoard();
  }
  if(config.modo==="puntos" && score>=config.meta) endGame(true);
}
function hasPossibleMove() {
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    for(const [dr,dc] of [[0,1],[1,0]]) {
      const nr=r+dr,nc=c+dc;
      if(!inBounds(nr,nc)) continue;
      const a=board[r][c],b=board[nr][nc];
      if(!a||!b) continue;
      if(a.special==="red"||b.special==="red"||(a.special&&b.special)) return true;
      board[r][c]=b;board[nr][nc]=a;
      const found=findMatches().length>0;
      board[r][c]=a;board[nr][nc]=b;
      if(found) return true;
    }
  }
  return false;
}
function delay(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }

function formatTime(seconds) {
  const tenths=Math.max(0,Math.floor(seconds*10));
  const mins=Math.floor(tenths/600), secs=Math.floor((tenths%600)/10), tenth=tenths%10;
  return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}.${tenth}`;
}
function currentElapsed() { return Math.max(0,(performance.now()-startTime)/1000); }
function updateClock() {
  if(ended) return;
  const elapsed=currentElapsed();
  if(config.modo==="tiempo") {
    const remaining=Math.max(0,config.minutos*60-elapsed);
    $("timer").textContent=formatTime(remaining);
    if(remaining<=0) endGame(false);
  } else $("timer").textContent=formatTime(elapsed);
}
function startClock() {
  startTime=performance.now();
  clearInterval(timerHandle);
  updateClock();
  timerHandle=setInterval(updateClock,75);
}
function startGame() {
  clearInterval(timerHandle);
  score=0;totalCleared=0;cancelDrag();busy=false;ended=false;
  $("score").textContent="0";$("multiplier").textContent="×1";
  $("overlay").classList.remove("visible");
  $("overlay").setAttribute("aria-hidden","true");
  initialBoard();renderBoard();startClock();
  showHint("Arrastra una figura hacia una casilla vecina para formar una línea.");
}
function endGame(won) {
  if(ended) return;
  ended=true;busy=true;clearInterval(timerHandle);
  const elapsed=currentElapsed();
  playSound(won?"win":"lose");
  $("dialog-eyebrow").textContent=won?"EXPEDIENTE RESUELTO":"TIEMPO AGOTADO";
  $("dialog-title").textContent=won?"¡Caso resuelto!":"Fin de la partida";
  $("dialog-message").textContent=won?"Has alcanzado la puntuación requerida.":"Se terminó el tiempo disponible. Revisa tu resultado.";
  $("result-stats").innerHTML=`
    <div class="stat"><span>PUNTUACIÓN FINAL</span><strong>${score.toLocaleString("es-MX")}</strong></div>
    <div class="stat"><span>TIEMPO DE JUEGO</span><strong>${formatTime(elapsed)}</strong></div>
    <div class="stat"><span>FIGURAS ELIMINADAS</span><strong>${totalCleared}</strong></div>
    <div class="stat"><span>OBJETIVO</span><strong>${config.modo==="puntos"?config.meta.toLocaleString("es-MX"):"Tiempo"}</strong></div>`;
  $("overlay").classList.add("visible");$("overlay").setAttribute("aria-hidden","false");
}
function showMessage(title,message) {
  $("dialog-title").textContent=title;$("dialog-message").textContent=message;
  $("result-stats").innerHTML="";
  $("dialog-eyebrow").textContent="AVISO";
  $("continue-button").style.display="none";
  $("overlay").classList.add("visible");
}
function continueToEngine() {
  const elapsed=currentElapsed();
  const payload={tipo:"SE_MINIJUEGO_RESULTADO",resultado:{completado:true,puntuacion:score,tiempo:formatTime(elapsed)}};
  if(window.parent && window.parent!==window) {
    window.parent.postMessage(payload,window.location.origin);
  } else {
    showHint("Partida finalizada. Puedes cerrar esta ventana.");
    $("continue-button").textContent="CERRAR";
    $("continue-button").onclick=()=>window.close();
  }
}
function unlockAudio() {
  if(audioUnlocked) return;
  audioUnlocked=true;
  try {
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(Ctx) { audioContext=new Ctx(); if(audioContext.state==="suspended") audioContext.resume(); }
  } catch(e) { console.warn("Audio no disponible",e); }
}
function playSound(name) {
  if(!soundEnabled) return;
  // Audio HTML externo: si falta un archivo, el juego continúa sin errores.
  const file=SOUND_FILES[name];
  if(!file) return;
  try {
    if(activeAudio.length>5) { const old=activeAudio.shift(); old.pause(); }
    const audio=new Audio(`${ASSET}sonidos/${file}.wav`);
    audio.volume=(name==="win"||name==="lose")?.42:.28;
    activeAudio.push(audio);
    const promise=audio.play();
    if(promise?.catch) promise.catch(()=>{});
  } catch(e) { /* Sonido opcional: no interrumpir el juego. */ }
}
function toggleSound() {
  soundEnabled=!soundEnabled;
  $("sound-toggle").textContent=`♫ Sonido: ${soundEnabled?"sí":"no"}`;
  if(!soundEnabled) activeAudio.forEach(a=>{a.pause();a.currentTime=0;});
  else { unlockAudio(); playSound("swap"); }
}

$("restart-button").addEventListener("click",()=>{unlockAudio();startGame();});
$("help-button").addEventListener("click",()=>{$("rules-overlay").classList.add("visible");$("rules-overlay").setAttribute("aria-hidden","false");});
$("close-rules").addEventListener("click",closeRules);
$("rules-ok").addEventListener("click",closeRules);
function closeRules() {$("rules-overlay").classList.remove("visible");$("rules-overlay").setAttribute("aria-hidden","true");}
$("sound-toggle").addEventListener("click",toggleSound);
$("play-again-button").addEventListener("click",()=>{ $("continue-button").style.display=""; startGame(); });
$("continue-button").addEventListener("click",continueToEngine);

loadConfig();
})();