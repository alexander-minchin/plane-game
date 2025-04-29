// src/core/AudioManager.ts

/**
 * Manages audio playback using the Web Audio API.
 */
export class AudioManager {
    private audioContext: AudioContext | null = null;
    private soundBuffers: Map<string, AudioBuffer> = new Map();
    private effectSources: Map<string, AudioBufferSourceNode> = new Map();
    private loopSources: Map<string, { source: AudioBufferSourceNode; gainNode: GainNode }> = new Map();

    // Placeholder paths - replace with actual paths to your audio assets
    private soundPaths: { [key: string]: string } = {
        engine: '/assets/sounds/engine_loop.wav', // Placeholder
        wind: '/assets/sounds/wind_loop.wav',     // Placeholder
        crash: '/assets/sounds/crash.wav',       // Placeholder
        // Add more sound effects as needed
        // effect1: '/assets/sounds/effect1.wav',
    };

    /**
     * Initializes the AudioContext. Must be called after a user interaction.
     */
    public initialize(): boolean {
        if (this.audioContext) {
            return true; // Already initialized
        }
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            console.log('AudioContext initialized.');
            // Unlock audio context on iOS/some browsers
            this.unlockAudioContext();
            return true;
        } catch (e) {
            console.error('Web Audio API is not supported in this browser.', e);
            return false;
        }
    }

    private unlockAudioContext() {
        if (!this.audioContext || this.audioContext.state !== 'suspended') return;
        const unlock = () => {
            this.audioContext?.resume().then(() => {
                document.body.removeEventListener('touchstart', unlock);
                document.body.removeEventListener('touchend', unlock);
                document.body.removeEventListener('click', unlock);
                console.log('AudioContext resumed.');
            });
        };
        document.body.addEventListener('touchstart', unlock, false);
        document.body.addEventListener('touchend', unlock, false);
        document.body.addEventListener('click', unlock, false);
    }

    /**
     * Loads a single sound file.
     * @param name - The name to assign to the sound.
     * @param path - The path to the audio file.
     */
    public async loadSound(name: string, path: string): Promise<void> {
        if (!this.audioContext) {
            console.error('AudioContext not initialized. Call initialize() first.');
            return;
        }
        if (this.soundBuffers.has(name)) {
            // console.log(`Sound "${name}" already loaded.`);
            return;
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${path}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.soundBuffers.set(name, audioBuffer);
            // console.log(`Sound "${name}" loaded successfully from ${path}`);
        } catch (error) {
            console.error(`Error loading sound "${name}" from ${path}:`, error);
        }
    }

    /**
     * Loads all sounds defined in soundPaths.
     */
    public async loadSounds(): Promise<void> {
        if (!this.initialize()) {
            console.error("Failed to initialize AudioContext. Cannot load sounds.");
            return;
        }
        console.log('Loading sounds...');
        const loadPromises: Promise<void>[] = [];
        for (const name in this.soundPaths) {
            loadPromises.push(this.loadSound(name, this.soundPaths[name]));
        }
        await Promise.all(loadPromises);
        console.log('All sounds loaded (or attempted).');
    }

    /**
     * Plays a sound effect once.
     * @param name - The name of the sound to play.
     */
    public playEffect(name: string): void {
        if (!this.audioContext || !this.soundBuffers.has(name)) {
            console.warn(`Cannot play effect "${name}". AudioContext not ready or sound not loaded.`);
            return;
        }

        // Stop previous instance if it's still playing
        this.effectSources.get(name)?.stop();

        const source = this.audioContext.createBufferSource();
        source.buffer = this.soundBuffers.get(name)!;
        source.connect(this.audioContext.destination);
        source.start(0);

        // Keep track of the source to potentially stop it later if needed
        this.effectSources.set(name, source);
        source.onended = () => {
            this.effectSources.delete(name);
        };
    }

    /**
     * Starts playing a sound in a loop.
     * @param name - The name of the sound to loop.
     * @param initialGain - The initial volume (0.0 to 1.0). Defaults to 1.0.
     */
    public startLoop(name: string, initialGain: number = 1.0): void {
        if (!this.audioContext || !this.soundBuffers.has(name)) {
            console.warn(`Cannot start loop "${name}". AudioContext not ready or sound not loaded.`);
            return;
        }
        if (this.loopSources.has(name)) {
            // console.log(`Loop "${name}" is already playing.`);
            // Ensure gain is set correctly if restarting
             const existing = this.loopSources.get(name);
             if (existing) {
                existing.gainNode.gain.setValueAtTime(initialGain, this.audioContext.currentTime);
             }
            return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = this.soundBuffers.get(name)!;
        source.loop = true;
        gainNode.gain.setValueAtTime(initialGain, this.audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);

        this.loopSources.set(name, { source, gainNode });
        // console.log(`Loop "${name}" started.`);
    }

    /**
     * Stops a looping sound.
     * @param name - The name of the loop to stop.
     */
    public stopLoop(name: string): void {
        if (!this.audioContext) return;
        const loopData = this.loopSources.get(name);
        if (loopData) {
            try {
                loopData.source.stop(0);
                loopData.source.disconnect();
                loopData.gainNode.disconnect();
            } catch (e) {
                 // Ignore errors if source already stopped
                 // console.warn(`Error stopping loop "${name}":`, e);
            } finally {
                 this.loopSources.delete(name);
                 // console.log(`Loop "${name}" stopped.`);
            }
        }
    }

    /**
     * Updates the gain (volume) of a specific looping sound.
     * @param name - The name of the looping sound.
     * @param gain - The new gain value (0.0 to 1.0).
     */
    private updateLoopGain(name: string, gain: number): void {
        if (!this.audioContext) return;
        const loopData = this.loopSources.get(name);
        if (loopData) {
            // Use exponential ramp for smoother volume changes
            loopData.gainNode.gain.exponentialRampToValueAtTime(
                Math.max(0.0001, gain), // Avoid 0 for exponential ramp
                this.audioContext.currentTime + 0.1 // Ramp over 0.1 seconds
            );
        }
    }

    /**
     * Updates the engine sound volume based on the throttle level.
     * @param throttleLevel - Throttle level (0.0 to 1.0).
     */
    public updateEngineSound(throttleLevel: number): void {
        // Example mapping: Adjust gain based on throttle.
        // You might want a more sophisticated mapping (e.g., non-linear, pitch shift)
        const minGain = 0.2; // Engine idle volume
        const maxGain = 1.0;
        const gain = minGain + (maxGain - minGain) * throttleLevel;
        this.updateLoopGain('engine', gain);

        // Optional: Adjust pitch slightly based on throttle for more realism
        // const basePlaybackRate = 1.0;
        // const maxPlaybackRate = 1.5;
        // const playbackRate = basePlaybackRate + (maxPlaybackRate - basePlaybackRate) * throttleLevel;
        // const engineLoop = this.loopSources.get('engine');
        // if (engineLoop && this.audioContext) {
        //     engineLoop.source.playbackRate.exponentialRampToValueAtTime(
        //         playbackRate,
        //         this.audioContext.currentTime + 0.1
        //     );
        // }
    }

     /**
     * Updates the wind sound volume based on the aircraft speed.
     * @param speed - Current speed value. Needs normalization (e.g., 0.0 to 1.0).
     */
    public updateWindSound(normalizedSpeed: number): void {
        const minGain = 0.1;
        const maxGain = 0.8;
        const gain = minGain + (maxGain - minGain) * Math.min(1, Math.max(0, normalizedSpeed)); // Clamp speed
        this.updateLoopGain('wind', gain);
    }


    /**
     * Plays the crash sound effect.
     */
    public playCrashSound(): void {
        this.stopLoop('engine'); // Stop engine on crash
        this.stopLoop('wind');   // Stop wind on crash
        this.playEffect('crash');
    }

    /**
     * Stops all currently playing sounds (loops and effects).
     */
    public stopAllSounds(): void {
        if (!this.audioContext) return;

        // Stop all loops
        this.loopSources.forEach((loopData, name) => {
            try {
                loopData.source.stop(0);
                loopData.source.disconnect();
                loopData.gainNode.disconnect();
            } catch (e) {
                // Ignore errors if source already stopped
            }
            // console.log(`Loop "${name}" stopped.`);
        });
        this.loopSources.clear();

        // Stop all effects (though they usually stop on their own)
        this.effectSources.forEach((source, name) => {
             try {
                source.stop(0);
                source.disconnect();
            } catch (e) {
                 // Ignore errors if source already stopped
            }
            // console.log(`Effect "${name}" stopped.`);
        });
        this.effectSources.clear();

        console.log('All sounds stopped.');
    }

    /**
     * Pauses the engine sound loop (by setting gain to 0).
     * Useful for pause menus without fully stopping the loop.
     */
    public pauseEngineSound(): void {
         if (!this.audioContext) return;
         const loopData = this.loopSources.get('engine');
         if (loopData) {
             // Store current gain before pausing? Or just set to 0? Setting to 0 for simplicity.
             loopData.gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime); // Use small value instead of 0
         }
    }

    /**
     * Resumes the engine sound loop (restores gain based on current throttle).
     * Needs access to the current throttle level, or assumes a default.
     * Let's assume updateEngineSound will be called shortly after resuming.
     */
    public resumeEngineSound(): void {
        // The gain will be updated by the next call to updateEngineSound in the game loop.
        // If the loop was fully stopped instead of paused, we need to restart it.
        if (!this.loopSources.has('engine')) {
            this.startLoop('engine', 0.2); // Start at idle volume
        }
        // If it was just paused (gain set to 0), the next updateEngineSound call will fix it.
    }

     /**
     * Pauses the wind sound loop.
     */
    public pauseWindSound(): void {
         if (!this.audioContext) return;
         const loopData = this.loopSources.get('wind');
         if (loopData) {
             loopData.gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
         }
    }

    /**
     * Resumes the wind sound loop.
     */
    public resumeWindSound(): void {
        if (!this.loopSources.has('wind')) {
            this.startLoop('wind', 0.1); // Start at low volume
        }
        // Gain will be updated by updateWindSound
    }
}