import * as THREE from 'three';
import { PlayerController } from './PlayerController.js';
import { TerrainManager } from './TerrainManager.js';

/**
 * Represents the physical state and properties of an object.
 */
export interface PhysicsBody {
    mass: number;
    inertiaTensor: THREE.Matrix3; // Inverse inertia tensor in body space
    position: THREE.Vector3;
    orientation: THREE.Quaternion;
    linearVelocity: THREE.Vector3;
    angularVelocity: THREE.Vector3; // In world space

    // Accumulators for forces and torques applied over a timestep
    force: THREE.Vector3;
    torque: THREE.Vector3; // In world space

    // Configuration for flight dynamics (controlled externally now)
    // wingArea: number; // Moved to PhysicsConfig
    // dragCoefficient: number; // Replaced by more complex model
    // liftCoefficient: number; // Replaced by more complex model
    thrustForce: number; // Max thrust
    currentThrottle: number; // 0 to 1
}

/**
 * Configuration for the Physics Engine.
 */
export interface PhysicsConfig {
    gravity: THREE.Vector3;
    // Aerodynamic properties
    wingArea: number;
    airDensity: number;
    liftSlope: number; // Coefficient determining how CL changes with AoA (e.g., 2 * Math.PI)
    maxCL: number; // Maximum lift coefficient
    baseDragCoefficient: number; // Parasite drag (Cd0)
    inducedDragFactor: number; // Factor relating lift to induced drag (K in Cd = Cd0 + K * CL^2)
}

/**
 * Manages basic rigid body physics simulation with flight dynamics.
 */
export class PhysicsEngine {
    private config: PhysicsConfig;

    constructor(config: PhysicsConfig) {
        // Provide default values if not fully specified
        this.config = {
            gravity: config.gravity ?? new THREE.Vector3(0, -9.81, 0),
            wingArea: config.wingArea ?? 10,
            airDensity: config.airDensity ?? 1.225,
            liftSlope: config.liftSlope ?? (2 * Math.PI),
            maxCL: config.maxCL ?? 1.2,
            baseDragCoefficient: config.baseDragCoefficient ?? 0.02,
            inducedDragFactor: config.inducedDragFactor ?? 0.05,
        };
        console.log("PhysicsEngine initialized with realistic aero model config.");
    }

