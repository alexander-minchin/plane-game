// Define common types and interfaces used across the game modules.

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface GameConfig {
    // Placeholder for game configuration settings
    debugMode: boolean;
    // Add other config options as needed
}

// Add other shared types and interfaces here
export enum GameState {
    Loading,
    MainMenu,
    Playing,
    Paused,
    Crashed,
    Error, // Added for initialization/loading failures
}