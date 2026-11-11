
"use strict";
 
// =====================================================
// 1. ELEMENTOS Y VARIABLES GENERALES
// =====================================================

const $ = id => document.getElementById(id);

const textoOriginal = $("textoOriginal");
const contador = $("contador");
const resumenTexto = $("resumenTexto");

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAXIMO = 100000;
const MAX_LONGITUD_BUSQUEDA = 100;

let textoNormalizado = "";
let secuenciasEncontradas = [];
let distanciasManuales = [];
let longitudActual = 0;
let gruposActuales = [];
let claveCalculada = false;
let desplazamientosPorGrupo = [];

// Frecuencias aproximadas de las letras en español.
// La suma es aproximadamente 100.
const FRECUENCIAS_ESPANOL = [
  12.53, 1.42, 4.68, 5.86, 13.68,
  0.69, 1.01, 0.70, 6.25, 0.44,
  0.02, 4.97, 3.15, 6.71, 8.68,
  2.51, 0.88, 6.87, 7.98, 4.63,
  3.93, 0.90, 0.01, 0.22, 0.90, 0.52
];

// =====================================================
// 2. NORMALIZACIÓN DEL TEXTO
// =====================================================

// Convierte una letra a su equivalente A-Z.
// Elimina acentos y convierte Ñ en N.
function convertirLetra(letra) {
  return letra
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

// Extrae solamente letras del alfabeto A-Z.
function normalizarTexto(texto) {
  let resultado = "";

  for (const caracter of texto) {
    const convertido = convertirLetra(caracter);

    for (const letra of convertido) {
      if (ALFABETO.includes(letra)) {
        resultado += letra;
      }
    }
  }

  return resultado;
}

function indiceLetra(letra) {
  return ALFABETO.indexOf(letra);
}

function letraPorIndice(numero) {
  return ALFABETO[(numero % 26 + 26) % 26];
}

// =====================================================
// 3. CONTADOR Y ANÁLISIS INICIAL
// =====================================================

textoOriginal.addEventListener("input", () => {
  contador.textContent =
    `${textoOriginal.value.length} / ${MAXIMO} caracteres`;
});

$("limpiar").addEventListener("click", () => {
  textoOriginal.value = "";
  contador.textContent = `0 / ${MAXIMO} caracteres`;

  textoNormalizado = "";
  secuenciasEncontradas = [];
  distanciasManuales = [];
  longitudActual = 0;
  gruposActuales = [];
  claveCalculada = false;

  resumenTexto.textContent = "";
  $("resultadosSecuencias").innerHTML = "";
  $("resumenSeleccion").textContent =
    "Todavía no hay secuencias seleccionadas.";
  $("distanciasManuales").textContent = "";
  $("resultadoMCD").innerHTML = "";
  $("candidatosClave").innerHTML = "";
  $("gruposMensaje").innerHTML = "";
  $("resultadosGrupos").innerHTML = "";
  $("resultadosClave").innerHTML = "";
  $("claveFinal").value = "";
  $("mensajeDescifrado").value = "";
  $("resultadoComprobacion").textContent = "";

  actualizarEstadoBotones();
});

$("analizarTexto").addEventListener("click", () => {
  const original = textoOriginal.value;

  if (!original.trim()) {
    alert("Introduce un texto cifrado primero.");
    return;
  }

  textoNormalizado = normalizarTexto(original);

  if (!textoNormalizado.length) {
    alert("No se encontraron letras A-Z en el texto.");
    return;
  }

  // Reinicia los análisis anteriores.
  secuenciasEncontradas = [];
  distanciasManuales = [];
  longitudActual = 0;
  gruposActuales = [];
  claveCalculada = false;

  $("resultadosSecuencias").innerHTML = "";
  $("resultadoMCD").innerHTML = "";
  $("candidatosClave").innerHTML = "";
  $("gruposMensaje").innerHTML = "";
  $("resultadosGrupos").innerHTML = "";
  $("resultadosClave").innerHTML = "";
  $("claveFinal").value = "";
  $("mensajeDescifrado").value = "";
  $("resultadoComprobacion").textContent = "";
  $("distanciasManuales").textContent = "";

  resumenTexto.textContent =
    `Texto original: ${original.length} caracteres. ` +
    `Texto normalizado: ${textoNormalizado.length} letras A-Z.`;

  actualizarEstadoBotones();
  $("resultadosSecuencias").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// =====================================================
// 4. MODO AUTOMÁTICO Y MANUAL
// =====================================================

function actualizarModoBusqueda() {
  const modo = document.querySelector(
    'input[name="modoBusqueda"]:checked'
  ).value;

  $("opcionesAutomaticas").hidden = modo !== "automatico";
  $("opcionesManuales").hidden = modo !== "manual";
}

document.querySelectorAll('input[name="modoBusqueda"]')
  .forEach(input => {
    input.addEventListener("change", actualizarModoBusqueda);
  });

actualizarModoBusqueda();

// =====================================================
// 5. DETECTOR DE SECUENCIAS REPETIDAS
// =====================================================

function buscarPorLongitud(texto, longitud) {
  const apariciones = new Map();

  for (let i = 0; i <= texto.length - longitud; i++) {
    const secuencia = texto.slice(i, i + longitud);

    if (!apariciones.has(secuencia)) {
      apariciones.set(secuencia, []);
    }

    apariciones.get(secuencia).push(i + 1);
  }

  const resultados = [];

  for (const [secuencia, posiciones] of apariciones) {
    if (posiciones.length < 2) continue;

    const distancias = [];

    for (let i = 1; i < posiciones.length; i++) {
      distancias.push(posiciones[i] - posiciones[i - 1]);
    }

    resultados.push({
      secuencia,
      posiciones,
      distancias,
      seleccionada: false
    });
  }

  return resultados;
}

$("buscarSecuencias").addEventListener("click", () => {
  if (!textoNormalizado) {
    alert("Primero analiza el texto cifrado.");
    return;
  }

  const modo = document.querySelector(
    'input[name="modoBusqueda"]:checked'
  ).value;

  let longitudes = [];

  if (modo === "automatico") {
    const minimo = Number($("longitudMinima").value);
    const maximo = Number($("longitudMaxima").value);

    if (
      !Number.isInteger(minimo) ||
      !Number.isInteger(maximo) ||
      minimo < 2 ||
      maximo < minimo ||
      maximo > MAX_LONGITUD_BUSQUEDA
    ) {
      alert("Revisa las longitudes mínima y máxima.");
      return;
    }

    longitudes = Array.from(
      { length: maximo - minimo + 1 },
      (_, i) => minimo + i
    );
  } else {
    const longitud = Number($("longitudManual").value);

    if (
      !Number.isInteger(longitud) ||
      longitud < 2 ||
      longitud > MAX_LONGITUD_BUSQUEDA
    ) {
      alert("Introduce una longitud entre 2 y 100.");
      return;
    }

    longitudes = [longitud];
  }

  secuenciasEncontradas = [];

  for (const longitud of longitudes) {
    secuenciasEncontradas.push(
      ...buscarPorLongitud(textoNormalizado, longitud)
    );
  }

  secuenciasEncontradas.sort((a, b) => {
    if (b.posiciones.length !== a.posiciones.length) {
      return b.posiciones.length - a.posiciones.length;
    }

    if (a.secuencia.length !== b.secuencia.length) {
      return a.secuencia.length - b.secuencia.length;
    }

    return a.secuencia.localeCompare(b.secuencia);
  });

  mostrarSecuencias();
  actualizarResumenSeleccion();
  $("resultadoMCD").innerHTML = "";
  $("candidatosClave").innerHTML = "";
  actualizarEstadoBotones();
});

function mostrarSecuencias() {
  const zona = $("resultadosSecuencias");
  zona.innerHTML = "";

  if (!secuenciasEncontradas.length) {
    zona.textContent =
      "No se encontraron secuencias repetidas con esos criterios.";
    return;
  }

  const titulo = document.createElement("h3");
  titulo.textContent =
    `Secuencias encontradas: ${secuenciasEncontradas.length}`;
  zona.appendChild(titulo);

  secuenciasEncontradas.forEach((item, indice) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "secuencia-card";

    const nombre = document.createElement("div");
    nombre.className = "secuencia-titulo";
    nombre.textContent = item.secuencia;

    const detalle = document.createElement("div");
    detalle.className = "secuencia-detalle";
    detalle.textContent =
      `Longitud: ${item.secuencia.length} · ` +
      `Apariciones: ${item.posiciones.length} · ` +
      `Posiciones: ${item.posiciones.join(", ")} · ` +
      `Distancias: ${item.distancias.join(", ")}`;

    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = item.seleccionada;

    check.addEventListener("change", () => {
      item.seleccionada = check.checked;
      actualizarResumenSeleccion();
      $("resultadoMCD").innerHTML = "";
      $("candidatosClave").innerHTML = "";
      actualizarEstadoBotones();
    });

    label.append(check, document.createTextNode(
      " Incluir distancias de esta secuencia"
    ));

    tarjeta.append(nombre, detalle, label);
    zona.appendChild(tarjeta);
  });
}

// =====================================================
// 6. DISTANCIAS SELECCIONADAS Y MANUALES
// =====================================================

function obtenerDistanciasSeleccionadas() {
  const automaticas = [];

  for (const item of secuenciasEncontradas) {
    if (item.seleccionada) {
      automaticas.push(...item.distancias);
    }
  }

  return [...automaticas, ...distanciasManuales];
}

function actualizarResumenSeleccion() {
  const seleccionadas = secuenciasEncontradas.filter(
    item => item.seleccionada
  );

  const distancias = obtenerDistanciasSeleccionadas();

  $("resumenSeleccion").textContent =
    `Secuencias seleccionadas: ${seleccionadas.length}. ` +
    `Distancias automáticas: ${seleccionadas.reduce(
      (s, item) => s + item.distancias.length, 0
    )}. ` +
    `Distancias manuales: ${distanciasManuales.length}. ` +
    `Total: ${distancias.length}. ` +
    `Valores: ${distancias.length ? distancias.join(", ") : "ninguna"}.`;
}

$("agregarDistancia").addEventListener("click", () => {
  const valor = Number($("distanciaManual").value);

  if (!Number.isInteger(valor) || valor <= 0) {
    alert("Introduce una distancia entera positiva.");
    return;
  }

  distanciasManuales.push(valor);
  $("distanciaManual").value = "";

  mostrarDistanciasManuales();
  actualizarResumenSeleccion();
  $("resultadoMCD").innerHTML = "";
  $("candidatosClave").innerHTML = "";
  actualizarEstadoBotones();
});

function mostrarDistanciasManuales() {
  const zona = $("distanciasManuales");
  zona.innerHTML = "";

  distanciasManuales.forEach((valor, indice) => {
    const fila = document.createElement("div");
    fila.className = "fila";
    fila.style.marginTop = "8px";

    const texto = document.createElement("span");
    texto.textContent = `Distancia manual: ${valor}`;

    const boton = document.createElement("button");
    boton.className = "secundario";
    boton.textContent = "Eliminar";

    boton.addEventListener("click", () => {
      distanciasManuales.splice(indice, 1);
      mostrarDistanciasManuales();
      actualizarResumenSeleccion();
      $("resultadoMCD").innerHTML = "";
      $("candidatosClave").innerHTML = "";
      actualizarEstadoBotones();
    });

    fila.append(texto, boton);
    zona.appendChild(fila);
  });
});

// =====================================================
// 7. MÁXIMO COMÚN DIVISOR Y EUCLIDES
// =====================================================

function calcularMCD(a, b) {
  const pasos = [];

  while (b !== 0) {
    const resto = a % b;

    pasos.push({
      a,
      b,
      resto
    });

    a = b;
    b = resto;
  }

  return {
    mcd: a,
    pasos
  };
}

function mcdDeLista(numeros) {
  let resultado = numeros[0];

  for (let i = 1; i < numeros.length; i++) {
    resultado = calcularMCD(resultado, numeros[i]).mcd;
  }

  return resultado;
}

function obtenerDivisores(numero) {
  const divisores = [];

  for (let i = 1; i <= numero; i++) {
    if (numero % i === 0) {
      divisores.push(i);
    }
  }

  return divisores;
}

$("calcularMCD").addEventListener("click", () => {
  const distancias = obtenerDistanciasSeleccionadas();

  if (!distancias.length) {
    alert("Selecciona secuencias o agrega distancias manuales.");
    return;
  }

  const mcd = mcdDeLista(distancias);
  const divisores = obtenerDivisores(mcd);

  let html = `
    <div class="resultado-info">
      <strong>Distancias utilizadas:</strong>
      ${distancias.join(", ")}<br>
      <strong>Máximo común divisor:</strong>
      <span class="exito">${mcd}</span><br>
      <strong>Divisores:</strong>
      ${divisores.join(", ")}
    </div>
    <h3>Desarrollo del algoritmo de Euclides</h3>
  `;

  if (distancias.length === 1) {
    html += `<p class="ayuda">Sólo hay una distancia. Su MCD es ella misma.</p>`;
  } else {
    let a = distancias[0];

    for (let i = 1; i < distancias.length; i++) {
      const b = distancias[i];
      const calculo = calcularMCD(a, b);

      html += `
        <div class="resultado-info">
          MCD(${a}, ${b})<br>
          ${calculo.pasos.map(p =>
            `${p.a} = ${Math.floor(p.a / p.b)} × ${p.b} + ${p.resto}`
          ).join("<br>")}
          <br>Resultado: ${calculo.mcd}
        </div>
      `;

      a = calculo.mcd;
    }
  }

  $("resultadoMCD").innerHTML = html;
  mostrarCandidatos(mcd, distancias);
});

// =====================================================
// 8. EVALUACIÓN DE LONGITUDES DE CLAVE
// =====================================================

function mostrarCandidatos(mcd, distancias) {
  const zona = $("candidatosClave");
  zona.innerHTML = "";

  const maximo = Math.min(
    20,
    Math.max(2, textoNormalizado.length)
  );

  const candidatos = [];

  for (let longitud = 2; longitud <= maximo; longitud++) {
    const compatibles = distancias.filter(
      distancia => distancia % longitud === 0
    ).length;

    candidatos.push({
      longitud,
      compatibles,
      porcentaje: distancias.length
        ? compatibles / distancias.length * 100
        : 0,
      esDivisorMCD: mcd % longitud === 0
    });
  }

  candidatos.sort((a, b) => {
    if (b.compatibles !== a.compatibles) {
      return b.compatibles - a.compatibles;
    }

    if (a.esDivisorMCD !== b.esDivisorMCD) {
      return Number(b.esDivisorMCD) - Number(a.esDivisorMCD);
    }

    return a.longitud - b.longitud;
  });

  const titulo = document.createElement("h3");
  titulo.textContent = "Longitudes candidatas";
  zona.appendChild(titulo);

  const nota = document.createElement("p");
  nota.className = "ayuda";
  nota.textContent =
    "La compatibilidad indica cuántas distancias son divisibles " +
    "por cada longitud. No demuestra por sí sola que sea la clave correcta.";
  zona.appendChild(nota);

  candidatos.forEach(item => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "candidato";

    const texto = document.createElement("div");
    texto.innerHTML =
      `<strong>Longitud ${item.longitud}</strong> · ` +
      `${item.compatibles}/${distancias.length} distancias compatibles ` +
      `(${item.porcentaje.toFixed(1)}%)` +
      (item.esDivisorMCD ? " · Divisor del MCD" : "");

    const boton = document.createElement("button");
    boton.className = "secundario";
    boton.textContent = "Seleccionar esta longitud";

    boton.addEventListener("click", () => {
      $("longitudElegida").value = item.longitud;
      seleccionarLongitud(item.longitud);
    });

    tarjeta.append(texto, boton);
    zona.appendChild(tarjeta);
  });

  $("longitudElegida").value = "";
}

