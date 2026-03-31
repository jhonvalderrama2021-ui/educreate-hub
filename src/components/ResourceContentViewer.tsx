export function ResourceContentViewer({ type, content }: { type: string; content: any }) {
  switch (type) {
    case "icfes":
    case "quiz":
      return (
        <div className="space-y-6">
          {content.questions?.map((q: any) => (
            <div key={q.number} className="p-4 border border-border rounded-lg bg-muted/20">
              <p className="font-semibold text-foreground mb-2">
                {q.number}. {q.question}
              </p>
              {q.context && <p className="text-sm text-muted-foreground mb-3 italic">{q.context}</p>}
              <div className="space-y-1.5 mb-3">
                {q.options && (Array.isArray(q.options)
                  ? q.options.map((opt: string, i: number) => (
                    <p key={i} className={`text-sm pl-4 py-1 rounded ${
                      String(q.correct) === opt || String(q.correct) === String.fromCharCode(65 + i)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground"
                    }`}>
                      {String.fromCharCode(65 + i)}. {opt}
                    </p>
                  ))
                  : Object.entries(q.options).map(([k, v]) => (
                    <p key={k} className={`text-sm pl-4 py-1 rounded ${
                      q.correct === k ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                    }`}>
                      {k}. {String(v)}
                    </p>
                  ))
                )}
              </div>
              {q.explanation && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  💡 {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      );

    case "workshop":
      return (
        <div className="space-y-4">
          {content.objective && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm"><strong>Objetivo:</strong> {content.objective}</p>
              {content.duration && <p className="text-sm"><strong>Duración:</strong> {content.duration}</p>}
            </div>
          )}
          {content.materials?.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1">Materiales:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {content.materials.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {content.activities?.map((a: any) => (
            <div key={a.number} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">Actividad {a.number}: {a.title}</h3>
              <p className="text-sm text-foreground mb-2">{a.description}</p>
              {a.instructions && <p className="text-sm text-muted-foreground italic">{a.instructions}</p>}
              {a.duration && <p className="text-xs text-muted-foreground mt-1">⏱ {a.duration}</p>}
            </div>
          ))}
          {content.evaluation && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-sm"><strong>Evaluación:</strong> {content.evaluation}</p>
            </div>
          )}
        </div>
      );

    case "guide":
      return (
        <div className="space-y-4">
          {content.introduction && <p className="text-foreground">{content.introduction}</p>}
          {content.objectives?.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1">Objetivos:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {content.objectives.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          {content.sections?.map((s: any) => (
            <div key={s.number} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">{s.number}. {s.title}</h3>
              <p className="text-sm text-foreground mb-2">{s.content}</p>
              {s.examples?.length > 0 && (
                <div className="bg-muted/30 p-2 rounded text-sm">
                  <strong>Ejemplos:</strong>
                  <ul className="list-disc list-inside">{s.examples.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
            </div>
          ))}
          {content.summary && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm"><strong>Resumen:</strong> {content.summary}</p>
            </div>
          )}
        </div>
      );

    case "lesson_plan":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {content.grade && <p><strong>Grado:</strong> {content.grade}</p>}
            {content.duration && <p><strong>Duración:</strong> {content.duration}</p>}
          </div>
          {content.objective && <p className="text-sm bg-primary/5 p-3 rounded-lg"><strong>Objetivo:</strong> {content.objective}</p>}
          {content.phases?.map((p: any, i: number) => (
            <div key={i} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">{p.name} ({p.duration})</h3>
              <p className="text-sm text-foreground">{p.activities}</p>
              {p.resources && <p className="text-xs text-muted-foreground mt-1">📚 {p.resources}</p>}
            </div>
          ))}
          {content.evaluation && <p className="text-sm p-3 bg-muted/30 rounded-lg"><strong>Evaluación:</strong> {content.evaluation}</p>}
        </div>
      );

    case "rubric":
      return (
        <div className="space-y-4">
          {content.objective && <p className="text-sm bg-primary/5 p-3 rounded-lg"><strong>Objetivo:</strong> {content.objective}</p>}
          {content.criteria?.map((c: any, i: number) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <div className="p-3 bg-muted/30 font-semibold text-sm flex justify-between">
                <span>{c.name}</span>
                {c.weight && <span className="text-muted-foreground">{c.weight}%</span>}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
                {Object.entries(c.descriptions || {}).map(([level, desc]) => (
                  <div key={level} className="p-3">
                    <p className="text-xs font-semibold text-primary mb-1">{level}</p>
                    <p className="text-xs text-muted-foreground">{String(desc)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    default:
      return <pre className="text-xs overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
  }
}
