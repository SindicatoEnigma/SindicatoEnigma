
/*
    AUDIO.JS
    --------
    Sistema centralizado de audio.

    Permite:
    - Reproducir música MP3 y OGG.
    - Cambiar de canción con transición gradual.
    - Detener y pausar música.
    - Reanudar música.
    - Ajustar volumen.
    - Activar y desactivar música y efectos.
*/

const AudioEngine = {

    musicEnabled: true,
    soundEnabled: true,

    //music: null,
    //currentTrack: null,
    music: null,
currentTrack: null,

// Contexto compartido para todos los efectos.
audioContext: null,

    musicVolume: 0.45,

    _fadeTimer: null,
    _fadeResolve: null,

    // --------------------------------------------------------
    // INICIALIZAR
    // --------------------------------------------------------

    init() {

        if (this.music) return;

        this.music = new Audio();

        this.music.loop = true;
        this.music.preload = "auto";
        this.music.volume = this.musicVolume;
    },

    // --------------------------------------------------------
    // TRANSICIÓN DE VOLUMEN
    // --------------------------------------------------------

    fadeTo(volumenDestino, duracion = 500) {

        this.init();

        // Cancelamos una transición anterior.
        if (this._fadeTimer) {
            clearInterval(this._fadeTimer);
            this._fadeTimer = null;
        }

        if (this._fadeResolve) {
            this._fadeResolve();
            this._fadeResolve = null;
        }

        const volumenInicial = this.music.volume;

        const pasos = Math.max(1, Math.ceil(duracion / 30));

        let paso = 0;

        return new Promise(resolve => {

            this._fadeResolve = resolve;

            this._fadeTimer = setInterval(() => {

                paso++;

                const progreso = Math.min(paso / pasos, 1);

                this.music.volume =
                    volumenInicial +
                    (volumenDestino - volumenInicial) * progreso;

                if (paso >= pasos) {

                    clearInterval(this._fadeTimer);

                    this._fadeTimer = null;
                    this._fadeResolve = null;

                    resolve();
                }

            }, 30);

        });
    },

    // --------------------------------------------------------
    // REPRODUCIR CANCIÓN
    // --------------------------------------------------------

    async playTrack(ruta) {

        this.init();

        if (!this.musicEnabled) return;

        // Si ya está sonando esa misma canción, no la reiniciamos.
        if (
            this.currentTrack === ruta &&
            !this.music.paused
        ) {
            return;
        }

        // Bajamos el volumen de la canción anterior.
        if (!this.music.paused && this.currentTrack) {

            await this.fadeTo(0, 400);

            this.music.pause();
        }

        this.music.src = ruta;

        this.currentTrack = ruta;

        this.music.currentTime = 0;
        this.music.volume = 0;

        try {

            await this.music.play();

            // Aumentamos gradualmente el volumen.
            await this.fadeTo(this.musicVolume, 600);

            console.log("[AUDIO] Reproduciendo:", ruta);

        } catch (error) {

            console.warn(
                "[AUDIO] El navegador no permitió reproducir la música:",
                error
            );

        }
    },

    // --------------------------------------------------------
    // PAUSAR
    // --------------------------------------------------------

    pauseMusic() {

        if (!this.music) return;

        this.music.pause();
    },

    // --------------------------------------------------------
    // REANUDAR
    // --------------------------------------------------------

    resumeMusic() {

        if (
            !this.music ||
            !this.musicEnabled ||
            !this.currentTrack
        ) {
            return;
        }

        this.music.play().catch(error => {

            console.warn(
                "[AUDIO] No se pudo reanudar la música:",
                error
            );

        });
    },

    // --------------------------------------------------------
    // DETENER
    // --------------------------------------------------------

    async stopMusic() {

        if (!this.music) return;

        await this.fadeTo(0, 400);

        this.music.pause();
        this.music.currentTime = 0;

        this.currentTrack = null;
    },

    // --------------------------------------------------------
    // VOLUMEN
    // --------------------------------------------------------

    setVolume(porcentaje) {

        const valor = Math.max(
            0,
            Math.min(100, Number(porcentaje))
        );

        this.musicVolume = valor / 100;

        if (this.music && !this._fadeTimer) {
            this.music.volume = this.musicVolume;
        }
    },

    // --------------------------------------------------------
    // ACTIVAR / DESACTIVAR MÚSICA
    // --------------------------------------------------------

    toggleMusic() {

        this.musicEnabled = !this.musicEnabled;

        if (this.musicEnabled) {

            this.resumeMusic();

        } else {

            this.pauseMusic();
        }

        return this.musicEnabled;
    },

    // --------------------------------------------------------
    // EFECTOS DE SONIDO
    // --------------------------------------------------------
    // --------------------------------------------------------
// CONTEXTO DE AUDIO COMPARTIDO
// --------------------------------------------------------

getAudioContext() {

    if (!this.audioContext) {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {
            console.warn("[AUDIO] AudioContext no disponible.");
            return null;
        }

        this.audioContext = new AudioContextClass();
    }

    return this.audioContext;
},

// --------------------------------------------------------
// REPRODUCIR EFECTO SONORO
// --------------------------------------------------------

playTone(frecuencia, duracion, volumen) {

    if (!this.soundEnabled) return;

    const context = this.getAudioContext();

    if (!context) return;

    const reproducir = () => {

        const oscillator = context.createOscillator();
        const gain = context.createGain();

        const ahora = context.currentTime;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
            frecuencia,
            ahora
        );

        gain.gain.setValueAtTime(0, ahora);

        gain.gain.linearRampToValueAtTime(
            volumen,
            ahora + 0.003
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            ahora + duracion
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(ahora);
        oscillator.stop(ahora + duracion + 0.005);
    };

    if (context.state === "suspended") {

        context.resume().then(reproducir).catch(error => {
            console.warn("[AUDIO] No se pudo activar el sonido:", error);
        });

    } else {

        reproducir();
    }
},
    toggleSound() {

        this.soundEnabled = !this.soundEnabled;

        return this.soundEnabled;
    },

    // --------------------------------------------------------
    // CLICK
    // --------------------------------------------------------

    // --------------------------------------------------------
// SONIDO DE CLIC
// --------------------------------------------------------

click() {

    this.playTone(650, 0.045, 0.035);
},

// --------------------------------------------------------
// SONIDO DE ESCRITURA
// --------------------------------------------------------

type() {

    this.playTone(900, 0.018, 0.008);
};

AudioEngine.init();
