// The heartbeat: the game's steady tick. Everything that happens over time hangs off it.
// It knows nothing about rooms or players. Other parts ask it to run their jobs.
//
// Each tick is a pulse. Jobs that repeat (combat rounds, regeneration, the clock)
// are gears that turn every so many pulses. One-off jobs (a spell wearing off,
// a door swinging shut) wait in a list until their pulse comes up.

export const PULSES_PER_SECOND = 10;

// Handy for writing timings in seconds: every(seconds(3), ...) is a 3 second gear.
export function seconds(n: number): number {
  return Math.round(n * PULSES_PER_SECOND);
}

type Job = () => void;

interface Gear {
  every: number; // turns once every this many pulses
  job: Job;
}

interface Timer {
  at: number; // the pulse it fires on
  job: Job;
}

export class Heartbeat {
  pulse = 0; // how many pulses have happened since the game started
  private gears: Gear[] = [];
  private timers: Timer[] = []; // kept sorted, soonest first
  private interval: ReturnType<typeof setInterval> | undefined;

  // Run a job over and over, once every `pulses` pulses.
  every(pulses: number, job: Job): void {
    this.gears.push({ every: Math.max(1, pulses), job });
  }

  // Run a job once, `pulses` pulses from now.
  after(pulses: number, job: Job): void {
    const timer = { at: this.pulse + Math.max(1, pulses), job };
    const i = this.timers.findIndex((t) => t.at > timer.at);
    if (i === -1) this.timers.push(timer);
    else this.timers.splice(i, 0, timer);
  }

  // One pulse: turn the gears that are due, then fire the timers that are due.
  tick(): void {
    this.pulse++;
    for (const gear of this.gears) {
      if (this.pulse % gear.every === 0) gear.job();
    }
    while (this.timers.length > 0 && this.timers[0].at <= this.pulse) {
      this.timers.shift()!.job();
    }
  }

  // Start ticking on the real clock.
  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), 1000 / PULSES_PER_SECOND);
  }

  stop(): void {
    clearInterval(this.interval);
    this.interval = undefined;
  }
}
