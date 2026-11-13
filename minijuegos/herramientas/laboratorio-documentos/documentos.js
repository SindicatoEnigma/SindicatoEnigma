// ==================================================
// SINDICATO ENIGMA
// LABORATORIO DE DOCUMENTOS OCR
// Tesseract.js v5
// ==================================================


// ==================================================
// 1. ELEMENTOS HTML
// ==================================================

const entradaImagen = document.getElementById("imagen");
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

let imagenCargada = null;
let trabajando = false;


// ==================================================
// 2. SELECCIÓN DE IMAGEN
// ==================================================

entradaImagen.addEventListener("change", () => {

    const archivo = entradaImagen.files[0];

    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {

        alert("Selecciona una imagen válida.");
        entradaImagen.value = "";
        return;
    }

    const lector = new FileReader();

    lector.onload = () => {

        const imagen = new Image();

        imagen.onload = () => {

            imagenCargada = imagen;

            vistaPrevia.src = lector.result;
            contenedorVista.hidden = false;

            nombreArchivo.textContent = archivo.name;

            btnAnalizar.disabled = false;
            btnCopiar.disabled = true;

            resultado.value = "";
            resumen.hidden = true;

            estadoResultado.textContent = "Imagen preparada";
        };

        imagen.onerror = () => {
            alert("No se pudo abrir la imagen.");
        };

        imagen.src = lector.result;
    };

    lector.readAsDataURL(archivo);
});


// ==================================================
// 3. PREPARAR IMAGEN
// ==================================================

function crearImagenTrabajo(imagen) {

    const MAXIMO = 2600;

    let ancho = imagen.naturalWidth;
    let alto = imagen.naturalHeight;

    const escala = Math.min(
        1,
        MAXIMO / Math.max(ancho, alto)
    );

    ancho = Math.max(1, Math.round(ancho * escala));
    alto = Math.max(1, Math.round(alto * escala));

    const canvas = document.createElement("canvas");

    canvas.width = ancho;
    canvas.height = alto;

    const contexto = canvas.getContext("2d", {
        willReadFrequently: true
    });

    contexto.drawImage(
        imagen,
        0,
        0,
        ancho,
        alto
    );

    return canvas;
}


// ==================================================
// 4. UMBRAL AUTOMÁTICO
// ==================================================

function calcularUmbral(datos) {

    const histograma = new Array(256).fill(0);
    const cantidad = datos.length / 4;

    for (let i = 0; i < datos.length; i += 4) {

        const gris = Math.round(
            datos[i] * 0.299 +
            datos[i + 1] * 0.587 +
            datos[i + 2] * 0.114
        );

        histograma[gris]++;
    }

    let sumaTotal = 0;

    for (let i = 0; i < 256; i++) {
        sumaTotal += i * histograma[i];
    }

    let sumaFondo = 0;
    let pesoFondo = 0;
    let mejorVarianza = 0;
    let umbral = 127;

    for (let i = 0; i < 256; i++) {

        pesoFondo += histograma[i];

        if (pesoFondo === 0) continue;

        const pesoTexto = cantidad - pesoFondo;

        if (pesoTexto === 0) break;

        sumaFondo += i * histograma[i];

        const mediaFondo = sumaFondo / pesoFondo;

        const mediaTexto =
            (sumaTotal - sumaFondo) / pesoTexto;

        const diferencia = mediaFondo - mediaTexto;

        const varianza =
            pesoFondo *
            pesoTexto *
            diferencia *
            diferencia;

        if (varianza > mejorVarianza) {

            mejorVarianza = varianza;
            umbral = i;
        }
    }

    return umbral;
}


// ==================================================
// 5. OBTENER MÁSCARA DE TEXTO
// ==================================================

