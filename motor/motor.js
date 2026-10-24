/*
    ============================================================
    SINDICATO ENIGMA - MOTOR NARRATIVO
    ============================================================

    Este archivo es el "cerebro" del prototipo.

    Su trabajo principal es:

    1. Cargar la configuración de un caso.
    2. Mostrar el archivo de casos.
    3. Cargar una parte .txt.
    4. Interpretar comandos como [FONDO ...] o [EL normal].
    5. Mostrar diálogos y narración.
    6. Abrir documentos.
    7. Abrir minijuegos.
    8. Volver a la escena cuando termina un minijuego.

    IMPORTANTE:
    Este motor está escrito de forma deliberadamente sencilla.
    La prioridad es que puedas LEERLO y entenderlo antes de
    intentar convertirlo en un sistema mucho más grande.
*/

// ============================================================
// 1. ESTADO GLOBAL
// ============================================================

const Engine = {

    // Caso actualmente cargado.
    caso: null,

    // Capítulo actualmente seleccionado.
    capitulo: null,

    // Parte que estamos ejecutando.
    parte: null,

    // Lista de instrucciones de la parte.
    instrucciones: [],

    // Índice de la instrucción actual.
    indice: 0,

    // Texto que actualmente se está escribiendo letra por letra.
    textoActual: "",

    // Índice de carácter visible durante el efecto de escritura.
    indiceTexto: 0,

    // Temporizador del efecto de escritura.
    temporizadorTexto: null,

    // Indica si estamos en medio de la animación de escritura.
    escribiendo: false,

    // Guarda el estado visual de los personajes.
    personajes: {},

    // Guarda la escena anterior cuando abrimos un puzzle.
    escenaAntesPuzzle: null,

    // Configuración visual de rutas.
    extensionImagen: ".svg"
};


// ============================================================
// 2. ELEMENTOS HTML
// ============================================================

const UI = {
    inicio: document.getElementById("pantalla-inicio"),
    archivo: document.getElementById("pantalla-archivo"),
    capitulo: document.getElementById("pantalla-capitulo"),
    historia: document.getElementById("pantalla-historia"),
    puzzle: document.getElementById("pantalla-puzzle"),
    config: document.getElementById("pantalla-config"),

    listaCasos: document.getElementById("lista-casos"),
    listaPartes: document.getElementById("lista-partes"),

    escena: document.getElementById("escena"),
    capaPersonajes: document.getElementById("capa-personajes"),

    dialogo: document.getElementById("dialogo"),
    nombrePersonaje: document.getElementById("nombre-personaje"),
    textoDialogo: document.getElementById("texto-dialogo"),
    indicadorAvance: document.getElementById("indicador-avance"),

    documento: document.getElementById("documento"),
    textoDocumento: document.getElementById("texto-documento"),

    puzzleTitulo: document.getElementById("puzzle-titulo"),
    puzzleContenido: document.getElementById("puzzle-contenido")
};


// ============================================================
// 3. CAMBIO DE PANTALLA
// ============================================================

function mostrarPantalla(pantalla) {

    /*
        Todas las pantallas tienen la clase "pantalla".
        Quitamos "activa" de todas y se la damos únicamente
        a la pantalla que queremos mostrar.
    */

    document.querySelectorAll(".pantalla").forEach(elemento => {
        elemento.classList.remove("activa");
    });

    pantalla.classList.add("activa");
}


