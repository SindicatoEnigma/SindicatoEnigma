
/* =========================================================
   SINDICATO ENIGMA
   LABORATORIO DE DOCUMENTOS OCR
   Nueva arquitectura: párrafos -> líneas -> OCR
   ========================================================= */


/* =========================================================
   1. ELEMENTOS HTML
   ========================================================= */

const inputImagen = document.getElementById("inputImagen");
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
const ESCALA_RECORTE = 2.5;

// Margen alrededor de cada línea.
// Evita cortar letras con ascendentes y descendentes.
const MARGEN_LINEA = 0.22;

// Variantes que se probarán en cada línea.
const NOMBRES_VARIANTES = [
    "Original",
    "Contraste",
    "Otsu",
    "Adaptativa",
    "Nitida"
];

let imagenCargada = null;
let canvasOriginal = null;
let workerOCR = null;
let analizando = false;


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
}

function escaparHTML(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function crearCanvas(ancho, alto) {
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    return canvas;
}

function obtenerContexto(canvas) {
    return canvas.getContext("2d", {
        willReadFrequently: true
    });
}

function mediana(valores) {
    if (!valores.length) return 0;

    const ordenados = [...valores].sort((a, b) => a - b);
    const medio = Math.floor(ordenados.length / 2);

    if (ordenados.length % 2) {
        return ordenados[medio];
    }

    return (ordenados[medio - 1] + ordenados[medio]) / 2;
}


/* =========================================================
   4. CARGAR IMAGEN EN CANVAS
   ========================================================= */

function prepararImagen(imagen) {
    let ancho = imagen.naturalWidth;
    let alto = imagen.naturalHeight;

    const mayor = Math.max(ancho, alto);

    if (mayor > MAX_DIMENSION) {
        const factor = MAX_DIMENSION / mayor;
        ancho = Math.round(ancho * factor);
        alto = Math.round(alto * factor);
    }

    const canvas = crearCanvas(ancho, alto);
    const ctx = obtenerContexto(canvas);

    ctx.drawImage(imagen, 0, 0, ancho, alto);

    return canvas;
}


/* =========================================================
   5. CONVERTIR A ESCALA DE GRISES
   ========================================================= */

function convertirGrises(canvas) {
    const salida = crearCanvas(canvas.width, canvas.height);
    const ctx = obtenerContexto(salida);

    ctx.drawImage(canvas, 0, 0);

    const imagen = ctx.getImageData(
        0, 0, salida.width, salida.height
    );

    const datos = imagen.data;

    for (let i = 0; i < datos.length; i += 4) {
        const gris =
            0.299 * datos[i] +
            0.587 * datos[i + 1] +
            0.114 * datos[i + 2];

        datos[i] = gris;
        datos[i + 1] = gris;
        datos[i + 2] = gris;
    }

    ctx.putImageData(imagen, 0, 0);

    return salida;
}


/* =========================================================
   6. CALCULAR UMBRAL DE OTSU
   ========================================================= */

function calcularOtsu(datos) {
    const histograma = new Array(256).fill(0);

    for (let i = 0; i < datos.length; i += 4) {
        histograma[datos[i]]++;
    }

    const total = datos.length / 4;

    let sumaTotal = 0;

    for (let i = 0; i < 256; i++) {
        sumaTotal += i * histograma[i];
    }

    let sumaFondo = 0;
    let pesoFondo = 0;
    let mejorVarianza = -1;
    let umbral = 127;

    for (let i = 0; i < 256; i++) {
        pesoFondo += histograma[i];

        if (pesoFondo === 0) continue;

        const pesoTexto = total - pesoFondo;

        if (pesoTexto === 0) break;

        sumaFondo += i * histograma[i];

        const mediaFondo = sumaFondo / pesoFondo;
        const mediaTexto =
            (sumaTotal - sumaFondo) / pesoTexto;

        const varianza =
            pesoFondo *
            pesoTexto *
            Math.pow(mediaFondo - mediaTexto, 2);

        if (varianza > mejorVarianza) {
            mejorVarianza = varianza;
            umbral = i;
        }
    }

    return umbral;
}


/* =========================================================
   7. CREAR VARIANTE DE CONTRASTE
   ========================================================= */

function crearContraste(canvas) {
    const salida = crearCanvas(canvas.width, canvas.height);
    const ctx = obtenerContexto(salida);

    ctx.drawImage(canvas, 0, 0);

    const imagen = ctx.getImageData(
        0, 0, salida.width, salida.height
    );

    const datos = imagen.data;
    const factor = 1.45;

    for (let i = 0; i < datos.length; i += 4) {
        const gris = datos[i];

        const nuevo = Math.max(
            0,
            Math.min(255, (gris - 128) * factor + 128)
        );

        datos[i] = nuevo;
        datos[i + 1] = nuevo;
        datos[i + 2] = nuevo;
    }

    ctx.putImageData(imagen, 0, 0);

    return salida;
}


/* =========================================================
   8. CREAR VARIANTE BINARIA OTSU
   ========================================================= */

function crearOtsu(canvas) {
    const salida = crearCanvas(canvas.width, canvas.height);
    const ctx = obtenerContexto(salida);

    ctx.drawImage(canvas, 0, 0);

    const imagen = ctx.getImageData(
        0, 0, salida.width, salida.height
    );

    const datos = imagen.data;
    const umbral = calcularOtsu(datos);

    for (let i = 0; i < datos.length; i += 4) {
        const valor = datos[i] < umbral ? 0 : 255;

        datos[i] = valor;
        datos[i + 1] = valor;
        datos[i + 2] = valor;
    }

    ctx.putImageData(imagen, 0, 0);

    return salida;
}


/* =========================================================
   9. CREAR VARIANTE ADAPTATIVA
   ========================================================= */

function crearAdaptativa(canvas) {
    const salida = crearCanvas(canvas.width, canvas.height);
    const ctx = obtenerContexto(salida);

    ctx.drawImage(canvas, 0, 0);

    const imagen = ctx.getImageData(
        0, 0, salida.width, salida.height
    );

    const datos = imagen.data;
    const ancho = salida.width;
    const alto = salida.height;

    // Imagen integral para calcular promedios locales.
    const integral = new Float64Array(
        (ancho + 1) * (alto + 1)
    );

    for (let y = 1; y <= alto; y++) {
        let sumaFila = 0;

        for (let x = 1; x <= ancho; x++) {
            const indice = ((y - 1) * ancho + (x - 1)) * 4;

            sumaFila += datos[indice];

            integral[y * (ancho + 1) + x] =
                integral[(y - 1) * (ancho + 1) + x] +
                sumaFila;
        }
    }

    const radio = Math.max(
        8,
        Math.round(Math.min(ancho, alto) * 0.012)
    );

    for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ancho; x++) {
            const x1 = Math.max(0, x - radio);
            const y1 = Math.max(0, y - radio);
            const x2 = Math.min(ancho, x + radio + 1);
            const y2 = Math.min(alto, y + radio + 1);

            const suma =
                integral[y2 * (ancho + 1) + x2] -
                integral[y1 * (ancho + 1) + x2] -
                integral[y2 * (ancho + 1) + x1] +
                integral[y1 * (ancho + 1) + x1];

            const cantidad = (x2 - x1) * (y2 - y1);
            const promedio = suma / cantidad;

            const indice = (y * ancho + x) * 4;
            const valor = datos[indice] < promedio - 7
                ? 0
                : 255;

            datos[indice] = valor;
            datos[indice + 1] = valor;
            datos[indice + 2] = valor;
        }
    }

    ctx.putImageData(imagen, 0, 0);

    return salida;
}


