/* ============================================================
   SINDICATO ENIGMA — MOTOR DE CRUCIGRAMA v0.1
   El crucigrama vive en un TXT. Este archivo solo contiene reglas.
   ============================================================ */
"use strict";

const S={datos:null,celdas:[],palabras:new Map(),actual:null,terminado:false};
const $=id=>document.getElementById(id);
const tablero=$("tablero"), cabecera=$("cabecera"), pista=$("pista");
const respuesta=$("respuesta"), casillas=$("casillas"), input=$("input");
const mensaje=$("mensaje"), finalBox=$("final"), finalTexto=$("finalTexto");

function normalizar(t){return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-ZÑ]/g,"")}

async function iniciar(){
  try{
    const r=await fetch("minijuegos/crucigrama/crucigrama_prueba.txt");
    if(!r.ok) throw Error("No se pudo cargar el TXT.");
    S.datos=leerTXT(await r.text());
    crearPalabras(); crearTablero();
  }catch(e){console.error("[Crucigrama]",e); pista.textContent="Error al cargar el crucigrama. Revisa el TXT y la consola."}
}

/* Lee las secciones del archivo y las convierte en datos JavaScript. */
function leerTXT(texto){
  const d={filas:0,columnas:0,tablero:[],H:[],V:[],respuestas:[],final:{}};
  let sec="";
  for(const raw of texto.split(/\r?\n/)){
    const l=raw.trim(); if(!l||l.startsWith("#")) continue;
    if(l.startsWith("[")&&l.endsWith("]")){sec=l.slice(1,-1).toUpperCase();continue}
    if(sec==="TABLERO"){
      if(l.startsWith("FILAS=")) d.filas=+l.slice(6);
      else if(l.startsWith("COLUMNAS=")) d.columnas=+l.slice(9);
      else d.tablero.push(l);
    }else if(sec==="PISTAS_H") d.H.push(pistaDato(l));
    else if(sec==="PISTAS_V") d.V.push(pistaDato(l));
    else if(sec==="RESPUESTAS"){const p=l.split("|");d.respuestas.push({dir:p[0].toUpperCase(),num:+p[1],respuesta:normalizar(p.slice(2).join("|"))})}
    else if(sec==="FINAL"){const p=l.indexOf("=");if(p>0)d.final[l.slice(0,p).toLowerCase()]=l.slice(p+1)}
  }
  return d;
}
function pistaDato(l){const p=l.split("|");return{num:+p[0],fila:+p[1],col:+p[2],texto:p.slice(3).join("|")}}

function crearPalabras(){
  const hacer=(p,dir)=>{
    const id=`${dir}${p.num}`, r=S.datos.respuestas.find(x=>x.dir===dir&&x.num===p.num);
    if(!r){console.warn("Falta respuesta",id);return}
    const w={id,dir,num:p.num,fila:p.fila,col:p.col,texto:p.texto,respuesta:r.respuesta,celdas:[],completada:false};
    for(let i=0;i<w.respuesta.length;i++)w.celdas.push({fila:p.fila+(dir==="V"?i:0),col:p.col+(dir==="H"?i:0),i});
    S.palabras.set(id,w);
  };
  S.datos.H.forEach(p=>hacer(p,"H")); S.datos.V.forEach(p=>hacer(p,"V"));
}

function crearTablero(){
  const d=S.datos; tablero.innerHTML=""; tablero.style.gridTemplateColumns=`repeat(${d.columnas},1fr)`;
  S.celdas=Array.from({length:d.filas},(_,f)=>Array.from({length:d.columnas},(_,c)=>({fila:f,col:c,tipo:d.tablero[f]?.[c]||"#",letra:"",estado:"vacia",palabras:[],pistas:[],el:null})));
  for(const w of S.palabras.values())for(const p of w.celdas){
    const c=S.celdas[p.fila]?.[p.col]; if(!c){console.warn("Palabra fuera del tablero",w.id);continue}
    c.palabras.push(w.id);
  }
  for(const w of S.palabras.values())S.celdas[w.fila]?.[w.col]?.pistas.push(w.id);

  for(let f=0;f<d.filas;f++)for(let c=0;c<d.columnas;c++){
    const cel=S.celdas[f][c], b=document.createElement("button"); b.type="button";b.className="celda";
    if(cel.tipo==="#"){b.classList.add("negra");b.disabled=true}
    else{
      if(cel.pistas.length){b.classList.add("pista");const n=document.createElement("span");n.className="numero";n.textContent=cel.pistas[0];b.append(n)}
      const l=document.createElement("span");l.className="letra";b.append(l);b.onclick=()=>pulsar(cel)
    }
    cel.el=b;tablero.append(b);
  }
}

