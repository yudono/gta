import * as THREE from "three";

export class CityGenerator {
  constructor(scene) {
    this.scene = scene;
    this.textureLoader = new THREE.TextureLoader();
    this.buildingTexture = null;
    this.buildings = []; // Store building data for collision detection
    this.init();
  }

  init() {
    this.loadTextures();
    this.generateCity();
  }

  loadTextures() {
    // Load building texture
    this.buildingTexture = this.textureLoader.load(
      "assets/textures/building.svg"
    );
    this.buildingTexture.wrapS = THREE.RepeatWrapping;
    this.buildingTexture.wrapT = THREE.RepeatWrapping;
  }

  generateCity() {
    const gridSize = 40; // Increased from 20 to 40 for much larger city
    const blockSize = 15; // Keep block size same
    const streetWidth = 3; // Keep street width same
    const buildingSpacing = 1;

    // Create much larger ground
    const groundGeometry = new THREE.PlaneGeometry(
      gridSize * blockSize * 1.5, // Make ground even larger than city
      gridSize * blockSize * 1.5
    );
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Generate streets
    this.generateStreets(gridSize, blockSize, streetWidth);

    // Generate buildings
    this.generateBuildings(gridSize, blockSize, streetWidth, buildingSpacing);

    // Generate more landmarks for larger city
    this.generateLandmarkBuildings(gridSize, blockSize);
  }

  generateStreets(gridSize, blockSize, streetWidth) {
    const streetMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // Create horizontal streets
    for (let z = 0; z < gridSize; z++) {
      if (z % 3 === 1) {
        // Every 3rd row is a street
        const street = new THREE.Mesh(
          new THREE.PlaneGeometry(gridSize * blockSize, streetWidth),
          streetMaterial
        );
        street.rotation.x = -Math.PI / 2;
        street.position.set(0, 0.01, (z - gridSize / 2) * blockSize);
        street.receiveShadow = true;
        this.scene.add(street);
      }
    }

    // Create vertical streets
    for (let x = 0; x < gridSize; x++) {
      if (x % 3 === 1) {
        // Every 3rd column is a street
        const street = new THREE.Mesh(
          new THREE.PlaneGeometry(streetWidth, gridSize * blockSize),
          streetMaterial
        );
        street.rotation.x = -Math.PI / 2;
        street.position.set((x - gridSize / 2) * blockSize, 0.01, 0);
        street.receiveShadow = true;
        this.scene.add(street);
      }
    }
  }

  generateBuildings(gridSize, blockSize, streetWidth, buildingSpacing) {
    const textureLoader = new THREE.TextureLoader();
    const buildingTexture = textureLoader.load("assets/textures/building.svg");

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        // Skip streets
        if (x % 3 === 1 || z % 3 === 1) continue;

        // Building dimensions - more realistic sizes
        const buildingWidth = blockSize - buildingSpacing * 2;
        const buildingDepth = blockSize - buildingSpacing * 2;
        const buildingHeight = Math.random() * 25 + 10; // 10-35 units tall

        // Building position
        const posX = (x - gridSize / 2) * blockSize;
        const posZ = (z - gridSize / 2) * blockSize;

        // Create building
        const geometry = new THREE.BoxGeometry(
          buildingWidth,
          buildingHeight,
          buildingDepth
        );
        const material = new THREE.MeshLambertMaterial({
          map: buildingTexture,
          color: new THREE.Color().setHSL(
            Math.random() * 0.1 + 0.1,
            0.3,
            0.5 + Math.random() * 0.3
          ),
        });

        const building = new THREE.Mesh(geometry, material);
        building.position.set(posX, buildingHeight / 2, posZ);
        building.castShadow = true;
        building.receiveShadow = true;

        // Store building data for collision detection
        this.buildings.push({
          mesh: building,
          x: posX,
          z: posZ,
          width: buildingWidth,
          depth: buildingDepth,
          height: buildingHeight,
        });

        this.scene.add(building);
      }
    }
  }

  generateLandmarkBuildings() {
    // Add more landmark buildings for larger city (increased from 5 to 12)
    for (let i = 0; i < 12; i++) {
      const width = THREE.MathUtils.randInt(80, 120);
      const height = THREE.MathUtils.randInt(500, 800);
      const depth = THREE.MathUtils.randInt(80, 120);

      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshStandardMaterial({
        map: this.buildingTexture.clone(),
        metalness: 0.2,
        roughness: 0.6,
        color: new THREE.Color().setHSL(Math.random(), 0.3, 0.8),
      });

      material.map.repeat.set(width / 40, height / 80);

      const building = new THREE.Mesh(geometry, material);
      building.castShadow = true;
      building.receiveShadow = true;

      // Spread landmarks across larger area
      const x = THREE.MathUtils.randFloatSpread(2500); // Increased spread area
      const z = THREE.MathUtils.randFloatSpread(2500);

      building.position.set(x, height / 2, z);

      // Store landmark building data for collision detection
      this.buildings.push({
        mesh: building,
        x: x,
        z: z,
        width: width,
        depth: depth,
        height: height,
      });

      this.scene.add(building);
    }
  }

  // Method to get buildings for collision detection
  getBuildings() {
    return this.buildings;
  }
}
