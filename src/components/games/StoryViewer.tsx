import type { StoryContent } from "@/pages/resources/Story";

interface Props {
  content: StoryContent;
}

export function StoryViewer({ content }: Props) {
  // Elegant serif typography for storybook feel
  const storyFont = { fontFamily: 'Georgia, "Times New Roman", serif' };
  return (
    <article className="max-w-none space-y-6" style={storyFont}>
      {content.coverImageUrl && (
        <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
          <img
            src={content.coverImageUrl}
            alt={`Portada de ${content.title}`}
            className="w-full max-h-[480px] object-cover"
          />
        </div>
      )}
      <h1
        className="text-4xl font-bold text-foreground text-center !mt-4 tracking-wide"
        style={storyFont}
      >
        {content.title}
      </h1>
      {content.character && (
        <p className="text-center text-muted-foreground italic !mt-1" style={storyFont}>
          Protagonista: {content.character}
          {content.characterType ? ` (${content.characterType})` : ""}
        </p>
      )}
      {content.chapters.map((ch, i) => (
        <section key={i} className="space-y-4 pt-6 border-t border-border/50">
          <h2
            className="text-2xl font-bold text-foreground text-center"
            style={storyFont}
          >
            {ch.title}
          </h2>
          {ch.imageUrl && (
            <div className="rounded-lg overflow-hidden border border-border max-w-xl mx-auto">
              <img src={ch.imageUrl} alt={ch.title} className="w-full max-h-[340px] object-cover" />
            </div>
          )}
          {ch.text.split(/\n\n+/).map((p, j) => (
            <p
              key={j}
              className="text-foreground leading-relaxed text-justify whitespace-pre-line"
              style={{ ...storyFont, fontSize: "1.05rem" }}
            >
              {p}
            </p>
          ))}
        </section>
      ))}
      {content.moral && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-5 text-center mt-8">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Moraleja</p>
          <p className="text-foreground italic text-lg" style={storyFont}>{content.moral}</p>
        </div>
      )}
    </article>
  );
}
