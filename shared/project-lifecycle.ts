export type LifecycleNode = { id: string; title: string; kind: "chapter" | "scene" | "part"; content: string; richContent?: string; updatedAt: number };

export function stableId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createInitialNode(now: number): LifecycleNode {
  return { id: stableId("chapter"), title: "Novo capítulo", kind: "chapter", content: "", updatedAt: now };
}

export function displayNodeTitle(nodes: LifecycleNode[], node: LifecycleNode): string {
  if (node.kind === "part") {
    const number = nodes.filter(item => item.kind === "part").indexOf(node) + 1;
    return `Parte ${number} — ${node.title}`;
  }
  if (node.kind === "chapter") {
    const number = nodes.filter(item => item.kind === "chapter").indexOf(node) + 1;
    return `Capítulo ${number} — ${node.title}`;
  }
  return node.title;
}

export function addChapter(nodes: LifecycleNode[], now: number): LifecycleNode[] {
  const chapterCount = nodes.filter(node => node.kind === "chapter").length;
  return [...nodes, { id: stableId("chapter"), title: "Novo capítulo", kind: "chapter", content: "", updatedAt: now }];
}

export function updateNodeContent(nodes: LifecycleNode[], id: string, content: string, now: number, richContent?: string): LifecycleNode[] {
  return nodes.map(node => node.id === id ? { ...node, content, ...(richContent ? { richContent } : { richContent: undefined }), updatedAt: now } : node);
}

export function renameNode(nodes: LifecycleNode[], id: string, title: string, now: number): LifecycleNode[] {
  const nextTitle = title.trim();
  if (!nextTitle) return nodes;
  return nodes.map(node => node.id === id ? { ...node, title: nextTitle, updatedAt: now } : node);
}

export function duplicateNode(nodes: LifecycleNode[], id: string, now: number): LifecycleNode[] {
  const source = nodes.find(node => node.id === id);
  if (!source) return nodes;
  const copy = { ...source, id: stableId(source.kind), title: `${source.title} — cópia`, updatedAt: now };
  const index = nodes.findIndex(node => node.id === id);
  return [...nodes.slice(0, index + 1), copy, ...nodes.slice(index + 1)];
}

export function addPart(nodes: LifecycleNode[], now: number): LifecycleNode[] {
  const partCount = nodes.filter(node => node.kind === "part").length;
  return [...nodes, { id: stableId("part"), title: "Nova parte", kind: "part", content: "", updatedAt: now }];
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
