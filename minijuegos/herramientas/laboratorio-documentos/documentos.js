
const entradaImagen = document.getElementById("entradaImagen");
const zonaCarga = document.getElementById("zonaCarga");

const contenedorVista = document.getElementById("contenedorVista");
const imagenVista = document.getElementById("imagenVista");
const nombreImagen = document.getElementById("nombreImagen");

const btnQuitarImagen = document.getElementById("btnQuitarImagen");
const btnReconocer = document.getElementById("btnReconocer");
const btnCopiar = document.getElementById("btnCopiar");
const btnLimpiar = document.getElementById("btnLimpiar");

const textoResultado = document.getElementById("textoResultado");

const contenedorProgreso = document.getElementById("contenedorProgreso");
const estadoProceso = document.getElementById("estadoProceso");
const porcentaje = document.getElementById("porcentaje");
const barraProgreso = document.getElementById("barraProgreso");

const mensajeEstado = document.getElementById("mensajeEstado");
const mensajeCopia = document.getElementById("mensajeCopia");

let archivoSeleccionado = null;
let direccionImagen = null;
let trabajadorOCR = null;
let procesando = false;

const TAMANO_MAXIMO = 20 * 1024 * 1024;


// --------------------------------------------------
// 1. CARGAR IMAGEN
// --------------------------------------------------

entradaImagen.addEventListener("change", function () {
    const archivo = this.files[0];

    if (archivo) {
        cargarImagen(archivo);
    }
});


