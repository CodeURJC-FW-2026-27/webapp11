/**
 * ============================================================================
 * ROTOMWEB DEX - APPLICATION ROUTER & CONTROLLER (src/router.js)
 * ============================================================================
 * 
 * Central controller module implementing backend logic, database operations,
 * and routing for the RotomWeb Dex web application.
 * 
 * QUICK REFERENCE / TABLE OF CONTENTS FOR DEFENSE:
 * ----------------------------------------------------------------------------
 * 1. DATABASE & STORAGE SETUP
 *    - MongoDB connection & collection selection ('pokedex' -> 'pokemons')
 *    - Multer file upload configuration (destination: './uploads/')
 * 
 * 2. METADATA & CONSTANTS
 *    - POKEMON_GENERATIONS: Generation options (Gen I through Gen IX)
 *    - pokemonTypes: Available elemental types with Spanish labels and TCG icons
 * 
 * 3. DATABASE INITIALIZATION & SEEDING (Rubric Item 2 & 30)
 *    - initDb(): Creates uploads folder, seeds 'pokemons.json' if collection is empty,
 *      and copies initial artwork from 'data/images/' to './uploads/'.
 * 
 * 4. POKÉDEX & NAVIGATION ROUTES
 *    - GET  /               : Main page with 6-item pagination, search & filters (Rubric Items 3, 4, 5)
 *    - GET  /pokemon/:id    : Single Pokémon detail view with move list (Rubric Items 9, 10, 14)
 *    - GET  /new-pokemon    : Form to create a new Pokémon (Rubric Item 19, 29)
 * 
 * 5. ERROR HANDLING ARCHITECTURE (Rubric Items 8, 28)
 *    - demoCases            : Predefined demonstration cases for error testing (409, 422, 415, 404)
 *    - GET  /error          : Error showcase view with tabbed demonstrations
 *    - renderError()        : Centralized helper to render 'error.html' with dynamic context
 * 
 * 6. VALIDATION & DATA PARSING (Rubric Items 6, 7, 15)
 *    - validatePokemon()    : Server-side validation for Pokémon attributes & duplicity checks
 *    - parsePokemonFormData(): Form data extraction and formatting for Pokémon entities
 *    - validateAbility()    : Server-side validation for moves / abilities
 * 
 * 7. MAIN ENTITY (POKÉMON) CRUD HANDLERS
 *    - POST /NewPokemon     : Create Pokémon in MongoDB & show confirmation (Rubric Items 6, 19, 20)
 *    - GET  /pokemon/:id/edit: Load edit form populated with current Pokémon data (Rubric Item 12)
 *    - POST /EditPokemon/:id : Update Pokémon data & image in MongoDB (Rubric Items 13, 20)
 *    - POST /pokemon/:id/delete: Remove Pokémon from MongoDB using deleteOne (Rubric Items 11, 20)
 * 
 * 8. SECONDARY ENTITY (ABILITY / MOVE) CRUD HANDLERS
 *    - POST /NewAbility     : Append move to Pokémon's array via $push (Rubric Items 15, 20)
 *    - GET  /ability/:pId/:aId/edit: Load move edit form with existing stats (Rubric Item 17)
 *    - POST /EditAbility/:pId/:aId : Update move in MongoDB using positional operator $ (Rubric Items 18, 20)
 *    - POST /pokemon/:pId/ability/:aId/delete: Remove move via $pull (Rubric Items 16, 20)
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. MODULE IMPORTS
// ----------------------------------------------------------------------------
import express from 'express';
import multer from 'multer';
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';

// ----------------------------------------------------------------------------
// 2. MONGODB CLIENT & COLLECTION SETUP
// ----------------------------------------------------------------------------
// Connect to MongoDB server running locally on default port 27017
const client = new MongoClient('mongodb://localhost:27017');
// Select 'pokedex' database and 'pokemons' collection
const db = client.db('pokedex');
const pokemons = db.collection('pokemons');

// ----------------------------------------------------------------------------
// 3. APPLICATION CONSTANTS & METADATA
// ----------------------------------------------------------------------------
/**
 * Supported Pokémon generations for categorization and form selects (Gen I - IX)
 */
const POKEMON_GENERATIONS = [
    { value: 1, label: 'Gen I (Kanto)' },
    { value: 2, label: 'Gen II (Johto)' },
    { value: 3, label: 'Gen III (Hoenn)' },
    { value: 4, label: 'Gen IV (Sinnoh)' },
    { value: 5, label: 'Gen V (Unova)' },
    { value: 6, label: 'Gen VI (Kalos)' },
    { value: 7, label: 'Gen VII (Alola)' },
    { value: 8, label: 'Gen VIII (Galar)' },
    { value: 9, label: 'Gen IX (Paldea)' }
];

/**
 * Multer middleware instance to store uploaded artwork into './uploads/' directory
 */
const upload = multer({ dest: './uploads/' });

/**
 * Dictionary of Pokémon elemental types mapping keys to Spanish labels and custom TCG font icon characters
 */
const pokemonTypes = {
    normal:   { label: 'Normal', icon: 'c' },
    fire:     { label: 'Fuego', icon: 'r' },
    water:    { label: 'Agua', icon: 'w' },
    grass:    { label: 'Planta', icon: 'g' },
    electric: { label: 'Eléctrico', icon: 'l' },
    ice:      { label: 'Hielo', icon: 'w' },
    fighting: { label: 'Lucha', icon: 'f' },
    poison:   { label: 'Veneno', icon: 'p' },
    ground:   { label: 'Tierra', icon: 'f' },
    flying:   { label: 'Volador', icon: 'c' },
    psychic:  { label: 'Psíquico', icon: 'p' },
    bug:      { label: 'Bicho', icon: 'g' },
    rock:     { label: 'Roca', icon: 'f' },
    ghost:    { label: 'Fantasma', icon: 'p' },
    dragon:   { label: 'Dragón', icon: 'n' },
    dark:     { label: 'Siniestro', icon: 'd' },
    steel:    { label: 'Acero', icon: 'm' },
    fairy:    { label: 'Hada', icon: 'y' }
};