$("usarLongitud").addEventListener("click", () => {
  const longitud = Number($("longitudElegida").value);

  if (
    !Number.isInteger(longitud) ||
    longitud < 1 ||
    longitud > 100
  ) {
    alert("Introduce una longitud entera entre 1 y 100.");
    return;
  }

  seleccionarLongitud(longitud);
});

function seleccionarLongitud(longitud) {
  longitudActual = longitud;
  gruposActuales = [];
  claveCalculada = false;

  $("gruposMensaje").innerHTML = "";
  $("resultadosGrupos").innerHTML = "";
  $("resultadosClave").innerHTML = "";
  $("claveFinal").value = "";
  $("mensajeDescifrado").value = "";
  $("resultadoComprobacion").textContent = "";

  $("separarGrupos").disabled = false;
  actualizarEstadoBotones();

  $("gruposMensaje").textContent =
    `Longitud de clave seleccionada: ${longitud}. ` +
    `Pulsa "Separar mensaje en grupos" para continuar.`;
}

// =====================================================
// 9. SEPARACIÓN EN GRUPOS
// =====================================================

$("separarGrupos").addEventListener("click", () => {
  if (!longitudActual || !textoNormalizado) {
    alert("Selecciona primero una longitud de clave.");
    return;
  }

  gruposActuales = Array.from(
    { length: longitudActual },
    () => ""
  );

  for (let i = 0; i < textoNormalizado.length; i++) {
    const grupo = i % longitudActual;
    gruposActuales[grupo] += textoNormalizado[i];
  }

  mostrarGrupos();
  $("resultadosGrupos").innerHTML = "";
  $("resultadosClave").innerHTML = "";
  $("claveFinal").value = "";
  $("mensajeDescifrado").value = "";
  $("resultadoComprobacion").textContent = "";

  claveCalculada = false;
  actualizarEstadoBotones();
});

