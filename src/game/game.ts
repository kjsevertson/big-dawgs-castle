// The rules: where the player is, and what happens when they act.
// Everything the player does, whether they click or type, ends up here as a command.
// Later this file moves onto the server, and the screen will only draw what it says.

import { Direction, Exit, OPPOSITE, ROOMS, Room, STARTING_ROOM, Thing } from "./world";

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

export class Game {
  roomId = STARTING_ROOM;
  visited = new Set<string>([STARTING_ROOM]);
  // Secret doors this player has found, as "roomId:direction".
  foundSecrets = new Set<string>();

  get room(): Room {
    return ROOMS[this.roomId];
  }

  // Run one command and return the lines of text to show the player.
  handleCommand(input: string): string[] {
    const words = input.trim().toLowerCase().split(/\s+/);
    let verb = words[0] ?? "";
    if (verb === "go" && words[1]) verb = words[1];
    const rest = words.slice(1).join(" ");
    const dirArg = DIRECTION_WORDS[words[1] ?? ""];

    if (verb === "") return [];
    if (DIRECTION_WORDS[verb]) return this.move(DIRECTION_WORDS[verb]);
    if (verb === "look" || verb === "l" || verb === "examine" || verb === "exa") {
      return rest ? this.lookAt(rest) : this.look();
    }
    if (verb === "open") return dirArg ? this.open(dirArg) : ["Open which way? For example: open north."];
    if (verb === "close") return dirArg ? this.close(dirArg) : ["Close which way? For example: close north."];
    if (verb === "search") return this.search();
    if (verb === "help") {
      return [
        "Move with north, northeast, east, southeast, south, southwest, west, northwest, up, down (or n ne e se s sw w nw u d).",
        "Also: look, look <thing>, open <direction>, close <direction>, search, help.",
      ];
    }
    return [`You don't know how to "${input.trim()}".`];
  }

  look(): string[] {
    const room = this.room;
    const exits = this.visibleExits().map(([dir, exit]) => (exit.door?.closed ? `${dir} (closed)` : dir));
    const lines = [room.name, room.description, describeQualities(room)];
    if (room.contents.length > 0) lines.push(`You see ${listNames(room.contents)}.`);
    lines.push(`Exits: ${exits.join(", ") || "none"}.`);
    return lines;
  }

  lookAt(words: string): string[] {
    const thing = this.findThing(words);
    if (thing) return [thing.description];
    const dir = DIRECTION_WORDS[words];
    const exit = dir && this.knownExit(dir);
    if (dir && exit) {
      if (exit.open) return [`The space opens up to the ${dir}.`];
      if (!exit.door) return [`An opening leads ${dir}.`];
      return [`A door leads ${dir}. It is ${exit.door.closed ? "closed" : "open"}.`];
    }
    return [`You don't see any "${words}" here.`];
  }

  // Match what the player typed against the keywords of things in the room.
  findThing(words: string): Thing | undefined {
    const typed = words.split(" ");
    return this.room.contents.find((t) => t.keywords.some((k) => typed.includes(k)));
  }

  // Exits this player knows about. Secret doors stay hidden until found.
  visibleExits(): [Direction, Exit][] {
    return (Object.entries(this.room.exits) as [Direction, Exit][]).filter(([dir, exit]) => this.canSee(dir, exit));
  }

  // Does this player know about an exit in any room? Used by the map.
  knowsExit(roomId: string, dir: Direction): boolean {
    const exit = ROOMS[roomId].exits[dir];
    return !!exit && this.canSee(dir, exit, roomId);
  }

  private canSee(dir: Direction, exit: Exit, roomId = this.roomId): boolean {
    return !exit.door?.secret || this.foundSecrets.has(`${roomId}:${dir}`);
  }

  private knownExit(dir: Direction): Exit | undefined {
    const exit = this.room.exits[dir];
    return exit && this.canSee(dir, exit) ? exit : undefined;
  }

  move(dir: Direction): string[] {
    const exit = this.knownExit(dir);
    if (!exit) return ["You can't go that way."];
    if (exit.door?.closed) return [`The door ${dir} is closed.`];

    const target = ROOMS[exit.to];
    // Walking through a secret door shows you where it is from the other side too.
    if (exit.door?.secret) this.foundSecrets.add(`${target.id}:${OPPOSITE[dir]}`);
    this.roomId = target.id;
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
    const hidden = (Object.entries(this.room.exits) as [Direction, Exit][]).filter(([dir, exit]) => !this.canSee(dir, exit));
    if (hidden.length === 0) return ["You search carefully but find nothing hidden."];
    for (const [dir] of hidden) this.foundSecrets.add(`${this.roomId}:${dir}`);
    return hidden.map(([dir]) => `You find a hidden door leading ${dir}!`);
  }

  // What clicking an exit means, as the command a typist would use.
  // A closed door gets opened; an open way gets walked through.
  commandForExit(dir: Direction): string {
    return this.room.exits[dir]?.door?.closed ? `open ${dir}` : dir;
  }
}

// Doors have two sides: the one in this room and the matching one in the next.
// Opening or closing one does the same to the other.
function setDoor(room: Room, dir: Direction, exit: Exit, closed: boolean): void {
  exit.door!.closed = closed;
  const otherSide = ROOMS[exit.to].exits[OPPOSITE[dir]];
  if (otherSide?.to === room.id && otherSide.door) otherSide.door.closed = closed;
}

function listNames(things: Thing[]): string {
  const names = things.map((t) => t.name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