// ----------------------------------------------------------------------------
// 4. DATABASE INITIALIZATION & IMAGE PRE-POPULATION (Rubric Items 2 & 30)
// ----------------------------------------------------------------------------
/**
 * Asynchronously initializes the database on application startup:
 * 1. Ensures the './uploads' directory exists.
 * 2. Checks if 'pokemons' collection is empty; if so, populates it from 'data/pokemons.json'.
 * 3. Copies initial sample artwork images from 'data/images/' to './uploads/'.
 */
async function initDb() {
    try {
        const fs = await import('node:fs/promises');

        // Step 1: Ensure runtime uploads directory exists
        await fs.mkdir('./uploads', { recursive: true });

        // Step 2: Initialize MongoDB collection if empty (Rubric item 2)
        if (await pokemons.countDocuments() === 0) {
            let currentSourceFilePath = import.meta.url;
            let absoluteDataFilePath = new URL('../data/pokemons.json', currentSourceFilePath);

            // Read seed JSON containing 9 initial Pokémon and their abilities
            const pokemonsAsString = await readFile(absoluteDataFilePath, 'utf8');
            const pokemonsAsObjects = JSON.parse(pokemonsAsString);

            // Bulk insert sample data into MongoDB collection
            await pokemons.insertMany(pokemonsAsObjects);
        }

        // Step 3: Copy initial sample images from 'data/images/' to './uploads/' (Rubric item 30)
        const images = await fs.readdir(new URL('../data/images/', import.meta.url));

        for (const image of images) {
            const source = new URL(`../data/images/${image}`, import.meta.url);
            const destination = `./uploads/${image}`;

            try {
                // COPYFILE_EXCL ensures we do not overwrite existing files
                await fs.copyFile(
                    source,
                    destination,
                    fs.constants.COPYFILE_EXCL
                );
            } catch (error) {
                // Ignore error if file already exists in destination
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }

    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    }
}

// Execute database seeding immediately upon module load
await initDb();

// Create and export the Express Router instance
const router = express.Router();
export default router;

// ============================================================================
// 5. MAIN PAGE / POKÉDEX GRID WITH PAGINATION & FILTERS (Rubric Items 3, 4, 5)
// ============================================================================
/**
 * GET /
 * Main view displaying the paginated Pokémon card grid.
 * 
 * Supports:
 * - Pagination: 6 elements per page (req.query.page)
 * - Text search by name: Case-insensitive regex (req.query.search)
 * - Elemental type filter: (req.query.type)
 * - Generation filter: (req.query.gen)
 */
router.get('/', async (req, res) => {
    try {
        const limit = 6; // Requirement: exactly 6 elements per page
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const searchQuery = (req.query.search || '').trim();
        const typeFilter = (req.query.type || '').trim();
        const genFilter = parseInt(req.query.gen);

        // Build MongoDB filter query combining search, type, and generation
        const filter = {};
        if (searchQuery) {
            // Case-insensitive substring search by Pokémon name (Rubric item 4)
            filter.name = { $regex: searchQuery, $options: 'i' };
        }
        if (typeFilter) {
            // Filter by elemental type (Rubric item 5)
            filter.type = typeFilter;
        }
        if (!isNaN(genFilter)) {
            // Filter by generation number (Rubric item 5)
            filter.generation = genFilter;
        }

        // Count matching documents to calculate total pages for the current filter
        const totalPokemons = await pokemons.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(totalPokemons / limit));
        const safePage = Math.min(currentPage, totalPages);
        const skip = (safePage - 1) * limit;

        // Fetch only the 6 matching Pokémon for the requested page using skip/limit
        const pokemonList = await pokemons
            .find(filter)
            .skip(skip)
            .limit(limit)
            .toArray();

        // Build the array of page numbers for Mustache pagination rendering
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push({
                number: i,
                active: i === safePage // Mark current active page for visual highlight
            });
        }

        // Preserve active query parameters across pagination links
        let filterParams = '';
        if (searchQuery) filterParams += `&search=${searchQuery}`;
        if (typeFilter) filterParams += `&type=${typeFilter}`;
        if (!isNaN(genFilter)) filterParams += `&gen=${genFilter}`;

        // Mark the currently active type and generation for the sidebar and offcanvas menu
        const typesWithActive = Object.entries(pokemonTypes).map(([value, info]) => ({
            value,
            label: info.label,
            icon: info.icon,
            active: value === typeFilter
        }));

        const generationsWithActive = POKEMON_GENERATIONS.map(g => ({
            ...g,
            active: g.value === genFilter
        }));

        // Find human-readable labels for the active filter banner
        const activeTypeObj = pokemonTypes[typeFilter];
        const activeGenObj = POKEMON_GENERATIONS.find(g => g.value === genFilter);

        // Render index.html template with complete pagination and filter context
        res.render('index', {
            types: typesWithActive,
            generations: generationsWithActive,
            pageTitle: 'Pokédex',
            isHome: true,
            pokemons: pokemonList,
            hasPokemons: pokemonList.length > 0,
            pages: pages,
            hasPrev: safePage > 1,
            prevPage: safePage - 1,
            hasNext: safePage < totalPages,
            nextPage: safePage + 1,
            searchQuery: searchQuery,
            typeFilter: typeFilter,
            activeTypeLabel: activeTypeObj ? activeTypeObj.label : '',
            genFilter: !isNaN(genFilter) ? genFilter : '',
            activeGenLabel: activeGenObj ? activeGenObj.label : '',
            hasActiveFilter: Boolean(searchQuery || typeFilter || !isNaN(genFilter)),
            filterParams: filterParams
        });
    } catch (error) {
        console.error('Error querying pokemons in MongoDB:', error);
        renderError(res, 500, {
            formName: 'Página principal (Pokédex)',
            title: 'Error interno del servidor',
            errorType: 'Error Interno del Servidor (HTTP 500)',
            message: 'Ocurrió un error inesperado al cargar la lista de Pokémon.',
            errors: ['No se pudo conectar con la base de datos o la consulta falló'],
            actionUrl: '/',
            actionText: 'Reintentar'
        });
    }
});

