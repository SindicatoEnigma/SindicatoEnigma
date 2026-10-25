/* ============================================================
   SINDICATO ENIGMA — MOTOR DE CRUCIGRAMA v0.2

   REGLA DEL CRUCIGRAMA:

   La coordenada de PISTAS_H / PISTAS_V indica la posición
   de la casilla de pista.

   Horizontal:
       [PISTA] C A T

   Vertical:
       [PISTA]
          C
          O
          W

   La casilla de pista NO forma parte de la respuesta.
   ============================================================ */

"use strict";


/* ============================================================
   ESTADO DEL MOTOR
   ============================================================ */

const S = {
  datos: null,
  celdas: [],
  palabras: new Map(),
  actual: null,
  terminado: false
};


/* ============================================================
   REFERENCIAS HTML
   ============================================================ */

const $ = id => document.getElementById(id);

const tablero = $("tablero");
const cabecera = $("cabecera");
const pista = $("pista");

const respuesta = $("respuesta");
const casillas = $("casillas");
const input = $("input");

const mensaje = $("mensaje");

const finalBox = $("final");
const finalTexto = $("finalTexto");


/* ============================================================
   NORMALIZACIÓN
   ============================================================ */

function normalizar(t){

  return String(t)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toUpperCase()
    .replace(/[^A-ZÑ]/g,"");

}


/* ============================================================
   CARGAR CRUCIGRAMA
   ============================================================ */

async function iniciar(){

  try{

    const r = await fetch("datos/crucigrama_001.txt");

    if(!r.ok){
      throw Error("No se pudo cargar el TXT.");
    }

    S.datos = leerTXT(await r.text());

    crearPalabras();
    crearTablero();

  }catch(e){

    console.error("[Crucigrama]", e);

    if(pista){
      pista.textContent =
        "Error al cargar el crucigrama. Revisa el TXT y la consola.";
    }

  }

}


/* ============================================================
   LEER TXT
   ============================================================ */

function leerTXT(texto){

  const d = {
    filas: 0,
    columnas: 0,
    tablero: [],
    H: [],
    V: [],
    respuestas: [],
    final: {}
  };

  let sec = "";

  for(const raw of texto.split(/\r?\n/)){

    const l = raw.trim();

    if(!l) continue;

    /*
     * Los # del tablero NO son comentarios.
     * Fuera de TABLERO sí podemos ignorar líneas
     * que comiencen con #.
     */

    if(sec !== "TABLERO" && l.startsWith("#")){
      continue;
    }

    /*
     * Cambio de sección
     */

    if(l.startsWith("[") && l.endsWith("]")){

      sec = l.slice(1,-1).toUpperCase();

      continue;
    }


    /* ---------------- TABLERO ---------------- */

    if(sec === "TABLERO"){

      if(l.startsWith("FILAS=")){

        d.filas = +l.slice(6);

      }else if(l.startsWith("COLUMNAS=")){

        d.columnas = +l.slice(9);

      }else{

        d.tablero.push(l);

      }

    }


    /* ---------------- PISTAS H ---------------- */

    else if(sec === "PISTAS_H"){

      d.H.push(pistaDato(l));

    }


    /* ---------------- PISTAS V ---------------- */

    else if(sec === "PISTAS_V"){

      d.V.push(pistaDato(l));

    }


    /* ---------------- RESPUESTAS ---------------- */

    else if(sec === "RESPUESTAS"){

      const p = l.split("|");

      d.respuestas.push({

        dir: p[0].toUpperCase(),

        num: +p[1],

        respuesta: normalizar(
          p.slice(2).join("|")
        )

      });

    }


    /* ---------------- FINAL ---------------- */

    else if(sec === "FINAL"){

      const p = l.indexOf("=");

      if(p > 0){

        d.final[
          l.slice(0,p).toLowerCase()
        ] = l.slice(p+1);

      }

    }

  }

  return d;

}


/* ============================================================
   DATOS DE UNA PISTA

   El TXT utiliza coordenadas 1-based.

   Aquí las convertimos a 0-based.

   IMPORTANTE:
   fila / col representan LA PISTA,
   no la primera letra.
   ============================================================ */

function pistaDato(l){

  const p = l.split("|");

  return {

    num: +p[0],

    fila: +p[1] - 1,

    col: +p[2] - 1,

    texto: p.slice(3).join("|")

  };

}


/* ============================================================
   CREAR PALABRAS
   ============================================================ */

