
const entrada = document.getElementById("textoEntrada");
const contador = document.getElementById("contador");
const botonAnalizar = document.getElementById("analizar");
const botonLimpiar = document.getElementById("limpiarTexto");
const botonCopiar = document.getElementById("copiar");
const zonaResultados = document.getElementById("zonaResultados");
const contenedorResultados = document.getElementById("resultados");
const mensajeCopiado = document.getElementById("mensajeCopiado");

const MAXIMO = 100000;

// Divide el texto en grafemas para contar correctamente letras
// acentuadas y caracteres Unicode.
function separarCaracteres(texto) {
  if (typeof Intl.Segmenter === "function") {
    const segmentador = new Intl.Segmenter("es", {
      granularity: "grapheme"
    });

    return Array.from(
      segmentador.segment(texto),
      elemento => elemento.segment
    );
  }

  return Array.from(texto);
}

// Agrupa mayúsculas y minúsculas sin modificar el texto original.
function normalizarCaracter(caracter) {
  return caracter.toLocaleUpperCase("es");
}

// Comprueba si un grafema es una letra.
function esLetra(caracter) {
  return /^\p{L}\p{M}*$/u.test(caracter);
}

// Convierte espacios y caracteres invisibles en etiquetas legibles.
function mostrarCaracter(caracter) {
  const especiales = {
    " ": "[ESPACIO]",
    "\n": "[SALTO DE LÍNEA]",
    "\r": "[RETORNO]",
    "\t": "[TABULACIÓN]"
  };

  return especiales[caracter] || caracter;
}

function mostrarSecuencia(secuencia) {
  return separarCaracteres(secuencia)
    .map(mostrarCaracter)
    .join(" ");
}

// Prepara el texto para el análisis de frecuencias.
function prepararTexto(texto, modalidad) {
  let caracteres = separarCaracteres(texto.normalize("NFC"));

  if (modalidad === "letras") {
    // En esta modalidad se eliminan espacios, números y signos
    // ANTES de construir pares, triples y cuádruples.
    caracteres = caracteres.filter(esLetra);
  }

  return caracteres.map(normalizarCaracter);
}

// Cuenta secuencias de longitud n.
function contarSecuencias(caracteres, longitud) {
  const frecuencias = new Map();

  if (longitud === 1) {
    for (const caracter of caracteres) {
      frecuencias.set(
        caracter,
        (frecuencias.get(caracter) || 0) + 1
      );
    }
  } else {
    // Ventana deslizante: avanza una posición cada vez.
    // Esto permite contar coincidencias superpuestas.
    for (let i = 0; i <= caracteres.length - longitud; i++) {
      const secuencia = caracteres
        .slice(i, i + longitud)
        .join("");

      frecuencias.set(
        secuencia,
        (frecuencias.get(secuencia) || 0) + 1
      );
    }
  }

  let resultados = Array.from(frecuencias.entries());

  // Letras individuales: mostrar todas las frecuencias.
  // Pares, triples y cuádruples: mostrar sólo repeticiones > 1.
  if (longitud > 1) {
    resultados = resultados.filter(item => item[1] > 1);
  }

  resultados.sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    return a[0].localeCompare(b[0], "es");
  });

  return resultados;
}

// Construye la salida de un tipo de frecuencia.
function generarTextoFrecuencias(resultados, longitud) {
  const nombres = {
    1: "LETRAS INDIVIDUALES",
    2: "PARES",
    3: "TRIPLES",
    4: "CUÁDRUPLES"
  };

  let texto = nombres[longitud] + "\n";
  texto += "----------------------------------------\n";

  if (resultados.length === 0) {
    texto += longitud === 1
      ? "No se encontraron letras.\n"
      : "No se encontraron secuencias repetidas.\n";

    return texto;
  }

  const ancho = Math.max(
    "Secuencia".length,
    ...resultados.map(item => mostrarSecuencia(item[0]).length)
  );

  texto += "Secuencia".padEnd(ancho + 4) + "Repeticiones\n";
  texto += "----------------------------------------\n";

  for (const [secuencia, cantidad] of resultados) {
    texto += mostrarSecuencia(secuencia)
      .padEnd(ancho + 4) + cantidad + "\n";
  }

  return texto;
}

// Analiza palabras completas de forma independiente.
function analizarLongitudPalabras(texto) {
  const palabras = texto.normalize("NFC").match(/\p{L}[\p{L}\p{M}]*/gu) || [];
  const frecuencias = new Map();

  for (const palabra of palabras) {
    const longitud = separarCaracteres(palabra).length;

    frecuencias.set(
      longitud,
      (frecuencias.get(longitud) || 0) + 1
    );
  }

  const resultados = Array.from(frecuencias.entries())
  .sort((a, b) => {
    // Primero, mayor número de repeticiones.
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    // En caso de empate, menor longitud primero.
    return a[0] - b[0];
  });

  let salida = "LONGITUD DE PALABRAS\n";
  salida += "----------------------------------------\n";
  salida += "Tamaño de palabra       Repeticiones\n";
  salida += "----------------------------------------\n";

  if (resultados.length === 0) {
    salida += "No se encontraron palabras.\n";
    return salida;
  }

  for (const [longitud, cantidad] of resultados) {
    salida += `${longitud} caracteres`.padEnd(26) + cantidad + "\n";
  }

  salida += "----------------------------------------\n";
  salida += `Total de palabras: ${palabras.length}\n`;

  return salida;
}