function obtenerMascara(canvas) {

    const contexto = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const ancho = canvas.width;
    const alto = canvas.height;

    const imagen = contexto.getImageData(
        0,
        0,
        ancho,
        alto
    );

    const datos = imagen.data;
    const umbral = calcularUmbral(datos);

    let sumaLuminosidad = 0;
    let muestras = 0;

    for (let i = 0; i < datos.length; i += 16) {

        sumaLuminosidad +=
            datos[i] * 0.299 +
            datos[i + 1] * 0.587 +
            datos[i + 2] * 0.114;

        muestras++;
    }

    const fondoOscuro =
        sumaLuminosidad / muestras < 127;

    const mascara = new Uint8Array(ancho * alto);

    for (let y = 0; y < alto; y++) {

        for (let x = 0; x < ancho; x++) {

            const indice = (y * ancho + x) * 4;

            const gris =
                datos[indice] * 0.299 +
                datos[indice + 1] * 0.587 +
                datos[indice + 2] * 0.114;

            const esTexto = fondoOscuro
                ? gris > umbral
                : gris < umbral;

            mascara[y * ancho + x] =
                esTexto ? 1 : 0;
        }
    }

    return {
        ancho,
        alto,
        mascara
    };
}


// ==================================================
// 6. DETECTAR BLOQUES
// ==================================================

function detectarBloques(canvas) {

    const { ancho, alto, mascara } =
        obtenerMascara(canvas);

    const ocupacionFilas = new Array(alto).fill(0);

    for (let y = 0; y < alto; y++) {

        for (let x = 0; x < ancho; x++) {

            ocupacionFilas[y] +=
                mascara[y * ancho + x];
        }
    }

    const minimoPixeles = Math.max(
        2,
        Math.floor(ancho * 0.0007)
    );

    const filas = [];

    let inicio = -1;
    let fin = -1;

    for (let y = 0; y < alto; y++) {

        if (ocupacionFilas[y] >= minimoPixeles) {

            if (inicio === -1) inicio = y;

            fin = y;

        } else if (inicio !== -1) {

            filas.push({ inicio, fin });

            inicio = -1;
            fin = -1;
        }
    }

    if (inicio !== -1) {
        filas.push({ inicio, fin });
    }

    if (filas.length === 0) return [];

    const alturas = filas.map(
        f => f.fin - f.inicio + 1
    );

    const orden = [...alturas].sort((a, b) => a - b);

    const alturaMediana =
        orden[Math.floor(orden.length / 2)];

    const separacionMaxima = Math.max(
        8,
        Math.round(alturaMediana * 1.8)
    );

    const grupos = [];

    let grupo = {
        inicio: filas[0].inicio,
        fin: filas[0].fin
    };

    for (let i = 1; i < filas.length; i++) {

        const fila = filas[i];

        const separacion =
            fila.inicio - grupo.fin - 1;

        if (separacion <= separacionMaxima) {

            grupo.fin = fila.fin;

        } else {

            grupos.push(grupo);

            grupo = {
                inicio: fila.inicio,
                fin: fila.fin
            };
        }
    }

    grupos.push(grupo);

    const margenX = Math.max(
        10,
        Math.round(ancho * 0.01)
    );

    const margenY = Math.max(
        8,
        Math.round(alturaMediana * 0.8)
    );

    const bloques = [];

    for (const grupo of grupos) {

        let izquierda = ancho;
        let derecha = -1;

        for (
            let y = grupo.inicio;
            y <= grupo.fin;
            y++
        ) {

            for (let x = 0; x < ancho; x++) {

                if (mascara[y * ancho + x]) {

                    izquierda = Math.min(izquierda, x);
                    derecha = Math.max(derecha, x);
                }
            }
        }

        if (derecha < izquierda) continue;

        const x = Math.max(
            0,
            izquierda - margenX
        );

        const y = Math.max(
            0,
            grupo.inicio - margenY
        );

        const xFinal = Math.min(
            ancho,
            derecha + margenX + 1
        );

        const yFinal = Math.min(
            alto,
            grupo.fin + margenY + 1
        );

        const bloque = {
            x,
            y,
            ancho: xFinal - x,
            alto: yFinal - y
        };

        if (bloque.ancho >= 8 && bloque.alto >= 5) {
            bloques.push(bloque);
        }
    }

    return bloques;
}


// ==================================================
// 7. CREAR RECORTES CON COORDENADAS
// ==================================================

