import { encounterPool } from "./enemies";
import { eventIds } from "./events";
import type { ActId, GameMap, MapNode, NodeType } from "./types";
import { RNG } from "./rng";

const ROW_COUNTS = [2, 3, 3, 3, 2, 1];

function columnsFor(row: number, count: number, rng: RNG): number[] {
  if (count === 1) return [3];
  if (row === 0) return rng.chance(0.5) ? [1, 5] : [2, 4];
  return rng
    .shuffle([0, 1, 2, 3, 4, 5, 6])
    .slice(0, count)
    .sort((a, b) => a - b);
}

function stamp(pool: MapNode[], type: NodeType, count: number, rng: RNG) {
  const open = rng.shuffle(pool.filter((node) => node.type === "battle"));
  for (let i = 0; i < count && i < open.length; i++) open[i].type = type;
}

export function generateMap(act: ActId, rng: RNG): GameMap {
  const rows = ROW_COUNTS.length;
  const nodes: MapNode[] = [];
  for (let row = 0; row < rows; row++) {
    const cols = columnsFor(row, ROW_COUNTS[row], rng);
    cols.forEach((col, index) => {
      nodes.push({
        id: `a${act}-r${row}-n${index}`,
        row,
        col,
        type: "battle",
        edges: [],
        encounterId: "",
        eventId: "",
      });
    });
  }

  for (let row = 0; row < rows - 1; row++) {
    const current = nodes.filter((node) => node.row === row);
    const next = nodes.filter((node) => node.row === row + 1);
    for (const node of current) {
      const sorted = [...next].sort(
        (a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col) || a.col - b.col,
      );
      node.edges.push(sorted[0].id);
      if (sorted[1] && Math.abs(sorted[1].col - node.col) <= 1 && rng.chance(0.65)) {
        node.edges.push(sorted[1].id);
      }
    }
    for (const node of next) {
      if (!current.some((parent) => parent.edges.includes(node.id))) {
        const parent = [...current].sort(
          (a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col) || a.id.localeCompare(b.id),
        )[0];
        parent.edges.push(node.id);
      }
    }
    for (const node of current) node.edges = [...new Set(node.edges)];
  }

  const boss = nodes.find((node) => node.row === rows - 1);
  if (!boss) throw new Error("Map is missing a boss row");
  boss.type = "boss";

  const preBoss = nodes.filter((node) => node.row === rows - 2);
  const shop = preBoss[Math.floor(preBoss.length / 2)] ?? preBoss[0];
  shop.type = "shop";

  const middle = nodes.filter((node) => node.row > 0 && node.row < rows - 1 && node !== shop);
  stamp(middle, "elite", 2, rng);
  stamp(middle, "shop", 1, rng);
  stamp(middle, "mystery", 2, rng);
  stamp(middle, "gamble", 2, rng);

  const battles = rng.shuffle(encounterPool(act, "battle"));
  const elites = rng.shuffle(encounterPool(act, "elite"));
  const bosses = encounterPool(act, "boss");
  const events = rng.shuffle(eventIds());
  let battleIndex = 0;
  let eliteIndex = 0;
  let eventIndex = 0;
  for (const node of nodes) {
    if (node.type === "battle") {
      node.encounterId = battles[battleIndex % battles.length].id;
      battleIndex += 1;
    } else if (node.type === "elite") {
      node.encounterId = elites[eliteIndex % elites.length].id;
      eliteIndex += 1;
    } else if (node.type === "boss") {
      node.encounterId = bosses[0].id;
    } else if (node.type === "mystery") {
      node.eventId = events[eventIndex % events.length];
      eventIndex += 1;
    }
  }

  return { act, rows, nodes };
}

export function nodeById(map: GameMap, id: string): MapNode | undefined {
  return map.nodes.find((node) => node.id === id);
}

export function reachableNodes(map: GameMap, nodeId: string | null): MapNode[] {
  if (!nodeId) return map.nodes.filter((node) => node.row === 0);
  const current = nodeById(map, nodeId);
  if (!current) return [];
  return current.edges
    .map((id) => nodeById(map, id))
    .filter((node): node is MapNode => !!node);
}

export function mapIsConnected(map: GameMap): boolean {
  const starts = map.nodes.filter((node) => node.row === 0);
  const seen = new Set<string>();
  const queue = [...starts];
  while (queue.length) {
    const node = queue.pop()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    for (const id of node.edges) {
      const next = nodeById(map, id);
      if (next) queue.push(next);
    }
  }
  if (seen.size !== map.nodes.length) return false;
  const boss = map.nodes.find((node) => node.type === "boss");
  if (!boss || boss.row !== map.rows - 1) return false;
  for (const node of map.nodes) {
    if (node.type === "boss") continue;
    if (node.edges.length === 0) return false;
    for (const id of node.edges) {
      const next = nodeById(map, id);
      if (!next || next.row !== node.row + 1) return false;
    }
  }
  return true;
}