    /**
     * Applies aerodynamic forces (lift, drag), thrust, and gravity to a physics body.
     * Uses a more realistic aerodynamic model based on Angle of Attack (AoA).
     * @param body The physics body representing the aircraft.
     */
    public applyFlightForces(body: PhysicsBody): void {
        const speed = body.linearVelocity.length();
        const speedSq = speed * speed;

        // Get body orientation vectors
        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(body.orientation);
        const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(body.orientation);
        const rightVector = new THREE.Vector3().crossVectors(forwardVector, upVector).normalize(); // Used for lift direction

        // --- Aerodynamic Forces (Lift & Drag) ---
        if (speed > 0.1) { // Avoid calculations at near-zero speed
            const relativeWind = body.linearVelocity.clone().negate(); // Wind relative to the aircraft

            // Calculate Angle of Attack (AoA)
            // Project relative wind onto the plane's symmetry plane (forward-up)
            const windInPlaneForward = relativeWind.dot(forwardVector);
            const windInPlaneUp = relativeWind.dot(upVector);
            // AoA is the angle between the forward vector and the relative wind projection in the symmetry plane
            const aoa = Math.atan2(windInPlaneUp, windInPlaneForward); // Radians

            // Calculate Lift Coefficient (CL) - simplified linear model clamped at max/min
            const cl = Math.max(-this.config.maxCL, Math.min(this.config.maxCL, this.config.liftSlope * aoa));

            // Calculate Drag Coefficient (CD) - parabolic drag polar: CD = CD0 + K * CL^2
            const cd = this.config.baseDragCoefficient + this.config.inducedDragFactor * cl * cl;

            // Calculate dynamic pressure: 0.5 * rho * v^2
            const dynamicPressure = 0.5 * this.config.airDensity * speedSq;

            // Calculate Lift Magnitude: L = CL * q * A
            const liftMagnitude = cl * dynamicPressure * this.config.wingArea;

            // Calculate Drag Magnitude: D = CD * q * A
            const dragMagnitude = cd * dynamicPressure * this.config.wingArea;

            // Calculate Lift Direction: Perpendicular to relative wind, in the plane containing relative wind and the body's up vector.
            // More robustly: Cross product of relative wind and the body's right vector.
            const liftDirection = new THREE.Vector3().crossVectors(relativeWind, rightVector).normalize();
            // Ensure lift generally points "up" relative to the aircraft if needed (optional check)
             if (liftDirection.dot(upVector) < 0) {
                 // This might happen at very high AoA or unusual attitudes.
                 // Depending on model fidelity, might need adjustment or indicate stall.
                 // For now, we assume the basic cross product gives the correct direction.
                 // console.warn("Lift direction might be inverted relative to body up.");
             }


            // Calculate Drag Direction: Opposite to the relative wind vector
            const dragDirection = relativeWind.clone().normalize(); // Drag opposes relative wind

            // Apply Forces
            const liftForce = liftDirection.multiplyScalar(liftMagnitude);
            const dragForce = dragDirection.multiplyScalar(dragMagnitude); // Drag direction is already opposite velocity

            this.applyForce(body, liftForce);
            this.applyForce(body, dragForce);

            // console.log(`AoA: ${(aoa * 180 / Math.PI).toFixed(1)}°, CL: ${cl.toFixed(2)}, CD: ${cd.toFixed(3)}, Lift: ${liftForce.length().toFixed(1)}, Drag: ${dragForce.length().toFixed(1)}`);

        } else {
             // console.log("Speed too low for aerodynamic forces.");
        }


        // --- Thrust ---
        // Thrust acts along the body's forward direction
        const thrustMagnitude = body.thrustForce * body.currentThrottle;
        const thrustForce = forwardVector.clone().multiplyScalar(thrustMagnitude); // Use clone to avoid modifying forwardVector
        this.applyForce(body, thrustForce);
        // console.log(`Applying Thrust: ${thrustForce.length().toFixed(1)}`);

        // --- Gravity ---
        const gravityForce = this.config.gravity.clone().multiplyScalar(body.mass);
        this.applyForce(body, gravityForce);
    }

    /**
     * Applies a force vector (in world space) to the center of mass of the body.
     * @param body The physics body.
     * @param force World-space force vector.
     */
    public applyForce(body: PhysicsBody, force: THREE.Vector3): void {
        body.force.add(force);
    }

    /**
     * Applies a torque vector (in world space) to the body.
     * @param body The physics body.
     * @param torque World-space torque vector.
     */
    public applyTorque(body: PhysicsBody, torque: THREE.Vector3): void {
        body.torque.add(torque);
    }

     /**
     * Applies a torque vector defined in the body's local space.
     * @param body The physics body.
     * @param localTorque Torque vector in the body's local coordinate system.
     */
    public applyLocalTorque(body: PhysicsBody, localTorque: THREE.Vector3): void {
        // Convert local torque to world space torque
        const worldTorque = localTorque.clone().applyQuaternion(body.orientation);
        this.applyTorque(body, worldTorque);
    }


