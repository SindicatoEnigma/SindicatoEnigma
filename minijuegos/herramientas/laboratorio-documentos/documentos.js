
/* =========================================================
   SINDICATO ENIGMA
   LABORATORIO DE DOCUMENTOS OCR

   PROCESO GENERAL:
   1. Detectar bloques de texto.
   2. Recortar cada bloque.
   3. Crear cuatro versiones de cada recorte.
   4. Ejecutar PSM 3 en las cuatro versiones.
   5. Alinear las cuatro lecturas.
   6. Votar carácter por carácter.
   7. Construir texto de consenso.
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

const MARGEN_BLOQUE = 0.025;

const FACTOR_SEPARACION_BLOQUES = 2.5;

const MODO_OCR = "3";

const VARIANTES_IMAGEN = [
    {
        nombre: "PASADA 1 - Imagen original",
        tipo: "original"
    },
    {
        nombre: "PASADA 2 - Escala de grises y contraste",
        tipo: "contraste"
    },
    {
        nombre: "PASADA 3 - Blanco y negro",
        tipo: "binaria"
    },
    {
        nombre: "PASADA 4 - Blanco y negro invertido",
        tipo: "invertida"
    }
];

let canvasOriginal = null;
let imagenCargada = false;
let workerOCR = null;
let analizando = false;


/* =========================================================
   3. FUNCIONES GENERALES
   ========================================================= */

function actualizarEstado(mensaje) {
    if (estado) {
        estado.textContent = mensaje;
    }
}

function actualizarProgreso(valor) {
    const porcentaje = Math.max(
        0,
        Math.min(100, valor)
    );

    if (barraProgreso) {
        barraProgreso.style.width = porcentaje + "%";
    }
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

    const ordenados = [...valores].sort(
        (a, b) => a - b
    );

    const mitad = Math.floor(ordenados.length / 2);

    if (ordenados.length % 2 === 0) {
        return (
            ordenados[mitad - 1] +
            ordenados[mitad]
        ) / 2;
    }

    return ordenados[mitad];
}


/* =========================================================
   4. PREPARAR IMAGEN
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

    ctx.drawImage(
        imagen,
        0,
        0,
        ancho,
        alto
    );

    return canvas;
}


/* =========================================================
   5. CONVERTIR IMAGEN A ESCALA DE GRISES
   ========================================================= */

