// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const analysis = {
    summary: "A imagem inicial é clara.",
    strengths: ["Imagem concreta"],
    suggestions: [{ category: "gramatica", severity: "revisar", original: "A noite", suggestion: "A tarde", explanation: "Alternativa de teste.", confidence: 0.9, start: 0, end: 7 }],
    narrativeNotes: [], model: "literary-model", availableModels: ["literary-model"],
  };
  let literaryOptions: { onSuccess?: (value: typeof analysis) => void } = {};
  const literaryMutation = { isPending: false, mutate: vi.fn(() => literaryOptions.onSuccess?.(analysis)) };
  const library = { version: 1, books: [{ id: "book-1", title: "Caderno", status: "draft", targetWordCount: 50000, updatedAt: Date.now(), nodes: [{ id: "chapter-1", title: "Capítulo 1", kind: "chapter", content: "A noite caiu.", updatedAt: Date.now() }] }] };
  const trpc = {
    data: { get: { useQuery: vi.fn(() => ({ data: { data: library, sha: "sha-1" }, isLoading: false, refetch: vi.fn() })) }, status: { useQuery: vi.fn(() => ({ data: { status: "synced" } })) }, put: { useMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })) } },
    literaryAssist: { models: { useQuery: vi.fn(() => ({ data: { models: [{ id: "literary-model" }] } })) }, analyze: { useMutation: vi.fn((options: typeof literaryOptions) => { literaryOptions = options; return literaryMutation; }) } },
    useUtils: vi.fn(() => ({ data: { status: { invalidate: vi.fn() } } })),
  };
  return { trpc, literaryMutation, analysis, library };
});

vi.mock("@/lib/trpc", () => ({ trpc: harness.trpc }));
import WriterStudio from "./WriterStudio";

describe("WriterStudio integrated literary assistance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("sends the draft only after analysis is requested and applies the returned suggestion manually", async () => {
    render(<WriterStudio />);
    fireEvent.click(screen.getByRole("button", { name: /Caderno/ }));
    expect(await screen.findByText("Projeto do livro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manuscrito" }));
    const editor = await screen.findByRole("textbox", { name: "Editar bloco 1" });
    await waitFor(() => expect(editor.textContent).toBe("A noite caiu."));

    fireEvent.click(screen.getByRole("button", { name: "Analisar trecho" }));
    await waitFor(() => expect(screen.getByText("A imagem inicial é clara.")).toBeTruthy());
    expect(editor.textContent).toBe("A noite caiu.");

    fireEvent.click(screen.getByRole("button", { name: "Aplicar sugestão" }));
    expect(editor.textContent).toBe("A tarde caiu.");

    fireEvent.input(editor, { target: { textContent: "A tarde caiu. A cidade acordou." } });
    await new Promise(resolve => setTimeout(resolve, 950));
    const bibliotecaButtons = screen.getAllByRole("button", { name: "Biblioteca" });
    fireEvent.click(bibliotecaButtons[bibliotecaButtons.length - 1]);
    fireEvent.click(screen.getByRole("button", { name: /Caderno/ }));
    fireEvent.click(screen.getByRole("button", { name: "Manuscrito" }));
    const reopenedEditor = await screen.findByRole("textbox", { name: "Editar bloco 1" });
    expect(reopenedEditor.textContent).toBe("A tarde caiu. A cidade acordou.");

    fireEvent.click(screen.getByRole("button", { name: "Projeto" }));
    expect(await screen.findByText("Projeto do livro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Planejar" }));
    expect(await screen.findByText("Seu projeto, antes das páginas.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manuscrito" }));
    expect(await screen.findByRole("textbox", { name: "Editar bloco 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preparar" }));
    expect(await screen.findByText("Preparação editorial")).toBeTruthy();
  });
});
