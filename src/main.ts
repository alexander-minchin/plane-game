import { GameManager } from './core/GameManager';
import { GameConfig } from './core/types';
import './style.css'; // Keep basic styling

// Basic game configuration
const config: GameConfig = {
    debugMode: true, // Example configuration
    // Add other necessary configurations
};

// Ensure the DOM is ready before initializing the game
document.addEventListener('DOMContentLoaded', () => {
    // Get the main game container
    const gameContainerElement = document.getElementById('game-container');
    if (gameContainerElement) {
        // Optional: Clear any initial content if needed
        // gameContainerElement.innerHTML = '';
        // The UIManager and Renderer will manage content within this container
    } else {
        // This error should ideally not happen now if index.html is correct
        console.error("Game container element ('game-container') not found!");
        return;
    }

    // Initialize and start the game
    try {
        const gameManager = new GameManager(config);

        // Player object and terrain chunks are now added to the main scene
        // managed by the Renderer, coordinated by GameManager/TerrainManager/PlayerController.
        // No need for manual scene manipulation here.

        gameManager.start();
    } catch (error) {
        console.error("Failed to initialize or start the game:", error);
        // Display error message within the game container
        if (gameContainerElement) {
            gameContainerElement.innerHTML = `<div style="color: red; padding: 20px;">Error initializing game. See console for details.</div>`;
        }
    }
});
