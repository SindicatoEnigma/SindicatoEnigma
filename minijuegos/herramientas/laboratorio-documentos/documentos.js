// ============================================================
// SINDICATO ENIGMA
// LABORATORIO DE DOCUMENTOS OCR
// Version: 3.1 - Comparacion original/modificada
// Correccion: activacion automatica de botones
//
// Lecturas:
// PSM 6: Bloques
// PSM 7: Lineas
//
// Variantes:
// A) Imagen original
// B) Imagen en grises + contraste + ampliacion
// ============================================================


// ------------------------------------------------------------
// 1. ELEMENTOS HTML
// ------------------------------------------------------------

const imagenInput = document.getElementById("imagen");
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


// ------------------------------------------------------------
// 2. VARIABLES
// ------------------------------------------------------------

let archivoSeleccionado = null;
let imagenCargada = null;
let canvasOriginal = null;

let worker = null;
let idiomaWorker = null;
let procesando = false;


// ------------------------------------------------------------
// 3. UTILIDADES DE INTERFAZ
// ------------------------------------------------------------

function mostrarEstado(mensaje) {
    if (estado) {
        estado.textContent = mensaje;
    }
}

function actualizarProgreso(valor) {
    const porcentaje = Math.max(0, Math.min(100, valor));

    if (barraProgreso) {
        barraProgreso.style.width = porcentaje + "%";
    }
}

function actualizarResumen(mensaje) {
    if (resumen) {
        resumen.textContent = mensaje;
    }
}

function actualizarEstadistica(elemento, valor) {
    if (elemento) {
        elemento.textContent = valor;
    }
}


// ------------------------------------------------------------
// 4. CARGAR IMAGEN
// ------------------------------------------------------------

imagenInput.addEventListener("change", function (evento) {

    const archivo = evento.target.files[0];

    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
        mostrarEstado("Selecciona un archivo de imagen valido.");
        return;
    }

    archivoSeleccionado = archivo;

    // Deshabilitar botones mientras se carga la imagen.
    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;

    if (nombreArchivo) {
        nombreArchivo.textContent = archivo.name;
    }

    const lector = new FileReader();

    lector.onload = function (e) {

        const img = new Image();

        img.onload = function () {

            imagenCargada = img;

            // Habilitar analisis cuando la imagen este lista.
            btnAnalizar.disabled = false;

            // No hay resultados nuevos para copiar.
            btnCopiar.disabled = true;

            if (vistaPrevia) {
                vistaPrevia.src = e.target.result;
            }

            if (contenedorVista) {
                contenedorVista.hidden = false;
            }

            mostrarEstado("Imagen cargada correctamente.");
            actualizarResumen("Imagen lista para analizar.");

            if (resultado) {
                resultado.value = "";
            }
        };

        img.onerror = function () {
            mostrarEstado("No se pudo cargar la imagen.");
            btnAnalizar.disabled = true;
        };

        img.src = e.target.result;
    };

    lector.onerror = function () {
        mostrarEstado("No se pudo leer el archivo.");
        btnAnalizar.disabled = true;
    };

    lector.readAsDataURL(archivo);
});


// ------------------------------------------------------------
// 5. PREPARAR IMAGEN ORIGINAL
// ------------------------------------------------------------

function prepararImagenOriginal(img) {

    const canvas = document.createElement("canvas");

    const maximo = 2600;

    let ancho = img.naturalWidth;
    let alto = img.naturalHeight;

    const proporcion = Math.min(
        1,
        maximo / Math.max(ancho, alto)
    );

    ancho = Math.round(ancho * proporcion);
    alto = Math.round(alto * proporcion);

    canvas.width = ancho;
    canvas.height = alto;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, ancho, alto);

    return canvas;
}


// ------------------------------------------------------------
// 6. MODIFICAR IMAGEN
// ------------------------------------------------------------