/* =========================================================
   10. CREAR VARIANTE NÍTIDA
   ========================================================= */

function crearNitida(canvas) {
    const salida = crearCanvas(canvas.width, canvas.height);
    const ctx = obtenerContexto(salida);

    // Conservamos el original y reforzamos el contraste.
    ctx.drawImage(canvas, 0, 0);

    const imagen = ctx.getImageData(
        0, 0, salida.width, salida.height
    );

    const datos = imagen.data;

    for (let i = 0; i < datos.length; i += 4) {
        const valor = datos[i];

        const nuevo = Math.max(
            0,
            Math.min(255, (valor - 128) * 1.8 + 128)
        );

        datos[i] = nuevo;
        datos[i + 1] = nuevo;
        datos[i + 2] = nuevo;
    }

    ctx.putImageData(imagen, 0, 0);

    return salida;
}


/* =========================================================
   11. GENERAR LAS CINCO VARIANTES
   ========================================================= */

function generarVariantes(canvasGris) {
    return [
        canvasGris,
        crearContraste(canvasGris),
        crearOtsu(canvasGris),
        crearAdaptativa(canvasGris),
        crearNitida(canvasGris)
    ];
}


/* =========================================================
   12. CREAR MÁSCARA PARA DETECTAR TEXTO
   ========================================================= */

