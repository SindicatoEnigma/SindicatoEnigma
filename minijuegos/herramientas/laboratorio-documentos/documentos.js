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
const confianza = document.getElementById("confianza");

let imagenCargada = null;
let trabajando = false;


// --------------------------------------------------
// SELECCIÓN DE IMAGEN
// --------------------------------------------------

entradaImagen.addEventListener("change", () => {

    const archivo = entradaImagen.files[0];

    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
        alert("Selecciona un archivo de imagen válido.");
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


// --------------------------------------------------
// PREPARAR IMAGEN DE TRABAJO
// --------------------------------------------------

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


// --------------------------------------------------
// UMBRAL AUTOMÁTICO DE LA IMAGEN
// --------------------------------------------------

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


// --------------------------------------------------
// DETECTAR REGIONES CON TEXTO
// --------------------------------------------------

function detectarBloques(canvas) {

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

    // Determinar si el documento es oscuro o claro.

    let sumaLuminosidad = 0;
    let cantidadMuestras = 0;

    for (let i = 0; i < datos.length; i += 16) {

        sumaLuminosidad +=
            datos[i] * 0.299 +
            datos[i + 1] * 0.587 +
            datos[i + 2] * 0.114;

        cantidadMuestras++;
    }

    const fondoOscuro =
        sumaLuminosidad / cantidadMuestras < 127;

    const ocupacionFilas = new Array(alto).fill(0);

    const ocupacionColumnas = new Array(ancho).fill(0);

    // Contar píxeles que parecen pertenecer al texto.

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

            if (esTexto) {
                ocupacionFilas[y]++;
                ocupacionColumnas[x]++;
            }
        }
    }

    // Detectar filas activas.

    const minimoPixeles = Math.max(
        2,
        Math.floor(ancho * 0.0007)
    );

    const filas = [];

    let inicio = -1;
    let fin = -1;

    for (let y = 0; y < alto; y++) {

        if (ocupacionFilas[y] >= minimoPixeles) {

            if (inicio === -1) {
                inicio = y;
            }

            fin = y;

        } else if (inicio !== -1) {

            filas.push({
                inicio,
                fin
            });

            inicio = -1;
            fin = -1;
        }
    }

    if (inicio !== -1) {
        filas.push({
            inicio,
            fin
        });
    }

    if (filas.length === 0) {
        return [];
    }

    // Calcular la altura típica de las franjas detectadas.

    const alturas = filas.map(
        fila => fila.fin - fila.inicio + 1
    );

    const ordenAlturas = [...alturas].sort(
        (a, b) => a - b
    );

    const alturaMediana =
        ordenAlturas[
            Math.floor(ordenAlturas.length / 2)
        ];

    // Agrupar franjas próximas en bloques.

    const separacionMaxima = Math.max(
        8,
        Math.round(alturaMediana * 1.8)
    );

    const bloques = [];

    let bloqueActual = {
        inicio: filas[0].inicio,
        fin: filas[0].fin
    };

    for (let i = 1; i < filas.length; i++) {

        const fila = filas[i];

        const separacion =
            fila.inicio - bloqueActual.fin - 1;

        if (separacion <= separacionMaxima) {

            bloqueActual.fin = fila.fin;

        } else {

            bloques.push(bloqueActual);

            bloqueActual = {
                inicio: fila.inicio,
                fin: fila.fin
            };
        }
    }

    bloques.push(bloqueActual);

    // Localizar los límites horizontales de cada bloque.

    const margenX = Math.max(
        10,
        Math.round(ancho * 0.01)
    );

    const margenY = Math.max(
        8,
        Math.round(alturaMediana * 0.8)
    );

    const bloquesFinales = [];

    for (const bloque of bloques) {

        let izquierda = ancho;
        let derecha = -1;

        for (let y = bloque.inicio; y <= bloque.fin; y++) {

            if (ocupacionFilas[y] === 0) continue;

            for (let x = 0; x < ancho; x++) {

                const indice = (y * ancho + x) * 4;

                const gris =
                    datos[indice] * 0.299 +
                    datos[indice + 1] * 0.587 +
                    datos[indice + 2] * 0.114;

                const esTexto = fondoOscuro
                    ? gris > umbral
                    : gris < umbral;

                if (esTexto) {
                    izquierda = Math.min(izquierda, x);
                    derecha = Math.max(derecha, x);
                }
            }
        }

        if (derecha < izquierda) continue;

        const x = Math.max(0, izquierda - margenX);
        const y = Math.max(0, bloque.inicio - margenY);

        const xFinal = Math.min(
            ancho,
            derecha + margenX + 1
        );

        const yFinal = Math.min(
            alto,
            bloque.fin + margenY + 1
        );

        const region = {
            x,
            y,
            ancho: xFinal - x,
            alto: yFinal - y
        };

        if (region.ancho >= 8 && region.alto >= 5) {
            bloquesFinales.push(region);
        }
    }

    return bloquesFinales;
}


