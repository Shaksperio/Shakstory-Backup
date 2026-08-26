import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { BookOpenText, Github, Loader2, ShieldCheck } from "lucide-react";

export default function Home() {
  const { loading, user } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><BookOpenText className="h-6 w-6" /></div>
          <p className="mt-7 font-mono text-xs uppercase tracking-[0.16em] text-primary">Shakstory</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Seu estúdio de autor.</h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-muted-foreground">Escreva com foco, organize seu universo e mantenha seu trabalho versionado com segurança.</p>
          <Button size="lg" className="mt-8 rounded-xl px-6" onClick={() => startLogin()}>Entrar no estúdio</Button>
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Acesso protegido por autenticação segura</p>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><BookOpenText className="h-5 w-5" /></div><div><p className="font-serif text-xl">Shakstory</p><p className="text-xs text-muted-foreground">Estúdio do autor</p></div></div>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-primary">Integração de dados</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight">Conecte seu GitHub.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Autorize o Shakstory a sincronizar documentos editoriais versionados no repositório privado selecionado. O token permanece no backend.</p>
        <Button className="mt-7 w-full rounded-xl" size="lg" onClick={() => window.location.assign("/api/github/oauth/start")}><Github className="mr-2 h-4 w-4" />Autorizar GitHub OAuth</Button>
        <p className="mt-5 text-center text-xs text-muted-foreground">Sessão Manus ativa para {user.name || user.email || "autor"}.</p>
      </section>
    </main>
  );
}
