import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { applySuggestionAtOffsets } from "@shared/literary";
import { AlertCircle, BookOpen, Check, CheckCircle2, ChevronRight, CloudOff, FileText, Github, History, Lightbulb, Loader2, Plus, RefreshCw, Save, Search, Sparkles, Target, UsersRound, WandSparkles, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

type View = "library" | "editor" | "planning";
type Node = { id: string; title: string; kind: "chapter" | "scene" | "part"; content: string; updatedAt: number };
type Book = { id: string; title: string; subtitle?: string; status: "planning" | "draft" | "revision"; targetWordCount: number; nodes: Node[]; updatedAt: number };
type LibraryDocument = { version: 1; books: Book[] };
type LiterarySuggestion = { category: string; severity: string; original: string; suggestion: string; explanation: string; confidence: number; start: number; end: number };
type LiteraryResult = { summary: string; strengths: string[]; suggestions: LiterarySuggestion[]; narrativeNotes: string[]; model: string; availableModels: string[] };
type LiteraryAssistantProps = { focus: "language" | "grammar" | "parts_of_speech" | "lexicon" | "narrative" | "voice" | "style" | "full"; setFocus: (focus: LiteraryAssistantProps["focus"]) => void; result: LiteraryResult | null; models: Array<{ id: string }>; isLoading: boolean; error: string | null; onAnalyze: () => void; onApply: (start: number, end: number, original: string, suggestion: string) => void };

type SyncState = { mode: "github" | "json"; status: "idle" | "syncing" | "synced" | "conflict" | "error"; lastSyncAt: number | null; lastWebhookAt: number | null; lastWebhookEvent: string | null; lastConflictPath: string | null; lastError: string | null };

const emptyLibrary: LibraryDocument = { version: 1, books: [] };
const countWords = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;
const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const formatDate = (value: number) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(value);

export default function WriterStudio() {
  const [view, setView] = useState<View>("library");
  const libraryQuery = trpc.data.get.useQuery({ path: "library.json" });
  const statusQuery = trpc.data.status.useQuery(undefined, { refetchInterval: 15000 });
  const modelQuery = trpc.literaryAssist.models.useQuery(undefined, { enabled: view === "editor" });
  const utils = trpc.useUtils();
  const literaryMutation = trpc.literaryAssist.analyze.useMutation({ onSuccess: data => setAssistResult(data) });
  const [library, setLibrary] = useState<LibraryDocument>(emptyLibrary);
  const [sha, setSha] = useState<string | undefined>();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [query, setQuery] = useState("");
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [assistFocus, setAssistFocus] = useState<"language" | "grammar" | "parts_of_speech" | "lexicon" | "narrative" | "voice" | "style" | "full">("full");
  const [assistResult, setAssistResult] = useState<LiteraryResult | null>(null);

  const activeBook = useMemo(() => library.books.find(book => book.id === activeBookId) ?? null, [library.books, activeBookId]);
  const activeNode = useMemo(() => activeBook?.nodes.find(node => node.id === activeNodeId) ?? activeBook?.nodes[0] ?? null, [activeBook, activeNodeId]);
  const totalWords = useMemo(() => library.books.reduce((sum, book) => sum + book.nodes.reduce((nodeSum, node) => nodeSum + countWords(node.content), 0), 0), [library.books]);

  useEffect(() => {
    if (libraryQuery.isLoading) return;
    const savedDraft = localStorage.getItem("shakstory:library");
    if (libraryQuery.data?.data) {
      setLibrary(libraryQuery.data.data as LibraryDocument);
      setSha(libraryQuery.data.sha);
      setLocalOnly(false);
      return;
    }
    if (savedDraft) {
      try { setLibrary(JSON.parse(savedDraft) as LibraryDocument); } catch { localStorage.removeItem("shakstory:library"); }
    }
  }, [libraryQuery.data, libraryQuery.isLoading]);

  useEffect(() => {
    if (!activeNode) return;
    setAssistResult(null);
    const localDraft = localStorage.getItem(`shakstory:node:${activeNode.id}`);
    setDraft(localDraft ?? activeNode.content);
  }, [activeNode?.id]);

  useEffect(() => {
    if (!activeNode || draft === activeNode.content) return;
    const timer = window.setTimeout(() => {
      const nextLibrary = {
        ...library,
        books: library.books.map(book => book.id !== activeBookId ? book : {
          ...book,
          updatedAt: Date.now(),
          nodes: book.nodes.map(node => node.id === activeNode.id ? { ...node, content: draft, updatedAt: Date.now() } : node),
        }),
      };
      localStorage.setItem(`shakstory:node:${activeNode.id}`, draft);
      setLibrary(nextLibrary);
      if (!navigator.onLine) { setLocalOnly(true); return; }
      saveLibrary(nextLibrary);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [draft, activeNode?.id]);

  const saveMutation = trpc.data.put.useMutation({
    onSuccess: result => {
      setSha(result.sha);
      setLocalOnly(false);
      setConflict(false);
      setNotice("Salvo no GitHub");
      void utils.data.status.invalidate();
      window.setTimeout(() => setNotice(null), 2200);
    },
    onError: error => {
      if (error.data?.code === "CONFLICT") setConflict(true);
      else setLocalOnly(true);
    },
  });

  const saveLibrary = (nextLibrary: LibraryDocument) => {
    if (!navigator.onLine) { setLocalOnly(true); return; }
    saveMutation.mutate({ path: "library.json", data: nextLibrary as unknown as Record<string, unknown>, expectedSha: sha });
  };

  const createBook = () => {
    const title = newBookTitle.trim();
    if (!title) return;
    const now = Date.now();
    const book: Book = { id: `book-${now}`, title, status: "planning", targetWordCount: 50000, updatedAt: now, nodes: [{ id: `chapter-${now}`, title: "Capítulo 1", kind: "chapter", content: "", updatedAt: now }] };
    const nextLibrary = { ...library, books: [book, ...library.books] };
    setLibrary(nextLibrary);
    setActiveBookId(book.id);
    setActiveNodeId(book.nodes[0].id);
    setNewBookTitle("");
    setNewBookOpen(false);
    setView("editor");
    saveLibrary(nextLibrary);
  };

  const updateDraft = (value: string) => {
    setAssistResult(null);
    setDraft(value);
    if (activeNode) localStorage.setItem(`shakstory:node:${activeNode.id}`, value);
  };

  const chooseBook = (book: Book) => {
    setActiveBookId(book.id);
    setActiveNodeId(book.nodes[0]?.id ?? null);
    setView("editor");
  };

  const syncLabel = statusQuery.data?.status === "syncing" || saveMutation.isPending ? "Sincronizando" : localOnly ? "Somente local" : statusQuery.data?.status === "conflict" || conflict ? "Conflito" : statusQuery.data?.status === "synced" ? "Sincronizado" : "Pronto para salvar";

  const filteredBooks = library.books.filter(book => !query.trim() || book.title.toLowerCase().includes(query.toLowerCase()) || book.nodes.some(node => node.content.toLowerCase().includes(query.toLowerCase())));


  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BookOpen className="h-4 w-4" /></div><div className="min-w-0"><p className="font-serif text-lg leading-none">Shakstory</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Estúdio do autor</p></div><nav className="ml-6 hidden items-center gap-1 md:flex"><NavButton active={view === "library"} icon={BookOpen} label="Biblioteca" onClick={() => setView("library")} /><NavButton active={view === "editor"} icon={FileText} label="Escrever" onClick={() => activeBook && setView("editor")} /><NavButton active={view === "planning"} icon={UsersRound} label="Planejar" onClick={() => activeBook && setView("planning")} /></nav><div className="ml-auto flex items-center gap-2"><span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:inline-flex ${localOnly || conflict ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}><SyncIcon localOnly={localOnly} conflict={conflict} />{syncLabel}</span><Button variant="ghost" size="icon" aria-label="Buscar" onClick={() => document.getElementById("library-search")?.focus()}><Search className="h-4 w-4" /></Button></div></div></header>
    {conflict && <div className="border-b border-amber-500/25 bg-amber-500/10"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2.5 text-sm text-amber-900 dark:text-amber-100"><span>Outra sessão alterou o documento antes deste salvamento. Recarregue antes de substituir o conteúdo.</span><Button size="sm" variant="outline" onClick={() => { setConflict(false); void libraryQuery.refetch(); }}>Recarregar</Button></div></div>}
    <main className="mx-auto max-w-7xl px-5 py-8 sm:py-12">{view === "library" && <LibraryView books={filteredBooks} totalWords={totalWords} query={query} onQuery={setQuery} onOpen={chooseBook} onNew={() => setNewBookOpen(true)} />}{view === "editor" && activeBook && <EditorView book={activeBook} nodes={activeBook.nodes} activeNode={activeNode} draft={draft} onDraftChange={updateDraft} onSelectNode={setActiveNodeId} onBack={() => setView("library")} onSave={() => saveLibrary(library)} saving={saveMutation.isPending} notice={notice} assistant={{ focus: assistFocus, setFocus: setAssistFocus, result: assistResult, models: modelQuery.data?.models ?? [], isLoading: literaryMutation.isPending, error: literaryMutation.error?.message ?? null, onAnalyze: () => { if (activeNode && draft.trim()) literaryMutation.mutate({ text: draft, focus: assistFocus }); }, onApply: (start, end, original, suggestion) => { if (!original || !suggestion || draft.slice(start, end) !== original) return; updateDraft(applySuggestionAtOffsets(draft, start, end, original, suggestion)); } }} />}{view === "planning" && activeBook && <PlanningView book={activeBook} />}</main>
    {newBookOpen && <div className="fixed inset-0 z-30 grid place-items-center bg-black/30 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="new-book-title"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">Novo projeto</p><h2 id="new-book-title" className="mt-2 font-serif text-3xl">Comece a história.</h2></div><Button size="icon" variant="ghost" onClick={() => setNewBookOpen(false)} aria-label="Fechar"><X className="h-4 w-4" /></Button></div><p className="mt-3 text-sm leading-6 text-muted-foreground">O primeiro capítulo será criado automaticamente. Você pode completar os metadados quando quiser.</p><label className="mt-6 block text-xs font-medium text-muted-foreground">Título<Input className="mt-2" autoFocus value={newBookTitle} onChange={event => setNewBookTitle(event.target.value)} onKeyDown={event => event.key === "Enter" && createBook()} placeholder="O nome do seu livro" /></label><Button className="mt-5 w-full" onClick={createBook} disabled={!newBookTitle.trim()}><Plus className="mr-2 h-4 w-4" />Criar livro</Button></div></div>}
  </div>;
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof BookOpen; label: string; onClick: () => void }) { return <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }
function SyncIcon({ localOnly, conflict }: { localOnly: boolean; conflict: boolean }) { return conflict || localOnly ? <CloudOff className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />; }

function LibraryView({ books, totalWords, query, onQuery, onOpen, onNew }: { books: Book[]; totalWords: number; query: string; onQuery: (value: string) => void; onOpen: (book: Book) => void; onNew: () => void }) {
  return <div className="animate-in fade-in-0 duration-300"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Seu espaço de criação</p><h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">Minha biblioteca</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Um lugar calmo para transformar intenção em páginas.</p></div><Button onClick={onNew} className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Novo livro</Button></div><div className="mt-8 grid gap-3 sm:grid-cols-3"><Stat label="Projetos" value={String(books.length)} icon={BookOpen} /><Stat label="Palavras escritas" value={formatNumber(totalWords)} icon={FileText} /><Stat label="Foco desta sessão" value="Sem pressão" icon={Target} /></div><div className="mt-9 flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Projetos recentes</h2><div className="relative w-56"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="library-search" value={query} onChange={event => onQuery(event.target.value)} className="h-9 pl-9 text-xs" placeholder="Buscar na biblioteca" /></div></div>{books.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8 sm:p-12"><Sparkles className="h-5 w-5 text-primary" /><h3 className="mt-4 font-serif text-3xl">A primeira página está esperando.</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Crie um projeto e comece pelo lugar que a sua história pede.</p><Button onClick={onNew} variant="outline" className="mt-6 rounded-xl">Criar meu primeiro livro</Button></div> : <div className="mt-4 grid gap-4 md:grid-cols-2">{books.map(book => <BookCard key={book.id} book={book} onOpen={() => onOpen(book)} />)}</div>}</div>;
}
function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BookOpen }) { return <div className="rounded-xl border border-border/70 bg-card p-4"><Icon className="h-4 w-4 text-primary" /><p className="mt-5 text-xs text-muted-foreground">{label}</p><p className="mt-1 font-serif text-2xl">{value}</p></div>; }
function BookCard({ book, onOpen }: { book: Book; onOpen: () => void }) { const words = book.nodes.reduce((sum, node) => sum + countWords(node.content), 0); const progress = Math.min(100, Math.round((words / Math.max(1, book.targetWordCount)) * 100)); return <button onClick={onOpen} className="group flex w-full gap-4 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="grid h-32 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/90 to-primary/50 text-primary-foreground"><span className="font-serif text-4xl italic">{book.title.charAt(0).toUpperCase()}</span></div><div className="min-w-0 flex-1 py-1"><div className="flex items-start justify-between gap-3"><div><h3 className="truncate font-serif text-xl">{book.title}</h3><p className="mt-1 text-xs text-muted-foreground">{book.status === "planning" ? "Planejamento" : book.status === "revision" ? "Em revisão" : "Em escrita"}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" /></div><div className="mt-9"><div className="mb-2 flex justify-between text-[11px] text-muted-foreground"><span>{formatNumber(words)} palavras</span><span>{progress}%</span></div><Progress value={progress} className="h-1.5" /></div><p className="mt-3 text-[11px] text-muted-foreground">Atualizado {formatDate(book.updatedAt)}</p></div></button>; }

function EditorView({ book, nodes, activeNode, draft, onDraftChange, onSelectNode, onBack, onSave, saving, notice, assistant }: { book: Book; nodes: Node[]; activeNode: Node | null; draft: string; onDraftChange: (value: string) => void; onSelectNode: (id: string) => void; onBack: () => void; onSave: () => void; saving: boolean; notice: string | null; assistant: LiteraryAssistantProps }) {
  return <div className="-mx-5 -my-8 flex min-h-[calc(100vh-5rem)] flex-col sm:-my-12 sm:min-h-[calc(100vh-7rem)]"><div className="flex items-center gap-3 border-b border-border/70 px-5 py-3"><Button variant="ghost" size="sm" onClick={onBack}>Biblioteca</Button><ChevronRight className="h-3 w-3 text-muted-foreground" /><span className="truncate text-sm font-medium">{book.title}</span><div className="ml-auto flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{formatNumber(countWords(draft))} palavras</span><Button onClick={onSave} variant="outline" size="sm" disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />{notice || (saving ? "Salvando" : "Salvar")}</Button></div></div><div className="grid flex-1 lg:grid-cols-[220px_minmax(0,1fr)_320px]"><aside className="border-b border-border/70 bg-secondary/30 p-3 lg:border-b-0 lg:border-r"><p className="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Manuscrito</p>{nodes.map(node => <button key={node.id} onClick={() => onSelectNode(node.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${node.id === activeNode?.id ? "bg-card font-medium text-primary shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}><FileText className="h-3.5 w-3.5" /><span className="truncate">{node.title}</span></button>)}</aside><section className="flex min-h-[34rem] flex-col px-5 py-10 sm:px-12 lg:px-16"><div className="mx-auto flex w-full max-w-3xl flex-1 flex-col"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{activeNode?.kind === "chapter" ? "Capítulo" : "Cena"}</p><h1 className="mt-3 font-serif text-3xl tracking-tight">{activeNode?.title}</h1><Textarea value={draft} onChange={event => onDraftChange(event.target.value)} className="mt-8 min-h-[27rem] flex-1 resize-none border-0 bg-transparent p-0 font-serif text-lg leading-[1.9] shadow-none focus-visible:ring-0" placeholder="Comece onde a história pede." spellCheck /><div className="mt-6 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground"><span>O rascunho local permanece disponível sem conexão.</span><span>{formatNumber(countWords(draft))} palavras</span></div></div></section><aside className="border-t border-border/70 bg-secondary/20 p-4 lg:border-l lg:border-t-0 lg:p-5"><LiteraryAssistant {...assistant} /><div className="mt-4 rounded-xl border border-border/70 bg-card p-4"><History className="h-4 w-4 text-primary" /><p className="mt-3 text-sm font-medium">Histórico preparado</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Cada salvamento usa SHA; a IA nunca substitui o texto automaticamente.</p></div><div className="mt-3 rounded-xl border border-border/70 bg-card p-4"><Github className="h-4 w-4 text-primary" /><p className="mt-3 text-sm font-medium">Versão GitHub</p><p className="mt-2 text-xs leading-5 text-muted-foreground">O texto é sincronizado somente quando você salva.</p></div></aside></div></div>;
}

export function LiteraryAssistant({ focus, setFocus, result, models, isLoading, error, onAnalyze, onApply }: LiteraryAssistantProps) {
  const labels: Record<LiteraryAssistantProps["focus"], string> = { full: "Revisão completa", language: "Ortografia e clareza", grammar: "Gramática e tempos", parts_of_speech: "Classes gramaticais", lexicon: "Palavras e sinônimos", narrative: "Narrativa e ritmo", voice: "Tom e voz", style: "Estilo" };
  return <div className="rounded-xl border border-primary/20 bg-card p-4"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10"><WandSparkles className="h-4 w-4 text-primary" /></div><div><p className="text-sm font-medium">Assessoria literária</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Sugestões explicadas, sempre sob seu controle.</p></div></div><select value={focus} onChange={event => setFocus(event.target.value as LiteraryAssistantProps["focus"])} className="mt-4 h-9 w-full rounded-md border border-border bg-background px-2 text-xs">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button className="mt-3 w-full" size="sm" onClick={onAnalyze} disabled={isLoading}><WandSparkles className="mr-2 h-3.5 w-3.5" />{isLoading ? "Lendo o trecho…" : "Analisar trecho"}</Button><p className="mt-2 text-[10px] leading-4 text-muted-foreground">O trecho é enviado apenas quando você solicita a análise. Modelo: {result?.model ?? models[0]?.id ?? "padrão do estúdio"}.</p>{error && <div className="mt-3 flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{error}</span></div>}{result && <div className="mt-4 space-y-3"><div className="rounded-lg bg-primary/5 p-3"><p className="text-xs leading-5">{result.summary}</p></div>{result.strengths.length > 0 && <div><p className="mb-2 flex items-center gap-2 text-xs font-medium"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />Pontos fortes</p><ul className="space-y-1 text-xs text-muted-foreground">{result.strengths.slice(0, 3).map((item, index) => <li key={index}>• {item}</li>)}</ul></div>}{result.suggestions.length > 0 && <div><p className="mb-2 flex items-center gap-2 text-xs font-medium"><Lightbulb className="h-3.5 w-3.5 text-primary" />Sugestões ({result.suggestions.length})</p><div className="space-y-2">{result.suggestions.map((item, index) => <div key={`${item.original}-${index}`} className="rounded-lg border border-border/70 p-3"><div className="flex items-center justify-between gap-2"><Badge variant="outline" className="text-[10px]">{item.category}</Badge><span className="text-[10px] text-muted-foreground">{Math.round(item.confidence * 100)}%</span></div>{item.original && <p className="mt-2 text-xs line-through text-muted-foreground">{item.original}</p>}{item.suggestion && <p className="mt-1 text-xs font-medium">{item.suggestion}</p>}<p className="mt-2 text-[11px] leading-4 text-muted-foreground">{item.explanation}</p>{item.original && item.suggestion && <Button variant="outline" size="sm" className="mt-2 h-7 text-[10px]" onClick={() => onApply(item.start, item.end, item.original, item.suggestion)}>Aplicar sugestão</Button>}</div>)}</div></div>}{result.narrativeNotes.length > 0 && <div><p className="mb-2 text-xs font-medium">Notas de leitura</p><ul className="space-y-1 text-xs text-muted-foreground">{result.narrativeNotes.slice(0, 4).map((item, index) => <li key={index}>• {item}</li>)}</ul></div>}</div>}</div>;
}
function PlanningView({ book }: { book: Book }) { return <div className="animate-in fade-in-0 duration-300"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Universo da história</p><h1 className="mt-2 font-serif text-4xl">Planejar com contexto.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Personagens, lugares e ideias serão organizados aqui sem tirar você do fluxo de escrita.</p><div className="mt-8 grid gap-4 md:grid-cols-3"><PlanningCard icon={UsersRound} title="Personagens" /><PlanningCard icon={Sparkles} title="Ideias" /><PlanningCard icon={Target} title="Metas" /></div><p className="mt-8 text-xs text-muted-foreground">{book.title} está pronto para receber a próxima camada de planejamento.</p></div>; }
function PlanningCard({ icon: Icon, title }: { icon: typeof UsersRound; title: string }) { return <div className="rounded-2xl border border-border/70 bg-card p-5"><Icon className="h-4 w-4 text-primary" /><h2 className="mt-8 font-serif text-xl">{title}</h2><p className="mt-2 text-xs text-muted-foreground">Em breve, conectado ao manuscrito.</p></div>; }
