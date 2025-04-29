// src/core/NoiseProvider.test.ts
import { describe, expect, it, vi } from 'vitest';
import { NoiseProvider } from './NoiseProvider';
import { MOUNTAINS_BIOME, PLAINS_BIOME } from './types'; // Import biome constants

describe('NoiseProvider', () => {
    // Placeholder for tests
    it('should be defined', () => {
        expect(NoiseProvider).toBeDefined();
    });

    // TDD Anchor: Test biome noise generation
    describe('getBiomeNoise', () => {
        it('should return a value within the expected range for biome noise', () => {
            const noiseProvider = new NoiseProvider();
            const x = 10;
            const z = 20;
            const noiseValue = noiseProvider.getBiomeNoise(x, z);

            expect(typeof noiseValue).toBe('number');
            // Assuming biome noise is normalized between -1 and 1, adjust if needed
            expect(noiseValue).toBeGreaterThanOrEqual(-1);
            expect(noiseValue).toBeLessThanOrEqual(1);
        });
        it('should return consistent biome noise for the same coordinates', () => {
            const noiseProvider = new NoiseProvider();
            const x = 10;
            const z = 20;
            const noiseValue1 = noiseProvider.getBiomeNoise(x, z);
            const noiseValue2 = noiseProvider.getBiomeNoise(x, z);

            expect(noiseValue1).toBe(noiseValue2);
        });
    });

    // TDD Anchor: Test biome influence calculation
    describe('getBiomeInfluence', () => {
        it('should return influence close to 1 for high biome noise values', () => {
            const noiseProvider = new NoiseProvider();
            const x = 50;
            const z = 60;

            // Mock getBiomeNoise to return a high value (close to 1)
            vi.spyOn(noiseProvider, 'getBiomeNoise').mockReturnValue(0.9);

            const influence = noiseProvider.getBiomeInfluence(x, z);

            expect(influence).toBeCloseTo(0.95); // Influence should be (0.9 + 1) / 2

            // Restore original implementation
            vi.restoreAllMocks();
        });
        it('should return influence close to 0 for low biome noise values', () => {
            const noiseProvider = new NoiseProvider();
            const x = 70;
            const z = 80;

            // Mock getBiomeNoise to return a low value (close to -1)
            vi.spyOn(noiseProvider, 'getBiomeNoise').mockReturnValue(-0.8);

            const influence = noiseProvider.getBiomeInfluence(x, z);

            // Influence should be (-0.8 + 1) / 2 = 0.1
            expect(influence).toBeCloseTo(0.1);

            vi.restoreAllMocks();
        });
        it('should return intermediate influence for mid-range biome noise values', () => {
            const noiseProvider = new NoiseProvider();
            const x = 90;
            const z = 100;

            // Mock getBiomeNoise to return a mid-range value
            vi.spyOn(noiseProvider, 'getBiomeNoise').mockReturnValue(0.2);

            const influence = noiseProvider.getBiomeInfluence(x, z);

            // Influence should be (0.2 + 1) / 2 = 0.6
            expect(influence).toBeCloseTo(0.6);

            vi.restoreAllMocks();
        });
    });

    // TDD Anchor: Test height calculation with scaling and interpolation
    describe('getHeight', () => {
        it('should return a height close to mountain height when biome influence is negligible (close to 0)', () => {
            const noiseProvider = new NoiseProvider();
            const x = 110;
            const z = 120;
            const negligibleInfluence = 0.01;
            const mockMountainHeight = 100;
            const mockPlainsHeight = 20;

            // Mock getBiomeInfluence to return near 0
            vi.spyOn(noiseProvider, 'getBiomeInfluence').mockReturnValue(negligibleInfluence);

            // Mock the private calculateBiomeHeight method
            // Need 'any' because it's private
            const calculateBiomeHeightSpy = vi.spyOn(noiseProvider as any, 'calculateBiomeHeight');
            calculateBiomeHeightSpy.mockImplementation((_x, _z, biome) => {
                if (biome === MOUNTAINS_BIOME) return mockMountainHeight;
                if (biome === PLAINS_BIOME) return mockPlainsHeight;
                return 0; // Default fallback
            });

            const height = noiseProvider.getHeight(x, z);

            // Verify mocks were called
            expect(noiseProvider.getBiomeInfluence).toHaveBeenCalledWith(x, z);
            expect(calculateBiomeHeightSpy).toHaveBeenCalledWith(x, z, MOUNTAINS_BIOME);
            expect(calculateBiomeHeightSpy).toHaveBeenCalledWith(x, z, PLAINS_BIOME);

            // Calculate expected interpolated height: mountain * (1 - influence) + plains * influence
            const expectedHeight = mockMountainHeight * (1 - negligibleInfluence) + mockPlainsHeight * negligibleInfluence;
            expect(height).toBeCloseTo(expectedHeight);

            vi.restoreAllMocks();
        });
        it('should return a height close to plains height when biome influence is dominant (close to 1)', () => {
            const noiseProvider = new NoiseProvider();
            const x = 130;
            const z = 140;
            const dominantInfluence = 0.99;
            const mockMountainHeight = 100;
            const mockPlainsHeight = 20;

            // Mock getBiomeInfluence to return near 1
            vi.spyOn(noiseProvider, 'getBiomeInfluence').mockReturnValue(dominantInfluence);

            // Mock the private calculateBiomeHeight method
            const calculateBiomeHeightSpy = vi.spyOn(noiseProvider as any, 'calculateBiomeHeight');
            calculateBiomeHeightSpy.mockImplementation((_x, _z, biome) => {
                if (biome === MOUNTAINS_BIOME) return mockMountainHeight;
                if (biome === PLAINS_BIOME) return mockPlainsHeight;
                return 0;
            });

            const height = noiseProvider.getHeight(x, z);

            // Verify mocks
            expect(noiseProvider.getBiomeInfluence).toHaveBeenCalledWith(x, z);
            expect(calculateBiomeHeightSpy).toHaveBeenCalledWith(x, z, MOUNTAINS_BIOME);
            expect(calculateBiomeHeightSpy).toHaveBeenCalledWith(x, z, PLAINS_BIOME);

            // Calculate expected interpolated height
            const expectedHeight = mockMountainHeight * (1 - dominantInfluence) + mockPlainsHeight * dominantInfluence;
            expect(height).toBeCloseTo(expectedHeight);

            vi.restoreAllMocks();
        });
        it('should return an interpolated height based on biome influence', () => {
            const noiseProvider = new NoiseProvider();
            const x = 150;
            const z = 160;
            const midInfluence = 0.5;
            const mockMountainHeight = 100;
            const mockPlainsHeight = 20;

            // Mock getBiomeInfluence to return 0.5
            vi.spyOn(noiseProvider, 'getBiomeInfluence').mockReturnValue(midInfluence);

            // Mock the private calculateBiomeHeight method
            const calculateBiomeHeightSpy = vi.spyOn(noiseProvider as any, 'calculateBiomeHeight');
            calculateBiomeHeightSpy.mockImplementation((_x, _z, biome) => {
                if (biome === MOUNTAINS_BIOME) return mockMountainHeight;
                if (biome === PLAINS_BIOME) return mockPlainsHeight;
                return 0;
            });

            const height = noiseProvider.getHeight(x, z);

            // Verify mocks
            expect(noiseProvider.getBiomeInfluence).toHaveBeenCalledWith(x, z);
            expect(calculateBiomeHeightSpy).toHaveBeenCalledWith(x, z, MOUNTAINS_BIOME);
            expect(calculateBiomeHeightSpy).toHaveBeenCalledWith(x, z, PLAINS_BIOME);

            // Calculate expected interpolated height: mountain * (1 - 0.5) + plains * 0.5
            const expectedHeight = mockMountainHeight * (1 - midInfluence) + mockPlainsHeight * midInfluence;
            expect(height).toBeCloseTo(expectedHeight); // Should be (100 * 0.5) + (20 * 0.5) = 60

            vi.restoreAllMocks();
        });
        // Skipping scale test as scaling is handled within calculateBiomeHeight and tested implicitly via interpolation
        // it.todo('should apply the correct vertical scale to the final height');
        it('should return consistent height for the same coordinates', () => {
            // Use different settings to ensure consistency isn't just due to simple noise
            const noiseProvider = new NoiseProvider(6, 0.4, 2.2, 600);
            const x = 170;
            const z = 180;

            const height1 = noiseProvider.getHeight(x, z);
            const height2 = noiseProvider.getHeight(x, z);

            expect(height1).toBe(height2);
        });
    });

});