// @vitest-environment jsdom
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanningView } from "./WriterStudio";

type Planning = { characters: Array<{ id: string; name: string; role: string; notes: string }>; locations: Array<{ id: string; name: string; atmosphere: string; notes: string }>; timeline: Array<{ id: string; title: string; date: string; description: string }> };

function Harness() {
  const [planning, setPlanning] = useState<Planning>({ characters: [], locations: [], timeline: [] });
  return <PlanningView book={{ id: "book-1", title: "Caderno", status: "planning", targetWordCount: 50000, updatedAt: 1, nodes: [], planning }} onUpdate={setPlanning} />;
}

describe("PlanningView", () => {
  it("creates characters, locations and timeline events", () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Nome do personagem"), { target: { value: "Lia" } });
    fireEvent.change(screen.getByPlaceholderText("Função na história"), { target: { value: "Protagonista" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("Lia")).toBeTruthy();

    fireEvent.click(screen.getByText("Locais", { exact: true }));
    fireEvent.change(screen.getByPlaceholderText("Nome do local"), { target: { value: "Casa azul" } });
    fireEvent.change(screen.getByPlaceholderText("Atmosfera"), { target: { value: "Silenciosa" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("Casa azul")).toBeTruthy();

    fireEvent.click(screen.getByText("Timeline", { exact: true }));
    fireEvent.change(screen.getByPlaceholderText("Título do evento"), { target: { value: "A partida" } });
    fireEvent.change(screen.getByPlaceholderText("Data ou ordem"), { target: { value: "Noite 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("A partida")).toBeTruthy();
  });
});
