import express from 'express';
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('pokedex');
const pokemons = db.collection('pokemons');
const abilities = db.collection('abilities');

const router = express.Router();
export default router;

router.get('/', async (req, res) => {
    try {
        const pokemonList = await pokemons.find({}).toArray();
        res.render('index', {
            pokemons: pokemonList
        });
    } catch (error) {
        console.error('Error al consultar pokemons en MongoDB:', error);
        res.status(500).send('Error interno del servidor');
    }
});

router.get('/index', (req, res) => res.redirect('/'));
router.get('/index.html', (req, res) => res.redirect('/'));