function crearMascara(canvasGris) {
    const ctx = obtenerContexto(canvasGris);

    const imagen = ctx.getImageData(
        0, 0, canvasGris.width, canvasGris.height
    );

    const umbral = calcularOtsu(imagen.data);
    const datos = imagen.data;

    const mascara = new Uint8Array(
        canvasGris.width * canvasGris.height
    );

    for (let i = 0; i < mascara.length; i++) {
        mascara[i] =
            datos[i * 4] < umbral ? 1 : 0;
    }

    return mascara;
}


/* =========================================================
   13. DETECTAR FILAS DE TEXTO
   ========================================================= */

function detectarFilas(mascara, ancho, alto) {
    const proyeccion = new Int32Array(alto);

    // Contar píxeles de texto por cada fila horizontal.
    for (let y = 0; y < alto; y++) {
        let cantidad = 0;
        const inicio = y * ancho;

        for (let x = 0; x < ancho; x++) {
            cantidad += mascara[inicio + x];
        }

        proyeccion[y] = cantidad;
    }

    const maximo = Math.max(...proyeccion);

    // Evita considerar ruido aislado como una línea.
    const umbral = Math.max(
        2,
        Math.round(Math.min(maximo * 0.08, ancho * 0.003))
    );

    const filas = [];
    let inicio = -1;

    for (let y = 0; y < alto; y++) {
        if (proyeccion[y] >= umbral) {
            if (inicio === -1) inicio = y;
        } else if (inicio !== -1) {
            filas.push({
                y0: inicio,
                y1: y - 1
            });

            inicio = -1;
        }
    }

    if (inicio !== -1) {
        filas.push({
            y0: inicio,
            y1: alto - 1
        });
    }

    // Unir fragmentos separados por huecos pequeños.
    const unidas = [];

    for (const fila of filas) {
        const anterior = unidas[unidas.length - 1];

        if (anterior && fila.y0 - anterior.y1 <= 2) {
            anterior.y1 = fila.y1;
        } else {
            unidas.push({ ...fila });
        }
    }

    return unidas.filter(fila =>
        fila.y1 - fila.y0 >= 2
    );
}


/* =========================================================
   14. DELIMITAR LOS EXTREMOS DE CADA FILA
   ========================================================= */


/* =========================================================
   14. DELIMITAR LOS EXTREMOS DE CADA FILA
   ========================================================= */

function delimitarFila(fila, mascara, ancho, alto) {
    const proyeccion = new Int32Array(ancho);

    // Contar píxeles de texto por columna.
    for (let y = fila.y0; y <= fila.y1; y++) {
        const inicio = y * ancho;

        for (let x = 0; x < ancho; x++) {
            proyeccion[x] += mascara[inicio + x];
        }
    }

    const altura = fila.y1 - fila.y0 + 1;

    // Umbral menos agresivo para conservar trazos finos.
    const umbral = Math.max(
        1,
        Math.round(altura * 0.015)
    );

    let x0 = -1;
    let x1 = -1;

    for (let x = 0; x < ancho; x++) {
        if (proyeccion[x] >= umbral) {
            if (x0 === -1) x0 = x;
            x1 = x;
        }
    }

    if (x0 === -1 || x1 === -1) {
        return null;
    }

    const margenY = Math.max(
        3,
        Math.round(altura * MARGEN_LINEA)
    );

    const margenX = Math.max(
        8,
        Math.round(altura * 0.5)
    );

    return {
        x0: Math.max(0, x0 - margenX),
        x1: Math.min(ancho - 1, x1 + margenX),
        y0: Math.max(0, fila.y0 - margenY),
        y1: Math.min(alto - 1, fila.y1 + margenY),
        centroY: (fila.y0 + fila.y1) / 2,
        altura
    };
}



/* =========================================================
   15. AGRUPAR FILAS EN PÁRRAFOS
   ========================================================= */

