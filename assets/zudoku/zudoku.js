/* ZUDOKU - MOTOR v0.1 - Sindicato Enigma */
const PUZZLE_FILE="../assets/zudoku/zudoku_prueba.txt";
const MAX_HINTS=3;
let solution=[],initialClues=new Set(),cells=[],selectedCell=null,notesMode=false;
let errors=0,hintsUsed=0,elapsedSeconds=0,timerInterval=null,gameFinished=false;
let puzzleInfo={nombre:"Zudoku",autor:"Sindicato Enigma",final:"¡Has completado el Zudoku!"};

const boardEl=document.getElementById("board"),numberPadEl=document.getElementById("numberPad");
const timerEl=document.getElementById("timer"),errorsEl=document.getElementById("errors"),hintsEl=document.getElementById("hints");
const notesBtn=document.getElementById("notesBtn"),deleteBtn=document.getElementById("deleteBtn"),hintBtn=document.getElementById("hintBtn");
const messageEl=document.getElementById("message"),finishScreen=document.getElementById("finishScreen");
const finalMessage=document.getElementById("finalMessage"),finalTime=document.getElementById("finalTime"),finalErrors=document.getElementById("finalErrors"),finalHints=document.getElementById("finalHints");
const restartBtn=document.getElementById("restartBtn"),menuBtn=document.getElementById("menuBtn");

