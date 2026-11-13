/* =========================================================
   SINDICATO ENIGMA
   LABORATORIO DE DOCUMENTOS OCR
   VERSIÓN 4.1 - DETECCIÓN CORREGIDA Y DIAGNÓSTICO

   - Cinco variantes de imagen.
   - Detección visual de bloques y líneas.
   - OCR exclusivamente PSM 7.
   - Recortes ampliados antes del reconocimiento.
   - Respaldo con imagen completa si falla la detección.
   - Comparación y consenso de caracteres.
   ========================================================= */


/* =========================================================
   1. ELEMENTOS HTML
   ========================================================= */

const inputImagen = document.getElementById("imagen");
const nombreArchivo = document.getElementById("nombreArchivo");
const vistaPrevia = document.getElementById("vistaPrevia");
const contenedorVista = document.getElementById("contenedorVista");

const btnAnalizar = document.getElementById("btnAnalizar");
const btnCopiar = document.getElementById("btnCopiar");
const btnLimpiar = document.getElementById("btnLimpiar");

const resultado = document.getElementById("resultado");
const estado = document.getElementById("estado");
const barraProgreso = document.getElementById("barraProgreso");
const progresoContenedor = document.getElementById("progresoContenedor");
const estadoResultado = document.getElementById("estadoResultado");
const resumen = document.getElementById("resumen");

const totalBloques = document.getElementById("totalBloques");
const totalLineas = document.getElementById("totalLineas");
const totalPalabras = document.getElementById("totalPalabras");
const totalCaracteres = document.getElementById("totalCaracteres");
const confianza = document.getElementById("confianza");
const coincidencia = document.getElementById("coincidencia");


/* =========================================================
   2. CONFIGURACIÓN
   ========================================================= */

const MAX_DIMENSION = 2200;
const MARGEN_RECORTE = 18;
const ESCALA_RECORTE = 2.5;

const VARIANTES = [
    "ORIGINAL",
    "GRISES + CONTRASTE",
    "GRISES + ENFOQUE",
    "REDUCCIÓN DE RUIDO",
    "BINARIZACIÓN ADAPTATIVA"
];

let imagenCargada = null;
let workerOCR = null;
let procesando = false;


/* =========================================================
   3. FUNCIONES GENERALES
   ========================================================= */

function actualizarEstado(mensaje) {
    if (estado) estado.textContent = mensaje;
}

function actualizarProgreso(valor) {
    const porcentaje = Math.max(0, Math.min(100, valor));

    if (barraProgreso) {
        barraProgreso.style.width = porcentaje + "%";
    }

    if (progresoContenedor) {
        progresoContenedor.style.display = "block";
    }
}

function limpiarEstadisticas() {
    if (totalBloques) totalBloques.textContent = "0";
    if (totalLineas) totalLineas.textContent = "0";
    if (totalPalabras) totalPalabras.textContent = "0";
    if (totalCaracteres) totalCaracteres.textContent = "0";
    if (confianza) confianza.textContent = "0%";
    if (coincidencia) coincidencia.textContent = "0%";
}

function obtenerGris(r, g, b) {
    return Math.round(
        0.299 * r +
        0.587 * g +
        0.114 * b
    );
}

function limitarImagen(imagen) {
    const escala = Math.min(
        1,
        MAX_DIMENSION / Math.max(imagen.width, imagen.height)
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.round(imagen.width * escala));
    canvas.height = Math.max(1, Math.round(imagen.height * escala));

    canvas.getContext("2d").drawImage(
        imagen, 0, 0, canvas.width, canvas.height
    );

    return canvas;
}

function clonarCanvas(original) {
    const canvas = document.createElement("canvas");

    canvas.width = original.width;
    canvas.height = original.height;

    canvas.getContext("2d").drawImage(original, 0, 0);

    return canvas;
}


/* =========================================================
   4. UMBRAL DE OTSU
   ========================================================= */

function calcularUmbralOtsu(datos) {
    const histograma = new Array(256).fill(0);

    let total = 0;
    let sumaTotal = 0;

    for (let i = 0; i < datos.length; i += 4) {
        const gris = obtenerGris(
            datos[i], datos[i + 1], datos[i + 2]
        );

        histograma[gris]++;
        sumaTotal += gris;
        total++;
    }

    let sumaFondo = 0;
    let pesoFondo = 0;
    let mejorVarianza = -1;
    let mejorUmbral = 127;

    for (let t = 0; t < 256; t++) {
        pesoFondo += histograma[t];

        if (pesoFondo === 0) continue;

        const pesoTexto = total - pesoFondo;

        if (pesoTexto === 0) break;

        sumaFondo += t * histograma[t];

        const mediaFondo = sumaFondo / pesoFondo;
        const mediaTexto =
            (sumaTotal - sumaFondo) / pesoTexto;

        const varianza =
            pesoFondo *
            pesoTexto *
            Math.pow(mediaFondo - mediaTexto, 2);

        if (varianza > mejorVarianza) {
            mejorVarianza = varianza;
            mejorUmbral = t;
        }
    }

    return mejorUmbral;
}