function crearPalabras(){

  const hacer = (p, dir) => {

    const id = `${dir}${p.num}`;

    const r = S.datos.respuestas.find(
      x => x.dir === dir && x.num === p.num
    );

    if(!r){

      console.warn(
        "[Crucigrama] Falta respuesta:",
        id
      );

      return;

    }


    /*
     * La posición p.fila / p.col es la PISTA.
     *
     * Por eso:
     *
     * H → primera letra = una columna a la derecha
     *
     * V → primera letra = una fila abajo
     */

    const inicioFila =
      p.fila + (dir === "V" ? 1 : 0);

    const inicioCol =
      p.col + (dir === "H" ? 1 : 0);


    const w = {

      id,

      dir,

      num: p.num,

      /* posición de la PISTA */
      fila: p.fila,
      col: p.col,

      /* posición de la primera letra */
      inicioFila,
      inicioCol,

      texto: p.texto,

      respuesta: r.respuesta,

      celdas: [],

      completada: false

    };


    /*
     * Construimos únicamente las casillas
     * que contienen letras.
     */

    for(let i = 0; i < w.respuesta.length; i++){

      const fila =
        inicioFila +
        (dir === "V" ? i : 0);

      const col =
        inicioCol +
        (dir === "H" ? i : 0);

      w.celdas.push({

        fila,
        col,

        i

      });

    }


    /*
     * Comprobación de seguridad:
     * la palabra no debe salir del tablero.
     */

    for(const pCelda of w.celdas){

      if(
        pCelda.fila < 0 ||
        pCelda.fila >= S.datos.filas ||
        pCelda.col < 0 ||
        pCelda.col >= S.datos.columnas
      ){

        console.warn(
          "[Crucigrama] Palabra fuera del tablero:",
          id
        );

      }

    }


    S.palabras.set(id,w);

  };


  S.datos.H.forEach(
    p => hacer(p,"H")
  );

  S.datos.V.forEach(
    p => hacer(p,"V")
  );

}


/* ============================================================
   CREAR TABLERO
   ============================================================ */

function crearTablero(){

  const d = S.datos;

  tablero.innerHTML = "";

  tablero.style.gridTemplateColumns =
    `repeat(${d.columnas},1fr)`;


  /*
   * Crear matriz de celdas
   */

  S.celdas = Array.from(
    {length:d.filas},
    (_,f) =>

      Array.from(
        {length:d.columnas},
        (_,c) => ({

          fila: f,

          col: c,

          tipo:
            d.tablero[f]?.[c] || "#",

          letra: "",

          estado: "vacia",

          palabras: [],

          pistas: [],

          el: null

        })

      )

  );


  /*
   * Registrar las palabras que utilizan
   * cada casilla.
   */

  for(const w of S.palabras.values()){

    for(const p of w.celdas){

      const c =
        S.celdas[p.fila]?.[p.col];

      if(!c){

        console.warn(
          "[Crucigrama] Casilla fuera del tablero:",
          w.id
        );

        continue;

      }

      c.palabras.push(w.id);

    }

  }


  /*
   * Registrar las pistas.
   *
   * IMPORTANTE:
   * aquí usamos w.fila / w.col,
   * que son las coordenadas de la PISTA.
   */

  for(const w of S.palabras.values()){

    const c =
      S.celdas[w.fila]?.[w.col];

    if(!c){

      console.warn(
        "[Crucigrama] Pista fuera del tablero:",
        w.id
      );

      continue;

    }

    c.pistas.push(w.id);

  }


  /* ==========================================================
     DIBUJAR CELDAS
     ========================================================== */

  for(let f = 0; f < d.filas; f++){

    for(let c = 0; c < d.columnas; c++){

      const cel = S.celdas[f][c];

      const b =
        document.createElement("button");

      b.type = "button";

      b.className = "celda";


      /*
       * PRIMERO comprobamos si es PISTA.
       *
       * Una pista tiene prioridad sobre #.
       */

      if(cel.pistas.length){

        b.classList.add("pista");

        const numero =
          document.createElement("span");

        numero.className = "numero";

        /*
         * Solo mostramos el número.
         * La dirección aparece en el panel.
         */

        /*numero.textContent =
          cel.pistas[0]
            ? S.palabras.get(
                cel.pistas[0]
              ).num
            : "";*/
         const palabraPista = cel.pistas[0]
  ? S.palabras.get(cel.pistas[0])
  : null;

numero.textContent = palabraPista
  ? `${palabraPista.num}${palabraPista.dir}`
  : "";

        b.append(numero);

        b.onclick = () => pulsar(cel);

      }


      /*
       * CASILLA NEGRA
       */

      else if(cel.tipo === "#"){

        b.classList.add("negra");

        b.disabled = true;

      }


      /*
       * CASILLA DE RESPUESTA
       */

      else{

        const letra =
          document.createElement("span");

        letra.className = "letra";

        b.append(letra);

        b.onclick = () => pulsar(cel);

      }


      cel.el = b;

      tablero.append(b);

    }

  }

}