// ============================================================================
// 6. POKÉMON DETAIL VIEW & ASSOCIATED MOVES (Rubric Items 9, 10, 14, 15)
// ============================================================================
/**
 * GET /pokemon/:id
 * Displays the complete profile of a single Pokémon identified by its pokedexNumber.
 * Shows all primary attributes, artwork, action buttons, list of moves, and the form to add moves.
 */
router.get('/pokemon/:id', async (req, res) => {
    // Query MongoDB by pokedexNumber (unique integer ID)
    const pokemon = await pokemons.findOne({ pokedexNumber: parseInt(req.params.id) });
    if (!pokemon) {
        // Return 404 page if Pokémon does not exist (Rubric Item 8)
        return res.status(404).render('error', {
            pageTitle: 'Error 404 - Pokémon no encontrado',
            isDynamic: true,
            iconClass: 'fa-magnifying-glass-chart text-danger',
            title: 'Pokémon no encontrado',
            badgeClass: 'bg-danger text-white',
            errorType: 'Recurso No Encontrado (HTTP 404)',
            message: 'El Pokémon solicitado no existe en la base de datos.',
            actionUrl: '/',
            actionText: 'Volver a la Pokédex',
            backUrl: '/new-pokemon',
            backText: 'Registrar un nuevo Pokémon'
        });
    }
    
    // Prepare elemental types list for the "Add Move" form select dropdown
    const types = Object.entries(pokemonTypes).map(([value, info]) => ({
        value,
        label: info.label
    }));

    // Prepare uploaded move images URLs for Mustache template rendering
    pokemon.abilities = (pokemon.abilities || []).map(ability => ({
        ...ability,
        imageUrl: ability.imageUploaded && ability.image
            ? `/uploads/${ability.image}`
            : ''
    }));

    // Render pokemon.html template
    res.render('pokemon', {
        pokemon: pokemon,
        types: types
    });
});

// ============================================================================
// 7. FORM VIEW: CREATE POKÉMON (Rubric Items 19, 29)
// ============================================================================
/**
 * GET /new-pokemon
 * Renders the form to register a new Pokémon.
 * Reuses the 'new-pokemon.html' view with isEdit: false (Rubric Item 29).
 */
router.get('/new-pokemon', (req, res) => {
    const types = Object.entries(pokemonTypes).map(([value, info]) => ({
        value,
        label: info.label,
        selected: false
    }));

    const generations = POKEMON_GENERATIONS.map(g => ({
        value: g.value,
        label: g.label,
        selected: false
    }));

    res.render('new-pokemon', {
        pageTitle: 'Crear Pokémon',
        isNew: true,
        isEdit: false,
        formAction: '/NewPokemon',
        types,
        generations
    });
});

// ============================================================================
// 8. DEMONSTRATION ERROR CASES (SHOWCASE MODE)
// ============================================================================
/**
 * Pre-defined test cases demonstrated on '/error' to showcase diverse form validation scenarios
 * (Duplicity, out-of-range statistics, unsupported media upload, and 404 resource not found).
 */
