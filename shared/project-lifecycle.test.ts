import { describe, expect, it } from "vitest";
import { addChapter, createInitialNode, moveNode, removeNode, updateNodeContent } from "./project-lifecycle";

describe("project lifecycle", () => {
  it("creates, updates and reopens a stable chapter list", () => {
    const first = createInitialNode(10);
    const withSecond = addChapter([first], 20);
    const updated = updateNodeContent(withSecond, first.id, "Texto recuperável", 30);
    const reopened = JSON.parse(JSON.stringify(updated));
    expect(reopened).toHaveLength(2);
    expect(reopened[0].id).toBe(first.id);
    expect(reopened[0].content).toBe("Texto recuperável");
  });

  it("moves nodes without changing their identity", () => {
    const first = createInitialNode(1);
    const nodes = addChapter([first], 2);
    const moved = moveNode(nodes, nodes[1].id, "up");
    expect(moved.map(node => node.id)).toEqual([nodes[1].id, nodes[0].id]);
    expect(moved[0].title).toBe("Capítulo 2");
  });

  it("never removes the last remaining node", () => {
    const first = createInitialNode(1);
    expect(removeNode([first], first.id)).toEqual([first]);
    expect(removeNode([first, ...addChapter([], 2)], first.id)).toHaveLength(1);
  });
});
