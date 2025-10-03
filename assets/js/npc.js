import * as THREE from "three";
import { BaseCharacter } from "./base-character.js";

export class NPCController extends BaseCharacter {
  constructor(scene) {
    super(scene);
    this.npcs = [];
    this.maxNPCs = 50;
    this.npcSpeed = 2.0;

    // City layout parameters
    this.cityConfig = {
      gridSize: 40,
      blockSize: 20,
      laneWidth: 1.5,
      streetSpacing: 3, // Streets every 3rd row/column
    };

    // Street network
    this.streetNetwork = [];
    this.spawnPoints = [];
    this.isNPCSystemInitialized = false;

    console.log("NPCController: Initialized");
  }

  async init() {
    try {
      console.log("NPCController: Starting initialization...");

      // Load character model and animations using BaseCharacter
      await this.loadCharacter();

      // Generate street network
      this.generateStreetNetwork();

      // Create spawn points
      this.generateSpawnPoints();

      // Spawn NPCs
      this.spawnAllNPCs();

      this.isNPCSystemInitialized = true;
      console.log("NPCController: Initialization complete");
    } catch (error) {
      console.error("NPCController: Initialization failed:", error);
    }
  }

  generateStreetNetwork() {
    this.streetNetwork = [];
    const { gridSize, blockSize, laneWidth, streetSpacing } = this.cityConfig;

    // Generate horizontal streets
    for (let z = 0; z < gridSize; z++) {
      if (z % streetSpacing === 1) {
        const streetZ = (z - gridSize / 2) * blockSize;

        for (
          let x = (-gridSize * blockSize) / 2;
          x <= (gridSize * blockSize) / 2;
          x += blockSize / 4
        ) {
          // Right lane (moving right)
          this.streetNetwork.push({
            x: x,
            y: 0,
            z: streetZ - laneWidth / 2,
            direction: "horizontal",
            lane: "right",
            moveDirection: new THREE.Vector3(1, 0, 0),
          });

          // Left lane (moving left)
          this.streetNetwork.push({
            x: x,
            y: 0,
            z: streetZ + laneWidth / 2,
            direction: "horizontal",
            lane: "left",
            moveDirection: new THREE.Vector3(-1, 0, 0),
          });
        }
      }
    }

    // Generate vertical streets
    for (let x = 0; x < gridSize; x++) {
      if (x % streetSpacing === 1) {
        const streetX = (x - gridSize / 2) * blockSize;

        for (
          let z = (-gridSize * blockSize) / 2;
          z <= (gridSize * blockSize) / 2;
          z += blockSize / 4
        ) {
          // Down lane (moving down)
          this.streetNetwork.push({
            x: streetX - laneWidth / 2,
            y: 0,
            z: z,
            direction: "vertical",
            lane: "down",
            moveDirection: new THREE.Vector3(0, 0, 1),
          });

          // Up lane (moving up)
          this.streetNetwork.push({
            x: streetX + laneWidth / 2,
            y: 0,
            z: z,
            direction: "vertical",
            lane: "up",
            moveDirection: new THREE.Vector3(0, 0, -1),
          });
        }
      }
    }

    console.log(
      `NPCController: Generated ${this.streetNetwork.length} street positions`
    );
  }

  generateSpawnPoints() {
    // Create spawn points from street network with better distribution
    this.spawnPoints = [];

    // Use more spawn points - every 2nd position instead of every 5th
    for (let i = 0; i < this.streetNetwork.length; i += 2) {
      this.spawnPoints.push(this.streetNetwork[i]);
    }

    // Add additional random points from the street network
    const additionalPoints = Math.min(100, this.streetNetwork.length);
    for (let i = 0; i < additionalPoints; i++) {
      const randomIndex = Math.floor(Math.random() * this.streetNetwork.length);
      const point = this.streetNetwork[randomIndex];
      // Avoid duplicates
      if (
        !this.spawnPoints.some(
          (sp) => Math.abs(sp.x - point.x) < 1 && Math.abs(sp.z - point.z) < 1
        )
      ) {
        this.spawnPoints.push(point);
      }
    }

    // Shuffle spawn points for randomness
    for (let i = this.spawnPoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnPoints[i], this.spawnPoints[j]] = [
        this.spawnPoints[j],
        this.spawnPoints[i],
      ];
    }

