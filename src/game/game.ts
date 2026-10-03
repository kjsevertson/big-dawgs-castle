// The rules: where the player is, and what happens when they act.
// Everything the player does, whether they click or type, ends up here.
// Later this file moves onto the server, and the screen will only draw what it says.

import { Direction, Exit, OPPOSITE, ROOMS, ROOM_SIZE, Room, STARTING_ROOM, TileInfo, exitTile, tileAt } from "./world";

export interface Position { x: number; y: number }

export interface PlayerState {
  roomId: string;
  pos: Position;
}

// Words and short forms players can type, MUD style.
const DIRECTION_WORDS: Record<string, Direction> = {
  n: "north", north: "north",
  ne: "northeast", northeast: "northeast",
  e: "east", east: "east",
  se: "southeast", southeast: "southeast",
  s: "south", south: "south",
  sw: "southwest", southwest: "southwest",
  w: "west", west: "west",
  nw: "northwest", northwest: "northwest",
  u: "up", up: "up",
  d: "down", down: "down",
};

const CENTER = Math.floor(ROOM_SIZE / 2);

export class Game {
  player: PlayerState;
  visited = new Set<string>();
  // Secret doors this player has found, as "roomId:direction".
  foundSecrets = new Set<string>();

  constructor() {
    this.player = { roomId: STARTING_ROOM, pos: { x: CENTER, y: CENTER } };
    this.visited.add(STARTING_ROOM);
  }

  get room(): Room {
    return ROOMS[this.player.roomId];
  }

  // Run one command and return the lines of text to show the player.
  handleCommand(input: string): string[] {
    const words = input.trim().toLowerCase().split(/\s+/);
    let verb = words[0] ?? "";
    if (verb === "go" && words[1]) verb = words[1];

    const dirArg = DIRECTION_WORDS[words[1] ?? ""];

    if (verb === "") return [];
    if (DIRECTION_WORDS[verb]) return this.move(DIRECTION_WORDS[verb]);
    if (verb === "look" || verb === "l") return this.look();
    if (verb === "open") return dirArg ? this.open(dirArg) : ["Open which way? For example: open north."];
    if (verb === "close") return dirArg ? this.close(dirArg) : ["Close which way? For example: close north."];
    if (verb === "search") return this.search();
    if (verb === "help") {
      return [
        "Move with north, northeast, east, southeast, south, southwest, west, northwest, up, down (or n ne e se s sw w nw u d).",
        "Also: look, open <direction>, close <direction>, search, help.",
      ];
    }
    return [`You don't know how to "${input.trim()}".`];
  }

  look(): string[] {
    const room = this.room;
    const exits = this.visibleExits().map(([dir, exit]) => (exit.door?.closed ? `${dir} (closed)` : dir));
    return [room.name, room.description, describeQualities(room), `Exits: ${exits.join(", ") || "none"}.`];
  }

  // Exits this player knows about. Secret doors stay hidden until found.
  visibleExits(): [Direction, Exit][] {
    return (Object.entries(this.room.exits) as [Direction, Exit][]).filter(([dir, exit]) => this.canSee(dir, exit));
  }

  hiddenExits(): Direction[] {
    return (Object.entries(this.room.exits) as [Direction, Exit][]).filter(([dir, exit]) => !this.canSee(dir, exit)).map(([dir]) => dir);
  }

  private canSee(dir: Direction, exit: Exit, roomId = this.room.id): boolean {
    return !exit.door?.secret || this.foundSecrets.has(`${roomId}:${dir}`);
  }

  // Does this player know about an exit in any room? Used by the map.
  knowsExit(roomId: string, dir: Direction): boolean {
    const exit = ROOMS[roomId].exits[dir];
    return !!exit && this.canSee(dir, exit, roomId);
  }

  private knownExit(dir: Direction): Exit | undefined {
    const exit = this.room.exits[dir];
    return exit && this.canSee(dir, exit) ? exit : undefined;
  }

  // What the screen should draw at (x, y), as this player sees it.
  tileAt(x: number, y: number): { info: TileInfo; exit?: Direction } {
    return tileAt(this.room, x, y, this.hiddenExits());
  }

  move(dir: Direction): string[] {
    const exit = this.knownExit(dir);
    if (!exit) return ["You can't go that way."];
    if (exit.door?.closed) return [`The door ${dir} is closed.`];

    const target = ROOMS[exit.to];
    // Walking through a secret door shows you where it is from the other side too.
    if (exit.door?.secret) this.foundSecrets.add(`${target.id}:${OPPOSITE[dir]}`);
    this.player.roomId = target.id;
    this.player.pos = arrivalSpot(target, OPPOSITE[dir]);
    this.visited.add(target.id);
    return [`You go ${dir}.`, ...this.look()];
  }