/* =========================================================
   5. CREACIÓN DE LAS CINCO VARIANTES
   ========================================================= */

function convertirEscalaGrises(canvas, contraste = 1) {
    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const imagen = ctx.getImageData(
        0, 0, canvas.width, canvas.height
    );

    const datos = imagen.data;

    for (let i = 0; i < datos.length; i += 4) {
        let gris = obtenerGris(
            datos[i], datos[i + 1], datos[i + 2]
        );

        gris = (gris - 128) * contraste + 128;
        gris = Math.max(0, Math.min(255, gris));

        datos[i] = gris;
        datos[i + 1] = gris;
        datos[i + 2] = gris;
    }

    ctx.putImageData(imagen, 0, 0);

    return canvas;
}


function crearImagenOriginal(original) {
    return clonarCanvas(original);
}


function crearImagenContraste(original) {
    return convertirEscalaGrises(
        clonarCanvas(original), 1.18
    );
}


function crearImagenEnfocada(original) {
    const canvas = clonarCanvas(original);

    convertirEscalaGrises(canvas, 1.08);

    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const imagen = ctx.getImageData(
        0, 0, canvas.width, canvas.height
    );

    const datos = imagen.data;
    const copia = new Uint8ClampedArray(datos);

    const ancho = canvas.width;
    const alto = canvas.height;

    for (let y = 1; y < alto - 1; y++) {
        for (let x = 1; x < ancho - 1; x++) {
            const i = (y * ancho + x) * 4;

            const arriba = ((y - 1) * ancho + x) * 4;
            const abajo = ((y + 1) * ancho + x) * 4;
            const izquierda = (y * ancho + x - 1) * 4;
            const derecha = (y * ancho + x + 1) * 4;

            const valor =
                5 * copia[i] -
                copia[arriba] -
                copia[abajo] -
                copia[izquierda] -
                copia[derecha];

            const nuevo = Math.max(
                0, Math.min(255, valor)
            );

            datos[i] = nuevo;
            datos[i + 1] = nuevo;
            datos[i + 2] = nuevo;
        }
    }

    ctx.putImageData(imagen, 0, 0);

    return canvas;
}


function crearImagenSinRuido(original) {
    const canvas = document.createElement("canvas");

    canvas.width = original.width;
    canvas.height = original.height;

    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    ctx.filter = "blur(0.35px)";
    ctx.drawImage(original, 0, 0);
    ctx.filter = "none";

    convertirEscalaGrises(canvas, 1.25);

    return canvas;
}


function crearImagenAdaptativa(original) {
    const canvas = clonarCanvas(original);

    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const ancho = canvas.width;
    const alto = canvas.height;

    const imagen = ctx.getImageData(0, 0, ancho, alto);
    const datos = imagen.data;

    const grises = new Uint8Array(ancho * alto);

    let sumaGlobal = 0;

    for (let i = 0; i < grises.length; i++) {
        const p = i * 4;

        const gris = obtenerGris(
            datos[p], datos[p + 1], datos[p + 2]
        );

        grises[i] = gris;
        sumaGlobal += gris;
    }

    const mediaGlobal = sumaGlobal / grises.length;

    if (mediaGlobal < 127) {
        for (let i = 0; i < grises.length; i++) {
            grises[i] = 255 - grises[i];
        }
    }

    const stride = ancho + 1;

    const integral = new Float64Array(
        (ancho + 1) * (alto + 1)
    );

    for (let y = 1; y <= alto; y++) {
        let sumaFila = 0;

        for (let x = 1; x <= ancho; x++) {
            sumaFila += grises[
                (y - 1) * ancho + (x - 1)
            ];

            integral[y * stride + x] =
                integral[(y - 1) * stride + x] + sumaFila;
        }
    }

    const radio = 15;
    const diferencia = 10;

    for (let y = 0; y < alto; y++) {
        const y1 = Math.max(0, y - radio);
        const y2 = Math.min(alto, y + radio + 1);

        for (let x = 0; x < ancho; x++) {
            const x1 = Math.max(0, x - radio);
            const x2 = Math.min(ancho, x + radio + 1);

            const suma =
                integral[y2 * stride + x2] -
                integral[y1 * stride + x2] -
                integral[y2 * stride + x1] +
                integral[y1 * stride + x1];

            const cantidad =
                (x2 - x1) * (y2 - y1);

            const mediaLocal = suma / cantidad;

            const valor = grises[y * ancho + x];

            const salida =
                valor < mediaLocal - diferencia ? 0 : 255;

            const p = (y * ancho + x) * 4;

            datos[p] = salida;
            datos[p + 1] = salida;
            datos[p + 2] = salida;
            datos[p + 3] = 255;
        }
    }

    ctx.putImageData(imagen, 0, 0);

    return canvas;
}


