const MAX_CARACTERES = 100000;

const textoEntrada = document.getElementById("textoEntrada");
const modalidad = document.getElementById("modalidad");
const resultado = document.getElementById("resultado");
const contador = document.getElementById("contador");
const resumen = document.getElementById("resumen");
const mensaje = document.getElementById("mensaje");

const botonAnalizar = document.getElementById("botonAnalizar");
const botonCopiar = document.getElementById("botonCopiar");

// Actualizar contador
textoEntrada.addEventListener("input", () => {
    contador.textContent =
        `${textoEntrada.value.length} / ${MAX_CARACTERES} caracteres`;
});

// Separar el texto en caracteres
function separarCaracteres(texto) {
    const normalizado = texto.normalize("NFC");

    if (typeof Intl.Segmenter === "function") {
        const segmentador = new Intl.Segmenter("es", {
            granularity: "grapheme"
        });

        return Array.from(
            segmentador.segment(normalizado),
            elemento => elemento.segment
        );
    }

    return Array.from(normalizado);
}

// Mostrar caracteres especiales de forma comprensible
function mostrarCaracter(caracter) {
    if (caracter === " ") return "[ESPACIO]";
    if (caracter === "\n") return "[SALTO DE LÍNEA]";
    if (caracter === "\r") return "[RETORNO]";
    if (caracter === "\t") return "[TABULACIÓN]";

    return caracter;
}

// Analizar frecuencias
function analizarFrecuencias() {
    const texto = textoEntrada.value;
    const tipo = modalidad.value;

    if (texto.length === 0) {
        resultado.value = "";
        resumen.textContent = "No hay texto para analizar.";
        mensaje.textContent = "";
        return;
    }

    const caracteres = separarCaracteres(texto);
    const frecuencias = new Map();

    let totalAnalizado = 0;

    for (const caracter of caracteres) {

        const esLetra = /^\p{L}$/u.test(caracter);

        // Modalidad: solo letras
        if (tipo === "letras" && !esLetra) {
            continue;
        }

        // Unificar mayúsculas y minúsculas en las letras
        const clave = esLetra
            ? caracter.toLocaleUpperCase("es")
            : caracter;

        frecuencias.set(
            clave,
            (frecuencias.get(clave) || 0) + 1
        );

        totalAnalizado++;
    }

    if (frecuencias.size === 0) {
        resultado.value = "";
        resumen.textContent = "No se encontraron letras para analizar.";
        mensaje.textContent = "";
        return;
    }

    // Ordenar de mayor a menor
    const lista = Array.from(frecuencias.entries());

    lista.sort((a, b) => {
        if (b[1] !== a[1]) {
            return b[1] - a[1];
        }

        return a[0].localeCompare(b[0], "es");
    });

    // Crear el resultado
    const ancho = Math.max(
        12,
        ...lista.map(item => mostrarCaracter(item[0]).length)
    );

    const encabezado =
        "CARÁCTER".padEnd(ancho + 4) + "FRECUENCIA";

    const separador = "-".repeat(ancho + 17);

    const lineas = lista.map(([caracter, cantidad]) => {
        return mostrarCaracter(caracter).padEnd(ancho + 4) + cantidad;
    });

    resultado.value = [
        encabezado,
        separador,
        ...lineas
    ].join("\n");

    resumen.textContent =
        `Caracteres analizados: ${totalAnalizado} | ` +
        `Caracteres diferentes: ${frecuencias.size}`;

    mensaje.textContent = "Análisis completado.";
}

// Copiar resultados
async function copiarResultado() {
    if (!resultado.value) {
        mensaje.textContent = "Primero debes realizar un análisis.";
        return;
    }

    try {
        await navigator.clipboard.writeText(resultado.value);
        mensaje.textContent = "Lista de frecuencias copiada.";
    } catch (error) {
        resultado.select();
        const copiado = document.execCommand("copy");

        mensaje.textContent = copiado
            ? "Lista de frecuencias copiada."
            : "No fue posible copiar automáticamente.";
    }
}

botonAnalizar.addEventListener("click", analizarFrecuencias);
botonCopiar.addEventListener("click", copiarResultado);