function modificarImagen(canvasBase) {

    const factorAmpliacion = 1.5;
    const factorContraste = 1.18;

    const nuevoCanvas = document.createElement("canvas");

    nuevoCanvas.width = Math.round(
        canvasBase.width * factorAmpliacion
    );

    nuevoCanvas.height = Math.round(
        canvasBase.height * factorAmpliacion
    );

    const ctx = nuevoCanvas.getContext("2d", {
        willReadFrequently: true
    });

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
        canvasBase,
        0,
        0,
        nuevoCanvas.width,
        nuevoCanvas.height
    );

    const imagenDatos = ctx.getImageData(
        0,
        0,
        nuevoCanvas.width,
        nuevoCanvas.height
    );

    const pixeles = imagenDatos.data;

    for (let i = 0; i < pixeles.length; i += 4) {

        const rojo = pixeles[i];
        const verde = pixeles[i + 1];
        const azul = pixeles[i + 2];

        let gris =
            0.299 * rojo +
            0.587 * verde +
            0.114 * azul;

        gris = (gris - 128) * factorContraste + 128;

        gris = Math.max(0, Math.min(255, gris));

        pixeles[i] = gris;
        pixeles[i + 1] = gris;
        pixeles[i + 2] = gris;
    }

    ctx.putImageData(imagenDatos, 0, 0);

    return nuevoCanvas;
}


// ------------------------------------------------------------
// 7. CREAR O REUTILIZAR TESSERACT
// ------------------------------------------------------------

async function obtenerWorker() {

    const selectorIdioma = document.getElementById("idioma");

    const idioma = selectorIdioma
        ? selectorIdioma.value
        : "spa+eng";

    if (worker && idiomaWorker === idioma) {
        return worker;
    }

    if (worker) {
        await worker.terminate();
        worker = null;
    }

    mostrarEstado("Cargando motor OCR...");

    worker = await Tesseract.createWorker(
        idioma,
        1,
        {
            logger: function (mensaje) {

                if (mensaje.status === "recognizing text") {

                    const porcentaje = mensaje.progress * 100;

                    actualizarProgreso(porcentaje);
                }
            }
        }
    );

    idiomaWorker = idioma;

    return worker;
}


// ------------------------------------------------------------
// 8. RECONOCIMIENTO POR BLOQUES - PSM 6
// ------------------------------------------------------------

async function reconocerBloques(canvas, motor) {

    await motor.setParameters({
        tessedit_pageseg_mode: "6"
    });

    const reconocimiento = await motor.recognize(canvas);

    return reconocimiento.data;
}


// ------------------------------------------------------------
// 9. EXTRAER LINEAS DE LA ESTRUCTURA TESSERACT
// ------------------------------------------------------------

function extraerLineas(datos) {

    const lineas = [];

    if (datos.blocks) {

        for (const bloque of datos.blocks) {

            if (!bloque.paragraphs) continue;

            for (const parrafo of bloque.paragraphs) {

                if (!parrafo.lines) continue;

                for (const linea of parrafo.lines) {

                    if (!linea.bbox) continue;

                    const texto = (linea.text || "").trim();

                    if (!texto) continue;

                    lineas.push({
                        texto: texto,
                        bbox: linea.bbox,
                        confianza: linea.confidence || 0
                    });
                }
            }
        }
    }

    if (lineas.length === 0 && datos.lines) {

        for (const linea of datos.lines) {

            if (!linea.bbox) continue;

            const texto = (linea.text || "").trim();

            if (!texto) continue;

            lineas.push({
                texto: texto,
                bbox: linea.bbox,
                confianza: linea.confidence || 0
            });
        }
    }

    return lineas;
}


// ------------------------------------------------------------
// 10. RECORTAR UNA LINEA
// ------------------------------------------------------------

