/* =========================================================
   SINDICATO ENIGMA
   LABORATORIO DE DOCUMENTOS OCR
   RESTAURACIÓN DE CUATRO PASADAS
   PSM 6 - PSM 7 - PSM 8 - PSM 10
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

const MAX_DIMENSION = 2600;
const MARGEN = 12;
const ESCALA_RECORTE = 2.5;
const MAX_CARACTERES_OCR = 300;

let imagenCargada = null;
let workerOCR = null;
let idiomaWorker = null;
let procesando = false;

let estadisticasActuales = {
    bloques: 0,
    lineas: 0,
    palabras: 0,
    caracteres: 0
};


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

function actualizarResumen(mensaje) {
    if (resumen) resumen.textContent = mensaje;
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
        0.299 * r + 0.587 * g + 0.114 * b
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

function crearCanvas(ancho, alto) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(ancho));
    canvas.height = Math.max(1, Math.round(alto));
    return canvas;
}


/* =========================================================
   4. PREPARAR IMAGEN DE TRABAJO
   ========================================================= */

function prepararImagenOriginal(imagen) {
    const canvas = limitarImagen(imagen);

    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const datos = ctx.getImageData(
        0, 0, canvas.width, canvas.height
    );

    const pixeles = datos.data;

    // Convertir a escala de grises sin binarizar.
    for (let i = 0; i < pixeles.length; i += 4) {
        const gris = obtenerGris(
            pixeles[i],
            pixeles[i + 1],
            pixeles[i + 2]
        );

        pixeles[i] = gris;
        pixeles[i + 1] = gris;
        pixeles[i + 2] = gris;
    }

    ctx.putImageData(datos, 0, 0);

    return canvas;
}


/* =========================================================
   5. UMBRAL DE OTSU
   ========================================================= */

function calcularUmbral(datos) {
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
    let umbral = 127;

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
            umbral = t;
        }
    }

    return umbral;
}


/* =========================================================
   6. OBTENER MÁSCARA BINARIA
   ========================================================= */

function obtenerMascara(canvas) {
    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const ancho = canvas.width;
    const alto = canvas.height;

    const imagen = ctx.getImageData(0, 0, ancho, alto);
    const datos = imagen.data;

    const umbral = calcularUmbral(datos);

    // Estimar el color del fondo usando las esquinas.
    const esquinas = [
        0,
        (ancho - 1) * 4,
        ((alto - 1) * ancho) * 4,
        ((alto - 1) * ancho + ancho - 1) * 4
    ];

    let sumaEsquinas = 0;

    for (const p of esquinas) {
        sumaEsquinas += obtenerGris(
            datos[p],
            datos[p + 1],
            datos[p + 2]
        );
    }

    const mediaEsquinas =
        sumaEsquinas / esquinas.length;

    const textoOscuro = mediaEsquinas > umbral;

    const mascara = new Uint8Array(ancho * alto);

    for (let i = 0; i < mascara.length; i++) {
        const p = i * 4;

        const gris = obtenerGris(
            datos[p],
            datos[p + 1],
            datos[p + 2]
        );

        mascara[i] = textoOscuro
            ? (gris < umbral ? 1 : 0)
            : (gris > umbral ? 1 : 0);
    }

    return {
        mascara,
        umbral,
        textoOscuro
    };
}


/* =========================================================
   7. PROYECCIÓN HORIZONTAL Y AGRUPACIÓN DE FILAS
   ========================================================= */

function proyectarFilas(mascara, ancho, alto) {
    const proyeccion = new Array(alto).fill(0);

    for (let y = 0; y < alto; y++) {
        let cantidad = 0;

        for (let x = 0; x < ancho; x++) {
            cantidad += mascara[y * ancho + x];
        }

        proyeccion[y] = cantidad;
    }

    return proyeccion;
}