/* ============================================================
   PULSAR CASILLA
   ============================================================ */

function pulsar(cel){

  /*
   * Si es una pista, seleccionamos la palabra.
   */

  if(cel.pistas.length){

    const id =
      cel.pistas.find(
        x => !S.palabras.get(x).completada
      );

    if(id){

      seleccionar(id);

    }

    return;

  }


  /*
   * Si es una casilla de respuesta,
   * podemos introducir una letra.
   */

  if(cel.estado !== "bloqueada"){

    pedirLetra(cel);

  }

}


/* ============================================================
   SELECCIONAR PALABRA
   ============================================================ */

function seleccionar(id){

  const w =
    S.palabras.get(id);

  if(!w || w.completada) return;

  S.actual = w;


  /*
   * Quitar selección anterior.
   */

  document
    .querySelectorAll(".celda")
    .forEach(
      x => x.classList.remove("seleccionada")
    );


  /*
   * Seleccionar solamente las letras.
   * La casilla de pista NO se selecciona.
   */

  w.celdas.forEach(p => {

    S.celdas[p.fila][p.col]
      .el
      .classList
      .add("seleccionada");

  });


  /*
   * Panel de pista
   */

  cabecera.textContent =
    `${w.num}${w.dir}`;

  pista.textContent =
    w.texto;


  respuesta.classList.remove("hidden");


  casillas.innerHTML = "";


  /*
   * Mostrar casillas de respuesta
   */

  w.celdas.forEach(p => {

    const c =
      S.celdas[p.fila][p.col];

    const v =
      document.createElement("div");

    v.className =
      "respuesta-celda";

    v.textContent =
      c.letra || "";

    if(c.letra){

      v.classList.add("descubierta");

    }

    casillas.append(v);

  });


  input.value = "";

  mensaje.textContent = "";

  mensaje.className =
    "mensaje";

}


/* ============================================================
   INTRODUCIR LETRA
   ============================================================ */

function pedirLetra(c){

  const entrada =
    prompt("Escribe una sola letra:");

  if(entrada === null) return;


  const x =
    normalizar(entrada);


  if(x.length !== 1){

    alert(
      "Solo puedes introducir una letra."
    );

    return;

  }


  /*
   * Una casilla puede pertenecer
   * a una palabra horizontal y otra vertical.
   *
   * La letra es correcta si coincide
   * con alguna de ellas.
   */

  let ok = false;


  for(const id of c.palabras){

    const w =
      S.palabras.get(id);

    const p =
      w.celdas.find(
        q =>
          q.fila === c.fila &&
          q.col === c.col
      );

    if(
      p &&
      w.respuesta[p.i] === x
    ){

      ok = true;

      break;

    }

  }


  c.letra = x;

  c.estado =
    ok
      ? "bloqueada"
      : "incorrecta";


  pintar(
    c,
    ok
      ? "correcta"
      : "incorrecta"
  );


  /*
   * Comprobar las palabras que utilizan
   * esta casilla.
   */

  revisar(c.palabras);

  actualizarPista();

}


/* ============================================================
   PINTAR LETRA
   ============================================================ */

function pintar(c,clase=""){

  const letra =
    c.el.querySelector(".letra");

  /*
   * Las pistas no tienen elemento .letra.
   */

  if(letra){

    letra.textContent =
      c.letra;

  }


  c.el.classList.remove(
    "correcta",
    "incorrecta"
  );


  if(clase){

    c.el.classList.add(clase);

  }

}


/* ============================================================
   REVISAR PALABRAS
   ============================================================ */

function revisar(ids){

  for(const id of ids){

    const w =
      S.palabras.get(id);

    if(!w || w.completada) continue;


    const completa =
      w.celdas.every(p => {

        const c =
          S.celdas[p.fila][p.col];

        return (
          c.estado === "bloqueada" &&
          c.letra === w.respuesta[p.i]
        );

      });


    if(completa){

      completarPalabra(w);

    }

  }


  comprobarFinal();

}


/* ============================================================
   COMPLETAR PALABRA
   ============================================================ */

function completarPalabra(w){

  w.completada = true;


  /*
   * Todas las letras pasan a negro
   * y quedan bloqueadas.
   */

  w.celdas.forEach(p => {

    const c =
      S.celdas[p.fila][p.col];

    c.estado = "bloqueada";

    c.el.classList.remove(
      "correcta",
      "incorrecta",
      "seleccionada"
    );

    c.el.classList.add(
      "completada"
    );

  });


  /*
   * La casilla de pista cambia
   * de número blanco a número negro.
   */

  const pistaCelda =
    S.celdas[w.fila][w.col];

  if(pistaCelda && pistaCelda.el){

    pistaCelda.el.classList.add(
      "pista-completada"
    );

  }


  /*
   * Si esta era la palabra seleccionada,
   * actualizar panel.
   */

  actualizarPista();

}


