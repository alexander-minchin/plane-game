import * as THREE from 'three';
import { NoiseProvider } from './NoiseProvider';
import { PhysicsEngine } from './PhysicsEngine';
import { Vector3 } from './types'; // Assuming Vector3 is defined in types.ts

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
            flatShading: false,
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

        console.log(`TerrainChunk [${chunkX}, ${chunkZ}] created.`);
    }

    /**
     * Generates the terrain geometry, including height displacement and vertex colors.
     */
    private generateGeometry(): void {
        const vertices = this.geometry.attributes.position;
        const colors = new Float32Array(vertices.count * 3); // RGB for each vertex
        const vertex = new THREE.Vector3();

        const waterLevel = 5.0; // Example water level
        const sandLevel = 10.0;
        const grassLevel = 30.0;
        const rockLevel = 45.0;

        const waterColor = new THREE.Color(0x4466aa); // Blue
        const sandColor = new THREE.Color(0xc2b280); // Sandy
        const grassColor = new THREE.Color(0x559955); // Green
        const rockColor = new THREE.Color(0x888888); // Grey
        const snowColor = new THREE.Color(0xffffff); // White

        for (let i = 0; i < vertices.count; i++) {
            vertex.fromBufferAttribute(vertices, i);

            // Calculate world coordinates for noise sampling
            // Vertex positions are relative to the mesh's origin
            const worldX = this.mesh.position.x + vertex.x;
            const worldZ = this.mesh.position.z + vertex.z;

            // Get height from NoiseProvider
            const height = this.noiseProvider.getHeight(worldX, worldZ);

            // Apply height to vertex y-coordinate
            vertices.setY(i, height);

            // Determine color based on height
            let color: THREE.Color;
            if (height < waterLevel) {
                color = waterColor;
                // Optionally clamp height to water level for flat water surface
                // vertices.setY(i, waterLevel);
            } else if (height < sandLevel) {
                color = sandColor;
            } else if (height < grassLevel) {
                color = grassColor;
            } else if (height < rockLevel) {
                color = rockColor;
            } else {
                color = snowColor;
            }

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
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
    }

    public getMesh(): THREE.Mesh {
        return this.mesh;
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