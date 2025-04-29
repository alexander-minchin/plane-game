import * as THREE from 'three';
import { InputHandler } from './InputHandler.js';
import { PhysicsBody, PhysicsEngine } from './PhysicsEngine.js'; // Import PhysicsBody
import { Vector3 } from './types.js';

// Default physics properties for the airplane
const DEFAULT_AIRPLANE_PHYSICS: Omit<PhysicsBody, 'position' | 'orientation' | 'linearVelocity' | 'angularVelocity' | 'force' | 'torque' | 'currentThrottle'> = {
    mass: 1000, // kg
    // Simplified inverse inertia tensor (diagonal matrix for a box-like shape)
    // Lower values mean more resistance to rotation around that axis.
    // Make it easier to pitch/roll than yaw initially.
    inertiaTensor: new THREE.Matrix3().set(
        1 / (1/12 * 1000 * (1**2 + 4**2)), 0, 0, // Ix (Pitch) - Based roughly on fuselage dimensions
        0, 1 / (1/12 * 1000 * (6**2 + 4**2)), 0, // Iy (Yaw) - Based roughly on wing+fuselage dimensions
        0, 0, 1 / (1/12 * 1000 * (6**2 + 1**2))  // Iz (Roll) - Based roughly on wing+fuselage dimensions
    ).invert(), // Physics engine expects the INVERSE tensor
    // wingArea, dragCoefficient, liftCoefficient are now part of PhysicsConfig in PhysicsEngine
    thrustForce: 25000, // Newtons (Adjust for desired acceleration)
};


export class PlayerController {
    private inputHandler: InputHandler;
    private physicsEngine: PhysicsEngine;
    private camera: THREE.PerspectiveCamera;
    private airplaneMesh: THREE.Object3D; // Renamed from playerObject for clarity
    public physicsBody: PhysicsBody; // Make public for potential external access/debugging

    // Control sensitivity parameters
    private pitchTorqueFactor = 0.001; // Halved from 5000
    private yawTorqueFactor = 0.0000001; // Halved from 3000
    private rollTorqueFactor = 0.001; // Halved from 6000
    private throttleChangeRate = 0.5; // Units per second

    constructor(inputHandler: InputHandler, physicsEngine: PhysicsEngine) {
        this.inputHandler = inputHandler;
        this.physicsEngine = physicsEngine;

        // Initialize camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000); // Increased far plane
        this.camera.position.set(0, 2, 5); // Relative to airplane

        // Initialize player visual mesh
        this.airplaneMesh = this.createPlaceholderMesh();
        this.airplaneMesh.add(this.camera); // Attach camera

        // Initialize Physics Body
        this.physicsBody = {
            ...DEFAULT_AIRPLANE_PHYSICS,
            position: this.airplaneMesh.position.clone(),
            orientation: this.airplaneMesh.quaternion.clone(),
            linearVelocity: new THREE.Vector3(0, 0, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            force: new THREE.Vector3(0, 0, 0),
            torque: new THREE.Vector3(0, 0, 0),
            currentThrottle: 0.3, // Start with some throttle
        };

        // No need to add player to physics engine explicitly anymore,
        // as the engine operates on the body passed to its methods.
        // this.physicsEngine.addPlayer(this.airplaneMesh, /* ... */); // REMOVED

        console.log("PlayerController initialized with PhysicsBody.");
    }

    private createPlaceholderMesh(): THREE.Object3D {
        const airplane = new THREE.Group();

        // Fuselage
        const fuselageGeometry = new THREE.BoxGeometry(1, 1, 4);
        const fuselageMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5, roughness: 0.6 });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.position.z = -1;
        airplane.add(fuselage);

