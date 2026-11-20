// ==========================================
// SINDICATO ENIGMA
// DECODIFICADOR CÉSAR v1.0
// ==========================================

const MAX_CARACTERES = 100000;

// Elementos de la interfaz
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const shiftInput = document.getElementById("shiftInput");
const alphabetInput = document.getElementById("alphabetInput");

const decreaseBtn = document.getElementById("decreaseBtn");
const increaseBtn = document.getElementById("increaseBtn");
const copyBtn = document.getElementById("copyBtn");

const charCounter = document.getElementById("charCounter");
const alphabetStatus = document.getElementById("alphabetStatus");
const copyStatus = document.getElementById("copyStatus");


// ==========================================
// VALIDAR Y PREPARAR EL ALFABETO
// ==========================================

function prepareAlphabet() {

    const raw = Array.from(alphabetInput.value);
    const alphabet = [];
    const seen = new Set();

    if (raw.length === 0) {
        throw new Error("El alfabeto no puede estar vacío.");
    }

    for (const character of raw) {

        const upper = character.toLocaleUpperCase("es-MX");
        const lower = character.toLocaleLowerCase("es-MX");

        // Cada elemento debe representar un solo carácter.
        if (
            Array.from(upper).length !== 1 ||
            Array.from(lower).length !== 1
        ) {
            throw new Error(
                "Cada símbolo del alfabeto debe ser un carácter individual."
            );
        }

        // No se permiten espacios ni saltos de línea.
        if (/\s/u.test(character)) {
            throw new Error(
                "El alfabeto no puede contener espacios."
            );
        }

        // Evitar símbolos que no tengan distinción de mayúsculas.
        if (upper === lower) {
            throw new Error(
                "El alfabeto solo puede contener letras."
            );
        }

        // Evitar letras duplicadas, sin importar su formato.
        if (seen.has(upper)) {
            throw new Error(
                "No se permiten letras repetidas en el alfabeto."
            );
        }

        seen.add(upper);
        alphabet.push(upper);
    }

    return alphabet;
}


// ==========================================
// CIFRADO / DESCIFRADO CÉSAR
// ==========================================

function transformText(text, alphabet, shift) {

    const total = alphabet.length;

    // Normalizar el desplazamiento.
    // Permite números negativos y desplazamientos grandes.
    const movement = ((shift % total) + total) % total;

    // Crear un mapa para encontrar rápidamente las letras.
    const positions = new Map();

    alphabet.forEach((letter, index) => {
        positions.set(letter, index);
    });

    let result = "";

    // Recorrer el texto respetando cada carácter.
    for (const character of text) {

        const upper = character.toLocaleUpperCase("es-MX");

        // Si no pertenece al alfabeto, se conserva intacto.
        if (!positions.has(upper)) {
            result += character;
            continue;
        }

        const originalPosition = positions.get(upper);

        // Calcular la nueva posición.
        const newPosition =
            (originalPosition + movement) % total;

        let transformed = alphabet[newPosition];

        // Conservar el formato de la letra original.
        const isLowercase =
            character === character.toLocaleLowerCase("es-MX");

        if (isLowercase) {
            transformed = transformed.toLocaleLowerCase("es-MX");
        }

        result += transformed;
    }

    return result;
}


// ==========================================
// ACTUALIZAR RESULTADO
// ==========================================

function updateResult() {

    const text = inputText.value;

    // Actualizar contador.
    charCounter.textContent =
        `${text.length.toLocaleString("es-MX")} / ${MAX_CARACTERES.toLocaleString("es-MX")} caracteres`;

    try {

        const alphabet = prepareAlphabet();

        const shift = Number(shiftInput.value);

        if (!Number.isSafeInteger(shift)) {
            throw new Error(
                "El desplazamiento debe ser un número entero válido."
            );
        }

        const result = transformText(text, alphabet, shift);

        outputText.value = result;

        alphabetStatus.textContent =
            `${alphabet.length} caracteres disponibles.`;

        alphabetStatus.classList.remove("error");

    } catch (error) {

        outputText.value = "";

        alphabetStatus.textContent = error.message;

        alphabetStatus.classList.add("error");
    }
}


// ==========================================
// FLECHAS DE DESPLAZAMIENTO
// ==========================================

decreaseBtn.addEventListener("click", () => {

    let value = Number(shiftInput.value);

    if (!Number.isSafeInteger(value)) {
        value = 0;
    }

    if (value > Number.MIN_SAFE_INTEGER) {
        shiftInput.value = value - 1;
        updateResult();
    }
});


increaseBtn.addEventListener("click", () => {

    let value = Number(shiftInput.value);

    if (!Number.isSafeInteger(value)) {
        value = 0;
    }

    if (value < Number.MAX_SAFE_INTEGER) {
        shiftInput.value = value + 1;
        updateResult();
    }
});


// ==========================================
// CAMBIOS EN LOS CAMPOS
// ==========================================

inputText.addEventListener("input", updateResult);

shiftInput.addEventListener("input", updateResult);

alphabetInput.addEventListener("input", updateResult);


// Normalizar el alfabeto a mayúsculas al terminar de editar.
alphabetInput.addEventListener("change", () => {

    alphabetInput.value = Array.from(alphabetInput.value)
        .map(character => character.toLocaleUpperCase("es-MX"))
        .join("");

    updateResult();
});


// ==========================================
// COPIAR RESULTADO
// ==========================================

async function copyResult() {

    if (!outputText.value) {
        copyStatus.textContent = "No hay texto para copiar.";
        return;
    }

    try {

        await navigator.clipboard.writeText(outputText.value);

        copyStatus.textContent = "¡Resultado copiado!";

    } catch (error) {

        // Alternativa para navegadores sin Clipboard API.
        outputText.removeAttribute("readonly");
        outputText.select();

        const copied = document.execCommand("copy");

        outputText.setAttribute("readonly", true);

        copyStatus.textContent = copied
            ? "¡Resultado copiado!"
            : "No se pudo copiar el texto.";
    }
}

copyBtn.addEventListener("click", copyResult);


// ==========================================
// INICIO
// ==========================================

updateResult();
