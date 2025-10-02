export class InputHandler {
  constructor() {
    this.keys = {};
    this.mouse = {
      x: 0,
      y: 0,
      deltaX: 0,
      deltaY: 0,
      isLocked: false
    };
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Keyboard events
    document.addEventListener("keydown", (event) => {
      this.keys[event.code] = true;
    });

    document.addEventListener("keyup", (event) => {
      this.keys[event.code] = false;
    });

    // Mouse events for GTA-style camera control
    document.addEventListener("click", () => {
      if (!this.mouse.isLocked) {
        document.body.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.mouse.isLocked = document.pointerLockElement === document.body;
    });

    document.addEventListener("mousemove", (event) => {
      if (this.mouse.isLocked) {
        this.mouse.deltaX = event.movementX || 0;
        this.mouse.deltaY = event.movementY || 0;
      }
    });

    // Reset mouse delta after each frame
    this.resetMouseDelta = () => {
      this.mouse.deltaX = 0;
      this.mouse.deltaY = 0;
    };
  }

  isKeyPressed(keyCode) {
    return !!this.keys[keyCode];
  }

  getMovementInput() {
    return {
      forward: this.isKeyPressed("KeyW"),
      backward: this.isKeyPressed("KeyS"),
      left: this.isKeyPressed("KeyA"),
      right: this.isKeyPressed("KeyD"),
      arrowUp: this.isKeyPressed("ArrowUp"),
      arrowDown: this.isKeyPressed("ArrowDown"),
      arrowLeft: this.isKeyPressed("ArrowLeft"),
      arrowRight: this.isKeyPressed("ArrowRight"),
    };
  }

  getMouseInput() {
    const mouseInput = {
      deltaX: this.mouse.deltaX,
      deltaY: this.mouse.deltaY,
      isLocked: this.mouse.isLocked
    };
    
    // Reset delta after reading
    this.resetMouseDelta();
    
    return mouseInput;
  }
}