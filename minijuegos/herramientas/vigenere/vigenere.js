
const mensaje = document.getElementById("mensaje");
const clave = document.getElementById("clave");
const resultado = document.getElementById("resultado");

const contador = document.getElementById("contador");
const estado = document.getElementById("estado");
const tipoResultado = document.getElementById("tipoResultado");

const btnCifrar = document.getElementById("btnCifrar");
const btnDescifrar = document.getElementById("btnDescifrar");
const btnCopiar = document.getElementById("btnCopiar");

const LIMITE_TEXTO = 100000;

// Actualiza el contador del mensaje.
function actualizarContador() {
  contador.textContent =
    `${mensaje.value.length} / ${LIMITE_TEXTO} caracteres`;
}

mensaje.addEventListener("input", actualizarContador);

// Muestra mensajes de estado.
function mostrarEstado(texto, tipo) {
  estado.textContent = texto;
  estado.className = "estado " + tipo;
}

// Comprueba que la clave contenga solamente letras A-Z.
function validarClave(texto) {
  const claveLimpia = texto.toUpperCase();

  if (!/^[A-Z]+$/.test(claveLimpia)) {
    return null;
  }

  return claveLimpia;
}

// Convierte una letra según el algoritmo Vigenère.
function transformarVigenere(texto, claveTexto, descifrar = false) {
  let resultadoTexto = "";
  let posicionClave = 0;

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    const codigo = texto.charCodeAt(i);

    let base = null;

    // Identifica si es una letra mayúscula.
    if (codigo >= 65 && codigo <= 90) {
      base = 65;
    }

    // Identifica si es una letra minúscula.
    else if (codigo >= 97 && codigo <= 122) {
      base = 97;
    }

    // Los caracteres que no sean A-Z se conservan.
    if (base === null) {
      resultadoTexto += caracter;
      continue;
    }

    const valorMensaje = codigo - base;

    const valorClave =
      claveTexto.charCodeAt(
        posicionClave % claveTexto.length
      ) - 65;

    let nuevoValor;

    if (descifrar) {
      nuevoValor =
        (valorMensaje - valorClave + 26) % 26;
    } else {
      nuevoValor =
        (valorMensaje + valorClave) % 26;
    }

    resultadoTexto += String.fromCharCode(
      nuevoValor + base
    );

    // La clave avanza solamente cuando se procesa A-Z.
    posicionClave++;
  }

  return resultadoTexto;
}

// Ejecuta el cifrado o descifrado.
function ejecutarOperacion(descifrar) {
  const texto = mensaje.value;
  const claveValidada = validarClave(clave.value);

  if (texto.length === 0) {
    mostrarEstado(
      "Escribe primero un mensaje.",
      "error"
    );
    return;
  }

  if (claveValidada === null) {
    mostrarEstado(
      "La clave debe contener únicamente letras A-Z, sin espacios ni Ñ.",
      "error"
    );
    return;
  }

  const textoTransformado = transformarVigenere(
    texto,
    claveValidada,
    descifrar
  );

  resultado.value = textoTransformado;

  if (descifrar) {
    tipoResultado.textContent = "Mensaje descifrado";
    mostrarEstado(
      "El mensaje se ha descifrado correctamente.",
      "exito"
    );
  } else {
    tipoResultado.textContent = "Mensaje cifrado";
    mostrarEstado(
      "El mensaje se ha cifrado correctamente.",
      "exito"
    );
  }

  btnCopiar.disabled = false;
}

// Botones principales.
btnCifrar.addEventListener("click", () => {
  ejecutarOperacion(false);
});

btnDescifrar.addEventListener("click", () => {
  ejecutarOperacion(true);
});

// Copiar el resultado.
btnCopiar.addEventListener("click", async () => {
  if (resultado.value.length === 0) {
    return;
  }

  try {
    await navigator.clipboard.writeText(resultado.value);

    mostrarEstado(
      "Resultado copiado al portapapeles.",
      "exito"
    );
  } catch (error) {
    resultado.focus();
    resultado.select();

    mostrarEstado(
      "No se pudo copiar automáticamente. Selecciona y copia el resultado.",
      "error"
    );
  }
});

// Limpiar el estado anterior cuando se modifica la entrada.
mensaje.addEventListener("input", () => {
  mostrarEstado("", "");
  resultado.value = "";
  tipoResultado.textContent = "Sin resultado";
  btnCopiar.disabled = true;
});

clave.addEventListener("input", () => {
  mostrarEstado("", "");
  resultado.value = "";
  tipoResultado.textContent = "Sin resultado";
  btnCopiar.disabled = true;
});

actualizarContador();
