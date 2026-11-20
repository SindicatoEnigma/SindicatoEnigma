/*
========================================================
MOTOR DE TRIVIA — LÓGICA Y GUÍA DE MODIFICACIÓN
========================================================
CAMBIAR DE TRIVIA:
  const TRIVIA_PATH = "trivias/prueba_001";

EL:
  En el guion: EL=serio.svg
  Busca en: [TRIVIA]/EL/
  Posición/tamaño: trivia.css -> --el-left, --el-bottom, --el-width
  Cambiar expresión NO cambia la posición.

FONDO:
  En el guion: FONDO=fondo.webp
  Busca en: [TRIVIA]/fondos/
  Se aceptan imágenes y MP4/WebM. Los videos hacen loop.

PREGUNTA:
  TEXTO=...
  Posición: trivia.css -> --pregunta-top/left/width
  Alineación: .panel-pregunta { text-align:center; }

MARCO:
  IMAGEN=pista01.webp
  Se busca en [TRIVIA]/preguntas/
  IMAGEN_RESPUESTA=respuesta01.webp
  Se busca en [TRIVIA]/respuestas/
  Se adapta con object-fit: contain.
  Orientación/posición: trivia.css -> --marco-right/top/width/height/rotation

SONIDOS:
  SONIDO=click.wav
  SONIDO_RESPUESTA=revelar.wav
  Se buscan en [TRIVIA]/sonidos/

TIEMPOS:
  TIEMPO=10     -> segundos para responder
  ESPERA=3      -> segundos que dura la respuesta
  FINAL: ESPERA=10, OSCURECER=3, NEGRO=2

La introducción avanza por clic. Desde [INICIO_TRIVIA],
las preguntas avanzan automáticamente.
========================================================
*/
const TRIVIA_PATH="trivias/prueba_001";
const $=id=>document.getElementById(id);
const juego=$("juego"),fondo=$("fondo"),portada=$("portada"),escenaContenido=$("escenaContenido");
const tituloPortada=$("tituloPortada"),subtituloPortada=$("subtituloPortada");
const personajeEL=$("personajeEL"),imagenEL=$("imagenEL"),textoEL=$("textoEL"),contenidoEL=$("contenidoEL");
const preguntaPanel=$("preguntaPanel"),preguntaTexto=$("preguntaTexto");
const marcoImagen=$("marcoImagen"),marcoEtiqueta=$("marcoEtiqueta"),marcoNumero=$("marcoNumero"),imagenContenido=$("imagenContenido");
const contador=$("contador"),contadorNumero=$("contadorNumero"),barraTiempoRelleno=$("barraTiempoRelleno");
const respuestaPanel=$("respuestaPanel"),respuestaTexto=$("respuestaTexto"),capaOscura=$("capaOscura");
let guion=[],indice=0,modo="portada",timer=null,videoFondo=null,preguntas=[],preguntaActual=0;

function ruta(carpeta,archivo){return archivo?`${TRIVIA_PATH}/${carpeta}/${archivo}`:""}

async function cargarGuion(){
 try{const r=await fetch(`${TRIVIA_PATH}/guion.txt`);if(!r.ok)throw new Error(`HTTP ${r.status}`);
 guion=interpretarGuion(await r.text());prepararPortada();console.log("Guion:",guion)}
 catch(e){console.error(e);tituloPortada.textContent="ERROR";subtituloPortada.textContent="No se pudo cargar el guion.txt"}}

function interpretarGuion(texto){
 const lineas=texto.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("#"));
 const escenas=[];let actual=null;
 for(const linea of lineas){const b=linea.match(/^\[(.+)\]$/);
  if(b){actual={tipo:b[1].trim().toUpperCase(),datos:{}};escenas.push(actual);continue}
  if(!actual)continue;const i=linea.indexOf("=");
  if(i!==-1)actual.datos[linea.slice(0,i).trim().toUpperCase()]=linea.slice(i+1).trim()}
 return escenas}

function prepararPortada(){
 const p=guion.find(x=>x.tipo==="PORTADA");
 if(p){tituloPortada.textContent=p.datos.TITULO||"TRIVIA";subtituloPortada.textContent=p.datos.SUBTITULO||"Sindicato Enigma";cargarFondo(p.datos.FONDO)}
 modo="portada"}

function cargarFondo(nombre){
 if(!nombre)return;
 if(videoFondo){videoFondo.pause();videoFondo.remove();videoFondo=null}
 const ext=nombre.split(".").pop().toLowerCase();
 if(["mp4","webm","ogg"].includes(ext)){
  videoFondo=document.createElement("video");videoFondo.src=ruta("fondos",nombre);videoFondo.autoplay=true;videoFondo.loop=true;videoFondo.muted=true;videoFondo.playsInline=true;videoFondo.preload="auto";fondo.innerHTML="";fondo.appendChild(videoFondo)
 }else{fondo.innerHTML="";fondo.style.backgroundImage=`url("${ruta("fondos",nombre)}")`}}

async function entrarPantallaCompleta(){try{if(!document.fullscreenElement&&juego.requestFullscreen)await juego.requestFullscreen()}catch(e){console.warn("Fullscreen:",e)}}
async function salirPantallaCompleta(){try{if(document.fullscreenElement)await document.exitFullscreen()}catch(e){}}

juego.addEventListener("click",async()=>{
 if(modo==="portada"){await entrarPantallaCompleta();AudioTrivia.reproducir(ruta("sonidos","click.wav"));portada.classList.remove("visible");escenaContenido.classList.add("visible");modo="introduccion";indice=0;reproducirSiguienteIntroduccion();return}
 if(modo==="introduccion")reproducirSiguienteIntroduccion();
});

