// ============================================
// SINDICATO ENIGMA
// DESCIFRADOR MONOALFABÉTICO
// ============================================

// Elementos principales
const textoEntrada = document.getElementById("textoEntrada");
const contador = document.getElementById("contador");
const btnAnalizar = document.getElementById("btnAnalizar");
const btnLimpiar = document.getElementById("btnLimpiar");

const resumen = document.getElementById("resumen");
const tablaFrecuencias = document.getElementById("tablaFrecuencias");
const tablaSustituciones = document.getElementById("tablaSustituciones");

const textoResultado = document.getElementById("textoResultado");
const btnCopiarResultado = document.getElementById("btnCopiarResultado");

const btnConfirmar = document.getElementById("btnConfirmar");
const mensajeEstado = document.getElementById("mensajeEstado");
const resultadoConfirmado = document.getElementById("resultadoConfirmado");
const tablaConfirmada = document.getElementById("tablaConfirmada");
const textoConfirmado = document.getElementById("textoConfirmado");

const btnCopiarConfirmado = document.getElementById("btnCopiarConfirmado");
const btnEditar = document.getElementById("btnEditar");


// ============================================
// ESTADO DEL PROGRAMA
// ============================================

let textoOriginal = "";
let caracteresEncontrados = [];
let frecuencias = new Map();
let sustituciones = new Map();

let analisisRealizado = false;


// ============================================
// DIVIDIR TEXTO EN CARACTERES VISIBLES
// ============================================

function separarCaracteres(texto) {

  // Intl.Segmenter permite reconocer caracteres completos,
  // incluidos emojis y letras con marcas combinadas.

  if (typeof Intl.Segmenter === "function") {

    const segmentador = new Intl.Segmenter(undefined, {
      granularity: "grapheme"
    });

    return Array.from(
      segmentador.segment(texto),
      elemento => elemento.segment
    );
  }

  // Alternativa para navegadores sin Intl.Segmenter.
  return Array.from(texto);
}


// ============================================
// REPRESENTACIÓN VISUAL DE CARACTERES
// ============================================

function mostrarCaracter(caracter) {

  if (caracter === " ") return "␠";
  if (caracter === "\n") return "↵";
  if (caracter === "\t") return "⇥";
  if (caracter === "\r") return "CR";

  return caracter;
}


// ============================================
// CONVERTIR LOS SÍMBOLOS DE LA INTERFAZ
// EN CARACTERES REALES
// ============================================

function interpretarDestino(valor) {

  if (valor === "␠") return " ";
  if (valor === "↵") return "\n";
  if (valor === "⇥") return "\t";

  return valor;
}


// ============================================
// CONTADOR DEL TEXTO
// ============================================

function actualizarContador() {

  const cantidad = separarCaracteres(textoEntrada.value).length;

  contador.textContent = cantidad + " caracteres";
}

textoEntrada.addEventListener("input", actualizarContador);


// ============================================
// ANÁLISIS DE FRECUENCIAS
// ============================================

function analizarTexto() {

  textoOriginal = textoEntrada.value;

  if (textoOriginal.length === 0) {

    alert("Primero introduce un texto para analizar.");

    return;
  }

  caracteresEncontrados = [];
  frecuencias = new Map();
  sustituciones = new Map();

  const caracteres = separarCaracteres(textoOriginal);

  const encontrados = new Set();

  for (const caracter of caracteres) {

    // Cada carácter exacto se registra una sola vez.
    if (!encontrados.has(caracter)) {

      encontrados.add(caracter);
      caracteresEncontrados.push(caracter);
    }

    // Para las frecuencias, agrupamos mayúsculas y minúsculas.
    const claveFrecuencia = caracter.toLowerCase();

    frecuencias.set(
      claveFrecuencia,
      (frecuencias.get(claveFrecuencia) || 0) + 1
    );
  }

  // Ordenar los caracteres de mayor a menor frecuencia.
  caracteresEncontrados.sort((a, b) => {

    const frecuenciaA = frecuencias.get(a.toLowerCase());
    const frecuenciaB = frecuencias.get(b.toLowerCase());

    if (frecuenciaB !== frecuenciaA) {
      return frecuenciaB - frecuenciaA;
    }

    return a.localeCompare(b);
  });

  analisisRealizado = true;

  mostrarFrecuencias();
  mostrarTablaSustituciones();
  actualizarResultado();

  resultadoConfirmado.classList.add("oculto");

  mensajeEstado.textContent =
    "Análisis realizado. Puedes comenzar a probar sustituciones.";

  mensajeEstado.className = "mensaje-estado";
}


