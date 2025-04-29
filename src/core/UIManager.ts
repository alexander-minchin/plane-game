import { GameState } from './types';

export class UIManager {
    private hudSpeed: HTMLElement | null = null;
    private hudAltitude: HTMLElement | null = null;
    private hudThrottle: HTMLElement | null = null;
    private menuContainer: HTMLElement | null = null;
    private currentMenu: HTMLElement | null = null;
    private gameContainer: HTMLElement;

    constructor(gameContainerId: string = 'game-container') {
        const container = document.getElementById(gameContainerId);
        if (!container) {
            throw new Error(`Game container with id "${gameContainerId}" not found.`);
        }
        this.gameContainer = container;
        this.gameContainer.style.position = 'relative'; // Needed for absolute positioning of UI elements
        this.createHUD();
        this.createMenuContainer();
    }

    private createHUD() {
        const hudContainer = document.createElement('div');
        hudContainer.id = 'hud';
        hudContainer.style.position = 'absolute';
        hudContainer.style.top = '10px';
        hudContainer.style.left = '10px';
        hudContainer.style.color = 'white';
        hudContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        hudContainer.style.padding = '5px';
        hudContainer.style.borderRadius = '3px';
        hudContainer.style.fontFamily = 'Arial, sans-serif';
        hudContainer.style.fontSize = '14px';
        hudContainer.style.zIndex = '10'; // Ensure HUD is above the canvas

        this.hudSpeed = document.createElement('div');
        this.hudSpeed.id = 'hud-speed';
        this.hudSpeed.textContent = 'Speed: 0 km/h';
        hudContainer.appendChild(this.hudSpeed);

        this.hudAltitude = document.createElement('div');
        this.hudAltitude.id = 'hud-altitude';
        this.hudAltitude.textContent = 'Altitude: 0 m';
        hudContainer.appendChild(this.hudAltitude);

        this.hudThrottle = document.createElement('div');
        this.hudThrottle.id = 'hud-throttle';
        this.hudThrottle.textContent = 'Throttle: 0%';
        hudContainer.appendChild(this.hudThrottle);

        this.gameContainer.appendChild(hudContainer);
    }

    private createMenuContainer() {
        this.menuContainer = document.createElement('div');
        this.menuContainer.id = 'menu-container';
        this.menuContainer.style.position = 'fixed';
        // Use inset shorthand for top/right/bottom/left: 0
        this.menuContainer.style.inset = '100';
        // Center the menu container horizontally and vertically
        this.menuContainer.style.top = '50%';
        this.menuContainer.style.left = '45%';
        this.menuContainer.style.display = 'flex';
        // Center flex items (the menu box) horizontally
        this.menuContainer.style.justifyContent = 'center';
        // Center flex items (the menu box) vertically
        this.menuContainer.style.alignItems = 'center';
        this.menuContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.menuContainer.style.zIndex = '20'; // Ensure menus are above HUD and canvas
        this.menuContainer.style.visibility = 'hidden'; // Start hidden
        this.gameContainer.appendChild(this.menuContainer);
    }

    updateHUD(data: { speed: number; altitude: number; throttle: number }) {
        if (this.hudSpeed) {
            this.hudSpeed.textContent = `Speed: ${data.speed.toFixed(1)} km/h`;
        }
        if (this.hudAltitude) {
            this.hudAltitude.textContent = `Altitude: ${data.altitude.toFixed(1)} m`;
        }
        if (this.hudThrottle) {
            this.hudThrottle.textContent = `Throttle: ${(data.throttle * 100).toFixed(0)}%`;
        }
    }

    updateUIState(newState: GameState, callbacks: { [key: string]: () => void } = {}) {
        this.hideMenu(); // Hide any currently visible menu first

        switch (newState) {
            case GameState.Loading:
                this.showLoadingScreen();
                break;
            case GameState.MainMenu:
                this.showMainMenu(callbacks['startGame'], callbacks['exitGame']);
                break;
            case GameState.Playing:
                // No menu, HUD is visible by default (or handled elsewhere if needed)
                break;
            case GameState.Paused:
                this.showPauseMenu(callbacks['resumeGame'], callbacks['backToMenu']);
                break;
            case GameState.Crashed:
                this.showCrashScreen(callbacks['restartGame'], callbacks['backToMenu']);
                break;
        }
    }

    private showMenu(menuElement: HTMLElement) {
        if (!this.menuContainer) return;

        // Clear previous menu if any
        if (this.currentMenu) {
            this.menuContainer.removeChild(this.currentMenu);
        }

        this.currentMenu = menuElement;
        this.menuContainer.appendChild(this.currentMenu);
        this.menuContainer.style.visibility = 'visible';
    }

    hideMenu() {
        if (this.menuContainer) {
            this.menuContainer.style.visibility = 'hidden';
            if (this.currentMenu) {
                // Optionally remove the menu content when hiding
                // this.menuContainer.removeChild(this.currentMenu);
                // this.currentMenu = null;
            }
        }
    }