function crearRecorte(
    canvasOriginal,
    region,
    margen = 3
) {

    const x = Math.max(
        0,
        Math.floor(region.x - margen)
    );

    const y = Math.max(
        0,
        Math.floor(region.y - margen)
    );

    const xFinal = Math.min(
        canvasOriginal.width,
        Math.ceil(region.x + region.ancho + margen)
    );

    const yFinal = Math.min(
        canvasOriginal.height,
        Math.ceil(region.y + region.alto + margen)
    );

    const ancho = Math.max(1, xFinal - x);
    const alto = Math.max(1, yFinal - y);

    const recorte = document.createElement("canvas");

    recorte.width = ancho;
    recorte.height = alto;

    const contexto = recorte.getContext("2d");

    contexto.drawImage(
        canvasOriginal,
        x,
        y,
        ancho,
        alto,
        0,
        0,
        ancho,
        alto
    );

    // Ampliar regiones pequeñas para facilitar
    // el reconocimiento de Tesseract.

    if (alto < 100) {

        const escala = Math.min(
            3,
            100 / alto
        );

        const ampliado = document.createElement("canvas");

        ampliado.width = Math.max(
            1,
            Math.round(ancho * escala)
        );

        ampliado.height = Math.max(
            1,
            Math.round(alto * escala)
        );

        const ctx = ampliado.getContext("2d");

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(
            recorte,
            0,
            0,
            ampliado.width,
            ampliado.height
        );

        return ampliado;
    }

    return recorte;
}


// ==================================================
// 8. VALIDAR COORDENADAS DE TESSERACT
// ==================================================

function obtenerRegion(bbox) {

    if (!bbox) return null;

    const x0 = Number(bbox.x0);
    const y0 = Number(bbox.y0);
    const x1 = Number(bbox.x1);
    const y1 = Number(bbox.y1);

    if (
        !Number.isFinite(x0) ||
        !Number.isFinite(y0) ||
        !Number.isFinite(x1) ||
        !Number.isFinite(y1)
    ) {
        return null;
    }

    const ancho = x1 - x0;
    const alto = y1 - y0;

    if (ancho < 1 || alto < 1) {
        return null;
    }

    return {
        x: x0,
        y: y0,
        ancho,
        alto
    };
}


// ==================================================
// 9. EXTRAER LÍNEAS, PALABRAS Y SÍMBOLOS
// ==================================================

function extraerEstructura(datos) {

    const lineasResultado = [];

    const bloques = Array.isArray(datos.blocks)
        ? datos.blocks
        : [];

    for (const bloque of bloques) {

        const parrafos = Array.isArray(bloque.paragraphs)
            ? bloque.paragraphs
            : [];

        for (const parrafo of parrafos) {

            const lineas = Array.isArray(parrafo.lines)
                ? parrafo.lines
                : [];

            for (const linea of lineas) {

                const regionLinea =
                    obtenerRegion(linea.bbox);

                if (!regionLinea) continue;

                const palabrasResultado = [];

                const palabras = Array.isArray(linea.words)
                    ? linea.words
                    : [];

                for (const palabra of palabras) {

                    const regionPalabra =
                        obtenerRegion(palabra.bbox);

                    if (!regionPalabra) continue;

                    const simbolosResultado = [];

                    const simbolos = Array.isArray(palabra.symbols)
                        ? palabra.symbols
                        : [];

                    for (const simbolo of simbolos) {

                        const regionSimbolo =
                            obtenerRegion(simbolo.bbox);

                        if (!regionSimbolo) continue;

                        simbolosResultado.push({
                            texto: simbolo.text || "",
                            region: regionSimbolo,
                            confianza: Number(simbolo.confidence) || 0
                        });
                    }

                    palabrasResultado.push({
                        texto: palabra.text || "",
                        region: regionPalabra,
                        confianza: Number(palabra.confidence) || 0,
                        simbolos: simbolosResultado
                    });
                }

                lineasResultado.push({
                    texto: linea.text || "",
                    region: regionLinea,
                    palabras: palabrasResultado
                });
            }
        }
    }

    return lineasResultado;
}


// ==================================================
// 10. COMPARAR DOS LECTURAS
// ==================================================

function normalizarTexto(texto) {

    return (texto || "")
        .replace(/\s+/g, " ")
        .trim();
}