// ============================================================
// 4. CARGA INICIAL
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("[SE] Motor iniciado.");

    // Botones principales.
    document.getElementById("btn-iniciar").addEventListener("click", () => {
        AudioEngine.click();
        mostrarArchivo();
    });

    document.getElementById("btn-volver-archivo").addEventListener("click", () => {
        AudioEngine.click();
        mostrarArchivo();
    });

    document.getElementById("btn-menu-historia").addEventListener("click", () => {
        AudioEngine.click();
        mostrarCapitulo(Engine.caso, Engine.capitulo);
    });

    document.getElementById("btn-cerrar-documento").addEventListener("click", () => {
        AudioEngine.click();
        cerrarDocumento();
        avanzar();
    });

    document.getElementById("btn-salir-puzzle").addEventListener("click", () => {
        AudioEngine.click();
        salirPuzzle();
    });

    document.getElementById("btn-config").addEventListener("click", () => {
        mostrarPantalla(UI.config);
    });

    document.getElementById("btn-cerrar-config").addEventListener("click", () => {
        mostrarArchivo();
    });

    document.getElementById("btn-musica").addEventListener("click", () => {
        const activo = AudioEngine.toggleMusic();
        document.getElementById("btn-musica").textContent = activo ? "♫" : "♩";
    });

    document.getElementById("btn-sonido").addEventListener("click", () => {
        const activo = AudioEngine.toggleSound();
        document.getElementById("btn-sonido").textContent = activo ? "🔊" : "🔇";
    });

    /*
        El click/tap sobre la escena intenta avanzar.

        No usamos un listener global sobre todo el documento porque
        el usuario también necesita poder hacer scroll dentro de
        textos largos sin avanzar accidentalmente.
    */
    UI.escena.addEventListener("click", manejarClickEscena);

    /*
        Teclado: útil cuando pruebas el juego desde una computadora.
        En móvil simplemente se ignora.
    */
    document.addEventListener("keydown", evento => {
        if (evento.key === "Enter" || evento.key === " ") {
            if (UI.historia.classList.contains("activa")) {
                avanzar();
            }
        }
    });

    // Cargamos el caso de demostración.
    cargarCasoDemo();
});


// ============================================================
// 5. CASO DE DEMOSTRACIÓN
// ============================================================

async function cargarCasoDemo() {

    /*
        En producción podemos tener un archivo índice con muchos casos.
        Para que este prototipo sea fácil de estudiar, dejamos un caso
        directamente definido aquí.
    */

    try {
        const respuesta = await fetch("historias/halloween/configuracion.json");

        if (!respuesta.ok) {
            throw new Error("No se encontró configuracion.json");
        }

        Engine.caso = await respuesta.json();
        Engine.extensionImagen = Engine.caso.extensionImagen || ".png";

        console.log("[SE] Caso cargado:", Engine.caso.titulo);

    } catch (error) {
        console.error("[SE] Error cargando caso:", error);

        /*
            Si el archivo no carga, mostramos información en consola
            y usamos un objeto mínimo para que el programa no se rompa.
        */
        Engine.caso = {
            id: "demo",
            titulo: "Caso de demostración",
            descripcion: "No se pudo cargar la configuración.",
            capitulos: []
        };
    }
}


// ============================================================
// 6. ARCHIVO DE CASOS
// ============================================================

function mostrarArchivo() {

    mostrarPantalla(UI.archivo);

    UI.listaCasos.innerHTML = "";

    if (!Engine.caso) {
        UI.listaCasos.textContent = "Cargando archivo...";
        return;
    }

    /*
        En una versión futura, esta lista se generará desde un
        archivo indice.json con todos los casos publicados.
    */

    const expediente = document.createElement("button");
    expediente.className = "expediente";

    expediente.innerHTML = `
        <h3>${escapeHTML(Engine.caso.titulo)}</h3>
        <p>${escapeHTML(Engine.caso.descripcion)}</p>
    `;

    expediente.addEventListener("click", () => {
        AudioEngine.click();

        // Para este prototipo abrimos el primer capítulo.
        if (Engine.caso.capitulos.length > 0) {
            mostrarCapitulo(Engine.caso, Engine.caso.capitulos[0]);
        }
    });

    UI.listaCasos.appendChild(expediente);
}


// ============================================================
// 7. MENÚ DE CAPÍTULO
// ============================================================

