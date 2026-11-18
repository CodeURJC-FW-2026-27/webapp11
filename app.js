/**
 * ============================================================================
 * ROTOMWEB DEX - SERVER ENTRY POINT (app.js)
 * ============================================================================
 * 
 * Main configuration and startup script for the Express web server.
 * 
 * Key Responsibilities:
 * - Initializes the Express application instance.
 * - Serves static files: CSS, fonts, and client assets from './public'.
 * - Serves runtime uploaded entity images from './uploads'.
 * - Configures Mustache-Express as the server-side templating view engine.
 * - Parses URL-encoded HTTP POST form data (application/x-www-form-urlencoded).
 * - Mounts the central application router from './src/router.js'.
 * - Starts the HTTP listener on port 3000.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. MODULE IMPORTS
// ----------------------------------------------------------------------------
import express from 'express';
import mustacheExpress from 'mustache-express';
import bodyParser from 'body-parser';
import router from './src/router.js';

// ----------------------------------------------------------------------------
// 2. APPLICATION INITIALIZATION
// ----------------------------------------------------------------------------
const app = express();

// ----------------------------------------------------------------------------
// 3. STATIC FILE SERVING MIDDLEWARE
// ----------------------------------------------------------------------------
// Serve static client resources (stylesheets, template fonts, branding images)
app.use(express.static('./public'));

// Serve user-uploaded and pre-seeded entity images dynamically under '/uploads'
app.use('/uploads', express.static('./uploads'));

// ----------------------------------------------------------------------------
// 4. VIEW ENGINE CONFIGURATION (MUSTACHE)
// ----------------------------------------------------------------------------
// Configure Mustache template engine for '.html' extension files
app.set('view engine', 'html');
app.engine('html', mustacheExpress(), ".html");

// Specify the directory containing HTML view templates and Mustache partials
app.set('views', './views');

// ----------------------------------------------------------------------------
// 5. BODY PARSER MIDDLEWARE
// ----------------------------------------------------------------------------
// Parse incoming form submissions encoded in application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// ----------------------------------------------------------------------------
// 6. APPLICATION ROUTER MOUNTING
// ----------------------------------------------------------------------------
// Mount all route handlers (Pokédex, detail, CRUD for Pokémon and moves)
app.use('/', router);

// ----------------------------------------------------------------------------
// 7. SERVER STARTUP
// ----------------------------------------------------------------------------
// Start listening for incoming HTTP connections on port 3000
app.listen(3000, () => console.log('Web ready in http://localhost:3000/'));