function crearVariantes(original) {
    return [
        crearImagenOriginal(original),
        crearImagenContraste(original),
        crearImagenEnfocada(original),
        crearImagenSinRuido(original),
        crearImagenAdaptativa(original)
    ];
}


/* =========================================================
   6. DETECCIÓN DE TEXTO CON UMBRAL TOLERANTE
   ========================================================= */

function obtenerMascaraFlexible(canvas, ajuste = 0) {
    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const ancho = canvas.width;
    const alto = canvas.height;

    const imagen = ctx.getImageData(0, 0, ancho, alto);
    const datos = imagen.data;

    const umbralBase = calcularUmbralOtsu(datos);

    // Estimar el color del fondo utilizando las esquinas.
    const puntos = [
        0,
        (ancho - 1) * 4,
        ((alto - 1) * ancho) * 4,
        ((alto - 1) * ancho + ancho - 1) * 4
    ];

    let sumaBordes = 0;

    for (const p of puntos) {
        sumaBordes += obtenerGris(
            datos[p], datos[p + 1], datos[p + 2]
        );
    }

    const mediaBordes = sumaBordes / puntos.length;

    // Fondo claro: texto oscuro.
    // Fondo oscuro: texto claro.
    const textoOscuro = mediaBordes >= umbralBase;

    let umbral = umbralBase + ajuste;

    umbral = Math.max(10, Math.min(245, umbral));

    const mascara = new Uint8Array(ancho * alto);

    for (let i = 0; i < mascara.length; i++) {
        const p = i * 4;

        const gris = obtenerGris(
            datos[p], datos[p + 1], datos[p + 2]
        );

        const esTexto = textoOscuro
            ? gris < umbral
            : gris > umbral;

        mascara[i] = esTexto ? 1 : 0;
    }

    return {
        mascara,
        umbral,
        textoOscuro,
        mediaBordes
    };
}


/* =========================================================
   7. DETECTAR BANDAS HORIZONTALES
   ========================================================= */

function agruparFilas(proyeccion, ancho, alto) {
    const minimoPixeles = Math.max(
        2,
        Math.floor(ancho * 0.00015)
    );

    const filasActivas = new Array(alto).fill(false);

    for (let y = 0; y < alto; y++) {
        filasActivas[y] =
            proyeccion[y] >= minimoPixeles;
    }

    const grupos = [];

    let inicio = null;
    let ultimaActiva = null;

    // Permitir pequeños huecos entre trazos de una misma línea.
    const huecoMaximo = Math.max(
        2,
        Math.min(5, Math.round(alto * 0.0015))
    );

    for (let y = 0; y < alto; y++) {
        if (filasActivas[y]) {
            if (inicio === null) inicio = y;

            ultimaActiva = y;
        } else if (
            inicio !== null &&
            y - ultimaActiva > huecoMaximo
        ) {
            grupos.push({
                y0: inicio,
                y1: ultimaActiva + 1
            });

            inicio = null;
            ultimaActiva = null;
        }
    }

    if (inicio !== null) {
        grupos.push({
            y0: inicio,
            y1: ultimaActiva + 1
        });
    }

    return grupos;
}


/* =========================================================
   8. DETECTAR LÍNEAS Y BLOQUES
   ========================================================= */