function mostrarCapitulo(caso, capitulo) {

    Engine.caso = caso;
    Engine.capitulo = capitulo;

    mostrarPantalla(UI.capitulo);

    document.getElementById("capitulo-etiqueta").textContent =
        capitulo.id.toUpperCase();

    document.getElementById("capitulo-titulo").textContent =
        capitulo.titulo;

    UI.listaPartes.innerHTML = "";

    capitulo.partes.forEach((parte, indice) => {

        const boton = document.createElement("button");
        boton.className = "item-parte";

        boton.innerHTML = `
            <span class="numero-parte">${String(indice + 1).padStart(2, "0")}</span>
            <span>
                <strong>${escapeHTML(parte.titulo)}</strong><br>
                <span class="tipo-parte">${escapeHTML(parte.tipo)}</span>
            </span>
        `;

        boton.addEventListener("click", () => {
            AudioEngine.click();
            cargarParte(parte);
        });

        UI.listaPartes.appendChild(boton);
    });
}


// ============================================================
// 8. CARGAR UNA PARTE .TXT
// ============================================================

async function cargarParte(parte) {

    /*
        La ruta se construye a partir de:
        historias/halloween/capitulo01/parte01.txt

        Esto permite que cada parte sea un archivo independiente.
    */

    const ruta =
        `historias/${Engine.caso.id}/${Engine.capitulo.id}/${parte.archivo}`;

    console.log("[SE] Cargando:", ruta);

    try {

        const respuesta = await fetch(ruta);

        if (!respuesta.ok) {
            throw new Error(`HTTP ${respuesta.status}`);
        }

        const texto = await respuesta.text();

        Engine.parte = parte;

        /*
            parsearGuion convierte el texto plano en una lista
            de instrucciones que el motor puede ejecutar.
        */
        Engine.instrucciones = parsearGuion(texto);
        Engine.indice = 0;

        limpiarEscena();

        mostrarPantalla(UI.historia);

        ejecutarSiguiente();

    } catch (error) {

        console.error("[SE] No se pudo cargar la parte:", error);

        alert(
            "No se pudo cargar esta parte.\n\n" +
            "Revisa la consola del navegador para obtener más información."
        );
    }
}


// ============================================================
// 9. PARSER DEL GUIÓN
// ============================================================

function parsearGuion(texto) {

    /*
        El parser es una de las piezas más importantes del sistema.

        Ejemplo de entrada:

        [FONDO casa]

        [EL normal]
        EL: Buenas noches.

        El resultado será algo parecido a:

        [
            { tipo: "comando", comando: "FONDO", parametros: ["casa"] },
            { tipo: "comando", comando: "EL", parametros: ["normal"] },
            { tipo: "dialogo", personaje: "EL", texto: "Buenas noches." }
        ]

        De esta manera el motor no necesita interpretar todo el texto
        cada vez que avanza.
    */

    const lineas = texto.replace(/\r\n/g, "\n").split("\n");
    const resultado = [];

    let i = 0;

    while (i < lineas.length) {

        let linea = lineas[i].trim();

        // Ignorar líneas vacías.
        if (!linea) {
            i++;
            continue;
        }

        // Ignorar comentarios.
        if (linea.startsWith("#")) {
            i++;
            continue;
        }

        // Comando entre corchetes.
        if (linea.startsWith("[") && linea.endsWith("]")) {

            const contenido = linea.slice(1, -1).trim();

            // Comando de bloque DOCUMENTO.
            if (contenido.startsWith("DOCUMENTO ")) {

                const nombre = contenido.substring("DOCUMENTO ".length).trim();
                const bloque = [];

                i++;

                while (
                    i < lineas.length &&
                    lineas[i].trim() !== "[FIN DOCUMENTO]"
                ) {
                    bloque.push(lineas[i]);
                    i++;
                }

                resultado.push({
                    tipo: "documento",
                    nombre: nombre,
                    texto: bloque.join("\n").trim()
                });

                i++;
                continue;
            }

            const partes = contenido.split(/\s+/);

            resultado.push({
                tipo: "comando",
                comando: partes[0].toUpperCase(),
                parametros: partes.slice(1)
            });

            i++;
            continue;
        }

        // Línea de diálogo: PERSONAJE: texto
        const separador = linea.indexOf(":");

        if (separador > 0) {

            const personaje = linea
                .substring(0, separador)
                .trim();

            const textoDialogo = linea
                .substring(separador + 1)
                .trim();

            resultado.push({
                tipo: "dialogo",
                personaje: personaje,
                texto: textoDialogo
            });

            i++;
            continue;
        }

        /*
            Cualquier línea que no sea comando ni diálogo se considera
            narración. Esto permite escribir:

            [NARRADOR]
            La puerta se abrió.

            sin necesitar una sintaxis especial de cierre.
        */
        resultado.push({
            tipo: "narracion",
            texto: linea
        });

        i++;
    }

    return resultado;
}


