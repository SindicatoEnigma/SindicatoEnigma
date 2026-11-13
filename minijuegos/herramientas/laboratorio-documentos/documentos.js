
"use strict";

// =============================================
// 1. ELEMENTOS DE LA INTERFAZ
// =============================================

const archivoImagen = document.getElementById("archivoImagen");
const vistaPrevia = document.getElementById("vistaPrevia");
const contenedorVista = document.getElementById("contenedorVista");
const nombreArchivo = document.getElementById("nombreArchivo");

const modoReconocimiento = document.getElementById("modoReconocimiento");
const tipoTexto = document.getElementById("tipoTexto");
const idiomaOCR = document.getElementById("idiomaOCR");
const preprocesamiento = document.getElementById("preprocesamiento");
const segmentacion = document.getElementById("segmentacion");
const campoSegmentacion = document.getElementById("campoSegmentacion");

const btnReconocer = document.getElementById("btnReconocer");
const btnCopiar = document.getElementById("btnCopiar");
const btnLimpiar = document.getElementById("btnLimpiar");

const resultadoTexto = document.getElementById("resultadoTexto");
const confianza = document.getElementById("confianza");
const cantidadCaracteres = document.getElementById("cantidadCaracteres");
const metodoUsado = document.getElementById("metodoUsado");

const zonaProgreso = document.getElementById("zonaProgreso");
const barraProgreso = document.getElementById("barraProgreso");
const estadoOCR = document.getElementById("estadoOCR");
const mensaje = document.getElementById("mensaje");


// =============================================
// 2. VARIABLES GENERALES
// =============================================

let archivoActual = null;
let trabajador = null;
let idiomaTrabajador = null;
let ocupado = false;


// =============================================
// 3. EVENTOS
// =============================================

archivoImagen.addEventListener("change", function () {
  const archivo = this.files[0];

  if (!archivo) return;

  if (!archivo.type.startsWith("image/")) {
    mostrarMensaje("Selecciona un archivo de imagen válido.");
    return;
  }

  archivoActual = archivo;

  const url = URL.createObjectURL(archivo);

  vistaPrevia.onload = function () {
    URL.revokeObjectURL(url);
  };

  vistaPrevia.onerror = function () {
    URL.revokeObjectURL(url);
    mostrarMensaje("No se pudo abrir la imagen.");
  };

  vistaPrevia.src = url;

  nombreArchivo.textContent = archivo.name;
  contenedorVista.classList.remove("oculto");

  btnReconocer.disabled = false;

  resultadoTexto.value = "";
  confianza.textContent = "—";
  cantidadCaracteres.textContent = "0";
  metodoUsado.textContent = "—";

  mostrarMensaje("Imagen cargada correctamente.");
});


modoReconocimiento.addEventListener("change", actualizarInterfaz);

tipoTexto.addEventListener("change", function () {
  if (tipoTexto.value === "codigo") {
    idiomaOCR.value = "eng";
    preprocesamiento.value = "contraste";
  }
});

btnReconocer.addEventListener("click", reconocerImagen);

btnCopiar.addEventListener("click", copiarTexto);

btnLimpiar.addEventListener("click", limpiarLaboratorio);


function actualizarInterfaz() {
  const esCaracteres = modoReconocimiento.value === "caracteres";

  campoSegmentacion.classList.toggle("oculto", esCaracteres);

  if (esCaracteres) {
    estadoOCR.textContent = "Preparando reconocimiento por caracteres...";
  }
}


// =============================================
// 4. MENSAJES Y PROGRESO
// =============================================

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

function actualizarProgreso(valor, texto) {
  const porcentaje = Math.max(0, Math.min(100, valor));

  zonaProgreso.classList.remove("oculto");
  barraProgreso.style.width = porcentaje + "%";

  if (texto) {
    estadoOCR.textContent = texto;
  }
}


// =============================================
// 5. PREPARAR LA IMAGEN
// =============================================

