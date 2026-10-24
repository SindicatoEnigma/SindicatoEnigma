/*
    AUDIO.JS
    --------
    Este pequeño módulo centraliza el audio.

    En la versión inicial no dependemos de una biblioteca externa.
    Usamos Web Audio API para generar un pequeño "click".

    La música real se puede agregar después colocando un archivo MP3/OGG
    en recursos/.../musica/ y asignándolo desde la configuración.
*/

const AudioEngine = {
    musicEnabled: true,
    soundEnabled: true,
    music: null,

    init() {
        // Aquí podríamos crear el objeto Audio de música.
        // No lo hacemos automáticamente porque los navegadores móviles
        // suelen bloquear la reproducción automática antes de una interacción.
    },

    click() {
        if (!this.soundEnabled) return;

        /*
            Generamos un sonido breve con Web Audio API.
            Esto evita necesitar un archivo externo para el prototipo.
        */
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.frequency.value = 650;
            gain.gain.value = 0.035;

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start();
            oscillator.stop(context.currentTime + 0.045);
        } catch (error) {
            console.warn("[AUDIO] No se pudo reproducir click:", error);
        }
    },

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        return this.musicEnabled;
    },

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }
};

AudioEngine.init();