// ============================================================
// 10. EJECUTAR LA SIGUIENTE INSTRUCCIÓN
// ============================================================

function ejecutarSiguiente() {

    if (Engine.indice >= Engine.instrucciones.length) {
        finalizarParte();
        return;
    }

    const instruccion = Engine.instrucciones[Engine.indice];

    /*
        Aumentamos el índice aquí porque la instrucción ya está
        siendo procesada. Si es un diálogo, "avanzar()" no volverá
        a ejecutar el mismo elemento.
    */
    Engine.indice++;

    switch (instruccion.tipo) {

        case "comando":
            ejecutarComando(instruccion);
            break;

        case "dialogo":
            mostrarDialogo(
                instruccion.personaje,
                instruccion.texto
            );
            break;

        case "narracion":
            mostrarNarracion(instruccion.texto);
            break;

        case "documento":
            mostrarDocumento(
                instruccion.nombre,
                instruccion.texto
            );
            break;

        default:
            console.warn("[SE] Tipo de instrucción desconocido:", instruccion);
            ejecutarSiguiente();
    }
}


// ============================================================
// 11. COMANDOS
// ============================================================

function ejecutarComando(instruccion) {

    const comando = instruccion.comando;
    const p = instruccion.parametros;

    switch (comando) {

        case "FONDO":
            cambiarFondo(p[0]);
            ejecutarSiguiente();
            break;

        case "OCULTAR":
            ocultarPersonaje(p[0]);
            ejecutarSiguiente();
            break;

        case "PUZZLE":
            abrirPuzzle(p[0]);
            break;

        case "FIN":
            /*
                [FIN PARTE] y [FIN CAPITULO] se representan
                internamente como comando FIN + parámetro.
            */
            if (p[0] === "PARTE") {
                finalizarParte();
            } else if (p[0] === "CAPITULO") {
                finalizarCapitulo();
            } else {
                ejecutarSiguiente();
            }
            break;

        case "NARRADOR":
            /*
                [NARRADOR] es principalmente un marcador semántico.
                La siguiente línea ya se interpreta como narración.
            */
            ejecutarSiguiente();
            break;

        default:
            console.warn("[SE] Comando desconocido:", comando, p);

            /*
                Regla importante de tolerancia a errores:
                un comando desconocido no debe congelar todo el juego.
            */
            ejecutarSiguiente();
    }
}


// ============================================================
// 12. FONDO
// ============================================================

function cambiarFondo(nombre) {

    if (!nombre) {
        console.warn("[SE] FONDO sin nombre.");
        return;
    }

    const ruta =
        `url("recursos/${Engine.caso.id}/fondos/${nombre}${Engine.extensionImagen}")`;

    UI.escena.style.backgroundImage = ruta;

    console.log("[SE] Fondo:", nombre);
}


// ============================================================
// 13. PERSONAJES
// ============================================================

