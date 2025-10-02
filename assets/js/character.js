import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

export class CharacterController {
  constructor(scene) {
    this.scene = scene;
    this.loader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.activeAction = null;
    this.clock = new THREE.Clock();
    this.buildings = []; // Store buildings for collision detection
    this.characterRadius = 2; // Character collision radius

    // Movement properties
    this.moveSpeed = 150;
    this.rotationSpeed = 3;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.init();
  }

  async init() {
    await this.loadCharacter();
  }

  async loadCharacter() {
    try {
      // Load the character model
      const fbxLoader = new FBXLoader();
      const characterMesh = await new Promise((resolve, reject) => {
        fbxLoader.load(
          "assets/models/rp_eric_rigged_001_u3d.fbx",
          resolve,
          undefined,
          reject
        );
      });

      // Create a wrapper group for the character
      this.model = new THREE.Group();
      this.characterMesh = characterMesh;
      this.model.add(this.characterMesh);

      // Scale and position the wrapper group
      this.model.scale.setScalar(0.01); // 10x smaller character (0.1 / 10 = 0.01)
      this.model.position.set(0, 0, 0);

      // Load and apply textures
      const textureLoader = new THREE.TextureLoader();

      // Load all textures
      const diffuseTexture = await new Promise((resolve, reject) => {
        textureLoader.load(
          "assets/textures/rp_eric_rigged_001_dif.jpg",
          resolve,
          undefined,
          reject
        );
      });

      const normalTexture = await new Promise((resolve, reject) => {
        textureLoader.load(
          "assets/textures/rp_eric_rigged_001_norm.jpg",
          resolve,
          undefined,
          reject
        );
      });

      const glossTexture = await new Promise((resolve, reject) => {
        textureLoader.load(
          "assets/textures/rp_eric_rigged_001_gloss.jpg",
          resolve,
          undefined,
          reject
        );
      });

      // Apply textures to all materials
      this.characterMesh.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshLambertMaterial({
            map: diffuseTexture,
            normalMap: normalTexture,
            // Use gloss texture for roughness (inverted)
            roughnessMap: glossTexture,
            roughness: 0.8,
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Add wrapper group to scene
      this.scene.add(this.model);

      // Setup animation mixer on the character mesh, not the wrapper group
      this.mixer = new THREE.AnimationMixer(this.characterMesh);
      this.actions = {};

      // Check if the model has built-in animations
      if (
        this.characterMesh.animations &&
        this.characterMesh.animations.length > 0
      ) {
        // Filter out rotation tracks from built-in animations
        const builtInClip = this.characterMesh.animations[0].clone();
        builtInClip.name = "Idle";
        builtInClip.tracks = builtInClip.tracks.filter(
          (track) =>
            !track.name.includes(".position") &&
            !track.name.includes(".rotation")
        );

        this.actions["Idle"] = this.mixer.clipAction(builtInClip);
        this.actions["Idle"].play();
        this.activeAction = this.actions["Idle"];
      }

      // Load external animations
      await this.loadExternalAnimations();

      // Start with idle animation if available
      if (this.actions["Idle"]) {
        this.activeAction = this.actions["Idle"];
        this.activeAction.play();
      }

      console.log("Character loaded successfully with wrapper group");
    } catch (error) {
      console.error("Error loading character:", error);
    }
  }

  async loadExternalAnimations() {
    const fbxLoader = new FBXLoader();

    try {
      // Load Idle animation
      const idleAnimation = await new Promise((resolve, reject) => {
        fbxLoader.load(
          "assets/animations/Idle.fbx",
          resolve,
          undefined,
          reject
        );
      });

      if (idleAnimation.animations && idleAnimation.animations.length > 0) {
        const idleClip = idleAnimation.animations[0];
        idleClip.name = "Idle";

        // Filter out position and rotation tracks to prevent character reset and rotation interference
        idleClip.tracks = idleClip.tracks.filter(
          (track) =>
            !track.name.includes(".position") &&
            !track.name.includes(".rotation")
        );

        const idleAction = this.mixer.clipAction(idleClip);
        this.actions["Idle"] = idleAction;
      }

      // Load Walk animation
      const walkAnimation = await new Promise((resolve, reject) => {
        fbxLoader.load(
          "assets/animations/Walk.fbx",
          resolve,
          undefined,
          reject
        );
      });

      if (walkAnimation.animations && walkAnimation.animations.length > 0) {
        const walkClip = walkAnimation.animations[0];
        walkClip.name = "Walk";

        // Filter out position and rotation tracks to prevent sliding and rotation interference
        walkClip.tracks = walkClip.tracks.filter(
          (track) =>
            !track.name.includes(".position") &&
            !track.name.includes(".rotation")
        );

        const walkAction = this.mixer.clipAction(walkClip);
        this.actions["Walk"] = walkAction;
      }

      console.log("External animations loaded:", Object.keys(this.actions));
    } catch (error) {
      console.error("Error loading external animations:", error);
    }
  }

  switchAction(name) {
    const newAction = this.actions[name];
    if (!newAction || this.activeAction === newAction) return;

    newAction.reset().fadeIn(0.3).play();
    if (this.activeAction) {
      this.activeAction.fadeOut(0.3);
    }

    this.activeAction = newAction;
  }

  // Method to set buildings for collision detection
  setBuildings(buildings) {
    this.buildings = buildings;
  }

  // Check collision with buildings
  checkCollision(newPosition) {
    for (let building of this.buildings) {
      // Calculate distance from character to building center
      const dx = newPosition.x - building.x;
      const dz = newPosition.z - building.z;

      // Check if character is within building bounds (with some padding)
      const halfWidth = building.width / 2 + this.characterRadius;
      const halfDepth = building.depth / 2 + this.characterRadius;

      if (Math.abs(dx) < halfWidth && Math.abs(dz) < halfDepth) {
        console.log(
          "Collision with building at:",
          building.x,
          building.z,
          "Character at:",
          newPosition.x,
          newPosition.z
        );
        console.log(
          "Building size:",
          building.width,
          "x",
          building.depth,
          "Character radius:",
          this.characterRadius
        );
        return true; // Collision detected
      }
    }
    return false; // No collision
  }

  update(input) {
    if (!this.model) return;

    const delta = this.clock.getDelta();

    const rotationSpeed = 3.0 * delta;
    const moveSpeed = 15 * delta;
    let isMoving = false;

    // Handle left/right rotation with A/D keys - rotate the wrapper group
    if (input.left) {
      this.model.rotation.y += rotationSpeed;
      console.log("Rotating left, new rotation:", this.model.rotation.y);
    }
    if (input.right) {
      this.model.rotation.y -= rotationSpeed;
      console.log("Rotating right, new rotation:", this.model.rotation.y);
    }

    // Calculate forward direction based on wrapper group rotation
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y);
    forward.normalize();

    // Handle forward/backward movement with W/S keys (collision disabled temporarily)
    if (input.forward) {
      this.model.position.add(forward.clone().multiplyScalar(moveSpeed));
      isMoving = true;
    }
    if (input.backward) {
      this.model.position.add(forward.clone().multiplyScalar(-moveSpeed));
      isMoving = true;
    }

    // Keep character on ground level
    this.model.position.y = 0;

    // Switch animation based on movement
    this.switchAction(isMoving ? "Walk" : "Idle");

    // Update mixer AFTER rotation and movement to prevent override
    if (this.mixer) this.mixer.update(delta);
  }

  getModel() {
    return this.model;
  }

  getPosition() {
    return this.model ? this.model.position : new THREE.Vector3();
  }

  getRotation() {
    return this.model ? this.model.rotation : new THREE.Euler();
  }
}