function agruparParrafos(lineas) {
    if (!lineas.length) return [];

    const alturas = lineas.map(linea => linea.altura);
    const alturaMedia = mediana(alturas);

    // Si la separación vertical supera este valor,
    // comenzamos un párrafo nuevo.
    const separacionParrafo = Math.max(
        5,
        alturaMedia * 0.90
    );

    const parrafos = [];
    let actual = [lineas[0]];

    for (let i = 1; i < lineas.length; i++) {
        const anterior = lineas[i - 1];
        const actualLinea = lineas[i];

        const espacio =
            actualLinea.y0 - anterior.y1 - 1;

        if (espacio > separacionParrafo) {
            parrafos.push(actual);
            actual = [actualLinea];
        } else {
            actual.push(actualLinea);
        }
    }

    if (actual.length) {
        parrafos.push(actual);
    }

    return parrafos;
}


/* =========================================================
   16. DETECTAR PÁRRAFOS Y SUS LÍNEAS
   ========================================================= */

function detectarEstructura(canvasGris) {
    const ancho = canvasGris.width;
    const alto = canvasGris.height;

    const mascara = crearMascara(canvasGris);

    const filas = detectarFilas(
        mascara,
        ancho,
        alto
    );

    const lineas = filas
        .map(fila => delimitarFila(
            fila,
            mascara,
            ancho,
            alto
        ))
        .filter(Boolean);

    const parrafos = agruparParrafos(lineas);

    return {
        mascara,
        lineas,
        parrafos
    };
}


/* =========================================================
   17. RECORTAR UNA LÍNEA
   ========================================================= */

function recortarLinea(canvas, linea) {
    const ancho = linea.x1 - linea.x0 + 1;
    const alto = linea.y1 - linea.y0 + 1;

    const recorte = crearCanvas(
        Math.max(1, ancho),
        Math.max(1, alto)
    );

    const ctx = obtenerContexto(recorte);

    ctx.drawImage(
        canvas,
        linea.x0,
        linea.y0,
        ancho,
        alto,
        0,
        0,
        ancho,
        alto
    );

    // Aumentar tamaño para facilitar el reconocimiento.
    const ampliado = crearCanvas(
        Math.round(ancho * ESCALA_RECORTE),
        Math.round(alto * ESCALA_RECORTE)
    );

    const ctxAmpliado = obtenerContexto(ampliado);

    ctxAmpliado.imageSmoothingEnabled = true;
    ctxAmpliado.imageSmoothingQuality = "high";

    ctxAmpliado.fillStyle = "#ffffff";
    ctxAmpliado.fillRect(
        0, 0, ampliado.width, ampliado.height
    );

    ctxAmpliado.drawImage(
        recorte,
        0,
        0,
        ampliado.width,
        ampliado.height
    );

    return ampliado;
}


/* =========================================================
   18. INICIALIZAR TESSERACT
   ========================================================= */

async function iniciarOCR() {
    if (workerOCR) return workerOCR;

    if (typeof Tesseract === "undefined") {
        throw new Error(
            "No se encontró Tesseract.js. Revisa la conexión a internet."
        );
    }

    actualizarEstado("Preparando motor OCR...");

    workerOCR = await Tesseract.createWorker(
        "spa+eng",
        1,
        {
            logger: mensaje => {
                if (mensaje.status === "recognizing text") {
                    const porcentaje = Math.round(
                        mensaje.progress * 100
                    );

                    actualizarEstado(
                        "Reconociendo texto: " + porcentaje + "%"
                    );
                }
            }
        }
    );

    await workerOCR.setParameters({
        tessedit_pageseg_mode: "7"
    });

    return workerOCR;
}


/* =========================================================
   19. RECONOCER UNA LÍNEA
   ========================================================= */

async function reconocerLinea(worker, canvas) {
    const respuesta = await worker.recognize(canvas);

    return {
        texto: (respuesta.data.text || "").trim(),
        confianza: Number(
            respuesta.data.confidence || 0
        )
    };
}


/* =========================================================
   20. ELEGIR LA MEJOR LECTURA
   ========================================================= */

function elegirMejorLectura(lecturas) {
    const validas = lecturas.filter(
        lectura => lectura.texto.length > 0
    );

    if (!validas.length) {
        return {
            texto: "",
            confianza: 0,
            variante: "Ninguna"
        };
    }

    // La confianza es una medida del motor, no una
    // garantía de que el texto sea correcto.
    validas.sort(
        (a, b) => b.confianza - a.confianza
    );

    return validas[0];
}


/* =========================================================
   21. PROCESAR UNA LÍNEA CON CINCO VARIANTES
   ========================================================= */

