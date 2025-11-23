// --- MAIN INITIALIZATION ---

// Initialize Lucide icons
lucide.createIcons();

// Initialize 3D renderer
init3D();

// Create game instance
const game = new Game();
GLOBAL_GAME_REF = game;

// Render terrain
renderTerrain(game.map); 

// Start game loop
game.loop();