function cargarImagen(archivo) {

    if (procesando) {
        return;
    }

    if (!archivo.type.startsWith("image/")) {
        mensajeEstado.textContent =
            "El archivo seleccionado no parece ser una imagen.";

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
    btnCopiar.disabled = !textoResultado.value.trim();

    mensajeEstado.textContent =
        "Imagen cargada. Lista para el reconocimiento.";

    mensajeCopia.textContent = "";

    contenedorProgreso.hidden = true;
}


// --------------------------------------------------
// 2. ARRASTRAR Y SOLTAR IMAGEN
// --------------------------------------------------

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


// --------------------------------------------------
// 3. RECONOCIMIENTO OCR
// --------------------------------------------------

btnReconocer.addEventListener("click", iniciarReconocimiento);


async function iniciarReconocimiento() {

    if (!archivoSeleccionado || procesando) {
        return;
    }

    if (typeof Tesseract === "undefined") {
        mensajeEstado.textContent =
            "No se pudo cargar el motor OCR. Revisa tu conexión a internet.";

        return;
    }

    procesando = true;

    cambiarEstadoBotones(true);

    contenedorProgreso.hidden = false;

    actualizarProgreso(0, "Preparando reconocimiento...");

    mensajeEstado.textContent =
        "El sistema está preparando el motor de reconocimiento.";

    try {

        // Crear el motor solamente la primera vez.
        // Se conserva para poder analizar más imágenes después.

        if (!trabajadorOCR) {

            trabajadorOCR = await Tesseract.createWorker(
                "spa",
                1,
                {
                    workerPath:
                        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",

                    corePath:
                        "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5",

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
                                    "Descargando idioma español...",

                                "initializing api":
                                    "Preparando reconocimiento...",

                                "recognizing text":
                                    "Reconociendo caracteres..."
                            };

                            const descripcion =
                                estados[informacion.status] ||
                                "Procesando imagen...";

                            const avance =
                                informacion.progress
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
        }

        mensajeEstado.textContent =
            "Examinando la imagen. Esto puede tardar un momento.";

        // Reconocer el contenido de la imagen.

        const resultado = await trabajadorOCR.recognize(
            archivoSeleccionado
        );

        const textoReconocido = resultado.data.text || "";

        textoResultado.value = textoReconocido;

        actualizarProgreso(100, "Reconocimiento terminado.");

        if (textoReconocido.trim().length > 0) {

            mensajeEstado.textContent =
                "Reconocimiento completado. Revisa y corrige el texto si es necesario.";

        } else {

            mensajeEstado.textContent =
                "No se encontró texto reconocible en esta imagen.";
        }

        actualizarBotonCopiar();

    } catch (error) {

        console.error("Error OCR:", error);

        mensajeEstado.textContent =
            "No se pudo procesar la imagen. Revisa tu conexión e inténtalo nuevamente.";

        actualizarProgreso(0, "Error durante el reconocimiento.");

    } finally {

        procesando = false;

        cambiarEstadoBotones(false);
    }
}


// --------------------------------------------------
// 4. ACTUALIZAR BARRA DE PROGRESO
// --------------------------------------------------

function actualizarProgreso(valor, descripcion) {

    const valorSeguro = Math.max(0, Math.min(100, valor));

    barraProgreso.value = valorSeguro;

    porcentaje.textContent = valorSeguro + "%";

    estadoProceso.textContent = descripcion;
}


// --------------------------------------------------
// 5. CONTROL DE BOTONES
// --------------------------------------------------

function cambiarEstadoBotones(bloqueado) {

    btnReconocer.disabled =
        bloqueado || !archivoSeleccionado;

    btnQuitarImagen.disabled = bloqueado;

    btnLimpiar.disabled = bloqueado;

    entradaImagen.disabled = bloqueado;
}


// --------------------------------------------------
// 6. COPIAR TEXTO
// --------------------------------------------------

btnCopiar.addEventListener("click", copiarTexto);


async function copiarTexto() {

    const texto = textoResultado.value;

    if (!texto.trim()) {
        mensajeCopia.textContent = "No hay texto para copiar.";
        return;
    }

    try {

        await navigator.clipboard.writeText(texto);

        mensajeCopia.textContent =
            "Texto copiado correctamente.";

    } catch (error) {

        // Método alternativo si el navegador bloquea
        // el acceso al portapapeles.

        textoResultado.focus();
        textoResultado.select();

        const copiado = document.execCommand("copy");

        mensajeCopia.textContent = copiado
            ? "Texto copiado correctamente."
            : "No se pudo copiar automáticamente. Selecciona el texto manualmente.";
    }
}


// --------------------------------------------------
// 7. ACTUALIZAR BOTÓN COPIAR
// --------------------------------------------------

textoResultado.addEventListener("input", actualizarBotonCopiar);


function actualizarBotonCopiar() {

    btnCopiar.disabled =
        !textoResultado.value.trim() || procesando;
}


// --------------------------------------------------
// 8. QUITAR IMAGEN
// --------------------------------------------------

btnQuitarImagen.addEventListener("click", quitarImagen);


function quitarImagen() {

    if (procesando) {
        return;
    }

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

    mensajeCopia.textContent = "";
}


// --------------------------------------------------
// 9. LIMPIAR TODO
// --------------------------------------------------

btnLimpiar.addEventListener("click", limpiarTodo);


async function limpiarTodo() {

    if (procesando) {
        return;
    }

    quitarImagen();

    textoResultado.value = "";

    actualizarBotonCopiar();

    contenedorProgreso.hidden = true;

    barraProgreso.value = 0;

    porcentaje.textContent = "0%";

    estadoProceso.textContent = "Preparando...";

    mensajeEstado.textContent =
        "Esperando una imagen.";

    mensajeCopia.textContent = "";

    // Liberar el motor para reiniciar desde cero
    // en el siguiente reconocimiento.

    if (trabajadorOCR) {

        try {
            await trabajadorOCR.terminate();
        } catch (error) {
            console.error("Error al cerrar el motor OCR:", error);
        }

        trabajadorOCR = null;
    }
}


// --------------------------------------------------
// 10. LIMPIEZA AL SALIR DE LA PÁGINA
// --------------------------------------------------

window.addEventListener("beforeunload", function () {

    if (direccionImagen) {
        URL.revokeObjectURL(direccionImagen);
    }

    if (trabajadorOCR) {
        trabajadorOCR.terminate();
    }
});