// --------------------------------------------------
// CREAR RECORTE DE CADA BLOQUE
// --------------------------------------------------

function crearRecorte(canvasOriginal, bloque) {

    const recorte = document.createElement("canvas");

    recorte.width = bloque.ancho;
    recorte.height = bloque.alto;

    const contexto = recorte.getContext("2d");

    contexto.drawImage(
        canvasOriginal,

        bloque.x,
        bloque.y,
        bloque.ancho,
        bloque.alto,

        0,
        0,
        bloque.ancho,
        bloque.alto
    );

    // Ampliar regiones pequeñas para facilitar OCR.

    if (recorte.height < 100) {

        const escala = Math.min(
            3,
            100 / recorte.height
        );

        const ampliado = document.createElement("canvas");

        ampliado.width = Math.round(
            recorte.width * escala
        );

        ampliado.height = Math.round(
            recorte.height * escala
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


// --------------------------------------------------
// ACTUALIZAR PROGRESO
// --------------------------------------------------

function actualizarProgreso(porcentaje, mensaje) {

    barraProgreso.style.width =
        Math.min(100, Math.max(0, porcentaje)) + "%";

    estado.textContent = mensaje;
}


// --------------------------------------------------
// ANÁLISIS PRINCIPAL
// --------------------------------------------------

btnAnalizar.addEventListener("click", analizarDocumento);

async function analizarDocumento() {

    if (!imagenCargada || trabajando) return;

    if (!window.Tesseract) {
        alert(
            "No se pudo cargar el motor OCR. Comprueba tu conexión a internet."
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

        const canvas = crearImagenTrabajo(imagenCargada);

        actualizarProgreso(
            10,
            "Localizando las regiones con información..."
        );

        const bloques = detectarBloques(canvas);

        if (bloques.length === 0) {

            throw new Error(
                "No se detectaron regiones de texto. Prueba con una imagen más nítida."
            );
        }

        totalBloques.textContent =
            bloques.length +
            (bloques.length === 1 ? " bloque" : " bloques");

        actualizarProgreso(
            18,
            "Se detectaron " + bloques.length + " bloques."
        );

        const textos = [];
        const confianzas = [];

        // Crear el motor OCR.

        worker = await Tesseract.createWorker(
            "spa+eng",
            1,
            {
                logger: informacion => {

                    if (informacion.status === "recognizing text") {

                        const avance = informacion.progress || 0;

                        actualizarProgreso(
                            20 + avance * 70,
                            "Reconociendo texto..."
                        );
                    }
                }
            }
        );

        // Reconocer cada bloque individualmente.

        for (let i = 0; i < bloques.length; i++) {

            const bloque = bloques[i];

            actualizarProgreso(
                20 + (i / bloques.length) * 70,
                "Procesando bloque " +
                (i + 1) +
                " de " +
                bloques.length
            );

            const recorte = crearRecorte(canvas, bloque);

            await worker.setParameters({
                tessedit_pageseg_mode: "6"
            });

            const reconocimiento = await worker.recognize(recorte);

            const texto = reconocimiento.data.text || "";

            const confianzaBloque =
                reconocimiento.data.confidence || 0;

            textos.push(texto.trim());

            confianzas.push(confianzaBloque);
        }

        // Reconstruir el documento en orden.

        const textoFinal = textos
            .filter(texto => texto.length > 0)
            .join("\n\n");

        resultado.value = textoFinal;

        // Calcular confianza promedio.

        let promedio = 0;

        if (confianzas.length > 0) {

            promedio =
                confianzas.reduce((a, b) => a + b, 0) /
                confianzas.length;
        }

        confianza.textContent =
            "Confianza media: " + promedio.toFixed(1) + "%";

        resumen.hidden = false;

        btnCopiar.disabled = textoFinal.length === 0;

        actualizarProgreso(
            100,
            "Análisis terminado."
        );

        estadoResultado.textContent = "Análisis completado";

    } catch (error) {

        console.error(error);

        estadoResultado.textContent = "Error en el análisis";

        estado.textContent =
            error.message || "Ocurrió un error durante el análisis.";

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


// --------------------------------------------------
// COPIAR RESULTADO
// --------------------------------------------------

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


// --------------------------------------------------
// LIMPIAR
// --------------------------------------------------

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
