import { describe, expect, it } from "vitest";
import { migrateLegacyNodes, semanticWordCount, type SemanticBook } from "./book-model";

describe("semantic book persistence", () => {
  it("round-trips semantic structure through JSON without losing legacy nodes", () => {
    const semantic = migrateLegacyNodes({ id: "book_persist", title: "Livro", nodes: [{ id: "chapter_1", title: "Capítulo 1", kind: "chapter", content: "Uma frase.", sortOrder: 0 }] });
    const document = { version: 1, books: [{ id: "book_persist", title: "Livro", nodes: [{ id: "chapter_1", title: "Capítulo 1", kind: "chapter", content: "Uma frase.", updatedAt: 1 }], semanticBook: semantic }] };
    const reopened = JSON.parse(JSON.stringify(document)) as typeof document;
    const reopenedSemantic = reopened.books[0].semanticBook as SemanticBook;
    expect(reopened.books[0].nodes[0].content).toBe("Uma frase.");
    expect(reopenedSemantic.parts[0].chapters[0].scenes[0].blocks[0].text).toBe("Uma frase.");
    expect(semanticWordCount(reopenedSemantic)).toBe(2);
  });
});