function obtenerContenidoGrupos() {
  return Array.from(
    document.querySelectorAll(".grupo-texto"),
    area => normalizarTexto(area.value)
  );
}

function mostrarGrupos() {
  const zona = $("gruposMensaje");
  zona.innerHTML = "";

  gruposActuales.forEach((contenido, indice) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "grupo";

    const titulo = document.createElement("h3");
    titulo.textContent = `Grupo ${indice + 1}`;

    const info = document.createElement("p");
    info.className = "grupo-info";
    info.textContent = `${contenido.length} letras`;

    const area = document.createElement("textarea");
    area.className = "grupo-texto";
    area.value = contenido;
    area.setAttribute("aria-label", `Contenido del grupo ${indice + 1}`);

    area.addEventListener("input", () => {
      info.textContent =
        `${normalizarTexto(area.value).length} letras`;
      invalidarAnalisisPosteriores();
    });

    tarjeta.append(titulo, info, area);
    zona.appendChild(tarjeta);
  });

  $("analizarGrupos").disabled = false;
  actualizarEstadoBotones();
}

function invalidarAnalisisPosteriores() {
  $("resultadosGrupos").innerHTML = "";
  $("resultadosClave").innerHTML = "";
  $("claveFinal").value = "";
  $("mensajeDescifrado").value = "";
  $("resultadoComprobacion").textContent = "";

  claveCalculada = false;
  actualizarEstadoBotones();
}

