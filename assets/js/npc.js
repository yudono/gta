import * as THREE from "three";
import { BaseCharacter } from "./base-character.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

// NPCs that roam the street network similar to cars
export class NonPlayableCharacter extends BaseCharacter {
  constructor(scene) {
    super(scene);
    this.npcs = [];
    this.count = 100;
    this.isInitialized = false;

    // Street movement props (aligned with CarController)
    this.streets = [];
    this.intersections = [];
    this.laneWidth = 1.2;
    this.walkSpeed = 3.0; // match player walk speed
    this.runSpeed = 8.0; // match player run speed
    this.idleRatio = 1.0; // all NPCs idle by default
    // Spawn control near player
    this.spawnRadius = 40; // spawn NPCs within this radius around player
    this.minSpawnSpacing = 5.0; // wider spacing between NPC spawns
    this.spawnAvoidPlayerRadius = 10.0; // avoid spawning too close to player
    this.playerModel = null; // set by setPlayer
    // Track lanes already used for spawning to avoid clustering on one path
    this.usedSpawnStreetIds = new Set();
    // Track lanes occupied by any NPC to prefer unique movement paths
    this.occupiedStreetIds = new Set();
    // Follow behavior radii (tripled for stronger engagement)
    this.followStartRadius = 60; // general follow range threshold
    this.runRadius = 12; // decreased run radius for more walking when near
    this.stopFollowRadius = 90; // stop following when player is very far
    this.playerStopRadius = 3.0; // stop and idle when too close to player
    // Separation to maintain spacing
    this.npcAvoidRadius = 2.5;
    this.npcAvoidStrength = 0.6;
    this.playerAvoidStrength = 0.8; // how strongly NPC avoids the player when close
  }

  setBuildings(buildings) {
    super.setBuildings(buildings);
  }

  // Allow spawning near player by providing player's model
  setPlayer(playerModel) {
    this.playerModel = playerModel;
  }

  async init() {
    await this.loadCharacter();
    // Hide the template character; we only use it to clone meshes/animations
    if (this.model) this.model.visible = false;
    console.log("NPC: template character loaded and hidden");

    // Build street lanes and intersections to walk on
    this.generateStreetNetwork();
    // Spawn only after player is available to keep proximity
    if (!this.playerModel) {
      console.warn("NPC: player not set yet, delaying spawn...");
      setTimeout(() => this.spawnAll(), 200);
    } else {
      this.spawnAll();
    }
    this.isInitialized = true;
  }