function calcularCoincidencia(textoA, textoB) {

    const a = normalizarTexto(textoA);
    const b = normalizarTexto(textoB);

    // Dos lecturas vacías no cuentan como coincidencia.

    if (!a.length || !b.length) return null;

    const filaAnterior = new Array(b.length + 1);
    const filaActual = new Array(b.length + 1);

    for (let j = 0; j <= b.length; j++) {
        filaAnterior[j] = j;
    }

    for (let i = 1; i <= a.length; i++) {

        filaActual[0] = i;

        for (let j = 1; j <= b.length; j++) {

            const costo =
                a[i - 1] === b[j - 1] ? 0 : 1;

            filaActual[j] = Math.min(
                filaAnterior[j] + 1,
                filaActual[j - 1] + 1,
                filaAnterior[j - 1] + costo
            );
        }

        for (let j = 0; j <= b.length; j++) {
            filaAnterior[j] = filaActual[j];
        }
    }

    const distancia = filaAnterior[b.length];

    const longitud = Math.max(
        a.length,
        b.length
    );

    return Math.max(
        0,
        (1 - distancia / longitud) * 100
    );
}


// ==================================================
// 11. FUNCIONES AUXILIARES
// ==================================================

function actualizarProgreso(porcentaje, mensaje) {

    barraProgreso.style.width =
        Math.min(100, Math.max(0, porcentaje)) + "%";

    estado.textContent = mensaje;
}


function obtenerPromedio(valores) {

    if (!valores.length) return null;

    return valores.reduce(
        (a, b) => a + b,
        0
    ) / valores.length;
}


function formatearConfianza(valor) {

    if (valor === null || !Number.isFinite(valor)) {
        return "--";
    }

    return valor.toFixed(1) + "%";
}


// ==================================================
// 12. ANALIZAR DOCUMENTO
// ==================================================

btnAnalizar.addEventListener(
    "click",
    analizarDocumento
);


