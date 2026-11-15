import express from 'express';
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('pokedex');
const pokemons = db.collection('pokemons');


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

        res.render('index', {
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