  generateStreetNetwork() {
    // Mirror car.js lane network so NPCs share streets
    const gridSize = 40;
    const blockSize = 15;
    this.streets = [];
    this.intersections = [];
    const sidewalkOffset = this.laneWidth * 4.0; // stronger offset: keep NPCs off car lanes

    // Horizontal streets
    for (let z = 0; z < gridSize; z++) {
      if (z % 3 === 1) {
        const streetZ = (z - gridSize / 2) * blockSize;
        // Sidewalk lanes (offset from car lanes)
        this.streets.push({
          id: `h_${z}_right_sw`,
          start: {
            x: (-gridSize * blockSize) / 2,
            z: streetZ - sidewalkOffset,
          },
          end: {
            x: (gridSize * blockSize) / 2,
            z: streetZ - sidewalkOffset,
          },
          direction: "horizontal",
          lane: "right_sw",
        });
        this.streets.push({
          id: `h_${z}_left_sw`,
          start: {
            x: (gridSize * blockSize) / 2,
            z: streetZ + sidewalkOffset,
          },
          end: {
            x: (-gridSize * blockSize) / 2,
            z: streetZ + sidewalkOffset,
          },
          direction: "horizontal",
          lane: "left_sw",
        });
      }
    }

    // Vertical streets
    for (let x = 0; x < gridSize; x++) {
      if (x % 3 === 1) {
        const streetX = (x - gridSize / 2) * blockSize;
        // Sidewalk lanes (offset from car lanes)
        this.streets.push({
          id: `v_${x}_down_sw`,
          start: {
            x: streetX - sidewalkOffset,
            z: (-gridSize * blockSize) / 2,
          },
          end: {
            x: streetX - sidewalkOffset,
            z: (gridSize * blockSize) / 2,
          },
          direction: "vertical",
          lane: "down_sw",
        });
        this.streets.push({
          id: `v_${x}_up_sw`,
          start: {
            x: streetX + sidewalkOffset,
            z: (gridSize * blockSize) / 2,
          },
          end: {
            x: streetX + sidewalkOffset,
            z: (-gridSize * blockSize) / 2,
          },
          direction: "vertical",
          lane: "up_sw",
        });
      }
    }

    // Intersections
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        if (x % 3 === 1 && z % 3 === 1) {
          const intersectionX = (x - gridSize / 2) * blockSize;
          const intersectionZ = (z - gridSize / 2) * blockSize;
          this.intersections.push({
            x: intersectionX,
            z: intersectionZ,
            connectedStreets: this.getConnectedStreets(
              intersectionX,
              intersectionZ
            ),
          });
        }
      }
    }
  }

  getConnectedStreets(x, z) {
    const tolerance = 8; // wider to include sidewalk offsets
    const connected = [];
    this.streets.forEach((street) => {
      if (street.direction === "horizontal") {
        if (
          Math.abs(street.start.z - z) < tolerance &&
          street.start.x <= x &&
          street.end.x >= x
        ) {
          connected.push(street.id);
        }
      } else {
        if (
          Math.abs(street.start.x - x) < tolerance &&
          street.start.z <= z &&
          street.end.z >= z
        ) {
          connected.push(street.id);
        }
      }
    });
    return connected;
  }

  // Get streets within a radius around the player's position
  getNearbyStreets(center, radius) {
    if (!center) return this.streets;
    const nearby = [];
    for (const street of this.streets) {
      if (street.direction === "horizontal") {
        const dz = Math.abs(street.start.z - center.z);
        if (dz <= radius) nearby.push(street);
      } else {
        const dx = Math.abs(street.start.x - center.x);
        if (dx <= radius) nearby.push(street);
      }
    }
    return nearby.length > 0 ? nearby : this.streets;
  }

  spawnAll() {
    console.log(`NPC: spawning ${this.count} walkers on streets...`);
    for (let i = 0; i < this.count; i++) {
      this.spawnNPC(i);
    }
    console.log(`NPC: Spawned ${this.npcs.length} street walkers`);
  }

  spawnNPC(index) {
    if (this.streets.length === 0) return;
    const npcGroup = new THREE.Group();
    npcGroup.name = `StreetNPC_${index}`;

    const npcMesh = cloneSkeleton(this.characterMesh);
    npcGroup.add(npcMesh);
    npcGroup.scale.setScalar(0.01);

    npcMesh.traverse((child) => {
      if (child.isMesh) {
        child.visible = true;
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Choose a street near player and place within radius window along the street
    const playerPos = this.playerModel ? this.playerModel.position : null;
    const candidateStreets = this.getNearbyStreets(playerPos, this.spawnRadius);
    // Prefer nearby streets that haven't been used yet AND are not occupied by other NPCs
    let availableNearby = candidateStreets.filter(
      (s) =>
        !this.usedSpawnStreetIds.has(s.id) && !this.occupiedStreetIds.has(s.id)
    );
    // Fallback to any unoccupied nearby street
    if (availableNearby.length === 0) {
      availableNearby = candidateStreets.filter(
        (s) => !this.occupiedStreetIds.has(s.id)
      );
    }
    // Final fallback: allow reuse when all lanes are occupied
    if (availableNearby.length === 0) {
      this.usedSpawnStreetIds.clear();
      availableNearby = candidateStreets;
    }
    const street =
      availableNearby[Math.floor(Math.random() * availableNearby.length)];
    this.usedSpawnStreetIds.add(street.id);

    let attempts = 0;
    let validPosition = false;
    let targetX = 0;
    let targetZ = 0;
    const startX = street.start.x;
    const endX = street.end.x;
    const startZ = street.start.z;
    const endZ = street.end.z;
    const lenX = endX - startX;
    const lenZ = endZ - startZ;

    while (!validPosition && attempts < 20) {
      if (street.direction === "horizontal") {
        const minX = playerPos
          ? Math.max(startX, playerPos.x - this.spawnRadius)
          : startX;
        const maxX = playerPos
          ? Math.min(endX, playerPos.x + this.spawnRadius)
          : endX;
        targetX = minX + Math.random() * Math.max(1, maxX - minX);
        targetZ = startZ; // lane z is constant
      } else {
        const minZ = playerPos
          ? Math.max(startZ, playerPos.z - this.spawnRadius)
          : startZ;
        const maxZ = playerPos
          ? Math.min(endZ, playerPos.z + this.spawnRadius)
          : endZ;
        targetZ = minZ + Math.random() * Math.max(1, maxZ - minZ);
        targetX = startX; // lane x is constant
      }

      // spacing against existing NPCs
      validPosition = true;
      for (const existing of this.npcs) {
        const d = Math.hypot(
          existing.position.x - targetX,
          existing.position.z - targetZ
        );
        if (d < this.minSpawnSpacing) {
          validPosition = false;
          break;
        }
      }

      // avoid spawning too close to player
      if (validPosition && playerPos) {
        const dp = Math.hypot(playerPos.x - targetX, playerPos.z - targetZ);
        if (dp < this.spawnAvoidPlayerRadius) {
          validPosition = false;
        }
      }

      // optional building collision check
      if (
        validPosition &&
        this.checkCollision(new THREE.Vector3(targetX, 0, targetZ))
      ) {
        validPosition = false;
      }
      attempts++;
    }
    if (!validPosition) return;

    npcGroup.position.set(targetX, 0, targetZ);

    // Face along street (initial idle orientation)
    if (street.direction === "horizontal") {
      npcGroup.rotation.y = street.lane.includes("right")
        ? Math.PI / 2
        : -Math.PI / 2;
    } else {
      npcGroup.rotation.y = street.lane.includes("down") ? Math.PI : 0;
    }

    // Mixer and actions
    const mixer = new THREE.AnimationMixer(npcMesh);
    const actions = {};
    Object.keys(this.actions || {}).forEach((name) => {
      const clip = this.actions[name].getClip();
      actions[name] = mixer.clipAction(clip);
    });

    // Decide idle vs moving for this NPC
    const isIdle = true; // all NPCs idle at spawn
    let started = "Idle";
    if (actions["Idle"]) {
      actions["Idle"].play();
    }

    npcGroup.userData = {
      mixer,
      actions,
      currentAction: started,
      speed: 0,
      currentStreet: street,
      progress:
        street.direction === "horizontal"
          ? (targetX - startX) / (lenX || 1)
          : (targetZ - startZ) / (lenZ || 1),
      isAtIntersection: false,
      turnCooldown: 0,
      mode: "idle", // idle | follow | walk_street (future)
      lastPos: { x: targetX, z: targetZ },
    };

    // Mark this street as occupied by an NPC
    this.occupiedStreetIds.add(street.id);

    // Optional: small marker for quick visual confirmation
    const markerGeom = new THREE.SphereGeometry(0.8, 12, 12);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.position.set(0, 6, 0);
    npcGroup.add(marker);

    this.scene.add(npcGroup);
    this.npcs.push(npcGroup);
  }

  update() {
    if (!this.isInitialized || this.npcs.length === 0) return;

    const delta = this.clock.getDelta();
    const playerPos = this.playerModel ? this.playerModel.position : null;

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];
      const userData = npc.userData;
      if (!userData || !userData.currentStreet) continue;

      if (userData.mixer) userData.mixer.update(delta);

      // Update behavior based on player proximity
      if (playerPos) {
        const dx = playerPos.x - npc.position.x;
        const dz = playerPos.z - npc.position.z;
        const distToPlayer = Math.hypot(dx, dz);
        // Stop and idle if inside stop radius
        if (distToPlayer <= this.playerStopRadius) {
          if (userData.mode !== "idle") {
            userData.mode = "idle";
            userData.speed = 0;
            if (userData.actions["Idle"]) {
              this.switchNPCAction(npc, "Idle");
            }
          }
        } else if (distToPlayer <= this.runRadius) {
          // Near the player: walk
          if (userData.mode !== "follow") userData.mode = "follow";
          userData.speed = this.walkSpeed;
          if (
            userData.currentAction !== "Standard Walk" &&
            userData.currentAction !== "Walk"
          ) {
            if (userData.actions["Standard Walk"]) {
              this.switchNPCAction(npc, "Standard Walk");
            } else if (userData.actions["Walk"]) {
              this.switchNPCAction(npc, "Walk");
            }
          }
        } else if (distToPlayer <= this.stopFollowRadius) {
          // Farther away but within follow range: run
          if (userData.mode !== "follow") userData.mode = "follow";
          userData.speed = this.runSpeed;
          if (userData.currentAction !== "Running") {
            if (userData.actions["Running"]) {
              this.switchNPCAction(npc, "Running");
            } else if (userData.actions["Standard Walk"]) {
              this.switchNPCAction(npc, "Standard Walk");
            } else if (userData.actions["Walk"]) {
              this.switchNPCAction(npc, "Walk");
            }
          }
        } else {
          // Too far: stop following and idle
          if (userData.mode !== "idle") {
            userData.mode = "idle";
            userData.speed = 0;
            if (userData.actions["Idle"]) this.switchNPCAction(npc, "Idle");
          }
        }
      }

      // Movement handling based on mode
      if (userData.mode === "follow" && playerPos) {
        // Desired direction to player
        let dirX = playerPos.x - npc.position.x;
        let dirZ = playerPos.z - npc.position.z;
        const len = Math.hypot(dirX, dirZ) || 1;
        dirX /= len;
        dirZ /= len;

        // Separation from nearby NPCs
        let sepX = 0;
        let sepZ = 0;
        for (let j = 0; j < this.npcs.length; j++) {
          if (j === i) continue;
          const other = this.npcs[j];
          const ox = npc.position.x - other.position.x;
          const oz = npc.position.z - other.position.z;
          const d = Math.hypot(ox, oz);
          if (d > 0 && d < this.npcAvoidRadius) {
            const factor = (this.npcAvoidRadius - d) / this.npcAvoidRadius;
            sepX += (ox / d) * factor;
            sepZ += (oz / d) * factor;
          }
        }
        dirX += sepX * this.npcAvoidStrength;
        dirZ += sepZ * this.npcAvoidStrength;
        // Separation from player to keep space
        const pd = Math.hypot(
          playerPos.x - npc.position.x,
          playerPos.z - npc.position.z
        );
        if (pd > 0 && pd < this.followStartRadius) {
          const px = npc.position.x - playerPos.x;
          const pz = npc.position.z - playerPos.z;
          const factorP = Math.max(
            0,
            (this.playerStopRadius + 1 - pd) / (this.playerStopRadius + 1)
          );
          const nx = px / pd;
          const nz = pz / pd;
          dirX += nx * factorP * this.playerAvoidStrength;
          dirZ += nz * factorP * this.playerAvoidStrength;
        }
        const dLen = Math.hypot(dirX, dirZ) || 1;
        dirX /= dLen;
        dirZ /= dLen;

        // Move towards player with separation, respecting stop radius
        let moveScale = userData.speed * delta * 0.5; // tuned factor
        const nextX = npc.position.x + dirX * moveScale;
        const nextZ = npc.position.z + dirZ * moveScale;
        // Prevent entering player's stop radius
        const nextDistPlayer = Math.hypot(
          playerPos.x - nextX,
          playerPos.z - nextZ
        );
        if (nextDistPlayer < this.playerStopRadius) {
          moveScale = 0;
          if (userData.mode !== "idle") {
            userData.mode = "idle";
            userData.speed = 0;
            if (userData.actions["Idle"]) this.switchNPCAction(npc, "Idle");
          }
        }
        // Prevent collisions with other NPCs (simple radius check)
        for (let j = 0; j < this.npcs.length && moveScale > 0; j++) {
          if (j === i) continue;
          const other = this.npcs[j];
          const nd = Math.hypot(
            other.position.x - nextX,
            other.position.z - nextZ
          );
          if (nd < this.npcAvoidRadius * 0.9) {
            moveScale *= 0.2; // slow down sharply to avoid overlap
            break;
          }
        }
        npc.position.x += dirX * moveScale;
        npc.position.z += dirZ * moveScale;

        // If the NPC effectively stops while in follow mode, ensure Idle animation
        if (
          moveScale <= 0.001 &&
          userData.actions &&
          userData.actions["Idle"]
        ) {
          this.switchNPCAction(npc, "Idle");
        }

        // Face the movement direction
        npc.rotation.y = Math.atan2(dirX, dirZ);
      } else if (userData.mode === "idle") {
        // Remain in place; ensure grounded
        npc.position.y = 0;
      } else {
        // Legacy street walking (not used by default). Keep original logic when speed > 0
        // Turn cooldown
        if (userData.turnCooldown > 0) userData.turnCooldown -= delta;

        // Walk along street
        userData.progress += userData.speed * delta * 0.01;
        const street = userData.currentStreet;
        const newX =
          street.start.x + (street.end.x - street.start.x) * userData.progress;
        const newZ =
          street.start.z + (street.end.z - street.start.z) * userData.progress;
        npc.position.set(newX, 0, newZ);

        // Try to turn at intersections
        if (
          userData.progress > 0.4 &&
          userData.progress < 0.6 &&
          userData.turnCooldown <= 0
        ) {
          this.checkForTurn(npc, userData);
        }
      }

      // Fallback: if NPC did not move this frame, ensure Idle animation
      const movedDist = Math.hypot(
        npc.position.x - userData.lastPos.x,
        npc.position.z - userData.lastPos.z
      );
      if (movedDist < 0.01) {
        if (userData.currentAction !== "Idle" && userData.actions["Idle"]) {
          this.switchNPCAction(npc, "Idle");
        }
      }
      // Update last position for next frame comparison
      userData.lastPos.x = npc.position.x;
      userData.lastPos.z = npc.position.z;

      // Despawn if far beyond end and respawn
      if (userData.progress > 1.2) {
        // Free up the lane when NPC leaves
        if (userData.currentStreet?.id) {
          this.occupiedStreetIds.delete(userData.currentStreet.id);
        }
        this.scene.remove(npc);
        this.npcs.splice(i, 1);
        if (this.npcs.length < this.count) this.spawnNPC(i);
      }
    }
  }

  checkForTurn(npc, userData) {
    const pos = { x: npc.position.x, z: npc.position.z };
    const nearby = this.intersections.find((itx) => {
      const d = Math.hypot(itx.x - pos.x, itx.z - pos.z);
      return d < 8;
    });

    if (nearby && !userData.isAtIntersection) {
      userData.isAtIntersection = true;
      if (Math.random() < 0.4) this.performTurn(npc, userData, nearby);
    } else if (!nearby) {
      userData.isAtIntersection = false;
    }
  }

  performTurn(npc, userData, intersection) {
    const currentStreet = userData.currentStreet;
    const connected = intersection.connectedStreets;
    const candidates = this.streets.filter(
      (s) =>
        connected.includes(s.id) &&
        s.id !== currentStreet.id &&
        this.isValidTurn(currentStreet, s)
    );
    if (candidates.length === 0) return;
    // Prefer turning onto streets not currently occupied by other NPCs
    let options = candidates.filter((s) => !this.occupiedStreetIds.has(s.id));
    if (options.length === 0) options = candidates;
    const newStreet = options[Math.floor(Math.random() * options.length)];

    // Update lane occupancy (free old, claim new)
    if (currentStreet?.id) this.occupiedStreetIds.delete(currentStreet.id);
    this.occupiedStreetIds.add(newStreet.id);

    userData.currentStreet = newStreet;
    userData.progress = 0;
    userData.turnCooldown = 2;
    npc.position.set(newStreet.start.x, 0, newStreet.start.z);

    if (newStreet.direction === "horizontal") {
      // Keep horizontal facing consistent with movement direction
      npc.rotation.y = newStreet.lane.includes("right")
        ? Math.PI / 2
        : -Math.PI / 2;
    } else {
      // Align facing with car controller after turn
      npc.rotation.y = newStreet.lane.includes("down") ? Math.PI : 0;
    }
  }

  isValidTurn(fromStreet, toStreet) {
    if (fromStreet.direction === toStreet.direction)
      return fromStreet.lane !== toStreet.lane;
    return true;
  }

  switchNPCAction(npc, actionName) {
    const userData = npc.userData || {};
    const actions = userData.actions || {};
    if (!actions[actionName]) return;
    if (userData.currentAction === actionName) return;
    if (userData.currentAction && actions[userData.currentAction]) {
      actions[userData.currentAction].fadeOut(0.2);
    }
    const next = actions[actionName];
    next.reset();
    next.fadeIn(0.2);
    next.play();
    userData.currentAction = actionName;
  }
}
