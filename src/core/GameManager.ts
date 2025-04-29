import * as THREE from 'three';
import { AudioManager } from './AudioManager.js';
import { InputHandler } from './InputHandler.js';
import { PhysicsConfig, PhysicsEngine } from './PhysicsEngine.js'; // Import PhysicsConfig
import { PlayerController } from './PlayerController.js';
import { Renderer } from './Renderer.js';
import { TerrainManager } from './TerrainManager.js';
import { GameConfig, GameState } from './types.js'; // Import GameState
import { UIManager } from './UIManager.js';

export class GameManager {
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private playerController: PlayerController;
    private terrainManager: TerrainManager;
    private physicsEngine: PhysicsEngine;
    private uiManager: UIManager;
    private audioManager: AudioManager;
    private config: GameConfig;
    private lastTimestamp: number = 0;
    private isRunning: boolean = false;
    private currentState: GameState = GameState.Loading; // Add game state
    private isInitialized: boolean = false; // Track initialization

    constructor(config: GameConfig) {
        this.config = config;

        // Show loading screen immediately
        this.uiManager = new UIManager(); // Instantiate UIManager early
        this.uiManager.showLoadingScreen();

        // Initialize core modules first
        this.renderer = new Renderer();
        this.inputHandler = new InputHandler();
        // Define physics configuration
        // Define physics configuration using the defaults from PhysicsEngine or customize here
        const physicsConfig: PhysicsConfig = {
            gravity: new THREE.Vector3(0, -9.81, 0),
            wingArea: 10, // Default value
            airDensity: 1.225, // Default value
            liftSlope: 2 * Math.PI, // Default value
            maxCL: 1.2, // Default value
            baseDragCoefficient: 0.02, // Default value
            inducedDragFactor: 0.05, // Default value
        };
        this.physicsEngine = new PhysicsEngine(physicsConfig); // Pass config
        // Pass scene first, then physics engine
        this.terrainManager = new TerrainManager(this.renderer.getScene(), this.physicsEngine);
        // PlayerController manages its own camera, pass only input and physics
        this.playerController = new PlayerController(this.inputHandler, this.physicsEngine);
        // this.uiManager = new UIManager(); // Moved earlier
        this.audioManager = new AudioManager();

        // Defer starting the game loop until assets are loaded
        this.initializeGame(); // Call async initialization
    }

    /**
     * Asynchronously initializes the game, loads assets, and sets up modules.
     */
    private async initializeGame(): Promise<void> {
        console.log("Initializing game asynchronously...");
        try {
            // Setup modules that don't depend on loaded assets
            this.setupModules();
            // Load assets (including audio)
            await this.loadAssets();
            this.isInitialized = true;
            console.log("Game initialization complete.");
            // Transition to Main Menu only after everything is loaded
            this.transitionToState(GameState.MainMenu);
        } catch (error) {
            console.error("Error during game initialization:", error);
            this.uiManager.showErrorScreen("Failed to initialize game."); // Show error state
            this.transitionToState(GameState.Error); // Add an Error state if needed
        }
    }


    /**
     * Loads necessary game assets.
     */
    private async loadAssets(): Promise<void> {
        console.log("Loading assets...");
        // Initialize audio context and load sounds
        // Initialize needs user interaction, but loadSounds calls initialize if needed.
        // Best practice is to call initialize() on first user interaction (e.g., clicking start button)
        // For now, we attempt to load here. It might require a click later.
        await this.audioManager.loadSounds();
        // Add other asset loading here (models, textures, etc.)
        console.log("Assets loaded.");
    }

    /**
     * Sets up connections between modules and performs initial setup.
     */
    private setupModules(): void {
        // Add the player's visual object to the main scene
        this.renderer.getScene().add(this.playerController.getPlayerObject());
        console.log("Player object added to scene.");

        // Initialize the terrain (creates the first chunk)
        this.terrainManager.initialize();
        console.log("TerrainManager initialized.");

        // Note: Initial transition to MainMenu happens in constructor now
    }


    public start(): void {
        // Ensure initialization is complete before starting
        if (!this.isInitialized) {
            console.warn("Game not yet initialized. Cannot start.");
            return;
        }
        // Start should transition to Playing state if coming from Main Menu
        // For now, let's assume start is called implicitly or via UI
        if (this.currentState !== GameState.MainMenu && this.currentState !== GameState.Crashed) return; // Only start from menu or after crash

        this.resetGame(); // Reset player position etc.
        this.transitionToState(GameState.Playing); // This will now handle starting sounds

        // Start the game loop if not already running
        if (!this.isRunning) {
             this.isRunning = true;
             this.lastTimestamp = performance.now();
             console.log("Game loop started.");
             requestAnimationFrame(this.gameLoop.bind(this));
        }
    }

    public stop(): void {
        this.isRunning = false;
        console.log("Game loop stopped.");
    }