function detectarLineas(canvas) {
    const ancho = canvas.width;
    const alto = canvas.height;

    // Probar varios umbrales para evitar perder letras tenues.
    const ajustes = [0, -12, 12];

    let mejorResultado = null;

    for (const ajuste of ajustes) {
        const datosMascara = obtenerMascaraFlexible(
            canvas,
            ajuste
        );

        const mascara = datosMascara.mascara;

        const proyeccion = new Array(alto).fill(0);

        for (let y = 0; y < alto; y++) {
            let cantidad = 0;

            for (let x = 0; x < ancho; x++) {
                cantidad += mascara[y * ancho + x];
            }

            proyeccion[y] = cantidad;
        }

        let grupos = agruparFilas(
            proyeccion,
            ancho,
            alto
        );

        // Descartar grupos excesivamente pequeños.
        grupos = grupos.filter(grupo => {
            const altura = grupo.y1 - grupo.y0;

            let pixeles = 0;

            for (let y = grupo.y0; y < grupo.y1; y++) {
                pixeles += proyeccion[y];
            }

            return altura >= 3 && pixeles >= 4;
        });

        const puntuacion = grupos.length;

        if (
            !mejorResultado ||
            puntuacion > mejorResultado.lineas.length
        ) {
            mejorResultado = {
                lineas: grupos,
                mascara,
                umbral: datosMascara.umbral,
                polaridad: datosMascara.textoOscuro
                    ? "Texto oscuro sobre fondo claro"
                    : "Texto claro sobre fondo oscuro",
                mediaBordes: datosMascara.mediaBordes
            };
        }
    }

    if (!mejorResultado || !mejorResultado.lineas.length) {
        return {
            lineas: [],
            bloques: [],
            alturaMediana: 0,
            umbral: 0,
            polaridad: "No determinada"
        };
    }

    const mascara = mejorResultado.mascara;

    const lineasFinales = [];

    for (const linea of mejorResultado.lineas) {
        let x0 = ancho;
        let x1 = -1;

        for (let y = linea.y0; y < linea.y1; y++) {
            for (let x = 0; x < ancho; x++) {
                if (mascara[y * ancho + x]) {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                }
            }
        }

        if (x1 >= x0) {
            lineasFinales.push({
                x0,
                y0: linea.y0,
                x1: x1 + 1,
                y1: linea.y1,
                centroY: (linea.y0 + linea.y1) / 2
            });
        }
    }

    if (!lineasFinales.length) {
        return {
            lineas: [],
            bloques: [],
            alturaMediana: 0,
            umbral: mejorResultado.umbral,
            polaridad: mejorResultado.polaridad
        };
    }

    const alturas = lineasFinales.map(
        linea => linea.y1 - linea.y0
    );

    const alturasOrdenadas = [...alturas].sort(
        (a, b) => a - b
    );

    const alturaMediana =
        alturasOrdenadas[
            Math.floor(alturasOrdenadas.length / 2)
        ] || 10;

    // Agrupar líneas en bloques según el espacio vertical.
    const bloques = [];

    let bloqueActual = [];

    for (const linea of lineasFinales) {
        if (!bloqueActual.length) {
            bloqueActual.push(linea);
            continue;
        }

        const anterior = bloqueActual[
            bloqueActual.length - 1
        ];

        const espacio = linea.y0 - anterior.y1;

        if (espacio > alturaMediana * 1.8) {
            bloques.push(bloqueActual);
            bloqueActual = [linea];
        } else {
            bloqueActual.push(linea);
        }
    }

    if (bloqueActual.length) {
        bloques.push(bloqueActual);
    }

    lineasFinales.forEach(linea => {
        const bloque = bloques.findIndex(grupo =>
            grupo.includes(linea)
        );

        linea.bloque = Math.max(0, bloque);
    });

    return {
        lineas: lineasFinales,
        bloques,
        alturaMediana,
        umbral: mejorResultado.umbral,
        polaridad: mejorResultado.polaridad
    };
}


/* =========================================================
   9. RECORTAR Y AMPLIAR UNA LÍNEA
   ========================================================= */

function recortarLinea(canvas, linea) {
    const x0 = Math.max(
        0,
        linea.x0 - MARGEN_RECORTE
    );

    const y0 = Math.max(
        0,
        linea.y0 - MARGEN_RECORTE
    );

    const x1 = Math.min(
        canvas.width,
        linea.x1 + MARGEN_RECORTE
    );

    const y1 = Math.min(
        canvas.height,
        linea.y1 + MARGEN_RECORTE
    );

    const ancho = Math.max(1, x1 - x0);
    const alto = Math.max(1, y1 - y0);

    const recorte = document.createElement("canvas");

    recorte.width = Math.max(
        1,
        Math.round(ancho * ESCALA_RECORTE)
    );

    recorte.height = Math.max(
        1,
        Math.round(alto * ESCALA_RECORTE)
    );

    const ctx = recorte.getContext("2d");

    // Fondo blanco para evitar recortes transparentes.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, recorte.width, recorte.height);

    ctx.drawImage(
        canvas,
        x0, y0, ancho, alto,
        0, 0, recorte.width, recorte.height
    );

    return recorte;
}


function prepararImagenCompleta(canvas) {
    const recorte = document.createElement("canvas");

    recorte.width = canvas.width;
    recorte.height = canvas.height;

    const ctx = recorte.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, recorte.width, recorte.height);

    ctx.drawImage(canvas, 0, 0);

    return recorte;
}


/* =========================================================
   10. DISTANCIA Y COINCIDENCIA
   ========================================================= */

function distanciaLevenshtein(a, b) {
    const matriz = [];

    for (let i = 0; i <= a.length; i++) {
        matriz[i] = [i];
    }

    for (let j = 0; j <= b.length; j++) {
        matriz[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const costo =
                a[i - 1] === b[j - 1] ? 0 : 1;

            matriz[i][j] = Math.min(
                matriz[i - 1][j] + 1,
                matriz[i][j - 1] + 1,
                matriz[i - 1][j - 1] + costo
            );
        }
    }

    return matriz[a.length][b.length];
}


function porcentajeCoincidencia(a, b) {
    if (!a.length && !b.length) return 100;

    const distancia = distanciaLevenshtein(a, b);

    const longitud = Math.max(a.length, b.length);

    if (!longitud) return 100;

    return Math.max(
        0,
        100 * (1 - distancia / longitud)
    );
}


/* =========================================================
   11. ALINEACIÓN DE CARACTERES
   ========================================================= */

