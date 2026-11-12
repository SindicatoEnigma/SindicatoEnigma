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

const rangoUmbral = document.getElementById("rangoUmbral");
const valorUmbral = document.getElementById("valorUmbral");
const selectPSM = document.getElementById("selectPSM");
const vistaProcesada = document.getElementById("vistaProcesada");
const imagenProcesada = document.getElementById("imagenProcesada");

let archivoSeleccionado = null;
let direccionImagen = null;
let trabajadorOCR = null;
let procesando = false;

const TAMANO_MAXIMO = 20 * 1024 * 1024;

// Actualizar valor del umbral en tiempo real
rangoUmbral.addEventListener("input", () => {
    valorUmbral.textContent = rangoUmbral.value;
});


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
    if (procesando) return;

    if (!archivo.type.startsWith("image/")) {
        mensajeEstado.textContent = "El archivo seleccionado no parece ser una imagen.";
        return;
    }

    if (archivo.size > TAMANO_MAXIMO) {
        mensajeEstado.textContent = "La imagen supera el límite de 20 MB.";
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

    // Ocultar imagen procesada anterior
    vistaProcesada.hidden = true;

    mensajeEstado.textContent = "Imagen cargada. Lista para el reconocimiento.";
    mensajeCopia.textContent = "";
    contenedorProgreso.hidden = true;
}


// --------------------------------------------------
// 2. ARRASTRAR Y SOLTAR
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
// 3. PREPROCESAMIENTO DE IMAGEN
// --------------------------------------------------

async function preprocesarImagen(archivo, umbral = 145) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(archivo);

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            const escala = 2.2;
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                let gris = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

                // Contraste fuerte
                gris = (gris - 128) * 1.9 + 128;
                gris = Math.max(0, Math.min(255, gris));

                // Binarización
                const binario = gris > umbral ? 255 : 0;

                data[i] = data[i + 1] = data[i + 2] = binario;
            }

            ctx.putImageData(imageData, 0, 0);
            URL.revokeObjectURL(url);

            // Mostrar imagen procesada
            imagenProcesada.src = canvas.toDataURL("image/png");
            vistaProcesada.hidden = false;

            canvas.toBlob((blob) => {
                resolve(blob);
            }, "image/png");
        };

        img.src = url;
    });
}


// --------------------------------------------------
// 4. RECONOCIMIENTO OCR
// --------------------------------------------------

btnReconocer.addEventListener("click", iniciarReconocimiento);

async function iniciarReconocimiento() {
    if (!archivoSeleccionado || procesando) return;

    if (typeof Tesseract === "undefined") {
        mensajeEstado.textContent = "No se pudo cargar el motor OCR. Revisa tu conexión a internet.";
        return;
    }

    procesando = true;
    cambiarEstadoBotones(true);
    contenedorProgreso.hidden = false;
    actualizarProgreso(0, "Preparando reconocimiento...");
    mensajeEstado.textContent = "Preparando motor y preprocesando imagen...";

    try {
        if (!trabajadorOCR) {
            trabajadorOCR = await Tesseract.createWorker("eng", 1, {
                workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
                corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5",
                langPath: "https://tessdata.projectnaptha.com/4.0.0",
                logger: function (informacion) {
                    if (informacion.status) {
                        const estados = {
                            "loading tesseract core": "Cargando motor OCR...",
                            "initializing tesseract": "Inicializando motor...",
                            "loading language traineddata": "Descargando idioma...",
                            "initializing api": "Preparando reconocimiento...",
                            "recognizing text": "Reconociendo caracteres..."
                        };
                        const descripcion = estados[informacion.status] || "Procesando...";
                        const avance = informacion.progress ? Math.round(informacion.progress * 100) : 0;
                        actualizarProgreso(avance, descripcion);
                    }
                }
            });
        }

        const psmElegido = selectPSM.value;
        await trabajadorOCR.setParameters({
            tessedit_pageseg_mode: psmElegido,
            preserve_interword_spaces: "1",
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,«»()!?:;\"'- ",
        });

        const umbralActual = parseInt(rangoUmbral.value);
        const imagenLimpia = await preprocesarImagen(archivoSeleccionado, umbralActual);

        mensajeEstado.textContent = "Reconociendo texto...";
        const resultado = await trabajadorOCR.recognize(imagenLimpia);
        const textoReconocido = resultado.data.text || "";

        textoResultado.value = textoReconocido;
        actualizarProgreso(100, "Reconocimiento terminado.");

        mensajeEstado.textContent = textoReconocido.trim().length > 0
            ? "Reconocimiento completado. Puedes ajustar el umbral o el PSM e intentar de nuevo."
            : "No se encontró texto reconocible.";

        actualizarBotonCopiar();

    } catch (error) {
        console.error("Error OCR:", error);
        mensajeEstado.textContent = "Error al procesar la imagen.";
        actualizarProgreso(0, "Error");
    } finally {
        procesando = false;
        cambiarEstadoBotones(false);
        actualizarBotonCopiar();
    }
}


