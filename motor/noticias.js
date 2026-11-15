
/* ================================= */
/* SISTEMA DE NOTICIAS               */
/* SINDICATO ENIGMA                   */
/* ================================= */

window.mostrarNoticiasPortal = async function () {

    const lista = document.getElementById("lista-noticias");
    const vistaListado = document.getElementById("vista-listado-noticias");
    const visor = document.getElementById("visor-noticia");

    if (!lista || !vistaListado || !visor) {
        console.error("[SE] No se encontraron los elementos de Noticias.");
        return;
    }

    // Mostrar catálogo y ocultar visor
    vistaListado.classList.remove("oculto");
    visor.classList.add("oculto");

    lista.textContent = "Cargando noticias...";

    try {

        // Leer el índice de noticias
        const respuesta = await fetch("noticias/indice.json", {
            cache: "no-store"
        });

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar noticias/indice.json");
        }

        const datos = await respuesta.json();

        if (!Array.isArray(datos.noticias)) {
            throw new Error("El índice JSON no tiene una lista válida.");
        }

        lista.replaceChildren();

        if (datos.noticias.length === 0) {
            lista.textContent = "Todavía no hay noticias publicadas.";
            return;
        }

        // Crear una tarjeta por cada noticia
        datos.noticias.forEach(noticia => {

            const boton = document.createElement("button");
            boton.className = "noticia-item";
            boton.type = "button";

            const titulo = document.createElement("h3");
            titulo.textContent = noticia.titulo || "Noticia sin título";

            const fecha = document.createElement("p");
            fecha.textContent = noticia.fecha || "";

            boton.appendChild(titulo);
            boton.appendChild(fecha);

            boton.addEventListener("click", () => {
                abrirNoticia(noticia);
            });

            lista.appendChild(boton);
        });

    } catch (error) {

        console.error("[SE] Error al cargar noticias:", error);

        lista.textContent =
            "No se pudieron cargar las noticias. Comprueba el índice JSON y la carpeta noticias.";
    }
};


// =================================
// ABRIR UNA NOTICIA
// =================================

function abrirNoticia(noticia) {

    const vistaListado = document.getElementById("vista-listado-noticias");
    const visor = document.getElementById("visor-noticia");
    const titulo = document.getElementById("titulo-noticia-abierta");
    const pdf = document.getElementById("pdf-noticia");
    const enlace = document.getElementById("enlace-pdf-noticia");

    // Aceptar únicamente nombres de archivo PDF simples
    if (
        typeof noticia.archivo !== "string" ||
        !/^[a-zA-Z0-9_.-]+\.pdf$/i.test(noticia.archivo) ||
        noticia.archivo.includes("..")
    ) {
        alert("El nombre del archivo PDF no es válido.");
        return;
    }

    const rutaPDF = "noticias/" + encodeURIComponent(noticia.archivo);

    titulo.textContent = noticia.titulo || "Documento sin título";

    pdf.src = rutaPDF;
    enlace.href = rutaPDF;

    vistaListado.classList.add("oculto");
    visor.classList.remove("oculto");
}


// =================================
// REGRESAR AL CATÁLOGO
// =================================

document.getElementById("btn-volver-noticias")
    ?.addEventListener("click", () => {

        const vistaListado =
            document.getElementById("vista-listado-noticias");

        const visor =
            document.getElementById("visor-noticia");

        const pdf =
            document.getElementById("pdf-noticia");

        pdf.src = "";

        visor.classList.add("oculto");
        vistaListado.classList.remove("oculto");
    });

console.log("[SE] Sistema de noticias iniciado.");
