// --- MAIN INITIALIZATION ---

// Initialize Lucide icons
lucide.createIcons();

// Initialize 3D renderer
init3D();

// Create game instance using new comprehensive engine
const gameEngine = new CNAGameEngine();
const game = gameEngine; // Backwards compatibility
GLOBAL_GAME_REF = gameEngine;

// Render terrain
renderTerrain(gameEngine.gameState.map); 

// Start game loop
gameEngine.loop();

// Log initialization
logger.log('[1.0]', 'Campaign for North Africa - Comprehensive Rules Engine Initialized', 'INFO');
logger.log('[2.0]', 'Game setup complete - Rules 1-30 implemented', 'INFO');

// Make logger globally accessible for console commands
window.logger = logger;
window.gameEngine = gameEngine;

