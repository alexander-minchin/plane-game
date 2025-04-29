import * as THREE from 'three';
import { NoiseProvider } from './NoiseProvider.js';
import { PhysicsEngine } from './PhysicsEngine.js';
import { TerrainChunk } from './TerrainChunk.js';
import { Vector3 } from './types.js';

// Define LOD levels (distance thresholds and corresponding resolutions)
// Sorted by distance, ascending. Higher resolution closer to the player.
const lodLevels = [
    { distance: 512, resolution: 64 },   // High detail up close
    { distance: 1024, resolution: 32 },  // Medium detail
    { distance: 2048, resolution: 16 },  // Low detail far away
    // Add more levels as needed
];

export class TerrainManager {
    private physicsEngine: PhysicsEngine;
    private noiseProvider: NoiseProvider;
    private scene: THREE.Scene;
    private visibleChunks: Map<string, TerrainChunk>;
    private chunkSize: number = 512;
    // private chunkResolution: number = 32; // Base resolution, now determined by LOD
    private viewDistanceChunks: number = 4; // Max view distance in chunks (adjust based on max LOD distance)

    // Configuration object
    private config = {
        chunkSize: 512,
        lodLevels: lodLevels,
        viewDistance: lodLevels[lodLevels.length - 1].distance * 1.1, // Ensure view distance covers max LOD
    };

    constructor(scene: THREE.Scene, physicsEngine: PhysicsEngine) {
        this.scene = scene;
        this.physicsEngine = physicsEngine;
        this.noiseProvider = new NoiseProvider();
        this.visibleChunks = new Map();
        this.chunkSize = this.config.chunkSize; // Use config value
        this.viewDistanceChunks = Math.ceil(this.config.viewDistance / this.chunkSize);

        console.log("TerrainManager initialized with config:", this.config);
    }

    /**
     * Creates the initial terrain chunk(s) around the origin.
     */
    public initialize(): void {
        console.log("TerrainManager initializing terrain...");
        this.update({ x: 0, y: 0, z: 0 });
        console.log("Initial terrain generated.");
    }

    /**
     * Determines the appropriate resolution for a chunk based on its distance to the player.
     * @param distance The distance from the player to the chunk center.
     * @returns The resolution level.
     */
    private getResolutionForDistance(distance: number): number {
        for (const level of this.config.lodLevels) {
            if (distance <= level.distance) {
                return level.resolution;
            }
        }
        // If beyond the furthest defined level, use the lowest resolution
        return this.config.lodLevels[this.config.lodLevels.length - 1].resolution;
    }

    /**
     * Update loop for the terrain manager. Loads/unloads/updates LOD of chunks based on player position.
     * @param playerPosition The current position of the player.
     */
    public update(playerPosition: Vector3): void {
        const playerChunkX = Math.floor(playerPosition.x / this.chunkSize);
        const playerChunkZ = Math.floor(playerPosition.z / this.chunkSize);

        // Map to store required chunks and their necessary resolution
        const requiredChunks = new Map<string, { x: number, z: number, requiredResolution: number }>();

        // Determine required chunks and their resolution based on view distance and LOD levels
        const maxViewDistChunks = this.viewDistanceChunks;
        for (let x = playerChunkX - maxViewDistChunks; x <= playerChunkX + maxViewDistChunks; x++) {
            for (let z = playerChunkZ - maxViewDistChunks; z <= playerChunkZ + maxViewDistChunks; z++) {
                const chunkWorldX = (x + 0.5) * this.chunkSize;
                const chunkWorldZ = (z + 0.5) * this.chunkSize;

                // Calculate distance from player to chunk center (2D for simplicity)
                const dx = playerPosition.x - chunkWorldX;
                const dz = playerPosition.z - chunkWorldZ;
                const distance = Math.sqrt(dx * dx + dz * dz);

                // Only consider chunks within the configured view distance
                if (distance <= this.config.viewDistance) {
                    const requiredResolution = this.getResolutionForDistance(distance);
                    const key = `${x},${z}`;
                    requiredChunks.set(key, { x, z, requiredResolution });
                }
            }
        }

        const currentChunkKeys = new Set(this.visibleChunks.keys());
        const requiredChunkKeys = new Set(requiredChunks.keys());

        // Identify chunks to unload (currently visible but no longer required)
        const chunksToUnload = new Set([...currentChunkKeys].filter(key => !requiredChunkKeys.has(key)));

        // Identify chunks to load (required but not currently visible)
        const chunksToLoad = new Set([...requiredChunkKeys].filter(key => !currentChunkKeys.has(key)));

        // Identify chunks that are visible AND required, but might need an LOD update
        const chunksToCheckLOD = new Set([...currentChunkKeys].filter(key => requiredChunkKeys.has(key)));
        const chunksToUpdateLOD = new Map<string, number>(); // Map<key, newResolution>

        chunksToCheckLOD.forEach(key => {
            const currentChunk = this.visibleChunks.get(key);
            const requiredDetail = requiredChunks.get(key);
            if (currentChunk && requiredDetail && currentChunk.resolution !== requiredDetail.requiredResolution) {
                // console.log(`Chunk ${key} needs LOD update: ${currentChunk.resolution} -> ${requiredDetail.requiredResolution}`);
                chunksToUpdateLOD.set(key, requiredDetail.requiredResolution);
            }
        });


        // --- Perform Actions ---

        // 1. Unload chunks
        chunksToUnload.forEach(key => {
            this.unloadChunk(key);
        });

        // 2. Update LOD for existing chunks
        chunksToUpdateLOD.forEach((newResolution, key) => {
            const details = requiredChunks.get(key); // Get coords from required map
             if (details) {
                this.updateChunkLOD(details.x, details.z, newResolution);
            } else {
                 console.error(`Missing details for LOD update on chunk key: ${key}`);
             }
        });

        // 3. Load new chunks
        chunksToLoad.forEach(key => {
            const details = requiredChunks.get(key);
            if (details) {
                this.addChunkToScene(details.x, details.z, details.requiredResolution);
            } else {
                console.error(`Missing details for chunk load key: ${key}`);
            }
        });
    }

