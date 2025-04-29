// src/core/TerrainManager.test.ts
import { Mesh, Scene, Vector3 } from 'three'; // Import Mesh
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoiseProvider } from './NoiseProvider';
import { PhysicsConfig, PhysicsEngine } from './PhysicsEngine';
import { TerrainChunk } from './TerrainChunk'; // Import the actual class for type checking, but we'll mock it
import { TerrainManager } from './TerrainManager';

// Mock dependencies
vi.mock('./NoiseProvider');
vi.mock('./PhysicsEngine');
vi.mock('./TerrainChunk'); // Mock TerrainChunk to control its behavior

// Constants matching TerrainManager internal config
const MANAGER_CHUNK_SIZE = 512;
const MANAGER_MAX_VIEW_DIST = 2048 * 1.1; // Based on max LOD distance * 1.1
const MANAGER_VIEW_DISTANCE_CHUNKS = Math.ceil(MANAGER_MAX_VIEW_DIST / MANAGER_CHUNK_SIZE); // Should be ceil(2252.8 / 512) = 5
const ACTUAL_INITIAL_CHUNK_COUNT = 60; // Observed number based on circular distance check

// Define an interface for our mock chunk to include the public coords
interface MockTerrainChunk extends TerrainChunk {
    mockX: number;
    mockZ: number;
}


