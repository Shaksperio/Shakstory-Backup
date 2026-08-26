export type LifecycleNode = { id: string; title: string; kind: "chapter" | "scene" | "part"; content: string; updatedAt: number };

export function createInitialNode(now: number): LifecycleNode {
  return { id: `chapter-${now}`, title: "Capítulo 1", kind: "chapter", content: "", updatedAt: now };
}

export function addChapter(nodes: LifecycleNode[], now: number): LifecycleNode[] {
  const chapterCount = nodes.filter(node => node.kind === "chapter").length;
  return [...nodes, { id: `chapter-${now}`, title: `Capítulo ${chapterCount + 1}`, kind: "chapter", content: "", updatedAt: now }];
}

export function updateNodeContent(nodes: LifecycleNode[], id: string, content: string, now: number): LifecycleNode[] {
  return nodes.map(node => node.id === id ? { ...node, content, updatedAt: now } : node);
}

export function moveNode(nodes: LifecycleNode[], id: string, direction: "up" | "down"): LifecycleNode[] {
  const index = nodes.findIndex(node => node.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= nodes.length) return nodes;
  const next = [...nodes];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeNode(nodes: LifecycleNode[], id: string): LifecycleNode[] {
  if (nodes.length <= 1) return nodes;
  return nodes.filter(node => node.id !== id);
}
