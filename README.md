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

- **Click the floor** to walk there.
- **Click an exit** (the dark doorways marked N, NE, E and so on) to walk through it.
- **Click a thing** (a table, the well, a wall) to look at it.
- **Type commands** in the box: `north` or `n`, `northeast` or `ne`, `up`, `down`, `look`, `help`.

## How the code is organised

There are three files, and each one has a single job:

| File | Its job |
|---|---|
| `src/game/world.ts` | **The world.** Which rooms exist, what each looks like, and where the exits lead. It's pure data and doesn't know about the screen. |
| `src/game/game.ts` | **The rules.** Where the player is and what happens when they act. Every click and every typed command ends up here. |
| `src/client/main.ts` | **The screen.** It draws the room, listens to the mouse and keyboard, and prints text. It never decides what's allowed. It asks the rules and draws the answer. |

`public/index.html` is the web page that holds the screen.

Keeping the rules separate from the screen matters most. Later, `game.ts` moves onto a server that every player connects to, so everyone shares one world. The screen then just sends commands and draws what comes back. A terminal player's typed `north` and a mouse player's click on the north doorway become the same command.

### Rooms are octagons

Every room is drawn on an 11 × 11 grid of tiles. Four tiles are cut off each corner to make an octagon, and its outer ring becomes wall. Each of the eight sides has one spot where a doorway can be cut, for north, northeast, east, southeast, south, southwest, west and northwest. Up and down exits are stairs inside the room.

To add a room, copy one in `ROOMS` in `world.ts`, change the picture in `layout` (`.` floor, `,` grass, `T` table, `o` well, `<` stairs up, `>` stairs down), and list its `exits`. Remember to add the matching exit back in the room it connects to.

### Walking

When you click a floor tile, the rules work out the shortest route there using a *breadth-first search*. It spreads out from where you stand one tile at a time, remembering how it reached each tile, until it reaches the one you clicked. The screen then animates the steps.
