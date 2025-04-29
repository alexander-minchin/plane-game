import { makeNoise2D } from 'fast-simplex-noise';

/**
 * Provides noise generation capabilities, abstracting the specific library used.
 * Generates multi-octave simplex noise for terrain height.
 */
export class NoiseProvider {
    private noise2D: (x: number, y: number) => number;
    private octaves: number;
    private persistence: number;
    private lacunarity: number;
    private scale: number;
    private amplitudeMultiplier: number; // Added to control overall height

    constructor(
        octaves: number = 4,
        persistence: number = 0.5,
        lacunarity: number = 2.0,
        scale: number = 100.0, // Controls the overall feature size
        amplitudeMultiplier: number = 50.0 // Controls the max height variation
    ) {
        this.noise2D = makeNoise2D(); // Use default seeding
        this.octaves = octaves;
        this.persistence = persistence;
        this.lacunarity = lacunarity;
        this.scale = scale;
        this.amplitudeMultiplier = amplitudeMultiplier;

        console.log("NoiseProvider initialized.");
    }

    /**
     * Generates a terrain height value for the given world coordinates using layered noise.
     * @param worldX The world x-coordinate.
     * @param worldZ The world z-coordinate (used as y in the 2D noise function).
     * @returns The calculated height value.
     */
    public getHeight(worldX: number, worldZ: number): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0; // Used for normalizing result to [-1, 1] before applying multiplier

        for(let i = 0; i < this.octaves; i++) {
            // Apply scale here to control the overall size of noise features
            const sampleX = worldX / this.scale * frequency;
            const sampleZ = worldZ / this.scale * frequency;

            total += this.noise2D(sampleX, sampleZ) * amplitude;

            maxValue += amplitude;
            amplitude *= this.persistence;
            frequency *= this.lacunarity;
        }

        // Normalize the total noise value to be between -1 and 1
        const normalizedHeight = maxValue === 0 ? 0 : total / maxValue;

        // Apply the amplitude multiplier to control the final height range
        return normalizedHeight * this.amplitudeMultiplier;
    }

    /**
     * Generates a raw 2D noise value for the given coordinates (less common use).
     * @param x The x-coordinate.
     * @param y The y-coordinate.
     * @returns A noise value, typically between -1 and 1.
     */
    public getRawNoise(x: number, y: number): number {
        return this.noise2D(x, y);
    }
}