function mostrarPersonaje(nombre, expresion, lado = "izquierda") {

    const id = normalizarId(nombre);

    /*
        Si el personaje ya existe, cambiamos solamente su imagen.
        Así evitamos que la expresión provoque un salto de posición.
    */
    let elemento = document.getElementById(`personaje-${id}`);

    if (!elemento) {

        elemento = document.createElement("img");

        elemento.id = `personaje-${id}`;
        elemento.className = "personaje entrando";

        UI.capaPersonajes.appendChild(elemento);

        // La clase se quita después de la animación de entrada.
        requestAnimationFrame(() => {
            elemento.classList.remove("entrando");
        });
    }

    const ladoAnterior = elemento.classList.contains("derecha")
        ? "derecha"
        : "izquierda";

    elemento.classList.remove("izquierda", "derecha");
    elemento.classList.add(lado);

    const ruta =
        `recursos/${Engine.caso.id}/personajes/${nombre}/${nombre}_${expresion}${Engine.extensionImagen}`;

    /*
        Regla de robustez:
        si una expresión no existe, conservamos la imagen anterior.
    */
    const imagenAnterior = elemento.src;

    elemento.onerror = () => {

        console.warn(
            `[SE] No existe la expresión: ${ruta}. ` +
            `Se conserva la última imagen válida.`
        );

        if (imagenAnterior) {
            elemento.src = imagenAnterior;
        } else {
            /*
                Primera aparición sin imagen:
                no mostramos una imagen rota.
            */
            elemento.remove();
        }
    };

    elemento.onload = () => {
        elemento.onerror = null;
    };

    elemento.src = ruta;

    Engine.personajes[id] = {
        nombre: nombre,
        expresion: expresion,
        lado: lado
    };

    console.log("[SE] Personaje:", nombre, expresion, lado);
}


function ocultarPersonaje(nombre) {

    if (!nombre) {
        console.warn("[SE] OCULTAR sin nombre.");
        return;
    }

    const id = `personaje-${normalizarId(nombre)}`;
    const elemento = document.getElementById(id);

    if (!elemento) {
        console.warn(`[SE] No se puede ocultar "${nombre}" porque no está visible.`);
        return;
    }

    elemento.classList.add("saliendo");

    setTimeout(() => {
        elemento.remove();
    }, 260);

    delete Engine.personajes[normalizarId(nombre)];
}


// ============================================================
// 14. FONDO + PERSONAJE COMO COMANDO
// ============================================================

function ejecutarComandoPersonaje(instruccion) {
    // Esta función queda preparada para una futura separación
    // del parser, pero el prototipo interpreta [EL normal] dentro
    // de ejecutarComando.
}


// ============================================================
// 15. MODIFICACIÓN DEL PARSER PARA PERSONAJES
// ============================================================

/*
    Interceptamos los comandos de personaje mediante una función
    auxiliar. Se utiliza desde una versión extendida de ejecutarComando.
*/
const ejecutarComandoOriginal = ejecutarComando;

ejecutarComando = function(instruccion) {

    const comando = instruccion.comando;
    const p = instruccion.parametros;

    /*
        Si el comando coincide con un nombre de personaje,
        lo tratamos como:
        [EL normal]
        [EL normal derecha]
    */
    const personajesConocidos = ["EL", "MARGARET"];

    if (personajesConocidos.includes(comando)) {

        const expresion = p[0] || "normal";
        const lado = p[1] || "izquierda";

        mostrarPersonaje(comando, expresion, lado);

        ejecutarSiguiente();
        return;
    }

    // Si no es personaje, usamos la lógica normal.
    switch (comando) {

        case "FONDO":
            cambiarFondo(p[0]);
            ejecutarSiguiente();
            break;

        case "OCULTAR":
            if (p[0] === "TODOS") {
                document.querySelectorAll(".personaje").forEach(el => el.remove());
                Engine.personajes = {};
            } else {
                ocultarPersonaje(p[0]);
            }
            ejecutarSiguiente();
            break;

        case "PUZZLE":
            abrirPuzzle(p[0]);
            break;

        case "FIN":
            if (p[0] === "PARTE") {
                finalizarParte();
            } else if (p[0] === "CAPITULO") {
                finalizarCapitulo();
            } else {
                ejecutarSiguiente();
            }
            break;

        case "NARRADOR":
            ejecutarSiguiente();
            break;

        default:
            console.warn("[SE] Comando desconocido:", comando, p);
            ejecutarSiguiente();
    }
};