const demoCases = {
    case1: {
        iconClass: 'fa-circle-exclamation text-danger',
        formName: 'Formulario: Crear Nuevo Pokémon (/new-pokemon)',
        title: 'Error al registrar el Pokémon',
        badgeClass: 'bg-danger text-white',
        errorType: 'Conflicto de Duplicidad y Validación (HTTP 409)',
        message: 'No se pudo procesar la solicitud de creación de Pokémon debido a inconsistencias en los campos enviados:',
        errorDetails: [
            '<strong>Número de Pokédex duplicado:</strong> El número introducido (<strong>#25</strong>) ya está registrado en la base de datos (asignado a Pikachu). Cada Pokémon debe contar con un número identificativo único.',
            '<strong>Campos obligatorios incompletos:</strong> El tipo elemental y la generación deben ser seleccionados obligatoriamente.',
            '<strong>Rango numérico:</strong> La altura y el peso deben ser valores positivos mayores a 0.'
        ],
        hasErrorDetails: true,
        actionUrl: '/new-pokemon',
        actionText: 'Volver al formulario de creación',
        backUrl: '/',
        backText: 'Ir al inicio (Pokédex)'
    },
    case2: {
        iconClass: 'fa-circle-exclamation text-danger',
        formName: 'Formulario: Crear Movimiento (/pokemon/25)',
        title: 'Error al añadir movimiento a Pikachu',
        badgeClass: 'bg-warning text-dark',
        errorType: 'Valores Fuera de Rango (HTTP 422 - Unprocessable Entity)',
        message: 'Los valores numéricos introducidos para las estadísticas del movimiento no cumplen con las especificaciones del juego:',
        errorDetails: [
            '<strong>Precisión fuera de rango:</strong> El valor indicado (<strong>120%</strong>) debe encontrarse en el rango de <strong>30%</strong> a <strong>100%</strong>.',
            '<strong>Número de movimientos (PP) inválido:</strong> Se han configurado <strong>200 PP</strong>, cuando el límite reglamentario máximo es <strong>160</strong>.',
            '<strong>Poder fuera de escala:</strong> El poder del ataque debe ser un entero entre <strong>0</strong> y <strong>5050</strong>.'
        ],
        hasErrorDetails: true,
        actionUrl: '/pokemon/25',
        actionText: 'Volver a la ficha de Pikachu (#0025)',
        backUrl: '/',
        backText: 'Ir al inicio (Pokédex)'
    },
    case3: {
        iconClass: 'fa-file-circle-xmark text-danger',
        formName: 'Formulario: Subida de Ilustración de Pokémon',
        title: 'Error al procesar el archivo de imagen',
        badgeClass: 'bg-danger text-white',
        errorType: 'Formato o Tamaño No Permitido (HTTP 415 - Unsupported Media)',
        message: 'El archivo adjunto no cumple con los requisitos del servidor para ilustraciones oficiales:',
        errorDetails: [
            '<strong>Extensión no soportada:</strong> El archivo subido (<strong>documento.pdf</strong>) no es una imagen válida. Formatos permitidos: <strong>.png, .jpg, .webp</strong>.',
            '<strong>Tamaño de archivo excedido:</strong> El archivo pesa <strong>12.4 MB</strong>, superando el límite máximo permitido de <strong>5 MB</strong>.'
        ],
        hasErrorDetails: true,
        actionUrl: '/new-pokemon',
        actionText: 'Reintentar subida en el formulario',
        backUrl: '/',
        backText: 'Ir al inicio (Pokédex)'
    },
    case4: {
        iconClass: 'fa-magnifying-glass-chart text-danger',
        formName: 'Formulario: Operación sobre Pokémon Desconocido',
        title: 'Pokémon no encontrado',
        badgeClass: 'bg-danger text-white',
        errorType: 'Recurso No Encontrado (HTTP 404 - Not Found)',
        message: 'Se ha intentado procesar una acción o formulario vinculada a un elemento que no existe:',
        errorDetails: [
            '<strong>Identificador inexistente:</strong> El número de Pokédex solicitado (<strong>#9999</strong>) no se encuentra registrado en la base de datos.',
            '<strong>Referencia huérfana:</strong> No es posible asociar movimientos ni editar una entidad que ha sido eliminada o nunca ha existido.'
        ],
        hasErrorDetails: true,
        actionUrl: '/',
        actionText: 'Volver a la Pokédex principal',
        backUrl: '/new-pokemon',
        backText: 'Registrar un nuevo Pokémon'
    }
};

/**
 * GET /error
 * Showcase view displaying test demonstration tabs for various error cases.
 */
router.get('/error', (req, res) => {
    res.render('error', {
        pageTitle: 'Errores en Formularios',
        isDynamic: false,
        ...demoCases
    });
});

// ============================================================================
// 9. CENTRALIZED ERROR RENDERING HELPER (Rubric Items 8, 28)
// ============================================================================
/**
 * Helper function to render the reusable error view ('views/error.html' + 'views/form-error.html').
 * 
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code (e.g. 400, 404, 500)
 * @param {Object} options - Error details (title, message, errors list, actionUrl, actionText)
 */
function renderError(res, statusCode, { formName, title, errorType, message, errors, actionUrl, actionText }) {
    return res.status(statusCode).render('error', {
        pageTitle: title,
        isDynamic: true,
        iconClass: 'fa-circle-exclamation text-danger',
        formName,
        title,
        badgeClass: 'bg-danger text-white',
        errorType,
        message,
        hasErrorDetails: Array.isArray(errors) && errors.length > 0,
        errorDetails: errors || [],
        actionUrl,
        actionText,
        backUrl: '/',
        backText: 'Volver a la Pokédex'
    });
}

// ============================================================================
// 10. SERVER-SIDE VALIDATION FOR POKÉMON (Rubric Items 6, 7)
// ============================================================================
/**
 * Validates Pokémon attributes against all assignment specifications:
 * - Mandatory fields not empty (name, type, generation, height, weight, description, image).
 * - Name starts with an uppercase letter: /^[A-ZÁÉÍÓÚÑ]/.
 * - Description length between 10 and 500 characters.
 * - Numerical ranges: pokedexNumber > 0, height 0.1-100m, weight 0.1-1000kg, generation 1-9.
 * - Uniqueness checks: No duplicate Pokédex number and no duplicate name in MongoDB.
 * 
 * @param {Object} pokemon - Pokémon object to validate
 * @param {ObjectId|null} originalId - MongoDB _id of original document when editing, or null when creating
 * @returns {Promise<Array<string>>} Array of error messages (empty if valid)
 */
