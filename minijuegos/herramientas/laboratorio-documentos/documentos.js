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

// Actualizar valor del umbral
rangoUmbral.addEventListener("input", () => {
    valorUmbral.textContent = rangoUmbral.value;
});


// --------------------------------------------------
// 1. CARGAR IMAGEN
// --------------------------------------------------

entradaImagen.addEventListener("change", function () {
    const archivo = this.files[0];
    if (archivo) cargarImagen(archivo);
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

    if (direccionImagen) URL.revokeObjectURL(direccionImagen);

    archivoSeleccionado = archivo;
    direccionImagen = URL.createObjectURL(archivo);

    imagenVista.src = direccionImagen;
    nombreImagen.textContent = archivo.name;

    contenedorVista.hidden = false;
    btnReconocer.disabled = false;
    btnCopiar.disabled = !textoResultado.value.trim();
    vistaProcesada.hidden = true;

    mensajeEstado.textContent = "Imagen cargada. Lista para el reconocimiento.";
    mensajeCopia.textContent = "";
    contenedorProgreso.hidden = true;
}


// --------------------------------------------------
// 2. ARRASTRAR Y SOLTAR
// --------------------------------------------------

zonaCarga.addEventListener("dragover", e => {
    e.preventDefault();
    zonaCarga.classList.add("arrastrando");
});

zonaCarga.addEventListener("dragleave", () => {
    zonaCarga.classList.remove("arrastrando");
});

zonaCarga.addEventListener("drop", e => {
    e.preventDefault();
    zonaCarga.classList.remove("arrastrando");
    const archivo = e.dataTransfer.files[0];
    if (archivo) {
        cargarImagen(archivo);
        entradaImagen.value = "";
    }
});


// --------------------------------------------------
// 3. PREPROCESAMIENTO MEJORADO (engrosa letras)
// --------------------------------------------------

async function preprocesarImagen(archivo, umbral = 149) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(archivo);

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Escala alta
            const escala = 2.5;
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;

            // 1. Escala de grises + contraste fuerte + binarización
            for (let i = 0; i < data.length; i += 4) {
                let gris = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

                // Contraste más agresivo
                gris = (gris - 128) * 2.1 + 128;
                gris = Math.max(0, Math.min(255, gris));

                const binario = gris > umbral ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = binario;
            }

            ctx.putImageData(imageData, 0, 0);

            // 2. Dilatación simple (engrosa las letras y une trazos rotos)
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            data = imageData.data;
            const copia = new Uint8ClampedArray(data);

            const ancho = canvas.width;
            const alto = canvas.height;

            for (let y = 1; y < alto - 1; y++) {
                for (let x = 1; x < ancho - 1; x++) {
                    const idx = (y * ancho + x) * 4;

                    // Si el píxel es negro, miramos los vecinos
                    if (copia[idx] === 0) {
                        // Mantener negro
                        continue;
                    }

                    // Si algún vecino es negro, este píxel también se vuelve negro (dilatación)
                    let hayNegro = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nIdx = ((y + dy) * ancho + (x + dx)) * 4;
                            if (copia[nIdx] === 0) {
                                hayNegro = true;
                                break;
                            }
                        }
                        if (hayNegro) break;
                    }

                    if (hayNegro) {
                        data[idx] = data[idx + 1] = data[idx + 2] = 0;
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
            URL.revokeObjectURL(url);

            // Mostrar imagen procesada
            imagenProcesada.src = canvas.toDataURL("image/png");
            vistaProcesada.hidden = false;

            canvas.toBlob(blob => resolve(blob), "image/png");
        };

        img.src = url;
    });
}


// --------------------------------------------------
// 4. RECONOCIMIENTO
// --------------------------------------------------

btnReconocer.addEventListener("click", iniciarReconocimiento);

async function iniciarReconocimiento() {
    if (!archivoSeleccionado || procesando) return;

    if (typeof Tesseract === "undefined") {
        mensajeEstado.textContent = "No se pudo cargar el motor OCR.";
        return;
    }

    procesando = true;
    cambiarEstadoBotones(true);
    contenedorProgreso.hidden = false;
    actualizarProgreso(0, "Preparando...");
    mensajeEstado.textContent = "Preprocesando imagen y reconociendo texto...";

    try {
        if (!trabajadorOCR) {
            trabajadorOCR = await Tesseract.createWorker("eng", 1, {
                workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
                corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5",
                langPath: "https://tessdata.projectnaptha.com/4.0.0",
                logger: info => {
                    if (info.status) {
                        const estados = {
                            "loading tesseract core": "Cargando motor OCR...",
                            "initializing tesseract": "Inicializando...",
                            "loading language traineddata": "Descargando idioma...",
                            "initializing api": "Preparando...",
                            "recognizing text": "Reconociendo caracteres..."
                        };
                        const desc = estados[info.status] || "Procesando...";
                        const avance = info.progress ? Math.round(info.progress * 100) : 0;
                        actualizarProgreso(avance, desc);
                    }
                }
            });
        }

        // Forzamos PSM 6 (el que mejor te funcionó)
        await trabajadorOCR.setParameters({
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1",
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,«»()!?:;\"'- ",
        });

        const umbralActual = parseInt(rangoUmbral.value);
        const imagenLimpia = await preprocesarImagen(archivoSeleccionado, umbralActual);

        const resultado = await trabajadorOCR.recognize(imagenLimpia);
        const textoReconocido = resultado.data.text || "";

        textoResultado.value = textoReconocido;
        actualizarProgreso(100, "Reconocimiento terminado.");

        mensajeEstado.textContent = textoReconocido.trim()
            ? "Reconocimiento completado. Puedes ajustar el umbral si es necesario."
            : "No se encontró texto reconocible.";

        actualizarBotonCopiar();

    } catch (error) {
        console.error(error);
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
    const v = Math.max(0, Math.min(100, valor));
    barraProgreso.value = v;
    porcentaje.textContent = v + "%";
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

btnCopiar.addEventListener("click", async () => {
    const texto = textoResultado.value;
    if (!texto.trim()) {
        mensajeCopia.textContent = "No hay texto para copiar.";
        return;
    }
    try {
        await navigator.clipboard.writeText(texto);
        mensajeCopia.textContent = "Texto copiado correctamente.";
    } catch {
        textoResultado.select();
        document.execCommand("copy");
        mensajeCopia.textContent = "Texto copiado.";
    }
});

textoResultado.addEventListener("input", () => {
    btnCopiar.disabled = !textoResultado.value.trim() || procesando;
});

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
    mensajeEstado.textContent = "Imagen retirada.";
    mensajeCopia.textContent = "";
}

btnLimpiar.addEventListener("click", async () => {
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
        try { await trabajadorOCR.terminate(); } catch {}
        trabajadorOCR = null;
    }
});

window.addEventListener("beforeunload", () => {
    if (direccionImagen) URL.revokeObjectURL(direccionImagen);
    if (trabajadorOCR) trabajadorOCR.terminate();
});
