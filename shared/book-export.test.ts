import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDocx, buildEpub, buildPrintHtml, chaptersFromNodes, type ExportBook } from "./book-export";

const book: ExportBook = { title: "Caderno de teste", author: "Autora", language: "pt-BR", chapters: [{ id: "c1", title: "Capítulo 1", content: "Primeiro parágrafo.\n\nSegundo parágrafo." }] };

describe("book export", () => {
  it("builds a navigable EPUB without changing source content", async () => {
    const epub = await buildEpub(book);
    const zip = await JSZip.loadAsync(await epub.arrayBuffer());
    expect(await zip.file("mimetype")?.async("string")).toBe("application/epub+zip");
    expect(await zip.file("OEBPS/nav.xhtml")?.async("string")).toContain("Capítulo 1");
    expect(await zip.file("OEBPS/chapter-1.xhtml")?.async("string")).toContain("Segundo parágrafo.");
    expect(book.chapters[0].content).toContain("Primeiro parágrafo.");
  });

  it("exports cover, toc controls and typography presets", async () => {
    const configured: ExportBook = { ...book, coverImageUrl: "https://example.com/cover.jpg", includeToc: true, typography: "fantasy" };
    const html = buildPrintHtml(configured);
    expect(html).toContain("https://example.com/cover.jpg");
    expect(html).toContain("Sumário");
    expect(html).toContain("Palatino");
    const withoutToc = buildPrintHtml({ ...configured, includeToc: false });
    expect(withoutToc).not.toContain('<nav class="toc"');
    const epub = await buildEpub(configured);
    const zip = await JSZip.loadAsync(await epub.arrayBuffer());
    expect(await zip.file("OEBPS/cover.xhtml")?.async("string")).toContain("cover.jpg");
  });

  it("builds print HTML and DOCX bytes from nodes", async () => {
    const html = buildPrintHtml(book);
    const docx = await buildDocx(book);
    expect(html).toContain("Caderno de teste");
    expect(html).toContain("break-before:page");
    expect(docx.size).toBeGreaterThan(100);
    expect(chaptersFromNodes([{ id: "p", title: "Parte", content: "", kind: "part" }, { id: "c", title: "Capítulo", content: "texto", kind: "chapter" }])).toHaveLength(1);
  });
});
