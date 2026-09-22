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
* name: Text
* pokedex_number: Int
* type: Text
* generation: Int (1-9)
* height: Float (0.1-100)
* weight: Float (0.1-1000)
* description: Text

#### Secondary entity (Abilities):
**Attributes:**
* name: Text 
* type: Text
* category: Text
* power: Int (0-5050)
* accuracy: Int (30-100)
* pp: Int (1-160)
* description: Text

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
* **By generation:** Filter pokemon according to their region or generation.

#### Categorization
* **Tag / button system:** Quick category buttons to group and display pokemon by their elemental type.