function obtenerConsensoColumnas(columnas) {
    return columnas.map(columna => {
        const conteo = {};

        for (const caracter of columna) {
            if (caracter === null) continue;

            conteo[caracter] =
                (conteo[caracter] || 0) + 1;
        }

        let mejorCaracter = "";
        let mayorCantidad = 0;

        for (const caracter of columna) {
            if (caracter === null) continue;

            const cantidad = conteo[caracter] || 0;

            if (cantidad > mayorCantidad) {
                mayorCantidad = cantidad;
                mejorCaracter = caracter;
            }
        }

        return mejorCaracter;
    }).join("");
}


function alinearLectura(columnas, nuevoTexto, cantidadLecturas) {
    const textoActual = obtenerConsensoColumnas(columnas);

    const filas = textoActual.length + 1;
    const columnasDP = nuevoTexto.length + 1;

    const dp = Array.from(
        { length: filas },
        () => new Int32Array(columnasDP)
    );

    for (let i = 0; i < filas; i++) dp[i][0] = i;
    for (let j = 0; j < columnasDP; j++) dp[0][j] = j;

    for (let i = 1; i < filas; i++) {
        for (let j = 1; j < columnasDP; j++) {
            const costo =
                textoActual[i - 1] === nuevoTexto[j - 1]
                    ? 0
                    : 1;

            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + costo
            );
        }
    }

    const alineacion = [];

    let i = textoActual.length;
    let j = nuevoTexto.length;

    while (i > 0 || j > 0) {
        if (
            i > 0 &&
            j > 0 &&
            dp[i][j] ===
                dp[i - 1][j - 1] +
                (textoActual[i - 1] === nuevoTexto[j - 1] ? 0 : 1)
        ) {
            alineacion.push({
                existente: i - 1,
                nuevo: nuevoTexto[j - 1]
            });

            i--;
            j--;
        } else if (
            i > 0 &&
            dp[i][j] === dp[i - 1][j] + 1
        ) {
            alineacion.push({
                existente: i - 1,
                nuevo: null
            });

            i--;
        } else {
            alineacion.push({
                existente: null,
                nuevo: nuevoTexto[j - 1]
            });

            j--;
        }
    }

    alineacion.reverse();

    const nuevasColumnas = [];

    for (const paso of alineacion) {
        if (paso.existente !== null) {
            const columna = [
                ...columnas[paso.existente]
            ];

            columna.push(paso.nuevo);

            nuevasColumnas.push(columna);
        } else {
            const columna = new Array(
                cantidadLecturas
            ).fill(null);

            columna.push(paso.nuevo);

            nuevasColumnas.push(columna);
        }
    }

    return nuevasColumnas;
}


function construirConsenso(lecturas) {
    const validas = lecturas.filter(
        texto => texto && texto.trim()
    );

    if (!validas.length) return "";

    let columnas = Array.from(
        validas[0],
        caracter => [caracter]
    );

    let cantidadLecturas = 1;

    for (let i = 1; i < validas.length; i++) {
        columnas = alinearLectura(
            columnas,
            validas[i],
            cantidadLecturas
        );

        cantidadLecturas++;
    }

    return obtenerConsensoColumnas(columnas);
}


/* =========================================================
   12. PREPARAR TESSERACT
   ========================================================= */

async function prepararOCR() {
    if (workerOCR) return workerOCR;

    let idioma = "spa+eng";

    const selectorIdioma =
        document.getElementById("idioma");

    if (selectorIdioma && selectorIdioma.value) {
        idioma = selectorIdioma.value;
    }

    workerOCR = await Tesseract.createWorker(
        idioma,
        1,
        {
            logger: mensaje => {
                if (mensaje.status === "recognizing text") {
                    actualizarEstado(
                        "Reconociendo texto..."
                    );
                }
            }
        }
    );

    // ÚNICO MODO DE SEGMENTACIÓN UTILIZADO.
    await workerOCR.setParameters({
        tessedit_pageseg_mode: "7"
    });

    return workerOCR;
}


/* =========================================================
   13. RECONOCER UNA IMAGEN
   ========================================================= */

async function reconocerImagen(worker, canvas) {
    const respuesta = await worker.recognize(canvas);

    const datos = respuesta.data || {};

    return {
        texto: (datos.text || "").trim(),
        confianza: Number(datos.confidence || 0)
    };
}


/* =========================================================
   14. ANALIZAR UNA VARIANTE
   ========================================================= */

