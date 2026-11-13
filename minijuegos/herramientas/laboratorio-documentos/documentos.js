
"use strict";

// ==================================================
// 1. ELEMENTOS HTML
// ==================================================

const entradaImagen = document.getElementById("entradaImagen");
const zonaCarga = document.getElementById("zonaCarga");

const contenedorVista = document.getElementById("contenedorVista");
const imagenVista = document.getElementById("imagenVista");
const nombreImagen = document.getElementById("nombreImagen");

const btnQuitarImagen = document.getElementById("btnQuitarImagen");
const btnReconocer = document.getElementById("btnReconocer");
const btnCopiar = document.getElementById("btnCopiar");
const btnLimpiarTexto = document.getElementById("btnLimpiarTexto");
const btnLimpiarTodo = document.getElementById("btnLimpiarTodo");

const modoReconocimiento = document.getElementById("modoReconocimiento");
const idiomaOCR = document.getElementById("idiomaOCR");
const preprocesamiento = document.getElementById("preprocesamiento");
const segmentacion = document.getElementById("segmentacion");

const textoResultado = document.getElementById("textoResultado");

const contenedorProgreso = document.getElementById("contenedorProgreso");
const estadoProceso = document.getElementById("estadoProceso");
const porcentaje = document.getElementById("porcentaje");
const barraProgreso = document.getElementById("barraProgreso");

const mensajeEstado = document.getElementById("mensajeEstado");
const mensajeCopia = document.getElementById("mensajeCopia");

const contenedorConfianza = document.getElementById("contenedorConfianza");
const valorConfianza = document.getElementById("valorConfianza");

const totalCaracteres = document.getElementById("totalCaracteres");
const totalPalabras = document.getElementById("totalPalabras");


// ==================================================
// 2. VARIABLES
// ==================================================

let archivoSeleccionado = null;
let direccionImagen = null;

let trabajadorOCR = null;
let idiomaTrabajador = null;

let procesando = false;

const TAMANO_MAXIMO = 20 * 1024 * 1024;


// ==================================================
// 3. CARGAR IMAGEN
// ==================================================

entradaImagen.addEventListener("change", function () {

    const archivo = this.files[0];

    if (archivo) {
        cargarImagen(archivo);
    }

});


function cargarImagen(archivo) {

    if (procesando) return;

    if (!archivo.type.startsWith("image/")) {

        mensajeEstado.textContent =
            "El archivo seleccionado no es una imagen válida.";

        return;
    }

    if (archivo.size > TAMANO_MAXIMO) {

        mensajeEstado.textContent =
            "La imagen supera el límite de 20 MB.";

        entradaImagen.value = "";

        return;
    }

    if (direccionImagen) {
        URL.revokeObjectURL(direccionImagen);
    }

    archivoSeleccionado = archivo;

    direccionImagen = URL.createObjectURL(archivo);

    imagenVista.src = direccionImagen;

    nombreImagen.textContent = archivo.name;

    contenedorVista.hidden = false;

    btnReconocer.disabled = false;

    mensajeEstado.textContent =
        "Imagen cargada. Configura el reconocimiento.";

    mensajeCopia.textContent = "";

    contenedorProgreso.hidden = true;

    contenedorConfianza.hidden = true;

}


// ==================================================
// 4. ARRASTRAR Y SOLTAR
// ==================================================

zonaCarga.addEventListener("dragover", function (evento) {

    evento.preventDefault();

    zonaCarga.classList.add("arrastrando");

});


zonaCarga.addEventListener("dragleave", function () {

    zonaCarga.classList.remove("arrastrando");

});


zonaCarga.addEventListener("drop", function (evento) {

    evento.preventDefault();

    zonaCarga.classList.remove("arrastrando");

    const archivo = evento.dataTransfer.files[0];

    if (archivo) {
        cargarImagen(archivo);
        entradaImagen.value = "";
    }

});


// ==================================================
// 5. PREPARAR IMAGEN PARA OCR
// ==================================================