// =====================================================
// 10. FRECUENCIAS INDIVIDUALES POR GRUPO
// =====================================================

function calcularFrecuencias(texto) {
  const frecuencias = Array(26).fill(0);

  for (const letra of texto) {
    const indice = indiceLetra(letra);
    if (indice >= 0) frecuencias[indice]++;
  }

  return frecuencias;
}

function mostrarFrecuenciasGrupo(texto) {
  const frecuencias = calcularFrecuencias(texto);

  return frecuencias
    .map((cantidad, indice) => ({
      letra: ALFABETO[indice],
      cantidad
    }))
    .filter(item => item.cantidad > 0)
    .sort((a, b) => {
      if (b.cantidad !== a.cantidad) {
        return b.cantidad - a.cantidad;
      }

      return a.letra.localeCompare(b.letra);
    });
}

$("analizarGrupos").addEventListener("click", () => {
  const grupos = obtenerContenidoGrupos();

  if (!grupos.length || grupos.every(g => !g.length)) {
    alert("No hay letras para analizar en los grupos.");
    return;
  }

  gruposActuales = grupos;
  invalidarAnalisisPosteriores();

  const zona = $("resultadosGrupos");
  zona.innerHTML = "<h3>Frecuencias por grupo</h3>";

  grupos.forEach((grupo, indice) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "candidato";

    const titulo = document.createElement("h3");
    titulo.textContent = `Grupo ${indice + 1}`;

    const tabla = document.createElement("div");
    tabla.className = "tabla-contenedor";

    const frecuencias = mostrarFrecuenciasGrupo(grupo);

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr><th>Letra</th><th>Repeticiones</th><th>Porcentaje</th></tr>
      </thead>
      <tbody>
        ${frecuencias.map(item => `
          <tr>
            <td>${item.letra}</td>
            <td>${item.cantidad}</td>
            <td>${(item.cantidad / grupo.length * 100).toFixed(2)}%</td>
          </tr>
        `).join("")}
      </tbody>
    `;

    const total = document.createElement("p");
    total.className = "grupo-info";
    total.textContent = `Total de letras: ${grupo.length}`;

    tabla.appendChild(table);
    tarjeta.append(titulo, total, tabla);
    zona.appendChild(tarjeta);
  });

  $("recuperarClave").disabled = false;
  actualizarEstadoBotones();
});

// =====================================================
// 11. PRUEBA DE LOS 26 DESPLAZAMIENTOS
// =====================================================

// Descifra un grupo como si fuera César.
// El desplazamiento representa la letra de clave.
function descifrarCesar(texto, desplazamiento) {
  return texto.split("").map(letra => {
    const valor = indiceLetra(letra);
    return letraPorIndice(valor - desplazamiento);
  }).join("");
}

// Chi-cuadrado: compara las frecuencias observadas
// con las frecuencias esperadas del español.
function calcularChiCuadrado(texto) {
  if (!texto.length) return Infinity;

  const observadas = calcularFrecuencias(texto);
  const total = texto.length;
  let puntuacion = 0;

  for (let i = 0; i < 26; i++) {
    const esperado = total * FRECUENCIAS_ESPANOL[i] / 100;

    if (esperado > 0) {
      puntuacion +=
        Math.pow(observadas[i] - esperado, 2) / esperado;
    }
  }

  return puntuacion;
}

function analizarDesplazamientos(texto) {
  const resultados = [];

  for (let desplazamiento = 0; desplazamiento < 26; desplazamiento++) {
    const descifrado = descifrarCesar(texto, desplazamiento);
    const puntuacion = calcularChiCuadrado(descifrado);

    resultados.push({
      desplazamiento,
      letraClave: letraPorIndice(desplazamiento),
      puntuacion,
      texto: descifrado
    });
  }

  resultados.sort((a, b) => a.puntuacion - b.puntuacion);

  return resultados;
}

$("recuperarClave").addEventListener("click", () => {
  const grupos = obtenerContenidoGrupos();

  if (!grupos.length || grupos.some(g => !g.length)) {
    alert("Todos los grupos deben contener al menos una letra.");
    return;
  }

  gruposActuales = grupos;
  desplazamientosPorGrupo = grupos.map(
    grupo => analizarDesplazamientos(grupo)
  );

  claveCalculada = true;

  // Se toma la mejor puntuación estadística de cada grupo
  // como sugerencia inicial, no como respuesta definitiva.
  const sugerencia = desplazamientosPorGrupo
    .map(resultados => resultados[0].letraClave)
    .join("");

  $("claveFinal").value = sugerencia;
  mostrarResultadosClave();
  actualizarEstadoBotones();
});

function mostrarResultadosClave() {
  const zona = $("resultadosClave");
  zona.innerHTML = "";

  desplazamientosPorGrupo.forEach((resultados, indice) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "candidato";

    const titulo = document.createElement("h3");
    titulo.textContent = `Grupo ${indice + 1} · Desplazamientos`;

    const nota = document.createElement("p");
    nota.className = "ayuda";
    nota.textContent =
      "Ordenados por compatibilidad estadística. " +
      "Puntuación menor = mejor coincidencia.";

    const tablaZona = document.createElement("div");
    tablaZona.className = "tabla-desplazamientos";

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>Clave</th>
          <th>Desplazamiento</th>
          <th>Puntuación</th>
          <th>Texto provisional</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${resultados.map((item, posicion) => `
          <tr class="${posicion === 0 ? "mejor" : ""}">
            <td><strong>${item.letraClave}</strong></td>
            <td>${item.desplazamiento}</td>
            <td>${item.puntuacion.toFixed(2)}</td>
            <td>${item.texto.slice(0, 30)}${item.texto.length > 30 ? "…" : ""}</td>
            <td>
              <button class="secundario elegir-desplazamiento"
                data-grupo="${indice}"
                data-letra="${item.letraClave}">
                Usar
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    `;

    tablaZona.appendChild(table);
    tarjeta.append(titulo, nota, tablaZona);
    zona.appendChild(tarjeta);
  });
}

// Elegir una letra de clave desde una tabla.
$("resultadosClave").addEventListener("click", evento => {
  const boton = evento.target.closest(".elegir-desplazamiento");

  if (!boton) return;

  const grupo = Number(boton.dataset.grupo);
  const letra = boton.dataset.letra;

  const actual = normalizarTexto($("claveFinal").value)
    .split("");

  if (actual.length !== longitudActual) {
    actual.length = longitudActual;
    for (let i = 0; i < longitudActual; i++) {
      if (!actual[i]) actual[i] = "A";
    }
  }

  actual[grupo] = letra;
  $("claveFinal").value = actual.join("");

  $("estadoClave").textContent =
    `Grupo ${grupo + 1}: se seleccionó la letra ${letra}.`;

  actualizarEstadoBotones();
});

// =====================================================
// 12. VALIDACIÓN DE LA CLAVE
// =====================================================

function obtenerClaveValida() {
  const clave = normalizarTexto($("claveFinal").value);

  if (!longitudActual) {
    return {
      valida: false,
      mensaje: "Primero selecciona la longitud de clave."
    };
  }

  if (clave.length !== longitudActual) {
    return {
      valida: false,
      mensaje: `La clave debe tener exactamente ${longitudActual} letras.`
    };
  }

  return {
    valida: true,
    clave
  };
}

$("claveFinal").addEventListener("input", () => {
  $("resultadoComprobacion").textContent = "";
  actualizarEstadoBotones();
});

function actualizarEstadoBotones() {
  const clave = obtenerClaveValida();

  $("separarGrupos").disabled =
    !textoNormalizado || !longitudActual;

  $("analizarGrupos").disabled =
    !document.querySelector(".grupo-texto");

  $("recuperarClave").disabled =
    !document.querySelector(".grupo-texto");

  $("descifrar").disabled =
    !clave.valida;

  $("comprobar").disabled =
    !clave.valida || !$("mensajeDescifrado").value;
}

// =====================================================
// 13. DESCIFRADO VIGENÈRE Y RECONSTRUCCIÓN
// =====================================================

// Recorre el texto original y descifra solamente sus letras.
// Los signos, espacios, números y saltos de línea permanecen.
function descifrarMensajeCompleto(texto, clave) {
  let resultado = "";
  let posicion = 0;

  for (const caracter of texto) {
    const convertido = convertirLetra(caracter);

    if (/^\p{L}$/u.test(caracter) && convertido.length === 1 &&
        ALFABETO.includes(convertido)) {

      const valorCifrado = indiceLetra(convertido);
      const valorClave = indiceLetra(
        clave[posicion % clave.length]
      );

      const valorPlano = (valorCifrado - valorClave + 26) % 26;
      let letra = letraPorIndice(valorPlano);

      if (caracter === caracter.toLowerCase()) {
        letra = letra.toLowerCase();
      }

      resultado += letra;
      posicion++;
    } else {
      // Si un carácter se normaliza a una letra A-Z,
      // participa en el ciclo criptográfico.
      // Esto incluye caracteres como vocales acentuadas y Ñ.
      if (
        convertido.length === 1 &&
        ALFABETO.includes(convertido) &&
        /\p{L}/u.test(caracter)
      ) {
        const valorCifrado = indiceLetra(convertido);
        const valorClave = indiceLetra(
          clave[posicion % clave.length]
        );

        let letra = letraPorIndice(
          (valorCifrado - valorClave + 26) % 26
        );

        if (caracter === caracter.toLowerCase()) {
          letra = letra.toLowerCase();
        }

        resultado += letra;
        posicion++;
      } else {
        resultado += caracter;
      }
    }
  }

  return resultado;
}

// Recifra el mensaje reconstruido para comprobarlo.
function cifrarMensajeCompleto(texto, clave) {
  let resultado = "";
  let posicion = 0;

  for (const caracter of texto) {
    const convertido = convertirLetra(caracter);

    if (
      /\p{L}/u.test(caracter) &&
      convertido.length === 1 &&
      ALFABETO.includes(convertido)
    ) {
      const valorPlano = indiceLetra(convertido);
      const valorClave = indiceLetra(
        clave[posicion % clave.length]
      );

      let letra = letraPorIndice(
        (valorPlano + valorClave) % 26
      );

      if (caracter === caracter.toLowerCase()) {
        letra = letra.toLowerCase();
      }

      resultado += letra;
      posicion++;
    } else {
      resultado += caracter;
    }
  }

  return resultado;
}

// =====================================================
// 14. DESCIFRAR MENSAJE
// =====================================================

$("descifrar").addEventListener("click", () => {
  const validacion = obtenerClaveValida();

  if (!validacion.valida) {
    alert(validacion.mensaje);
    return;
  }

  const mensaje = descifrarMensajeCompleto(
    textoOriginal.value,
    validacion.clave
  );

  $("mensajeDescifrado").value = mensaje;
  $("resultadoComprobacion").textContent =
    "Mensaje descifrado. Puedes comprobarlo mediante recifrado.";

  actualizarEstadoBotones();
});

$("mensajeDescifrado").addEventListener("input", () => {
  actualizarEstadoBotones();
});

// =====================================================
// 15. COMPROBACIÓN MEDIANTE RECIFRADO
// =====================================================

$("comprobar").addEventListener("click", () => {
  const validacion = obtenerClaveValida();

  if (!validacion.valida) {
    alert(validacion.mensaje);
    return;
  }

  const originalNormalizado = normalizarTexto(textoOriginal.value);
  const recifradoNormalizado = normalizarTexto(
    cifrarMensajeCompleto(
      $("mensajeDescifrado").value,
      validacion.clave
    )
  );

  const zona = $("resultadoComprobacion");

  if (recifradoNormalizado === originalNormalizado) {
    zona.innerHTML =
      '<span class="exito">COMPROBACIÓN CORRECTA</span><br>' +
      "Al recifrar el mensaje descifrado se obtiene exactamente " +
      "la misma secuencia normalizada de letras A-Z que en el original.";
  } else {
    zona.innerHTML =
      '<span class="error">COMPROBACIÓN INCORRECTA</span><br>' +
      "El mensaje recifrado no coincide con el texto cifrado original. " +
      "Revisa la clave y el contenido del mensaje descifrado.";
  }
});

// =====================================================
// 16. COPIAR MENSAJE Y CLAVE
// =====================================================

async function copiarTexto(texto, descripcion) {
  if (!texto) {
    alert("No hay contenido para copiar.");
    return;
  }

  try {
    await navigator.clipboard.writeText(texto);
    alert(`${descripcion} copiado correctamente.`);
  } catch (error) {
    const auxiliar = document.createElement("textarea");
    auxiliar.value = texto;
    document.body.appendChild(auxiliar);
    auxiliar.select();

    const correcto = document.execCommand("copy");
    auxiliar.remove();

    alert(correcto
      ? `${descripcion} copiado correctamente.`
      : "No se pudo copiar el contenido.");
  }
}

$("copiarMensaje").addEventListener("click", () => {
  copiarTexto($("mensajeDescifrado").value, "Mensaje");
});

$("copiarClave").addEventListener("click", () => {
  copiarTexto($("claveFinal").value, "Clave");
});

// Estado inicial.
actualizarEstadoBotones();