function crearRecorteLinea(canvas, bbox) {

    const margen = 5;

    const x0 = Math.max(
        0,
        Math.floor(bbox.x0 - margen)
    );

    const y0 = Math.max(
        0,
        Math.floor(bbox.y0 - margen)
    );

    const x1 = Math.min(
        canvas.width,
        Math.ceil(bbox.x1 + margen)
    );

    const y1 = Math.min(
        canvas.height,
        Math.ceil(bbox.y1 + margen)
    );

    const ancho = x1 - x0;
    const alto = y1 - y0;

    if (ancho <= 0 || alto <= 0) {
        return null;
    }

    const recorte = document.createElement("canvas");

    recorte.width = ancho;
    recorte.height = alto;

    const ctx = recorte.getContext("2d");

    ctx.drawImage(
        canvas,
        x0,
        y0,
        ancho,
        alto,
        0,
        0,
        ancho,
        alto
    );

    if (alto < 100) {

        const factor = Math.min(2.5, 100 / alto);

        const ampliado = document.createElement("canvas");

        ampliado.width = Math.round(ancho * factor);
        ampliado.height = Math.round(alto * factor);

        const ctxAmpliado = ampliado.getContext("2d");

        ctxAmpliado.imageSmoothingEnabled = true;
        ctxAmpliado.imageSmoothingQuality = "high";

        ctxAmpliado.drawImage(
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


// ------------------------------------------------------------
// 11. RECONOCIMIENTO POR LINEAS - PSM 7
// ------------------------------------------------------------

async function reconocerLineas(canvas, datosBloques, motor) {

    const lineas = extraerLineas(datosBloques);

    if (lineas.length === 0) {

        return {
            texto: datosBloques.text || "",
            confianza: datosBloques.confidence || 0,
            cantidad: 0,
            alternativa: true
        };
    }

    await motor.setParameters({
        tessedit_pageseg_mode: "7"
    });

    const resultados = [];

    let sumaConfianza = 0;
    let cantidadConfianza = 0;

    for (let i = 0; i < lineas.length; i++) {

        const linea = lineas[i];

        const recorte = crearRecorteLinea(
            canvas,
            linea.bbox
        );

        if (!recorte) continue;

        const lectura = await motor.recognize(recorte);

        const texto = (lectura.data.text || "").trim();

        resultados.push(texto);

        if (typeof lectura.data.confidence === "number") {

            sumaConfianza += lectura.data.confidence;
            cantidadConfianza++;
        }
    }

    const confianzaMedia = cantidadConfianza > 0
        ? sumaConfianza / cantidadConfianza
        : 0;

    return {
        texto: resultados.join("\n"),
        confianza: confianzaMedia,
        cantidad: resultados.length,
        alternativa: false
    };
}


// ------------------------------------------------------------
// 12. COMPARAR DOS TEXTOS
// ------------------------------------------------------------

function calcularCoincidencia(textoA, textoB) {

    const a = textoA.replace(/\s+/g, " ").trim();
    const b = textoB.replace(/\s+/g, " ").trim();

    if (!a.length && !b.length) return 100;

    if (!a.length || !b.length) return 0;

    const anterior = new Array(b.length + 1);
    const actual = new Array(b.length + 1);

    for (let j = 0; j <= b.length; j++) {
        anterior[j] = j;
    }

    for (let i = 1; i <= a.length; i++) {

        actual[0] = i;

        for (let j = 1; j <= b.length; j++) {

            const costo = a[i - 1] === b[j - 1] ? 0 : 1;

            actual[j] = Math.min(
                anterior[j] + 1,
                actual[j - 1] + 1,
                anterior[j - 1] + costo
            );
        }

        for (let j = 0; j <= b.length; j++) {
            anterior[j] = actual[j];
        }
    }

    const distancia = anterior[b.length];

    const longitud = Math.max(a.length, b.length);

    return Math.max(
        0,
        (1 - distancia / longitud) * 100
    );
}


// ------------------------------------------------------------
// 13. EJECUTAR LAS DOS PASADAS SOBRE UNA IMAGEN
// ------------------------------------------------------------

async function analizarVariante(canvas, nombre, motor) {

    mostrarEstado("Analizando " + nombre + "...");

    const datosBloques = await reconocerBloques(
        canvas,
        motor
    );

    const textoBloques = datosBloques.text || "";

    const confianzaBloques = datosBloques.confidence || 0;

    mostrarEstado("Reconociendo lineas de " + nombre + "...");

    const lecturaLineas = await reconocerLineas(
        canvas,
        datosBloques,
        motor
    );

    return {
        nombre: nombre,

        bloques: {
            texto: textoBloques,
            confianza: confianzaBloques
        },

        lineas: {
            texto: lecturaLineas.texto,
            confianza: lecturaLineas.confianza,
            cantidad: lecturaLineas.cantidad,
            alternativa: lecturaLineas.alternativa
        },

        estructura: extraerLineas(datosBloques),
        datos: datosBloques
    };
}


// ------------------------------------------------------------
// 14. CONTAR ELEMENTOS
// ------------------------------------------------------------

function contarPalabras(texto) {

    return texto.trim()
        ? texto.trim().split(/\s+/).length
        : 0;
}

function contarCaracteres(texto) {
    return texto.length;
}

function contarBloques(datos) {

    if (!datos.blocks) return 0;

    return datos.blocks.filter(b => b.paragraphs).length;
}


// ------------------------------------------------------------
// 15. MOSTRAR RESULTADOS
// ------------------------------------------------------------

function construirResultado(original, modificada) {

    let salida = "";

    salida += "========================================\n";
    salida += "SINDICATO ENIGMA - LABORATORIO OCR\n";
    salida += "COMPARACION DE IMAGENES\n";
    salida += "========================================\n\n";

    salida += "LECTURA 1: IMAGEN ORIGINAL - BLOQUES PSM 6\n";
    salida += "Confianza: " +
        original.bloques.confianza.toFixed(1) + "%\n\n";

    salida += original.bloques.texto;

    salida += "\n\n========================================\n\n";

    salida += "LECTURA 2: IMAGEN ORIGINAL - LINEAS PSM 7\n";
    salida += "Confianza: " +
        original.lineas.confianza.toFixed(1) + "%\n\n";

    if (original.lineas.alternativa) {
        salida += "(No se pudieron extraer lineas independientes. ";
        salida += "Se muestra la lectura de bloques.)\n\n";
    }

    salida += original.lineas.texto;

    salida += "\n\n========================================\n\n";

    salida += "LECTURA 3: IMAGEN MODIFICADA - BLOQUES PSM 6\n";
    salida += "Confianza: " +
        modificada.bloques.confianza.toFixed(1) + "%\n\n";

    salida += modificada.bloques.texto;

    salida += "\n\n========================================\n\n";

    salida += "LECTURA 4: IMAGEN MODIFICADA - LINEAS PSM 7\n";
    salida += "Confianza: " +
        modificada.lineas.confianza.toFixed(1) + "%\n\n";

    if (modificada.lineas.alternativa) {
        salida += "(No se pudieron extraer lineas independientes. ";
        salida += "Se muestra la lectura de bloques.)\n\n";
    }

    salida += modificada.lineas.texto;

    salida += "\n\n========================================\n";
    salida += "COMPARACION DE RESULTADOS\n";
    salida += "========================================\n\n";

    const coincidenciaBloques = calcularCoincidencia(
        original.bloques.texto,
        modificada.bloques.texto
    );

    const coincidenciaLineas = calcularCoincidencia(
        original.lineas.texto,
        modificada.lineas.texto
    );

    salida += "Coincidencia PSM 6 original/modificada: ";
    salida += coincidenciaBloques.toFixed(1) + "%\n";

    salida += "Coincidencia PSM 7 original/modificada: ";
    salida += coincidenciaLineas.toFixed(1) + "%\n";

    return {
        texto: salida,
        coincidenciaBloques: coincidenciaBloques,
        coincidenciaLineas: coincidenciaLineas
    };
}


// ------------------------------------------------------------
// 16. ACTUALIZAR ESTADISTICAS
// ------------------------------------------------------------

function actualizarEstadisticas(original, modificada) {

    const texto = original.bloques.texto;

    const bloques = contarBloques(original.datos);

    const lineas = original.estructura.length;

    actualizarEstadistica(totalBloques, bloques);
    actualizarEstadistica(totalLineas, lineas);
    actualizarEstadistica(totalPalabras, contarPalabras(texto));
    actualizarEstadistica(totalCaracteres, contarCaracteres(texto));

    const promedioConfianza = (
        original.bloques.confianza +
        original.lineas.confianza +
        modificada.bloques.confianza +
        modificada.lineas.confianza
    ) / 4;

    actualizarEstadistica(
        confianza,
        promedioConfianza.toFixed(1) + "%"
    );

    const comparacionBloques = calcularCoincidencia(
        original.bloques.texto,
        modificada.bloques.texto
    );

    actualizarEstadistica(
        coincidencia,
        comparacionBloques.toFixed(1) + "%"
    );

    actualizarResumen(
        "Se completaron las cuatro lecturas. " +
        "Dos sobre la imagen original y dos sobre la imagen modificada."
    );
}


// ------------------------------------------------------------
// 17. BOTON ANALIZAR
// ------------------------------------------------------------

btnAnalizar.addEventListener("click", async function () {

    if (procesando) return;

    if (!imagenCargada) {
        mostrarEstado("Primero selecciona una imagen.");
        return;
    }

    procesando = true;

    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;

    if (resultado) {
        resultado.value = "";
    }

    if (progresoContenedor) {
        progresoContenedor.hidden = false;
    }

    actualizarProgreso(0);

    try {

        mostrarEstado("Preparando imagen original...");

        canvasOriginal = prepararImagenOriginal(
            imagenCargada
        );

        mostrarEstado("Preparando imagen modificada...");

        const canvasModificado = modificarImagen(
            canvasOriginal
        );

        const motor = await obtenerWorker();

        mostrarEstado("Primera fase: imagen original.");

        const original = await analizarVariante(
            canvasOriginal,
            "imagen original",
            motor
        );

        actualizarProgreso(45);

        mostrarEstado("Segunda fase: imagen modificada.");

        const modificada = await analizarVariante(
            canvasModificado,
            "imagen modificada",
            motor
        );

        actualizarProgreso(90);

        const comparacion = construirResultado(
            original,
            modificada
        );

        if (resultado) {
            resultado.value = comparacion.texto;
        }

        // HABILITAR COPIAR SI HAY TEXTO.
        btnCopiar.disabled = !(
            resultado && resultado.value.trim().length > 0
        );

        actualizarEstadisticas(
            original,
            modificada
        );

        actualizarProgreso(100);

        mostrarEstado("Analisis completado.");

        if (estadoResultado) {
            estadoResultado.textContent =
                "Cuatro lecturas completadas correctamente.";
        }

    } catch (error) {

        console.error("Error OCR:", error);

        mostrarEstado(
            "Ocurrio un error durante el reconocimiento."
        );

        if (resultado) {
            resultado.value +=
                "\n\nERROR:\n" + error.message;
        }

        // No habilitar copiar si no hay resultados utiles.
        btnCopiar.disabled = !(
            resultado && resultado.value.trim().length > 0
        );

    } finally {

        procesando = false;

        btnAnalizar.disabled = !imagenCargada;
    }
});


// ------------------------------------------------------------
// 18. BOTON COPIAR
// ------------------------------------------------------------

btnCopiar.addEventListener("click", async function () {

    if (!resultado || !resultado.value.trim()) {
        mostrarEstado("No hay resultados para copiar.");
        btnCopiar.disabled = true;
        return;
    }

    try {

        await navigator.clipboard.writeText(
            resultado.value
        );

        mostrarEstado("Resultados copiados.");

    } catch (error) {

        try {

            resultado.focus();
            resultado.select();

            const copiaCorrecta = document.execCommand("copy");

            if (copiaCorrecta) {
                mostrarEstado("Resultados copiados.");
            } else {
                mostrarEstado("No se pudo copiar automaticamente.");
            }

        } catch (errorCopia) {

            mostrarEstado("No se pudo copiar el texto.");
        }
    }
});


// ------------------------------------------------------------
// 19. BOTON LIMPIAR
// ------------------------------------------------------------

btnLimpiar.addEventListener("click", function () {

    if (procesando) return;

    archivoSeleccionado = null;
    imagenCargada = null;
    canvasOriginal = null;

    if (imagenInput) {
        imagenInput.value = "";
    }

    if (vistaPrevia) {
        vistaPrevia.src = "";
    }

    if (contenedorVista) {
        contenedorVista.hidden = true;
    }

    if (nombreArchivo) {
        nombreArchivo.textContent = "";
    }

    if (resultado) {
        resultado.value = "";
    }

    // Deshabilitar ambos botones al limpiar.
    btnAnalizar.disabled = true;
    btnCopiar.disabled = true;

    actualizarProgreso(0);

    actualizarResumen("Esperando una imagen.");

    mostrarEstado("Laboratorio limpio.");

    if (estadoResultado) {
        estadoResultado.textContent = "";
    }

    actualizarEstadistica(totalBloques, "0");
    actualizarEstadistica(totalLineas, "0");
    actualizarEstadistica(totalPalabras, "0");
    actualizarEstadistica(totalCaracteres, "0");
    actualizarEstadistica(confianza, "0%");
    actualizarEstadistica(coincidencia, "0%");
});


// ------------------------------------------------------------
// 20. ESTADO INICIAL
// ------------------------------------------------------------

btnAnalizar.disabled = true;
btnCopiar.disabled = true;

mostrarEstado("Laboratorio listo.");

actualizarResumen("Selecciona una imagen para comenzar.");

actualizarProgreso(0);