async function crearImagenProcesada(archivo) {
  const imagen = new Image();
  const url = URL.createObjectURL(archivo);

  try {
    await new Promise((resolve, reject) => {
      imagen.onload = resolve;
      imagen.onerror = reject;
      imagen.src = url;
    });

    const maxDimension = 2600;
    const escala = Math.min(
      2.5,
      maxDimension / Math.max(imagen.width, imagen.height)
    );

    const ancho = Math.max(1, Math.round(imagen.width * escala));
    const alto = Math.max(1, Math.round(imagen.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(imagen, 0, 0, ancho, alto);

    procesarPixeles(ctx, ancho, alto);

    return canvas;

  } finally {
    URL.revokeObjectURL(url);
  }
}


// =============================================
// 6. PROCESAMIENTO DE IMAGEN
// =============================================

function procesarPixeles(ctx, ancho, alto) {
  const tipo = preprocesamiento.value;

  if (tipo === "original") {
    return;
  }

  const datos = ctx.getImageData(0, 0, ancho, alto);
  const pixeles = datos.data;

  const grises = new Uint8Array(ancho * alto);

  for (let i = 0, p = 0; i < pixeles.length; i += 4, p++) {
    const gris = Math.round(
      0.299 * pixeles[i] +
      0.587 * pixeles[i + 1] +
      0.114 * pixeles[i + 2]
    );

    grises[p] = gris;
  }

  if (tipo === "contraste") {
    const factor = 1.45;

    for (let p = 0, i = 0; p < grises.length; p++, i += 4) {
      const valor = Math.max(
        0,
        Math.min(255, (grises[p] - 128) * factor + 128)
      );

      pixeles[i] = valor;
      pixeles[i + 1] = valor;
      pixeles[i + 2] = valor;
      pixeles[i + 3] = 255;
    }
  }

  if (tipo === "otsu") {
    const umbral = calcularUmbralOtsu(grises);

    for (let p = 0, i = 0; p < grises.length; p++, i += 4) {
      const valor = grises[p] <= umbral ? 0 : 255;

      pixeles[i] = valor;
      pixeles[i + 1] = valor;
      pixeles[i + 2] = valor;
      pixeles[i + 3] = 255;
    }
  }

  ctx.putImageData(datos, 0, 0);
}


// =============================================
// 7. CALCULAR UMBRAL DE OTSU
// =============================================

function calcularUmbralOtsu(grises) {
  const histograma = new Array(256).fill(0);

  for (const valor of grises) {
    histograma[valor]++;
  }

  const total = grises.length;
  let sumaTotal = 0;

  for (let i = 0; i < 256; i++) {
    sumaTotal += i * histograma[i];
  }

  let sumaFondo = 0;
  let pesoFondo = 0;
  let varianzaMaxima = -1;
  let mejorUmbral = 127;

  for (let i = 0; i < 256; i++) {
    pesoFondo += histograma[i];

    if (pesoFondo === 0) continue;

    const pesoObjeto = total - pesoFondo;

    if (pesoObjeto === 0) break;

    sumaFondo += i * histograma[i];

    const mediaFondo = sumaFondo / pesoFondo;
    const mediaObjeto = (sumaTotal - sumaFondo) / pesoObjeto;

    const diferencia = mediaFondo - mediaObjeto;

    const varianza =
      pesoFondo * pesoObjeto * diferencia * diferencia;

    if (varianza > varianzaMaxima) {
      varianzaMaxima = varianza;
      mejorUmbral = i;
    }
  }

  return mejorUmbral;
}


// =============================================
// 8. CREAR OBTENER TRABAJADOR OCR
// =============================================

async function obtenerTrabajador(idioma) {
  if (trabajador && idiomaTrabajador === idioma) {
    return trabajador;
  }

  if (trabajador) {
    await trabajador.terminate();
    trabajador = null;
    idiomaTrabajador = null;
  }

  actualizarProgreso(2, "Cargando motor OCR e idioma...");

  trabajador = await Tesseract.createWorker(
    idioma,
    1,
    {
      logger: function (dato) {
        if (dato.status === "recognizing text") {
          actualizarProgreso(
            10 + (dato.progress || 0) * 80,
            "Reconociendo texto..."
          );
        } else if (dato.status) {
          estadoOCR.textContent = dato.status;
        }
      }
    }
  );

  idiomaTrabajador = idioma;

  await trabajador.setParameters({
    preserve_interword_spaces: "1",
    user_defined_dpi: "300"
  });

  return trabajador;
}


// =============================================
// 9. RECONOCIMIENTO PRINCIPAL
// =============================================

async function reconocerImagen() {
  if (!archivoActual || ocupado) return;

  ocupado = true;
  btnReconocer.disabled = true;

  resultadoTexto.value = "";
  confianza.textContent = "—";
  cantidadCaracteres.textContent = "0";
  metodoUsado.textContent = "—";

  mostrarMensaje("");
  actualizarProgreso(0, "Preparando imagen...");

  try {
    const canvas = await crearImagenProcesada(archivoActual);

    const idioma = idiomaOCR.value;
    const motor = await obtenerTrabajador(idioma);

    let texto = "";
    let confianzaFinal = 0;

    if (modoReconocimiento.value === "caracteres") {
      actualizarProgreso(10, "Separando líneas y caracteres...");

      const resultado = await reconocerPorCaracteres(
        motor,
        canvas
      );

      texto = resultado.texto;
      confianzaFinal = resultado.confianza;

      metodoUsado.textContent = "Por caracteres";

    } else {
      const psm = segmentacion.value;

      await motor.setParameters({
        tessedit_pageseg_mode: psm,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300"
      });

      actualizarProgreso(15, "Reconociendo texto...");

      const resultado = await motor.recognize(canvas);

      texto = resultado.data.text || "";
      confianzaFinal = resultado.data.confidence || 0;

      metodoUsado.textContent = "Convencional";
    }

    resultadoTexto.value = texto.trimEnd();

    const total = Array.from(texto).length;

    confianza.textContent =
      Math.round(confianzaFinal) + "%";

    cantidadCaracteres.textContent = total;

    actualizarProgreso(100, "Reconocimiento terminado.");

    mostrarMensaje(
      "Proceso terminado. Revisa el resultado y corrige los caracteres dudosos."
    );

  } catch (error) {
    console.error("Error OCR:", error);

    mostrarMensaje(
      "No se pudo completar el reconocimiento. Revisa tu conexión e inténtalo nuevamente."
    );

    estadoOCR.textContent = "Error durante el reconocimiento.";

  } finally {
    ocupado = false;
    btnReconocer.disabled = !archivoActual;
  }
}


// =============================================
// 10. DETECTAR BANDAS DE PIXELES
// =============================================

function detectarBandas(proyeccion, tolerancia, minimo) {
  const bandas = [];

  let inicio = -1;
  let ultimoActivo = -1;

  for (let i = 0; i < proyeccion.length; i++) {
    if (proyeccion[i] >= minimo) {
      if (inicio === -1) {
        inicio = i;
      }

      ultimoActivo = i;

    } else if (
      inicio !== -1 &&
      i - ultimoActivo > tolerancia
    ) {
      bandas.push({
        inicio: inicio,
        fin: ultimoActivo
      });

      inicio = -1;
      ultimoActivo = -1;
    }
  }

  if (inicio !== -1) {
    bandas.push({
      inicio: inicio,
      fin: ultimoActivo
    });
  }

  return bandas;
}


// =============================================
// 11. DETECTAR LÍNEAS DE TEXTO
// =============================================

function detectarLineas(datos, ancho, alto) {
  const proyeccion = new Uint32Array(alto);

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const indice = (y * ancho + x) * 4;

      const gris =
        0.299 * datos[indice] +
        0.587 * datos[indice + 1] +
        0.114 * datos[indice + 2];

      if (gris < 180) {
        proyeccion[y]++;
      }
    }
  }

  const minimo = Math.max(2, Math.floor(ancho * 0.001));

  return detectarBandas(proyeccion, 2, minimo);
}