async function analizarVariante(
    worker,
    canvas,
    numeroVariante,
    progresoInicial,
    progresoTotal
) {
    const deteccion = detectarLineas(canvas);

    const lineas = deteccion.lineas || [];
    const bloques = deteccion.bloques || [];

    const resultadosLineas = [];

    let sumaConfianza = 0;
    let lineasReconocidas = 0;
    let lineasIntentadas = 0;

    let usoRespaldo = false;
    let motivoRespaldo = "";

    // Si no hay líneas, intentar con la imagen completa.
    if (lineas.length === 0) {
        usoRespaldo = true;
        motivoRespaldo =
            "El detector no encontró líneas. Se utilizó la imagen completa.";

        const imagenCompleta = prepararImagenCompleta(canvas);

        const lectura = await reconocerImagen(
            worker,
            imagenCompleta
        );

        lineasIntentadas = 1;

        if (lectura.texto) {
            lineasReconocidas = 1;
            sumaConfianza += lectura.confianza;
        }

        return {
            nombre: VARIANTES[numeroVariante - 1],
            texto: lectura.texto,
            lineas: [],
            bloques: [],
            confianza: lectura.confianza,
            lineasDetectadas: 0,
            lineasIntentadas,
            lineasReconocidas,
            usoRespaldo,
            motivoRespaldo,
            umbral: deteccion.umbral,
            polaridad: deteccion.polaridad
        };
    }

    // Reconocimiento individual de cada línea.
    for (let i = 0; i < lineas.length; i++) {
        const recorte = recortarLinea(
            canvas,
            lineas[i]
        );

        let lectura = {
            texto: "",
            confianza: 0
        };

        lineasIntentadas++;

        try {
            lectura = await reconocerImagen(
                worker,
                recorte
            );
        } catch (error) {
            console.error(
                "Error al reconocer línea:",
                error
            );
        }

        if (lectura.texto) {
            lineasReconocidas++;
            sumaConfianza += lectura.confianza;
        }

        resultadosLineas.push({
            ...lineas[i],
            texto: lectura.texto,
            confianza: lectura.confianza
        });

        const avance =
            progresoInicial +
            ((i + 1) / lineas.length) * progresoTotal;

        actualizarProgreso(avance);

        actualizarEstado(
            "Imagen " + numeroVariante +
            " de 5 | Línea " + (i + 1) +
            " de " + lineas.length
        );
    }

    // Si todas las líneas resultaron vacías,
    // intentar una vez con la imagen completa.
    let textoCompleto = resultadosLineas
        .map(linea => linea.texto)
        .filter(Boolean)
        .join("\n");

    if (!textoCompleto.trim()) {
        usoRespaldo = true;

        motivoRespaldo =
            "Las líneas fueron detectadas, pero ninguna produjo texto. " +
            "Se intentó reconocer la imagen completa.";

        const imagenCompleta = prepararImagenCompleta(canvas);

        const lecturaCompleta = await reconocerImagen(
            worker,
            imagenCompleta
        );

        lineasIntentadas++;

        if (lecturaCompleta.texto) {
            textoCompleto = lecturaCompleta.texto;
            lineasReconocidas++;
            sumaConfianza += lecturaCompleta.confianza;
        }
    }

    const confianzaMedia = lineasReconocidas
        ? sumaConfianza / lineasReconocidas
        : 0;

    return {
        nombre: VARIANTES[numeroVariante - 1],
        texto: textoCompleto,
        lineas: resultadosLineas,
        bloques,
        confianza: confianzaMedia,
        lineasDetectadas: lineas.length,
        lineasIntentadas,
        lineasReconocidas,
        usoRespaldo,
        motivoRespaldo,
        umbral: deteccion.umbral,
        polaridad: deteccion.polaridad
    };
}


/* =========================================================
   15. EMPAREJAR LÍNEAS ENTRE VARIANTES
   ========================================================= */

function buscarLineaCorrespondiente(
    lineas,
    centroY,
    tolerancia,
    utilizadas
) {
    let mejor = null;
    let menorDistancia = Infinity;
    let mejorIndice = -1;

    for (let i = 0; i < lineas.length; i++) {
        if (utilizadas.has(i)) continue;

        const distancia = Math.abs(
            lineas[i].centroY - centroY
        );

        if (
            distancia <= tolerancia &&
            distancia < menorDistancia
        ) {
            menorDistancia = distancia;
            mejor = lineas[i];
            mejorIndice = i;
        }
    }

    if (mejorIndice >= 0) {
        utilizadas.add(mejorIndice);
    }

    return mejor;
}


function crearTextoConsenso(resultados) {
    const original = resultados[0];

    if (!original || !original.lineas.length) {
        // Si hubo respaldo, comparar las lecturas completas.
        return construirConsenso(
            resultados.map(r => r.texto)
        );
    }

    const utilizadas = resultados.map(
        () => new Set()
    );

    const tolerancia = Math.max(
        15,
        (original.alturaMediana || 10) * 1.5
    );

    const lineasConsenso = [];

    for (let i = 0; i < original.lineas.length; i++) {
        const lineaBase = original.lineas[i];

        const lecturas = [];

        for (let v = 0; v < resultados.length; v++) {
            let lineaEncontrada;

            if (v === 0) {
                lineaEncontrada = lineaBase;
                utilizadas[v].add(i);
            } else {
                lineaEncontrada = buscarLineaCorrespondiente(
                    resultados[v].lineas,
                    lineaBase.centroY,
                    tolerancia,
                    utilizadas[v]
                );
            }

            if (lineaEncontrada) {
                lecturas.push(
                    (lineaEncontrada.texto || "").trim()
                );
            }
        }

        lineasConsenso.push(
            construirConsenso(lecturas)
        );
    }

    let salida = "";
    let bloqueAnterior = null;

    for (let i = 0; i < original.lineas.length; i++) {
        const bloqueActual =
            original.lineas[i].bloque;

        if (
            bloqueAnterior !== null &&
            bloqueActual !== bloqueAnterior
        ) {
            salida += "\n";
        }

        salida += lineasConsenso[i] + "\n";

        bloqueAnterior = bloqueActual;
    }

    return salida.trim();
}


