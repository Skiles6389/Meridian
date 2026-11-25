import { describe, expect, it } from "vitest";
import { ANCHORS } from "../src/ui/anchors";
import { hungStore, IMAGE_UNITS, SHAPES, storeBox, storeImage, storeShape, storeTilt, type StoreShape } from "../src/ui/stores";

describe("hanging weapons", () => {
  it("puts Sidewinders on wingtip rails and AMRAAMs on pylons", () => {
    expect(storeShape("aam", "tip")).toBe("aim9");
    expect(storeShape("aam")).toBe("aim120");
    expect(storeShape("agm")).toBe("agm");
    expect(storeShape("pod")).toBe("pod");
    const f16 = ANCHORS["f16-rear"];
    expect(f16.pylons.map(([, , kind, mount]) => storeShape(kind, mount))).toEqual(["aim9", "aim9", "aim120", "aim120"]);
  });

  it("draws every weapon as a real shape that fits its box", () => {
    for (const shape of Object.keys(SHAPES) as StoreShape[]) {
      const s = SHAPES[shape];
      // Longer than it is wide, and inside the launched weapon's image with its fins.
      expect(s.len, shape).toBeGreaterThan(s.r * 3);
      expect(s.len / 2 + s.fin, shape).toBeLessThanOrEqual(IMAGE_UNITS / 2);
      const svg = storeImage(shape);
      expect(svg).toContain("<path");
      expect(svg).not.toMatch(/NaN|undefined/);
    }
    // The AMRAAM is the bigger missile.
    expect(SHAPES.aim120.len).toBeGreaterThan(SHAPES.aim9.len);
    expect(SHAPES.aim120.r).toBeGreaterThan(SHAPES.aim9.r);
  });

  it("leans each rear-view weapon in towards the centreline, more the further out it hangs", () => {
    for (const [name, a] of Object.entries(ANCHORS)) {
      if (!name.endsWith("-rear")) continue;
      expect(a.span, `${name} wingspan`).toBeGreaterThan(5);
      expect(storeBox(a), name).toBeGreaterThan(6);
      expect(storeBox(a), name).toBeLessThan(15);
      for (const [x] of a.pylons) {
        const tilt = storeTilt(x, a);
        if (x < 50) expect(tilt, name).toBeGreaterThan(0);
        if (x > 50) expect(tilt, name).toBeLessThan(0);
        expect(Math.abs(tilt), name).toBeLessThan(80);
      }
    }
    const f16 = ANCHORS["f16-rear"];
    expect(storeTilt(3.6, f16)).toBeGreaterThan(storeTilt(12.8, f16));
  });

  it("marks the nose and tail of a hanging weapon so a launch can leave along it", () => {
    const f16 = ANCHORS["f16-rear"];
    const html = hungStore(f16.pylons[0], 0, f16, false);
    expect(html).toContain('class="sn"');
    expect(html).toContain('class="st"');
    expect(html).toContain('data-shape="aim9"');
    expect(hungStore(f16.pylons[2], 2, f16, true)).toContain("spent");
  });
});