async function prepararImagen(archivo, tipo) {

    const imagen = new Image();

    const urlTemporal = URL.createObjectURL(archivo);

    try {

        imagen.src = urlTemporal;

        await new Promise((resolve, reject) => {

            imagen.onload = resolve;

            imagen.onerror = reject;

        });

        const anchoOriginal = imagen.naturalWidth;
        const altoOriginal = imagen.naturalHeight;

        // Evitar imágenes demasiado pequeñas y limitar
        // el tamaño máximo para controlar el consumo de memoria.

        const dimensionMayor = Math.max(
            anchoOriginal,
            altoOriginal
        );

        const escala = Math.min(
            2.5,
            2600 / dimensionMayor
        );

        const ancho = Math.max(
            1,
            Math.round(anchoOriginal * escala)
        );

        const alto = Math.max(
            1,
            Math.round(altoOriginal * escala)
        );

        const canvas = document.createElement("canvas");

        canvas.width = ancho;
        canvas.height = alto;

        const contexto = canvas.getContext("2d", {
            willReadFrequently: true
        });

        contexto.drawImage(imagen, 0, 0, ancho, alto);

        if (tipo === "original") {
            return canvas;
        }

        const imagenDatos = contexto.getImageData(
            0,
            0,
            ancho,
            alto
        );

        const pixeles = imagenDatos.data;

        const histograma = new Array(256).fill(0);

        // Convertir los colores a niveles de gris.

        for (let i = 0; i < pixeles.length; i += 4) {

            const gris = Math.round(
                0.299 * pixeles[i] +
                0.587 * pixeles[i + 1] +
                0.114 * pixeles[i + 2]
            );

            pixeles[i] = gris;
            pixeles[i + 1] = gris;
            pixeles[i + 2] = gris;

            histograma[gris]++;

        }

        // Mejorar contraste.

        if (tipo === "contraste") {

            const factor = 1.6;

            for (let i = 0; i < pixeles.length; i += 4) {

                let gris = pixeles[i];

                gris = (gris - 128) * factor + 128;

                gris = Math.max(
                    0,
                    Math.min(255, gris)
                );

                pixeles[i] = gris;
                pixeles[i + 1] = gris;
                pixeles[i + 2] = gris;

            }

        }

        // Binarización mediante el método de Otsu.

        if (tipo === "binario") {

            const umbral = calcularUmbralOtsu(
                histograma,
                ancho * alto
            );

            for (let i = 0; i < pixeles.length; i += 4) {

                const color = pixeles[i] > umbral ? 255 : 0;

                pixeles[i] = color;
                pixeles[i + 1] = color;
                pixeles[i + 2] = color;

            }

        }

        contexto.putImageData(imagenDatos, 0, 0);

        return canvas;

    } finally {

        URL.revokeObjectURL(urlTemporal);

    }

}


// ==================================================
// 6. CALCULAR UMBRAL DE OT SU
// ==================================================

function calcularUmbralOtsu(histograma, totalPixeles) {

    let sumaTotal = 0;

    for (let i = 0; i < 256; i++) {
        sumaTotal += i * histograma[i];
    }

    let sumaFondo = 0;
    let pesoFondo = 0;

    let varianzaMaxima = 0;
    let umbral = 127;

    for (let i = 0; i < 256; i++) {

        pesoFondo += histograma[i];

        if (pesoFondo === 0) continue;

        const pesoObjeto = totalPixeles - pesoFondo;

        if (pesoObjeto === 0) break;

        sumaFondo += i * histograma[i];

        const mediaFondo = sumaFondo / pesoFondo;

        const mediaObjeto =
            (sumaTotal - sumaFondo) / pesoObjeto;

        const diferencia = mediaFondo - mediaObjeto;

        const varianza =
            pesoFondo *
            pesoObjeto *
            diferencia *
            diferencia;

        if (varianza > varianzaMaxima) {

            varianzaMaxima = varianza;

            umbral = i;

        }

    }

    return umbral;

}


// ==================================================
// 7. CONFIGURAR MODO DE RECONOCIMIENTO
// ==================================================

modoReconocimiento.addEventListener("change", function () {

    if (this.value === "codigo") {

        idiomaOCR.value = "eng";

        preprocesamiento.value = "contraste";

        segmentacion.value = "bloque";

    } else {

        idiomaOCR.value = "spa";

        preprocesamiento.value = "contraste";

        segmentacion.value = "bloque";

    }

});


// ==================================================
// 8. CONFIGURAR SEGMENTACIÓN
// ==================================================

function obtenerModoSegmentacion() {

    const modos = {

        bloque: "6",

        disperso: "11",

        linea: "7"

    };

    return modos[segmentacion.value] || "6";

}


// ==================================================
// 9. CREAR O REUTILIZAR MOTOR OCR
// ==================================================