// =============================================
// 12. DETECTAR CARACTERES DE UNA LÍNEA
// =============================================

function detectarCaracteres(datos, ancho, linea) {
  const altoLinea = linea.fin - linea.inicio + 1;

  const proyeccion = new Uint32Array(ancho);

  for (let x = 0; x < ancho; x++) {
    for (let y = linea.inicio; y <= linea.fin; y++) {
      const indice = (y * ancho + x) * 4;

      const gris =
        0.299 * datos[indice] +
        0.587 * datos[indice + 1] +
        0.114 * datos[indice + 2];

      if (gris < 180) {
        proyeccion[x]++;
      }
    }
  }

  const minimo = Math.max(1, Math.floor(altoLinea * 0.015));

  return detectarBandas(proyeccion, 1, minimo);
}


// =============================================
// 13. CREAR RECORTE DE UN CARÁCTER
// =============================================

function crearRecorte(
  canvasOriginal,
  segmento,
  linea
) {
  const padding = 4;

  const izquierda = Math.max(0, segmento.inicio - padding);
  const derecha = Math.min(
    canvasOriginal.width - 1,
    segmento.fin + padding
  );

  const arriba = Math.max(0, linea.inicio - padding);
  const abajo = Math.min(
    canvasOriginal.height - 1,
    linea.fin + padding
  );

  const ancho = derecha - izquierda + 1;
  const alto = abajo - arriba + 1;

  const recorte = document.createElement("canvas");

  recorte.width = ancho;
  recorte.height = alto;

  const ctx = recorte.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);

  ctx.drawImage(
    canvasOriginal,
    izquierda,
    arriba,
    ancho,
    alto,
    0,
    0,
    ancho,
    alto
  );

  return recorte;
}