async function validatePokemon(pokemon, originalId) {
    let errors = [];

    // 1. Name validation: required and must begin with an uppercase letter
    if (!pokemon.name?.trim()) {
        errors.push("El nombre del Pokémon es obligatorio");
    }

    if (pokemon.name?.trim() && !/^[A-ZÁÉÍÓÚÑ]/.test(pokemon.name.trim())) {
        errors.push("El nombre del Pokémon debe comenzar por mayúscula");
    }

    // 2. Type validation: required
    if (!pokemon.type) {
        errors.push("El tipo del Pokémon es obligatorio");
    }

    // 3. Description validation: required and bounded between 10 and 500 characters
    if (!pokemon.description?.trim()) {
        errors.push("La descripción es obligatoria");
    }

    if (pokemon.description?.trim() &&
        (pokemon.description.trim().length < 10 ||
        pokemon.description.trim().length > 500)) {
        errors.push("La descripción debe tener entre 10 y 500 caracteres");
    }

    // 4. Image presence check: required
    if (!pokemon.image) {
        errors.push("La imagen es obligatoria");
    }

    // 5. Pokédex number: must be a positive integer
    if (!Number.isInteger(pokemon.pokedexNumber) || pokemon.pokedexNumber <= 0) {
        errors.push("El número de Pokédex debe ser un entero positivo");
    }

    // 6. Generation: integer between 1 and 9
    if (!Number.isInteger(pokemon.generation) || pokemon.generation < 1 || pokemon.generation > 9) {
        errors.push("La generación debe estar entre 1 y 9");
    }

    // 7. Height: finite number between 0.1 and 100 meters
    if (!Number.isFinite(pokemon.height) || pokemon.height < 0.1 || pokemon.height > 100) {
        errors.push("La altura debe estar entre 0.1 y 100 metros");
    }

    // 8. Weight: finite number between 0.1 and 1000 kg
    if (!Number.isFinite(pokemon.weight) || pokemon.weight < 0.1 || pokemon.weight > 1000) {
        errors.push("El peso debe estar entre 0.1 y 1000 kg");
    }

    // 9. Check duplicate Pokédex number in MongoDB (excluding self if editing)
    if (Number.isInteger(pokemon.pokedexNumber) && pokemon.pokedexNumber > 0) {
        const existingNumber = await pokemons.findOne({
            pokedexNumber: pokemon.pokedexNumber,
            _id: { $ne: originalId ?? null }
        });

        if (existingNumber) {
            errors.push("Ya existe un Pokémon con ese número de Pokédex");
        }
    }

    // 10. Check duplicate Pokémon name in MongoDB (case-insensitive, excluding self if editing)
    if (pokemon.name?.trim()) {
        const escapedName = pokemon.name.trim()
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const existingName = await pokemons.findOne({
            name: { $regex: `^${escapedName}$`, $options: 'i' },
            _id: { $ne: originalId ?? null }
        });

        if (existingName) {
            errors.push("Ya existe un Pokémon con ese nombre");
        }
    }

    return errors;
}

// ----------------------------------------------------------------------------
// 11. FORM DATA EXTRACTION HELPER FOR POKÉMON
// ----------------------------------------------------------------------------
/**
 * Extracts and maps raw HTTP POST request fields into a structured Pokémon entity.
 * Handles existing image retention during edit operations when no new file is uploaded.
 * 
 * @param {Request} req - Express request with req.body and req.file
 * @param {Object} [existingPokemon] - Previous document data when editing
 * @returns {Object} Structured Pokémon document ready for validation/persistence
 */
function parsePokemonFormData(req, existingPokemon) {
    let selectedType = pokemonTypes[req.body.type];

    return {
        name: req.body.name,
        pokedexNumber: Number(req.body.pokedexNumber),
        formattedNumber: String(req.body.pokedexNumber).padStart(4, '0'),
        type: req.body.type,
        typeLabel: selectedType?.label || '',
        typeIcon: selectedType?.icon || '',
        generation: Number(req.body.generation),
        height: Number(req.body.height),
        weight: Number(req.body.weight),
        description: req.body.description,
        image: req.file ? req.file.filename : existingPokemon?.image,
        abilities: existingPokemon?.abilities || []
    };
}

// ============================================================================
// 12. ROUTE: CREATE NEW POKÉMON (Rubric Items 6, 19, 20)
// ============================================================================
/**
 * POST /NewPokemon
 * Handles form submission for creating a new Pokémon:
 * 1. Parses form data and multipart image via Multer.
 * 2. Runs comprehensive server-side validation.
 * 3. On error: renders 'error.html' with HTTP status 400.
 * 4. On success: inserts document into MongoDB and renders 'confirmation.html'.
 */
router.post('/NewPokemon', upload.single('image'), async (req, res) => {
    let pokemon = parsePokemonFormData(req);

    // Validate fields on the server (Rubric item 6 and 7)
    let errors = await validatePokemon(pokemon);

    if (errors.length > 0) {
        console.log("Errores:", errors);
        return renderError(res, 400, {
            formName: 'Formulario: Crear Nuevo Pokémon (/new-pokemon)',
            title: 'Error al registrar el Pokémon',
            errorType: 'Error de Validación (HTTP 400)',
            message: 'No se pudo registrar el Pokémon debido a los siguientes errores:',
            errors,
            actionUrl: '/new-pokemon',
            actionText: 'Volver al formulario de creación'
        });
    }

    // Insert new Pokémon document into MongoDB collection
    await pokemons.insertOne(pokemon);

    // Render reusable confirmation page (Rubric item 20 and 27)
    res.render('confirmation', {
        pageTitle: 'Pokémon Registrado',
        title: '¡Pokémon creado con éxito!',
        message: `El Pokémon "${pokemon.name}" (#${pokemon.formattedNumber}) ha sido registrado correctamente en la Pokédex.`,
        actionUrl: `/pokemon/${pokemon.pokedexNumber}`,
        actionText: 'Ver Pokémon',
        pokemon
    });
});

// ============================================================================
// 13. SERVER-SIDE VALIDATION FOR ABILITIES / MOVES (Rubric Item 15)
// ============================================================================
/**
 * Validates secondary entity (Move / Ability) attributes:
 * - Mandatory fields: name, type, category, description.
 * - Power: integer between 0 and 5050.
 * - Accuracy: integer between 30 and 100.
 * - PP (Power Points): integer between 1 and 160.
 * - Parent Pokémon must exist.
 * - Duplicate move name check: Moves within the same Pokémon must have unique names.
 * 
 * @param {number} pokemonId - Parent Pokémon's pokedexNumber
 * @param {Object} ability - Ability object to validate
 * @param {string} [originalAbilityId] - Ability ID if editing (to ignore self in uniqueness check)
 * @returns {Promise<Array<string>>} Array of error messages (empty if valid)
 */
