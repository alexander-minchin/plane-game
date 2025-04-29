import * as THREE from 'three';

export class Renderer {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera; // Use PerspectiveCamera for 3D

    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Shadows removed for simplicity as per request for MeshBasicMaterial

        document.body.appendChild(this.renderer.domElement);

        // Initialize scene and camera here
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75, // Field of view
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near clipping plane
            1000 // Far clipping plane
        );
        // Default camera position (can be controlled by PlayerController later)
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        this.initialize();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        console.log("Renderer initialized with scene and camera.");
    }

    // Initialization sequence
    private initialize(): void {
        this.setupSkybox(); // Set background first
        this.setupLights();
        this.setupFog();

        // Placeholder cube removed. Player object is added by GameManager.

        // Ground plane and shadows removed for simplicity

        console.log("Scene initialized with lights, fog, and skybox.");
    }

    private setupLights(): void {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light
        this.scene.add(ambientLight);

        // Directional light for shadows and highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(5, 10, 7.5); // Position the light source
        // Shadows removed
        // directionalLight.castShadow = true;
        // Configure shadow properties... (removed)

        this.scene.add(directionalLight);
        console.log("Lights setup.");
    }

    private setupFog(): void {
        // Add simple linear fog
        this.scene.fog = new THREE.Fog(0xcce0ff, 10, 1500); // Color, near distance, far distance
        console.log("Fog setup.");
    }

    private setupSkybox(): void {
        // Set a simple background color for now
        this.scene.background = new THREE.Color(0xcce0ff); // Light blue background
        console.log("Skybox (background color) setup.");
        // Later, you might load a cube texture for a full skybox:
        // const loader = new THREE.CubeTextureLoader();
        // const texture = loader.load([ ... urls ... ]);
        // this.scene.background = texture;
    }

    // Allow external modules to set the active camera if needed (e.g., PlayerController)
    public setCamera(camera: THREE.PerspectiveCamera): void {
        this.camera = camera;
        this.onWindowResize(); // Update aspect ratio if camera changes
        console.log("Renderer camera updated.");
    }

    // Allow external modules to add objects to the scene (e.g., TerrainManager)
    public getScene(): THREE.Scene {
        return this.scene;
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    // Render the internally managed scene and camera
    public render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        console.log("Renderer resized.");
    }

    public getDomElement(): HTMLCanvasElement {
        return this.renderer.domElement;
    }
}