        // Wings
        const wingGeometry = new THREE.BoxGeometry(6, 0.2, 1.5);
        const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.5, roughness: 0.6 });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-3, 0, -1);
        airplane.add(leftWing);
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(3, 0, -1);
        airplane.add(rightWing);

        // Tail Fin (Vertical Stabilizer)
        const tailFinGeometry = new THREE.BoxGeometry(0.2, 1.5, 1);
        const tailFinMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.5, roughness: 0.6 });
        const tailFin = new THREE.Mesh(tailFinGeometry, tailFinMaterial);
        tailFin.position.set(0, 0.75, 1.5);
        airplane.add(tailFin);

         // Tail Wings (Horizontal Stabilizers)
        const tailWingGeometry = new THREE.BoxGeometry(2.5, 0.15, 0.8);
        const tailWingMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.5, roughness: 0.6 });
        const leftTailWing = new THREE.Mesh(tailWingGeometry, tailWingMaterial);
        leftTailWing.position.set(-1.25, 0, 1.5);
        airplane.add(leftTailWing);
        const rightTailWing = new THREE.Mesh(tailWingGeometry, tailWingMaterial);
        rightTailWing.position.set(1.25, 0, 1.5);
        airplane.add(rightTailWing);

        // Cockpit
        const cockpitGeometry = new THREE.SphereGeometry(0.6, 16, 8);
        const cockpitMaterial = new THREE.MeshStandardMaterial({ color: 0x4444ff, transparent: true, opacity: 0.5 });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.set(0, 0.5, -1.5);
        cockpit.scale.z = 1.5;
        airplane.add(cockpit);

        airplane.scale.set(0.5, 0.5, 0.5);
        // Ensure the object faces forward initially along the negative Z axis in local space
        // This is important for physics calculations (thrust direction)
        // airplane.rotation.y = Math.PI; // Keep initial rotation if needed for visual setup
        // But ensure the physics body quaternion matches this initial visual rotation
        airplane.updateMatrixWorld(); // Ensure quaternion is updated if rotation was set

        return airplane;
    }


    public update(deltaTime: number): void {
        // 1. Handle input to calculate desired forces/torques for this frame
        this.handleInput(deltaTime);

        // 2. Apply physics forces (gravity, lift, drag, thrust)
        this.applyForces();

        // 3. Step the physics simulation using accumulated forces/torques
        this.physicsEngine.update(this.physicsBody, deltaTime);

        // 4. Sync the visual mesh with the updated physics body state
        this.airplaneMesh.position.copy(this.physicsBody.position);
        this.airplaneMesh.quaternion.copy(this.physicsBody.orientation);

        // Camera is attached, so it moves with the airplaneMesh automatically
    }

    /**
     * Calculates control torques and throttle changes based on input.
     */
    private handleInput(deltaTime: number): void {
        const localTorque = new THREE.Vector3(0, 0, 0);

        // --- Throttle --- (Using Shift/Ctrl)
        if (this.inputHandler.isKeyHeld('ShiftLeft')) {
            this.physicsBody.currentThrottle += this.throttleChangeRate * deltaTime;
        }
        if (this.inputHandler.isKeyHeld('ControlLeft')) {
            this.physicsBody.currentThrottle -= this.throttleChangeRate * deltaTime;
        }
        this.physicsBody.currentThrottle = THREE.MathUtils.clamp(this.physicsBody.currentThrottle, 0.0, 1.0);

        // --- Rotational Control ---
        // Pitch (W/S or Arrows) - Rotate around local X-axis
        if (this.inputHandler.isKeyHeld('KeyS') || this.inputHandler.isKeyHeld('ArrowDown')) {
             localTorque.x += this.pitchTorqueFactor; // Pitch down
        }
        if (this.inputHandler.isKeyHeld('KeyW') || this.inputHandler.isKeyHeld('ArrowUp')) {
             localTorque.x -= this.pitchTorqueFactor; // Pitch up
        }

        // Yaw (A/D) - Rotate around local Y-axis
        if (this.inputHandler.isKeyHeld('KeyA')) {
             localTorque.y += this.yawTorqueFactor; // Yaw left
        }
        if (this.inputHandler.isKeyHeld('KeyD')) {
             localTorque.y -= this.yawTorqueFactor; // Yaw right
        }

        // Roll (Q/E) - Rotate around local Z-axis
        if (this.inputHandler.isKeyHeld('KeyQ')) {
            localTorque.z += this.rollTorqueFactor; // Roll left
        }
        if (this.inputHandler.isKeyHeld('KeyE')) {
            localTorque.z -= this.rollTorqueFactor; // Roll right
        }

        // Apply the calculated local torque to the physics body
        if (localTorque.lengthSq() > 0) {
            this.physicsEngine.applyLocalTorque(this.physicsBody, localTorque);
        }

        // --- Remove direct mesh manipulation ---
        // const moveSpeed = 15 * deltaTime;
        // const rotateSpeed = Math.PI * 0.8 * deltaTime;
        // ... (all direct playerObject.rotateX/Y/Z and playerObject.position.addScaledVector removed)
    }

    /**
     * Applies aerodynamic and engine forces to the physics body.
     */
    private applyForces(): void {
        this.physicsEngine.applyFlightForces(this.physicsBody);
    }


    public getPosition(): Vector3 {
        // Return position from the physics body
        return { x: this.physicsBody.position.x, y: this.physicsBody.position.y, z: this.physicsBody.position.z };
    }

     public getCamera(): THREE.Camera {
        return this.camera;
    }

    public getPlayerObject(): THREE.Object3D {
        // Renamed internally, but keep getter name for compatibility if needed
        return this.airplaneMesh;
    }
/**
     * Resets the player's state to the initial configuration.
     * Used for starting the game or after a collision/crash.
     */
    public reset(): void {
        console.log("Resetting player state...");

        // Define initial state values
        const initialPosition = new THREE.Vector3(0, 150, 0); // Start above the origin
        const initialOrientation = new THREE.Quaternion().identity(); // Level flight
        const initialVelocity = new THREE.Vector3(0, 0, -200);
        const initialAngularVelocity = new THREE.Vector3(0, 0, 0);
        const initialThrottle = 0.3; // Default starting throttle

        // Reset physics body properties
        this.physicsBody.position.copy(initialPosition);
        this.physicsBody.orientation.copy(initialOrientation);
        this.physicsBody.linearVelocity.copy(initialVelocity);
        this.physicsBody.angularVelocity.copy(initialAngularVelocity);
        this.physicsBody.force.set(0, 0, 0); // Clear any residual forces
        this.physicsBody.torque.set(0, 0, 0); // Clear any residual torques
        this.physicsBody.currentThrottle = initialThrottle;

        // Update the visual mesh to match the reset physics state
        this.airplaneMesh.position.copy(this.physicsBody.position);
        this.airplaneMesh.quaternion.copy(this.physicsBody.orientation);

        console.log("Player state reset complete.");
    }
/**
     * Returns the current data needed for the Heads-Up Display (HUD).
     */
    public getHUDData(): { speed: number; altitude: number; throttle: number } {
        const speedMS = this.physicsBody.linearVelocity.length(); // Speed in m/s
        const speedKmh = speedMS * 3.6; // Convert to km/h
        const altitude = this.physicsBody.position.y;
        const throttle = this.physicsBody.currentThrottle;

        return {
            speed: speedKmh,
            altitude: altitude,
            throttle: throttle,
        };
    }
/**
     * Returns the current throttle level (0.0 to 1.0).
     */
    public getThrottleLevel(): number {
        return this.physicsBody.currentThrottle;
    }
}