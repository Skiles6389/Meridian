import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scene = (name: string) => new URL(`../src/assets/art/scenes/${name}.webp`, import.meta.url);

describe("title screen", () => {
  it("has key art for wide and tall screens and the clouds that drift across it", () => {
    for (const name of ["title-wide", "title-tall", "cloud-lit", "cloud-dark"]) expect(existsSync(scene(name)), name).toBe(true);
  });
});