async function procesarLinea(
    worker,
    variantes,
    linea
) {
    const lecturas = [];

    for (let i = 0; i < variantes.length; i++) {
        const recorte = recortarLinea(
            variantes[i],
            linea
        );

        if (i === 0) {
    console.log("Coordenadas de la línea:", linea);
    console.log("Dimensiones del recorte:", {
        ancho: recorte.width,
        alto: recorte.height
    });

    const prueba = document.createElement("img");
    prueba.src = recorte.toDataURL();

    prueba.style.maxWidth = "100%";
    prueba.style.border = "2px solid red";
    prueba.style.margin = "10px 0";

    document.body.appendChild(prueba);
        }

        const lectura = await reconocerLinea(
            worker,
            recorte
        );

        lecturas.push({
            texto: lectura.texto,
            confianza: lectura.confianza,
            variante: NOMBRES_VARIANTES[i]
        });
    }

    const mejor = elegirMejorLectura(lecturas);

    return {
        ...mejor,
        lecturas
    };
}


/* =========================================================
   22. CONSTRUIR EL TEXTO FINAL
   ========================================================= */

function reconstruirDocumento(parrafos) {
    return parrafos
        .map(parrafo =>
            parrafo
                .map(linea => linea.texto)
                .filter(texto => texto.length > 0)
                .join(" ")
        )
        .filter(texto => texto.length > 0)
        .join("\n\n");
}


/* =========================================================
   CONSTRUIR INFORME COMPLETO DE COMPARACIONES
   ========================================================= */

function construirInformeComparaciones(parrafos) {
    let informe = "";

    informe += "========== TEXTO RECONOCIDO ==========\n\n";
    informe += reconstruirDocumento(parrafos) || "(Sin texto reconocido)";
    informe += "\n\n========== COMPARACIÓN DE LECTURAS ==========\n";

    parrafos.forEach((parrafo, indiceParrafo) => {
        informe += `\nPÁRRAFO ${indiceParrafo + 1}\n`;

        parrafo.forEach((linea, indiceLinea) => {
            informe += `\nLÍNEA ${indiceLinea + 1}\n`;

            linea.lecturas.forEach(lectura => {
                informe += `\n${lectura.variante} `;
                informe += `(${lectura.confianza.toFixed(1)}%):\n`;
                informe += lectura.texto || "(Sin lectura)";
                informe += "\n";
            });
        });
    });

    return informe;
}



/* =========================================================
   23. MOSTRAR COMPARACIÓN DE VARIANTES
   ========================================================= */

function mostrarComparaciones(parrafos) {
    const detalles = parrafos.map(
        (parrafo, indiceParrafo) => {

            const lineasHTML = parrafo.map(
                (linea, indiceLinea) => {

                    const alternativas = linea.lecturas
                        .map(lectura => `
                            <div>
                                <strong>${escaparHTML(lectura.variante)}</strong>
                                — ${lectura.confianza.toFixed(1)}%
                                <br>
                                ${escaparHTML(
                                    lectura.texto || "(Sin lectura)"
                                )}
                            </div>
                        `)
                        .join("");

                    return `
                        <details>
                            <summary>
                                Línea ${indiceLinea + 1}:
                                ${escaparHTML(linea.texto)}
                                (${linea.confianza.toFixed(1)}%)
                            </summary>
                            ${alternativas}
                        </details>
                    `;
                }
            ).join("");

            return `
                <details>
                    <summary>
                        Párrafo ${indiceParrafo + 1}
                        — ${parrafo.length} líneas
                    </summary>
                    ${lineasHTML}
                </details>
            `;
        }
    ).join("");

    let panel = document.getElementById(
        "comparacionOCR"
    );

    if (!panel) {
        panel = document.createElement("div");
        panel.id = "comparacionOCR";

        if (resultado && resultado.parentElement) {
            resultado.parentElement.appendChild(panel);
        }
    }

    panel.innerHTML = `
        <h3>Comparación de lecturas</h3>
        ${detalles}
    `;
}


/* =========================================================
   24. ACTUALIZAR ESTADÍSTICAS
   ========================================================= */

