import express from 'express';
import multer from 'multer';
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('pokedex');
const pokemons = db.collection('pokemons');

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

const upload = multer({ dest: './uploads/' });
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

async function initDb() {
    try {
        const fs = await import('node:fs/promises');

        // Create uploads folder
        await fs.mkdir('./uploads', { recursive: true });

        // Initialize database if empty
        if (await pokemons.countDocuments() === 0) {
            let currentSourceFilePath = import.meta.url;
            let absoluteDataFilePath = new URL('../data/pokemons.json', currentSourceFilePath);

            const pokemonsAsString = await readFile(absoluteDataFilePath, 'utf8');
            const pokemonsAsObjects = JSON.parse(pokemonsAsString);

            await pokemons.insertMany(pokemonsAsObjects);
        }

        // Copy initial Pokémon images
        const images = await fs.readdir(new URL('../data/images/', import.meta.url));

        for (const image of images) {
            const source = new URL(`../data/images/${image}`, import.meta.url);
            const destination = `./uploads/${image}`;

            try {
                await fs.copyFile(
                    source,
                    destination,
                    fs.constants.COPYFILE_EXCL
                );
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }

    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
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
            filter.name = { $regex: searchQuery, $options: 'i' };
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

router.get('/pokemon/:id', async (req, res) => {
    const pokemon = await pokemons.findOne({ pokedexNumber: parseInt(req.params.id) });
    if (!pokemon) {
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
    const types = Object.entries(pokemonTypes).map(([value, info]) => ({
        value,
        label: info.label
    }));
    res.render('pokemon', {
        pokemon: pokemon,
        types: types
    });
});

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

// Demonstration cases data for the error showcase
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

router.get('/error', (req, res) => {
    res.render('error', {
        pageTitle: 'Errores en Formularios',
        isDynamic: false,
        ...demoCases
    });
});

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

async function validatePokemon(pokemon, originalId) {
    let errors = [];

    // Name validation
    if (!pokemon.name?.trim()) {
        errors.push("El nombre del Pokémon es obligatorio");
    }

    if (pokemon.name?.trim() && !/^[A-ZÁÉÍÓÚÑ]/.test(pokemon.name.trim())) {
        errors.push("El nombre del Pokémon debe comenzar por mayúscula");
    }

    if (!pokemon.type) {
        errors.push("El tipo del Pokémon es obligatorio");
    }

    // Description validation
    if (!pokemon.description?.trim()) {
        errors.push("La descripción es obligatoria");
    }

    if (pokemon.description?.trim() &&
        (pokemon.description.trim().length < 10 ||
        pokemon.description.trim().length > 500)) {
        errors.push("La descripción debe tener entre 10 y 500 caracteres");
    }

    if (!pokemon.image) {
        errors.push("La imagen es obligatoria");
    }

    // Pokedex number: positive integer
    if (!Number.isInteger(pokemon.pokedexNumber) || pokemon.pokedexNumber <= 0) {
        errors.push("El número de Pokédex debe ser un entero positivo");
    }

    // Generation: integer between 1 and 9
    if (!Number.isInteger(pokemon.generation) || pokemon.generation < 1 || pokemon.generation > 9) {
        errors.push("La generación debe estar entre 1 y 9");
    }

    // Height: between 0.1 and 100
    if (!Number.isFinite(pokemon.height) || pokemon.height < 0.1 || pokemon.height > 100) {
        errors.push("La altura debe estar entre 0.1 y 100 metros");
    }

    // Weight: between 0.1 and 1000
    if (!Number.isFinite(pokemon.weight) || pokemon.weight < 0.1 || pokemon.weight > 1000) {
        errors.push("El peso debe estar entre 0.1 y 1000 kg");
    }

    // Check duplicate Pokedex number
    if (Number.isInteger(pokemon.pokedexNumber) && pokemon.pokedexNumber > 0) {
        const existingNumber = await pokemons.findOne({
            pokedexNumber: pokemon.pokedexNumber,
            _id: { $ne: originalId ?? null }
        });

        if (existingNumber) {
            errors.push("Ya existe un Pokémon con ese número de Pokédex");
        }
    }

    // Check duplicate name
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

router.post('/NewPokemon', upload.single('image'), async (req, res) => {
    let pokemon = parsePokemonFormData(req);

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

    await pokemons.insertOne(pokemon);

    res.render('confirmation', {
        pageTitle: 'Pokémon Registrado',
        title: '¡Pokémon creado con éxito!',
        message: `El Pokémon "${pokemon.name}" (#${pokemon.formattedNumber}) ha sido registrado correctamente en la Pokédex.`,
        actionUrl: `/pokemon/${pokemon.pokedexNumber}`,
        actionText: 'Ver Pokémon',
        pokemon
    });
});

async function validateAbility(pokemonId, ability, originalAbilityId) {
    let errors = [];

    // Required fields
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

    // Check if Pokémon exists
    const pokemon = await pokemons.findOne({
        pokedexNumber: Number(pokemonId)
    });

    if (!pokemon) {
        errors.push("El Pokémon no existe");
        return errors;
    }

    // Check duplicated ability name
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

router.post('/NewAbility', upload.single('image'), async (req, res) => {
    let pokemonId = Number(req.body.pokemon_id);

    let selectedType = pokemonTypes[req.body.type?.toLowerCase()];
    let ability = {
        id: req.body.id || String(Date.now()),
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

    await pokemons.updateOne(
        { pokedexNumber: pokemonId },
        { $push: { abilities: ability } }
    );

    let pokemon = await pokemons.findOne({
        pokedexNumber: pokemonId
    });

    res.render('confirmation', {
        pageTitle: 'Movimiento Añadido',
        title: '¡Movimiento añadido con éxito!',
        message: `El movimiento "${ability.name}" ha sido añadido correctamente a la ficha de ${pokemon ? pokemon.name : 'Pokémon'}.`,
        actionUrl: `/pokemon/${pokemonId}`,
        actionText: 'Volver a la ficha del Pokémon',
        pokemon
    });
});

router.post('/EditPokemon/:id', upload.single('image'), async (req, res) => {
    let pokemonId = Number(req.params.id);

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

    let editPokemon = parsePokemonFormData(req, pokemon);

    // Validate Pokémon
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

    // Update Pokémon
    await pokemons.updateOne(
        { _id: pokemon._id },
        { $set: editPokemon }
    );

    res.render('confirmation', {
        pageTitle: 'Pokémon Actualizado',
        title: '¡Pokémon actualizado con éxito!',
        message: `Los datos del Pokémon "${editPokemon.name}" (#${editPokemon.formattedNumber}) se han actualizado correctamente.`,
        actionUrl: `/pokemon/${editPokemon.pokedexNumber}`,
        actionText: 'Ver Pokémon',
        pokemon: editPokemon
    });
});

router.post('/EditAbility/:pokemon_id/:ability_id', upload.single('image'), async (req, res) => {
    let pokemonId = Number(req.params.pokemon_id);
    let abilityId = req.params.ability_id;

    // Get Pokémon
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

    // Get original ability
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

    // Build edited ability
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

    // Validate ability
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

    // Update ability in MongoDB
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

    res.render('confirmation', {
        pageTitle: 'Movimiento Actualizado',
        title: '¡Movimiento actualizado con éxito!',
        message: `El movimiento "${editAbility.name}" ha sido actualizado correctamente en la ficha de ${pokemon ? pokemon.name : 'Pokémon'}.`,
        actionUrl: `/pokemon/${pokemonId}`,
        actionText: 'Volver a la ficha del Pokémon',
        pokemon
    });
});

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

    const types = Object.entries(pokemonTypes).map(([value, info]) => ({
        value,
        label: info.label,
        selected: pokemon.type === value
    }));

    const generations = POKEMON_GENERATIONS.map(g => ({
        value: g.value,
        label: g.label,
        selected: pokemon.generation === g.value
    }));

    res.render('new-pokemon', {
        pageTitle: `Editar ${pokemon.name}`,
        pokemon,
        isEdit: true,
        formAction: `/EditPokemon/${pokemonId}`,
        types,
        generations
    });
});

router.get('/ability/:pokemon_id/:ability_id/edit', async (req, res) => {
    let pokemonId = Number(req.params.pokemon_id);
    let abilityId = req.params.ability_id;

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

    const types = Object.entries(pokemonTypes).map(([value, info]) => ({
        value,
        label: info.label,
        selected: (ability.type || '').toLowerCase() === value || (ability.typeLabel || '').toLowerCase() === info.label.toLowerCase()
    }));

    res.render('ability', {
        pageTitle: `Editar ${ability.name}`,
        pokemon,
        ability,
        isEdit: true,
        types
    });
});

router.post('/pokemon/:id/delete', async (req, res) => {
    const id = parseInt(req.params.id);
    await pokemons.deleteOne({ pokedexNumber: id });
    res.render('confirmation', { 
        pageTitle: 'Pokémon Eliminado',
        title: '¡Pokémon eliminado con éxito!',
        message: 'El Pokémon ha sido eliminado correctamente de la base de datos.',
        actionUrl: '/',
        actionText: 'Volver a la Pokédex'
     });
});
router.post('/pokemon/:pokemon_id/ability/:ability_id/delete', async (req, res) => {
    const pokemonId = Number(req.params.pokemon_id);
    const abilityId = String(req.params.ability_id);

    await pokemons.updateOne(
        { pokedexNumber: pokemonId },
        { $pull: { abilities: { id: abilityId } } }
    );

    res.render('confirmation', {
        pageTitle: 'Movimiento Eliminado',
        title: '¡Movimiento eliminado con éxito!',
        message: 'El movimiento ha sido eliminado correctamente del Pokémon.',
        actionUrl: `/pokemon/${pokemonId}`,
        actionText: 'Volver a la ficha del Pokémon'
    });
});