function reproducirSiguienteIntroduccion(){
 const e=guion[indice];
 if(!e){iniciarTrivia();return}
 if(e.tipo==="PORTADA"){indice++;return reproducirSiguienteIntroduccion()}
 if(e.tipo==="INICIO_TRIVIA"){indice++;return iniciarTrivia()}
 if(e.tipo!=="EL"){indice++;return reproducirSiguienteIntroduccion()}
 if(e.datos.FONDO)cargarFondo(e.datos.FONDO);
 mostrarEL(e.datos.EL||"normal.svg",true);
 e.datos.TEXTO?mostrarTextoEL(e.datos.TEXTO):ocultar(textoEL);
 if(e.datos.SONIDO)AudioTrivia.reproducir(ruta("sonidos",e.datos.SONIDO));
 indice++}

function mostrarEL(nombre,entrada=false){
 imagenEL.src=ruta("EL",nombre);personajeEL.classList.remove("saliendo");
 if(entrada){personajeEL.classList.remove("entrando");void personajeEL.offsetWidth;personajeEL.classList.add("entrando")}
 personajeEL.style.opacity="1"}
function ocultarEL(){personajeEL.classList.remove("entrando");personajeEL.classList.add("saliendo")}
function mostrarTextoEL(t){contenidoEL.textContent=t;mostrar(textoEL)}

function iniciarTrivia(){modo="trivia";ocultar(textoEL);ocultar(respuestaPanel);preguntas=guion.filter(x=>x.tipo==="PREGUNTA");mostrarPreguntaActual()}

function mostrarPreguntaActual(){
 if(preguntaActual>=preguntas.length)return ejecutarFinal();
 const p=preguntas[preguntaActual];
 if(p.datos.FONDO)cargarFondo(p.datos.FONDO);
 if(p.datos.EL)mostrarEL(p.datos.EL,false);
 preguntaTexto.textContent=p.datos.TEXTO||"";mostrar(preguntaPanel);
 if(p.datos.IMAGEN)mostrarImagenPregunta(p.datos.IMAGEN,p.datos.ETIQUETA||"PISTA",`PREGUNTA ${preguntaActual+1}`);else ocultar(marcoImagen);
 if(p.datos.SONIDO)AudioTrivia.reproducir(ruta("sonidos",p.datos.SONIDO));
 iniciarContador(Number(p.datos.TIEMPO||10),()=>revelarRespuesta(p))}

function mostrarImagenPregunta(nombre,etiqueta,numero){
 imagenContenido.src=ruta("preguntas",nombre);marcoEtiqueta.textContent=etiqueta;marcoNumero.textContent=numero;mostrar(marcoImagen)}

function iniciarContador(segundos,terminado){
 limpiarTimer();contadorNumero.textContent=segundos;barraTiempoRelleno.style.transition="none";barraTiempoRelleno.style.transform="scaleX(1)";mostrar(contador);
 requestAnimationFrame(()=>{barraTiempoRelleno.style.transition=`transform ${segundos}s linear`;barraTiempoRelleno.style.transform="scaleX(0)"});
 let restante=segundos;
 timer=setInterval(()=>{restante--;contadorNumero.textContent=Math.max(0,restante);
  if(restante<=0){limpiarTimer();ocultar(contador);terminado()}
  else AudioTrivia.reproducir(ruta("sonidos","tic.wav"))},1000)}

function revelarRespuesta(p){
 ocultar(preguntaPanel);respuestaTexto.textContent=p.datos.RESPUESTA||"";
 if(p.datos.RESPUESTA)mostrar(respuestaPanel);
 if(p.datos.IMAGEN_RESPUESTA){imagenContenido.src=ruta("respuestas",p.datos.IMAGEN_RESPUESTA);marcoEtiqueta.textContent=p.datos.ETIQUETA_RESPUESTA||"RESPUESTA";marcoNumero.textContent=`PREGUNTA ${preguntaActual+1}`;mostrar(marcoImagen)}
 else if(!p.datos.IMAGEN)ocultar(marcoImagen);
 AudioTrivia.reproducir(ruta("sonidos",p.datos.SONIDO_RESPUESTA||"revelar.wav"));
 setTimeout(()=>{ocultar(respuestaPanel);ocultar(marcoImagen);preguntaActual++;setTimeout(mostrarPreguntaActual,250)},Number(p.datos.ESPERA||3)*1000)}

function ejecutarFinal(){
 modo="final";ocultar(preguntaPanel);ocultar(respuestaPanel);ocultar(contador);ocultar(marcoImagen);
 const f=guion.find(x=>x.tipo==="FINAL");
 if(!f)return terminarVideo();
 if(f.datos.FONDO)cargarFondo(f.datos.FONDO);
 if(f.datos.EL)mostrarEL(f.datos.EL,true);
 if(f.datos.TEXTO)mostrarTextoEL(f.datos.TEXTO);
 if(f.datos.SONIDO)AudioTrivia.reproducir(ruta("sonidos",f.datos.SONIDO));
 setTimeout(()=>{const t=Number(f.datos.OSCURECER||3);capaOscura.style.transition=`background ${t}s linear`;capaOscura.style.background="#000";
  setTimeout(()=>setTimeout(terminarVideo,Number(f.datos.NEGRO||2)*1000),t*1000)},Number(f.datos.ESPERA||10)*1000)}

function terminarVideo(){ocultarEL();salirPantallaCompleta();modo="terminado"}
function mostrar(e){e.classList.remove("oculto")}
function ocultar(e){e.classList.add("oculto")}
function limpiarTimer(){if(timer){clearInterval(timer);timer=null}}
cargarGuion();