async function analizarDocumento() {

    if (!imagenCargada || trabajando) return;

    if (!window.Tesseract) {

        alert(
            "No se pudo cargar Tesseract. Comprueba tu conexión."
        );

        return;
    }

    trabajando = true;

    btnAnalizar.disabled = true;
    entradaImagen.disabled = true;
    btnCopiar.disabled = true;

    resultado.value = "";

    progresoContenedor.hidden = false;
    resumen.hidden = true;

    estadoResultado.textContent = "Analizando documento";

    actualizarProgreso(
        2,
        "Preparando imagen..."
    );

    let worker = null;

    try {

        // ------------------------------------------
        // A. PREPARAR IMAGEN
        // ------------------------------------------

        const canvas = crearImagenTrabajo(imagenCargada);

        // ------------------------------------------
        // B. DETECTAR BLOQUES
        // ------------------------------------------

        actualizarProgreso(
            5,
            "Localizando bloques de texto..."
        );

        const bloques = detectarBloques(canvas);

        if (bloques.length === 0) {

            throw new Error(
                "No se detectaron bloques de texto."
            );
        }

        totalBloques.textContent =
            bloques.length +
            (bloques.length === 1 ? " bloque" : " bloques");

        // ------------------------------------------
        // C. CONFIGURAR TESSERACT
        // ------------------------------------------

        actualizarProgreso(
            8,
            "Iniciando motor OCR..."
        );

        worker = await Tesseract.createWorker(
            "spa+eng",
            1
        );

        // ------------------------------------------
        // D. PREPARAR RESULTADOS
        // ------------------------------------------

        const resultadosInternos = [];

        const confianzasBloques = [];
        const confianzasLineas = [];
        const confianzasPalabras = [];
        const confianzasCaracteres = [];

        const coincidencias = [];

        let lineasTotales = 0;
        let palabrasTotales = 0;
        let caracteresTotales = 0;

        let caracteresOmitidos = 0;

        const LIMITE_CARACTERES = 300;

        // ------------------------------------------
        // E. RECORRER BLOQUES
        // ------------------------------------------

        for (
            let i = 0;
            i < bloques.length;
            i++
        ) {

            const avanceBloque =
                i / bloques.length;

            actualizarProgreso(
                10 + avanceBloque * 75,
                "Analizando bloque " +
                (i + 1) +
                " de " +
                bloques.length
            );

            const recorteBloque = crearRecorte(
                canvas,
                bloques[i],
                5
            );

            // ======================================
            // PASADA 1: BLOQUE COMPLETO — PSM 6
            // ======================================

            await worker.setParameters({
                tessedit_pageseg_mode: "6"
            });

            const lecturaBloque =
                await worker.recognize(recorteBloque);

            const textoBloque =
                (lecturaBloque.data.text || "").trim();

            const confianzaBloque =
                Number(lecturaBloque.data.confidence) || 0;

            confianzasBloques.push(confianzaBloque);

            // --------------------------------------
            // EXTRAER ESTRUCTURA DE TESSERACT
            // --------------------------------------

            const estructura = extraerEstructura(
                lecturaBloque.data
            );

            const lineasTexto = [];
            const palabrasTexto = [];
            const caracteresTexto = [];

            const confianzasLineaBloque = [];
            const confianzasPalabraBloque = [];
            const confianzasCaracterBloque = [];

            // ======================================
            // PASADA 2: LÍNEAS — PSM 7
            // ======================================

            for (
                let j = 0;
                j < estructura.length;
                j++
            ) {

                const linea = estructura[j];

                lineasTotales++;

                actualizarProgreso(
                    15 + (
                        (j + 1) /
                        Math.max(1, estructura.length)
                    ) * 15,
                    "Reconociendo línea " +
                    (j + 1) +
                    " del bloque " +
                    (i + 1)
                );

                const recorteLinea = crearRecorte(
                    recorteBloque,
                    linea.region,
                    5
                );

                await worker.setParameters({
                    tessedit_pageseg_mode: "7"
                });

                const lecturaLinea =
                    await worker.recognize(recorteLinea);

                const textoLinea =
                    (lecturaLinea.data.text || "").trim();

                const confianzaLinea =
                    Number(lecturaLinea.data.confidence) || 0;

                lineasTexto.push(textoLinea);

                confianzasLineaBloque.push(
                    confianzaLinea
                );

                confianzasLineas.push(
                    confianzaLinea
                );

                // ==================================
                // PASADA 3: PALABRAS — PSM 8
                // ==================================

                const palabrasDeLinea = [];

                for (
                    let k = 0;
                    k < linea.palabras.length;
                    k++
                ) {

                    const palabra = linea.palabras[k];

                    palabrasTotales++;

                    actualizarProgreso(
                        30 + (
                            palabrasTotales /
                            Math.max(
                                1,
                                estructura.reduce(
                                    (suma, l) =>
                                        suma + l.palabras.length,
                                    0
                                )
                            )
                        ) * 20,
                        "Reconociendo palabra " +
                        palabrasTotales
                    );

                    const recortePalabra = crearRecorte(
                        recorteBloque,
                        palabra.region,
                        4
                    );

                    await worker.setParameters({
                        tessedit_pageseg_mode: "8"
                    });

                    const lecturaPalabra =
                        await worker.recognize(recortePalabra);

                    const textoPalabra =
                        (lecturaPalabra.data.text || "")
                            .replace(/\s+/g, " ")
                            .trim();

                    const confianzaPalabra =
                        Number(lecturaPalabra.data.confidence) || 0;

                    palabrasDeLinea.push(textoPalabra);

                    confianzasPalabraBloque.push(
                        confianzaPalabra
                    );

                    confianzasPalabras.push(
                        confianzaPalabra
                    );
                }

                palabrasTexto.push(
                    palabrasDeLinea.join(" ")
                );

                // ==================================
                // PASADA 4: CARACTERES — PSM 10
                // ==================================

                const caracteresDeLinea = [];

                for (
                    let k = 0;
                    k < linea.palabras.length;
                    k++
                ) {

                    const palabra = linea.palabras[k];

                    const caracteresDePalabra = [];

                    for (
                        let m = 0;
                        m < palabra.simbolos.length;
                        m++
                    ) {

                        if (
                            caracteresTotales >=
                            LIMITE_CARACTERES
                        ) {

                            caracteresOmitidos++;
                            continue;
                        }

                        const simbolo = palabra.simbolos[m];

                        actualizarProgreso(
                            55 + (
                                caracteresTotales /
                                LIMITE_CARACTERES
                            ) * 35,
                            "Reconociendo carácter " +
                            (caracteresTotales + 1)
                        );

                        const recorteCaracter = crearRecorte(
                            recorteBloque,
                            simbolo.region,
                            3
                        );

                        await worker.setParameters({
                            tessedit_pageseg_mode: "10"
                        });

                        const lecturaCaracter =
                            await worker.recognize(recorteCaracter);

                        const textoCaracter =
                            (lecturaCaracter.data.text || "")
                                .replace(/\s+/g, "")
                                .trim();

                        const confianzaCaracter =
                            Number(lecturaCaracter.data.confidence) || 0;

                        caracteresDePalabra.push(
                            textoCaracter
                        );

                        confianzasCaracterBloque.push(
                            confianzaCaracter
                        );

                        confianzasCaracteres.push(
                            confianzaCaracter
                        );

                        caracteresTotales++;
                    }

                    caracteresDeLinea.push(
                        caracteresDePalabra.join("")
                    );
                }

                caracteresTexto.push(
                    caracteresDeLinea.join(" ")
                );
            }

            // ======================================
            // CONSTRUIR TEXTOS DEL BLOQUE
            // ======================================

            const textoLineas = lineasTexto
                .filter(t => t.length > 0)
                .join("\n");

            const textoPalabras = palabrasTexto
                .filter(t => t.length > 0)
                .join("\n");

            const textoCaracteres = caracteresTexto
                .filter(t => t.length > 0)
                .join("\n");

            // ======================================
            // CONFIANZAS MEDIAS
            // ======================================

            const confianzaMediaLineas =
                obtenerPromedio(confianzasLineaBloque);

            const confianzaMediaPalabras =
                obtenerPromedio(confianzasPalabraBloque);

            const confianzaMediaCaracteres =
                obtenerPromedio(confianzasCaracterBloque);

            // ======================================
            // COMPARACIONES
            // ======================================

            const comparaciones = [

                calcularCoincidencia(
                    textoBloque,
                    textoLineas
                ),

                calcularCoincidencia(
                    textoLineas,
                    textoPalabras
                ),

                calcularCoincidencia(
                    textoBloque,
                    textoPalabras
                ),

                calcularCoincidencia(
                    textoLineas,
                    textoCaracteres
                )
            ];

            coincidencias.push(
                ...comparaciones.filter(
                    valor => valor !== null
                )
            );

            // ======================================
            // GUARDAR RESULTADOS
            // ======================================

            resultadosInternos.push({

                bloque: i + 1,

                textoBloque,
                textoLineas,
                textoPalabras,
                textoCaracteres,

                confianzaBloque,
                confianzaLineas: confianzaMediaLineas,
                confianzaPalabras: confianzaMediaPalabras,
                confianzaCaracteres: confianzaMediaCaracteres,

                coincidencias: comparaciones,

                lineas: estructura.length,

                palabras: estructura.reduce(
                    (suma, linea) =>
                        suma + linea.palabras.length,
                    0
                ),

                caracteres: confianzasCaracterBloque.length

            });
        }

        // ------------------------------------------
        // F. FORMATEAR LAS CUATRO PASADAS
        // ------------------------------------------

        function formatearPasada(
            titulo,
            propiedadTexto,
            propiedadConfianza
        ) {

            let salida = "";

            salida +=
                "========== " +
                titulo +
                " ==========\n\n";

            for (const bloque of resultadosInternos) {

                salida +=
                    "----- BLOQUE " +
                    bloque.bloque +
                    " -----\n";

                salida +=
                    "Confianza: " +
                    formatearConfianza(
                        bloque[propiedadConfianza]
                    ) +
                    "\n\n";

                salida +=
                    bloque[propiedadTexto] ||
                    "(Sin texto reconocido)";

                salida += "\n\n";
            }

            return salida;
        }

        const resultadoBloques = formatearPasada(
            "RESULTADO 1: BLOQUES — PSM 6",
            "textoBloque",
            "confianzaBloque"
        );

        const resultadoLineas = formatearPasada(
            "RESULTADO 2: LÍNEAS — PSM 7",
            "textoLineas",
            "confianzaLineas"
        );

        const resultadoPalabras = formatearPasada(
            "RESULTADO 3: PALABRAS — PSM 8",
            "textoPalabras",
            "confianzaPalabras"
        );

        const resultadoCaracteres = formatearPasada(
            "RESULTADO 4: CARACTERES — PSM 10",
            "textoCaracteres",
            "confianzaCaracteres"
        );

        // ------------------------------------------
        // G. MOSTRAR RESULTADOS
        // ------------------------------------------

        resultado.value =

            resultadoBloques +

            "\n\n========================================\n\n" +

            resultadoLineas +

            "\n\n========================================\n\n" +

            resultadoPalabras +

            "\n\n========================================\n\n" +

            resultadoCaracteres;

        // ------------------------------------------
        // H. ESTADÍSTICAS
        // ------------------------------------------

        const promediosPasadas = [

            obtenerPromedio(confianzasBloques),

            obtenerPromedio(confianzasLineas),

            obtenerPromedio(confianzasPalabras),

            obtenerPromedio(confianzasCaracteres)

        ].filter(valor => valor !== null);

        const confianzaGeneral =
            obtenerPromedio(promediosPasadas);

        const coincidenciaMedia =
            obtenerPromedio(coincidencias);

        totalLineas.textContent =
            lineasTotales +
            (lineasTotales === 1 ? " línea" : " líneas");

        totalPalabras.textContent =
            palabrasTotales +
            (palabrasTotales === 1 ? " palabra" : " palabras");

        totalCaracteres.textContent =
            caracteresTotales +
            (caracteresTotales === 1
                ? " segmento"
                : " segmentos");

        confianza.textContent =
            "Confianza media: " +
            formatearConfianza(confianzaGeneral);

        coincidencia.textContent =
            "Coincidencia media: " +
            formatearConfianza(coincidenciaMedia);

        resumen.hidden = false;

        btnCopiar.disabled =
            resultado.value.length === 0;

        // ------------------------------------------
        // I. FINALIZAR
        // ------------------------------------------

        actualizarProgreso(
            100,
            "Todas las pasadas han terminado."
        );

        estadoResultado.textContent =
            "Comparación de pasadas completada";

        // ------------------------------------------
        // J. DIAGNÓSTICO
        // ------------------------------------------

        console.log(
            "RESULTADOS COMPLETOS DEL OCR"
        );

        console.table(resultadosInternos);

        console.log(
            "Estructura detectada:",
            estructuraResumen(resultadosInternos)
        );

        console.log(
            "Líneas:",
            lineasTotales
        );

        console.log(
            "Palabras:",
            palabrasTotales
        );

        console.log(
            "Caracteres reconocidos:",
            caracteresTotales
        );

        console.log(
            "Caracteres omitidos por límite:",
            caracteresOmitidos
        );

        if (caracteresOmitidos > 0) {

            estadoResultado.textContent =
                "Análisis terminado. Se alcanzó el límite de caracteres.";
        }

    } catch (error) {

        console.error("Error OCR:", error);

        estadoResultado.textContent =
            "Error en el análisis";

        estado.textContent =
            error.message || "Ocurrió un error.";

        alert(
            error.message ||
            "No se pudo completar el reconocimiento."
        );

    } finally {

        if (worker) {

            try {
                await worker.terminate();
            } catch (error) {
                console.error(
                    "Error al cerrar el motor OCR:",
                    error
                );
            }
        }

        trabajando = false;

        btnAnalizar.disabled = !imagenCargada;
        entradaImagen.disabled = false;
    }
}