    private gameLoop(timestamp: number): void {
        if (!this.isRunning || !this.isInitialized) return; // Also check initialization

        const deltaTime = (timestamp - this.lastTimestamp) / 1000; // Delta time in seconds
        this.lastTimestamp = timestamp;

        // 1. Update Input Handler (reads hardware state)
        this.inputHandler.update();

        // 2. Handle Global Inputs (Pause)
        if (this.currentState === GameState.Playing && this.inputHandler.getPauseInput()) {
            this.togglePause();
        }

        // 3. Update Game Logic (only when playing)
        if (this.currentState === GameState.Playing) {
            // Physics update is handled within PlayerController
            this.playerController.update(deltaTime);
            this.terrainManager.update(this.playerController.getPosition());

            // Detect collisions
            this.physicsEngine.detectCollisions(
                this.playerController,
                this.terrainManager,
                () => this.transitionToState(GameState.Crashed) // Transition to Crashed state on collision
            );

            // Update audio based on game state
            this.audioManager.updateEngineSound(this.playerController.getThrottleLevel());
            // Optional: Add wind sound update based on speed
            // const normalizedSpeed = this.playerController.getNormalizedSpeed(); // Assuming this method exists
            // this.audioManager.updateWindSound(normalizedSpeed);
        }

        // 4. Update UI (HUD) - Runs in Playing and Paused states
        if (this.currentState === GameState.Playing || this.currentState === GameState.Paused) {
             this.uiManager.updateHUD(this.playerController.getHUDData());
        }
        // REMOVE this line: this.audioManager.update(deltaTime);

        // 5. Render the scene (always runs, even when paused)
        // Update the renderer's camera with the player's camera each frame
        this.renderer.setCamera(this.playerController.getCamera() as THREE.PerspectiveCamera);
        // Render the scene using the updated camera
        this.renderer.render();

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    // --- State Management ---

    public transitionToState(newState: GameState): void {
        if (this.currentState === newState || !this.isInitialized) return; // Don't transition if not initialized

        const oldState = this.currentState;
        console.log(`Transitioning from ${GameState[oldState]} to ${GameState[newState]}`);
        this.currentState = newState;

        // Define callbacks for UI buttons
        const callbacks = {
            startGame: () => this.start(),
            resumeGame: () => this.togglePause(),
            restartGame: () => this.start(), // Restart calls start, which resets and transitions
            backToMenu: () => this.transitionToState(GameState.MainMenu),
            // exitGame: () => { /* Implement exit logic if needed */ }
        };

        this.uiManager.updateUIState(this.currentState, callbacks);


        // --- Audio Handling based on State Transition ---
        // Stop sounds from previous state (if applicable)
        if (oldState === GameState.Playing) {
            // Pausing handles its own sounds
        } else if (oldState === GameState.Paused) {
             // Resuming handles its own sounds
        } else if (oldState === GameState.Crashed) {
            // Sounds are already stopped by playCrashSound
        } else if (oldState === GameState.MainMenu) {
             this.audioManager.stopAllSounds(); // Stop menu music if any
        }


        // Start/Stop sounds for the new state
        switch (newState) {
            case GameState.Playing:
                if (oldState === GameState.Paused) {
                    // Resuming from pause
                    this.audioManager.resumeEngineSound();
                    this.audioManager.resumeWindSound();
                } else {
                    // Starting fresh (from Menu, Crashed, etc.)
                    this.audioManager.startLoop('engine', 0.2); // Start at idle
                    this.audioManager.startLoop('wind', 0.1); // Start low
                }
                 if (!this.isRunning) { // Ensure game loop starts/resumes
                     this.isRunning = true;
                     this.lastTimestamp = performance.now();
                     requestAnimationFrame(this.gameLoop.bind(this));
                 }
                break;
            case GameState.Paused:
                this.audioManager.pauseEngineSound();
                this.audioManager.pauseWindSound();
                // Keep rendering loop running, but game logic stops within gameLoop
                break;
            case GameState.Crashed:
                this.audioManager.playCrashSound(); // Stops loops and plays crash
                // Game loop might stop or continue showing crash screen
                break;
            case GameState.MainMenu:
                 this.audioManager.stopAllSounds(); // Stop game sounds
                 // Potentially start menu music here
                break;
            case GameState.Loading:
            case GameState.Error:
                 this.audioManager.stopAllSounds();
                 // Stop game loop entirely? Or just logic updates?
                 // this.isRunning = false; // Decide if rendering stops too
                break;
        }
    }

    public togglePause(): void {
        if (!this.isInitialized) return; // Cannot pause if not initialized
        if (this.currentState === GameState.Playing) {
            this.transitionToState(GameState.Paused);
        } else if (this.currentState === GameState.Paused) {
            this.transitionToState(GameState.Playing);
        }
    }

    /**
     * Resets the game to a playable state, usually before starting/restarting.
     */
    public resetGame(): void {
        if (!this.isInitialized) return; // Cannot reset if not initialized
        console.log("Resetting game...");
        this.playerController.reset();
        this.terrainManager.reset();
        this.audioManager.stopAllSounds(); // Stop all sounds on reset
        // Potentially reset score, timers, etc. here
    }

    // Add methods for initialization, loading assets, etc. as needed
}