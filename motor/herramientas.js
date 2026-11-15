
/* ==========================================
   SISTEMA DE HERRAMIENTAS
   SINDICATO ENIGMA
   ========================================== */

// Elementos principales
const contenedorHerramientas = {
    catalogo: null,
    visor: null,
    lista: null,
    titulo: null,
    marco: null,
    botonRegresar: null
};

// Inicializar el sistema
function inicializarHerramientas() {

    contenedorHerramientas.catalogo =
        document.getElementById("vista-listado-herramientas");

    contenedorHerramientas.visor =
        document.getElementById("visor-herramienta");

    contenedorHerramientas.lista =
        document.getElementById("lista-herramientas");

    contenedorHerramientas.titulo =
        document.getElementById("titulo-herramienta");

    contenedorHerramientas.marco =
        document.getElementById("marco-herramienta");

    contenedorHerramientas.botonRegresar =
        document.getElementById("btn-volver-herramientas");

    if (
        !contenedorHerramientas.catalogo ||
        !contenedorHerramientas.visor ||
        !contenedorHerramientas.lista ||
        !contenedorHerramientas.titulo ||
        !contenedorHerramientas.marco ||
        !contenedorHerramientas.botonRegresar
    ) {
        console.error("[SE] No se encontraron los elementos de Herramientas.");
        return false;
    }

    // Conectar el botón de regreso
    if (!contenedorHerramientas.botonRegresar.dataset.conectado) {

    contenedorHerramientas.botonRegresar.addEventListener(
        "click",
        regresarCatalogoHerramientas
    );

    contenedorHerramientas.botonRegresar.dataset.conectado = "true";
}

    return true;
}


// ==========================================
// MOSTRAR CATÁLOGO
// ==========================================

window.mostrarHerramientasPortal = async function () {

    if (!inicializarHerramientas()) {
        return;
    }

    const catalogo = contenedorHerramientas.catalogo;
    const visor = contenedorHerramientas.visor;
    const lista = contenedorHerramientas.lista;

    catalogo.classList.remove("oculto");
    visor.classList.add("oculto");

    // Limpiar la aplicación anterior
    contenedorHerramientas.marco.src = "about:blank";

    lista.textContent = "Cargando herramientas...";

    try {

        const respuesta = await fetch("minijuegos/herramientas/indice.json", {
            cache: "no-store"
        });

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar herramientas/indice.json");
        }

        const datos = await respuesta.json();

        if (!Array.isArray(datos.herramientas)) {
            throw new Error("El catálogo no contiene una lista válida.");
        }

        lista.replaceChildren();

        if (datos.herramientas.length === 0) {
            lista.textContent = "Todavía no hay herramientas disponibles.";
            return;
        }

        datos.herramientas.forEach(herramienta => {

            const boton = document.createElement("button");
            boton.className = "herramienta-item";
            boton.type = "button";

            const titulo = document.createElement("h3");
            titulo.textContent = herramienta.titulo || "Herramienta sin nombre";

            const descripcion = document.createElement("p");
            descripcion.textContent = herramienta.descripcion || "";

            boton.appendChild(titulo);
            boton.appendChild(descripcion);

            boton.addEventListener("click", () => {
                abrirHerramienta(herramienta);
            });

            lista.appendChild(boton);
        });

    } catch (error) {

        console.error("[SE] Error al cargar herramientas:", error);

        lista.textContent =
            "No se pudieron cargar las herramientas. Comprueba el catálogo JSON.";
    }
};


// ==========================================
// ABRIR UNA HERRAMIENTA
// ==========================================

function abrirHerramienta(herramienta) {

    const rutaArchivo = herramienta.archivo;

    // Validar que la aplicación pertenezca
    // a la carpeta de herramientas permitida.
    if (
        typeof rutaArchivo !== "string" ||
        !/^minijuegos\/herramientas\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.html$/i.test(rutaArchivo)
    ) {
        alert("La ruta de la herramienta no es válida.");
        return;
    }

    const rutaHTML = rutaArchivo
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    contenedorHerramientas.titulo.textContent =
        "SINDICATO ENIGMA";

    contenedorHerramientas.marco.src = rutaHTML;

    contenedorHerramientas.catalogo.classList.add("oculto");
    contenedorHerramientas.visor.classList.remove("oculto");
}


// ==========================================
// REGRESAR AL CATÁLOGO
// ==========================================

function regresarCatalogoHerramientas() {

    contenedorHerramientas.marco.src = "about:blank";

    contenedorHerramientas.visor.classList.add("oculto");
    contenedorHerramientas.catalogo.classList.remove("oculto");
}


console.log("[SE] Sistema de herramientas iniciado.");
