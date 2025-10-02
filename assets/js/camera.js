import * as THREE from "three";

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.target = null;
    this.offset = new THREE.Vector3(0, 6, -6.67); // Height reduced 50% (12->6) and zoom in 1.5x (-10/-1.5=-6.67)
    this.lookAtOffset = new THREE.Vector3(0, 3, 0); // Look at position also reduced 50% (6->3)
    this.lerpSpeed = 0.1; // Slightly faster camera movement
    this.cameraRotation = { x: 0, y: 0 }; // For manual camera control
  }

  setTarget(target) {
    this.target = target;
  }

  update(input = {}) {
    if (!this.target) return;

    // Handle camera rotation with arrow keys
    const rotationSpeed = 0.02;
    if (input.arrowUp)
      this.cameraRotation.x = Math.max(
        this.cameraRotation.x - rotationSpeed,
        -Math.PI / 3
      );
    if (input.arrowDown)
      this.cameraRotation.x = Math.min(
        this.cameraRotation.x + rotationSpeed,
        Math.PI / 6
      );
    if (input.arrowLeft) this.cameraRotation.y += rotationSpeed;
    if (input.arrowRight) this.cameraRotation.y -= rotationSpeed;

    // Calculate camera position based on target rotation and manual camera rotation
    let rotatedOffset = this.offset.clone();

    // Apply manual camera rotation
    rotatedOffset.applyAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.cameraRotation.x
    );
    rotatedOffset.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.target.rotation.y + this.cameraRotation.y
    );

    const targetPosition = this.target.position.clone().add(rotatedOffset);

    // Smoothly move camera to target position
    this.camera.position.lerp(targetPosition, this.lerpSpeed);

    // Look at target with offset
    const lookAtPosition = this.target.position.clone().add(this.lookAtOffset);
    this.camera.lookAt(lookAtPosition);
  }

  setOffset(x, y, z) {
    this.offset.set(x, y, z);
  }

  setLookAtOffset(x, y, z) {
    this.lookAtOffset.set(x, y, z);
  }

  setLerpSpeed(speed) {
    this.lerpSpeed = speed;
  }
}