/* =========================================================
   16. ESTADÍSTICAS
   ========================================================= */

function contarPalabras(texto) {
    const palabras = texto.match(/\S+/g);
    return palabras ? palabras.length : 0;
}

function contarCaracteres(texto) {
    return texto.replace(/\s/g, "").length;
}

function calcularCoincidenciaGeneral(resultados, consenso) {
    if (!consenso) return 0;

    let suma = 0;
    let cantidad = 0;

    for (const lectura of resultados) {
        if (!lectura.texto.trim()) continue;

        suma += porcentajeCoincidencia(
            lectura.texto,
            consenso
        );

        cantidad++;
    }

    return cantidad ? suma / cantidad : 0;
}

function actualizarEstadisticas(resultados, consenso) {
    const original = resultados[0];

    if (totalBloques) {
        totalBloques.textContent =
            original ? original.bloques.length : "0";
    }

    if (totalLineas) {
        totalLineas.textContent =
            original ? original.lineasDetectadas : "0";
    }

    if (totalPalabras) {
        totalPalabras.textContent =
            contarPalabras(consenso);
    }

    if (totalCaracteres) {
        totalCaracteres.textContent =
            contarCaracteres(consenso);
    }

    if (confianza) {
        confianza.textContent =
            original
                ? original.confianza.toFixed(1) + "%"
                : "0%";
    }

    if (coincidencia) {
        coincidencia.textContent =
            calcularCoincidenciaGeneral(
                resultados,
                consenso
            ).toFixed(1) + "%";
    }
}


/* =========================================================
   17. MOSTRAR RESULTADOS Y DIAGNÓSTICO
   ========================================================= */

function mostrarResultados(resultados, consenso) {
    let salida = "";

    for (let i = 0; i < resultados.length; i++) {
        const lectura = resultados[i];

        salida +=
            "========================================\n";

        salida +=
            "LECTURA " + (i + 1) + ": " +
            lectura.nombre + "\n";

        salida +=
            "Confianza media: " +
            lectura.confianza.toFixed(1) + "%\n";

        salida +=
            "Bloques detectados: " +
            lectura.bloques.length + "\n";

        salida +=
            "Líneas detectadas: " +
            lectura.lineasDetectadas + "\n";

        salida +=
            "Intentos de OCR: " +
            lectura.lineasIntentadas + "\n";

        salida +=
            "Intentos con texto: " +
            lectura.lineasReconocidas + "\n";

        salida +=
            "Umbral utilizado: " +
            lectura.umbral + "\n";

        salida +=
            "Polaridad: " +
            lectura.polaridad + "\n";

        salida +=
            "Respaldo imagen completa: " +
            (lectura.usoRespaldo ? "SÍ" : "NO") + "\n";

        if (lectura.motivoRespaldo) {
            salida +=
                "Motivo: " +
                lectura.motivoRespaldo + "\n";
        }

        salida +=
            "========================================\n\n";

        salida +=
            lectura.texto || "[Sin texto reconocido]";

        salida += "\n\n";
    }

    salida +=
        "========================================\n";

    salida +=
        "RESULTADO FINAL: CONSENSO DE CARACTERES\n";

    salida +=
        "========================================\n\n";

    salida +=
        consenso || "[No fue posible construir un consenso]";

    salida += "\n\n";

    salida +=
        "NOTA: El consenso alinea las lecturas y compara caracteres. " +
        "No corrige palabras ni interpreta el contenido.";

    resultado.value = salida;
}


/* =========================================================
   18. PROCESO PRINCIPAL
   ========================================================= */

