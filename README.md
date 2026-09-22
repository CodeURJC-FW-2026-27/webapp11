# RotomWeb Dex

Our goal is to make a Pokémon encyclopedia website, called: **RotomWeb Dex**

### Development team members:
* Adrián Molero Miñana | [a.molero.2024@alumnos.urjc.es]| S0cr4te5
* Marcos Vidal Castillo | [m.vidalc.2024@alumnos.urjc.es]| Marcos-VC
* Lucas Román Jiménez | [l.roman.2024@alumnos.urjc.es]| Lucas-Roman-Jimenez
* Omar Pozo Adán | [o.pozoa.2024@alumnos.urjc.es]| OmarPozoAdan

---

## Functionalities

### Entities

#### Main entity (Pokemon):
**Attributes:**
* name
* pokedex_number
* type
* generation
* height
* weight
* description
* imageFilename
* moves

#### Secondary entity (Abilities):
**Attributes:**
* name
* type
* category
* power
* accuracy
* pp
* description
* imageFilename

---

### Images
Entities will have associated images:
* **Pokemon:** Each pokemon will have an uploaded image.
* **Move:** Moves can include an optional icon representing the move's type or animation.

---

### Search, Filtering and Categorization

#### Search
* **Text search:** Search pokemon by name.

#### Filtering
* **By type:** Filter pokemon list based on predefined elemental types.
* **By generation:** Filter pokemon according to their region or generation.

#### Categorization
* **Tag / button system:** Quick category buttons to group and display pokemon by their elemental type.
