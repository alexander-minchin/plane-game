import { makeNoise2D } from 'fast-simplex-noise';
import {
    BiomeParameters,
    MOUNTAINS_BIOME,
    PLAINS_BIOME
} from './types'; // Import biome types and constants

/**
 * Provides noise generation capabilities, abstracting the specific library used.
 * Generates multi-octave simplex noise for terrain height, incorporating biomes.
 */
export class NoiseProvider {
    private terrainNoise2D: (x: number, y: number) => number;
    private biomeNoise2D: (x: number, y: number) => number; // Noise for biome distribution
    private octaves: number;
    private persistence: number;
    private lacunarity: number;
    // Removed scale and amplitudeMultiplier, now handled by biomes
    private biomeScale: number; // Scale for the biome distribution noise

    constructor(
        octaves: number = 4,
        persistence: number = 0.5,
        lacunarity: number = 2.0,
        biomeScale: number = 500.0 // Controls the size of biome regions
        // Removed scale and amplitudeMultiplier from constructor
    ) {
        // Use different seeds or instances if possible, though makeNoise2D doesn't support seeding directly
        this.terrainNoise2D = makeNoise2D();
        this.biomeNoise2D = makeNoise2D(); // Separate noise instance for biomes
        this.octaves = octaves;
        this.persistence = persistence;
        this.lacunarity = lacunarity;
        this.biomeScale = biomeScale;

        console.log("NoiseProvider initialized with biome support.");
    }

/**
     * Generates a raw biome noise value for the given world coordinates.
     * Used to determine biome distribution.
     * @param worldX World x-coordinate.
     * @param worldZ World z-coordinate.
     * @returns A noise value, typically between -1 and 1.
     */
    public getBiomeNoise(worldX: number, worldZ: number): number {
        return this.biomeNoise2D(worldX / this.biomeScale, worldZ / this.biomeScale);
    }
    /**
     * Calculates the influence of the Plains biome at a given world coordinate.
     * @param worldX World x-coordinate.
     * @param worldZ World z-coordinate.
     * @returns A value between 0 (fully Mountains) and 1 (fully Plains).
     */
    public getBiomeInfluence(worldX: number, worldZ: number): number {
        const biomeNoiseVal = this.getBiomeNoise(worldX, worldZ); // Use the public method
        // Map noise from [-1, 1] to [0, 1]
        // Add a slight bias towards mountains maybe? Or keep it simple 0-1 for now.
        return (biomeNoiseVal + 1) / 2;
    }

    /**
     * Generates a terrain height value for the given world coordinates,
     * interpolating between biomes based on biome noise.
     * @param worldX The world x-coordinate.
     * @param worldZ The world z-coordinate (used as y in the 2D noise function).
     * @returns The calculated height value.
     */
    public getHeight(worldX: number, worldZ: number): number {
        const biomeInfluence = this.getBiomeInfluence(worldX, worldZ); // 0 = Mountains, 1 = Plains

        // Calculate height contribution for each biome
        const mountainHeight = this.calculateBiomeHeight(worldX, worldZ, MOUNTAINS_BIOME);
        const plainsHeight = this.calculateBiomeHeight(worldX, worldZ, PLAINS_BIOME);

        // Interpolate between the two biome heights
        const finalHeight = mountainHeight * (1 - biomeInfluence) + plainsHeight * biomeInfluence;

        return finalHeight;
    }

    /**
     * Helper function to calculate the noise height for a specific biome's parameters.
     * @param worldX World x-coordinate.
     * @param worldZ World z-coordinate.
     * @param biome The biome parameters to use.
     * @returns The calculated height for that biome at the given coordinates.
     */
    private calculateBiomeHeight(worldX: number, worldZ: number, biome: BiomeParameters): number {
        let total = 0;
        let frequency = biome.frequency; // Use biome's base frequency
        let amplitude = 1; // Start amplitude at 1 for normalization calculation
        let maxValue = 0; // Used for normalizing result to [-1, 1] before applying biome amplitude

        for(let i = 0; i < this.octaves; i++) {
            // Use biome frequency directly (scale is incorporated into frequency)
            const sampleX = worldX * frequency;
            const sampleZ = worldZ * frequency;

            total += this.terrainNoise2D(sampleX, sampleZ) * amplitude;

            maxValue += amplitude;
            amplitude *= this.persistence;
            frequency *= this.lacunarity; // Lacunarity affects frequency across octaves
        }

        // Normalize the total noise value to be between -1 and 1
        const normalizedHeight = maxValue === 0 ? 0 : total / maxValue;

        // Apply the biome's specific amplitude multiplier
        return normalizedHeight * biome.amplitude;
    }


    /**
     * Generates a raw 2D noise value for the given coordinates (less common use).
     * @param x The x-coordinate.
     * @param y The y-coordinate.
     * @returns A noise value, typically between -1 and 1.
     */
    public getRawNoise(x: number, y: number): number {
        // Which noise to return? Terrain noise seems more relevant usually.
        return this.terrainNoise2D(x, y);
    }
}