// ============================================================
// 16. DIÁLOGO
// ============================================================

function mostrarDialogo(personaje, texto) {

    cerrarDocumento();

    UI.dialogo.classList.remove("oculto");

    UI.nombrePersonaje.textContent = personaje;
    escribirTexto(UI.textoDialogo, texto);
}


// ============================================================
// 17. NARRACIÓN
// ============================================================

function mostrarNarracion(texto) {

    cerrarDocumento();

    UI.dialogo.classList.remove("oculto");

    UI.nombrePersonaje.textContent = "NARRADOR";

    escribirTexto(UI.textoDialogo, texto);
}


// ============================================================
// 18. EFECTO DE ESCRITURA
// ============================================================

function escribirTexto(elemento, texto) {

    /*
        Si había un texto escribiéndose, lo detenemos.
    */
    if (Engine.temporizadorTexto) {
        clearInterval(Engine.temporizadorTexto);
    }

    Engine.textoActual = texto;
    Engine.indiceTexto = 0;
    Engine.escribiendo = true;

    elemento.textContent = "";

    Engine.temporizadorTexto = setInterval(() => {

        Engine.indiceTexto++;

        elemento.textContent =
            Engine.textoActual.substring(0, Engine.indiceTexto);

        if (Engine.indiceTexto >= Engine.textoActual.length) {

            clearInterval(Engine.temporizadorTexto);

            Engine.temporizadorTexto = null;
            Engine.escribiendo = false;

            UI.indicadorAvance.textContent = "▼";
        }

    }, 20);
}


// ============================================================
// 19. AVANZAR
// ============================================================

function avanzar() {

    /*
        Si el texto todavía se está escribiendo, el primer toque
        lo completa inmediatamente.

        Esto evita obligar al jugador a esperar.
    */
    if (Engine.escribiendo) {

        clearInterval(Engine.temporizadorTexto);

        UI.textoDialogo.textContent = Engine.textoActual;

        Engine.temporizadorTexto = null;
        Engine.escribiendo = false;

        return;
    }

    AudioEngine.click();

    UI.dialogo.classList.add("oculto");

    ejecutarSiguiente();
}


// ============================================================
// 20. CONTROL DE CLIC / TOUCH
// ============================================================

function manejarClickEscena(evento) {

    /*
        Si el usuario está tocando un elemento interactivo,
        no queremos que el toque también avance la historia.
    */

    if (
        evento.target.closest("button") ||
        evento.target.closest(".documento")
    ) {
        return;
    }

    avanzar();
}


// ============================================================
// 21. DOCUMENTOS
// ============================================================

function mostrarDocumento(nombre, texto) {

    UI.dialogo.classList.add("oculto");

    UI.documento.classList.remove("oculto");

    UI.textoDocumento.textContent = texto;

    /*
        El documento ocupa casi toda la pantalla y su texto
        puede desplazarse verticalmente.
    */

    console.log("[SE] Documento abierto:", nombre);
}


function cerrarDocumento() {
    UI.documento.classList.add("oculto");
}


// ============================================================
// 22. MINIJUEGOS
// ============================================================

function abrirPuzzle(idPuzzle) {

    /*
        Guardamos una referencia del estado actual.
        En una versión avanzada se puede guardar un snapshot
        completo de la escena.
    */
    Engine.escenaAntesPuzzle = {
        indice: Engine.indice,
        personajes: structuredClone(Engine.personajes),
        fondo: UI.escena.style.backgroundImage
    };

    mostrarPantalla(UI.puzzle);

    UI.puzzleTitulo.textContent = idPuzzle;

    /*
        Por ahora tenemos un "adaptador" de demostración.
        Más adelante cada juego será un módulo independiente:

        minijuegos/crucigrama/crucigrama.js
        minijuegos/sudoku/sudoku.js
        etc.
    */
    montarPuzzleDemo(idPuzzle);
}


