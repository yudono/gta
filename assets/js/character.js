import * as THREE from "three";
import { BaseCharacter } from "./base-character.js";

export class CharacterController extends BaseCharacter {
  constructor(scene) {
    super(scene);
    this.init();
  }

  async init() {
    await this.loadCharacter();
  }

  update(input) {
    if (!this.model) return;

    const delta = this.clock.getDelta();

    const rotationSpeed = 3.0 * delta;
    // Adjust move speed based on whether character is running
    const baseSpeed = input.isRunning ? 8 : 3; // Running is significantly faster than walking
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

      // Check collision before moving
      if (!this.checkCollision(newPosition)) {
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

      // Check collision before moving
      if (!this.checkCollision(newPosition)) {
        this.model.position.copy(newPosition);
        isMoving = true;
      } else {
        console.log("Backward movement blocked by collision");
      }
    }

    // Keep character on ground level
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
