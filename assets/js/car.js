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

          // Apply textures to car materials
          object.traverse((child) => {
            if (child.isMesh) {
              const materialName = child.material?.name?.toLowerCase() || "";
              let texture = null;

              // Map materials to appropriate textures
              if (
                materialName.includes("body") ||
                materialName.includes("paint")
              ) {
                texture =
                  this.carTextures["S921_Body1.png"] ||
                  this.carTextures["S921_Body2.png"];
              } else if (materialName.includes("light")) {
                texture = this.carTextures["S92_Light.png"];
              } else if (
                materialName.includes("glass") ||
                materialName.includes("window")
              ) {
                texture = this.carTextures["S92_Glass.png"];
              } else if (
                materialName.includes("tire") ||
                materialName.includes("wheel")
              ) {
                texture =
                  this.carTextures["Tire.png"] ||
                  this.carTextures["etcwheels.png"];
              } else if (materialName.includes("steering")) {
                texture = this.carTextures["Steeringwheel.png"];
              } else if (
                materialName.includes("chrome") ||
                materialName.includes("metal")
              ) {
                texture = this.carTextures["CHROME_BODY.png"];
              } else if (
                materialName.includes("panel") ||
                materialName.includes("interior")
              ) {
                texture = this.carTextures["Vpanel.png"];
              }

              // Create material with texture or fallback color
              if (texture) {
                child.material = new THREE.MeshLambertMaterial({
                  map: texture,
                  transparent: materialName.includes("glass"),
                  opacity: materialName.includes("glass") ? 0.8 : 1.0,
                });
              } else {
                // Fallback to colored material
                const color = materialName.includes("tire")
                  ? 0x222222
                  : materialName.includes("glass")
                  ? 0x87ceeb
                  : materialName.includes("light")
                  ? 0xffffaa
                  : materialName.includes("chrome")
                  ? 0xc0c0c0
                  : 0x666666;

                child.material = new THREE.MeshLambertMaterial({
                  color: color,
                  transparent: materialName.includes("glass"),
                  opacity: materialName.includes("glass") ? 0.8 : 1.0,
                });
              }

              // Enable shadows
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Scale and prepare the car template
          object.scale.setScalar(0.02);

          // Don't rotate the template - let individual cars handle their own rotation
          // object.rotation.y = Math.PI / 2; // Removed this line

          this.carTemplate = object;

          console.log("CarController: Car model ready with textures");
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

      // Choose a random street lane
      const street =
        this.streets[Math.floor(Math.random() * this.streets.length)];

      // Set random car color
      const carColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
      car.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.color = carColor;
        }
      });

      // Position car at start of street with some randomness
      const progress = Math.random() * 0.2; // Start cars near beginning of streets
      car.position.x =
        street.start.x + (street.end.x - street.start.x) * progress;
      car.position.y = 0.5;
      car.position.z =
        street.start.z + (street.end.z - street.start.z) * progress;

      // Set car rotation based on street direction and lane (adding 180° to fix backward appearance)
      if (street.direction === "horizontal") {
        // For horizontal streets: right lane goes east, left lane goes west
        car.rotation.y = street.lane === "right" ? -Math.PI / 2 : Math.PI / 2;
      } else {
        // For vertical streets: down lane goes south, up lane goes north
        car.rotation.y = street.lane === "down" ? Math.PI : 0;
      }

      // Add car properties
      car.userData = {
        currentStreet: street,
        speed: this.carSpeed * (0.8 + Math.random() * 0.4),
        progress: progress,
        nextTurn: null,
        isAtIntersection: false,
        turnCooldown: 0,
      };

      // Add to scene and cars array
      this.scene.add(car);
      this.cars.push(car);

      console.log(
        `CarController: Car spawned on ${
          street.id
        } at (${car.position.x.toFixed(1)}, ${car.position.z.toFixed(1)})`
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

      car.position.x = newX;
      car.position.z = newZ;

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

      // Update car rotation for new direction (adding 180° to fix backward appearance)
      if (newStreet.direction === "horizontal") {
        // For horizontal streets: right lane goes east, left lane goes west
        car.rotation.y =
          newStreet.lane === "right" ? -Math.PI / 2 : Math.PI / 2;
      } else {
        // For vertical streets: down lane goes south, up lane goes north
        car.rotation.y = newStreet.lane === "down" ? Math.PI : 0;
      }
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

  getCars() {
    return this.cars;
  }
}
