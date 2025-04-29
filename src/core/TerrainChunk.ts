import * as THREE from 'three';
import { NoiseProvider } from './NoiseProvider';
import { PhysicsEngine } from './PhysicsEngine';
// Import biome definitions and parameters
import { MOUNTAINS_BIOME, PLAINS_BIOME, Vector3 } from './types';

// Represents a single segment of the terrain mesh.
export class TerrainChunk {
    private chunkX: number;
    private chunkZ: number;
    private size: number; // Width and depth of the chunk
    public resolution: number; // Number of vertices along width/depth (public for LOD checks)
    private noiseProvider: NoiseProvider;
    private physicsEngine: PhysicsEngine; // Keep for potential future use
    private mesh: THREE.Mesh;
    private geometry: THREE.PlaneGeometry;
    private material: THREE.MeshStandardMaterial;
    // private collider: any; // Placeholder for physics collider shape

    constructor(
        chunkX: number,
        chunkZ: number,
        size: number,
        resolution: number, // Added resolution parameter
        noiseProvider: NoiseProvider,
        physicsEngine: PhysicsEngine
    ) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.size = size;
        this.resolution = resolution;
        this.noiseProvider = noiseProvider;
        this.physicsEngine = physicsEngine;

        // Create geometry and material
        this.geometry = new THREE.PlaneGeometry(
            this.size,
            this.size,
            this.resolution - 1,
            this.resolution - 1
        );
        this.geometry.rotateX(-Math.PI / 2); // Rotate to be horizontal

        this.material = new THREE.MeshStandardMaterial({
            // color: 0x88aa88, // Base color, will be overridden by vertex colors
            wireframe: false,
            flatShading: false, // Use smooth shading for better biome transitions
            vertexColors: true // Enable vertex colors
        });

        // Create mesh first to calculate world positions easily
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        // Position the mesh so its corner is at (chunkX * size, 0, chunkZ * size)
        // The geometry itself spans from 0 to size relative to this corner.
        this.mesh.position.set(
            this.chunkX * this.size,
            0,
            this.chunkZ * this.size
        );

        // Generate vertex heights and colors
        this.generateGeometry();

        // Create and add collider to physics engine (Placeholder)
        // this.collider = this.createCollider();
        // this.physicsEngine.addTerrainCollider(this.collider);

        console.log(`TerrainChunk [${chunkX}, ${chunkZ}] created with resolution ${resolution}.`);
    }

    /**
     * Generates the terrain geometry, including height displacement and biome-based vertex colors.
     */
    private generateGeometry(): void {
        const vertices = this.geometry.attributes.position;
        const colors = new Float32Array(vertices.count * 3); // RGB for each vertex
        const vertex = new THREE.Vector3();
        const finalColor = new THREE.Color(); // Reusable color object for interpolation

        // Pre-create THREE.Color objects for biome base colors for efficiency
        const mountainColor1 = new THREE.Color(MOUNTAINS_BIOME.color1.r, MOUNTAINS_BIOME.color1.g, MOUNTAINS_BIOME.color1.b);
        const mountainColor2 = new THREE.Color(MOUNTAINS_BIOME.color2.r, MOUNTAINS_BIOME.color2.g, MOUNTAINS_BIOME.color2.b);
        const plainsColor1 = new THREE.Color(PLAINS_BIOME.color1.r, PLAINS_BIOME.color1.g, PLAINS_BIOME.color1.b);
        const plainsColor2 = new THREE.Color(PLAINS_BIOME.color2.r, PLAINS_BIOME.color2.g, PLAINS_BIOME.color2.b);


        for (let i = 0; i < vertices.count; i++) {
            vertex.fromBufferAttribute(vertices, i);

            // Calculate world coordinates for noise sampling
            const worldX = this.mesh.position.x + vertex.x;
            const worldZ = this.mesh.position.z + vertex.z;

            // Get height and biome influence from NoiseProvider
            const height = this.noiseProvider.getHeight(worldX, worldZ);
            const biomeInfluence = this.noiseProvider.getBiomeInfluence(worldX, worldZ); // 0 = Mountains, 1 = Plains

            // Apply height to vertex y-coordinate
            vertices.setY(i, height);

            // --- Biome Color Interpolation ---
            // Determine color contribution from each biome based on height (e.g., snow caps)
            // This is a simple example; more complex logic could be used.
            // Normalize height relative to biome max amplitude for color mixing within the biome.
            const mountainHeightRatio = Math.max(0, Math.min(1, height / MOUNTAINS_BIOME.amplitude)); // Clamp 0-1
            const plainsHeightRatio = Math.max(0, Math.min(1, height / PLAINS_BIOME.amplitude)); // Clamp 0-1

            // Interpolate within each biome's color range based on height ratio
            const mountainColor = new THREE.Color().lerpColors(mountainColor1, mountainColor2, mountainHeightRatio);
            const plainsColor = new THREE.Color().lerpColors(plainsColor1, plainsColor2, plainsHeightRatio);

            // Interpolate between the final mountain and plains colors based on biome influence
            finalColor.lerpColors(mountainColor, plainsColor, biomeInfluence);

            // --- Store Final Color ---
            colors[i * 3] = finalColor.r;
            colors[i * 3 + 1] = finalColor.g;
            colors[i * 3 + 2] = finalColor.b;
        }

        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        vertices.needsUpdate = true;
        this.geometry.computeVertexNormals(); // Recalculate normals for correct lighting
    }

    // private createCollider(): any {
        // Create a heightfield shape or trimesh for the physics engine
        // based on this.geometry.attributes.position data.
        // Return the collider object.
        // return {}; // Placeholder
    // }

    public update(playerPosition: Vector3): void {
        // Placeholder for Level of Detail (LOD) logic or other updates
        // This method is currently not used for LOD updates in TerrainManager's approach
    }

    public getMesh(): THREE.Mesh {
        return this.mesh;
    }

/**
     * Provides access to the chunk's geometry for testing or specific updates.
     * @returns The THREE.PlaneGeometry instance.
     */
    public getGeometry(): THREE.PlaneGeometry {
        return this.geometry;
    }
    // public getCollider(): any {
    //     return this.collider;
    // }

    public dispose(): void {
        // Clean up Three.js resources and remove from physics engine
        this.geometry.dispose();
        this.material.dispose();
        // if (this.collider) {
        //     this.physicsEngine.removeTerrainCollider(this.collider);
        // }
        console.log(`TerrainChunk [${this.chunkX}, ${this.chunkZ}] disposed.`);
    }
}