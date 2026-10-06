// The game clock: what time it is in the world, and how bright the sun is.
// The heartbeat moves it forward one game hour at a time.

import { seconds } from "./heartbeat";

export const HOURS_PER_DAY = 24;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;

// How long one game hour lasts in real time. A full day is 24 of these.
export const PULSES_PER_HOUR = seconds(60);

export const MONTH_NAMES = [
  "Deepfrost", "Thaw", "Seedtime", "Rain", "Blossom", "Highsun",
  "Swelter", "Harvest", "Leaffall", "Mist", "Ember", "Longnight",
];

export class GameClock {
  hour = 5; // start just before dawn, so the first sunrise comes quickly
  day = 1;
  month = 1;
  year = 1;

  // Move forward one hour, rolling over into the next day, month and year.
  advanceHour(): void {
    this.hour++;
    if (this.hour < HOURS_PER_DAY) return;
    this.hour = 0;
    this.day++;
    if (this.day <= DAYS_PER_MONTH) return;
    this.day = 1;
    this.month++;
    if (this.month <= MONTHS_PER_YEAR) return;
    this.month = 1;
    this.year++;
  }

  // How much of the sun reaches outdoors, from 0 (deep night) to 1 (full day).
  get sunlight(): number {
    const SUN: Record<number, number> = { 5: 0.25, 6: 0.5, 7: 0.75, 18: 0.75, 19: 0.5, 20: 0.25 };
    if (this.hour in SUN) return SUN[this.hour];
    return this.hour > 7 && this.hour < 18 ? 1 : 0;
  }

  // A line to tell people outdoors when the sky changes, or nothing.
  skyMessage(): string | undefined {
    if (this.hour === 6) return "The sun rises in the east.";
    if (this.hour === 8) return "The day has begun.";
    if (this.hour === 19) return "The sun slowly sets in the west.";
    if (this.hour === 21) return "The night has begun.";
    return undefined;
  }

  describe(): string {
    const h = this.hour % 12 === 0 ? 12 : this.hour % 12;
    const ampm = this.hour < 12 ? "am" : "pm";
    return `It is ${h} ${ampm} on day ${this.day} of ${MONTH_NAMES[this.month - 1]}, year ${this.year}.`;
  }
}