// --------------------------------------------------
// 5. UTILIDADES
// --------------------------------------------------

function actualizarProgreso(valor, descripcion) {
    const valorSeguro = Math.max(0, Math.min(100, valor));
    barraProgreso.value = valorSeguro;
    porcentaje.textContent = valorSeguro + "%";
    estadoProceso.textContent = descripcion;
}

function cambiarEstadoBotones(bloqueado) {
    btnReconocer.disabled = bloqueado || !archivoSeleccionado;
    btnQuitarImagen.disabled = bloqueado;
    btnLimpiar.disabled = bloqueado;
    entradaImagen.disabled = bloqueado;
    rangoUmbral.disabled = bloqueado;
    selectPSM.disabled = bloqueado;
}

btnCopiar.addEventListener("click", copiarTexto);

async function copiarTexto() {
    const texto = textoResultado.value;

    if (!texto.trim()) {
        mensajeCopia.textContent = "No hay texto para copiar.";
        return;
    }

    try {
        await navigator.clipboard.writeText(texto);
        mensajeCopia.textContent = "Texto copiado correctamente.";
    } catch (error) {
        textoResultado.focus();
        textoResultado.select();
        const copiado = document.execCommand("copy");
        mensajeCopia.textContent = copiado
            ? "Texto copiado correctamente."
            : "No se pudo copiar automáticamente.";
    }
}

textoResultado.addEventListener("input", actualizarBotonCopiar);

function actualizarBotonCopiar() {
    btnCopiar.disabled = !textoResultado.value.trim() || procesando;
}

btnQuitarImagen.addEventListener("click", quitarImagen);

function quitarImagen() {
    if (procesando) return;

    archivoSeleccionado = null;
    entradaImagen.value = "";
    imagenVista.removeAttribute("src");
    nombreImagen.textContent = "";
    contenedorVista.hidden = true;
    vistaProcesada.hidden = true;

    if (direccionImagen) {
        URL.revokeObjectURL(direccionImagen);
        direccionImagen = null;
    }

    btnReconocer.disabled = true;
    mensajeEstado.textContent = "Imagen retirada. Puedes cargar otra.";
    mensajeCopia.textContent = "";
}

btnLimpiar.addEventListener("click", limpiarTodo);

async function limpiarTodo() {
    if (procesando) return;

    quitarImagen();
    textoResultado.value = "";
    actualizarBotonCopiar();

    contenedorProgreso.hidden = true;
    barraProgreso.value = 0;
    porcentaje.textContent = "0%";
    estadoProceso.textContent = "Preparando...";

    mensajeEstado.textContent = "Esperando una imagen.";
    mensajeCopia.textContent = "";

    if (trabajadorOCR) {
        try {
            await trabajadorOCR.terminate();
        } catch (error) {
            console.error("Error al cerrar el motor OCR:", error);
        }
        trabajadorOCR = null;
    }
}

window.addEventListener("beforeunload", function () {
    if (direccionImagen) {
        URL.revokeObjectURL(direccionImagen);
    }
    if (trabajadorOCR) {
        trabajadorOCR.terminate();
    }
});