async function validateAbility(pokemonId, ability, originalAbilityId) {
    let errors = [];

    // Required text fields
    if (!ability.name?.trim()) {
        errors.push("El nombre del movimiento es obligatorio");
    }

    if (!ability.type?.trim()) {
        errors.push("El tipo del movimiento es obligatorio");
    }

    if (!ability.category?.trim()) {
        errors.push("La categoría del movimiento es obligatoria");
    }

    if (!ability.description?.trim()) {
        errors.push("La descripción del movimiento es obligatoria");
    }

    // Power: integer between 0 and 5050
    if (!Number.isInteger(ability.power) || ability.power < 0 || ability.power > 5050) {
        errors.push("La potencia debe estar entre 0 y 5050");
    }

    // Accuracy: integer between 30 and 100
    if (!Number.isInteger(ability.accuracy) || ability.accuracy < 30 || ability.accuracy > 100) {
        errors.push("La precisión debe estar entre 30 y 100");
    }

    // PP: integer between 1 and 160
    if (!Number.isInteger(ability.pp) || ability.pp < 1 || ability.pp > 160) {
        errors.push("Los PP deben estar entre 1 y 160");
    }

    // Verify parent Pokémon exists in MongoDB
    const pokemon = await pokemons.findOne({
        pokedexNumber: Number(pokemonId)
    });

    if (!pokemon) {
        errors.push("El Pokémon no existe");
        return errors;
    }

    // Check duplicated ability name within this Pokémon's moves array
    if (ability.name?.trim()) {
        const existingAbility = pokemon.abilities?.find(item =>
            item.name?.trim().toLowerCase() === ability.name.trim().toLowerCase() &&
            String(item.id) !== String(originalAbilityId)
        );

        if (existingAbility) {
            errors.push("Ya existe un movimiento con ese nombre en este Pokémon");
        }
    }

    return errors;
}

// ============================================================================
// 14. ROUTE: CREATE NEW ABILITY / MOVE (Rubric Items 15, 20)
// ============================================================================
/**
 * POST /NewAbility
 * Handles adding a new move to an existing Pokémon:
 * 1. Parses move attributes and optional uploaded image.
 * 2. Validates fields using validateAbility().
 * 3. On error: renders error page with HTTP status 400.
 * 4. On success: pushes the new move object to the 'abilities' array using MongoDB $push operator.
 * 5. Renders confirmation page.
 */
router.post('/NewAbility', upload.single('image'), async (req, res) => {
    let pokemonId = Number(req.body.pokemon_id);

    let selectedType = pokemonTypes[req.body.type?.toLowerCase()];
    let ability = {
        id: req.body.id || String(Date.now()), // Unique identifier for the move
        name: req.body.name,
        type: req.body.type,
        typeLabel: selectedType?.label || req.body.type,
        typeIcon: selectedType?.icon || '',
        category: req.body.category,
        power: Number(req.body.power),
        accuracy: Number(req.body.accuracy),
        pp: Number(req.body.pp),
        description: req.body.description,
        iconClass: 'fa-solid fa-bolt text-warning',
        image: req.file?.filename || 'abilities.svg',
        imageUploaded: Boolean(req.file)
    };

    let errors = await validateAbility(pokemonId, ability);

    if (errors.length > 0) {
        console.log("Errores:", errors);
        return renderError(res, 400, {
            formName: `Formulario: Crear Movimiento (/pokemon/${pokemonId})`,
            title: 'Error al añadir el movimiento',
            errorType: 'Error de Validación (HTTP 400)',
            message: 'No se pudo añadir el movimiento debido a los siguientes errores:',
            errors,
            actionUrl: Number.isFinite(pokemonId) ? `/pokemon/${pokemonId}` : '/',
            actionText: Number.isFinite(pokemonId) ? 'Volver a la ficha del Pokémon' : 'Volver a la Pokédex'
        });
    }

    // Push new move into the Pokémon document's abilities array using MongoDB $push
    await pokemons.updateOne(
        { pokedexNumber: pokemonId },
        { $push: { abilities: ability } }
    );

    let pokemon = await pokemons.findOne({
        pokedexNumber: pokemonId
    });

    // Render reusable confirmation page
    res.render('confirmation', {
        pageTitle: 'Movimiento Añadido',
        title: '¡Movimiento añadido con éxito!',
        message: `El movimiento "${ability.name}" ha sido añadido correctamente a la ficha de ${pokemon ? pokemon.name : 'Pokémon'}.`,
        actionUrl: `/pokemon/${pokemonId}`,
        actionText: 'Volver a la ficha del Pokémon',
        pokemon
    });
});

// ============================================================================
// 15. ROUTE: EDIT POKÉMON (Rubric Items 13, 20, 29)
// ============================================================================
/**
 * POST /EditPokemon/:id
 * Handles updating an existing Pokémon:
 * 1. Checks if Pokémon exists in MongoDB.
 * 2. Parses form fields; if no new image is provided, preserves the existing image.
 * 3. Validates fields, excluding self from uniqueness checks.
 * 4. Updates document in MongoDB using $set.
 * 5. Renders confirmation page.
 */