function montarPuzzleDemo(idPuzzle) {

    UI.puzzleContenido.innerHTML = `
        <div class="puzzle-demo">
            <h3>${escapeHTML(idPuzzle)}</h3>

            <p>
                Este espacio representa el módulo del minijuego.
                El motor narrativo queda pausado mientras el jugador
                resuelve el puzzle.
            </p>

            <button id="btn-completar-puzzle">
                Simular puzzle completado
            </button>

            <div id="resultado-puzzle" class="resultado"></div>
        </div>
    `;

    document
        .getElementById("btn-completar-puzzle")
        .addEventListener("click", () => {

            AudioEngine.click();

            document.getElementById("resultado-puzzle").textContent =
                "Resultado devuelto: COMPLETADO";

            /*
                En el sistema definitivo el puzzle devolverá un objeto,
                por ejemplo:

                {
                    estado: "completado",
                    palabra: "HECATE",
                    codigo: "4721"
                }

                La historia podría utilizar ese resultado.
            */
        });
}


function salirPuzzle() {

    /*
        Al salir regresamos a la escena narrativa.
        El motor continúa desde la siguiente instrucción.
    */

    mostrarPantalla(UI.historia);

    Engine.escenaAntesPuzzle = null;

    ejecutarSiguiente();
}


// ============================================================
// 23. FINALIZACIÓN
// ============================================================

function finalizarParte() {

    console.log("[SE] Fin de parte.");

    /*
        Si hay una siguiente parte, podríamos cargarla automáticamente.
        En esta versión dejamos que el jugador regrese al menú para
        mantener clara la selección manual de capítulos/partes.
    */

    const continuar = confirm(
        "Fin de la parte.\n\n" +
        "¿Quieres volver al menú del capítulo?"
    );

    if (continuar) {
        mostrarCapitulo(Engine.caso, Engine.capitulo);
    }
}


function finalizarCapitulo() {

    /*
        [FIN CAPITULO] es diferente de [FIN PARTE].
        Aquí podríamos mostrar:
        - una contraseña,
        - una imagen desbloqueada,
        - una pantalla de caso cerrado,
        - o regresar al archivo.

        Para el prototipo regresamos al capítulo.
    */

    alert("Capítulo terminado.");
    mostrarCapitulo(Engine.caso, Engine.capitulo);
}


// ============================================================
// 24. LIMPIEZA
// ============================================================

function limpiarEscena() {

    UI.capaPersonajes.innerHTML = "";

    Engine.personajes = {};

    UI.dialogo.classList.add("oculto");
    UI.documento.classList.add("oculto");

    /*
        Restauramos un fondo genérico.
        El guion deberá definir su propio [FONDO ...].
    */
    UI.escena.style.backgroundImage =
        "radial-gradient(circle at 50% 35%, #444 0%, #181818 50%, #050505 100%)";
}


// ============================================================
// 25. SEGURIDAD BÁSICA PARA TEXTO DINÁMICO
// ============================================================

function escapeHTML(texto) {

    /*
        El texto de las historias no debería interpretarse como HTML.
        Esta función convierte caracteres especiales para evitar que
        un texto narrativo termine ejecutando etiquetas HTML.

        Es una medida sencilla pero importante.
    */

    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// 26. NORMALIZACIÓN DE IDS
// ============================================================

function normalizarId(texto) {

    /*
        Convierte nombres como:
        "EL" -> "el"
        "Señora Margaret" -> "señora-margaret"

        Así podemos utilizarlos de forma segura como IDs HTML.
    */

    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
