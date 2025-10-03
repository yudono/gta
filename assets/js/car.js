import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

export class CarController {
  constructor(scene, cityGenerator) {
    this.scene = scene;
    this.cityGenerator = cityGenerator;
    this.cars = [];
    this.loader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.clock = new THREE.Clock();
    this.streets = [];
    this.intersections = [];
    this.maxCars = 20;
    this.carTemplate = null;
    this.carTextures = {};

    // Car movement properties
    this.carSpeed = 3;
    this.laneWidth = 1.2;
    // Car model should be rotated 180° relative to movement
    this.carHeadingOffset = Math.PI; // rotate 180° to match requested orientation
    this.carRadius = 1.2; // approximate half-width for collision padding
    this.wheelSpinFactor = 6; // visual spin factor for wheel rotation
    this.buildings = this.cityGenerator?.getBuildings?.() || [];
    // Ensure spawn diversity: avoid placing multiple cars on the same lane initially
    this.spawnedStreetIds = new Set();
  }

  async init() {
    console.log("CarController: Starting initialization...");
    try {
      await this.loadCarTextures();
      await this.loadCarModel();
      this.generateStreetNetwork();
      this.spawnCars();
      console.log("CarController: Initialization completed successfully");
    } catch (error) {
      console.error("CarController: Initialization failed:", error);
    }
  }

  async loadCarTextures() {
    console.log("CarController: Loading car textures...");

    const textureFiles = [
      "S921_Body1.png",
      "S921_Body2.png",
      "S92_Light.png",
      "S92_Glass.png",
      "Tire.png",
      "etcwheels.png",
      "Steeringwheel.png",
      "Vpanel.png",
      "saab_logo.png",
      "plate.png",
      "CHROME_BODY.png",
    ];

    const loadPromises = textureFiles.map((filename) => {
      return new Promise((resolve) => {
        this.textureLoader.load(
          `/assets/textures/car/${filename}`,
          (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.flipY = false;
            this.carTextures[filename] = texture;
            console.log(`CarController: Loaded texture ${filename}`);
            resolve();
          },
          undefined,
          (error) => {
            console.warn(
              `CarController: Failed to load texture ${filename}:`,
              error
            );
            resolve(); // Continue even if texture fails
          }
        );
      });
    });

    await Promise.all(loadPromises);
    console.log(
      `CarController: Loaded ${Object.keys(this.carTextures).length} textures`
    );
  }