function actualizarEstadisticas(parrafos) {
    const lineas = parrafos.flat();

    const texto = reconstruirDocumento(parrafos);

    const palabras = texto
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const caracteres = texto.length;

    const confianzas = lineas
        .filter(linea => linea.texto.length > 0)
        .map(linea => linea.confianza);

    const promedio = confianzas.length
        ? confianzas.reduce((a, b) => a + b, 0) /
          confianzas.length
        : 0;

    if (totalBloques) {
        totalBloques.textContent = parrafos.length;
    }

    if (totalLineas) {
        totalLineas.textContent = lineas.length;
    }

    if (totalPalabras) {
        totalPalabras.textContent = palabras.length;
    }

    if (totalCaracteres) {
        totalCaracteres.textContent = caracteres;
    }

    if (confianza) {
        confianza.textContent = promedio.toFixed(1) + "%";
    }

    if (coincidencia) {
        coincidencia.textContent = "No calculada";
    }

    if (resumen) {
        resumen.textContent =
            `${parrafos.length} párrafos, ` +
            `${lineas.length} líneas procesadas.`;
    }
}


/* =========================================================
   25. PROCESO PRINCIPAL
   ========================================================= */

async function analizarDocumento() {
    if (!imagenCargada || analizando) return;

    analizando = true;
    btnAnalizar.disabled = true;

    if (btnCopiar) btnCopiar.disabled = true;

    try {
        actualizarProgreso(0);
        actualizarEstado("Preparando imagen...");

        const gris = convertirGrises(canvasOriginal);

        actualizarProgreso(5);

        // Primero se detecta la estructura del documento.
        // Todavía no se utiliza OCR.
        const estructura = detectarEstructura(gris);

        const parrafosDetectados = estructura.parrafos;

        if (!parrafosDetectados.length) {
            throw new Error(
                "No se detectaron filas de texto. Prueba con una imagen más clara."
            );
        }

        actualizarProgreso(10);

        const variantes = generarVariantes(gris);

        actualizarEstado(
            "Se detectaron " +
            parrafosDetectados.length +
            " párrafos y " +
            estructura.lineas.length +
            " líneas."
        );

        const worker = await iniciarOCR();

        const parrafosProcesados = [];

        const totalLineas = estructura.lineas.length;
        let lineasProcesadas = 0;

        for (
            let p = 0;
            p < parrafosDetectados.length;
            p++
        ) {
            const parrafoActual = [];

            for (
                let l = 0;
                l < parrafosDetectados[p].length;
                l++
            ) {
                const linea = parrafosDetectados[p][l];

                actualizarEstado(
                    `Párrafo ${p + 1} de ${parrafosDetectados.length}. ` +
                    `Línea ${l + 1} de ${parrafosDetectados[p].length}.`
                );

                const lectura = await procesarLinea(
                    worker,
                    variantes,
                    linea
                );

                parrafoActual.push({
                    ...lectura,
                    coordenadas: linea
                });

                lineasProcesadas++;

                actualizarProgreso(
                    10 + (lineasProcesadas / totalLineas) * 85
                );
            }

            parrafosProcesados.push(parrafoActual);
        }

        const textoFinal = reconstruirDocumento(
    parrafosProcesados
);

const informeCompleto = construirInformeComparaciones(
    parrafosProcesados
);

if (resultado) {
    resultado.value = informeCompleto;
}

        actualizarEstadisticas(parrafosProcesados);
        mostrarComparaciones(parrafosProcesados);

        actualizarProgreso(100);
        actualizarEstado("Análisis terminado.");

        if (estadoResultado) {
            estadoResultado.textContent =
                "Documento procesado correctamente.";
        }
if (btnCopiar) {
    btnCopiar.disabled = !informeCompleto;
}

    } catch (error) {
        console.error(error);

        actualizarEstado("No se pudo completar el análisis.");

        if (estadoResultado) {
            estadoResultado.textContent = error.message;
        }

    } finally {
        analizando = false;
        btnAnalizar.disabled = !imagenCargada;
    }
}


/* =========================================================
   26. CARGAR IMAGEN
   ========================================================= */

 
/* =========================================================
   26. CARGAR IMAGEN
   ========================================================= */

