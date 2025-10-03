import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

export class BaseCharacter {
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

    // Character mesh reference
    this.characterMesh = null;
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
      await this.loadTextures();

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

  async loadTextures() {
    const textureLoader = new THREE.TextureLoader();

    try {
      // Load all textures
      const diffuseTexture = await new Promise((resolve, reject) => {
        textureLoader.load(
          "assets/textures/person/rp_eric_rigged_001_dif.jpg",
          resolve,
          undefined,
          reject
        );
      });

      const normalTexture = await new Promise((resolve, reject) => {
        textureLoader.load(
          "assets/textures/person/rp_eric_rigged_001_norm.jpg",
          resolve,
          undefined,
          reject
        );
      });

      const glossTexture = await new Promise((resolve, reject) => {
        textureLoader.load(
          "assets/textures/person/rp_eric_rigged_001_gloss.jpg",
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
    } catch (error) {
      console.error("Error loading textures:", error);
      // Apply default material if textures fail to load
      this.characterMesh.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshLambertMaterial({ color: 0x888888 });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }

  async loadExternalAnimations() {
    const fbxLoader = new FBXLoader();

    // Load Idle animation
    try {
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
        console.log("Idle animation loaded successfully");
      }
    } catch (error) {
      console.error("Error loading Idle animation:", error);
    }

    // Load Walk animation
    try {
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
        console.log("Walk animation loaded successfully");
      }
    } catch (error) {
      console.error("Error loading Walk animation:", error);
    }

    // Load Running animation
    try {
      const runningAnimation = await new Promise((resolve, reject) => {
        fbxLoader.load(
          "assets/animations/Running.fbx",
          resolve,
          undefined,
          reject
        );
      });

      if (
        runningAnimation.animations &&
        runningAnimation.animations.length > 0
      ) {
        const runningClip = runningAnimation.animations[0];
        runningClip.name = "Running";

        // Filter out position and rotation tracks to prevent sliding and rotation interference
        runningClip.tracks = runningClip.tracks.filter(
          (track) =>
            !track.name.includes(".position") &&
            !track.name.includes(".rotation")
        );

        const runningAction = this.mixer.clipAction(runningClip);
        this.actions["Running"] = runningAction;
        console.log("Running animation loaded successfully");
      }
    } catch (error) {
      console.error("Error loading Running animation:", error);
      console.log("Running animation will be disabled, using Walk instead");
    }

    console.log("External animations loaded:", Object.keys(this.actions));
  }

  switchAction(name) {
    const newAction = this.actions[name];
    console.log(
      `Switching to animation: ${name}`,
      newAction ? "found" : "not found"
    );

    if (!newAction) {
      console.warn(
        `Animation '${name}' not found. Available animations:`,
        Object.keys(this.actions)
      );
      return;
    }

    if (this.activeAction === newAction) return;

    newAction.reset().fadeIn(0.3).play();
    if (this.activeAction) {
      this.activeAction.fadeOut(0.3);
    }

    this.activeAction = newAction;
    console.log(`Active animation switched to: ${name}`);
  }

  // Method to set buildings for collision detection
  setBuildings(buildings) {
    this.buildings = buildings;
  }

  // Check collision with buildings
  checkCollision(newPosition) {
    if (!this.buildings || this.buildings.length === 0) {
      return false; // No buildings to check collision with
    }

    for (let building of this.buildings) {
      // Skip if building doesn't have required properties
      if (!building.x || !building.z || !building.width || !building.depth) {
        continue;
      }

      // Calculate distance from character to building center
      const dx = newPosition.x - building.x;
      const dz = newPosition.z - building.z;

      // Check if character is within building bounds (with character radius padding)
      const halfWidth = building.width / 2 + this.characterRadius;
      const halfDepth = building.depth / 2 + this.characterRadius;

      // Use AABB (Axis-Aligned Bounding Box) collision detection
      if (Math.abs(dx) < halfWidth && Math.abs(dz) < halfDepth) {
        // Additional check: calculate the overlap to provide better collision response
        const overlapX = halfWidth - Math.abs(dx);
        const overlapZ = halfDepth - Math.abs(dz);

        console.log(
          `Collision detected with building at (${building.x}, ${building.z})`,
          `Character at (${newPosition.x.toFixed(2)}, ${newPosition.z.toFixed(
            2
          )})`,
          `Overlap: X=${overlapX.toFixed(2)}, Z=${overlapZ.toFixed(2)}`
        );

        return true; // Collision detected
      }
    }
    return false; // No collision
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

  // Update mixer - should be called in subclass update methods
  updateMixer(delta) {
    if (this.mixer) this.mixer.update(delta);
  }
}