import * as THREE from "three";

export class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa0a0a0);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    // Setup lighting
    this.setupLighting();

    // Setup ground
    this.setupGround();

    // Handle window resize
    this.setupResizeHandler();
  }

  setupLighting() {
    // Hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
    hemiLight.position.set(0, 200, 0);
    this.scene.add(hemiLight);

    // Directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
  }

  setupGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  setupResizeHandler() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  getRenderer() {
    return this.renderer;
  }
}