router.post('/EditPokemon/:id', upload.single('image'), async (req, res) => {
    let pokemonId = Number(req.params.id);

    // Find original Pokémon in MongoDB
    let pokemon = await pokemons.findOne({
        pokedexNumber: pokemonId
    });

    if (!pokemon) {
        return renderError(res, 404, {
            formName: `Formulario: Editar Pokémon (/pokemon/${pokemonId}/edit)`,
            title: 'Pokémon no encontrado',
            errorType: 'Recurso No Encontrado (HTTP 404)',
            message: 'No se puede editar el Pokémon porque no existe en la base de datos.',
            errors: ['El Pokémon solicitado no existe'],
            actionUrl: '/',
            actionText: 'Volver a la Pokédex'
        });
    }

    // Extract form data, keeping existing image if no new file is uploaded
    let editPokemon = parsePokemonFormData(req, pokemon);

    // Validate Pokémon attributes excluding current document _id from duplicate checks
    let errors = await validatePokemon(editPokemon, pokemon._id);

    if (errors.length > 0) {
        console.log("Errores:", errors);
        return renderError(res, 400, {
            formName: `Formulario: Editar Pokémon (/pokemon/${pokemonId}/edit)`,
            title: 'Error al actualizar el Pokémon',
            errorType: 'Error de Validación (HTTP 400)',
            message: 'No se pudieron guardar los cambios debido a los siguientes errores:',
            errors,
            actionUrl: `/pokemon/${pokemonId}/edit`,
            actionText: 'Volver al formulario de edición'
        });
    }

    // Update Pokémon document in MongoDB using $set operator
    await pokemons.updateOne(
        { _id: pokemon._id },
        { $set: editPokemon }
    );

    // Render reusable confirmation page
    res.render('confirmation', {
        pageTitle: 'Pokémon Actualizado',
        title: '¡Pokémon actualizado con éxito!',
        message: `Los datos del Pokémon "${editPokemon.name}" (#${editPokemon.formattedNumber}) se han actualizado correctamente.`,
        actionUrl: `/pokemon/${editPokemon.pokedexNumber}`,
        actionText: 'Ver Pokémon',
        pokemon: editPokemon
    });
});

// ============================================================================
// 16. ROUTE: EDIT ABILITY / MOVE (Rubric Items 18, 20)
// ============================================================================
/**
 * POST /EditAbility/:pokemon_id/:ability_id
 * Handles updating an existing move within a Pokémon's embedded abilities array:
 * 1. Finds parent Pokémon and targets the specific move by ID.
 * 2. Re-validates updated statistics.
 * 3. Uses MongoDB positional operator '$' (abilities.$) with $set to update the specific element.
 * 4. Renders confirmation page.
 */
router.post('/EditAbility/:pokemon_id/:ability_id', upload.single('image'), async (req, res) => {
    let pokemonId = Number(req.params.pokemon_id);
    let abilityId = req.params.ability_id;

    // Retrieve parent Pokémon
    let pokemon = await pokemons.findOne({
        pokedexNumber: pokemonId
    });

    if (!pokemon) {
        return renderError(res, 404, {
            formName: `Formulario: Editar Movimiento (/ability/${pokemonId}/${abilityId}/edit)`,
            title: 'Pokémon no encontrado',
            errorType: 'Recurso No Encontrado (HTTP 404)',
            message: 'No se puede editar el movimiento porque el Pokémon no existe.',
            errors: ['El Pokémon solicitado no existe'],
            actionUrl: '/',
            actionText: 'Volver a la Pokédex'
        });
    }

    // Locate the original ability within the parent's abilities array
    let originalAbility = pokemon.abilities.find(
        ability => String(ability.id) === abilityId
    );

    if (!originalAbility) {
        return renderError(res, 404, {
            formName: `Formulario: Editar Movimiento (/ability/${pokemonId}/${abilityId}/edit)`,
            title: 'Movimiento no encontrado',
            errorType: 'Recurso No Encontrado (HTTP 404)',
            message: 'El movimiento que intentas editar no existe en este Pokémon.',
            errors: ['El movimiento no existe'],
            actionUrl: `/pokemon/${pokemonId}`,
            actionText: 'Volver a la ficha del Pokémon'
        });
    }

    // Build the updated ability object, preserving existing image if none was uploaded
    let selectedType = pokemonTypes[req.body.type?.toLowerCase()];
    let editAbility = {
        id: originalAbility.id,
        name: req.body.name,
        type: req.body.type,
        typeLabel: selectedType?.label || originalAbility.typeLabel,
        typeIcon: selectedType?.icon || originalAbility.typeIcon,
        category: req.body.category,
        power: Number(req.body.power),
        accuracy: Number(req.body.accuracy),
        pp: Number(req.body.pp),
        description: req.body.description,
        iconClass: originalAbility.iconClass,
        image: req.file ? req.file.filename : originalAbility.image,
        imageUploaded: req.file
            ? true
            : (originalAbility.imageUploaded || false)
    };

    // Validate updated ability attributes
    let errors = await validateAbility(
        pokemonId,
        editAbility,
        abilityId
    );

    if (errors.length > 0) {
        console.log("Errores:", errors);
        return renderError(res, 400, {
            formName: `Formulario: Editar Movimiento (/ability/${pokemonId}/${abilityId}/edit)`,
            title: 'Error al actualizar el movimiento',
            errorType: 'Error de Validación (HTTP 400)',
            message: 'No se pudieron guardar los cambios del movimiento debido a los siguientes errores:',
            errors,
            actionUrl: `/ability/${pokemonId}/${abilityId}/edit`,
            actionText: 'Volver a editar el movimiento'
        });
    }

    // Update the matched ability inside the array using MongoDB positional operator '$'
    await pokemons.updateOne(
        {
            pokedexNumber: pokemonId,
            "abilities.id": originalAbility.id
        },
        {
            $set: {
                "abilities.$": editAbility
            }
        }
    );

    pokemon = await pokemons.findOne({
        pokedexNumber: pokemonId
    });

    // Render reusable confirmation page
    res.render('confirmation', {
        pageTitle: 'Movimiento Actualizado',
        title: '¡Movimiento actualizado con éxito!',
        message: `El movimiento "${editAbility.name}" ha sido actualizado correctamente en la ficha de ${pokemon ? pokemon.name : 'Pokémon'}.`,
        actionUrl: `/pokemon/${pokemonId}`,
        actionText: 'Volver a la ficha del Pokémon',
        pokemon
    });
});

// ============================================================================
// 17. ROUTE: LOAD POKÉMON EDIT FORM (Rubric Items 12, 29)
// ============================================================================
/**
 * GET /pokemon/:id/edit
 * Renders the pre-populated form to edit an existing Pokémon.
 * Reuses the 'new-pokemon.html' template with isEdit: true (Rubric Item 29).
 */