async function loadPuzzle(){
 try{const r=await fetch(PUZZLE_FILE);if(!r.ok)throw Error("TXT no encontrado");parsePuzzle(await r.text());startGame();}
 catch(e){console.error(e);messageEl.textContent="ERROR: no se pudo cargar el Zudoku.";}
}
function parsePuzzle(text){
 let section="",boardLines=[],clueLines=[];
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line||line.startsWith("#"))continue;
  if(line.startsWith("[")&&line.endsWith("]")){section=line.toUpperCase();continue}
  if(section==="[ZUDOKU]"){const i=line.indexOf("=");if(i>-1){const k=line.slice(0,i).trim().toLowerCase(),v=line.slice(i+1).trim();if(k==="nombre")puzzleInfo.nombre=v;if(k==="autor")puzzleInfo.autor=v;}}
  if(section==="[TABLERO]")boardLines.push(line);
  if(section==="[PISTAS]")clueLines.push(line);
  if(section==="[FINAL]"){const i=line.indexOf("=");if(i>-1&&line.slice(0,i).trim().toLowerCase()==="mensaje")puzzleInfo.final=line.slice(i+1).trim();}
 }
 solution=boardLines.map(r=>r.split(/\s+/).map(Number));
 if(solution.length!==9||solution.some(r=>r.length!==9||r.some(n=>!Number.isInteger(n)||n<1||n>9)))throw Error("Tablero 9x9 inválido");
 initialClues=new Set();
 for(const clue of clueLines){const p=clue.split(",");if(p.length!==2)continue;const row=Number(p[0].trim()),col=Number(p[1].trim());if(row>=1&&row<=9&&col>=1&&col<=9)initialClues.add(`${row-1},${col-1}`);}
}
function startGame(){
 clearInterval(timerInterval);errors=0;hintsUsed=0;elapsedSeconds=0;selectedCell=null;notesMode=false;gameFinished=false;
 finishScreen.classList.add("hidden");updateCounters();buildBoard();buildNumberPad();updateNumberButtons();updateNotesButton();
 timerInterval=setInterval(()=>{if(!gameFinished){elapsedSeconds++;timerEl.textContent=formatTime(elapsedSeconds)}},1000);
}
function buildBoard(){
 boardEl.innerHTML="";cells=[];
 for(let row=0;row<9;row++)for(let col=0;col<9;col++){
  const cell={row,col,value:null,notes:new Set(),locked:false,incorrect:false,element:null};
  if(initialClues.has(`${row},${col}`)){cell.value=solution[row][col];cell.locked=true}
  const el=document.createElement("div");el.className="cell";
  if((Math.floor(row/3)+Math.floor(col/3))%2===1)el.classList.add("sector-gray");
  const notesEl=document.createElement("div");notesEl.className="notes";
  for(let n=1;n<=9;n++){const note=document.createElement("span");note.className="note";note.dataset.note=n;notesEl.appendChild(note)}
  el.appendChild(notesEl);el.addEventListener("click",()=>selectCell(cell));cell.element=el;cells.push(cell);boardEl.appendChild(el);renderCell(cell);
 }
}
function buildNumberPad(){
 numberPadEl.innerHTML="";
 for(let n=1;n<=9;n++){const b=document.createElement("button");b.className="number-btn";b.textContent=n;b.dataset.number=n;b.addEventListener("click",()=>enterNumber(n));numberPadEl.appendChild(b)}
}
function selectCell(cell){if(gameFinished)return;selectedCell=cell;updateHighlights();showMessage("")}
function updateHighlights(){
 for(const cell of cells){
  cell.element.classList.remove("selected","peer-line","peer-sector","peer-both","same-number");
  if(!selectedCell)continue;
  const row=cell.row===selectedCell.row;
  const col=cell.col===selectedCell.col;
  const line=row||col;
  const sector=Math.floor(cell.row/3)===Math.floor(selectedCell.row/3)&&Math.floor(cell.col/3)===Math.floor(selectedCell.col/3);
  if(cell===selectedCell)cell.element.classList.add("selected");
  else if(line&&sector)cell.element.classList.add("peer-both");
  else if(line)cell.element.classList.add("peer-line");
  else if(sector)cell.element.classList.add("peer-sector");
  if(selectedCell.value!==null&&cell.value===selectedCell.value)cell.element.classList.add("same-number");
 }
}
function enterNumber(number){
 if(gameFinished)return;
 if(!selectedCell){showMessage("Selecciona una casilla.");return}
 if(selectedCell.locked){showMessage("Esta casilla está bloqueada.");return}
 if(notesMode){toggleNote(number);return}
 selectedCell.notes.clear();
 if(number===solution[selectedCell.row][selectedCell.col]){
  selectedCell.value=number;selectedCell.incorrect=false;selectedCell.locked=true;
  clearPeerNotes(number,selectedCell);
  renderCell(selectedCell);updateHighlights();updateNumberButtons();showMessage("Correcto.");checkCompletion();
 }else{
  selectedCell.value=number;selectedCell.incorrect=true;errors++;updateCounters();renderCell(selectedCell);updateHighlights();showMessage("Respuesta incorrecta.");
 }
}
function clearPeerNotes(number,origin){
 for(const cell of cells){
  if(cell===origin)continue;
  const sameRow=cell.row===origin.row;
  const sameCol=cell.col===origin.col;
  const sameSector=Math.floor(cell.row/3)===Math.floor(origin.row/3)&&Math.floor(cell.col/3)===Math.floor(origin.col/3);
  if(sameRow||sameCol||sameSector){
   if(cell.notes.delete(number))renderCell(cell);
  }
 }
}
function toggleNote(number){
 if(selectedCell.value!==null){showMessage("Borra la respuesta antes de usar notas.");return}
 selectedCell.notes.has(number)?selectedCell.notes.delete(number):selectedCell.notes.add(number);renderCell(selectedCell);updateHighlights();
}
function deleteSelected(){
 if(gameFinished||!selectedCell){showMessage("Selecciona una casilla.");return}
 if(selectedCell.locked){showMessage("Esta casilla está bloqueada.");return}
 selectedCell.value=null;selectedCell.incorrect=false;selectedCell.notes.clear();renderCell(selectedCell);updateHighlights();
}
function useHint(){
 if(gameFinished)return;
 if(hintsUsed>=MAX_HINTS){showMessage("Ya utilizaste las 3 pistas.");return}
 const available=cells.filter(c=>!c.locked&&c.value===null);
 if(!available.length){showMessage("No hay casillas vacías.");return}
 const target=available[Math.floor(Math.random()*available.length)];
 target.value=solution[target.row][target.col];target.notes.clear();target.incorrect=false;target.locked=true;
 hintsUsed++;selectedCell=target;renderCell(target);updateCounters();updateNumberButtons();updateHighlights();showMessage("Pista revelada.");checkCompletion();
}
function renderCell(cell){
 const el=cell.element,notesEl=el.querySelector(".notes");el.classList.toggle("locked",cell.locked);el.classList.toggle("incorrect",cell.incorrect);
 for(let n=1;n<=9;n++){const note=notesEl.querySelector(`[data-note="${n}"]`);note.textContent=cell.value===null&&cell.notes.has(n)?n:"";}
 let valueEl=el.querySelector(".value");if(!valueEl){valueEl=document.createElement("span");valueEl.className="value";el.insertBefore(valueEl,notesEl)}
 valueEl.textContent=cell.value===null?"":cell.value;
}
function updateNotesButton(){notesBtn.classList.toggle("note-active",notesMode);notesBtn.textContent=notesMode?"NOTAS: ON":"NOTAS";for(const b of document.querySelectorAll(".number-btn"))b.classList.toggle("active-note-mode",notesMode)}
function toggleNotesMode(){if(gameFinished)return;notesMode=!notesMode;updateNotesButton();showMessage(notesMode?"Modo notas activado.":"Modo notas desactivado.")}
function updateCounters(){errorsEl.textContent=errors;hintsEl.textContent=`${hintsUsed}/${MAX_HINTS}`;timerEl.textContent=formatTime(elapsedSeconds);hintBtn.disabled=hintsUsed>=MAX_HINTS}
function updateNumberButtons(){
 for(let n=1;n<=9;n++){const b=numberPadEl.querySelector(`[data-number="${n}"]`);const count=cells.filter(c=>c.locked&&c.value===n).length;const exhausted=count>=9;b.classList.toggle("exhausted",exhausted);b.disabled=exhausted;b.title=exhausted?`Ya encontraste todos los ${n}`:`${count}/9 ${n}`}
}
function checkCompletion(){
 if(!cells.every(c=>c.locked&&c.value===solution[c.row][c.col]))return;
 gameFinished=true;clearInterval(timerInterval);finalMessage.textContent=puzzleInfo.final;finalTime.textContent=formatTime(elapsedSeconds);finalErrors.textContent=errors;finalHints.textContent=`${hintsUsed}/${MAX_HINTS}`;finishScreen.classList.remove("hidden");
}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function showMessage(t){messageEl.textContent=t}
notesBtn.addEventListener("click",toggleNotesMode);deleteBtn.addEventListener("click",deleteSelected);hintBtn.addEventListener("click",useHint);
restartBtn.addEventListener("click",startGame);
menuBtn.addEventListener("click",()=>{if(document.referrer)history.back();else window.location.href="../index.html"});
loadPuzzle();