// ============================================
// MOSTRAR TABLA DE FRECUENCIAS
// ============================================

function mostrarFrecuencias() {

  tablaFrecuencias.innerHTML = "";

  const total = separarCaracteres(textoOriginal).length;

  resumen.textContent =
    "Caracteres totales: " + total +
    " | Caracteres diferentes: " + caracteresEncontrados.length;

  for (const caracter of caracteresEncontrados) {

    const frecuencia = frecuencias.get(caracter.toLowerCase());

    const porcentaje = total > 0
      ? ((frecuencia / total) * 100).toFixed(2)
      : "0.00";

    const fila = document.createElement("tr");

    const celdaCaracter = document.createElement("td");
    const celdaFrecuencia = document.createElement("td");
    const celdaPorcentaje = document.createElement("td");

    celdaCaracter.textContent = mostrarCaracter(caracter);
    celdaFrecuencia.textContent = frecuencia;
    celdaPorcentaje.textContent = porcentaje + "%";

    fila.appendChild(celdaCaracter);
    fila.appendChild(celdaFrecuencia);
    fila.appendChild(celdaPorcentaje);

    tablaFrecuencias.appendChild(fila);
  }
}


// ============================================
// CREAR TABLA DE SUSTITUCIONES
// ============================================

function mostrarTablaSustituciones() {

  tablaSustituciones.innerHTML = "";

  for (const caracter of caracteresEncontrados) {

    const fila = document.createElement("div");

    fila.className = "fila-sustitucion";

    const origen = document.createElement("div");

    origen.className = "caracter-origen";

    const visual = document.createElement("div");

    visual.className = "caracter-visual";
    visual.textContent = mostrarCaracter(caracter);

    const informacion = document.createElement("div");

    informacion.className = "frecuencia-mini";

    informacion.textContent =
      frecuencias.get(caracter.toLowerCase()) + " apariciones";

    origen.appendChild(visual);
    origen.appendChild(informacion);

    const campo = document.createElement("input");

    campo.type = "text";
    campo.className = "campo-sustitucion";
    campo.placeholder = "Sustitución";
    campo.autocomplete = "off";
    campo.spellcheck = false;

    campo.setAttribute("aria-label",
      "Sustitución para " + mostrarCaracter(caracter)
    );

    campo.dataset.caracter = caracter;

    // Actualizar la sustitución al escribir.
    campo.addEventListener("input", function () {

      const valor = this.value;

      if (valor === "") {

        sustituciones.delete(caracter);

      } else {

        sustituciones.set(
          caracter,
          interpretarDestino(valor)
        );
      }

      // Una edición invalida la confirmación anterior.
      resultadoConfirmado.classList.add("oculto");

      actualizarResultado();
      actualizarEstadoProvisional();
    });

    fila.appendChild(origen);
    fila.appendChild(campo);

    tablaSustituciones.appendChild(fila);
  }
}


// ============================================
// CONSTRUIR EL TEXTO TRANSFORMADO
// ============================================

function transformarTexto(texto, mapa) {

  const caracteres = separarCaracteres(texto);

  return caracteres.map(caracter => {

    if (mapa.has(caracter)) {
      return mapa.get(caracter);
    }

    return caracter;

  }).join("");
}


// ============================================
// ACTUALIZAR VISTA PREVIA
// ============================================

function actualizarResultado() {

  if (!analisisRealizado) return;

  const resultado = transformarTexto(
    textoOriginal,
    sustituciones
  );

  textoResultado.value = resultado;
}


// ============================================
// MENSAJE DE ESTADO PROVISIONAL
// ============================================

function actualizarEstadoProvisional() {

  if (!analisisRealizado) return;

  const cantidad = sustituciones.size;

  mensajeEstado.className = "mensaje-estado";

  mensajeEstado.textContent =
    "Sustituciones actuales: " + cantidad +
    ". El resultado todavía es provisional.";
}


// ============================================
// VALIDAR SUSTITUCIONES
// ============================================

function validarSustituciones() {

  const destinos = new Map();

  // Revisamos todas las correspondencias efectivas.
  // Si un carácter no tiene sustitución, se conserva
  // como su propio destino.

  for (const origen of caracteresEncontrados) {

    const destino = sustituciones.has(origen)
      ? sustituciones.get(origen)
      : origen;

    const caracteresDestino = separarCaracteres(destino);

    if (caracteresDestino.length !== 1) {

      return {
        valido: false,
        mensaje:
          "Cada sustitución debe contener exactamente un carácter. " +
          "Revisa la correspondencia de " + mostrarCaracter(origen) + "."
      };
    }

    if (destinos.has(destino)) {

      const otroOrigen = destinos.get(destino);

      return {
        valido: false,
        mensaje:
          "Hay una correspondencia duplicada: " +
          mostrarCaracter(otroOrigen) + " y " +
          mostrarCaracter(origen) + " terminan en " +
          mostrarCaracter(destino) + "."
      };
    }

    destinos.set(destino, origen);
  }

  return {
    valido: true,
    mensaje: "Las correspondencias son válidas."
  };
}


