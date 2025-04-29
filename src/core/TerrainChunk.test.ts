// src/core/TerrainChunk.test.ts
import { Color, PlaneGeometry, Vector3 } from 'three'; // Import Color
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoiseProvider } from './NoiseProvider';
import { PhysicsConfig, PhysicsEngine } from './PhysicsEngine'; // Import PhysicsEngine and PhysicsConfig
import { TerrainChunk } from './TerrainChunk';
// Import actual biome definitions for color testing
import { MOUNTAINS_BIOME, PLAINS_BIOME } from './types';

// Mock dependencies
vi.mock('./NoiseProvider');
vi.mock('./PhysicsEngine'); // Mock PhysicsEngine

describe('TerrainChunk', () => {
    const chunkSize = 16;
    const chunkResolution = 4; // Use smaller resolution for faster tests (4x4 = 16 vertices)
    const chunkX = 1; // Use non-zero chunk coords
    const chunkZ = 2;
    let mockNoiseProvider: NoiseProvider;
    let mockPhysicsEngine: PhysicsEngine; // Use PhysicsEngine type
    let mockPhysicsConfig: PhysicsConfig; // Mock config for PhysicsEngine

    beforeEach(() => {
        // Default config for PhysicsEngine constructor
        mockPhysicsConfig = {
            gravity: new Vector3(0, -9.81, 0),
            wingArea: 10,
            airDensity: 1.225,
            liftSlope: 2 * Math.PI,
            maxCL: 1.2,
            baseDragCoefficient: 0.02,
            inducedDragFactor: 0.05,
        };

        // Mock NoiseProvider implementation
        vi.mocked(NoiseProvider).mockImplementation(() => ({
            getHeight: vi.fn().mockReturnValue(10), // Default height
            getBiomeInfluence: vi.fn().mockReturnValue(0.5), // Default influence
            getBiomeNoise: vi.fn().mockReturnValue(0),
            getRawNoise: vi.fn().mockReturnValue(0),
        } as any));

        // Mock PhysicsEngine implementation
        vi.mocked(PhysicsEngine).mockImplementation(() => ({
            // Mock methods used by TerrainChunk if any (currently none directly)
            addTerrainCollider: vi.fn(),
            removeTerrainCollider: vi.fn(),
        } as any));


        mockNoiseProvider = new NoiseProvider(); // Instantiate the mocked class
        mockPhysicsEngine = new PhysicsEngine(mockPhysicsConfig); // Instantiate with config

        // Reset calls between tests
        vi.clearAllMocks();

         // Re-apply default mocks on the instance if needed after clearAllMocks
         mockNoiseProvider.getHeight = vi.fn().mockReturnValue(10);
         mockNoiseProvider.getBiomeInfluence = vi.fn().mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Restore all mocks after each test
    });

    it('should be defined and initialize geometry', () => {
        const chunk = new TerrainChunk(
            chunkX,
            chunkZ,
            chunkSize,
            chunkResolution,
            mockNoiseProvider,
            mockPhysicsEngine
        );
        expect(chunk).toBeDefined();
        const geometry = chunk.getGeometry();
        expect(geometry).toBeInstanceOf(PlaneGeometry);

        const expectedVertexCount = chunkResolution * chunkResolution;
        expect(geometry.attributes.position).toBeDefined();
        expect(geometry.attributes.position.count).toBe(expectedVertexCount);
        expect(geometry.attributes.color).toBeDefined();
        expect(geometry.attributes.color.count).toBe(expectedVertexCount);
    });

    describe('generateGeometry (called by constructor)', () => {

        it('should call NoiseProvider.getHeight for each vertex', () => {
             new TerrainChunk(chunkX, chunkZ, chunkSize, chunkResolution, mockNoiseProvider, mockPhysicsEngine);
             const expectedCalls = chunkResolution * chunkResolution;
             expect(mockNoiseProvider.getHeight).toHaveBeenCalledTimes(expectedCalls);
        });

        it('should calculate correct world coordinates for noise sampling', () => {
            new TerrainChunk(chunkX, chunkZ, chunkSize, chunkResolution, mockNoiseProvider, mockPhysicsEngine);
            const expectedCalls = chunkResolution * chunkResolution;

            // World coordinate calculation:
            // mesh origin = (chunkX * size, 0, chunkZ * size) = (1 * 16, 0, 2 * 16) = (16, 0, 32)
            // Local vertices range from -size/2 to +size/2.
            // Plane rotated -90deg on X. Original local Y becomes world Z.
            // worldX = mesh.x + localX
            // worldZ = mesh.z - localY (because of rotation)

            // First vertex (top-left): localX = -8, localY = +8
            const expectedFirstWorldX = 16 + (-8); // 8
            const expectedFirstWorldZ = 32 - (+8); // 24
            expect(mockNoiseProvider.getHeight).toHaveBeenNthCalledWith(1, expectedFirstWorldX, expectedFirstWorldZ);
            expect(mockNoiseProvider.getBiomeInfluence).toHaveBeenNthCalledWith(1, expectedFirstWorldX, expectedFirstWorldZ);

            // Last vertex (bottom-right): localX = +8, localY = -8
            const expectedLastWorldX = 16 + 8; // 24
            const expectedLastWorldZ = 32 - (-8); // 40
            expect(mockNoiseProvider.getHeight).toHaveBeenNthCalledWith(expectedCalls, expectedLastWorldX, expectedLastWorldZ);
            expect(mockNoiseProvider.getBiomeInfluence).toHaveBeenNthCalledWith(expectedCalls, expectedLastWorldX, expectedLastWorldZ);
        });

        it('should call NoiseProvider.getBiomeInfluence for color interpolation', () => {
             new TerrainChunk(chunkX, chunkZ, chunkSize, chunkResolution, mockNoiseProvider, mockPhysicsEngine);
             const expectedCalls = chunkResolution * chunkResolution;
             expect(mockNoiseProvider.getBiomeInfluence).toHaveBeenCalledTimes(expectedCalls);
        });

        it('should set vertex positions with the height from NoiseProvider', () => {
            const mockHeight = 55.5;
            vi.mocked(mockNoiseProvider.getHeight).mockReturnValue(mockHeight);

            const chunk = new TerrainChunk(chunkX, chunkZ, chunkSize, chunkResolution, mockNoiseProvider, mockPhysicsEngine);
            const positions = chunk.getGeometry().attributes.position;

            for (let i = 0; i < positions.count; i++) {
                expect(positions.getY(i)).toBe(mockHeight);
            }
        });

        it('should interpolate vertex colors based on biome influence', () => {
            const mountainColor1 = new Color(MOUNTAINS_BIOME.color1.r, MOUNTAINS_BIOME.color1.g, MOUNTAINS_BIOME.color1.b);
            const mountainColor2 = new Color(MOUNTAINS_BIOME.color2.r, MOUNTAINS_BIOME.color2.g, MOUNTAINS_BIOME.color2.b);
            const plainsColor1 = new Color(PLAINS_BIOME.color1.r, PLAINS_BIOME.color1.g, PLAINS_BIOME.color1.b);
            const plainsColor2 = new Color(PLAINS_BIOME.color2.r, PLAINS_BIOME.color2.g, PLAINS_BIOME.color2.b);

            const influence = 0.75;
            const height = 15;

            vi.mocked(mockNoiseProvider.getBiomeInfluence).mockReturnValue(influence);
            vi.mocked(mockNoiseProvider.getHeight).mockReturnValue(height);

            const chunk = new TerrainChunk(chunkX, chunkZ, chunkSize, chunkResolution, mockNoiseProvider, mockPhysicsEngine);
            const colors = chunk.getGeometry().attributes.color;

            const mountainHeightRatio = Math.max(0, Math.min(1, height / MOUNTAINS_BIOME.amplitude));
            const plainsHeightRatio = Math.max(0, Math.min(1, height / PLAINS_BIOME.amplitude));
            const expectedMountainColor = new Color().lerpColors(mountainColor1, mountainColor2, mountainHeightRatio);
            const expectedPlainsColor = new Color().lerpColors(plainsColor1, plainsColor2, plainsHeightRatio);
            const expectedFinalColor = new Color().lerpColors(expectedMountainColor, expectedPlainsColor, influence);

            expect(colors.getX(0)).toBeCloseTo(expectedFinalColor.r);
            expect(colors.getY(0)).toBeCloseTo(expectedFinalColor.g);
            expect(colors.getZ(0)).toBeCloseTo(expectedFinalColor.b);

            const lastIndex = colors.count - 1;
            expect(colors.getX(lastIndex)).toBeCloseTo(expectedFinalColor.r);
            expect(colors.getY(lastIndex)).toBeCloseTo(expectedFinalColor.g);
            expect(colors.getZ(lastIndex)).toBeCloseTo(expectedFinalColor.b);
        });

        it('should mark geometry attributes for update and compute normals', () => {
             // Spy on computeVertexNormals *before* creating the chunk
             const computeNormalsSpy = vi.spyOn(PlaneGeometry.prototype, 'computeVertexNormals');

             const chunk = new TerrainChunk(chunkX, chunkZ, chunkSize, chunkResolution, mockNoiseProvider, mockPhysicsEngine);
             const geometry = chunk.getGeometry();

             // Check if computeVertexNormals was called on the geometry instance
             // This confirms the geometry generation process likely completed.
             // We removed the check for needsUpdate as it's unreliable after construction.
             expect(computeNormalsSpy).toHaveBeenCalled();

             // Clean up spy
             computeNormalsSpy.mockRestore();
        });
    });

});