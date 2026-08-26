import JSZip from "jszip";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

export type ExportChapter = { id: string; title: string; content: string };
export type ExportBook = { title: string; author?: string; language?: string; description?: string; layout?: "classic" | "compact"; chapters: ExportChapter[] };

const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char] ?? char));
const escapeHtml = (value: string) => escapeXml(value).replace(/\n/g, "<br />");

export function buildPrintHtml(book: ExportBook): string {
  const chapters = book.chapters.map(chapter => `<article class="chapter"><h1>${escapeHtml(chapter.title)}</h1>${chapter.content.split(/\n{2,}/).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}</article>`).join("");
  const compact = book.layout === "compact";
  return `<!doctype html><html lang="${escapeXml(book.language ?? "pt-BR")}"><head><meta charset="utf-8" /><title>${escapeHtml(book.title)}</title><style>body{font-family:Georgia,serif;max-width:${compact ? "860px" : "720px"};margin:${compact ? "36px" : "64px"} auto;line-height:${compact ? "1.45" : "1.7"};color:#222}h1{text-align:center;font-weight:400;margin:${compact ? "48px" : "80px"} 0 32px}.chapter{break-before:page}p{text-indent:${compact ? "0" : "1.5em"};margin:0 0 1em}@media print{body{margin:24mm;max-width:none}}</style></head><body><header><h1>${escapeHtml(book.title)}</h1><p style="text-align:center">${escapeHtml(book.author ?? "")}</p></header>${chapters}</body></html>`;
}

export async function buildEpub(book: ExportBook): Promise<Blob> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  const compact = book.layout === "compact";
  const epubStyle = `body{font-family:Georgia,serif;line-height:${compact ? "1.45" : "1.7"};margin:${compact ? "6%" : "12%"} ${compact ? "7%" : "11%"};color:#222}h1{text-align:center;font-weight:400;margin:${compact ? "2em" : "4em"} 0 1.5em}.chapter{page-break-before:always}p{text-indent:${compact ? "0" : "1.5em"};margin:0 0 1em}`;
  const chapterItems = book.chapters.map((chapter, index) => { const file = `chapter-${index + 1}.xhtml`; zip.file(`OEBPS/${file}`, `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(book.language ?? "pt-BR")}"><head><title>${escapeXml(chapter.title)}</title><style>${epubStyle}</style></head><body><h1>${escapeXml(chapter.title)}</h1>${chapter.content.split(/\n{2,}/).map(paragraph => `<p>${escapeXml(paragraph)}</p>`).join("")}</body></html>`); return { id: `chapter-${index + 1}`, file, title: chapter.title }; });
  zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Sumário</title></head><body><nav epub:type="toc"><ol>${chapterItems.map(item => `<li><a href="${item.file}">${escapeXml(item.title)}</a></li>`).join("")}</ol></nav></body></html>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:shakstory:${Date.now()}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title><dc:creator>${escapeXml(book.author ?? "")}</dc:creator><dc:language>${escapeXml(book.language ?? "pt-BR")}</dc:language><meta property="dcterms:modified">${new Date().toISOString()}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${chapterItems.map(item => `<item id="${item.id}" href="${item.file}" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine>${chapterItems.map(item => `<itemref idref="${item.id}"/>`).join("")}</spine></package>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
}

export function buildPdf(book: ExportBook): Blob {
  const compact = book.layout === "compact";
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = compact ? 48 : 72;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const height = pdf.internal.pageSize.getHeight();
  let y = margin;
  pdf.setFont("times", "normal"); pdf.setFontSize(compact ? 24 : 28); pdf.text(book.title, margin, y); y += 26;
  if (book.author) { pdf.setFontSize(12); pdf.text(book.author, margin, y); y += 32; }
  for (const chapter of book.chapters) {
    pdf.addPage(); y = margin; pdf.setFontSize(compact ? 18 : 22); pdf.text(chapter.title, margin, y); y += 32; pdf.setFontSize(compact ? 10 : 12);
    const lines = pdf.splitTextToSize(chapter.content, width) as string[];
    for (const line of lines) { if (y > height - margin) { pdf.addPage(); y = margin; } pdf.text(line, margin, y); y += compact ? 15 : 18; }
  }
  return pdf.output("blob");
}

export async function buildDocx(book: ExportBook): Promise<Blob> {
  const compact = book.layout === "compact";
  const children = [new Paragraph({ text: book.title, heading: HeadingLevel.TITLE }), ...(book.author ? [new Paragraph({ children: [new TextRun(book.author)] })] : []), ...book.chapters.flatMap(chapter => [new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1 }), ...chapter.content.split(/\n{2,}/).map(text => new Paragraph({ text, spacing: { after: compact ? 120 : 240, line: compact ? 276 : 360 } }))])];
  return Packer.toBlob(new Document({ sections: [{ properties: { page: { margin: { top: compact ? 720 : 1080, right: compact ? 720 : 1080, bottom: compact ? 720 : 1080, left: compact ? 720 : 1080 } } }, children }] }));
}

export function chaptersFromNodes(nodes: Array<{ id: string; title: string; content: string; kind?: string }>): ExportChapter[] { return nodes.filter(node => node.kind !== "part").map(node => ({ id: node.id, title: node.title, content: node.content })); }