function pulsar(c){
  /* Una casilla numerada selecciona su pista. Una casilla normal solo abre letra. */
  const id=c.pistas.find(x=>!S.palabras.get(x).completada);
  if(id){seleccionar(id);return}
  if(c.estado!=="bloqueada") pedirLetra(c);
}

function seleccionar(id){
  const w=S.palabras.get(id); if(!w||w.completada)return;S.actual=w;
  document.querySelectorAll(".celda").forEach(x=>x.classList.remove("seleccionada"));
  w.celdas.forEach(p=>S.celdas[p.fila][p.col].el.classList.add("seleccionada"));
  cabecera.textContent=`${w.num}${w.dir}`;pista.textContent=w.texto;
  respuesta.classList.remove("hidden");casillas.innerHTML="";
  w.celdas.forEach(p=>{const c=S.celdas[p.fila][p.col],v=document.createElement("div");v.className="respuesta-celda";v.textContent=c.letra||"";if(c.letra)v.classList.add("descubierta");casillas.append(v)});
  input.value="";mensaje.textContent="";mensaje.className="mensaje";
}

function pedirLetra(c){
  const entrada=prompt("Escribe una sola letra:");
  if(entrada===null)return;
  const x=normalizar(entrada);
  if(x.length!==1){alert("Solo puedes introducir una letra.");return}
  /* Si una casilla cruza dos palabras, la letra es correcta si coincide
     con la respuesta de cualquiera de esas palabras. */
  let ok=false;
  for(const id of c.palabras){
    const w=S.palabras.get(id),p=w.celdas.find(q=>q.fila===c.fila&&q.col===c.col);
    if(p&&w.respuesta[p.i]===x){ok=true;break}
  }
  c.letra=x;c.estado=ok?"bloqueada":"incorrecta";pintar(c,ok?"correcta":"incorrecta");
  revisar(c.palabras);actualizarPista();
}

function pintar(c,clase=""){
  c.el.querySelector(".letra").textContent=c.letra;
  c.el.classList.remove("correcta","incorrecta","completada");if(clase)c.el.classList.add(clase);
}

function revisar(ids){
  for(const id of ids){
    const w=S.palabras.get(id);if(!w||w.completada)continue;
    const completa=w.celdas.every(p=>{const c=S.celdas[p.fila][p.col];return c.estado==="bloqueada"&&c.letra===w.respuesta[p.i]});
    if(completa){
      w.completada=true;
      w.celdas.forEach(p=>{const c=S.celdas[p.fila][p.col];c.estado="bloqueada";c.el.classList.remove("correcta","incorrecta");c.el.classList.add("completada")});
      const ini=S.celdas[w.fila][w.col];ini.el.classList.add("completada");const n=ini.el.querySelector(".numero");if(n)n.style.color="#050505";
    }
  }
  comprobarFinal();
}

function actualizarPista(){
  if(S.actual&&!S.actual.completada){
    casillas.innerHTML="";
    S.actual.celdas.forEach(p=>{const c=S.celdas[p.fila][p.col],v=document.createElement("div");v.className="respuesta-celda";v.textContent=c.letra||"";if(c.letra)v.classList.add("descubierta");casillas.append(v)})
  }
}

/* La palabra completa se valida de una vez. Si falla, NO cambia el tablero. */
$("confirmar").onclick=confirmar;
input.onkeydown=e=>{if(e.key==="Enter")confirmar()};
function confirmar(){
  const w=S.actual;if(!w||w.completada)return;
  const x=normalizar(input.value);
  if(x.length!==w.respuesta.length){error("La respuesta debe tener "+w.respuesta.length+" letras.");return}
  if(x!==w.respuesta){error("Respuesta incorrecta.");return}
  w.celdas.forEach(p=>{const c=S.celdas[p.fila][p.col];c.letra=w.respuesta[p.i];c.estado="bloqueada";pintar(c);c.el.classList.add("completada")});
  w.completada=true;S.celdas[w.fila][w.col].el.classList.add("completada");
  const n=S.celdas[w.fila][w.col].el.querySelector(".numero");if(n)n.style.color="#050505";
  mensaje.textContent="Palabra correcta.";mensaje.className="mensaje ok";comprobarFinal();
}
function error(t){mensaje.textContent=t;mensaje.className="mensaje error"}

function comprobarFinal(){
  if(S.terminado||![...S.palabras.values()].every(w=>w.completada))return;
  S.terminado=true;respuesta.classList.add("hidden");finalBox.classList.remove("hidden");
  finalTexto.textContent=S.datos.final.mensaje||"Crucigrama completado.";
  const resultado={completado:true,codigo:S.datos.final.codigo||""};
  console.log("[Crucigrama] Resultado:",resultado);
  window.dispatchEvent(new CustomEvent("crucigrama-completado",{detail:resultado}));
}
$("continuar").onclick=()=>alert("En la integración con el motor narrativo, CONTINUAR devolverá el resultado al motor.");

iniciar();