    console.log(
      `NPCController: Generated ${this.spawnPoints.length} spawn points from ${this.streetNetwork.length} street positions`
    );
  }

  spawnAllNPCs() {
    if (!this.characterMesh || this.spawnPoints.length === 0) {
      console.error(
        "NPCController: Cannot spawn NPCs - missing character mesh or spawn points"
      );
      return;
    }

    console.log(`NPCController: Spawning ${this.maxNPCs} NPCs from ${this.spawnPoints.length} available spawn points...`);

    // Ensure we have enough spawn points
    if (this.spawnPoints.length < this.maxNPCs) {
      console.warn(`NPCController: Only ${this.spawnPoints.length} spawn points available for ${this.maxNPCs} NPCs`);
    }

    for (let i = 0; i < this.maxNPCs; i++) {
      this.spawnNPC(i);
    }

    console.log(`NPCController: Successfully spawned ${this.npcs.length} NPCs`);
  }

  spawnNPC(index) {
    // Use modulo to cycle through spawn points if we have more NPCs than spawn points
    const spawnPoint = this.spawnPoints[index % this.spawnPoints.length];

    // Create NPC wrapper group (same structure as BaseCharacter)
    const npcModel = new THREE.Group();

    // Clone character mesh from BaseCharacter
    const npcMesh = this.characterMesh.clone();
    npcModel.add(npcMesh);

    // Use the same scaling as BaseCharacter (0.01)
    npcModel.scale.setScalar(0.01);
    
    // Add more random positioning variation
    const randomOffsetX = (Math.random() - 0.5) * 8; // Increased from 10 to 8
    const randomOffsetZ = (Math.random() - 0.5) * 4; // Decreased from 10 to 4
    
    npcModel.position.set(
      spawnPoint.x + randomOffsetX,
      spawnPoint.y,
      spawnPoint.z + randomOffsetZ
    );

    // Random scale variation (applied to the mesh inside the group, not the group itself)
    const scaleVariation = 0.8 + Math.random() * 0.4; // More variation: 0.8 to 1.2
    npcMesh.scale.setScalar(scaleVariation);

    // Setup animation mixer on the mesh (same as BaseCharacter)
    const npcMixer = new THREE.AnimationMixer(npcMesh);
    const npcActions = {};

    // Clone actions from the main character
    Object.keys(this.actions).forEach((actionName) => {
      const originalAction = this.actions[actionName];
      const clip = originalAction.getClip();
      npcActions[actionName] = npcMixer.clipAction(clip);
    });

    // Start with idle animation
    if (npcActions["Idle"]) {
      npcActions["Idle"].play();
    }

    // Generate random target point for movement
    const randomTargetIndex = Math.floor(Math.random() * this.spawnPoints.length);
    const targetPoint = this.spawnPoints[randomTargetIndex];

    // Setup NPC data with more varied speed
    npcModel.userData = {
      id: `npc_${index}`,
      mixer: npcMixer,
      actions: npcActions,
      currentAction: "Idle",
      speed: this.npcSpeed + (Math.random() - 0.5) * 2.0, // More speed variation
      currentStreetPoint: spawnPoint,
      targetPoint: targetPoint,
      moveDirection: new THREE.Vector3(
        targetPoint.x - spawnPoint.x,
        0,
        targetPoint.z - spawnPoint.z
      ).normalize(),
      characterMesh: npcMesh,
      lastTargetChange: 0, // Track when we last changed target
    };

    // Add to scene and track
    this.scene.add(npcModel);
    this.npcs.push(npcModel);

    console.log(
      `NPCController: Spawned NPC ${
        index + 1
      } at (${spawnPoint.x.toFixed(1)}, ${spawnPoint.z.toFixed(1)}) targeting (${targetPoint.x.toFixed(1)}, ${targetPoint.z.toFixed(1)})`
    );
  }

  update() {
    if (!this.isNPCSystemInitialized) return;

    const delta = this.clock.getDelta();

    // Update main character mixer (inherited from BaseCharacter)
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Update all NPCs
    this.npcs.forEach((npc) => {
      this.updateNPC(npc, delta);
    });
  }

  updateNPC(npc, delta) {
    const userData = npc.userData;
    if (!userData) return;

    // Update animation mixer
    if (userData.mixer) {
      userData.mixer.update(delta);
    }

    // Simple movement along street direction
    const moveDistance = userData.speed * delta;
    const movement = userData.moveDirection
      .clone()
      .multiplyScalar(moveDistance);
    npc.position.add(movement);

    // Rotate to face movement direction
    if (userData.moveDirection.length() > 0) {
      const angle = Math.atan2(
        userData.moveDirection.x,
        userData.moveDirection.z
      );
      npc.rotation.y = angle;

      // Switch to walk animation if not already - use "Walk" instead of "Standard Walk"
      if (userData.currentAction !== "Walk" && userData.actions["Walk"]) {
        this.switchNPCAction(npc, "Walk");
      }
    }

    // Simple boundary check - wrap around city
    const cityBounds = 400; // Half of city size
    if (
      Math.abs(npc.position.x) > cityBounds ||
      Math.abs(npc.position.z) > cityBounds
    ) {
      // Respawn at a random spawn point
      const newSpawnPoint =
        this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      npc.position.set(newSpawnPoint.x, newSpawnPoint.y, newSpawnPoint.z);
      userData.currentStreetPoint = newSpawnPoint;
      userData.moveDirection = newSpawnPoint.moveDirection.clone();
    }
  }

  switchNPCAction(npc, actionName) {
    const userData = npc.userData;
    if (!userData.actions || !userData.actions[actionName]) return;

    // Fade out current action
    if (userData.currentAction && userData.actions[userData.currentAction]) {
      userData.actions[userData.currentAction].fadeOut(0.3);
    }

    // Fade in new action
    userData.actions[actionName].reset().fadeIn(0.3).play();
    userData.currentAction = actionName;
  }

  getNPCs() {
    return this.npcs;
  }

  dispose() {
    // Clean up all NPCs
    this.npcs.forEach((npc) => {
      if (npc.userData.mixer) {
        npc.userData.mixer.stopAllAction();
      }
      if (npc.parent) {
        npc.parent.remove(npc);
      }
    });

    this.npcs = [];
    this.isNPCSystemInitialized = false;

    // Call parent dispose if needed
    if (super.dispose) {
      super.dispose();
    }

    console.log("NPCController: Disposed");
  }
}