function cargarImagen(archivo) {
    if (!archivo) return;

    actualizarEstado("Leyendo imagen...");
    
    if (btnAnalizar) btnAnalizar.disabled = true;

    if (!archivo.type.startsWith("image/")) {
        actualizarEstado("El archivo seleccionado no es una imagen compatible.");
        return;
    }

    const lector = new FileReader();

    lector.onload = () => {
        const imagen = new Image();

        imagen.onload = () => {
            try {
                const nuevoCanvas = prepararImagen(imagen);

                imagenCargada = imagen;
                canvasOriginal = nuevoCanvas;

                if (vistaPrevia) {
                    vistaPrevia.src = lector.result;
                    vistaPrevia.style.display = "block";
                }

                if (contenedorVista) {
                    contenedorVista.style.display = "block";
                }

                if (nombreArchivo) {
                    nombreArchivo.textContent = archivo.name;
                }

                if (btnAnalizar) {
                    btnAnalizar.disabled = false;
                }

                actualizarEstado(
                    "Imagen cargada correctamente. Ya puedes analizarla."
                );

                actualizarProgreso(0);

                if (resultado) resultado.value = "";

                if (btnCopiar) btnCopiar.disabled = true;

                const panel = document.getElementById("comparacionOCR");
                if (panel) panel.remove();

            } catch (error) {
                console.error("Error al preparar imagen:", error);
                actualizarEstado("Error al preparar la imagen: " + error.message);
            }
        };

        imagen.onerror = () => {
            actualizarEstado("El navegador no pudo interpretar esta imagen.");
        };

        imagen.src = lector.result;
    };

    lector.onerror = () => {
        actualizarEstado("No se pudo leer el archivo seleccionado.");
    };

    lector.readAsDataURL(archivo);
}


/* =========================================================
   27. COPIAR RESULTADO
   ========================================================= */



/* =========================================================
   27. COPIAR RESULTADO
   ========================================================= */

async function copiarResultado() {
    if (!resultado || !resultado.value) return;

    try {
        await navigator.clipboard.writeText(
            resultado.value
        );

        actualizarEstado("Texto copiado.");

    } catch (error) {
        resultado.select();

        const correcto = document.execCommand("copy");

        actualizarEstado(
            correcto
                ? "Texto copiado."
                : "No se pudo copiar el texto."
        );
    }
}


/* =========================================================
   28. LIMPIAR LABORATORIO
   ========================================================= */

function limpiarLaboratorio() {
    imagenCargada = null;
    canvasOriginal = null;

    if (inputImagen) inputImagen.value = "";

    if (vistaPrevia) vistaPrevia.removeAttribute("src");

    if (nombreArchivo) nombreArchivo.textContent = "";

    if (resultado) resultado.value = "";

    if (contenedorVista) {
        contenedorVista.style.display = "none";
    }

    if (btnAnalizar) btnAnalizar.disabled = true;

    if (btnCopiar) btnCopiar.disabled = true;

    const panel = document.getElementById(
        "comparacionOCR"
    );

    if (panel) panel.remove();

    [
        totalBloques,
        totalLineas,
        totalPalabras,
        totalCaracteres
    ].forEach(elemento => {
        if (elemento) elemento.textContent = "0";
    });

    if (confianza) confianza.textContent = "0%";

    if (coincidencia) coincidencia.textContent = "—";

    if (resumen) resumen.textContent = "";

    if (estadoResultado) estadoResultado.textContent = "";

    actualizarProgreso(0);
    actualizarEstado("Esperando imagen...");
}


/* =========================================================
   29. CONECTAR BOTONES
   ========================================================= */


/* =========================================================
   29. CONECTAR BOTONES
   ========================================================= */

if (inputImagen) {
    inputImagen.addEventListener("change", evento => {
        const archivo = evento.target.files[0];

        if (archivo) {
            cargarImagen(archivo);
        }
    });
} else {
    console.error("No se encontró el elemento inputImagen.");
}

if (btnAnalizar) {
    btnAnalizar.addEventListener("click", analizarDocumento);
} else {
    console.error("No se encontró el botón btnAnalizar.");
}

if (btnCopiar) {
    btnCopiar.addEventListener("click", copiarResultado);
}

if (btnLimpiar) {
    btnLimpiar.addEventListener("click", limpiarLaboratorio);
}


/* =========================================================
   30. ESTADO INICIAL
   ========================================================= */

if (btnAnalizar) btnAnalizar.disabled = true;

if (btnCopiar) btnCopiar.disabled = true;

actualizarEstado("Esperando imagen...");
actualizarProgreso(0);



/* =========================================================
   30. ESTADO INICIAL
   ========================================================= */

if (btnAnalizar) btnAnalizar.disabled = true;

if (btnCopiar) btnCopiar.disabled = true;

actualizarEstado("Esperando imagen...");
actualizarProgreso(0);
