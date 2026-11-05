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
    // Información de la secuencia que se ejecutará al terminar la parte.
secuencia: null,

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

    // Referencia al minijuego que está abierto.
juegoFrame: null,

// Secuencia que debe continuar cuando termine el minijuego.
secuenciaJuego: null,

    // Resultado recibido del minijuego.
resultadoJuego: null,

    // Configuración visual de rutas.
    //extensionImagen: ".svg"
    extensionesImagen: [".png", ".jpg", ".jpeg", ".webp", ".svg"]
};


// ============================================================
// 2. ELEMENTOS HTML
// ============================================================

const UI = {
        // Portal principal.
    portal: document.getElementById("portal"),
    listaHistorias: document.getElementById("lista-historias"),
    listaMinijuegos: document.getElementById("lista-minijuegos"),
    listaNoticias: document.getElementById("lista-noticias"),
    listaHerramientas: document.getElementById("lista-herramientas"),
    contenidoNosotros: document.getElementById("contenido-nosotros"),
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


// ============================================================
// 3. CAMBIO DE PANTALLA Y NAVEGACIÓN
// ============================================================

// Mostrar una experiencia a pantalla completa.
function mostrarPantalla(pantalla) {

    // Ocultamos el portal.
    UI.portal.style.display = "none";

    // Ocultamos todas las pantallas anteriores.
    document.querySelectorAll(".pantalla").forEach(elemento => {
        elemento.classList.remove("activa");
    });

    // Activamos únicamente la pantalla solicitada.
    pantalla.classList.add("activa");
}


// Regresar al portal principal.
function mostrarPortal() {

    document.querySelectorAll(".pantalla").forEach(elemento => {
        elemento.classList.remove("activa");
    });

    UI.portal.style.display = "flex";
}


// Mostrar una sección del portal.
function mostrarSeccionPortal(nombre) {

    mostrarPortal();

    // Ocultamos todas las secciones.
    document.querySelectorAll(".seccion-portal").forEach(seccion => {
        seccion.classList.add("oculto");
    });

    // Mostramos la sección seleccionada.
    const seccion = document.getElementById(
        `seccion-${nombre}`
    );

    if (!seccion) {
        console.warn("[SE] Sección no encontrada:", nombre);
        return;
    }

    seccion.classList.remove("oculto");

    // Acciones específicas de cada sección.
    switch (nombre) {

        case "historias":
            mostrarHistoriasPortal();
            break;

        case "minijuegos":
            UI.listaMinijuegos.textContent =
                "Próximamente encontrarás aquí los minijuegos independientes.";
            break;

        case "noticias":
            UI.listaNoticias.textContent =
                "Aquí aparecerán las noticias del Sindicato Enigma.";
            break;

        case "herramientas":
            UI.listaHerramientas.textContent =
                "Esta sección estará disponible próximamente.";
            break;

        case "nosotros":
            UI.contenidoNosotros.textContent =
                "Conoce el proyecto, sus colaboradores y sus creadores.";
            break;
    }
}

// ============================================================
// 4. CARGA INICIAL
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("[SE] Motor iniciado.");
        // Conectar las opciones del menú principal.
    document.querySelectorAll(".opcion-menu").forEach(boton => {

        boton.addEventListener("click", () => {

            AudioEngine.click();

            const seccion = boton.dataset.seccion;

            mostrarSeccionPortal(seccion);

        });

    });

    // Recibir resultados enviados por los minijuegos.
window.addEventListener(
    "message",
    recibirResultadoMinijuego
);

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
// ============================================================
// 5. CASO DE DEMOSTRACIÓN
// ============================================================

async function cargarCasoDemo() {

    try {

        const respuesta = await fetch(
            "historias/halloween/configuracion.json"
        );

        if (!respuesta.ok) {
            throw new Error("No se encontró configuracion.json");
        }

        Engine.caso = await respuesta.json();

        console.log(
            "[SE] Caso cargado:",
            Engine.caso.titulo
        );

    } catch (error) {

        console.error(
            "[SE] Error cargando caso:",
            error
        );

        Engine.caso = {
            id: "demo",
            titulo: "Caso de demostración",
            descripcion: "No se pudo cargar la configuración.",
            personajes: [],
            capitulos: []
        };

    }

    // Al terminar la carga, entramos al portal en Noticias.
    mostrarSeccionPortal("noticias");
}


// ============================================================
// 6. ARCHIVO DE CASOS
// ============================================================


// ============================================================
// 6. CATÁLOGO DE HISTORIAS EN EL PORTAL
// ============================================================

function mostrarArchivo() {

    // El antiguo archivo ahora será el catálogo de historias.
    mostrarSeccionPortal("historias");
}


function mostrarHistoriasPortal() {

    UI.listaHistorias.innerHTML = "";

    if (!Engine.caso) {

        UI.listaHistorias.textContent = "Cargando historias...";

        return;
    }

    // Crear la tarjeta de la historia.
    const expediente = document.createElement("button");

    expediente.className = "expediente";

    const titulo = document.createElement("h3");
    titulo.textContent = Engine.caso.titulo;

    const descripcion = document.createElement("p");
    descripcion.textContent = Engine.caso.descripcion;

    expediente.appendChild(titulo);
    expediente.appendChild(descripcion);

    expediente.addEventListener("click", () => {

        AudioEngine.click();

        if (Engine.caso.capitulos.length > 0) {

            mostrarCapitulo(
                Engine.caso,
                Engine.caso.capitulos[0]
            );

        }

    });

    UI.listaHistorias.appendChild(expediente);
}

// ============================================================
// 7. MENÚ DE CAPÍTULO
// ============================================================

/*function mostrarCapitulo(caso, capitulo) {

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
*/
// ============================================================
// 7. CAPÍTULOS DENTRO DEL PORTAL
// ============================================================

function mostrarCapitulo(caso, capitulo) {

    Engine.caso = caso;
    Engine.capitulo = capitulo;

    // Regresamos al portal.
    mostrarPortal();

    // Dejamos visible únicamente la sección Historias.
    document.querySelectorAll(".seccion-portal").forEach(seccion => {
        seccion.classList.add("oculto");
    });

    document.getElementById("seccion-historias")
        .classList.remove("oculto");

    // Limpiamos el contenido anterior.
    UI.listaHistorias.innerHTML = "";

    // Botón para regresar al catálogo.
    const volver = document.createElement("button");

    volver.className = "boton-secundario";
    volver.textContent = "← Volver a historias";

    volver.addEventListener("click", () => {

        AudioEngine.click();

        mostrarHistoriasPortal();

    });

    UI.listaHistorias.appendChild(volver);

    // Título del capítulo.
    const titulo = document.createElement("h3");

    titulo.textContent = capitulo.titulo;

    titulo.style.marginTop = "25px";

    UI.listaHistorias.appendChild(titulo);

    // Descripción del capítulo.
    const descripcion = document.createElement("p");

    descripcion.textContent = capitulo.descripcion || "";

    UI.listaHistorias.appendChild(descripcion);

    // Lista de partes.
    capitulo.partes.forEach((parte, indice) => {

        const boton = document.createElement("button");

        boton.className = "item-parte";

        const numero = document.createElement("span");

        numero.className = "numero-parte";

        numero.textContent =
            String(indice + 1).padStart(2, "0");

        const informacion = document.createElement("span");

        const nombre = document.createElement("strong");

        nombre.textContent = parte.titulo;

        const tipo = document.createElement("span");

        tipo.className = "tipo-parte";
        tipo.textContent = parte.tipo;

        informacion.appendChild(nombre);
        informacion.appendChild(document.createElement("br"));
        informacion.appendChild(tipo);

        boton.appendChild(numero);
        boton.appendChild(informacion);

        boton.addEventListener("click", () => {

            AudioEngine.click();

            cargarParte(parte);

        });

        UI.listaHistorias.appendChild(boton);

    });

}

// ============================================================
// 8. CARGAR UNA PARTE .TXT
// ============================================================
async function cargarParte(parte, rutaPersonalizada = null) {

    /*
        Si recibimos una ruta personalizada, la utilizamos.
        De lo contrario, construimos la ruta habitual.
    */

    const ruta = rutaPersonalizada ||
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
            El parser ahora devuelve dos elementos:
            - instrucciones: diálogos, personajes, fondos, etc.
            - secuencia: información para continuar la historia.
        */

        const resultado = parsearGuion(texto);

        Engine.instrucciones = resultado.instrucciones;
        Engine.secuencia = resultado.secuencia;

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


    // ============================================================
// 9. PARSER DEL GUIÓN
// ============================================================

function parsearGuion(texto) {

    const lineas =
        texto.replace(/\r\n/g, "\n").split("\n");

    const instrucciones = [];

    let secuencia = null;

    let i = 0;

    while (i < lineas.length) {

        const linea = lineas[i].trim();

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

        // ====================================================
        // BLOQUE SECUENCIA
        // ====================================================

        if (linea === "[SECUENCIA]") {

            secuencia = {};

            i++;

            while (
                i < lineas.length &&
                lineas[i].trim() !== "[FIN SECUENCIA]"
            ) {

                const contenido = lineas[i].trim();

                if (
                    contenido &&
                    !contenido.startsWith("#")
                ) {

                    const separador =
                        contenido.indexOf(":");

                    if (separador > 0) {

                        const clave =
                            contenido
                                .substring(0, separador)
                                .trim()
                                .toUpperCase();

                        const valor =
                            contenido
                                .substring(separador + 1)
                                .trim();

                        secuencia[clave] = valor;
                    }
                }

                i++;
            }

            // Saltar [FIN SECUENCIA].
            if (
                i < lineas.length &&
                lineas[i].trim() === "[FIN SECUENCIA]"
            ) {

                i++;

            } else {

                console.warn(
                    "[SE] Falta [FIN SECUENCIA]."
                );
            }

            continue;
        }

        // ====================================================
        // COMANDOS ENTRE CORCHETES
        // ====================================================

        if (
            linea.startsWith("[") &&
            linea.endsWith("]")
        ) {

            const contenido =
                linea.slice(1, -1).trim();

            // =================================================
            // BLOQUE DOCUMENTO
            // =================================================

            if (
                contenido.startsWith("DOCUMENTO ")
            ) {

                const nombre =
                    contenido
                        .substring("DOCUMENTO ".length)
                        .trim();

                const bloque = [];

                i++;

                while (
                    i < lineas.length &&
                    lineas[i].trim() !== "[FIN DOCUMENTO]"
                ) {

                    bloque.push(lineas[i]);

                    i++;
                }

                instrucciones.push({
                    tipo: "documento",
                    nombre: nombre,
                    texto: bloque.join("\n").trim()
                });

                // Saltar [FIN DOCUMENTO].
                if (
                    i < lineas.length &&
                    lineas[i].trim() === "[FIN DOCUMENTO]"
                ) {
                    i++;
                }

                continue;
            }

            // =================================================
            // COMANDO NORMAL
            // =================================================

            const partes =
                contenido.split(/\s+/);

            instrucciones.push({
                tipo: "comando",
                comando: partes[0].toUpperCase(),
                parametros: partes.slice(1)
            });

            i++;

            continue;
        }

        // ====================================================
        // DIÁLOGO
        // ====================================================

        const separador =
            linea.indexOf(":");

        if (separador > 0) {

            const personaje =
                linea
                    .substring(0, separador)
                    .trim();

            const textoDialogo =
                linea
                    .substring(separador + 1)
                    .trim();

            instrucciones.push({
                tipo: "dialogo",
                personaje: personaje,
                texto: textoDialogo
            });

            i++;

            continue;
        }

        // ====================================================
        // NARRACIÓN
        // ====================================================

        instrucciones.push({
            tipo: "narracion",
            texto: linea
        });

        i++;
    }

    // ========================================================
    // COMPATIBILIDAD CON FIN PARTE
    // ========================================================

    /*
        Si existe una SECUENCIA, esta será la encargada
        de decidir qué ocurre al terminar la parte.

        Por eso eliminamos un posible [FIN PARTE]
        que haya quedado en las instrucciones.
    */

    if (secuencia) {

        for (
            let j = instrucciones.length - 1;
            j >= 0;
            j--
        ) {

            const instruccion =
                instrucciones[j];

            if (
                instruccion.tipo === "comando" &&
                instruccion.comando === "FIN" &&
                instruccion.parametros[0] === "PARTE"
            ) {

                instrucciones.splice(j, 1);
            }
        }
    }

    return {
        instrucciones: instrucciones,
        secuencia: secuencia
    };
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

        /*case "FONDO":
            cambiarFondo(p[0]);
            ejecutarSiguiente();
            break;
        */
        case "FONDO":
    cambiarFondo(p[0]).then(() => {
        ejecutarSiguiente();
    });
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

/*function cambiarFondo(nombre) {

    if (!nombre) {
        console.warn("[SE] FONDO sin nombre.");
        return;
    }

    const ruta =
        `url("recursos/${Engine.caso.id}/fondos/${nombre}${Engine.extensionImagen}")`;

    UI.escena.style.backgroundImage = ruta;

    console.log("[SE] Fondo:", nombre);
}

function cambiarFondo(nombre) {

    if (!nombre) {
        console.warn("[SE] FONDO sin nombre.");
        return;
    }

    const extension = /\.(png|jpg|jpeg|svg|webp)$/i.test(nombre)
        ? ""
        : Engine.extensionImagen;

    const ruta =
        `url("recursos/${Engine.caso.id}/fondos/${nombre}${extension}")`;

    UI.escena.style.backgroundImage = ruta;

    console.log("[SE] Fondo:", nombre);
    console.log("[SE] Ruta:", ruta);
}
*/
async function cambiarFondo(nombre) {

    if (!nombre) {
        console.warn("[SE] FONDO sin nombre.");
        return;
    }

    const tieneExtension =
        /\.(png|jpg|jpeg|webp|svg)$/i.test(nombre);

    const rutaBase =
        `recursos/${Engine.caso.id}/fondos/` +
        (tieneExtension
            ? nombre.substring(0, nombre.lastIndexOf("."))
            : nombre);

    const ruta = await buscarImagen(rutaBase);

    if (!ruta) {
        console.warn(
            "[SE] No se pudo cargar el fondo:",
            nombre
        );
        return;
    }

    UI.escena.style.backgroundImage =
        `url("${ruta}")`;

    console.log("[SE] Fondo cargado:", ruta);
}

// ============================================================
// 13. PERSONAJES
// ============================================================



async function mostrarPersonaje(
    nombre,
    expresion,
    lado = "izquierda"
) {

    const id = normalizarId(nombre);

    let elemento =
        document.getElementById(`personaje-${id}`);

    let esNuevo = false;

    if (!elemento) {

        elemento = document.createElement("img");

        elemento.id = `personaje-${id}`;

        elemento.className =
            "personaje entrando";

        UI.capaPersonajes.appendChild(elemento);

        esNuevo = true;
    }

    elemento.classList.remove(
        "izquierda",
        "derecha"
    );

    elemento.classList.add(lado);

    const rutaBase =
        `recursos/${Engine.caso.id}/personajes/` +
        `${nombre}/${nombre}_${expresion}`;

    const ruta =
        await buscarImagen(rutaBase);

    if (!ruta) {

        console.warn(
            `[SE] No se encontró la expresión: ` +
            `${nombre}_${expresion}`
        );

        if (esNuevo) elemento.remove();

        return;
    }

    elemento.src = ruta;

    Engine.personajes[id] = {
        nombre: nombre,
        expresion: expresion,
        lado: lado
    };

    // Si es un personaje nuevo, esperar su entrada.

    if (esNuevo) {

        await new Promise(resolve => {
            requestAnimationFrame(resolve);
        });

        elemento.classList.remove("entrando");

        await esperarTransicion(elemento);
    }

    console.log(
        "[SE] Personaje cargado:",
        nombre,
        expresion,
        lado,
        ruta
    );
}

function marcarPersonajeHablando(nombre) {

    const idHablante = normalizarId(nombre);

    Object.keys(Engine.personajes).forEach(id => {

        const elemento =
            document.getElementById(`personaje-${id}`);

        if (!elemento) return;

        if (id === idHablante) {

            // El personaje que habla vuelve a estar iluminado.
            elemento.classList.remove("no-habla");

            // Reiniciamos la animación para que ocurra
            // cada vez que comienza una intervención.
            elemento.classList.remove("hablando");

            void elemento.offsetWidth;

            elemento.classList.add("hablando");

        } else {

            // Todos los demás personajes quedan ligeramente oscuros.
            elemento.classList.add("no-habla");
        }
    });
}


function esperarTransicion(elemento, duracionMaxima = 300) {

    return new Promise(resolve => {

        let resuelta = false;

        const terminar = () => {

            if (resuelta) return;

            resuelta = true;

            clearTimeout(seguridad);

            elemento.removeEventListener(
                "transitionend",
                alTerminar
            );

            resolve();
        };

        const alTerminar = (evento) => {

            if (evento.target === elemento) {
                terminar();
            }
        };

        const seguridad = setTimeout(
            terminar,
            duracionMaxima
        );

        elemento.addEventListener(
            "transitionend",
            alTerminar
        );

    });
}

/*function ocultarPersonaje(nombre) {

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
*/
async function ocultarPersonaje(nombre) {

    if (!nombre) {

        console.warn("[SE] OCULTAR sin nombre.");

        return;
    }

    const id =
        `personaje-${normalizarId(nombre)}`;

    const elemento =
        document.getElementById(id);

    if (!elemento) {

        console.warn(
            `[SE] No se puede ocultar "${nombre}" porque no está visible.`
        );

        return;
    }

    elemento.classList.add("saliendo");

    await esperarTransicion(elemento);

    elemento.remove();

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
    //const personajesConocidos = ["EL", "MARGARET"];
    const personajesConocidos =
    Engine.caso.personajes || [];
    
    if (personajesConocidos.includes(comando)) {

    const expresion = p[0] || "normal";
    const lado = p[1] || "izquierda";

    mostrarPersonaje(
        comando,
        expresion,
        lado
    ).then(() => {

        marcarPersonajeHablando(comando);

        ejecutarSiguiente();

    });

    return;
    }
    

    // Si no es personaje, usamos la lógica normal.
    switch (comando) {
        
case "MUSICA": {

    const accion = (p[0] || "").toUpperCase();

    // DETENER
    if (accion === "DETENER") {

        AudioEngine.stopMusic().then(() => {
            ejecutarSiguiente();
        });

    }

    // PAUSA
    else if (accion === "PAUSA") {

        AudioEngine.pauseMusic();

        ejecutarSiguiente();
    }

    // REANUDAR
    else if (accion === "REANUDAR") {

        AudioEngine.resumeMusic();

        ejecutarSiguiente();
    }

    // VOLUMEN
    else if (accion === "VOLUMEN") {

        AudioEngine.setVolume(p[1]);

        ejecutarSiguiente();
    }

    // REPRODUCIR CANCIÓN
    else if (p[0]) {

        const ruta =
            `historias/${Engine.caso.id}/` +
            `${Engine.capitulo.id}/musica/${p[0]}`;

        AudioEngine.playTrack(ruta).then(() => {
            ejecutarSiguiente();
        });

    }

    else {

        console.warn("[SE] Comando MUSICA sin parámetros.");

        ejecutarSiguiente();
    }

    break;
}

        /*case "FONDO":
            cambiarFondo(p[0]);
            ejecutarSiguiente();
            break;
        */
        case "FONDO":

    cambiarFondo(p[0]).then(() => {

        ejecutarSiguiente();

    });

    break;

        /*case "OCULTAR":
            if (p[0] === "TODOS") {
                document.querySelectorAll(".personaje").forEach(el => el.remove());
                Engine.personajes = {};
            } else {
                ocultarPersonaje(p[0]);
            }
            ejecutarSiguiente();
            break;
        */

        case "OCULTAR":

    if (p[0] === "TODOS") {

        const elementos = Array.from(
            document.querySelectorAll(".personaje")
        );

        elementos.forEach(el => {
            el.classList.add("saliendo");
        });

        Promise.all(
            elementos.map(el => esperarTransicion(el))
        ).then(() => {

            elementos.forEach(el => el.remove());

            Engine.personajes = {};

            ejecutarSiguiente();

        });

    } else {

        ocultarPersonaje(p[0]).then(() => {

            ejecutarSiguiente();

        });

    }

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

/*function mostrarDialogo(personaje, texto) {

    cerrarDocumento();

    UI.dialogo.classList.remove("oculto");

    UI.nombrePersonaje.textContent = personaje;
    escribirTexto(UI.textoDialogo, texto);
}
*/
function mostrarDialogo(personaje, texto) {

    cerrarDocumento();

    setTimeout(() => {

        UI.dialogo.classList.remove("oculto");

        UI.nombrePersonaje.textContent = personaje;
        escribirTexto(UI.textoDialogo, texto);

    }, 1000);
}


// ============================================================
// 17. NARRACIÓN
// ============================================================

/*
function mostrarNarracion(texto) {

    cerrarDocumento();

    UI.dialogo.classList.remove("oculto");

    UI.nombrePersonaje.textContent = "NARRADOR";

    escribirTexto(UI.textoDialogo, texto);
}
*/
function mostrarNarracion(texto) {

    cerrarDocumento();

    setTimeout(() => {

        UI.dialogo.classList.remove("oculto");

        UI.nombrePersonaje.textContent = "NARRADOR";

        escribirTexto(UI.textoDialogo, texto);

    }, 1000);
}


// ============================================================
// 18. EFECTO DE ESCRITURA
// ============================================================


function escribirTexto(elemento, texto) {

    // Si había un texto escribiéndose, lo detenemos.
    if (Engine.temporizadorTexto) {
        clearInterval(Engine.temporizadorTexto);
    }

    Engine.textoActual = texto;
    Engine.indiceTexto = 0;
    Engine.escribiendo = true;

    elemento.textContent = "";

    // Reiniciamos la posición para comenzar desde arriba.
    elemento.scrollTop = 0;

    Engine.temporizadorTexto = setInterval(() => {

        Engine.indiceTexto++;

        /*elemento.textContent =
            Engine.textoActual.substring(0, Engine.indiceTexto);

        // Mantenemos visible la parte más reciente del texto.
        elemento.scrollTop = elemento.scrollHeight;
        */
        elemento.textContent =
    Engine.textoActual.substring(0, Engine.indiceTexto);

// Reproducimos un pequeño sonido al escribir cada carácter.
const caracter =
    Engine.textoActual[Engine.indiceTexto - 1];

if (caracter && /\S/.test(caracter)) {
    AudioEngine.type();
}

// Mantenemos visible la parte más reciente del texto.
elemento.scrollTop = elemento.scrollHeight;
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



// ============================================================
// 19. AVANZAR
// ============================================================

function avanzar() {

    // Intentamos reanudar la música tras una interacción del usuario.
    AudioEngine.resumeMusic();

    // Si el texto todavía se está escribiendo,
    // el primer toque lo completa inmediatamente.

    if (Engine.escribiendo) {

        clearInterval(Engine.temporizadorTexto);

        UI.textoDialogo.textContent = Engine.textoActual;

        UI.textoDialogo.scrollTop =
            UI.textoDialogo.scrollHeight;

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


// ============================================================
// 22. MINIJUEGOS
// ============================================================

// Puzzle de demostración antiguo.
function abrirPuzzle(idPuzzle) {

    Engine.escenaAntesPuzzle = {
        indice: Engine.indice,
        personajes: structuredClone(Engine.personajes),
        fondo: UI.escena.style.backgroundImage
    };

    mostrarPantalla(UI.puzzle);

    UI.puzzleTitulo.textContent = idPuzzle;

    montarPuzzleDemo(idPuzzle);
}


// Abrir un minijuego independiente dentro de un iframe.
function abrirMinijuego(secuencia) {

    const archivo = secuencia.ARCHIVO;

    if (!archivo) {
        console.error("[SE] La secuencia JUEGO no tiene ARCHIVO.");
        alert("Error: falta indicar el archivo del minijuego.");
        Engine.secuenciaJuego = null;
        mostrarCapitulo(Engine.caso, Engine.capitulo);
        return;
    }

    const url = new URL(archivo, document.baseURI);

    if (url.origin !== window.location.origin) {
        console.error("[SE] El minijuego debe pertenecer al mismo sitio.");
        alert("Error: la dirección del minijuego no es válida.");
        Engine.secuenciaJuego = null;
        mostrarCapitulo(Engine.caso, Engine.capitulo);
        return;
    }

    if (secuencia.DATOS) {
        url.searchParams.set("datos", secuencia.DATOS);
    }

    const iframe = document.createElement("iframe");

    iframe.title = secuencia.TITULO || "Minijuego";
    iframe.src = url.href;

    Engine.juegoFrame = iframe;

    UI.puzzleTitulo.textContent =
        secuencia.TITULO || "Minijuego";

    UI.puzzleContenido.replaceChildren(iframe);

    mostrarPantalla(UI.puzzle);

    console.log("[SE] Minijuego abierto:", url.href);
}


// Recibir el resultado enviado por el minijuego.
function recibirResultadoMinijuego(evento) {

    if (!Engine.juegoFrame) return;

    if (evento.source !== Engine.juegoFrame.contentWindow) {
        return;
    }

    if (evento.origin !== window.location.origin) {
        return;
    }

    const mensaje = evento.data;

    if (
        !mensaje ||
        mensaje.tipo !== "SE_MINIJUEGO_RESULTADO"
    ) {
        return;
    }

    const resultado = mensaje.resultado;

    if (
        !resultado ||
        resultado.completado !== true
    ) {
        console.warn("[SE] Resultado de minijuego no válido.");
        return;
    }

    console.log("[SE] Resultado recibido:", resultado);

    Engine.resultadoJuego = resultado;

    const secuencia = Engine.secuenciaJuego;

    Engine.juegoFrame = null;
    Engine.secuenciaJuego = null;

    UI.puzzleContenido.replaceChildren();

    if (secuencia && secuencia.SIGUIENTE) {

        Engine.secuencia = {
            TIPO: "GUION",
            SIGUIENTE: secuencia.SIGUIENTE
        };

        finalizarParte();

    } else {

        mostrarCapitulo(Engine.caso, Engine.capitulo);
    }
}


// Demo provisional del minijuego.
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
        });
}


// Salir del minijuego sin avanzar la historia.

function salirPuzzle() {

    Engine.juegoFrame = null;
    Engine.secuenciaJuego = null;
    Engine.resultadoJuego = null;

    UI.puzzleContenido.replaceChildren();

    mostrarCapitulo(Engine.caso, Engine.capitulo);
}

// ============================================================
// 23. FINALIZACIÓN
// ============================================================

function finalizarParte() {

    console.log("[SE] Fin de parte.");

    // Recuperamos la secuencia guardada al cargar el guion.
    const secuencia = Engine.secuencia;

    // Limpiamos la secuencia para evitar reutilizarla accidentalmente.
    Engine.secuencia = null;

    /*
        SECUENCIA: GUION
        Carga automáticamente otra parte de la historia.
    */

    /*
    SECUENCIA: JUEGO
    Abre un minijuego independiente.
*/

if (secuencia && secuencia.TIPO === "JUEGO") {

    Engine.secuenciaJuego = secuencia;

    console.log("[SE] Iniciando minijuego.");

    abrirMinijuego(secuencia);

    return;
}

    if (secuencia && secuencia.TIPO === "GUION") {

        const ruta = secuencia.SIGUIENTE;

        if (!ruta) {

            console.error("[SE] La secuencia GUION no tiene SIGUIENTE.");

            alert("Error: falta indicar el siguiente guion.");

            mostrarCapitulo(Engine.caso, Engine.capitulo);

            return;
        }

        /*
            La ruta debe tener esta estructura:
            capitulo01/parte02.txt

            Comprobamos que el capítulo y la parte existan
            en configuracion.json antes de cargar el archivo.
        */

        const segmentos = ruta.split("/");

        if (
            segmentos.length !== 2 ||
            segmentos.some(segmento =>
                !segmento ||
                segmento === "." ||
                segmento === ".."
            )
        ) {

            console.error("[SE] Ruta de secuencia no válida:", ruta);

            alert("Error: la ruta del siguiente guion no es válida.");

            mostrarCapitulo(Engine.caso, Engine.capitulo);

            return;
        }

        const idCapitulo = segmentos[0];
        const nombreArchivo = segmentos[1];

        const siguienteCapitulo = Engine.caso.capitulos.find(
            capitulo => capitulo.id === idCapitulo
        );

        if (!siguienteCapitulo) {

            console.error("[SE] No existe el capítulo:", idCapitulo);

            alert("Error: no se encontró el capítulo indicado.");

            mostrarCapitulo(Engine.caso, Engine.capitulo);

            return;
        }

        const siguienteParte = siguienteCapitulo.partes.find(
            parte => parte.archivo === nombreArchivo
        );

        if (!siguienteParte) {

            console.error("[SE] No existe la parte:", nombreArchivo);

            alert("Error: no se encontró la parte indicada.");

            mostrarCapitulo(Engine.caso, Engine.capitulo);

            return;
        }

        // Actualizamos el capítulo actual.
        Engine.capitulo = siguienteCapitulo;

        console.log("[SE] Continuando automáticamente:", ruta);

        cargarParte(siguienteParte, `historias/${Engine.caso.id}/${ruta}`);

        return;
    }

    /*
        Si no hay secuencia, conservamos el comportamiento anterior.
        Esto mantiene la compatibilidad con guiones antiguos.
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


// ============================================================
// 26. NORMALIZACIÓN DE IDS
// ============================================================

function normalizarId(texto) {

    /*
        Convierte nombres como:
        "EL" -> "el"
        "Señora Margaret" -> "senora-margaret"
    */

    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}


// ============================================================
// 27. BUSCADOR AUTOMÁTICO DE IMÁGENES
// ============================================================

function buscarImagen(rutaBase) {

    return new Promise((resolver) => {

        // Si el nombre ya tiene extensión, probamos solamente esa.
        const tieneExtension =
            /\.(png|jpg|jpeg|webp|svg)$/i.test(rutaBase);

        if (tieneExtension) {

            const imagen = new Image();

            imagen.onload = () => resolver(rutaBase);
            imagen.onerror = () => resolver(null);

            imagen.src = rutaBase;
            return;
        }

        let indice = 0;

        function probarSiguiente() {

            if (indice >= Engine.extensionesImagen.length) {

                console.warn(
                    "[SE] No se encontró la imagen:",
                    rutaBase
                );

                resolver(null);
                return;
            }

            const extension =
                Engine.extensionesImagen[indice];

            const ruta = rutaBase + extension;

            const imagen = new Image();

            imagen.onload = () => {

                console.log(
                    "[SE] Imagen encontrada:",
                    ruta
                );

                resolver(ruta);
            };

            imagen.onerror = () => {
                indice++;
                probarSiguiente();
            };

            imagen.src = ruta;
        }

        probarSiguiente();
    });
}