/* ============================================================
   ACTUALIZAR CASILLAS DE RESPUESTA
   ============================================================ */

/*function actualizarPista(){

  if(
    !S.actual ||
    S.actual.completada
  ){

    return;

  }


  casillas.innerHTML = "";


  S.actual.celdas.forEach(p => {

    const c =
      S.celdas[p.fila][p.col];

    const v =
      document.createElement("div");

    v.className =
      "respuesta-celda";

    v.textContent =
      c.letra || "";

    if(c.letra){

      v.classList.add(
        "descubierta"
      );

    }

    casillas.append(v);

  });

}*/

function actualizarPista(){

  if(
    !S.actual ||
    S.actual.completada
  ){
    return;
  }

  casillas.innerHTML = "";

  S.actual.celdas.forEach(p => {

    const c =
      S.celdas[p.fila][p.col];

    const v =
      document.createElement("div");

    v.className =
      "respuesta-celda";


    /*
     * Solo mostramos la letra si:
     *
     * 1. La casilla tiene una letra.
     * 2. Esa letra coincide con la respuesta
     *    correcta de la palabra seleccionada.
     *
     * Una letra incorrecta permanece en el tablero,
     * pero NO aparece aquí.
     */

    if(
      c.letra &&
      c.letra === S.actual.respuesta[p.i]
    ){

      v.textContent = c.letra;

      v.classList.add(
        "descubierta"
      );

    }else{

      v.textContent = "";

    }


    casillas.append(v);

  });

}



/* ============================================================
   CONFIRMAR PALABRA COMPLETA
   ============================================================ */

$("confirmar").onclick =
  confirmar;


input.onkeydown = e => {

  if(e.key === "Enter"){

    confirmar();

  }

};


function confirmar(){

  const w =
    S.actual;


  if(!w || w.completada) return;


  const x =
    normalizar(input.value);


  if(
    x.length !==
    w.respuesta.length
  ){

    error(
      "La respuesta debe tener " +
      w.respuesta.length +
      " letras."
    );

    return;

  }


  /*
   * La respuesta completa debe coincidir.
   */

  if(x !== w.respuesta){

    error(
      "Respuesta incorrecta."
    );

    return;

  }


  /*
   * Escribir todas las letras.
   */

  w.celdas.forEach(p => {

    const c =
      S.celdas[p.fila][p.col];

    c.letra =
      w.respuesta[p.i];

    c.estado =
      "bloqueada";

    pintar(c);

  });


  /*
   * IMPORTANTE:
   * usamos la misma función que cuando
   * se completa letra por letra.
   */

  completarPalabra(w);


  mensaje.textContent =
    "Palabra correcta.";

  mensaje.className =
    "mensaje ok";


  /*
   * Buscar palabras cruzadas.
   */

  const palabrasCruzadas =
    new Set();


  w.celdas.forEach(p => {

    const c =
      S.celdas[p.fila][p.col];

    c.palabras.forEach(id => {

      palabrasCruzadas.add(id);

    });

  });


  revisar(
    [...palabrasCruzadas]
  );

}


/* ============================================================
   ERROR
   ============================================================ */

function error(t){

  mensaje.textContent =
    t;

  mensaje.className =
    "mensaje error";

}


/* ============================================================
   COMPROBAR FINAL
   ============================================================ */

function comprobarFinal(){

  if(
    S.terminado ||
    ![...S.palabras.values()]
      .every(w => w.completada)
  ){

    return;

  }


  S.terminado = true;


  respuesta.classList.add(
    "hidden"
  );

  finalBox.classList.remove(
    "hidden"
  );


  finalTexto.textContent =
    S.datos.final.mensaje ||
    "Crucigrama completado.";


  const resultado = {

    completado: true,

    codigo:
      S.datos.final.codigo || ""

  };


  console.log(
    "[Crucigrama] Resultado:",
    resultado
  );


  window.dispatchEvent(
    new CustomEvent(
      "crucigrama-completado",
      {
        detail: resultado
      }
    )
  );

}


/* ============================================================
   CONTINUAR
   ============================================================ */

$("continuar").onclick = () => {

  alert(
    "En la integración con el motor narrativo, " +
    "CONTINUAR devolverá el resultado al motor."
  );

};


/* ============================================================
   INICIAR
   ============================================================ */

iniciar();