    /**
     * Steps the physics simulation forward for a single body using Euler integration.
     * @param body The physics body to update.
     * @param deltaTime The time elapsed since the last update in seconds.
     */
    public update(body: PhysicsBody, deltaTime: number): void {
        if (deltaTime <= 0) return;

        // --- Linear Motion ---
        // a = F / m
        const linearAcceleration = body.force.clone().multiplyScalar(1.0 / body.mass);
        // v = v0 + a * dt
        body.linearVelocity.addScaledVector(linearAcceleration, deltaTime);
        // p = p0 + v * dt
        body.position.addScaledVector(body.linearVelocity, deltaTime);

        // --- Angular Motion ---
        // Calculate inverse inertia tensor in world space
        const worldInertiaTensorInv = this.getWorldInverseInertiaTensor(body);

        // Angular acceleration = I^-1 * Torque
        // alpha = I_world^-1 * tau_world
        const angularAcceleration = body.torque.clone().applyMatrix3(worldInertiaTensorInv);

        // Angular velocity update: w = w0 + alpha * dt
        body.angularVelocity.addScaledVector(angularAcceleration, deltaTime);

        // Orientation update: q = q0 + 0.5 * (w * q0) * dt
        // Create quaternion representing angular velocity for integration
        const deltaRotation = new THREE.Quaternion(
            body.angularVelocity.x * deltaTime * 0.5,
            body.angularVelocity.y * deltaTime * 0.5,
            body.angularVelocity.z * deltaTime * 0.5,
            0 // w component is 0 for pure rotation quaternion multiplication
        );

        // Multiply delta rotation with current orientation
        deltaRotation.multiply(body.orientation); // w * q0 * dt * 0.5

        // Add delta to current orientation: q = q0 + delta
        body.orientation.x += deltaRotation.x;
        body.orientation.y += deltaRotation.y;
        body.orientation.z += deltaRotation.z;
        body.orientation.w += deltaRotation.w;

        // Re-normalize the quaternion to prevent drift
        body.orientation.normalize();


        // --- Clear accumulators ---
        body.force.set(0, 0, 0);
        body.torque.set(0, 0, 0);
    }

    /**
     * Calculates the inverse inertia tensor in world space.
     * I_world^-1 = R * I_body^-1 * R^T
     * Where R is the rotation matrix from the body's orientation.
     */
    private getWorldInverseInertiaTensor(body: PhysicsBody): THREE.Matrix3 {
        // Create a Matrix4 from the quaternion
        const rotationMatrix4 = new THREE.Matrix4();
        rotationMatrix4.makeRotationFromQuaternion(body.orientation);

        // Extract the rotation part into a Matrix3
        const R = new THREE.Matrix3();
        R.setFromMatrix4(rotationMatrix4);

        const RT = R.clone().transpose(); // R Transpose
        const I_body_inv = body.inertiaTensor; // Assuming inertiaTensor is already inverse

        // Compute R * I_body^-1
        const temp = R.clone().multiply(I_body_inv);
        // Compute (R * I_body^-1) * R^T
        const I_world_inv = temp.multiply(RT);

        return I_world_inv;
    }

    // --- Methods below are placeholders from the original file ---
    // --- They might be needed later or integrated differently ---

    public addPlayer(/* playerObject: THREE.Object3D, physicsProperties: any */): void {
        // This might involve creating and storing a PhysicsBody instance
        console.warn("PhysicsEngine.addPlayer is placeholder - player body should be managed externally.");
    }

    public addTerrainCollider(/* colliderData: any */): void {
        // Collision detection logic will need to be added here or managed externally
        console.warn("PhysicsEngine.addTerrainCollider is placeholder.");
    }

     public removeTerrainCollider(/* colliderData: any */): void {
        console.warn("PhysicsEngine.removeTerrainCollider is placeholder.");
    }
/**
     * Detects collision between the player and the terrain.
     * @param playerController The player controller instance.
     * @param terrainManager The terrain manager instance.
     * @param onCollision Callback function to execute when a collision occurs.
     */
    public detectCollisions(
        playerController: PlayerController,
        terrainManager: TerrainManager,
        onCollision: () => void
    ): void {
        const collisionThreshold = 1.5; // Small buffer to detect collision slightly before contact
        const playerBody = playerController.physicsBody; // Access public property
        const playerPosition = playerBody.position;

        // Get the terrain height directly below the player's current X, Z position
        const terrainHeight = terrainManager.getTerrainHeight(playerPosition.x, playerPosition.z);

        // Check if the player's Y position is below or very close to the terrain height
        if (playerPosition.y < terrainHeight + collisionThreshold) {
            // console.log(`Collision detected! Player Y: ${playerPosition.y.toFixed(2)}, Terrain Height: ${terrainHeight.toFixed(2)}`);
            onCollision(); // Execute the provided callback (e.g., reset player)
        }
    }
}