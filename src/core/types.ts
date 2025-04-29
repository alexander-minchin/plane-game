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
// Terrain Enhancement Constants
export const HORIZONTAL_SCALE_FACTOR = 4;
export const VERTICAL_AMPLITUDE_FACTOR = 2;

// Biome Parameters Interface
export interface BiomeParameters {
  amplitude: number;
  frequency: number;
  color1: { r: number; g: number; b: number }; // Base color
  color2: { r: number; g: number; b: number }; // Detail/Highlight color
}

// Biome Definitions
export const MOUNTAINS_BIOME: BiomeParameters = {
  amplitude: 150 * VERTICAL_AMPLITUDE_FACTOR, // Higher amplitude for mountains
  frequency: 0.002 / HORIZONTAL_SCALE_FACTOR, // Lower frequency for larger features
  color1: { r: 0.8, g: 0.8, b: 0.85 }, // Greyish base
  color2: { r: 1.0, g: 1.0, b: 1.0 }, // White peaks
};

export const PLAINS_BIOME: BiomeParameters = {
  amplitude: 30 * VERTICAL_AMPLITUDE_FACTOR, // Lower amplitude for plains
  frequency: 0.01 / HORIZONTAL_SCALE_FACTOR, // Higher frequency for smaller details
  color1: { r: 0.2, g: 0.6, b: 0.1 }, // Green base
  color2: { r: 0.4, g: 0.3, b: 0.1 }, // Brownish details
};