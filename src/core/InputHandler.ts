// Handles user input (keyboard, mouse, gamepad, etc.)

export class InputHandler {
    // Current state of keys (held down)
    private keyStates: { [key: string]: boolean } = {};
    // State of keys in the previous frame (for detecting single presses)
    private previousKeyStates: { [key: string]: boolean } = {};

    private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
    private mouseButtons: { [button: number]: boolean } = {}; // 0: left, 1: middle, 2: right

    constructor() {
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        // Prevent context menu on right-click
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log("InputHandler initialized.");
    }

    // Renamed from onKeyDown for clarity
    private handleKeyDown(event: KeyboardEvent): void {
        // Prevent default browser behavior for keys used in the game (e.g., space, arrows)
        // if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        //     event.preventDefault();
        // }
        this.keyStates[event.code] = true;
    }

    // Renamed from onKeyUp for clarity
    private handleKeyUp(event: KeyboardEvent): void {
        this.keyStates[event.code] = false;
    }

    private onMouseMove(event: MouseEvent): void {
        this.mousePosition.x = event.clientX;
        this.mousePosition.y = event.clientY;
    }

     private onMouseDown(event: MouseEvent): void {
        this.mouseButtons[event.button] = true;
    }

    private onMouseUp(event: MouseEvent): void {
        this.mouseButtons[event.button] = false;
    }

    /**
     * Checks if a key is currently held down.
     * @param keyCode The code of the key (e.g., 'KeyW', 'Space').
     * @returns True if the key is currently held down, false otherwise.
     */
    public isKeyHeld(keyCode: string): boolean {
        return this.keyStates[keyCode] || false;
    }

    /**
     * Checks if a key was pressed down *in this frame*.
     * Useful for actions that should only trigger once per key press.
     * @param keyCode The code of the key (e.g., 'KeyW', 'Space').
     * @returns True if the key was pressed in this frame, false otherwise.
     */
    public isKeyPressed(keyCode: string): boolean {
        return (this.keyStates[keyCode] || false) && !(this.previousKeyStates[keyCode] || false);
    }

    public getMousePosition(): { x: number; y: number } {
        return this.mousePosition;
    }

    public isMouseButtonDown(button: number): boolean {
        return this.mouseButtons[button] || false;
    }

    /**
     * Updates the input state. Should be called once per game loop, typically at the beginning.
     * This method updates the previous key states for accurate `isKeyPressed` detection.
     */
    public update(): void {
        // Copy current key states to previous key states *before* processing new events
        this.previousKeyStates = { ...this.keyStates };

        // Can add logic for polling gamepads or other continuous input checks here
    }

/**
     * Checks if the pause key (Escape) was pressed this frame.
     * @returns True if the Escape key was pressed, false otherwise.
     */
    public getPauseInput(): boolean {
        // Note: The original instruction mentioned wasKeyPressedThisFrame('escape'),
        // but the existing method for this is isKeyPressed. Using isKeyPressed.
        return this.isKeyPressed('Escape');
    }
    // Add methods for touch input, gamepad support, etc. as needed
}