async function obtenerTrabajador(idioma) {

    if (typeof Tesseract === "undefined") {

        throw new Error(
            "No se pudo cargar Tesseract.js."
        );

    }

    // Si cambiamos de idioma, hay que crear
    // un trabajador nuevo.

    if (
        trabajadorOCR &&
        idiomaTrabajador !== idioma
    ) {

        await trabajadorOCR.terminate();

        trabajadorOCR = null;

        idiomaTrabajador = null;

    }

    if (!trabajadorOCR) {

        trabajadorOCR = await Tesseract.createWorker(
            idioma,
            1,
            {

                workerPath:
                    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",

                corePath:
                    "https://cdn.jsdelivr.net/npm/tesseract.js-core@5",

                langPath:
                    "https://tessdata.projectnaptha.com/4.0.0",

                logger: function (informacion) {

                    if (informacion.status) {

                        const estados = {

                            "loading tesseract core":
                                "Cargando motor OCR...",

                            "initializing tesseract":
                                "Inicializando motor...",

                            "loading language traineddata":
                                "Descargando idioma...",

                            "initializing api":
                                "Preparando reconocimiento...",

                            "recognizing text":
                                "Reconociendo caracteres..."

                        };

                        const descripcion =
                            estados[informacion.status] ||
                            "Procesando...";

                        const avance = informacion.progress
                            ? Math.round(informacion.progress * 100)
                            : 0;

                        actualizarProgreso(
                            avance,
                            descripcion
                        );

                    }

                }

            }

        );

        idiomaTrabajador = idioma;

    }

    return trabajadorOCR;

}


// ==================================================
// 10. INICIAR RECONOCIMIENTO
// ==================================================

btnReconocer.addEventListener(
    "click",
    iniciarReconocimiento
);


async function iniciarReconocimiento() {

    if (!archivoSeleccionado || procesando) {
        return;
    }

    procesando = true;

    cambiarEstadoBotones(true);

    contenedorProgreso.hidden = false;

    contenedorConfianza.hidden = true;

    actualizarProgreso(
        0,
        "Preparando imagen..."
    );

    mensajeEstado.textContent =
        "Preparando la imagen para el reconocimiento.";

    try {

        const idioma = idiomaOCR.value;

        const tipoImagen = preprocesamiento.value;

        const modoPagina = obtenerModoSegmentacion();

        // Preparar imagen.

        const imagenPreparada = await prepararImagen(
            archivoSeleccionado,
            tipoImagen
        );

        actualizarProgreso(
            5,
            "Preparando motor OCR..."
        );

        // Crear motor.

        const trabajador = await obtenerTrabajador(idioma);

        // Configurar el motor para la distribución
        // de texto seleccionada.

        await trabajador.setParameters({

            tessedit_pageseg_mode: modoPagina,

            preserve_interword_spaces: "1",

            user_defined_dpi: "300"

        });

        actualizarProgreso(
            10,
            "Iniciando reconocimiento..."
        );

        mensajeEstado.textContent =
            "Reconociendo caracteres. Espera a que termine.";

        // Reconocimiento sin listas blancas ni
        // correcciones automáticas del contenido.

        const resultado = await trabajador.recognize(
            imagenPreparada
        );

        const texto = resultado.data.text || "";

        textoResultado.value = texto;

        // Mostrar confianza estimada.

        const confianza = resultado.data.confidence;

        if (typeof confianza === "number") {

            valorConfianza.textContent =
                Math.round(confianza) + "%";

            contenedorConfianza.hidden = false;

        }

        actualizarEstadisticas();

        if (texto.trim()) {

            mensajeEstado.textContent =
                "Reconocimiento terminado. Puedes revisar el resultado o cambiar la configuración y repetir.";

        } else {

            mensajeEstado.textContent =
                "No se encontraron caracteres reconocibles.";

        }

        actualizarProgreso(
            100,
            "Reconocimiento terminado."
        );

        actualizarBotonCopiar();

    } catch (error) {

        console.error("Error durante OCR:", error);

        mensajeEstado.textContent =
            "Ocurrió un error. Comprueba tu conexión a internet y vuelve a intentarlo.";

        actualizarProgreso(
            0,
            "Error de reconocimiento."
        );

    } finally {

        procesando = false;

        cambiarEstadoBotones(false);

        actualizarBotonCopiar();

    }

}


// ==================================================
// 11. PROGRESO
// ==================================================

function actualizarProgreso(valor, descripcion) {

    const seguro = Math.max(
        0,
        Math.min(100, valor)
    );

    barraProgreso.value = seguro;

    porcentaje.textContent = seguro + "%";

    estadoProceso.textContent = descripcion;

}


