# Big Dawg's Castle

A graphical MUD you can play with the mouse, with a classic typed-command mode for terminal fans. The rules underneath will feel like SneezyMUD, but it's built from scratch.

## Running it

You need [Node.js](https://nodejs.org) installed. Then, in this folder:

```
npm install      # once, downloads the two tools we use
npm run dev      # starts a local server; open the address it prints
```

Other commands:

- `npm run check` asks TypeScript to look for mistakes without running anything.
- `npm run build` makes `public/main.js` once, without starting a server.

## How to play (so far)

Each room is one square, a little scene of its own. You don't walk around inside it. Being in the room is enough to deal with anything in it.

- **Click a doorway** to go through it. North, south, east and west are in the middle of the walls; the diagonals are in the corners.
- **Click a closed door** to open it, then click it again to go through.
- **Click a thing** in the room (the well, a rat, a knife) to look at it.
- **Click stairs** to go up or down.
- **Type commands** in the box: `north` or `n`, `northeast` or `ne`, `up`, `down`, `look`, `look well`, `open north`, `close north`, `search`, `time`, `help`.

Time passes on its own. A game hour lasts one real minute, so a full day takes 24 minutes. The game starts at 5 am: stand in the courtyard or garden and watch the sun come up. Indoor rooms keep the same light all day.

There's a locked door in the kitchen (no keys yet) and a secret door somewhere in the Great Hall. Try `search`.

## How the code is organised

There are three files, and each one has a single job:

| File | Its job |
|---|---|
| `src/game/world.ts` | **The world.** Which rooms exist, what each looks like, and where the exits lead. It's pure data and doesn't know about the screen. |
| `src/game/game.ts` | **The rules.** Where the player is and what happens when they act. Every click and every typed command ends up here. |
| `src/client/main.ts` | **The screen.** It draws the room, listens to the mouse and keyboard, and prints text. It never decides what's allowed. It asks the rules and draws the answer. |

Two smaller files hold the game's sense of time:

| File | Its job |
|---|---|
| `src/game/heartbeat.ts` | **The heartbeat.** A steady tick, 10 pulses a second. Repeating jobs hang off it as gears (`every`), and one-off jobs wait in a timer list (`after`). |
| `src/game/clock.ts` | **The game clock.** The hour, day, month and year, and how much sunlight reaches outdoors. |

`public/index.html` is the web page that holds the screen.

Keeping the rules separate from the screen matters most. Later, `game.ts` moves onto a server that every player connects to, so everyone shares one world. The screen then just sends commands and draws what comes back. A terminal player's typed `north` and a mouse player's click on the north doorway become the same command.

### The heartbeat

The game moves forward in pulses, 10 every second. Anything that happens over time asks the heartbeat to run it:

```ts
heartbeat.every(seconds(3), combatRound);       // a gear: every 3 seconds, forever
heartbeat.after(seconds(45), wearOffBlessing);  // a timer: once, 45 seconds from now
```

Right now only the clock rides on it: once a game hour the clock moves forward, and players outdoors hear about sunrise and sunset. Combat rounds, regeneration, mobs wandering and weather will each become another gear later.

For now the heartbeat runs in your browser. When the game moves onto a server, the heartbeat goes with it, so everyone shares one clock.

### Rooms are squares

A room can have eight exits around it. North, south, east and west sit in the middle of the walls, and northeast, northwest, southeast and southwest sit in the corners. A room can also have up and down exits, which show as stairs inside the room.

The room is drawn 528 × 528 pixels, the size of a room backdrop image.

What's in a room is a list of `contents`. Each thing has a name, the words a player can type for it, a kind (feature, item or creature), and a description:

```ts
{ name: "an old well", keywords: ["well"], kind: "feature", description: "An old stone well. You hear water far below." }
```

Clicking a thing sends `look well`, the same command a terminal player would type.

To add a room, copy one in `ROOMS` in `world.ts`, change its details, and list its `exits`. Remember to add the matching exit back in the room it connects to.

### Coordinates and planes

Every room stores where it is: `plane`, `x`, `y` and `z`. East is +x, north is +y and up is +z. A plane is a separate world with its own coordinates, so two planes can each have a room at 0, 0, 0 without the map mixing them up. The map only shows rooms on your current plane and floor.

When the page loads, `checkWorld()` in `world.ts` checks that every exit leads one step the right way and has an exit back. Any problems show up as warnings in the browser's developer console.

### Room qualities

Every room also carries:

- `sector`: city, forest, swamp, mountain, hill, plains, freshwater, river or sea
- `climate`: temperate, arctic, tropical or desert
- `road`: whether a road runs through it
- `indoor`: indoor rooms won't feel weather, daylight or night
- `light`: from 0 (perfect darkness) to 100 (summer noon). The screen dims darker rooms. For an outdoor room this is how bright it is at midday; the sun scales it down at dawn, dusk and night, with a little moonlight so it's never pitch black.

What most of these do to play gets decided later.

### Exits and doors

A room holds its exits, and each exit can hold a door:

```ts
exits: {
  north: { to: "courtyard", door: { closed: true } },
  west:  { to: "passage",   door: { closed: true, secret: true } },
}
```

A door has two sides, one in each room. Opening or closing one side does the same to the other. Door flags are `locked` (won't open), `secret` (hidden until you `search`), and `trapped` (marked for now, but traps come later).

### Walls

A room has eight wall pieces, one at each exit position: four walls and four corners. Each piece has a `material` (stone, brick, wood, rock, hedge, palisade, or none) and a `height` in feet. Later, skills can use these to break through a wall or climb over it.

```ts
wall: { material: "stone", height: 20 },  // every side, unless...
walls: { east: NO_WALL },                 // ...a side is different
```

The walls also decide what kind of exit you have. An exit through a wall is a doorway, and can hold a door. An exit where there's no wall is open air, for one big space split into several rooms, like a great hall drawn as six rooms. The courtyard is built this way: it opens east into its other half and southwest into the garden.

## Art

`public/art/README.md` lists the floor and wall images the game looks for. Drop a PNG in with the right name and it replaces the stand-in color.

