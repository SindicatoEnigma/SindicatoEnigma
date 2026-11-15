
/* ==========================================
   SISTEMA DE MINIJUEGOS
   SINDICATO ENIGMA
   ========================================== */

const contenedorMinijuegos = {
    catalogo: null,
    partidas: null,
    visor: null,

    listaJuegos: null,
    tituloPartidas: null,
    listaPartidas: null,

    tituloVisor: null,
    marco: null,

    botonVolverJuegos: null,
    botonVolverPartidas: null
};

let catalogoMinijuegos = [];
let juegoSeleccionado = null;


// ==========================================
// INICIALIZAR
// ==========================================

function inicializarMinijuegos() {

    const C = contenedorMinijuegos;

    C.catalogo = document.getElementById(
        "vista-listado-minijuegos"
    );

    C.partidas = document.getElementById(
        "vista-partidas-minijuegos"
    );

    C.visor = document.getElementById(
        "visor-minijuego"
    );

    C.listaJuegos = document.getElementById(
        "lista-minijuegos"
    );

    C.tituloPartidas = document.getElementById(
        "titulo-partidas-minijuegos"
    );

    C.listaPartidas = document.getElementById(
        "lista-partidas-minijuegos"
    );

    C.tituloVisor = document.getElementById(
        "titulo-minijuego"
    );

    C.marco = document.getElementById(
        "marco-minijuego"
    );

    C.botonVolverJuegos = document.getElementById(
        "btn-volver-minijuegos"
    );

    C.botonVolverPartidas = document.getElementById(
        "btn-volver-partidas"
    );

    if (Object.values(C).some(elemento => !elemento)) {

        console.error(
            "[SE] No se encontraron todos los elementos de Minijuegos."
        );

        return false;
    }

    if (!C.botonVolverJuegos.dataset.conectado) {

        C.botonVolverJuegos.addEventListener(
            "click",
            regresarCatalogoMinijuegos
        );

        C.botonVolverJuegos.dataset.conectado = "true";
    }

    if (!C.botonVolverPartidas.dataset.conectado) {

        C.botonVolverPartidas.addEventListener(
            "click",
            regresarPartidasMinijuegos
        );

        C.botonVolverPartidas.dataset.conectado = "true";
    }

    return true;
}


// ==========================================
// MOSTRAR CATÁLOGO PRINCIPAL
// ==========================================

window.mostrarMinijuegosPortal = async function () {

    if (!inicializarMinijuegos()) {
        return;
    }

    const C = contenedorMinijuegos;

    C.marco.src = "about:blank";

    C.catalogo.classList.remove("oculto");
    C.partidas.classList.add("oculto");
    C.visor.classList.add("oculto");

    C.listaJuegos.textContent = "Cargando minijuegos...";

    juegoSeleccionado = null;

    try {

        const respuesta = await fetch(
            "minijuegos/indice.json",
            { cache: "no-store" }
        );

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar minijuegos/indice.json");
        }

        const datos = await respuesta.json();

        if (!Array.isArray(datos.juegos)) {
            throw new Error("El catálogo no contiene una lista válida.");
        }

        catalogoMinijuegos = datos.juegos;

        C.listaJuegos.replaceChildren();

        if (catalogoMinijuegos.length === 0) {

            C.listaJuegos.textContent =
                "Todavía no hay minijuegos disponibles.";

            return;
        }

        catalogoMinijuegos.forEach(juego => {

            const boton = document.createElement("button");

            boton.type = "button";
            boton.className = "minijuego-item";

            const titulo = document.createElement("h3");
            titulo.textContent = juego.titulo || "Juego sin nombre";

            const descripcion = document.createElement("p");
            descripcion.textContent = juego.descripcion || "";

            boton.append(titulo, descripcion);

            boton.addEventListener("click", () => {
                mostrarPartidasMinijuego(juego);
            });

            C.listaJuegos.appendChild(boton);
        });

    } catch (error) {

        console.error("[SE] Error al cargar minijuegos:", error);

        C.listaJuegos.textContent =
            "No se pudieron cargar los minijuegos. Comprueba el catálogo JSON.";
    }
};


// ==========================================
// MOSTRAR PARTIDAS DE UN JUEGO
// ==========================================

function mostrarPartidasMinijuego(juego) {

    const C = contenedorMinijuegos;

    juegoSeleccionado = juego;

    C.catalogo.classList.add("oculto");
    C.partidas.classList.remove("oculto");
    C.visor.classList.add("oculto");

    C.tituloPartidas.textContent = juego.titulo;

    C.listaPartidas.replaceChildren();

    if (!Array.isArray(juego.partidas) || juego.partidas.length === 0) {

        C.listaPartidas.textContent =
            "Todavía no hay partidas disponibles.";

        return;
    }

    juego.partidas.forEach(partida => {

        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = "partida-minijuego-item";

        const titulo = document.createElement("h3");
        titulo.textContent = partida.titulo || "Partida sin nombre";

        boton.appendChild(titulo);

        boton.addEventListener("click", () => {
            abrirMinijuegoIndependiente(partida);
        });

        C.listaPartidas.appendChild(boton);
    });
}


// ==========================================
// ABRIR MINIJUEGO
// ==========================================

function abrirMinijuegoIndependiente(partida) {

    const C = contenedorMinijuegos;

    const rutaArchivo = partida.archivo;

    if (
        typeof rutaArchivo !== "string" ||
        !rutaArchivo.startsWith("minijuegos/") ||
        !/^[a-zA-Z0-9_./-]+\.html$/i.test(rutaArchivo) ||
        rutaArchivo.split("/").includes("..")
    ) {

        alert("La ruta del minijuego no es válida.");
        return;
    }

    if (partida.datos !== undefined) {

        if (
            typeof partida.datos !== "string" ||
            !partida.datos.startsWith("datos/") ||
            !/^[a-zA-Z0-9_./-]+\.txt$/i.test(partida.datos) ||
            partida.datos.split("/").includes("..")
        ) {

            alert("La ruta del archivo de datos no es válida.");
            return;
        }
    }

    const url = new URL(rutaArchivo, document.baseURI);

    if (url.origin !== window.location.origin) {

        alert("El minijuego debe pertenecer al mismo sitio.");
        return;
    }

    if (partida.datos) {

        url.searchParams.set("datos", partida.datos);
    }

    C.tituloVisor.textContent =
        partida.titulo || "SINDICATO ENIGMA";

    C.marco.src = url.href;

    C.catalogo.classList.add("oculto");
    C.partidas.classList.add("oculto");
    C.visor.classList.remove("oculto");
}


// ==========================================
// REGRESAR A PARTIDAS
// ==========================================

function regresarPartidasMinijuegos() {

    const C = contenedorMinijuegos;

    C.marco.src = "about:blank";

    C.visor.classList.add("oculto");
    C.partidas.classList.remove("oculto");
}


// ==========================================
// REGRESAR AL CATÁLOGO PRINCIPAL
// ==========================================

function regresarCatalogoMinijuegos() {

    const C = contenedorMinijuegos;

    C.marco.src = "about:blank";

    C.visor.classList.add("oculto");
    C.partidas.classList.add("oculto");
    C.catalogo.classList.remove("oculto");

    juegoSeleccionado = null;
}


console.log("[SE] Sistema de minijuegos iniciado.");