    showLoadingScreen() {
        const loadingBox = document.createElement('div');
        this._styleMenuBox(loadingBox);
        loadingBox.textContent = 'Loading...';
        this.showMenu(loadingBox);
    }

    showMainMenu(onStart?: () => void, onExit?: () => void) {
        const menuBox = document.createElement('div');
        this._styleMenuBox(menuBox);

        const title = document.createElement('h2');
        title.textContent = 'Plane Game';
        title.style.marginBottom = '20px';
        menuBox.appendChild(title);

        const startButton = document.createElement('button');
        this._styleButton(startButton);
        startButton.textContent = 'Start Game';
        startButton.onclick = () => {
            this.hideMenu();
            onStart?.();
        };
        menuBox.appendChild(startButton);

        // Optional Exit button
        if (onExit) {
            const exitButton = document.createElement('button');
            this._styleButton(exitButton);
            exitButton.textContent = 'Exit'; // Assuming exit means back to some launcher or closes tab
            exitButton.onclick = () => {
                onExit?.(); // Implement exit logic if needed
            };
            menuBox.appendChild(exitButton);
        }

        this.showMenu(menuBox);
    }

    showPauseMenu(onResume?: () => void, onBackToMenu?: () => void) {
        const menuBox = document.createElement('div');
        this._styleMenuBox(menuBox);

        const title = document.createElement('h2');
        title.textContent = 'Paused';
        title.style.marginBottom = '20px';
        menuBox.appendChild(title);

        const resumeButton = document.createElement('button');
        this._styleButton(resumeButton);
        resumeButton.textContent = 'Resume';
        resumeButton.onclick = () => {
            this.hideMenu();
            onResume?.();
        };
        menuBox.appendChild(resumeButton);

        const backButton = document.createElement('button');
        this._styleButton(backButton);
        backButton.textContent = 'Back to Main Menu';
        backButton.onclick = () => {
            this.hideMenu();
            onBackToMenu?.();
        };
        menuBox.appendChild(backButton);

        this.showMenu(menuBox);
    }

    showCrashScreen(onRestart?: () => void, onBackToMenu?: () => void) {
        const menuBox = document.createElement('div');
        this._styleMenuBox(menuBox);

        const title = document.createElement('h2');
        title.textContent = 'You Crashed!';
        title.style.color = 'red';
        title.style.marginBottom = '20px';
        menuBox.appendChild(title);

        const restartButton = document.createElement('button');
        this._styleButton(restartButton);
        restartButton.textContent = 'Restart';
        restartButton.onclick = () => {
            this.hideMenu();
            onRestart?.();
        };
        menuBox.appendChild(restartButton);

        const backButton = document.createElement('button');
        this._styleButton(backButton);
        backButton.textContent = 'Back to Main Menu';
        backButton.onclick = () => {
            this.hideMenu();
            onBackToMenu?.();
        };
        menuBox.appendChild(backButton);

        this.showMenu(menuBox);
    }

    showErrorScreen(message: string) {
        const menuBox = document.createElement('div');
        this._styleMenuBox(menuBox);
        menuBox.style.borderColor = 'red';
        menuBox.style.borderWidth = '2px';
        menuBox.style.borderStyle = 'solid';

        const title = document.createElement('h2');
        title.textContent = 'Error';
        title.style.color = 'red';
        title.style.marginBottom = '15px';
        menuBox.appendChild(title);

        const msgElement = document.createElement('p');
        msgElement.textContent = message;
        msgElement.style.marginBottom = '15px';
        menuBox.appendChild(msgElement);

        // Optionally add a button to acknowledge or go back
        const ackButton = document.createElement('button');
        this._styleButton(ackButton);
        ackButton.textContent = 'Acknowledge';
        ackButton.onclick = () => {
            this.hideMenu();
            // Potentially trigger a state change back to MainMenu or allow retry
        };
        menuBox.appendChild(ackButton);

        this.showMenu(menuBox);
    }

    // --- Helper Styling Methods ---

    private _styleMenuBox(element: HTMLElement) {
        element.style.backgroundColor = 'white';
        element.style.padding = '30px';
        element.style.borderRadius = '5px';
        element.style.textAlign = 'center';
        element.style.minWidth = '250px';
        element.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    }

    private _styleButton(button: HTMLButtonElement) {
        button.style.display = 'block';
        button.style.width = '100%';
        button.style.padding = '10px 0';
        button.style.margin = '10px 0';
        button.style.fontSize = '16px';
        button.style.cursor = 'pointer';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.backgroundColor = '#007bff';
        button.style.color = 'white';
        button.onmouseover = () => button.style.backgroundColor = '#0056b3';
        button.onmouseout = () => button.style.backgroundColor = '#007bff';
    }
}