/*
AUDIO:
El guion indica el nombre del sonido.
Los archivos se buscan en [TRIVIA]/sonidos/.
Puedes cambiar los nombres directamente en guion.txt.
*/
const AudioTrivia=(()=>{let actual=null;
function reproducir(ruta){if(!ruta)return;detenerActual();actual=new Audio(ruta);actual.preload="auto";actual.play().catch(()=>console.warn("El navegador espera una interacción para reproducir audio."));return actual}
function detenerActual(){if(actual){actual.pause();actual.currentTime=0;actual=null}}
return{reproducir,detenerActual}})();