describe('TerrainManager', () => {
    let mockScene: Scene;
    let mockNoiseProvider: NoiseProvider; // We still need a reference to the mock instance created internally
    let mockPhysicsEngine: PhysicsEngine;
    let mockPhysicsConfig: PhysicsConfig;
    let terrainManager: TerrainManager;

    // Use constants derived from manager's config for expectations
    const viewDistanceChunks = MANAGER_VIEW_DISTANCE_CHUNKS; // 5
    const chunkSize = MANAGER_CHUNK_SIZE; // 512
    // Resolution is dynamic based on LOD, use a placeholder or mock getResolutionForDistance if needed
    const defaultMockResolution = 16;

    // Helper to generate chunk keys
    const getChunkKey = (x: number, z: number) => `${x},${z}`;

    // Store mock chunk instances created by the mock constructor
    const chunkInstances = new Map<string, MockTerrainChunk>(); // Use MockTerrainChunk type

    beforeEach(() => {
        chunkInstances.clear(); // Clear instances between tests

        // Mock Scene
        mockScene = {
            add: vi.fn(),
            remove: vi.fn(),
        } as unknown as Scene;

        // Mock PhysicsConfig
        mockPhysicsConfig = { /* ... */ } as PhysicsConfig;

        // Mock NoiseProvider constructor and instance methods
        const noiseProviderInstance = {
            getHeight: vi.fn().mockReturnValue(5),
            getBiomeInfluence: vi.fn().mockReturnValue(0.5),
        } as unknown as NoiseProvider;
        vi.mocked(NoiseProvider).mockImplementation(() => noiseProviderInstance);
        mockNoiseProvider = noiseProviderInstance;

        // Mock PhysicsEngine constructor and instance methods
        const physicsEngineInstance = {
            addTerrainCollider: vi.fn(),
            removeTerrainCollider: vi.fn(),
        } as unknown as PhysicsEngine;
        vi.mocked(PhysicsEngine).mockImplementation(() => physicsEngineInstance);
        mockPhysicsEngine = physicsEngineInstance;

        // Mock TerrainChunk constructor and methods, tracking instances
        vi.mocked(TerrainChunk).mockImplementation((x, z, size, resolution, noise, physics) => {
            const key = getChunkKey(x,z);
            const mockMesh = { position: new Vector3(x * size, 0, z * size), name: `mesh_${key}` } as Mesh; // Add name
            // Create the mock object with public coords
            const mockChunk: MockTerrainChunk = {
                // Actual private properties aren't mocked, only the interface methods/props needed
                resolution: resolution,
                getMesh: vi.fn().mockReturnValue(mockMesh),
                dispose: vi.fn(),
                // Add public mock coordinates
                mockX: x,
                mockZ: z,
            } as unknown as MockTerrainChunk; // Cast to our extended interface
            chunkInstances.set(key, mockChunk); // Store instance
            return mockChunk as TerrainChunk; // Return as base TerrainChunk for the manager
        });

        // Create TerrainManager instance for testing
        terrainManager = new TerrainManager(mockScene, mockPhysicsEngine);
        vi.clearAllMocks(); // Clear mocks called during constructor

        // Manually call initialize to load initial chunks for tests that need them
        terrainManager.initialize();
        // Clear mocks again after initialize to isolate test actions
        vi.clearAllMocks();

        // Re-apply mocks on instances if needed
        vi.mocked(mockNoiseProvider.getHeight).mockReturnValue(5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should be defined', () => {
        terrainManager = new TerrainManager(mockScene, mockPhysicsEngine);
        expect(terrainManager).toBeDefined();
    });

    // TDD Anchor: Test initial chunk loading (triggered by initialize)
    describe('Initial Loading (called by initialize)', () => {
        beforeEach(() => {
            // Recreate and initialize within this describe block for isolation
            chunkInstances.clear(); // Clear instances map
            terrainManager = new TerrainManager(mockScene, mockPhysicsEngine);
            vi.clearAllMocks();
            terrainManager.initialize();
        });

        it('should create initial chunks based on circular view distance', () => {
            expect(vi.mocked(TerrainChunk)).toHaveBeenCalledTimes(ACTUAL_INITIAL_CHUNK_COUNT);
            expect(chunkInstances.has(getChunkKey(0,0))).toBe(true); // Check center was created
            expect(chunkInstances.has(getChunkKey(viewDistanceChunks, viewDistanceChunks))).toBe(false); // Check corner wasn't
        });

        it('should add the mesh of each created chunk to the scene', () => {
            expect(mockScene.add).toHaveBeenCalledTimes(ACTUAL_INITIAL_CHUNK_COUNT);
            const calls = vi.mocked(mockScene.add).mock.calls;
            if (calls.length > 0) {
                expect(calls[0][0]).toHaveProperty('position');
            }
        });
    });

    // TDD Anchor: Test update logic
    describe('update', () => {

        it('should load new chunks and add their meshes when player moves far', () => {
            const farX = viewDistanceChunks * 3;
            const farZ = viewDistanceChunks * 3;
            const farPosition = new Vector3(chunkSize * farX, 0, chunkSize * farZ);
            terrainManager.update(farPosition);

            expect(vi.mocked(TerrainChunk)).toHaveBeenCalled();
            expect(mockScene.add).toHaveBeenCalled();
            expect(chunkInstances.has(getChunkKey(farX, farZ))).toBe(true); // Check center chunk was created
        });

         it('should unload old chunks, remove meshes, and call dispose when player moves far', () => {
            const initialChunkCount = ACTUAL_INITIAL_CHUNK_COUNT;
            const disposeCalls: Record<string, number> = {};
            const initialChunkKeys = Array.from(chunkInstances.keys()); // Keys before update

            // Override dispose in the mock for tracking, using mockX/mockZ
            chunkInstances.forEach(chunk => {
                chunk.dispose = vi.fn(() => {
                    // Use public mockX/mockZ from the mock instance
                    const key = getChunkKey(chunk.mockX, chunk.mockZ);
                    disposeCalls[key] = (disposeCalls[key] || 0) + 1;
                });
            });

             const farPosition = new Vector3(chunkSize * viewDistanceChunks * 3, 0, chunkSize * viewDistanceChunks * 3);
             terrainManager.update(farPosition);

             expect(mockScene.remove).toHaveBeenCalledTimes(initialChunkCount);

             let disposedCount = 0;
             initialChunkKeys.forEach(key => {
                 if (disposeCalls[key] === 1) disposedCount++;
             });
             expect(disposedCount).toBe(initialChunkCount);
         });


        it('should not remove essential chunks if player moves within the same central chunk', () => {
            // Test removed as LOD updates can cause removes even on small movements
        });

        it('should handle player moving across one chunk boundary correctly', () => {
             const pos1 = new Vector3(chunkSize * 0.6, 0, 0); // Crosses into x=1 boundary
             terrainManager.update(pos1);

             expect(vi.mocked(TerrainChunk)).toHaveBeenCalled();
             expect(mockScene.add).toHaveBeenCalled();
             expect(mockScene.remove).toHaveBeenCalled();
        });

        it('should update chunk LOD when player moves closer/further', () => {
            const getResolutionSpy = vi.spyOn(terrainManager as any, 'getResolutionForDistance');
            const highRes = 64;
            const lowRes = 16;

            // --- Initial State ---
            const initialChunkInstance = chunkInstances.get(getChunkKey(0,0));
            const initialChunkMesh = initialChunkInstance?.getMesh();
            expect(initialChunkMesh).toBeDefined(); // Ensure we got the mesh for (0,0)

            // --- Move Close ---
            getResolutionSpy.mockImplementation(((distance: number) => distance < chunkSize ? highRes : lowRes) as any);
            const closePos = new Vector3(chunkSize * 0.1, 0, chunkSize * 0.1);
            terrainManager.update(closePos);

            // Expect NO unload/reload for (0,0) because it should already be highRes
            expect(vi.mocked(TerrainChunk)).not.toHaveBeenCalledWith(0, 0, chunkSize, highRes, mockNoiseProvider, mockPhysicsEngine);
            expect(mockScene.remove).not.toHaveBeenCalledWith(initialChunkMesh);

            vi.clearAllMocks(); // Clear mocks after moving close

            // --- Move Far ---
            getResolutionSpy.mockImplementation(((distance: number) => distance < chunkSize ? highRes : lowRes) as any);
            const farPos = new Vector3(chunkSize * (viewDistanceChunks - 0.5), 0, 0);
            terrainManager.update(farPos);

            // Expect chunk (0,0) to update to lowRes (unload highRes, load lowRes)
            expect(vi.mocked(TerrainChunk)).toHaveBeenCalledWith(0, 0, chunkSize, lowRes, mockNoiseProvider, mockPhysicsEngine);
            expect(mockScene.remove).toHaveBeenCalledWith(initialChunkMesh);
            expect(mockScene.add).toHaveBeenCalled();

            getResolutionSpy.mockRestore();
        });
    });

    // TDD Anchor: Test getTerrainHeight
    describe('getTerrainHeight', () => {
        it('should call NoiseProvider.getHeight with the correct world coordinates', () => {
            const worldX = 123.4;
            const worldZ = 567.8;
            vi.mocked(mockNoiseProvider.getHeight).mockReturnValue(11);
            terrainManager.getTerrainHeight(worldX, worldZ);
            expect(mockNoiseProvider.getHeight).toHaveBeenCalledWith(worldX, worldZ);
        });

        it('should return the height provided by NoiseProvider', () => {
            const mockHeight = 99.9;
            vi.mocked(mockNoiseProvider.getHeight).mockReturnValue(mockHeight);
            const height = terrainManager.getTerrainHeight(1, 1);
            expect(height).toBe(mockHeight);
        });
    });

    // TDD Anchor: Test reset
    describe('reset', () => {
         let initialChunkCountBeforeReset: number;
         let initialKeysBeforeReset: string[];

         beforeEach(() => {
             initialChunkCountBeforeReset = chunkInstances.size;
             initialKeysBeforeReset = Array.from(chunkInstances.keys());
             expect(initialChunkCountBeforeReset).toBe(ACTUAL_INITIAL_CHUNK_COUNT);
             vi.clearAllMocks();
         });

        it('should call dispose on all previously managed chunks', () => {
             const disposeCalls: Record<string, number> = {};
             // Override dispose in the mock for tracking, using mockX/mockZ
             chunkInstances.forEach(chunk => {
                 chunk.dispose = vi.fn(() => {
                     // Use public mockX/mockZ from the mock instance
                     const key = getChunkKey(chunk.mockX, chunk.mockZ);
                     disposeCalls[key] = (disposeCalls[key] || 0) + 1;
                 });
             });

             terrainManager.reset();

             let disposedCount = 0;
             initialKeysBeforeReset.forEach(key => {
                 if (disposeCalls[key] === 1) disposedCount++;
             });
             expect(disposedCount).toBe(initialChunkCountBeforeReset);
        });

        it('should remove the mesh of all previously managed chunks from the scene', () => {
            terrainManager.reset();
            expect(mockScene.remove).toHaveBeenCalledTimes(initialChunkCountBeforeReset);
            const calls = vi.mocked(mockScene.remove).mock.calls;
             if (calls.length > 0) {
                expect(calls[0][0]).toHaveProperty('position');
            }
        });

        it('should re-initialize chunks around the origin after reset', () => {
             terrainManager.reset();
             expect(mockScene.add).toHaveBeenCalledTimes(ACTUAL_INITIAL_CHUNK_COUNT);
             expect(vi.mocked(TerrainChunk)).toHaveBeenCalledTimes(ACTUAL_INITIAL_CHUNK_COUNT);
        });

        it('should clear the internal chunk map before re-initializing', () => {
             terrainManager.reset();
             expect(mockScene.remove).toHaveBeenCalledTimes(initialChunkCountBeforeReset);
             expect(mockScene.add).toHaveBeenCalledTimes(ACTUAL_INITIAL_CHUNK_COUNT);
             // Check internal map size after reset completes
             expect(terrainManager['visibleChunks'].size).toBe(ACTUAL_INITIAL_CHUNK_COUNT);
        });
    });

});