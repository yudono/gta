import * as THREE from "three";
import { BaseCharacter } from "./base-character.js";

export class PlayerController extends BaseCharacter {
  constructor(scene) {
    super(scene);
    // City bounds used for random spawn
    this.cityBounds = { minX: -250, maxX: 250, minZ: -250, maxZ: 250 };
    // NPC collision handling
    this.npcController = null;
    this.npcCollisionRadius = 1.5;
    this.init();
  }

  async init() {
    await this.loadCharacter();
    // Spawn player at a random ground position avoiding buildings
    const spawn = this.getRandomGroundPosition();
    this.model.position.set(spawn.x, 0, spawn.z);
    console.log(
      `Player spawned at (${this.model.position.x.toFixed(
        1
      )}, ${this.model.position.z.toFixed(1)})`
    );
  }

  setNPCController(npcController) {
    this.npcController = npcController;
  }

  collidesWithNPCs(pos) {
    if (!this.npcController || !this.npcController.npcs) return false;
    const r = this.npcCollisionRadius;
    for (const npc of this.npcController.npcs) {
      const d = Math.hypot(npc.position.x - pos.x, npc.position.z - pos.z);
      if (d < r) return true;
    }
    return false;
  }

  getRandomGroundPosition() {
    const { minX, maxX, minZ, maxZ } = this.cityBounds;
    for (let i = 0; i < 50; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const z = minZ + Math.random() * (maxZ - minZ);
      const pos = new THREE.Vector3(x, 0, z);
      if (!this.checkCollision(pos)) {
        return { x, z };
      }
    }
    // Fallback if unable to find a non-colliding position
    return { x: minX + 10, z: minZ + 10 };
  }

  update(input) {
    if (!this.model) return;

    const delta = this.clock.getDelta();

    const rotationSpeed = 3.0 * delta;
    // Adjust move speed based on whether player is running
    const baseSpeed = input.isRunning ? 8 : 3;
    const moveSpeed = baseSpeed * delta;
    let isMoving = false;

    // Handle left/right rotation with A/D keys - rotate the wrapper group
    if (input.left) {
      this.model.rotation.y += rotationSpeed;
    }
    if (input.right) {
      this.model.rotation.y -= rotationSpeed;
    }

    // Calculate forward direction based on wrapper group rotation
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y);
    forward.normalize();

    // Store current position for collision checking
    const currentPosition = this.model.position.clone();

    // Handle forward/backward movement with W/S keys WITH collision detection
    if (input.forward) {
      const newPosition = currentPosition
        .clone()
        .add(forward.clone().multiplyScalar(moveSpeed));

      // Check collision before moving (buildings + NPCs)
      if (!this.checkCollision(newPosition) && !this.collidesWithNPCs(newPosition)) {
        this.model.position.copy(newPosition);
        isMoving = true;
      } else {
        console.log("Forward movement blocked by collision");
      }
    }

    if (input.backward) {
      const newPosition = currentPosition
        .clone()
        .add(forward.clone().multiplyScalar(-moveSpeed));

      // Check collision before moving (buildings + NPCs)
      if (!this.checkCollision(newPosition) && !this.collidesWithNPCs(newPosition)) {
        this.model.position.copy(newPosition);
        isMoving = true;
      } else {
        console.log("Backward movement blocked by collision");
      }
    }

    // Keep player on ground level
    this.model.position.y = 0;

    // Switch animation based on movement and running state
    if (isMoving) {
      if (input.isRunning && input.forward && this.actions["Running"]) {
        this.switchAction("Running");
      } else {
        this.switchAction("Walk");
      }
    } else {
      this.switchAction("Idle");
    }

    // Update mixer AFTER rotation and movement to prevent override
    this.updateMixer(delta);
  }
}
