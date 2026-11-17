import express from 'express';
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('pokedex');
const pokemons = db.collection('pokemons');

const POKEMON_TYPES = [
    { value: 'grass', label: 'Planta', icon: 'g' },
    { value: 'fire', label: 'Fuego', icon: 'f' },
    { value: 'water', label: 'Agua', icon: 'w' },
    { value: 'electric', label: 'Eléctrico', icon: 'l' },
    { value: 'psychic', label: 'Psíquico', icon: 'p' },
    { value: 'dragon', label: 'Dragón', icon: 'n' },
    { value: 'normal', label: 'Normal', icon: 'c' },
    { value: 'ghost', label: 'Fantasma', icon: 'p' }
];

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


async function initDb() {
    try {
        if (await pokemons.countDocuments() === 0) {
            let currentSourceFilePath = import.meta.url;
            let absoluteDataFilePath = new URL('../data/pokemons.json', currentSourceFilePath);
            const pokemonsAsString = await readFile(absoluteDataFilePath, 'utf8');
            const pokemonsAsObjects = JSON.parse(pokemonsAsString);

            await pokemons.insertMany(pokemonsAsObjects);
        }
    } catch (error) {
        console.log('Error al inicializar la base de datos');
    }
}

await initDb();

const router = express.Router();
export default router;

router.get('/', async (req, res) => {
    try {
        const limit = 6; // Requirement: 6 elements per page
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const searchQuery = (req.query.search || '').trim();
        const typeFilter = (req.query.type || '').trim();
        const genFilter = parseInt(req.query.gen);

        // Build MongoDB filter query combining search, type, and generation
        const filter = {};
        if (searchQuery) {
            filter.name = { $regex: searchQuery,$options: 'i' };
        }
        if (typeFilter) {
            filter.type = typeFilter;
        }
        if (!isNaN(genFilter)) {
            filter.generation = genFilter;
        }

        // Count matching documents to calculate total pages for the current filter
        const totalPokemons = await pokemons.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(totalPokemons / limit));
        const safePage = Math.min(currentPage, totalPages);
        const skip = (safePage - 1) * limit;

        // Fetch only the 6 matching Pokémon for the requested page
        const pokemonList = await pokemons
            .find(filter)
            .skip(skip)
            .limit(limit)
            .toArray();

        // Build the array of page numbers for Mustache
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push({
                number: i,
                active: i === safePage
            });
        }

        // Preserve active filters across pagination links
        let filterParams = '';
        if (searchQuery) filterParams += `&search=${searchQuery}`;
        if (typeFilter) filterParams += `&type=${typeFilter}`;
        if (!isNaN(genFilter)) filterParams += `&gen=${genFilter}`;

        // Mark the currently active type and generation for the sidebar menu
        const typesWithActive = POKEMON_TYPES.map(t => ({
            ...t,
            active: t.value === typeFilter
        }));

        const generationsWithActive = POKEMON_GENERATIONS.map(g => ({
            ...g,
            active: g.value === genFilter
        }));

        // Find human-readable labels for the active filter banner
        const activeTypeObj = POKEMON_TYPES.find(t => t.value === typeFilter);
        const activeGenObj = POKEMON_GENERATIONS.find(g => g.value === genFilter);

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
        res.status(500).send('Error interno del servidor');
    }
});

router.get('/index', (req, res) => res.redirect('/'));
router.get('/index.html', (req, res) => res.redirect('/'));


router.get('/pokemon/:id', async (req, res) => {
    const pokemon = await pokemons.findOne({ pokedexNumber: parseInt(req.params.id) })
    res.render('pokemon', {
        pokemon: pokemon
    });
});

// Demonstration cases data for the error showcase
const demoCases = {
    case1: {
        iconClass: 'fa-circle-exclamation text-danger',
        formName: 'Formulario: Crear Nuevo Pokémon (/new-pokemon.html)',
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
        actionUrl: '/new-pokemon.html',
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
        actionUrl: '/new-pokemon.html',
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
        backUrl: '/new-pokemon.html',
        backText: 'Registrar un nuevo Pokémon'
    }
};

router.get('/error', (req, res) => {
    res.render('error', {
        pageTitle: 'Errores en Formularios',
        isDynamic: false,
        ...demoCases
    });
});

router.get('/error.html', (req, res) => res.redirect('/error'));