// Crea un bloque de resultados en la pantalla.
function crearBloque(titulo, contenido) {
  const bloque = document.createElement("div");
  bloque.className = "bloque-resultado";

  const encabezado = document.createElement("h3");
  encabezado.textContent = titulo;

  const salida = document.createElement("textarea");
  salida.className = "salida";
  salida.readOnly = true;
  salida.value = contenido;
  salida.setAttribute("aria-label", titulo);

  bloque.appendChild(encabezado);
  bloque.appendChild(salida);

  return bloque;
}

// Guarda el texto completo que se copiará.
let textoParaCopiar = "";

function analizar() {
  const texto = entrada.value;

  if (!texto.trim()) {
    alert("Escribe o pega un texto antes de analizarlo.");
    return;
  }

  const modalidad = document.querySelector(
    'input[name="modalidad"]:checked'
  ).value;

  const tiposSeleccionados = Array.from(
    document.querySelectorAll('input[name="tipoFrecuencia"]:checked')
  ).map(elemento => Number(elemento.value));

  const incluirPalabras = document.getElementById(
    "analizarPalabras"
  ).checked;

  if (tiposSeleccionados.length === 0 && !incluirPalabras) {
    alert("Selecciona al menos un tipo de análisis.");
    return;
  }

  contenedorResultados.innerHTML = "";
  textoParaCopiar = "";

  const bloques = [];

  if (tiposSeleccionados.length > 0) {
    const caracteres = prepararTexto(texto, modalidad);

    const nombres = {
      1: "Letras individuales",
      2: "Pares",
      3: "Triples",
      4: "Cuádruples"
    };

    for (const longitud of tiposSeleccionados) {
      const frecuencias = contarSecuencias(caracteres, longitud);
      const contenido = generarTextoFrecuencias(
        frecuencias,
        longitud
      );

      bloques.push({
        titulo: nombres[longitud],
        contenido
      });
    }
  }

  // El análisis de palabras utiliza siempre el texto original.
  if (incluirPalabras) {
    bloques.push({
      titulo: "Longitud de palabras",
      contenido: analizarLongitudPalabras(texto)
    });
  }

  const resultadosJuntos = document.getElementById(
    "resultadosJuntos"
  ).checked;

  if (resultadosJuntos) {
    // Todos los análisis aparecen dentro de un único cuadro.
    const contenidoCompleto = bloques
      .map(bloque => bloque.contenido)
      .join("\n\n");

    contenedorResultados.appendChild(
      crearBloque("Todos los resultados", contenidoCompleto)
    );

    textoParaCopiar = contenidoCompleto;
  } else {
    // Cada análisis aparece en su propio cuadro.
    for (const bloque of bloques) {
      contenedorResultados.appendChild(
        crearBloque(bloque.titulo, bloque.contenido)
      );

      textoParaCopiar += bloque.contenido + "\n\n";
    }
  }

  zonaResultados.hidden = false;
  mensajeCopiado.textContent = "";

  zonaResultados.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// Actualiza el contador de caracteres.
entrada.addEventListener("input", () => {
  contador.textContent =
    `${entrada.value.length} / ${MAXIMO} caracteres`;
});

// Ejecuta el análisis.
botonAnalizar.addEventListener("click", analizar);

// Limpia el texto y los resultados.
botonLimpiar.addEventListener("click", () => {
  entrada.value = "";
  contador.textContent = `0 / ${MAXIMO} caracteres`;
  contenedorResultados.innerHTML = "";
  zonaResultados.hidden = true;
  mensajeCopiado.textContent = "";
  textoParaCopiar = "";
  entrada.focus();
});

// Copia todos los resultados generados.
botonCopiar.addEventListener("click", async () => {
  if (!textoParaCopiar) {
    return;
  }

  try {
    await navigator.clipboard.writeText(textoParaCopiar);
    mensajeCopiado.textContent = "Resultados copiados correctamente.";
  } catch (error) {
    // Alternativa para navegadores que no permiten Clipboard API.
    const auxiliar = document.createElement("textarea");
    auxiliar.value = textoParaCopiar;
    document.body.appendChild(auxiliar);
    auxiliar.select();

    const copiado = document.execCommand("copy");
    auxiliar.remove();

    mensajeCopiado.textContent = copiado
      ? "Resultados copiados correctamente."
      : "No se pudo copiar. Selecciona el texto manualmente.";
  }
});