// ==================================================
// 13. RESUMEN PARA CONSOLA
// ==================================================

function estructuraResumen(resultados) {

    return resultados.map(bloque => ({

        bloque: bloque.bloque,

        lineas: bloque.lineas,

        palabras: bloque.palabras,

        caracteres: bloque.caracteres,

        confianzaBloque: bloque.confianzaBloque,

        confianzaLineas: bloque.confianzaLineas,

        confianzaPalabras: bloque.confianzaPalabras,

        confianzaCaracteres: bloque.confianzaCaracteres

    }));
}


// ==================================================
// 14. COPIAR TEXTO
// ==================================================

btnCopiar.addEventListener("click", async () => {

    if (!resultado.value) return;

    try {

        await navigator.clipboard.writeText(
            resultado.value
        );

        estadoResultado.textContent =
            "Texto copiado";

    } catch (error) {

        resultado.select();

        document.execCommand("copy");

        estadoResultado.textContent =
            "Texto copiado";
    }
});


// ==================================================
// 15. LIMPIAR
// ==================================================

btnLimpiar.addEventListener("click", () => {

    if (trabajando) return;

    entradaImagen.value = "";

    imagenCargada = null;

    vistaPrevia.removeAttribute("src");

    contenedorVista.hidden = true;

    nombreArchivo.textContent =
        "Ningún documento seleccionado";

    resultado.value = "";

    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;

    progresoContenedor.hidden = true;
    resumen.hidden = true;

    barraProgreso.style.width = "0%";

    estadoResultado.textContent =
        "Esperando análisis";

    estado.textContent =
        "Preparando análisis...";
});
