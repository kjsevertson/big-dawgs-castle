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
- **Type commands** in the box: `north` or `n`, `northeast` or `ne`, `up`, `down`, `look`, `look well`, `open north`, `close north`, `search`, `help`.

There's a locked door in the kitchen (no keys yet) and a secret door somewhere in the Great Hall. Try `search`.

## How the code is organised

There are three files, and each one has a single job:

| File | Its job |
|---|---|
| `src/game/world.ts` | **The world.** Which rooms exist, what each looks like, and where the exits lead. It's pure data and doesn't know about the screen. |
| `src/game/game.ts` | **The rules.** Where the player is and what happens when they act. Every click and every typed command ends up here. |
| `src/client/main.ts` | **The screen.** It draws the room, listens to the mouse and keyboard, and prints text. It never decides what's allowed. It asks the rules and draws the answer. |

`public/index.html` is the web page that holds the screen.

Keeping the rules separate from the screen matters most. Later, `game.ts` moves onto a server that every player connects to, so everyone shares one world. The screen then just sends commands and draws what comes back. A terminal player's typed `north` and a mouse player's click on the north doorway become the same command.

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
- `light`: from 0 (perfect darkness) to 100 (summer noon). The screen dims darker rooms.

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