function agruparFilas(proyeccion, ancho, alto) {

    const maximo = Math.max(...proyeccion);

    if (maximo <= 0) return [];

    // Umbral dinámico para separar líneas
    // del ruido de fondo.
    const minimoPixeles = Math.max(
        6,
        Math.floor(maximo * 0.06)
    );

    const filasActivas = new Array(alto).fill(false);

    for (let y = 0; y < alto; y++) {
        filasActivas[y] =
            proyeccion[y] >= minimoPixeles;
    }

    const grupos = [];

    let inicio = null;
    let ultimaActiva = null;

    const toleranciaHueco = Math.max(
        2,
        Math.min(5, Math.round(alto * 0.0015))
    );

    for (let y = 0; y < alto; y++) {

        if (filasActivas[y]) {

            if (inicio === null) {
                inicio = y;
            }

            ultimaActiva = y;

        } else if (
            inicio !== null &&
            y - ultimaActiva > toleranciaHueco
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
   8. DETECTAR BLOQUES
   ========================================================= */

function detectarBloques(canvas, mascara) {
    const ancho = canvas.width;
    const alto = canvas.height;

    const proyeccion = proyectarFilas(
        mascara, ancho, alto
    );

    const bandas = agruparFilas(
        proyeccion, ancho, alto
    );

    if (!bandas.length) return [];

    const alturas = bandas.map(
        banda => banda.y1 - banda.y0
    );

    const ordenadas = [...alturas].sort((a, b) => a - b);

    const alturaMediana =
        ordenadas[Math.floor(ordenadas.length / 2)] || 10;

    const separacionBloque = Math.max(
        alturaMediana * 1.8,
        alturaMediana + 8
    );

    const bloques = [];
    let actual = [];

    for (const banda of bandas) {
        if (!actual.length) {
            actual.push(banda);
            continue;
        }

        const anterior = actual[actual.length - 1];
        const espacio = banda.y0 - anterior.y1;

        if (espacio > separacionBloque) {
            bloques.push(actual);
            actual = [banda];
        } else {
            actual.push(banda);
        }
    }

    if (actual.length) bloques.push(actual);

    return bloques.map((lineas, indice) => {
        return {
            indice,
            x0: 0,
            x1: ancho,
            y0: lineas[0].y0,
            y1: lineas[lineas.length - 1].y1,
            lineas
        };
    });
}


/* =========================================================
   9. DETECTAR LÍNEAS DENTRO DE CADA BLOQUE
   ========================================================= */

function detectarLineas(canvas, mascara, bloques) {
    const ancho = canvas.width;

    const lineasFinales = [];

    for (let b = 0; b < bloques.length; b++) {
        const bloque = bloques[b];

        const lineas = bloque.lineas || [];

        for (const banda of lineas) {
            let x0 = ancho;
            let x1 = -1;

            for (let y = banda.y0; y < banda.y1; y++) {
                for (let x = 0; x < ancho; x++) {
                    if (mascara[y * ancho + x]) {
                        x0 = Math.min(x0, x);
                        x1 = Math.max(x1, x);
                    }
                }
            }

            if (x1 < x0) continue;

            lineasFinales.push({
                x0,
                x1: x1 + 1,
                y0: banda.y0,
                y1: banda.y1,
                centroY: (banda.y0 + banda.y1) / 2,
                bloque: b
            });
        }
    }

    return lineasFinales;
}


/* =========================================================
   10. DETECTAR PALABRAS DENTRO DE UNA LÍNEA
   ========================================================= */

function detectarPalabras(mascara, ancho, linea) {
    const xInicio = linea.x0;
    const xFinal = linea.x1;

    const yInicio = linea.y0;
    const yFinal = linea.y1;

    const altoLinea = yFinal - yInicio;

    const proyeccion = new Array(
        xFinal - xInicio
    ).fill(0);

    for (let x = xInicio; x < xFinal; x++) {
        let cantidad = 0;

        for (let y = yInicio; y < yFinal; y++) {
            cantidad += mascara[y * ancho + x];
        }

        proyeccion[x - xInicio] = cantidad;
    }

    const minimoColumna = Math.max(
        1,
        Math.floor(altoLinea * 0.04)
    );

    const columnasActivas = proyeccion.map(
        cantidad => cantidad >= minimoColumna
    );

    const grupos = [];

    let inicio = null;
    let final = null;

    for (let x = 0; x < columnasActivas.length; x++) {
        if (columnasActivas[x]) {
            if (inicio === null) inicio = x;
            final = x;
        } else if (inicio !== null) {
            grupos.push({
                x0: inicio + xInicio,
                x1: final + 1 + xInicio
            });

            inicio = null;
            final = null;
        }
    }

    if (inicio !== null) {
        grupos.push({
            x0: inicio + xInicio,
            x1: final + 1 + xInicio
        });
    }

    if (!grupos.length) return [];

    // Separación entre palabras proporcional a la altura.
    const separacionPalabra = Math.max(
        3,
        altoLinea * 0.22
    );

    const palabras = [];
    let palabraActual = {
        x0: grupos[0].x0,
        x1: grupos[0].x1
    };

    for (let i = 1; i < grupos.length; i++) {
        const anterior = grupos[i - 1];
        const actual = grupos[i];

        const espacio = actual.x0 - anterior.x1;

        if (espacio > separacionPalabra) {
            palabras.push(palabraActual);

            palabraActual = {
                x0: actual.x0,
                x1: actual.x1
            };
        } else {
            palabraActual.x1 = actual.x1;
        }
    }

    palabras.push(palabraActual);

    return palabras.map(palabra => ({
        ...palabra,
        y0: yInicio,
        y1: yFinal,
        centroY: linea.centroY,
        bloque: linea.bloque
    }));
}


/* =========================================================
   11. DETECTAR CARACTERES DENTRO DE UNA PALABRA
   ========================================================= */

function detectarCaracteres(mascara, ancho, palabra) {
    const x0 = palabra.x0;
    const x1 = palabra.x1;
    const y0 = palabra.y0;
    const y1 = palabra.y1;

    const alto = y1 - y0;
    const anchoPalabra = x1 - x0;

    const proyeccion = new Array(anchoPalabra).fill(0);

    for (let x = x0; x < x1; x++) {
        let cantidad = 0;

        for (let y = y0; y < y1; y++) {
            cantidad += mascara[y * ancho + x];
        }

        proyeccion[x - x0] = cantidad;
    }

    const minimoColumna = Math.max(
        1,
        Math.floor(alto * 0.04)
    );

    const grupos = [];

    let inicio = null;
    let final = null;

    for (let x = 0; x < anchoPalabra; x++) {
        if (proyeccion[x] >= minimoColumna) {
            if (inicio === null) inicio = x;
            final = x;
        } else if (inicio !== null) {
            grupos.push({
                x0: inicio + x0,
                x1: final + 1 + x0
            });

            inicio = null;
            final = null;
        }
    }

    if (inicio !== null) {
        grupos.push({
            x0: inicio + x0,
            x1: final + 1 + x0
        });
    }

    // Si un grupo es excepcionalmente ancho, intentar
    // dividirlo por sus valles verticales.
    const caracteres = [];

    for (const grupo of grupos) {
        const anchoGrupo = grupo.x1 - grupo.x0;

        if (anchoGrupo > alto * 1.25) {
            const partes = dividirGrupoAncho(
                proyeccion,
                grupo.x0 - x0,
                grupo.x1 - x0,
                x0,
                alto
            );

            caracteres.push(...partes);
        } else {
            caracteres.push(grupo);
        }
    }

    return caracteres.map(caracter => ({
        ...caracter,
        y0,
        y1,
        centroY: palabra.centroY,
        bloque: palabra.bloque
    }));
}

function dividirGrupoAncho(
    proyeccion,
    inicio,
    final,
    desplazamiento,
    alto
) {
    const anchoGrupo = final - inicio;

    const anchoMaximo = alto * 1.05;

    if (anchoGrupo <= anchoMaximo * 1.5) {
        return [{
            x0: inicio + desplazamiento,
            x1: final + desplazamiento
        }];
    }

    const cortes = [];

    let cursor = inicio;

    while (final - cursor > anchoMaximo * 1.5) {
        const limite = Math.min(
            final - 1,
            Math.round(cursor + anchoMaximo)
        );

        let mejorCorte = -1;
        let menorOcupacion = Infinity;

        const rangoBusqueda = Math.max(
            2,
            Math.floor(alto * 0.18)
        );

        for (
            let x = Math.max(cursor + 2, limite - rangoBusqueda);
            x <= Math.min(final - 2, limite + rangoBusqueda);
            x++
        ) {
            const ocupacion = proyeccion[x] || 0;

            if (ocupacion < menorOcupacion) {
                menorOcupacion = ocupacion;
                mejorCorte = x;
            }
        }

        if (mejorCorte <= cursor) break;

        cortes.push({
            x0: cursor + desplazamiento,
            x1: mejorCorte + desplazamiento
        });

        cursor = mejorCorte + 1;
    }

    if (final > cursor) {
        cortes.push({
            x0: cursor + desplazamiento,
            x1: final + desplazamiento
        });
    }

    return cortes.length ? cortes : [{
        x0: inicio + desplazamiento,
        x1: final + desplazamiento
    }];
}


/* =========================================================
   12. CREAR RECORTES
   ========================================================= */

function crearRecorte(canvas, region, escala = ESCALA_RECORTE) {
    const x0 = Math.max(0, region.x0 - MARGEN);
    const y0 = Math.max(0, region.y0 - MARGEN);

    const x1 = Math.min(
        canvas.width,
        region.x1 + MARGEN
    );

    const y1 = Math.min(
        canvas.height,
        region.y1 + MARGEN
    );

    const ancho = Math.max(1, x1 - x0);
    const alto = Math.max(1, y1 - y0);

    const salida = document.createElement("canvas");

    salida.width = Math.max(
        1,
        Math.round(ancho * escala)
    );

    salida.height = Math.max(
        100,
        Math.round(alto * escala)
    );

    const ctx = salida.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, salida.width, salida.height);

    const alturaReal = Math.round(alto * escala);

    const desplazamientoY = Math.max(
        0,
        Math.floor((salida.height - alturaReal) / 2)
    );

    ctx.drawImage(
        canvas,
        x0, y0, ancho, alto,
        0, desplazamientoY,
        salida.width, alturaReal
    );

    return salida;
}


/* =========================================================
   13. PREPARAR TESSERACT
   ========================================================= */

async function obtenerWorker() {
    let idioma = "spa+eng";

    const selector = document.getElementById("idioma");

    if (selector && selector.value) {
        idioma = selector.value;
    }

    if (workerOCR && idiomaWorker === idioma) {
        return workerOCR;
    }

    if (workerOCR) {
        await workerOCR.terminate();
        workerOCR = null;
    }

    actualizarEstado(
        "Cargando motor OCR..."
    );

    workerOCR = await Tesseract.createWorker(
        idioma,
        1,
        {
            logger: mensaje => {
                if (
                    mensaje.status === "recognizing text" &&
                    typeof mensaje.progress === "number"
                ) {
                    actualizarEstado(
                        "Reconociendo texto..."
                    );
                }
            }
        }
    );

    idiomaWorker = idioma;

    return workerOCR;
}


/* =========================================================
   14. RECONOCER UNA REGIÓN CON UN PSM DETERMINADO
   ========================================================= */

async function reconocerRegion(worker, canvas, psm) {
    await worker.setParameters({
        tessedit_pageseg_mode: String(psm)
    });

    const respuesta = await worker.recognize(canvas);

    const datos = respuesta.data || {};

    return {
        texto: (datos.text || "").trim(),
        confianza: Number(datos.confidence || 0)
    };
}


/* =========================================================
   15. PASADA 1: BLOQUES CON PSM 6
   ========================================================= */

async function reconocerBloques(
    worker,
    canvas,
    bloques,
    progreso
) {
    const lecturas = [];

    let sumaConfianza = 0;
    let reconocidos = 0;

    for (let i = 0; i < bloques.length; i++) {
        const bloque = bloques[i];

        const recorte = crearRecorte(
            canvas,
            bloque,
            1.5
        );

        const lectura = await reconocerRegion(
            worker,
            recorte,
            6
        );

        lecturas.push(lectura.texto);

        if (lectura.texto) {
            sumaConfianza += lectura.confianza;
            reconocidos++;
        }

        actualizarProgreso(
            progreso.inicio +
            ((i + 1) / bloques.length) * progreso.rango
        );
    }

    return {
        texto: lecturas.join("\n\n"),
        confianza: reconocidos
            ? sumaConfianza / reconocidos
            : 0,
        intentos: bloques.length,
        reconocidos
    };
}


/* =========================================================
   16. PASADA 2: LÍNEAS CON PSM 7
   ========================================================= */


/* =========================================================
   16. PASADA 2: LÍNEAS CON PSM 7 Y PSM 13
   ========================================================= */

async function reconocerLineas(
    worker,
    canvas,
    lineas,
    progreso
) {
    const lecturas = [];

    let sumaConfianza = 0;
    let reconocidos = 0;

    for (let i = 0; i < lineas.length; i++) {

        // Recorte ligeramente ampliado para conservar
        // mejor los bordes superiores e inferiores.
        const recorte = crearRecorte(
            canvas,
            lineas[i],
            3
        );

        // Primer intento: PSM 7.
        const lectura7 = await reconocerRegion(
            worker,
            recorte,
            7
        );

        // Segundo intento: PSM 13.
        const lectura13 = await reconocerRegion(
            worker,
            recorte,
            13
        );

        let mejorLectura;

        // Si una lectura está vacía, elegir la otra.
        if (!lectura7.texto && lectura13.texto) {
            mejorLectura = lectura13;

        } else if (!lectura13.texto && lectura7.texto) {
            mejorLectura = lectura7;

        } else if (!lectura7.texto && !lectura13.texto) {
            mejorLectura = {
                texto: "",
                confianza: 0
            };

        } else {
            // Si ambas contienen texto, elegir la de
            // mayor confianza. En empate, conservar PSM 7.
            mejorLectura =
                lectura13.confianza > lectura7.confianza
                    ? lectura13
                    : lectura7;
        }

        lecturas.push(mejorLectura.texto);

        if (mejorLectura.texto) {
            sumaConfianza += mejorLectura.confianza;
            reconocidos++;
        }

        actualizarProgreso(
            progreso.inicio +
            ((i + 1) / lineas.length) * progreso.rango
        );
    }

    return {
        texto: lecturas.join("\n"),
        confianza: reconocidos
            ? sumaConfianza / reconocidos
            : 0,
        intentos: lineas.length * 2,
        reconocidos,
        lineasProcesadas: lineas.length
    };
}



/* =========================================================
   17. PASADA 3: PALABRAS CON PSM 8
   ========================================================= */

async function reconocerPalabras(
    worker,
    canvas,
    mascara,
    lineas,
    progreso
) {
    const palabras = [];

    for (const linea of lineas) {
        const encontradas = detectarPalabras(
            mascara,
            canvas.width,
            linea
        );

        palabras.push(...encontradas);
    }

    const lecturas = [];

    let sumaConfianza = 0;
    let reconocidos = 0;

    for (let i = 0; i < palabras.length; i++) {
        const recorte = crearRecorte(
            canvas,
            palabras[i],
            3
        );

        const lectura = await reconocerRegion(
            worker,
            recorte,
            8
        );

        lecturas.push(lectura.texto);

        if (lectura.texto) {
            sumaConfianza += lectura.confianza;
            reconocidos++;
        }

        actualizarProgreso(
            progreso.inicio +
            ((i + 1) / Math.max(1, palabras.length)) *
            progreso.rango
        );
    }

    // Reconstruir palabras por línea, respetando orden vertical.
    const textoPorLinea = [];

    for (const linea of lineas) {
        const palabrasLinea = palabras.filter(
            palabra => palabra.bloque === linea.bloque &&
            Math.abs(palabra.centroY - linea.centroY) < 2
        );

        const indices = palabrasLinea.map(palabra =>
            palabras.indexOf(palabra)
        );

        const texto = indices
            .map(indice => lecturas[indice] || "")
            .filter(Boolean)
            .join(" ");

        textoPorLinea.push(texto);
    }

    return {
        texto: textoPorLinea.join("\n"),
        confianza: reconocidos
            ? sumaConfianza / reconocidos
            : 0,
        intentos: palabras.length,
        reconocidos,
        cantidad: palabras.length
    };
}


/* =========================================================
   18. PASADA 4: CARACTERES CON PSM 10
   ========================================================= */

async function reconocerCaracteres(
    worker,
    canvas,
    mascara,
    palabras,
    progreso
) {
    const caracteres = [];

    for (const palabra of palabras) {
        const encontrados = detectarCaracteres(
            mascara,
            canvas.width,
            palabra
        );

        caracteres.push(...encontrados);
    }

    // Límite de seguridad para el navegador.
    const caracteresProcesados = caracteres.slice(
        0,
        MAX_CARACTERES_OCR
    );

    const lecturas = [];

    let sumaConfianza = 0;
    let reconocidos = 0;

    for (
        let i = 0;
        i < caracteresProcesados.length;
        i++
    ) {
        const recorte = crearRecorte(
            canvas,
            caracteresProcesados[i],
            4
        );

        const lectura = await reconocerRegion(
            worker,
            recorte,
            10
        );

        lecturas.push(lectura.texto);

        if (lectura.texto) {
            sumaConfianza += lectura.confianza;
            reconocidos++;
        }

        actualizarProgreso(
            progreso.inicio +
            ((i + 1) /
                Math.max(1, caracteresProcesados.length)) *
            progreso.rango
        );
    }

    return {
        texto: lecturas.join(""),
        confianza: reconocidos
            ? sumaConfianza / reconocidos
            : 0,
        intentos: caracteresProcesados.length,
        reconocidos,
        cantidadDetectada: caracteres.length,
        limiteAplicado:
            caracteres.length > MAX_CARACTERES_OCR
    };
}


/* =========================================================
   19. COMPARAR LECTURAS
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

function calcularCoincidencia(a, b) {
    if (!a.length && !b.length) return 100;

    const longitud = Math.max(a.length, b.length);

    if (!longitud) return 100;

    const distancia = distanciaLevenshtein(a, b);

    return Math.max(
        0,
        (1 - distancia / longitud) * 100
    );
}


/* =========================================================
   20. COMPARACIÓN DE LAS CUATRO LECTURAS
   ========================================================= */

function crearComparacion(lecturas) {
    const validas = lecturas.filter(
        lectura => lectura && lectura.trim()
    );

    if (!validas.length) {
        return {
            texto: "",
            coincidencia: 0
        };
    }

    // Se utiliza como referencia la lectura más extensa.
    // Las demás se comparan contra ella.
    const referencia = validas.reduce(
        (mejor, actual) =>
            actual.length > mejor.length ? actual : mejor
    );

    const porcentajes = validas.map(texto =>
        calcularCoincidencia(referencia, texto)
    );

    const promedio = porcentajes.reduce(
        (suma, valor) => suma + valor,
        0
    ) / porcentajes.length;

    return {
        texto: referencia,
        coincidencia: promedio
    };
}


/* =========================================================
   21. MOSTRAR LAS CUATRO LECTURAS
   ========================================================= */

function mostrarResultados(
    bloque,
    linea,
    palabra,
    caracter,
    comparacion
) {
    let salida = "";

    salida += "========================================\n";
    salida += "LECTURA 1: BLOQUES - PSM 6\n";
    salida += "Confianza: " + bloque.confianza.toFixed(1) + "%\n";
    salida += "Intentos: " + bloque.intentos + "\n";
    salida += "Con texto: " + bloque.reconocidos + "\n";
    salida += "========================================\n\n";
    salida += bloque.texto || "[Sin texto reconocido]";
    salida += "\n\n";

    salida += "========================================\n";
    salida += "LECTURA 2: LÍNEAS - PSM 7\n";
    salida += "Confianza: " + linea.confianza.toFixed(1) + "%\n";
    salida += "Intentos: " + linea.intentos + "\n";
    salida += "Con texto: " + linea.reconocidos + "\n";
    salida += "========================================\n\n";
    salida += linea.texto || "[Sin texto reconocido]";
    salida += "\n\n";

    salida += "========================================\n";
    salida += "LECTURA 3: PALABRAS - PSM 8\n";
    salida += "Confianza: " + palabra.confianza.toFixed(1) + "%\n";
    salida += "Palabras detectadas: " + palabra.cantidad + "\n";
    salida += "Intentos: " + palabra.intentos + "\n";
    salida += "Con texto: " + palabra.reconocidos + "\n";
    salida += "========================================\n\n";
    salida += palabra.texto || "[Sin texto reconocido]";
    salida += "\n\n";

    salida += "========================================\n";
    salida += "LECTURA 4: CARACTERES - PSM 10\n";
    salida += "Caracteres detectados: " +
        caracter.cantidadDetectada + "\n";
    salida += "Caracteres procesados: " +
        caracter.intentos + "\n";
    salida += "Confianza: " +
        caracter.confianza.toFixed(1) + "%\n";
    salida += "Con texto: " +
        caracter.reconocidos + "\n";

    if (caracter.limiteAplicado) {
        salida +=
            "AVISO: Se aplicó el límite de 300 caracteres.\n";
    }

    salida += "========================================\n\n";
    salida += caracter.texto || "[Sin texto reconocido]";
    salida += "\n\n";

    salida += "========================================\n";
    salida += "COMPARACIÓN DE LECTURAS\n";
    salida += "========================================\n\n";

    salida +=
        "Coincidencia media con la lectura de referencia: " +
        comparacion.coincidencia.toFixed(1) + "%\n\n";

    salida +=
        "Lectura de referencia (la más extensa):\n\n";

    salida +=
        comparacion.texto || "[No hay texto para comparar]";

    resultado.value = salida;
}


/* =========================================================
   22. PROCESO PRINCIPAL
   ========================================================= */

async function analizarDocumento() {
    if (!imagenCargada || procesando) return;

    procesando = true;

    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;

    resultado.value = "";

    actualizarProgreso(0);
    actualizarEstado("Preparando imagen...");
    actualizarResumen("Iniciando las cuatro pasadas OCR.");

    if (estadoResultado) {
        estadoResultado.textContent = "Procesando";
    }

    limpiarEstadisticas();

    try {
        const canvas = prepararImagenOriginal(
            imagenCargada
        );

        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });

        const datos = ctx.getImageData(
            0, 0, canvas.width, canvas.height
        );

        actualizarProgreso(3);

        actualizarEstado(
            "Preparando máscara para detectar bloques..."
        );

        const mascaraDatos = obtenerMascara(canvas);
        const mascara = mascaraDatos.mascara;

        // Primero se detectan los bloques.
        const bloques = detectarBloques(
            canvas,
            mascara
        );

        // Después se detectan las líneas dentro de esos bloques.
        const lineas = detectarLineas(
            canvas,
            mascara,
            bloques
        );

        // Después las palabras dentro de las líneas.
        const palabras = [];

        for (const linea of lineas) {
            const encontradas = detectarPalabras(
                mascara,
                canvas.width,
                linea
            );

            palabras.push(...encontradas);
        }

        estadisticasActuales = {
            bloques: bloques.length,
            lineas: lineas.length,
            palabras: palabras.length,
            caracteres: 0
        };

        if (totalBloques) {
            totalBloques.textContent = bloques.length;
        }

        if (totalLineas) {
            totalLineas.textContent = lineas.length;
        }

        if (totalPalabras) {
            totalPalabras.textContent = palabras.length;
        }

        actualizarEstado(
            "Bloques: " + bloques.length +
            " | Líneas: " + lineas.length +
            " | Palabras: " + palabras.length
        );

        const worker = await obtenerWorker();

        // PASADA 1: PSM 6.
        actualizarEstado(
            "Pasada 1 de 4: reconocimiento de bloques..."
        );

        const lecturaBloques = await reconocerBloques(
            worker,
            canvas,
            bloques,
            { inicio: 5, rango: 20 }
        );

        // PASADA 2: PSM 7.
        actualizarEstado(
            "Pasada 2 de 4: reconocimiento de líneas..."
        );

        const lecturaLineas = await reconocerLineas(
            worker,
            canvas,
            lineas,
            { inicio: 25, rango: 25 }
        );

        // PASADA 3: PSM 8.
        actualizarEstado(
            "Pasada 3 de 4: reconocimiento de palabras..."
        );

        const lecturaPalabras = await reconocerPalabras(
            worker,
            canvas,
            mascara,
            lineas,
            { inicio: 50, rango: 25 }
        );

        // PASADA 4: PSM 10.
        actualizarEstado(
            "Pasada 4 de 4: reconocimiento de caracteres..."
        );

        const lecturaCaracteres = await reconocerCaracteres(
            worker,
            canvas,
            mascara,
            palabras,
            { inicio: 75, rango: 22 }
        );

        estadisticasActuales.caracteres =
            lecturaCaracteres.cantidadDetectada;

        if (totalCaracteres) {
            totalCaracteres.textContent =
                lecturaCaracteres.cantidadDetectada;
        }

        // Comparación independiente de las cuatro lecturas.
        actualizarEstado(
            "Comparando las cuatro lecturas..."
        );

        actualizarProgreso(98);

        const comparacion = crearComparacion([
            lecturaBloques.texto,
            lecturaLineas.texto,
            lecturaPalabras.texto,
            lecturaCaracteres.texto
        ]);

        mostrarResultados(
            lecturaBloques,
            lecturaLineas,
            lecturaPalabras,
            lecturaCaracteres,
            comparacion
        );

        if (confianza) {
            confianza.textContent =
                lecturaBloques.confianza.toFixed(1) + "%";
        }

        if (coincidencia) {
            coincidencia.textContent =
                comparacion.coincidencia.toFixed(1) + "%";
        }

        actualizarProgreso(100);
        actualizarEstado("Análisis terminado.");

        actualizarResumen(
            "Se completaron las cuatro pasadas de reconocimiento."
        );

        if (estadoResultado) {
            estadoResultado.textContent = "Completado";
        }

        btnCopiar.disabled =
            resultado.value.trim().length === 0;

    } catch (error) {
        console.error("Error en el análisis OCR:", error);

        actualizarEstado(
            "Error durante el análisis."
        );

        actualizarResumen(
            error.message || "No se pudo completar el reconocimiento."
        );

        if (estadoResultado) {
            estadoResultado.textContent = "Error";
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
   23. CARGAR IMAGEN
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
            actualizarEstado("Imagen cargada correctamente.");

            actualizarResumen(
                "La imagen está lista para analizarse."
            );

            if (estadoResultado) {
                estadoResultado.textContent = "Imagen lista";
            }
        };

        imagen.onerror = function () {
            actualizarEstado(
                "No se pudo abrir la imagen."
            );
        };

        imagen.src = evento.target.result;
    };

    lector.readAsDataURL(archivo);
});


/* =========================================================
   24. BOTÓN ANALIZAR
   ========================================================= */

btnAnalizar.addEventListener(
    "click",
    analizarDocumento
);


/* =========================================================
   25. BOTÓN COPIAR
   ========================================================= */

btnCopiar.addEventListener("click", async function () {
    const texto = resultado.value;

    if (!texto.trim()) return;

    try {
        await navigator.clipboard.writeText(texto);

        actualizarEstado(
            "Resultado copiado correctamente."
        );

    } catch (error) {
        resultado.focus();
        resultado.select();

        const correcto =
            document.execCommand("copy");

        actualizarEstado(
            correcto
                ? "Resultado copiado correctamente."
                : "No se pudo copiar el resultado."
        );
    }
});


/* =========================================================
   26. BOTÓN LIMPIAR
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

    actualizarResumen("");

    if (estadoResultado) {
        estadoResultado.textContent = "Sin análisis";
    }

    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;
});


/* =========================================================
   27. ESTADO INICIAL
   ========================================================= */

btnAnalizar.disabled = true;
btnCopiar.disabled = true;

limpiarEstadisticas();

actualizarEstado(
    "Selecciona una imagen para comenzar."
);
