import type { StoryContent } from "@/pages/resources/Story";

interface Props {
  content: StoryContent;
}

export function StoryViewer({ content }: Props) {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none space-y-6">
      {content.coverImageUrl && (
        <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
          <img
            src={content.coverImageUrl}
            alt={`Portada de ${content.title}`}
            className="w-full max-h-[420px] object-cover"
          />
        </div>
      )}
      <h1 className="text-3xl font-bold text-foreground text-center !mt-2">{content.title}</h1>
      {content.character && (
        <p className="text-center text-muted-foreground text-sm italic !mt-1">
          Protagonista: {content.character}
          {content.characterType ? ` (${content.characterType})` : ""}
        </p>
      )}
      {content.chapters.map((ch, i) => (
        <section key={i} className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground border-b border-border pb-1">
            {ch.title}
          </h2>
          {ch.imageUrl && (
            <div className="rounded-lg overflow-hidden border border-border">
              <img src={ch.imageUrl} alt={ch.title} className="w-full max-h-[320px] object-cover" />
            </div>
          )}
          {ch.text.split(/\n\n+/).map((p, j) => (
            <p key={j} className="text-foreground leading-relaxed whitespace-pre-line">{p}</p>
          ))}
        </section>
      ))}
      {content.moral && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Moraleja</p>
          <p className="text-foreground italic">{content.moral}</p>
        </div>
      )}
    </article>
  );
}