// =============================================
// 14. RECONOCER POR CARACTERES
// =============================================

async function reconocerPorCaracteres(motor, canvas) {
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  const imagen = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const lineas = detectarLineas(
    imagen.data,
    canvas.width,
    canvas.height
  );

  if (lineas.length === 0) {
    throw new Error("No se detectaron líneas de texto.");
  }

  await motor.setParameters({
    tessedit_pageseg_mode: "10",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300"
  });

  let textoCompleto = "";
  let confianzas = [];
  let caracteresProcesados = 0;

  // Primera pasada: contar recortes para el progreso.
  let totalSegmentos = 0;

  const segmentosPorLinea = lineas.map(function (linea) {
    const segmentos = detectarCaracteres(
      imagen.data,
      canvas.width,
      linea
    );

    totalSegmentos += segmentos.length;

    return segmentos;
  });

  if (totalSegmentos === 0) {
    throw new Error("No se encontraron caracteres.");
  }

  // Segunda pasada: reconocer cada recorte.
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const segmentos = segmentosPorLinea[i];

    let textoLinea = "";

    let anchos = segmentos.map(function (segmento) {
      return segmento.fin - segmento.inicio + 1;
    });

    const anchosOrdenados = [...anchos].sort((a, b) => a - b);

    const anchoMediano =
      anchosOrdenados[Math.floor(anchosOrdenados.length / 2)] || 1;

    for (let j = 0; j < segmentos.length; j++) {
      const segmento = segmentos[j];

      // Estimar espacios entre caracteres.
      if (j > 0) {
        const espacio = segmento.inicio -
          segmentos[j - 1].fin - 1;

        const limiteEspacio = Math.max(
          3,
          (linea.fin - linea.inicio + 1) * 0.25,
          anchoMediano * 0.55
        );

        if (espacio > limiteEspacio) {
          textoLinea += " ";
        }
      }

      const recorte = crearRecorte(
        canvas,
        segmento,
        linea
      );

      const resultado = await motor.recognize(recorte);

      let caracter = (resultado.data.text || "")
        .replace(/\s/g, "");

      // El modo de carácter debe devolver un símbolo.
      // Si devuelve varios, conservamos el primero.
      const simbolos = Array.from(caracter);

      caracter = simbolos.length > 0
        ? simbolos[0]
        : "�";

      textoLinea += caracter;

      confianzas.push(
        Number(resultado.data.confidence) || 0
      );

      caracteresProcesados++;

      const progreso = 15 +
        (caracteresProcesados / totalSegmentos) * 80;

      actualizarProgreso(
        progreso,
        "Reconociendo carácter " +
        caracteresProcesados +
        " de " +
        totalSegmentos
      );
    }

    textoCompleto += textoLinea;

    if (i < lineas.length - 1) {
      textoCompleto += "\n";
    }
  }

  const promedio = confianzas.length > 0
    ? confianzas.reduce((a, b) => a + b, 0) /
      confianzas.length
    : 0;

  // Restaurar parámetros convencionales para la siguiente prueba.
  await motor.setParameters({
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300"
  });

  return {
    texto: textoCompleto,
    confianza: promedio,
    total: caracteresProcesados
  };
}


// =============================================
// 15. COPIAR TEXTO
// =============================================

async function copiarTexto() {
  const texto = resultadoTexto.value;

  if (!texto.trim()) {
    mostrarMensaje("No hay texto para copiar.");
    return;
  }

  try {
    await navigator.clipboard.writeText(texto);
    mostrarMensaje("Texto copiado correctamente.");

  } catch (error) {
    resultadoTexto.select();

    const correcto = document.execCommand("copy");

    mostrarMensaje(
      correcto
        ? "Texto copiado correctamente."
        : "No se pudo copiar automáticamente. Selecciona el texto y cópialo."
    );
  }
}


// =============================================
// 16. LIMPIAR LABORATORIO
// =============================================

function limpiarLaboratorio() {
  if (ocupado) return;

  archivoActual = null;

  archivoImagen.value = "";
  vistaPrevia.removeAttribute("src");

  contenedorVista.classList.add("oculto");

  resultadoTexto.value = "";

  confianza.textContent = "—";
  cantidadCaracteres.textContent = "0";
  metodoUsado.textContent = "—";

  barraProgreso.style.width = "0%";
  zonaProgreso.classList.add("oculto");

  btnReconocer.disabled = true;

  mostrarMensaje("Laboratorio limpio.");
}


// =============================================
// 17. INICIAR INTERFAZ
// =============================================

actualizarInterfaz();