  open(dir: Direction): string[] {
    const exit = this.knownExit(dir);
    if (!exit?.door) return [`There's no door ${dir}.`];
    if (!exit.door.closed) return ["It's already open."];
    if (exit.door.locked) return ["It's locked."];
    setDoor(this.room, dir, exit, false);
    return [`You open the door ${dir}.`];
  }

  close(dir: Direction): string[] {
    const exit = this.knownExit(dir);
    if (!exit?.door) return [`There's no door ${dir}.`];
    if (exit.door.closed) return ["It's already closed."];
    setDoor(this.room, dir, exit, true);
    return [`You close the door ${dir}.`];
  }

  // Look for secret doors in this room. For now searching always succeeds;
  // later a skill will decide how likely you are to find one.
  search(): string[] {
    const found = this.hiddenExits();
    if (found.length === 0) return ["You search carefully but find nothing hidden."];
    for (const dir of found) this.foundSecrets.add(`${this.room.id}:${dir}`);
    return found.map((dir) => `You find a hidden door leading ${dir}!`);
  }

  // Clicking a tile. Floor: walk there. Exit: walk there and go through.
  // Anything else: describe it.
  // Returns the steps to animate, any text to show, and a command to run at the end.
  clickTile(x: number, y: number): { path: Position[]; messages: string[]; command?: string } {
    const tile = this.tileAt(x, y);
    if (tile.info.kind === "void") return { path: [], messages: [] };

    // A closed door: walk up to it, then try to open it.
    if (tile.info.kind === "doorClosed" && tile.exit) {
      const path = findPath(this.room, this.player.pos, { x, y }, this.hiddenExits());
      if (!path) return { path: [], messages: ["You can't get there from here."] };
      return { path: path.slice(0, -1), messages: [], command: `open ${tile.exit}` };
    }

    if (!tile.info.walkable) return { path: [], messages: [tile.info.description] };

    const path = findPath(this.room, this.player.pos, { x, y }, this.hiddenExits());
    if (!path) return { path: [], messages: ["You can't get there from here."] };
    return { path, messages: [], command: tile.exit };
  }

  // Take one step along a path. The screen calls this once per animation step.
  step(pos: Position): void {
    this.player.pos = pos;
  }
}

// Doors have two sides: the one in this room and the matching one in the next.
// Opening or closing one does the same to the other.
function setDoor(room: Room, dir: Direction, exit: Exit, closed: boolean): void {
  exit.door!.closed = closed;
  const otherSide = ROOMS[exit.to].exits[OPPOSITE[dir]];
  if (otherSide?.to === room.id && otherSide.door) otherSide.door.closed = closed;
}

function describeQualities(room: Room): string {
  const parts = [room.sector, room.climate, room.indoor ? "indoors" : "outdoors"];
  if (room.road) parts.push("road");
  return `[${parts.join(", ")} · light ${room.light}: ${lightWord(room.light)}]`;
}

function lightWord(light: number): string {
  if (light <= 5) return "pitch black";
  if (light <= 25) return "dim";
  if (light <= 60) return "lamplit";
  if (light <= 85) return "bright";
  return "blazing sun";
}

// Where you appear when you come in through an exit: one step in from it,
// toward the middle of the room. Coming up or down, you stand on the stairs.
function arrivalSpot(room: Room, cameFrom: Direction): Position {
  const pos = exitTile(room, cameFrom)!;
  if (cameFrom === "up" || cameFrom === "down") return pos;
  return { x: pos.x + Math.sign(CENTER - pos.x), y: pos.y + Math.sign(CENTER - pos.y) };
}

// Breadth-first search: spread out from the start one tile at a time until
// we reach the goal, remembering how we got to each tile. It finds the
// shortest route around walls and tables. Diagonal steps are allowed,
// but not squeezing between two blocked corners.
// The goal tile itself may be unwalkable (a closed door you're walking up to).
function findPath(room: Room, from: Position, to: Position, hidden: Direction[]): Position[] | null {
  const key = (p: Position) => `${p.x},${p.y}`;
  const walkable = (x: number, y: number) => (x === to.x && y === to.y) || tileAt(room, x, y, hidden).info.walkable;
  const cameFrom = new Map<string, Position | null>([[key(from), null]]);
  const queue: Position[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) {
      const path: Position[] = [];
      for (let p: Position | null = current; p && key(p) !== key(from); p = cameFrom.get(key(p)) ?? null) {
        path.unshift(p);
      }
      return path;
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: current.x + dx, y: current.y + dy };
        if (cameFrom.has(key(next)) || !walkable(next.x, next.y)) continue;
        if (dx !== 0 && dy !== 0 && (!walkable(current.x + dx, current.y) || !walkable(current.x, current.y + dy))) continue;
        cameFrom.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return null;
}