async function analizarDocumento() {
    if (!imagenCargada || procesando) return;

    procesando = true;

    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;

    resultado.value = "";

    actualizarProgreso(0);
    actualizarEstado("Preparando análisis...");

    if (estadoResultado) {
        estadoResultado.textContent = "Procesando";
    }

    if (resumen) {
        resumen.textContent =
            "Analizando cinco versiones de la imagen.";
    }

    limpiarEstadisticas();

    try {
        const original = limitarImagen(imagenCargada);

        actualizarEstado(
            "Preparando las cinco versiones..."
        );

        actualizarProgreso(3);

        const variantes = crearVariantes(original);

        const worker = await prepararOCR();

        const resultados = [];

        const progresoPorVariante = 19;

        for (let i = 0; i < variantes.length; i++) {
            actualizarEstado(
                "Analizando imagen " + (i + 1) +
                " de 5: " + VARIANTES[i]
            );

            const resultadoVariante = await analizarVariante(
                worker,
                variantes[i],
                i + 1,
                5 + (i * progresoPorVariante),
                progresoPorVariante
            );

            resultados.push(resultadoVariante);
        }

        actualizarEstado(
            "Comparando caracteres..."
        );

        actualizarProgreso(97);

        // Construir consenso.
        const consenso = crearTextoConsenso(resultados);

        // Guardar altura mediana para emparejamiento.
        resultados[0].alturaMediana =
            resultados[0].alturaMediana || 10;

        mostrarResultados(
            resultados,
            consenso
        );

        actualizarEstadisticas(
            resultados,
            consenso
        );

        actualizarProgreso(100);

        actualizarEstado("Análisis terminado.");

        if (estadoResultado) {
            estadoResultado.textContent = "Completado";
        }

        if (resumen) {
            resumen.textContent =
                "Cinco lecturas procesadas y comparadas.";
        }

        btnCopiar.disabled =
            resultado.value.trim().length === 0;

    } catch (error) {
        console.error(
            "Error general del OCR:",
            error
        );

        actualizarEstado(
            "Ocurrió un error durante el análisis."
        );

        if (estadoResultado) {
            estadoResultado.textContent = "Error";
        }

        if (resumen) {
            resumen.textContent =
                error.message || "No se pudo completar el análisis.";
        }

        resultado.value =
            "ERROR DURANTE EL ANÁLISIS\n\n" +
            (error.message || error);

        btnCopiar.disabled = false;

    } finally {
        procesando = false;
        btnAnalizar.disabled = !imagenCargada;
    }
}


/* =========================================================
   19. CARGAR IMAGEN
   ========================================================= */

inputImagen.addEventListener("change", function () {
    const archivo = this.files && this.files[0];

    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
        actualizarEstado(
            "Selecciona un archivo de imagen válido."
        );

        return;
    }

    const lector = new FileReader();

    lector.onload = function (evento) {
        const imagen = new Image();

        imagen.onload = function () {
            imagenCargada = imagen;

            vistaPrevia.src = evento.target.result;

            if (contenedorVista) {
                contenedorVista.style.display = "block";
            }

            if (nombreArchivo) {
                nombreArchivo.textContent = archivo.name;
            }

            resultado.value = "";

            limpiarEstadisticas();

            btnAnalizar.disabled = false;
            btnCopiar.disabled = true;

            actualizarProgreso(0);

            actualizarEstado(
                "Imagen cargada correctamente."
            );

            if (estadoResultado) {
                estadoResultado.textContent = "Imagen lista";
            }

            if (resumen) {
                resumen.textContent =
                    "La imagen está lista para analizarse.";
            }
        };

        imagen.onerror = function () {
            actualizarEstado(
                "No se pudo cargar la imagen."
            );
        };

        imagen.src = evento.target.result;
    };

    lector.readAsDataURL(archivo);
});


/* =========================================================
   20. BOTÓN ANALIZAR
   ========================================================= */

btnAnalizar.addEventListener(
    "click",
    analizarDocumento
);


/* =========================================================
   21. BOTÓN COPIAR
   ========================================================= */

btnCopiar.addEventListener("click", async function () {
    const texto = resultado.value;

    if (!texto.trim()) return;

    try {
        await navigator.clipboard.writeText(texto);

        actualizarEstado(
            "Texto copiado correctamente."
        );

    } catch (error) {
        resultado.focus();
        resultado.select();

        const copiado =
            document.execCommand("copy");

        actualizarEstado(
            copiado
                ? "Texto copiado correctamente."
                : "No se pudo copiar automáticamente."
        );
    }
});


/* =========================================================
   22. BOTÓN LIMPIAR
   ========================================================= */

btnLimpiar.addEventListener("click", function () {
    if (procesando) return;

    inputImagen.value = "";
    imagenCargada = null;

    vistaPrevia.src = "";

    if (contenedorVista) {
        contenedorVista.style.display = "none";
    }

    if (nombreArchivo) {
        nombreArchivo.textContent = "";
    }

    resultado.value = "";

    limpiarEstadisticas();

    actualizarProgreso(0);

    actualizarEstado(
        "Selecciona una imagen para comenzar."
    );

    if (estadoResultado) {
        estadoResultado.textContent = "Sin análisis";
    }

    if (resumen) {
        resumen.textContent = "";
    }

    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;
});


/* =========================================================
   23. ESTADO INICIAL
   ========================================================= */

btnAnalizar.disabled = true;
btnCopiar.disabled = true;

limpiarEstadisticas();

actualizarEstado(
    "Selecciona una imagen para comenzar."
);