function convertirGrises(canvas) {
    const salida = crearCanvas(
        canvas.width,
        canvas.height
    );

    const ctx = obtenerContexto(salida);

    ctx.drawImage(canvas, 0, 0);

    const imagen = ctx.getImageData(
        0,
        0,
        salida.width,
        salida.height
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
   7. DETECTAR SI EL FONDO ES CLARO
   ========================================================= */

function fondoEsClaro(datos, ancho, alto) {
    let suma = 0;
    let cantidad = 0;

    for (let x = 0; x < ancho; x += 5) {
        suma += datos[x * 4];
        cantidad++;

        const inferior =
            ((alto - 1) * ancho + x) * 4;

        suma += datos[inferior];
        cantidad++;
    }

    for (let y = 0; y < alto; y += 5) {
        const izquierda = y * ancho * 4;

        const derecha =
            (y * ancho + ancho - 1) * 4;

        suma += datos[izquierda];
        suma += datos[derecha];

        cantidad += 2;
    }

    return suma / cantidad >= 127;
}


/* =========================================================
   8. CREAR MÁSCARA DE TEXTO
   ========================================================= */

function crearMascara(canvasGris) {
    const ctx = obtenerContexto(canvasGris);

    const imagen = ctx.getImageData(
        0,
        0,
        canvasGris.width,
        canvasGris.height
    );

    const datos = imagen.data;

    const ancho = canvasGris.width;
    const alto = canvasGris.height;

    const umbral = calcularOtsu(datos);

    const fondoClaro = fondoEsClaro(
        datos,
        ancho,
        alto
    );

    const mascara = new Uint8Array(
        ancho * alto
    );

    for (let i = 0; i < mascara.length; i++) {
        const valor = datos[i * 4];

        const esTexto = fondoClaro
            ? valor < umbral
            : valor > umbral;

        mascara[i] = esTexto ? 1 : 0;
    }

    return mascara;
}


/* =========================================================
   9. DETECTAR FILAS HORIZONTALES
   ========================================================= */

function detectarFilas(mascara, ancho, alto) {
    const proyeccion = new Int32Array(alto);

    for (let y = 0; y < alto; y++) {
        let cantidad = 0;

        const inicio = y * ancho;

        for (let x = 0; x < ancho; x++) {
            cantidad += mascara[inicio + x];
        }

        proyeccion[y] = cantidad;
    }

    const umbral = Math.max(
        2,
        Math.round(ancho * 0.001)
    );

    const filas = [];

    let inicio = -1;

    for (let y = 0; y < alto; y++) {
        if (proyeccion[y] >= umbral) {
            if (inicio === -1) {
                inicio = y;
            }
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

    const unidas = [];

    for (const fila of filas) {
        const anterior = unidas[unidas.length - 1];

        if (
            anterior &&
            fila.y0 - anterior.y1 <= 2
        ) {
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
   10. AGRUPAR FILAS EN BLOQUES
   ========================================================= */

function agruparBloques(filas) {
    if (!filas.length) return [];

    const alturas = filas.map(
        fila => fila.y1 - fila.y0 + 1
    );

    const alturaMedia = mediana(alturas);

    const separacionMaxima = Math.max(
        8,
        alturaMedia * FACTOR_SEPARACION_BLOQUES
    );

    const bloques = [];

    let actual = {
        y0: filas[0].y0,
        y1: filas[0].y1,
        filas: [filas[0]]
    };

    for (let i = 1; i < filas.length; i++) {
        const anterior = filas[i - 1];
        const fila = filas[i];

        const espacio =
            fila.y0 - anterior.y1 - 1;

        if (espacio > separacionMaxima) {
            bloques.push(actual);

            actual = {
                y0: fila.y0,
                y1: fila.y1,
                filas: [fila]
            };
        } else {
            actual.y1 = fila.y1;
            actual.filas.push(fila);
        }
    }

    bloques.push(actual);

    return bloques;
}


/* =========================================================
   11. DELIMITAR HORIZONTALMENTE LOS BLOQUES
   ========================================================= */

function delimitarBloque(
    bloque,
    mascara,
    ancho,
    alto
) {
    let x0 = ancho;
    let x1 = -1;

    let y0 = alto;
    let y1 = -1;

    for (let y = bloque.y0; y <= bloque.y1; y++) {
        const inicio = y * ancho;

        for (let x = 0; x < ancho; x++) {
            if (mascara[inicio + x] === 1) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;

                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }

    if (x1 < x0 || y1 < y0) {
        return null;
    }

    const margenX = Math.max(
        8,
        Math.round(ancho * MARGEN_BLOQUE)
    );

    const margenY = Math.max(
        6,
        Math.round((y1 - y0 + 1) * 0.20)
    );

    return {
        x0: Math.max(0, x0 - margenX),
        x1: Math.min(ancho - 1, x1 + margenX),

        y0: Math.max(0, y0 - margenY),
        y1: Math.min(alto - 1, y1 + margenY),

        numeroLineas: bloque.filas.length
    };
}


/* =========================================================
   12. DETECTAR TODOS LOS BLOQUES
   ========================================================= */

function detectarBloques(canvasGris) {
    const ancho = canvasGris.width;
    const alto = canvasGris.height;

    actualizarEstado("Detectando regiones de texto...");

    const mascara = crearMascara(canvasGris);

    const filas = detectarFilas(
        mascara,
        ancho,
        alto
    );

    const grupos = agruparBloques(filas);

    const bloques = grupos
        .map(grupo =>
            delimitarBloque(
                grupo,
                mascara,
                ancho,
                alto
            )
        )
        .filter(Boolean);

    return {
        mascara,
        filas,
        bloques
    };
}


/* =========================================================
   13. RECORTAR UN BLOQUE DE TEXTO
   ========================================================= */

function recortarBloque(canvas, bloque) {
    const ancho =
        bloque.x1 - bloque.x0 + 1;

    const alto =
        bloque.y1 - bloque.y0 + 1;

    const recorte = crearCanvas(
        ancho,
        alto
    );

    const ctx = obtenerContexto(recorte);

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
        0,
        0,
        ancho,
        alto
    );

    ctx.drawImage(
        canvas,
        bloque.x0,
        bloque.y0,
        ancho,
        alto,
        0,
        0,
        ancho,
        alto
    );

    const escala = Math.min(
        3,
        Math.max(1.5, 1200 / ancho)
    );

    const ampliado = crearCanvas(
        Math.round(ancho * escala),
        Math.round(alto * escala)
    );

    const ctxAmpliado = obtenerContexto(ampliado);

    ctxAmpliado.fillStyle = "#ffffff";

    ctxAmpliado.fillRect(
        0,
        0,
        ampliado.width,
        ampliado.height
    );

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


/* =========================================================
   14. CREAR VERSIÓN ORIGINAL
   ========================================================= */

function crearVersionOriginal(canvas) {
    return canvas;
}


/* =========================================================
   15. MEJORAR CONTRASTE
   ========================================================= */

function crearVersionContraste(canvas) {
    const gris = convertirGrises(canvas);

    const ctx = obtenerContexto(gris);

    const imagen = ctx.getImageData(
        0,
        0,
        gris.width,
        gris.height
    );

    const datos = imagen.data;

    const histograma = new Array(256).fill(0);

    const total = datos.length / 4;

    for (let i = 0; i < datos.length; i += 4) {
        histograma[datos[i]]++;
    }

    const limiteInferior = total * 0.02;
    const limiteSuperior = total * 0.98;

    let acumulado = 0;
    let minimo = 0;
    let maximo = 255;

    for (let i = 0; i < 256; i++) {
        acumulado += histograma[i];

        if (acumulado >= limiteInferior) {
            minimo = i;
            break;
        }
    }

    acumulado = 0;

    for (let i = 255; i >= 0; i--) {
        acumulado += histograma[i];

        if (acumulado >= total - limiteSuperior) {
            maximo = i;
            break;
        }
    }

    if (maximo <= minimo) {
        return gris;
    }

    for (let i = 0; i < datos.length; i += 4) {
        let valor =
            (datos[i] - minimo) *
            255 /
            (maximo - minimo);

        valor = Math.max(
            0,
            Math.min(255, valor)
        );

        datos[i] = valor;
        datos[i + 1] = valor;
        datos[i + 2] = valor;
    }

    ctx.putImageData(imagen, 0, 0);

    return gris;
}


/* =========================================================
   16. CREAR IMAGEN BINARIZADA
   ========================================================= */

function crearVersionBinaria(canvas) {
    const gris = convertirGrises(canvas);

    const ctx = obtenerContexto(gris);

    const imagen = ctx.getImageData(
        0,
        0,
        gris.width,
        gris.height
    );

    const datos = imagen.data;

    const umbral = calcularOtsu(datos);

    const fondoClaro = fondoEsClaro(
        datos,
        gris.width,
        gris.height
    );

    for (let i = 0; i < datos.length; i += 4) {
        const valor = datos[i];

        let salida;

        if (fondoClaro) {
            salida = valor < umbral ? 0 : 255;
        } else {
            salida = valor > umbral ? 255 : 0;
        }

        datos[i] = salida;
        datos[i + 1] = salida;
        datos[i + 2] = salida;
        datos[i + 3] = 255;
    }

    ctx.putImageData(imagen, 0, 0);

    return gris;
}


/* =========================================================
   17. CREAR IMAGEN BINARIZADA INVERTIDA
   ========================================================= */

function crearVersionInvertida(canvas) {
    const binaria = crearVersionBinaria(canvas);

    const ctx = obtenerContexto(binaria);

    const imagen = ctx.getImageData(
        0,
        0,
        binaria.width,
        binaria.height
    );

    const datos = imagen.data;

    for (let i = 0; i < datos.length; i += 4) {
        const invertido = 255 - datos[i];

        datos[i] = invertido;
        datos[i + 1] = invertido;
        datos[i + 2] = invertido;
    }

    ctx.putImageData(imagen, 0, 0);

    return binaria;
}


/* =========================================================
   18. GENERAR LAS CUATRO VERSIONES
   ========================================================= */

function generarVariantes(canvas) {
    return [
        {
            nombre: VARIANTES_IMAGEN[0].nombre,
            canvas: crearVersionOriginal(canvas)
        },
        {
            nombre: VARIANTES_IMAGEN[1].nombre,
            canvas: crearVersionContraste(canvas)
        },
        {
            nombre: VARIANTES_IMAGEN[2].nombre,
            canvas: crearVersionBinaria(canvas)
        },
        {
            nombre: VARIANTES_IMAGEN[3].nombre,
            canvas: crearVersionInvertida(canvas)
        }
    ];
}


/* =========================================================
   19. INICIAR MOTOR OCR
   ========================================================= */

async function iniciarOCR() {
    if (workerOCR) return workerOCR;

    if (typeof Tesseract === "undefined") {
        throw new Error(
            "No se encontró Tesseract.js. Comprueba tu conexión."
        );
    }

    actualizarEstado("Iniciando motor OCR...");

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
                        "Reconociendo texto: " +
                        porcentaje +
                        "%"
                    );
                }
            }
        }
    );

    return workerOCR;
}


/* =========================================================
   20. EJECUTAR PSM 3
   ========================================================= */

async function reconocerImagen(worker, canvas) {
    await worker.setParameters({
        tessedit_pageseg_mode: MODO_OCR
    });

    const respuesta = await worker.recognize(canvas);

    return {
        texto: (respuesta.data.text || "").trim(),
        confianza: Number(
            respuesta.data.confidence || 0
        )
    };
}


/* =========================================================
   21. ALINEAR DOS TEXTOS
   ========================================================= */

function alinearTextos(textoA, textoB) {
    const a = Array.from(textoA);
    const b = Array.from(textoB);

    const n = a.length;
    const m = b.length;

    const ancho = m + 1;

    // Matriz de direcciones.
    const direcciones = new Uint8Array(
        (n + 1) * (m + 1)
    );

    let anterior = new Int32Array(m + 1);
    let actual = new Int32Array(m + 1);

    // Inicializar primera fila.
    for (let j = 1; j <= m; j++) {
        anterior[j] = -j;
        direcciones[j] = 2;
    }

    // Inicializar primera columna.
    for (let i = 1; i <= n; i++) {
        direcciones[i * ancho] = 1;
    }

    // Alineación dinámica.
    for (let i = 1; i <= n; i++) {
        actual[0] = -i;

        for (let j = 1; j <= m; j++) {
            const indice = i * ancho + j;

            const puntuacion =
                a[i - 1] === b[j - 1] ? 2 : -1;

            const diagonal =
                anterior[j - 1] + puntuacion;

            const arriba =
                anterior[j] - 1;

            const izquierda =
                actual[j - 1] - 1;

            let mejor = diagonal;
            let direccion = 0;

            if (arriba > mejor) {
                mejor = arriba;
                direccion = 1;
            }

            if (izquierda > mejor) {
                mejor = izquierda;
                direccion = 2;
            }

            actual[j] = mejor;
            direcciones[indice] = direccion;
        }

        [anterior, actual] = [actual, anterior];
    }

    // Reconstruir la alineación.
    const alineadoA = [];
    const alineadoB = [];

    let i = n;
    let j = m;

    while (i > 0 || j > 0) {
        const direccion =
            direcciones[i * ancho + j];

        if (i > 0 && j > 0 && direccion === 0) {
            alineadoA.push(a[i - 1]);
            alineadoB.push(b[j - 1]);

            i--;
            j--;

        } else if (
            i > 0 &&
            (j === 0 || direccion === 1)
        ) {
            alineadoA.push(a[i - 1]);
            alineadoB.push(null);

            i--;

        } else {
            alineadoA.push(null);
            alineadoB.push(b[j - 1]);

            j--;
        }
    }

    return {
        a: alineadoA.reverse(),
        b: alineadoB.reverse()
    };
}


/* =========================================================
   22. ELEGIR CARÁCTER POR MAYOR REPETICIÓN
   ========================================================= */

function elegirCaracter(
    columna,
    considerarAusencia = true
) {
    const conteo = new Map();

    let ausencias = 0;

    for (const lectura of columna) {
        if (!lectura) {
            ausencias++;
            continue;
        }

        const caracter = lectura.caracter;

        if (!conteo.has(caracter)) {
            conteo.set(caracter, {
                cantidad: 0,
                confianzaMaxima: -1
            });
        }

        const registro = conteo.get(caracter);

        registro.cantidad++;

        registro.confianzaMaxima = Math.max(
            registro.confianzaMaxima,
            lectura.confianza
        );
    }

    if (conteo.size === 0) {
        return null;
    }

    let mejorCaracter = null;
    let mejorCantidad = -1;
    let mejorConfianza = -1;

    for (const [caracter, registro] of conteo) {
        if (
            registro.cantidad > mejorCantidad ||
            (
                registro.cantidad === mejorCantidad &&
                registro.confianzaMaxima > mejorConfianza
            )
        ) {
            mejorCaracter = caracter;
            mejorCantidad = registro.cantidad;
            mejorConfianza = registro.confianzaMaxima;
        }
    }

    // Si hay más ausencias que apariciones,
    // se considera que el carácter debe omitirse.
    if (
        considerarAusencia &&
        ausencias > mejorCantidad
    ) {
        return null;
    }

    // En empate entre ausencia y carácter,
    // se conserva el carácter.
    return mejorCaracter;
}


/* =========================================================
   23. COMBINAR LAS CUATRO LECTURAS
   ========================================================= */

function combinarResultados(resultados) {
    const lecturas = resultados.filter(
        lectura => lectura.texto.length > 0
    );

    if (!lecturas.length) {
        return "";
    }

    // La primera lectura sirve como referencia.
    let columnas = Array.from(
        lecturas[0].texto,
        caracter => [{
            caracter,
            confianza: lecturas[0].confianza
        }]
    );

    // Incorporar las demás lecturas.
    for (let r = 1; r < lecturas.length; r++) {
        const lectura = lecturas[r];

        const referencia = columnas.map(columna => {
            return elegirCaracter(columna, false);
        }).join("");

        const alineacion = alinearTextos(
            referencia,
            lectura.texto
        );

        const nuevasColumnas = [];

        let indiceAnterior = 0;

        for (let i = 0; i < alineacion.a.length; i++) {
            const caracterA = alineacion.a[i];
            const caracterB = alineacion.b[i];

            // Carácter nuevo que no estaba en la referencia.
            if (caracterA === null) {
                const nuevaColumna = Array(r).fill(null);

                nuevaColumna.push(
                    caracterB === null
                        ? null
                        : {
                            caracter: caracterB,
                            confianza: lectura.confianza
                        }
                );

                nuevasColumnas.push(nuevaColumna);

            } else {
                // Carácter alineado con una columna existente.
                const columna = [
                    ...columnas[indiceAnterior]
                ];

                columna.push(
                    caracterB === null
                        ? null
                        : {
                            caracter: caracterB,
                            confianza: lectura.confianza
                        }
                );

                nuevasColumnas.push(columna);

                indiceAnterior++;
            }
        }

        columnas = nuevasColumnas;
    }

    // Votar cada posición.
    let textoFinal = "";

    for (const columna of columnas) {
        const caracter = elegirCaracter(
            columna,
            true
        );

        if (caracter !== null) {
            textoFinal += caracter;
        }
    }

    return textoFinal.trim();
}


/* =========================================================
   24. PROCESAR UN BLOQUE CON LAS CUATRO VERSIONES
   ========================================================= */

async function procesarBloque(
    worker,
    canvasOriginal,
    bloque
) {
    const recorte = recortarBloque(
        canvasOriginal,
        bloque
    );

    const variantes = generarVariantes(recorte);

    const resultados = [];

    for (const variante of variantes) {
        const lectura = await reconocerImagen(
            worker,
            variante.canvas
        );

        resultados.push({
            nombre: variante.nombre,
            texto: lectura.texto,
            confianza: lectura.confianza
        });
    }

    // Combinar las cuatro lecturas.
    const consenso = combinarResultados(resultados);

    return {
        coordenadas: bloque,
        resultados,
        consenso
    };
}


/* =========================================================
   25. CONSTRUIR INFORME
   ========================================================= */

function construirInforme(bloquesProcesados) {
    let informe = "";

    informe += "SINDICATO ENIGMA\n";
    informe += "LABORATORIO DE DOCUMENTOS OCR\n";

    informe += "\n====================================\n";
    informe += "MOTOR: TESSERACT OCR\n";
    informe += "MODO: PSM 3\n";
    informe += "CUATRO VERSIONES DE IMAGEN\n";
    informe += "CONSENSO POR REPETICIÓN DE CARACTERES\n";
    informe += "====================================\n";

    bloquesProcesados.forEach((bloque, indice) => {
        informe += "\n\n";
        informe += "####################################\n";
        informe += `BLOQUE ${indice + 1}\n`;
        informe += "####################################\n";

        // TEXTO COMBINADO.
        informe += "\n====================================\n";
        informe += "TEXTO DE CONSENSO\n";
        informe += "====================================\n";

        informe += bloque.consenso || "(Sin consenso)";

        informe += "\n\n";

        // LECTURAS INDIVIDUALES.
        informe += "====================================\n";
        informe += "LECTURAS INDIVIDUALES\n";
        informe += "====================================\n";

        bloque.resultados.forEach(lectura => {
            informe += "\n------------------------------------\n";
            informe += lectura.nombre + "\n";

            informe += "Confianza: ";
            informe += lectura.confianza.toFixed(1) + "%\n";

            informe += "------------------------------------\n";

            informe += lectura.texto || "(Sin lectura)";

            informe += "\n";
        });
    });

    informe += "\n\n====================================\n";
    informe += "FIN DEL INFORME\n";
    informe += "====================================";

    return informe;
}


/* =========================================================
   26. ACTUALIZAR ESTADÍSTICAS
   ========================================================= */

function actualizarEstadisticas(
    bloquesProcesados,
    numeroFilas
) {
    const cantidadBloques = bloquesProcesados.length;

    const todasLasLecturas = bloquesProcesados.flatMap(
        bloque => bloque.resultados
    );

    const lecturasConTexto = todasLasLecturas.filter(
        lectura => lectura.texto.length > 0
    );

    const promedio = lecturasConTexto.length
        ? lecturasConTexto.reduce(
            (suma, lectura) => suma + lectura.confianza,
            0
        ) / lecturasConTexto.length
        : 0;

    if (totalBloques) {
        totalBloques.textContent =
            cantidadBloques + " bloques";
    }

    if (totalLineas) {
        totalLineas.textContent =
            numeroFilas + " líneas";
    }

    if (totalPalabras) {
        totalPalabras.textContent =
            todasLasLecturas.length + " lecturas";
    }

    if (totalCaracteres) {
        totalCaracteres.textContent =
            lecturasConTexto.length + " resultados";
    }

    if (confianza) {
        confianza.textContent =
            "Confianza media: " + promedio.toFixed(1) + "%";
    }

    if (coincidencia) {
        coincidencia.textContent =
            lecturasConTexto.length > 0
                ? "Lecturas disponibles"
                : "Sin lecturas";
    }

    if (resumen) {
        resumen.hidden = false;

        resumen.textContent =
            `${cantidadBloques} bloques detectados · ` +
            `${numeroFilas} filas detectadas · ` +
            `${lecturasConTexto.length} lecturas con texto`;
    }
}


/* =========================================================
   27. PROCESO PRINCIPAL
   ========================================================= */

async function analizarDocumento() {
    if (!canvasOriginal || analizando) return;

    analizando = true;

    btnAnalizar.disabled = true;

    if (btnCopiar) {
        btnCopiar.disabled = true;
    }

    if (progresoContenedor) {
        progresoContenedor.hidden = false;
    }

    if (resultado) {
        resultado.value = "";
    }

    try {
        actualizarProgreso(0);

        // PASO 1: DETECTAR BLOQUES.
        const gris = convertirGrises(canvasOriginal);

        const estructura = detectarBloques(gris);

        const bloques = estructura.bloques;

        if (!bloques.length) {
            throw new Error(
                "No se detectaron bloques de texto. " +
                "Prueba con una imagen más clara."
            );
        }

        actualizarProgreso(5);

        actualizarEstado(
            "Se detectaron " +
            bloques.length +
            " bloques de texto."
        );

        // PASO 2: INICIAR OCR.
        const worker = await iniciarOCR();

        const procesados = [];

        const totalOperaciones =
            bloques.length * VARIANTES_IMAGEN.length;

        let operaciones = 0;

        // PASO 3: PROCESAR CADA BLOQUE.
        for (let i = 0; i < bloques.length; i++) {
            actualizarEstado(
                `Procesando bloque ${i + 1} de ${bloques.length}...`
            );

            const procesado = await procesarBloque(
                worker,
                canvasOriginal,
                bloques[i]
            );

            procesados.push(procesado);

            operaciones += VARIANTES_IMAGEN.length;

            actualizarProgreso(
                5 + (operaciones / totalOperaciones) * 90
            );
        }

        // PASO 4: CONSTRUIR INFORME.
        const informe = construirInforme(procesados);

        if (resultado) {
            resultado.value = informe;
        }

        actualizarEstadisticas(
            procesados,
            estructura.filas.length
        );

        actualizarProgreso(100);

        actualizarEstado(
            "Análisis terminado. " +
            "Se completaron las cuatro pasadas PSM 3 y el consenso."
        );

        if (estadoResultado) {
            estadoResultado.textContent =
                "Cuatro lecturas procesadas y texto de consenso generado.";
        }

        if (btnCopiar) {
            btnCopiar.disabled = !informe;
        }

    } catch (error) {
        console.error("Error en el análisis OCR:", error);

        actualizarEstado(
            "Error: " + error.message
        );

        if (estadoResultado) {
            estadoResultado.textContent = error.message;
        }

    } finally {
        analizando = false;

        if (btnAnalizar) {
            btnAnalizar.disabled = !imagenCargada;
        }
    }
}


/* =========================================================
   28. CARGAR IMAGEN
   ========================================================= */

function cargarImagen(archivo) {
    if (!archivo) return;

    const extension = archivo.name
        .split(".")
        .pop()
        .toLowerCase();

    const formatosPermitidos = [
        "jpg",
        "jpeg",
        "png",
        "webp"
    ];

    if (
        !archivo.type.startsWith("image/") &&
        !formatosPermitidos.includes(extension)
    ) {
        actualizarEstado(
            "Formato de imagen no compatible."
        );

        return;
    }

    imagenCargada = false;
    canvasOriginal = null;

    if (btnAnalizar) {
        btnAnalizar.disabled = true;
    }

    actualizarEstado("Cargando imagen...");

    const lector = new FileReader();

    lector.onload = () => {
        const imagen = new Image();

        imagen.onload = () => {
            try {
                canvasOriginal = prepararImagen(imagen);

                imagenCargada = true;

                if (vistaPrevia) {
                    vistaPrevia.src = lector.result;
                    vistaPrevia.style.display = "block";
                }

                if (contenedorVista) {
                    contenedorVista.hidden = false;
                    contenedorVista.style.display = "block";
                }

                if (nombreArchivo) {
                    nombreArchivo.textContent = archivo.name;
                }

                if (btnAnalizar) {
                    btnAnalizar.disabled = false;
                }

                if (resultado) {
                    resultado.value = "";
                }

                if (btnCopiar) {
                    btnCopiar.disabled = true;
                }

                if (resumen) {
                    resumen.hidden = true;
                }

                if (estadoResultado) {
                    estadoResultado.textContent =
                        "Esperando análisis";
                }

                actualizarProgreso(0);

                actualizarEstado(
                    "Imagen cargada. Ya puedes analizarla."
                );

            } catch (error) {
                console.error(error);

                actualizarEstado(
                    "Error al preparar la imagen: " +
                    error.message
                );
            }
        };

        imagen.onerror = () => {
            actualizarEstado(
                "El navegador no pudo interpretar esta imagen."
            );
        };

        imagen.src = lector.result;
    };

    lector.onerror = () => {
        actualizarEstado(
            "No se pudo leer el archivo seleccionado."
        );
    };

    lector.readAsDataURL(archivo);
}


/* =========================================================
   29. COPIAR RESULTADO
   ========================================================= */

async function copiarResultado() {
    if (!resultado || !resultado.value) return;

    try {
        await navigator.clipboard.writeText(
            resultado.value
        );

        actualizarEstado(
            "Informe completo copiado."
        );

    } catch (error) {
        resultado.select();

        const correcto = document.execCommand("copy");

        actualizarEstado(
            correcto
                ? "Informe completo copiado."
                : "No se pudo copiar el informe."
        );
    }
}


/* =========================================================
   30. LIMPIAR LABORATORIO
   ========================================================= */

function limpiarLaboratorio() {
    imagenCargada = false;
    canvasOriginal = null;

    if (inputImagen) {
        inputImagen.value = "";
    }

    if (vistaPrevia) {
        vistaPrevia.removeAttribute("src");
    }

    if (contenedorVista) {
        contenedorVista.hidden = true;
        contenedorVista.style.display = "none";
    }

    if (nombreArchivo) {
        nombreArchivo.textContent =
            "Ningún documento seleccionado";
    }

    if (resultado) {
        resultado.value = "";
    }

    if (btnAnalizar) {
        btnAnalizar.disabled = true;
    }

    if (btnCopiar) {
        btnCopiar.disabled = true;
    }

    if (resumen) {
        resumen.hidden = true;
    }

    if (estadoResultado) {
        estadoResultado.textContent =
            "Esperando análisis";
    }

    if (totalBloques) {
        totalBloques.textContent = "0 bloques";
    }

    if (totalLineas) {
        totalLineas.textContent = "0 líneas";
    }

    if (totalPalabras) {
        totalPalabras.textContent = "0 lecturas";
    }

    if (totalCaracteres) {
        totalCaracteres.textContent = "0 resultados";
    }

    if (confianza) {
        confianza.textContent = "Confianza: --";
    }

    if (coincidencia) {
        coincidencia.textContent = "Coincidencia: --";
    }

    actualizarProgreso(0);

    actualizarEstado("Esperando imagen...");
}


/* =========================================================
   31. CONECTAR BOTONES
   ========================================================= */

if (inputImagen) {
    inputImagen.addEventListener("change", evento => {
        const archivo = evento.target.files[0];

        if (archivo) {
            cargarImagen(archivo);
        }
    });
} else {
    console.error("No se encontró inputImagen.");
}

if (btnAnalizar) {
    btnAnalizar.addEventListener(
        "click",
        analizarDocumento
    );
}

if (btnCopiar) {
    btnCopiar.addEventListener(
        "click",
        copiarResultado
    );
}

if (btnLimpiar) {
    btnLimpiar.addEventListener(
        "click",
        limpiarLaboratorio
    );
}


/* =========================================================
   32. ESTADO INICIAL
   ========================================================= */

if (btnAnalizar) {
    btnAnalizar.disabled = true;
}

if (btnCopiar) {
    btnCopiar.disabled = true;
}

if (progresoContenedor) {
    progresoContenedor.hidden = false;
}

actualizarEstado("Esperando imagen...");
actualizarProgreso(0);