  async loadCarModel() {
    console.log("CarController: Loading car model...");

    return new Promise((resolve, reject) => {
      this.loader.load(
        "assets/models/Saab 9-2X.fbx",
        (object) => {
          console.log(
            "CarController: Car model loaded, setting up materials..."
          );

          // Store original materials for cloning
          const originalMaterials = new Map();

          // Apply textures to car materials
          object.traverse((child) => {
            if (child.isMesh) {
              const materialName = child.material?.name?.toLowerCase() || "";
              let texture = null;
              let materialConfig = {};

              // Mark likely wheel meshes for rotation updates
              const childName = (child.name || "").toLowerCase();
              if (
                materialName.includes("tire") ||
                materialName.includes("wheel") ||
                childName.includes("wheel")
              ) {
                child.userData.isWheel = true;
              }

              // Map materials to appropriate textures with better matching
              if (
                materialName.includes("body") ||
                materialName.includes("paint") ||
                materialName.includes("s921") ||
                materialName.includes("exterior")
              ) {
                texture = this.carTextures["S921_Body1.png"];
                materialConfig = {
                  color: 0xffffff,
                  metalness: 0.3,
                  roughness: 0.7,
                };
              } else if (
                materialName.includes("light") ||
                materialName.includes("lamp") ||
                materialName.includes("s92_light")
              ) {
                texture = this.carTextures["S92_Light.png"];
                materialConfig = {
                  color: 0xffffaa,
                  emissive: 0x222200,
                  metalness: 0.1,
                  roughness: 0.3,
                };
              } else if (
                materialName.includes("glass") ||
                materialName.includes("window") ||
                materialName.includes("windshield") ||
                materialName.includes("s92_glass")
              ) {
                texture = this.carTextures["S92_Glass.png"];
                materialConfig = {
                  color: 0x87ceeb,
                  transparent: true,
                  opacity: 0.3,
                  metalness: 0.0,
                  roughness: 0.1,
                };
              } else if (
                materialName.includes("tire") ||
                materialName.includes("wheel") ||
                materialName.includes("rubber")
              ) {
                texture = this.carTextures["Tire.png"];
                materialConfig = {
                  color: 0x222222,
                  metalness: 0.0,
                  roughness: 0.9,
                };
              } else if (
                materialName.includes("rim") ||
                materialName.includes("etcwheel") ||
                materialName.includes("alloy")
              ) {
                texture = this.carTextures["etcwheels.png"];
                materialConfig = {
                  color: 0xc0c0c0,
                  metalness: 0.8,
                  roughness: 0.2,
                };
              } else if (materialName.includes("steering")) {
                texture = this.carTextures["Steeringwheel.png"];
                materialConfig = {
                  color: 0x333333,
                  metalness: 0.1,
                  roughness: 0.8,
                };
              } else if (
                materialName.includes("chrome") ||
                materialName.includes("metal") ||
                materialName.includes("bumper")
              ) {
                texture = this.carTextures["CHROME_BODY.png"];
                materialConfig = {
                  color: 0xc0c0c0,
                  metalness: 0.9,
                  roughness: 0.1,
                };
              } else if (
                materialName.includes("panel") ||
                materialName.includes("interior") ||
                materialName.includes("dashboard") ||
                materialName.includes("vpanel")
              ) {
                texture = this.carTextures["Vpanel.png"];
                materialConfig = {
                  color: 0x444444,
                  metalness: 0.2,
                  roughness: 0.6,
                };
              } else if (materialName.includes("plate")) {
                texture = this.carTextures["plate.png"];
                materialConfig = {
                  color: 0xffffff,
                  metalness: 0.1,
                  roughness: 0.5,
                };
              } else if (materialName.includes("logo")) {
                texture = this.carTextures["saab_logo.png"];
                materialConfig = {
                  color: 0xffffff,
                  metalness: 0.3,
                  roughness: 0.4,
                };
              }

              // Create material with texture or fallback
              if (texture) {
                child.material = new THREE.MeshStandardMaterial({
                  map: texture,
                  ...materialConfig,
                });
                console.log(
                  `Applied texture to ${materialName}: ${
                    texture.image?.src?.split("/").pop() || "unknown"
                  }`
                );
              } else {
                // Fallback to colored material based on material name
                const color = materialName.includes("tire")
                  ? 0x222222
                  : materialName.includes("glass")
                  ? 0x87ceeb
                  : materialName.includes("light")
                  ? 0xffffaa
                  : materialName.includes("chrome") ||
                    materialName.includes("metal")
                  ? 0xc0c0c0
                  : materialName.includes("wheel")
                  ? 0x666666
                  : 0x888888;

                child.material = new THREE.MeshStandardMaterial({
                  color: color,
                  transparent: materialName.includes("glass"),
                  opacity: materialName.includes("glass") ? 0.3 : 1.0,
                  metalness:
                    materialName.includes("chrome") ||
                    materialName.includes("metal")
                      ? 0.8
                      : 0.2,
                  roughness: materialName.includes("tire") ? 0.9 : 0.5,
                });
                console.log(
                  `Applied fallback color to ${materialName}: #${color.toString(
                    16
                  )}`
                );
              }

              // Store material name for later reference
              child.material.name = child.material.name || materialName;

              // Store original material for cloning
              originalMaterials.set(child.uuid, child.material);

              // Enable shadows
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Store original materials on the template
          object.userData.originalMaterials = originalMaterials;

          // Scale and prepare the car template
          // Reduce car size to 0.8x of previous (20% smaller)
          object.scale.setScalar(0.01);

          // Keep template orientation neutral; rotation is set per car spawn
          object.rotation.y = 0;

          this.carTemplate = object;

          console.log("CarController: Car model ready with improved textures");
          resolve();
        },
        (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          console.log(`CarController: Loading progress: ${percent}%`);
        },
        (error) => {
          console.error("CarController: Failed to load car model:", error);
          reject(error);
        }
      );
    });
  }

  generateStreetNetwork() {
    console.log(
      "CarController: Generating street network based on city layout..."
    );

    // Match the city generator's street pattern
    const gridSize = 40;
    const blockSize = 15;
    const streetWidth = 3;

    this.streets = [];
    this.intersections = [];

    // Generate horizontal streets (every 3rd row)
    for (let z = 0; z < gridSize; z++) {
      if (z % 3 === 1) {
        const streetZ = (z - gridSize / 2) * blockSize;

        // Create lanes for both directions
        this.streets.push({
          id: `h_${z}_right`,
          start: {
            x: (-gridSize * blockSize) / 2,
            z: streetZ - this.laneWidth / 2,
          },
          end: {
            x: (gridSize * blockSize) / 2,
            z: streetZ - this.laneWidth / 2,
          },
          direction: "horizontal",
          lane: "right",
        });

        this.streets.push({
          id: `h_${z}_left`,
          start: {
            x: (gridSize * blockSize) / 2,
            z: streetZ + this.laneWidth / 2,
          },
          end: {
            x: (-gridSize * blockSize) / 2,
            z: streetZ + this.laneWidth / 2,
          },
          direction: "horizontal",
          lane: "left",
        });
      }
    }

    // Generate vertical streets (every 3rd column)
    for (let x = 0; x < gridSize; x++) {
      if (x % 3 === 1) {
        const streetX = (x - gridSize / 2) * blockSize;

        // Create lanes for both directions
        this.streets.push({
          id: `v_${x}_down`,
          start: {
            x: streetX - this.laneWidth / 2,
            z: (-gridSize * blockSize) / 2,
          },
          end: {
            x: streetX - this.laneWidth / 2,
            z: (gridSize * blockSize) / 2,
          },
          direction: "vertical",
          lane: "down",
        });

        this.streets.push({
          id: `v_${x}_up`,
          start: {
            x: streetX + this.laneWidth / 2,
            z: (gridSize * blockSize) / 2,
          },
          end: {
            x: streetX + this.laneWidth / 2,
            z: (-gridSize * blockSize) / 2,
          },
          direction: "vertical",
          lane: "up",
        });
      }
    }

    // Generate intersections
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

    console.log(
      `CarController: Generated ${this.streets.length} street lanes and ${this.intersections.length} intersections`
    );
  }

  getConnectedStreets(x, z) {
    const tolerance = 2;
    const connected = [];

    this.streets.forEach((street) => {
      // Check if street passes through this intersection
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

  spawnCars() {
    console.log("CarController: Starting car spawning...");

    if (!this.carTemplate) {
      console.error("CarController: Cannot spawn cars - template not loaded");
      return;
    }

    for (let i = 0; i < this.maxCars; i++) {
      this.spawnCar();
    }

    console.log(`CarController: Spawned ${this.cars.length} cars`);
  }

  spawnCar() {
    if (!this.carTemplate || this.streets.length === 0) {
      console.warn(
        "CarController: Cannot spawn car - missing template or streets"
      );
      return;
    }

    try {
      // Clone the car template
      const car = this.carTemplate.clone();

      // Choose a random street lane, preferring lanes not yet used for spawning
      let availableStreets = this.streets.filter(
        (s) => !this.spawnedStreetIds.has(s.id)
      );
      // If we've exhausted unique lanes, reset to allow reuse
      if (availableStreets.length === 0) {
        this.spawnedStreetIds.clear();
        availableStreets = this.streets.slice();
      }
      const street =
        availableStreets[Math.floor(Math.random() * availableStreets.length)];
      this.spawnedStreetIds.add(street.id);

      // Check for nearby cars to maintain spacing
      const minSpacing = 8; // Minimum distance between cars
      let attempts = 0;
      let validPosition = false;
      let progress = 0;

      while (!validPosition && attempts < 10) {
        progress = Math.random() * 0.3; // Start cars in first 30% of streets

        const testX =
          street.start.x + (street.end.x - street.start.x) * progress;
        const testZ =
          street.start.z + (street.end.z - street.start.z) * progress;

        // Check distance to all existing cars
        validPosition = true;
        for (const existingCar of this.cars) {
          const distance = Math.sqrt(
            Math.pow(existingCar.position.x - testX, 2) +
              Math.pow(existingCar.position.z - testZ, 2)
          );

          if (distance < minSpacing) {
            validPosition = false;
            break;
          }
        }

        // Ensure spawn point is not inside a building (AABB check)
        if (validPosition && this.checkCollision({ x: testX, z: testZ })) {
          validPosition = false;
        }

        attempts++;
      }

      // If we couldn't find a valid position after 10 attempts, skip spawning
      if (!validPosition) {
        console.log(
          "CarController: Skipping car spawn - no valid spacing found"
        );
        return;
      }

      // Clone materials properly while preserving textures
      car.traverse((child) => {
        if (child.isMesh) {
          // Clone the material to avoid shared references between cars
          child.material = child.material.clone();

          // Only apply color variation to body parts, preserve textures for other parts
          const materialName = child.material?.name?.toLowerCase() || "";
          if (
            materialName.includes("body") ||
            materialName.includes("paint") ||
            materialName.includes("s921") ||
            materialName.includes("exterior")
          ) {
            // Apply random color variation only to body parts
            const carColor = new THREE.Color().setHSL(Math.random(), 0.6, 0.6);
            child.material.color.multiply(carColor);
          }
          // For other parts (lights, glass, tires, etc.), keep original colors and textures
        }
      });

      // Position car at calculated position
      car.position.x =
        street.start.x + (street.end.x - street.start.x) * progress;
      car.position.y = 0.5;
      car.position.z =
        street.start.z + (street.end.z - street.start.z) * progress;

      // Align car rotation with actual movement vector (start -> end)
      const dirX = street.end.x - street.start.x;
      const dirZ = street.end.z - street.start.z;
      car.rotation.y = Math.atan2(dirX, dirZ) + this.carHeadingOffset;

      // Collect wheel meshes for rotation animation
      const wheels = [];
      car.traverse((child) => {
        if (
          child.isMesh &&
          (child.userData?.isWheel ||
            /tire|wheel/.test((child.material?.name || "").toLowerCase()))
        ) {
          wheels.push(child);
        }
      });

      // Add car properties
      car.userData = {
        currentStreet: street,
        speed: this.carSpeed * (0.8 + Math.random() * 0.4),
        progress: progress,
        nextTurn: null,
        isAtIntersection: false,
        turnCooldown: 0,
        wheels,
      };

      // Add to scene and cars array
      this.scene.add(car);
      this.cars.push(car);

      console.log(
        `CarController: Car spawned on ${
          street.id
        } at (${car.position.x.toFixed(1)}, ${car.position.z.toFixed(
          1
        )}) with rotation ${((car.rotation.y * 180) / Math.PI).toFixed(1)}°`
      );
    } catch (error) {
      console.error("CarController: Error spawning car:", error);
    }
  }

  update() {
    const deltaTime = this.clock.getDelta();

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const userData = car.userData;

      if (!userData || !userData.currentStreet) continue;

      // Update turn cooldown
      if (userData.turnCooldown > 0) {
        userData.turnCooldown -= deltaTime;
      }

      // Move car along its current street
      userData.progress += userData.speed * deltaTime * 0.01;

      // Update position based on progress
      const street = userData.currentStreet;
      const newX =
        street.start.x + (street.end.x - street.start.x) * userData.progress;
      const newZ =
        street.start.z + (street.end.z - street.start.z) * userData.progress;
      // Building collision check: prevent passing through walls
      const testPos = { x: newX, z: newZ };
      if (this.checkCollision(testPos)) {
        // Try to turn to avoid collision; if not near intersection, slow and hold
        if (userData.turnCooldown <= 0) {
          this.checkForTurn(car, userData);
          userData.turnCooldown = 1.0;
        }
        // Revert progress to avoid penetrating building
        userData.progress -= userData.speed * deltaTime * 0.01;
      } else {
        // Apply position update
        const prevX = car.position.x;
        const prevZ = car.position.z;
        car.position.x = newX;
        car.position.z = newZ;

        // Spin wheels based on distance moved
        const dist = Math.hypot(newX - prevX, newZ - prevZ);
        const angle = dist * this.wheelSpinFactor;
        if (userData.wheels && userData.wheels.length) {
          for (const wheel of userData.wheels) {
            wheel.rotation.x -= angle;
          }
        }
      }

      // Check for intersections and potential turns
      if (
        userData.progress > 0.4 &&
        userData.progress < 0.6 &&
        userData.turnCooldown <= 0
      ) {
        this.checkForTurn(car, userData);
      }

      // Remove car if it's gone too far and spawn a new one
      if (userData.progress > 1.2) {
        this.scene.remove(car);
        this.cars.splice(i, 1);

        // Spawn a new car to maintain population
        if (this.cars.length < this.maxCars) {
          this.spawnCar();
        }
      }
    }
  }

  checkForTurn(car, userData) {
    const currentPos = { x: car.position.x, z: car.position.z };

    // Find nearby intersection
    const nearbyIntersection = this.intersections.find((intersection) => {
      const distance = Math.sqrt(
        Math.pow(intersection.x - currentPos.x, 2) +
          Math.pow(intersection.z - currentPos.z, 2)
      );
      return distance < 8; // Within 8 units of intersection
    });

    if (nearbyIntersection && !userData.isAtIntersection) {
      userData.isAtIntersection = true;

      // 30% chance to turn at intersection
      if (Math.random() < 0.3) {
        this.performTurn(car, userData, nearbyIntersection);
      }
    } else if (!nearbyIntersection) {
      userData.isAtIntersection = false;
    }
  }

  performTurn(car, userData, intersection) {
    const currentStreet = userData.currentStreet;
    const connectedStreets = intersection.connectedStreets;

    // Find available turn options (exclude current street and opposite direction)
    const availableStreets = this.streets.filter((street) => {
      return (
        connectedStreets.includes(street.id) &&
        street.id !== currentStreet.id &&
        this.isValidTurn(currentStreet, street)
      );
    });

    if (availableStreets.length > 0) {
      // Choose random turn
      const newStreet =
        availableStreets[Math.floor(Math.random() * availableStreets.length)];

      console.log(
        `CarController: Car turning from ${currentStreet.id} to ${newStreet.id}`
      );

      // Update car's street and reset progress
      userData.currentStreet = newStreet;
      userData.progress = 0;
      userData.turnCooldown = 2; // 2 second cooldown before next turn

      // Update car position to start of new street
      car.position.x = newStreet.start.x;
      car.position.z = newStreet.start.z;

      // Align car rotation with actual movement vector (start -> end) on new street
      const ndx = newStreet.end.x - newStreet.start.x;
      const ndz = newStreet.end.z - newStreet.start.z;
      car.rotation.y = Math.atan2(ndx, ndz) + this.carHeadingOffset;
    }
  }

  isValidTurn(fromStreet, toStreet) {
    // Prevent U-turns and ensure realistic turning
    if (fromStreet.direction === toStreet.direction) {
      // Same direction - only allow if different lane (lane change)
      return fromStreet.lane !== toStreet.lane;
    }

    // Different directions are valid turns (left/right turns)
    return true;
  }

  // Axis-Aligned Bounding Box collision check against buildings
  checkCollision(newPosition) {
    if (!this.buildings || this.buildings.length === 0) return false;

    for (const b of this.buildings) {
      if (b.x === undefined || b.z === undefined || !b.width || !b.depth)
        continue;
      const dx = newPosition.x - b.x;
      const dz = newPosition.z - b.z;
      const halfW = b.width / 2 + this.carRadius;
      const halfD = b.depth / 2 + this.carRadius;
      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
        return true;
      }
    }
    return false;
  }

  getCars() {
    return this.cars;
  }
}
