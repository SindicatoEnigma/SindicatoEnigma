// MOTOR DE SOPA DE LETRAS v0.1 - Sindicato Enigma
const DATA_URL="../assets/sopa_letras/sopa_prueba.txt";
const boardEl=document.getElementById("board"), wordListEl=document.getElementById("word-list");
const timerEl=document.getElementById("timer"), errorsEl=document.getElementById("errors");
const statusEl=document.getElementById("status"), finishEl=document.getElementById("finish");
const finalTimeEl=document.getElementById("final-time"), finalErrorsEl=document.getElementById("final-errors");
const restartBtn=document.getElementById("restart");
let gameData=null,cells=[],words=[],errors=0,elapsed=0,timerId=null,finished=false;

function normalize(t){return String(t||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function getValue(lines,key){const l=(lines||[]).find(x=>x.toLowerCase().startsWith(key.toLowerCase()+"="));return l?l.slice(l.indexOf("=")+1).trim():""}

function parseData(text){
  const sections={};let current=null;
  for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith("#"))continue;
    const m=line.match(/^\[([^\]]+)\]$/);if(m){current=m[1].toUpperCase();sections[current]=[];continue}
    if(current)sections[current].push(line);
  }
  const board=(sections.TABLERO||[]).map(r=>r.split(/\s+/).map(normalize));
  if(!board.length)throw new Error("No existe [TABLERO].");
  const cols=board[0].length;if(!cols||!board.every(r=>r.length===cols))throw new Error("Las filas deben tener el mismo número de columnas.");
  const words=(sections.PALABRAS||[]).map(line=>{
    const [left,...coords]=line.split("|"),eq=left.indexOf("=");
    if(eq<0)throw new Error("Formato incorrecto: "+line);
    return {number:Number(left.slice(0,eq).trim()),answer:normalize(left.slice(eq+1)),positions:coords.map(x=>{const [r,c]=x.split(",").map(Number);return{r:r-1,c:c-1}}),revealed:new Set(),complete:false};
  });
  if(!words.length)throw new Error("No existe ninguna palabra.");
  validate(board,words);
  return {name:getValue(sections.SOPA,"nombre")||"Sopa de letras",board,words};
}

function validate(board,words){
  for(const w of words){
    if(w.answer.length!==w.positions.length)throw new Error("La palabra "+w.number+" no coincide con sus coordenadas.");
    w.positions.forEach((p,i)=>{
      if(p.r<0||p.r>=board.length||p.c<0||p.c>=board[0].length)throw new Error("Coordenada fuera del tablero en palabra "+w.number+".");
      if(board[p.r][p.c]!==w.answer[i])throw new Error("La palabra "+w.number+" no coincide con el tablero.");
    });
  }
}

async function loadGame(){
  try{
    const response=await fetch(DATA_URL,{cache:"no-store"});if(!response.ok)throw new Error("No se pudo cargar el TXT.");
    gameData=parseData(await response.text());words=gameData.words.map(w=>({...w,revealed:new Set()}));
    buildBoard();buildWordList();resetGame();statusEl.textContent=gameData.name;
  }catch(e){console.error(e);statusEl.textContent="Error al cargar la sopa.";boardEl.innerHTML="<div style='padding:20px;background:white;grid-column:1/-1'>"+e.message+"</div>"}
}

function buildBoard(){
  const b=gameData.board,r=b.length,c=b[0].length;boardEl.style.gridTemplateColumns=`repeat(${c},minmax(0,1fr))`;boardEl.style.gridTemplateRows=`repeat(${r},minmax(0,1fr))`;boardEl.innerHTML="";cells=[];
  const memberships=new Map();
  words.forEach((w,wi)=>w.positions.forEach((p,li)=>{const k=`${p.r},${p.c}`;if(!memberships.has(k))memberships.set(k,[]);memberships.get(k).push({wordIndex:wi,letterIndex:li})}));
  for(let r=0;r<b.length;r++)for(let c=0;c<b[0].length;c++){
    const cell=document.createElement("button");cell.type="button";cell.className="cell";cell.textContent=b[r][c];cell.dataset.row=r;cell.dataset.col=c;cell.memberships=memberships.get(`${r},${c}`)||[];cell.addEventListener("click",()=>selectCell(cell));boardEl.appendChild(cell);cells.push(cell);
  }
}

function buildWordList(){
  wordListEl.innerHTML="";
  words.forEach((w,wi)=>{
    const e=document.createElement("div");e.className="word-entry";e.id=`word-${wi}`;
    const n=document.createElement("span");n.className="word-number";n.textContent=w.number;
    const slots=document.createElement("div");slots.className="letter-slots";
    for(let i=0;i<w.answer.length;i++){const s=document.createElement("div");s.className="letter-slot";s.id=`word-${wi}-letter-${i}`;slots.appendChild(s)}
    e.append(n,slots);wordListEl.appendChild(e);
  });
}

function resetGame(){
  stopTimer();errors=0;elapsed=0;finished=false;errorsEl.textContent="0";timerEl.textContent="00:00";finishEl.classList.add("hidden");
  words.forEach(w=>{w.revealed=new Set();w.complete=false});cells.forEach(c=>c.className="cell");
  document.querySelectorAll(".letter-slot").forEach(s=>s.textContent="");
  document.querySelectorAll(".word-entry").forEach(e=>e.classList.remove("complete"));startTimer();
}
function startTimer(){timerId=setInterval(()=>{elapsed++;timerEl.textContent=formatTime(elapsed)},1000)}
function stopTimer(){if(timerId!==null){clearInterval(timerId);timerId=null}}
function selectCell(cell){
  if(finished||cell.classList.contains("locked"))return;
  if(cell.memberships.length===0){cell.classList.add("wrong","locked");errors++;errorsEl.textContent=errors;return}
  cell.classList.add("correct","locked");
  for(const m of cell.memberships){const w=words[m.wordIndex];w.revealed.add(m.letterIndex);const slot=document.getElementById(`word-${m.wordIndex}-letter-${m.letterIndex}`);if(slot)slot.textContent=w.answer[m.letterIndex];checkWord(m.wordIndex)}
  if(words.every(w=>w.complete)){finished=true;stopTimer();finalTimeEl.textContent=formatTime(elapsed);finalErrorsEl.textContent=errors;finishEl.classList.remove("hidden");statusEl.textContent="Expediente resuelto."}
}
function checkWord(wi){
  const w=words[wi];if(w.complete||w.revealed.size!==w.answer.length)return;w.complete=true;document.getElementById(`word-${wi}`).classList.add("complete");
  w.positions.forEach(p=>{const c=getCell(p.r,p.c);if(c)c.classList.add("word-complete")});
}
function getCell(r,c){return cells.find(x=>Number(x.dataset.row)===r&&Number(x.dataset.col)===c)}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
restartBtn.addEventListener("click",loadGame);loadGame();