// ==================================================
// 12. BLOQUEAR BOTONES DURANTE PROCESAMIENTO
// ==================================================

function cambiarEstadoBotones(bloqueado) {

    btnReconocer.disabled =
        bloqueado || !archivoSeleccionado;

    btnQuitarImagen.disabled = bloqueado;

    btnLimpiarTexto.disabled = bloqueado;

    btnLimpiarTodo.disabled = bloqueado;

    entradaImagen.disabled = bloqueado;

    modoReconocimiento.disabled = bloqueado;

    idiomaOCR.disabled = bloqueado;

    preprocesamiento.disabled = bloqueado;

    segmentacion.disabled = bloqueado;

}


// ==================================================
// 13. ESTADÍSTICAS DEL TEXTO
// ==================================================

textoResultado.addEventListener(
    "input",
    function () {

        actualizarEstadisticas();

        actualizarBotonCopiar();

    }
);


function actualizarEstadisticas() {

    const texto = textoResultado.value;

    totalCaracteres.textContent = texto.length;

    const palabras = texto.trim()
        ? texto.trim().split(/\s+/u).length
        : 0;

    totalPalabras.textContent = palabras;

}


// ==================================================
// 14. COPIAR TEXTO
// ==================================================

btnCopiar.addEventListener("click", copiarTexto);


async function copiarTexto() {

    const texto = textoResultado.value;

    if (!texto.trim()) {

        mensajeCopia.textContent =
            "No hay texto para copiar.";

        return;

    }

    try {

        await navigator.clipboard.writeText(texto);

        mensajeCopia.textContent =
            "Texto copiado correctamente.";

    } catch (error) {

        textoResultado.focus();

        textoResultado.select();

        const copiado = document.execCommand("copy");

        mensajeCopia.textContent = copiado
            ? "Texto copiado correctamente."
            : "No se pudo copiar. Selecciona el texto manualmente.";

    }

}


// ==================================================
// 15. ACTUALIZAR BOTÓN COPIAR
// ==================================================

function actualizarBotonCopiar() {

    btnCopiar.disabled =
        !textoResultado.value.trim() || procesando;

}


// ==================================================
// 16. QUITAR IMAGEN
// ==================================================

btnQuitarImagen.addEventListener(
    "click",
    quitarImagen
);


function quitarImagen() {

    if (procesando) return;

    archivoSeleccionado = null;

    entradaImagen.value = "";

    imagenVista.removeAttribute("src");

    nombreImagen.textContent = "";

    contenedorVista.hidden = true;

    if (direccionImagen) {

        URL.revokeObjectURL(direccionImagen);

        direccionImagen = null;

    }

    btnReconocer.disabled = true;

    mensajeEstado.textContent =
        "Imagen retirada. Puedes cargar otra.";

}


// ==================================================
// 17. LIMPIAR SOLAMENTE EL TEXTO
// ==================================================

btnLimpiarTexto.addEventListener(
    "click",
    function () {

        if (procesando) return;

        textoResultado.value = "";

        actualizarEstadisticas();

        actualizarBotonCopiar();

        contenedorConfianza.hidden = true;

        mensajeCopia.textContent = "";

        mensajeEstado.textContent =
            "Texto eliminado. La imagen permanece cargada.";

    }
);


// ==================================================
// 18. REINICIAR TODO
// ==================================================

btnLimpiarTodo.addEventListener(
    "click",
    limpiarTodo
);


async function limpiarTodo() {

    if (procesando) return;

    quitarImagen();

    textoResultado.value = "";

    actualizarEstadisticas();

    actualizarBotonCopiar();

    contenedorProgreso.hidden = true;

    contenedorConfianza.hidden = true;

    barraProgreso.value = 0;

    porcentaje.textContent = "0%";

    estadoProceso.textContent = "Preparando...";

    mensajeEstado.textContent =
        "Esperando una imagen.";

    mensajeCopia.textContent = "";

    if (trabajadorOCR) {

        try {

            await trabajadorOCR.terminate();

        } catch (error) {

            console.error(
                "Error al cerrar OCR:",
                error
            );

        }

        trabajadorOCR = null;

        idiomaTrabajador = null;

    }

}


// ==================================================
// 19. CERRAR MOTOR AL SALIR
// ==================================================

window.addEventListener(
    "beforeunload",
    function () {

        if (direccionImagen) {

            URL.revokeObjectURL(direccionImagen);

        }

        if (trabajadorOCR) {

            trabajadorOCR.terminate();

        }

    }
);