     /**
     * Updates the LOD of an existing chunk.
     * Simple implementation: Unload and reload with the new resolution.
     * @param chunkX The X coordinate of the chunk.
     * @param chunkZ The Z coordinate of the chunk.
     * @param newResolution The target resolution.
     */
    private updateChunkLOD(chunkX: number, chunkZ: number, newResolution: number): void {
        const key = `${chunkX},${chunkZ}`;
        // console.log(`Updating LOD for chunk ${key} to resolution ${newResolution}`);
        this.unloadChunk(key); // Remove the old one
        this.addChunkToScene(chunkX, chunkZ, newResolution); // Add the new one
    }


    /**
     * Creates a TerrainChunk, adds its mesh to the scene, and stores it.
     * @param chunkX The X coordinate of the chunk.
     * @param chunkZ The Z coordinate of the chunk.
     * @param resolution The resolution (detail level) for this chunk.
     */
    private addChunkToScene(chunkX: number, chunkZ: number, resolution: number): void {
        const key = `${chunkX},${chunkZ}`;
        if (this.visibleChunks.has(key)) {
            // This might happen if an LOD update triggers before the load check completes fully
            // Or if logic allows adding an already existing chunk during LOD update.
            // It's generally safe to just return here if the chunk exists.
            // console.warn(`Attempted to add chunk ${key} which already exists (possibly during LOD update).`);
            return;
        }

        // console.log(`Creating chunk: ${key} with resolution ${resolution}`);
        const chunk = new TerrainChunk(
            chunkX,
            chunkZ,
            this.chunkSize,
            resolution, // Pass the required resolution
            this.noiseProvider,
            this.physicsEngine
        );

        this.visibleChunks.set(key, chunk);
        this.scene.add(chunk.getMesh());
        // console.log(`Chunk ${key} added to scene with resolution ${resolution}.`);

        // Placeholder for adding collider (consider if collider needs LOD)
        // this.physicsEngine.addTerrainCollider(chunk.getCollider());
    }

    /**
     * Removes a chunk from the scene and disposes of its resources.
     * @param key The key of the chunk to unload (e.g., "0,0").
     */
    private unloadChunk(key: string): void {
        const chunk = this.visibleChunks.get(key);
        if (chunk) {
            // console.log(`Unloading chunk: ${key}`);
            this.scene.remove(chunk.getMesh());
            chunk.dispose(); // Dispose geometry and material
            this.visibleChunks.delete(key);
            // console.log(`Chunk ${key} unloaded.`);

            // Placeholder for removing collider
            // this.physicsEngine.removeTerrainCollider(chunk.getCollider());
        } else {
            // This can happen if unload is called twice for the same key rapidly, e.g. during LOD update
            // console.warn(`Attempted to unload non-existent chunk: ${key}`);
        }
    }

    // Optional: Method to get height at world coordinates if needed
    /**
     * Gets the terrain height at the specified world coordinates using the noise provider.
     * @param worldX The world X coordinate.
     * @param worldZ The world Z coordinate.
     * @returns The terrain height at the given coordinates.
     */
    public getTerrainHeight(worldX: number, worldZ: number): number {
        // Directly use the noise provider for accurate height, regardless of loaded chunks/LOD
        return this.noiseProvider.getHeight(worldX, worldZ);
    }

    /**
     * Resets the terrain by removing all visible chunks and re-initializing
     * the terrain around the origin (0,0,0).
     */
    public reset(): void {
        console.log("Resetting TerrainManager...");
        // Unload all currently visible chunks
        const keysToUnload = Array.from(this.visibleChunks.keys());
        keysToUnload.forEach(key => this.unloadChunk(key));

        // Re-initialize terrain around the origin
        this.initialize();
        console.log("TerrainManager reset complete.");
    }
}