// ============================================
// CONFIRMAR SOLUCIÓN
// ============================================

function confirmarSolucion() {

  if (!analisisRealizado) {

    mensajeEstado.textContent =
      "Primero debes analizar un texto.";

    mensajeEstado.className = "mensaje-estado error";

    return;
  }

  const validacion = validarSustituciones();

  if (!validacion.valido) {

    mensajeEstado.textContent = validacion.mensaje;
    mensajeEstado.className = "mensaje-estado error";

    resultadoConfirmado.classList.add("oculto");

    return;
  }

  mostrarTablaConfirmada();

  textoConfirmado.value = transformarTexto(
    textoOriginal,
    sustituciones
  );

  resultadoConfirmado.classList.remove("oculto");

  mensajeEstado.textContent =
    "Solución confirmada correctamente. " +
    "Puedes copiar el mensaje o seguir editando.";

  mensajeEstado.className = "mensaje-estado exito";
}


// ============================================
// MOSTRAR TABLA DEFINITIVA
// ============================================

function mostrarTablaConfirmada() {

  tablaConfirmada.innerHTML = "";

  for (const origen of caracteresEncontrados) {

    if (!sustituciones.has(origen)) continue;

    const destino = sustituciones.get(origen);

    const fila = document.createElement("tr");

    const celdaOrigen = document.createElement("td");
    const celdaDestino = document.createElement("td");

    celdaOrigen.textContent = mostrarCaracter(origen);
    celdaDestino.textContent = mostrarCaracter(destino);

    fila.appendChild(celdaOrigen);
    fila.appendChild(celdaDestino);

    tablaConfirmada.appendChild(fila);
  }

  if (sustituciones.size === 0) {

    const fila = document.createElement("tr");
    const celda = document.createElement("td");

    celda.colSpan = 2;
    celda.textContent = "No se realizaron sustituciones.";
    celda.className = "vacio";

    fila.appendChild(celda);
    tablaConfirmada.appendChild(fila);
  }
}


// ============================================
// COPIAR TEXTO
// ============================================

async function copiarTexto(texto) {

  if (texto.length === 0) {

    alert("No hay texto para copiar.");

    return;
  }

  try {

    await navigator.clipboard.writeText(texto);

    alert("Texto copiado correctamente.");

  } catch (error) {

    alert("No fue posible copiar el texto.");
  }
}


// ============================================
// LIMPIAR PROGRAMA
// ============================================

function limpiarPrograma() {

  textoEntrada.value = "";

  textoOriginal = "";
  caracteresEncontrados = [];
  frecuencias = new Map();
  sustituciones = new Map();

  analisisRealizado = false;

  actualizarContador();

  resumen.textContent = "Esperando el análisis del texto.";

  tablaFrecuencias.innerHTML =
    '<tr><td colspan="3" class="vacio">No hay resultados.</td></tr>';

  tablaSustituciones.innerHTML =
    '<p class="vacio">Primero analiza un texto.</p>';

  textoResultado.value = "";

  textoConfirmado.value = "";
  tablaConfirmada.innerHTML = "";

  resultadoConfirmado.classList.add("oculto");

  mensajeEstado.textContent =
    "Todavía no se ha confirmado ninguna solución.";

  mensajeEstado.className = "mensaje-estado";
}


// ============================================
// EVENTOS DE LOS BOTONES
// ============================================

btnAnalizar.addEventListener("click", analizarTexto);

btnLimpiar.addEventListener("click", limpiarPrograma);

btnConfirmar.addEventListener("click", confirmarSolucion);

btnCopiarResultado.addEventListener("click", function () {

  copiarTexto(textoResultado.value);

});

btnCopiarConfirmado.addEventListener("click", function () {

  copiarTexto(textoConfirmado.value);

});

btnEditar.addEventListener("click", function () {

  resultadoConfirmado.classList.add("oculto");

  mensajeEstado.textContent =
    "Modo de edición activo. Puedes modificar las sustituciones.";

  mensajeEstado.className = "mensaje-estado";
});


// ============================================
// INICIO
// ============================================

actualizarContador();