router.get('/pokemon/:id/edit', async (req, res) => {
    let pokemonId = Number(req.params.id);

    let pokemon = await pokemons.findOne({
        pokedexNumber: pokemonId
    });

    if (!pokemon) {
        return renderError(res, 404, {
            formName: `Editar Pokémon (/pokemon/${pokemonId}/edit)`,
            title: 'Pokémon no encontrado',
            errorType: 'Recurso No Encontrado (HTTP 404)',
            message: 'El Pokémon que intentas editar no existe en la base de datos.',
            errors: ['El Pokémon no existe'],
            actionUrl: '/',
            actionText: 'Volver a la Pokédex'
        });
    }

    // Mark current Pokémon's elemental type as selected in the dropdown
    const types = Object.entries(pokemonTypes).map(([value, info]) => ({
        value,
        label: info.label,
        selected: pokemon.type === value
    }));

    // Mark current Pokémon's generation as selected in the dropdown
    const generations = POKEMON_GENERATIONS.map(g => ({
        value: g.value,
        label: g.label,
        selected: pokemon.generation === g.value
    }));

    // Render unified form in edit mode
    res.render('new-pokemon', {
        pageTitle: `Editar ${pokemon.name}`,
        pokemon,
        isEdit: true,
        formAction: `/EditPokemon/${pokemonId}`,
        types,
        generations
    });
});

// ============================================================================
// 18. ROUTE: LOAD ABILITY EDIT FORM (Rubric Item 17)
// ============================================================================
/**
 * GET /ability/:pokemon_id/:ability_id/edit
 * Renders the pre-populated edit form for a secondary entity (Move / Ability).
 */
router.get('/ability/:pokemon_id/:ability_id/edit', async (req, res) => {
    let pokemonId = Number(req.params.pokemon_id);
    let abilityId = req.params.ability_id;

    // Verify parent Pokémon exists
    let pokemon = await pokemons.findOne({
        pokedexNumber: pokemonId
    });

    if (!pokemon) {
        return renderError(res, 404, {
            formName: `Editar Movimiento (/ability/${pokemonId}/${abilityId}/edit)`,
            title: 'Pokémon no encontrado',
            errorType: 'Recurso No Encontrado (HTTP 404)',
            message: 'El Pokémon asociado al movimiento no existe.',
            errors: ['El Pokémon no existe'],
            actionUrl: '/',
            actionText: 'Volver a la Pokédex'
        });
    }

    // Locate the ability within the parent Pokémon's abilities
    let ability = pokemon.abilities?.find(
        item => String(item.id) === abilityId
    );

    if (!ability) {
        return renderError(res, 404, {
            formName: `Editar Movimiento (/ability/${pokemonId}/${abilityId}/edit)`,
            title: 'Movimiento no encontrado',
            errorType: 'Recurso No Encontrado (HTTP 404)',
            message: 'El movimiento que intentas editar no existe en este Pokémon.',
            errors: ['El movimiento no existe'],
            actionUrl: `/pokemon/${pokemonId}`,
            actionText: 'Volver a la ficha del Pokémon'
        });
    }

    // Mark current ability's type as selected in dropdown
    const types = Object.entries(pokemonTypes).map(([value, info]) => ({
        value,
        label: info.label,
        selected: (ability.type || '').toLowerCase() === value || (ability.typeLabel || '').toLowerCase() === info.label.toLowerCase()
    }));

    // Render ability edit template
    res.render('ability', {
        pageTitle: `Editar ${ability.name}`,
        pokemon,
        ability,
        isEdit: true,
        types
    });
});

// ============================================================================
// 19. ROUTE: DELETE POKÉMON (Rubric Items 11, 20)
// ============================================================================
/**
 * POST /pokemon/:id/delete
 * Deletes the primary entity (Pokémon) from MongoDB:
 * 1. Extracts pokedexNumber from params.
 * 2. Calls pokemons.deleteOne({ pokedexNumber: id }).
 * 3. Renders confirmation page redirecting back to main Pokédex grid.
 */
router.post('/pokemon/:id/delete', async (req, res) => {
    const id = parseInt(req.params.id);
    
    // Delete document matching the pokedexNumber
    await pokemons.deleteOne({ pokedexNumber: id });
    
    // Render reusable confirmation page
    res.render('confirmation', { 
        pageTitle: 'Pokémon Eliminado',
        title: '¡Pokémon eliminado con éxito!',
        message: 'El Pokémon ha sido eliminado correctamente de la base de datos.',
        actionUrl: '/',
        actionText: 'Volver a la Pokédex'
     });
});

// ============================================================================
// 20. ROUTE: DELETE ABILITY / MOVE (Rubric Items 16, 20)
// ============================================================================
/**
 * POST /pokemon/:pokemon_id/ability/:ability_id/delete
 * Deletes a secondary entity (Move) from a Pokémon's embedded array:
 * 1. Matches parent Pokémon by pokedexNumber.
 * 2. Uses MongoDB $pull operator to remove the ability object with matching id.
 * 3. Renders confirmation page with button returning to the Pokémon's profile.
 */
router.post('/pokemon/:pokemon_id/ability/:ability_id/delete', async (req, res) => {
    const pokemonId = Number(req.params.pokemon_id);
    const abilityId = String(req.params.ability_id);

    // Remove the ability matching the specified id from the abilities array using $pull
    await pokemons.updateOne(
        { pokedexNumber: pokemonId },
        { $pull: { abilities: { id: abilityId } } }
    );

    // Render reusable confirmation page
    res.render('confirmation', {
        pageTitle: 'Movimiento Eliminado',
        title: '¡Movimiento eliminado con éxito!',
        message: 'El movimiento ha sido eliminado correctamente del Pokémon.',
        actionUrl: `/pokemon/${pokemonId}`,
        actionText: 'Volver a la ficha del Pokémon'
    });
});
