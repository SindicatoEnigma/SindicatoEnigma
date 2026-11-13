
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
const confianza = document.getElementById("confianza");
const coincidencia = document.getElementById("coincidencia");

const totalPalabras = document.getElementById("totalPalabras");
const totalCaracteres = document.getElementById("totalCaracteres");

let imagenCargada = null;
let trabajando = false;


// ==================================================
// 1. SELECCIÓN DE IMAGEN
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
            resultado.value = "";
            btnCopiar.disabled = true;

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
// 2. PREPARAR IMAGEN
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

    contexto.drawImage(imagen, 0, 0, ancho, alto);

    return canvas;
}


// ==================================================
// 3. UMBRAL AUTOMÁTICO
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
// 4. OBTENER INFORMACIÓN BINARIA DE LA IMAGEN
// ==================================================

function obtenerMascara(canvas) {

    const contexto = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const ancho = canvas.width;
    const alto = canvas.height;

    const imagen = contexto.getImageData(
        0, 0, ancho, alto
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

            mascara[y * ancho + x] = esTexto ? 1 : 0;
        }
    }

    return {
        ancho,
        alto,
        mascara
    };
}


// ==================================================
// 5. DETECTAR BLOQUES
// ==================================================

function detectarBloques(canvas) {

    const { ancho, alto, mascara } =
        obtenerMascara(canvas);

    const ocupacionFilas = new Array(alto).fill(0);

    for (let y = 0; y < alto; y++) {

        for (let x = 0; x < ancho; x++) {
            ocupacionFilas[y] += mascara[y * ancho + x];
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

        for (let y = grupo.inicio; y <= grupo.fin; y++) {

            for (let x = 0; x < ancho; x++) {

                if (mascara[y * ancho + x]) {

                    izquierda = Math.min(izquierda, x);
                    derecha = Math.max(derecha, x);
                }
            }
        }

        if (derecha < izquierda) continue;

        const x = Math.max(0, izquierda - margenX);
        const y = Math.max(0, grupo.inicio - margenY);

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
// 6. DETECTAR LÍNEAS DENTRO DE UN BLOQUE
// ==================================================

function detectarLineas(canvas) {

    const { ancho, alto, mascara } =
        obtenerMascara(canvas);

    const ocupacion = new Array(alto).fill(0);

    for (let y = 0; y < alto; y++) {

        for (let x = 0; x < ancho; x++) {
            ocupacion[y] += mascara[y * ancho + x];
        }
    }

    const minimoPixeles = Math.max(
        1,
        Math.floor(ancho * 0.0004)
    );

    const franjas = [];

    let inicio = -1;
    let fin = -1;

    for (let y = 0; y < alto; y++) {

        if (ocupacion[y] >= minimoPixeles) {

            if (inicio === -1) inicio = y;

            fin = y;

        } else if (inicio !== -1) {

            franjas.push({ inicio, fin });

            inicio = -1;
            fin = -1;
        }
    }

    if (inicio !== -1) {
        franjas.push({ inicio, fin });
    }

    if (franjas.length === 0) return [];

    const alturas = franjas.map(
        f => f.fin - f.inicio + 1
    );

    const orden = [...alturas].sort((a, b) => a - b);

    const alturaMediana =
        orden[Math.floor(orden.length / 2)];

    const separacionMaxima = Math.max(
        2,
        Math.round(alturaMediana * 0.65)
    );

    const lineas = [];

    let linea = {
        inicio: franjas[0].inicio,
        fin: franjas[0].fin
    };

    for (let i = 1; i < franjas.length; i++) {

        const franja = franjas[i];

        const separacion =
            franja.inicio - linea.fin - 1;

        if (separacion <= separacionMaxima) {

            linea.fin = franja.fin;

        } else {

            lineas.push(linea);

            linea = {
                inicio: franja.inicio,
                fin: franja.fin
            };
        }
    }

    lineas.push(linea);

    const margen = Math.max(
        2,
        Math.round(alturaMediana * 0.35)
    );

    return lineas.map(linea => {

        const y = Math.max(0, linea.inicio - margen);

        const yFinal = Math.min(
            alto,
            linea.fin + margen + 1
        );

        return {
            x: 0,
            y,
            ancho,
            alto: yFinal - y
        };
    });
}


// ==================================================
// 7. DETECTAR PALABRAS DENTRO DE UNA LÍNEA
// ==================================================

function detectarPalabras(canvas) {

    const { ancho, alto, mascara } =
        obtenerMascara(canvas);

    const ocupacionColumnas = new Array(ancho).fill(0);

    for (let x = 0; x < ancho; x++) {

        for (let y = 0; y < alto; y++) {
            ocupacionColumnas[x] += mascara[y * ancho + x];
        }
    }

    const columnasActivas = [];

    for (let x = 0; x < ancho; x++) {

        if (ocupacionColumnas[x] > 0) {
            columnasActivas.push(x);
        }
    }

    if (columnasActivas.length === 0) return [];

    const grupos = [];

    let inicio = columnasActivas[0];
    let fin = columnasActivas[0];

    const unirHueco = Math.max(
        1,
        Math.round(alto * 0.07)
    );

    for (let i = 1; i < columnasActivas.length; i++) {

        const x = columnasActivas[i];
        const hueco = x - fin - 1;

        if (hueco <= unirHueco) {

            fin = x;

        } else {

            grupos.push({ inicio, fin });

            inicio = x;
            fin = x;
        }
    }

    grupos.push({ inicio, fin });

    if (grupos.length === 0) return [];

    const anchuras = grupos.map(
        g => g.fin - g.inicio + 1
    );

    const orden = [...anchuras].sort((a, b) => a - b);

    const anchuraMediana =
        orden[Math.floor(orden.length / 2)];

    const separacionPalabras = Math.max(
        3,
        Math.round(
            Math.max(anchuraMediana * 0.75, alto * 0.22)
        )
    );

    const palabras = [];

    let palabra = {
        inicio: grupos[0].inicio,
        fin: grupos[0].fin
    };

    for (let i = 1; i < grupos.length; i++) {

        const grupo = grupos[i];

        const hueco =
            grupo.inicio - palabra.fin - 1;

        if (hueco <= separacionPalabras) {

            palabra.fin = grupo.fin;

        } else {

            palabras.push(palabra);

            palabra = {
                inicio: grupo.inicio,
                fin: grupo.fin
            };
        }
    }

    palabras.push(palabra);

    const margenX = Math.max(
        2,
        Math.round(alto * 0.08)
    );

    return palabras.map(p => {

        const x = Math.max(0, p.inicio - margenX);

        const xFinal = Math.min(
            ancho,
            p.fin + margenX + 1
        );

        return {
            x,
            y: 0,
            ancho: xFinal - x,
            alto
        };
    });
}


// ==================================================
// 8. DETECTAR SEGMENTOS DE CARACTERES
// ==================================================

function detectarCaracteres(canvas) {

    const { ancho, alto, mascara } =
        obtenerMascara(canvas);

    const ocupacionColumnas = new Array(ancho).fill(0);

    for (let x = 0; x < ancho; x++) {

        for (let y = 0; y < alto; y++) {
            ocupacionColumnas[x] += mascara[y * ancho + x];
        }
    }

    const columnas = [];

    for (let x = 0; x < ancho; x++) {

        if (ocupacionColumnas[x] > 0) {
            columnas.push(x);
        }
    }

    if (columnas.length === 0) return [];

    const huecoUnir = Math.max(
        1,
        Math.round(alto * 0.035)
    );

    const grupos = [];

    let inicio = columnas[0];
    let fin = columnas[0];

    for (let i = 1; i < columnas.length; i++) {

        const x = columnas[i];

        if (x - fin - 1 <= huecoUnir) {

            fin = x;

        } else {

            grupos.push({ inicio, fin });

            inicio = x;
            fin = x;
        }
    }

    grupos.push({ inicio, fin });

    const segmentos = [];

    for (const grupo of grupos) {

        const anchura = grupo.fin - grupo.inicio + 1;

        if (anchura > alto * 0.95) {

            let valleX = -1;
            let menorOcupacion = Infinity;

            for (
                let x = grupo.inicio + 1;
                x < grupo.fin;
                x++
            ) {

                const ocupacion = ocupacionColumnas[x];

                if (ocupacion < menorOcupacion) {
                    menorOcupacion = ocupacion;
                    valleX = x;
                }
            }

            const umbralValle = Math.max(
                1,
                Math.floor(alto * 0.025)
            );

            if (
                valleX > grupo.inicio &&
                valleX < grupo.fin &&
                menorOcupacion <= umbralValle
            ) {

                segmentos.push({
                    inicio: grupo.inicio,
                    fin: valleX - 1
                });

                segmentos.push({
                    inicio: valleX + 1,
                    fin: grupo.fin
                });

                continue;
            }
        }

        segmentos.push(grupo);
    }

    const margen = Math.max(
        2,
        Math.round(alto * 0.08)
    );

    return segmentos.map(s => {

        const x = Math.max(0, s.inicio - margen);

        const xFinal = Math.min(
            ancho,
            s.fin + margen + 1
        );

        return {
            x,
            y: 0,
            ancho: xFinal - x,
            alto
        };
    });
}


// ==================================================
// 9. CREAR RECORTES
// ==================================================

function crearRecorte(canvasOriginal, region) {

    const recorte = document.createElement("canvas");

    recorte.width = Math.max(1, region.ancho);
    recorte.height = Math.max(1, region.alto);

    const contexto = recorte.getContext("2d");

    contexto.drawImage(
        canvasOriginal,

        region.x,
        region.y,
        region.ancho,
        region.alto,

        0,
        0,
        region.ancho,
        region.alto
    );

    if (recorte.height < 100) {

        const escala = Math.min(
            3,
            100 / recorte.height
        );

        const ampliado = document.createElement("canvas");

        ampliado.width = Math.max(
            1,
            Math.round(recorte.width * escala)
        );

        ampliado.height = Math.max(
            1,
            Math.round(recorte.height * escala)
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
// 10. COMPARAR DOS LECTURAS
// ==================================================

function normalizarTexto(texto) {

    return texto
        .replace(/\s+/g, " ")
        .trim();
}

function calcularCoincidencia(textoA, textoB) {

    const a = normalizarTexto(textoA);
    const b = normalizarTexto(textoB);

    if (!a.length && !b.length) return 100;
    if (!a.length || !b.length) return 0;

    const filaAnterior = new Array(b.length + 1);
    const filaActual = new Array(b.length + 1);

    for (let j = 0; j <= b.length; j++) {
        filaAnterior[j] = j;
    }

    for (let i = 1; i <= a.length; i++) {

        filaActual[0] = i;

        for (let j = 1; j <= b.length; j++) {

            const costo = a[i - 1] === b[j - 1] ? 0 : 1;

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
    const longitud = Math.max(a.length, b.length);

    return Math.max(
        0,
        (1 - distancia / longitud) * 100
    );
}


// ==================================================
// 11. PROGRESO
// ==================================================

function actualizarProgreso(porcentaje, mensaje) {

    barraProgreso.style.width =
        Math.min(100, Math.max(0, porcentaje)) + "%";

    estado.textContent = mensaje;
}


// ==================================================
// 12. ANALIZAR DOCUMENTO
// ==================================================


// ==================================================
// 12. ANALIZAR DOCUMENTO — COMPARAR TODAS LAS PASADAS
// ==================================================

btnAnalizar.addEventListener("click", analizarDocumento);

async function analizarDocumento() {

    if (!imagenCargada || trabajando) return;

    if (!window.Tesseract) {

        alert(
            "No se pudo cargar el motor OCR. Comprueba tu conexión."
        );

        return;
    }

    trabajando = true;

    btnAnalizar.disabled = true;
    entradaImagen.disabled = true;

    resultado.value = "";

    progresoContenedor.hidden = false;
    resumen.hidden = true;

    estadoResultado.textContent = "Analizando...";

    actualizarProgreso(2, "Preparando imagen...");

    let worker = null;

    try {

        // ------------------------------------------
        // PASO A: PREPARAR IMAGEN
        // ------------------------------------------

        const canvas = crearImagenTrabajo(imagenCargada);

        actualizarProgreso(
            8,
            "Localizando regiones de información..."
        );

        // ------------------------------------------
        // PASO B: DETECTAR BLOQUES
        // ------------------------------------------

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
        // PASO C: PREPARAR MOTOR OCR
        // ------------------------------------------

        worker = await Tesseract.createWorker(
            "spa+eng",
            1
        );

        // Guardaremos cada lectura por separado.
        const resultadosInternos = [];

        let lineasTotales = 0;
        let palabrasTotales = 0;
        let caracteresTotales = 0;
        let caracteresOmitidosTotales = 0;

        const confianzasBloques = [];
        const confianzasLineas = [];
        const confianzasPalabras = [];
        const confianzasCaracteres = [];

        const coincidencias = [];

        const LIMITE_CARACTERES = 300;

        // ------------------------------------------
        // PASO D: ANALIZAR CADA BLOQUE
        // ------------------------------------------

        for (let i = 0; i < bloques.length; i++) {

            actualizarProgreso(
                12 + (i / bloques.length) * 75,
                "Analizando bloque " +
                (i + 1) +
                " de " +
                bloques.length
            );

            const recorteBloque = crearRecorte(
                canvas,
                bloques[i]
            );

            // ======================================
            // LECTURA 1: BLOQUE COMPLETO — PSM 6
            // ======================================

            await worker.setParameters({
                tessedit_pageseg_mode: "6"
            });

            const lecturaBloque =
                await worker.recognize(recorteBloque);

            const textoBloque =
                (lecturaBloque.data.text || "").trim();

            const confianzaBloque =
                lecturaBloque.data.confidence || 0;

            confianzasBloques.push(confianzaBloque);

            // ======================================
            // LECTURA 2: LÍNEAS — PSM 7
            // ======================================

            const lineas = detectarLineas(recorteBloque);

            lineasTotales += lineas.length;

            const textosLinea = [];
            const confianzasLinea = [];
            const datosLineas = [];

            for (let j = 0; j < lineas.length; j++) {

                actualizarProgreso(
                    15 + (
                        (j + 1) / Math.max(1, lineas.length)
                    ) * 10,
                    "Bloque " + (i + 1) +
                    ": reconociendo línea " +
                    (j + 1) +
                    " de " +
                    lineas.length
                );

                const recorteLinea = crearRecorte(
                    recorteBloque,
                    lineas[j]
                );

                await worker.setParameters({
                    tessedit_pageseg_mode: "7"
                });

                const lecturaLinea =
                    await worker.recognize(recorteLinea);

                const textoLinea =
                    (lecturaLinea.data.text || "").trim();

                const confianzaLinea =
                    lecturaLinea.data.confidence || 0;

                textosLinea.push(textoLinea);
                confianzasLinea.push(confianzaLinea);

                datosLineas.push({
                    canvas: recorteLinea,
                    texto: textoLinea,
                    confianza: confianzaLinea
                });
            }

            const textoLineas = textosLinea
                .filter(t => t.length > 0)
                .join("\n");

            const confianzaMediaLineas =
                confianzasLinea.length > 0
                    ? confianzasLinea.reduce((a, b) => a + b, 0) /
                      confianzasLinea.length
                    : 0;

            confianzasLineas.push(...confianzasLinea);

            // ======================================
            // LECTURA 3: PALABRAS — PSM 8
            // ======================================

            const textosPalabraPorLinea = [];
            const confianzasPalabra = [];

            let palabrasDelBloque = 0;

            for (let j = 0; j < datosLineas.length; j++) {

                const datosLinea = datosLineas[j];

                const palabras = detectarPalabras(
                    datosLinea.canvas
                );

                const palabrasDeEstaLinea = [];

                palabrasDelBloque += palabras.length;
                palabrasTotales += palabras.length;

                for (let k = 0; k < palabras.length; k++) {

                    actualizarProgreso(
                        30 + (
                            palabrasTotales /
                            Math.max(1, lineasTotales * 8)
                        ) * 20,
                        "Reconociendo palabras del bloque " +
                        (i + 1)
                    );

                    const recortePalabra = crearRecorte(
                        datosLinea.canvas,
                        palabras[k]
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
                        lecturaPalabra.data.confidence || 0;

                    palabrasDeEstaLinea.push(textoPalabra);

                    confianzasPalabra.push(confianzaPalabra);
                }

                textosPalabraPorLinea.push(
                    palabrasDeEstaLinea
                        .filter(t => t.length > 0)
                        .join(" ")
                );
            }

            const textoPalabras = textosPalabraPorLinea
                .filter(t => t.length > 0)
                .join("\n");

            const confianzaMediaPalabras =
                confianzasPalabra.length > 0
                    ? confianzasPalabra.reduce((a, b) => a + b, 0) /
                      confianzasPalabra.length
                    : 0;

            confianzasPalabras.push(...confianzasPalabra);

            // ======================================
            // LECTURA 4: CARACTERES — PSM 10
            // ======================================

            const caracteresPorLinea = [];

            let caracteresDelBloque = 0;
            let caracteresOmitidos = 0;

            const confianzasCaracteresBloque = [];

            for (let j = 0; j < datosLineas.length; j++) {

                const palabras = detectarPalabras(
                    datosLineas[j].canvas
                );

                const palabrasCaracteres = [];

                for (let k = 0; k < palabras.length; k++) {

                    const recortePalabra = crearRecorte(
                        datosLineas[j].canvas,
                        palabras[k]
                    );

                    const segmentos = detectarCaracteres(
                        recortePalabra
                    );

                    const caracteresDeEstaPalabra = [];

                    for (let m = 0; m < segmentos.length; m++) {

                        if (
                            caracteresTotales >= LIMITE_CARACTERES
                        ) {

                            caracteresOmitidos++;
                            caracteresOmitidosTotales++;

                            continue;
                        }

                        actualizarProgreso(
                            55 + (
                                caracteresTotales /
                                LIMITE_CARACTERES
                            ) * 35,
                            "Reconociendo segmento " +
                            (caracteresTotales + 1) +
                            " de " +
                            LIMITE_CARACTERES
                        );

                        const recorteCaracter = crearRecorte(
                            recortePalabra,
                            segmentos[m]
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
                            lecturaCaracter.data.confidence || 0;

                        caracteresDeEstaPalabra.push(
                            textoCaracter
                        );

                        confianzasCaracteresBloque.push(
                            confianzaCaracter
                        );

                        confianzasCaracteres.push(
                            confianzaCaracter
                        );

                        caracteresTotales++;
                        caracteresDelBloque++;
                    }

                    palabrasCaracteres.push(
                        caracteresDeEstaPalabra.length > 0
                            ? caracteresDeEstaPalabra.join("")
                            : "(sin segmentos)"
                    );
                }

                caracteresPorLinea.push(
                    palabrasCaracteres.join(" ")
                );
            }

            const textoCaracteres = caracteresPorLinea
                .filter(t => t.length > 0)
                .join("\n");

            const confianzaMediaCaracteres =
                confianzasCaracteresBloque.length > 0
                    ? confianzasCaracteresBloque.reduce(
                        (a, b) => a + b, 0
                    ) / confianzasCaracteresBloque.length
                    : 0;

            // ======================================
            // COMPARAR TODAS LAS LECTURAS
            // ======================================

            const coincidenciaBloqueLineas =
                calcularCoincidencia(
                    textoBloque,
                    textoLineas
                );

            const coincidenciaLineasPalabras =
                calcularCoincidencia(
                    textoLineas,
                    textoPalabras
                );

            const coincidenciaBloquePalabras =
                calcularCoincidencia(
                    textoBloque,
                    textoPalabras
                );

            const coincidenciaLineasCaracteres =
                calcularCoincidencia(
                    textoLineas,
                    textoCaracteres
                );

            coincidencias.push(
                coincidenciaBloqueLineas,
                coincidenciaLineasPalabras,
                coincidenciaBloquePalabras,
                coincidenciaLineasCaracteres
            );

            // ======================================
            // GUARDAR RESULTADOS SIN DESCARTAR NINGUNO
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

                coincidenciaBloqueLineas,
                coincidenciaLineasPalabras,
                coincidenciaBloquePalabras,
                coincidenciaLineasCaracteres,

                lineas: lineas.length,
                palabras: palabrasDelBloque,
                caracteres: caracteresDelBloque,
                caracteresOmitidos

            });
        }

        // ------------------------------------------
        // PASO E: CONSTRUIR LOS CUATRO RESULTADOS
        // ------------------------------------------

        function formatearPasada(
            titulo,
            propiedadTexto,
            propiedadConfianza
        ) {

            let salida = "";

            salida += "========== " + titulo + " ==========\n\n";

            for (const bloque of resultadosInternos) {

                salida += "----- BLOQUE " +
                    bloque.bloque +
                    " -----\n";

                salida +=
                    "Confianza: " +
                    bloque[propiedadConfianza].toFixed(1) +
                    "%\n\n";

                salida +=
                    bloque[propiedadTexto] || "(Sin texto reconocido)";

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
        // PASO F: MOSTRAR TODO EN LA CAJA DE TEXTO
        // ------------------------------------------

        let textoCompleto = "";

        textoCompleto += resultadoBloques;

        textoCompleto +=
            "\n\n========================================\n\n";

        textoCompleto += resultadoLineas;

        textoCompleto +=
            "\n\n========================================\n\n";

        textoCompleto += resultadoPalabras;

        textoCompleto +=
            "\n\n========================================\n\n";

        textoCompleto += resultadoCaracteres;

        resultado.value = textoCompleto;

        // ------------------------------------------
        // PASO G: ESTADÍSTICAS GENERALES
        // ------------------------------------------

        function promedio(valores) {

            if (!valores.length) return 0;

            return valores.reduce((a, b) => a + b, 0) /
                valores.length;
        }

        const confianzaGeneral = promedio([
            promedio(confianzasBloques),
            promedio(confianzasLineas),
            promedio(confianzasPalabras),
            promedio(confianzasCaracteres)
        ].filter((valor, indice) => {

            return [
                confianzasBloques,
                confianzasLineas,
                confianzasPalabras,
                confianzasCaracteres
            ][indice].length > 0;
        }));

        const coincidenciaMedia = promedio(coincidencias);

        totalLineas.textContent =
            lineasTotales +
            (lineasTotales === 1 ? " línea" : " líneas");

        confianza.textContent =
            "Confianza media: " +
            confianzaGeneral.toFixed(1) +
            "%";

        coincidencia.textContent =
            "Coincidencia media: " +
            coincidenciaMedia.toFixed(1) +
            "%";

        if (totalPalabras) {

            totalPalabras.textContent =
                palabrasTotales +
                (palabrasTotales === 1 ? " palabra" : " palabras");
        }

        if (totalCaracteres) {

            totalCaracteres.textContent =
                caracteresTotales +
                (caracteresTotales === 1
                    ? " segmento"
                    : " segmentos");
        }

        resumen.hidden = false;

        btnCopiar.disabled = textoCompleto.length === 0;

        actualizarProgreso(
            100,
            "Todas las pasadas han terminado."
        );

        estadoResultado.textContent =
            "Comparación de pasadas completada";

        // ------------------------------------------
        // PASO H: INFORMACIÓN PARA DIAGNÓSTICO
        // ------------------------------------------

        console.log("RESULTADOS COMPLETOS DEL OCR");

        console.table(resultadosInternos);

        console.log(
            "Palabras detectadas:",
            palabrasTotales
        );

        console.log(
            "Segmentos reconocidos:",
            caracteresTotales
        );

        console.log(
            "Segmentos omitidos por límite:",
            caracteresOmitidosTotales
        );

        if (caracteresOmitidosTotales > 0) {

            estadoResultado.textContent =
                "Análisis terminado. Algunos segmentos fueron omitidos por el límite de seguridad.";
        }

    } catch (error) {

        console.error(error);

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
            await worker.terminate();
        }

        trabajando = false;

        btnAnalizar.disabled = !imagenCargada;
        entradaImagen.disabled = false;
    }
}

                



// ==================================================
// 13. COPIAR TEXTO
// ==================================================

btnCopiar.addEventListener("click", async () => {

    if (!resultado.value) return;

    try {

        await navigator.clipboard.writeText(
            resultado.value
        );

        estadoResultado.textContent = "Texto copiado";

    } catch (error) {

        resultado.select();
        document.execCommand("copy");

        estadoResultado.textContent = "Texto copiado";
    }
});


// ==================================================
// 14. LIMPIAR
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

    estadoResultado.textContent = "Esperando análisis";
    estado.textContent = "Preparando análisis...";
});
