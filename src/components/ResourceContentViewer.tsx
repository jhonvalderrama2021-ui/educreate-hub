import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SlideViewer } from "@/components/SlideViewer";
import { CrosswordGrid } from "@/components/games/CrosswordGrid";
import { StoryViewer } from "@/components/games/StoryViewer";

interface Props {
  type: string;
  content: any;
  editable?: boolean;
  onContentChange?: (content: any) => void;
}

export function ResourceContentViewer({ type, content, editable = false, onContentChange }: Props) {
  const update = (path: string[], value: any) => {
    if (!onContentChange) return;
    const copy = JSON.parse(JSON.stringify(content));
    let obj = copy;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = value;
    onContentChange(copy);
  };

  const EditableText = ({ value, path, multiline = false, className = "" }: { value: string; path: string[]; multiline?: boolean; className?: string }) => {
    if (!editable) return <span className={className}>{value}</span>;
    if (multiline) return <Textarea value={value || ""} onChange={(e) => update(path, e.target.value)} className={`text-sm ${className}`} rows={2} />;
    return <Input value={value || ""} onChange={(e) => update(path, e.target.value)} className={`text-sm ${className}`} />;
  };

  switch (type) {
    case "icfes":
    case "quiz":
    case "true_false":
    case "mixed":
      return (
        <div className="space-y-6">
          {/* Questions WITHOUT correct answer highlighted */}
          {content.questions?.map((q: any, idx: number) => (
            <div key={q.number || idx} className="p-4 border border-border rounded-lg bg-muted/20">
              <div className="font-semibold text-foreground mb-2">
                {editable ? (
                  <div className="flex gap-2 items-start">
                    <span className="mt-2">{q.number || idx + 1}.</span>
                    <EditableText value={q.question} path={["questions", String(idx), "question"]} multiline className="flex-1" />
                  </div>
                ) : (
                  <p>{q.number || idx + 1}. {q.question}</p>
                )}
              </div>
              {q.context && (
                editable ? (
                  <EditableText value={q.context} path={["questions", String(idx), "context"]} multiline className="text-muted-foreground italic mb-3" />
                ) : (
                  <p className="text-sm text-muted-foreground mb-3 italic">{q.context}</p>
                )
              )}
              <div className="space-y-1.5 mb-3">
                {q.options && (Array.isArray(q.options)
                  ? q.options.map((opt: string, i: number) => (
                    <div key={i} className="text-sm pl-4 py-1 rounded text-foreground">
                      {editable ? (
                        <div className="flex gap-2 items-center">
                          <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                          <EditableText value={opt} path={["questions", String(idx), "options", String(i)]} className="flex-1" />
                        </div>
                      ) : (
                        <p>{String.fromCharCode(65 + i)}. {opt}</p>
                      )}
                    </div>
                  ))
                  : typeof q.options === "object" && Object.entries(q.options).map(([k, v]) => (
                    <div key={k} className="text-sm pl-4 py-1 rounded text-foreground">
                      {editable ? (
                        <div className="flex gap-2 items-center">
                          <span className="font-medium">{k}.</span>
                          <EditableText value={String(v)} path={["questions", String(idx), "options", k]} className="flex-1" />
                        </div>
                      ) : (
                        <p>{k}. {String(v)}</p>
                      )}
                    </div>
                  ))
                )}
                {/* True/False display */}
                {q.type === "true_false" && !q.options && (
                  <div className="flex gap-4 pl-4">
                    <span className="text-sm py-1 text-foreground">○ Verdadero</span>
                    <span className="text-sm py-1 text-foreground">○ Falso</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Answer key at the end */}
          {content.questions?.length > 0 && (
            <div className="p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
              <h3 className="font-bold text-foreground mb-3 text-lg">📋 Respuestas correctas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {content.questions.map((q: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">{q.number || idx + 1}.</span>
                    {editable ? (
                      <EditableText value={q.correct} path={["questions", String(idx), "correct"]} className="w-20" />
                    ) : (
                      <span className="text-primary font-medium">{q.correct}</span>
                    )}
                  </div>
                ))}
              </div>
              {content.questions.some((q: any) => q.explanation) && (
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  <h4 className="font-semibold text-sm text-foreground">Explicaciones:</h4>
                  {content.questions.map((q: any, idx: number) => q.explanation && (
                    <p key={idx} className="text-xs text-muted-foreground">
                      <strong>{q.number || idx + 1}.</strong>{" "}
                      {editable ? (
                        <EditableText value={q.explanation} path={["questions", String(idx), "explanation"]} multiline />
                      ) : (
                        q.explanation
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );

    case "workshop":
      return (
        <div className="space-y-4">
          {content.objective && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm"><strong>Objetivo:</strong>{" "}
                <EditableText value={content.objective} path={["objective"]} multiline />
              </p>
              {content.duration && <p className="text-sm"><strong>Duración:</strong>{" "}
                <EditableText value={content.duration} path={["duration"]} />
              </p>}
            </div>
          )}
          {content.materials?.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1">Materiales:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {content.materials.map((m: string, i: number) => (
                  <li key={i}>
                    {editable ? <EditableText value={m} path={["materials", String(i)]} /> : m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content.activities?.map((a: any, idx: number) => (
            <div key={a.number || idx} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">
                Actividad {a.number || idx + 1}:{" "}
                <EditableText value={a.title} path={["activities", String(idx), "title"]} />
              </h3>
              <div className="text-sm text-foreground mb-2">
                <EditableText value={a.description} path={["activities", String(idx), "description"]} multiline />
              </div>
              {a.instructions && (
                <div className="text-sm text-muted-foreground italic">
                  <EditableText value={a.instructions} path={["activities", String(idx), "instructions"]} multiline />
                </div>
              )}
              {a.duration && <p className="text-xs text-muted-foreground mt-1">⏱ {a.duration}</p>}
            </div>
          ))}
          {content.evaluation && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-sm"><strong>Evaluación:</strong>{" "}
                <EditableText value={content.evaluation} path={["evaluation"]} multiline />
              </p>
            </div>
          )}
        </div>
      );

    case "guide":
      return (
        <div className="space-y-4">
          {content.introduction && (
            <div className="text-foreground">
              <EditableText value={content.introduction} path={["introduction"]} multiline />
            </div>
          )}
          {content.objectives?.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1">Objetivos:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {content.objectives.map((o: string, i: number) => (
                  <li key={i}>
                    {editable ? <EditableText value={o} path={["objectives", String(i)]} /> : o}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content.sections?.map((s: any, idx: number) => (
            <div key={s.number || idx} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">
                {s.number || idx + 1}.{" "}
                <EditableText value={s.title} path={["sections", String(idx), "title"]} />
              </h3>
              <div className="text-sm text-foreground mb-2">
                <EditableText value={s.content} path={["sections", String(idx), "content"]} multiline />
              </div>
              {s.examples?.length > 0 && (
                <div className="bg-muted/30 p-2 rounded text-sm">
                  <strong>Ejemplos:</strong>
                  <ul className="list-disc list-inside">
                    {s.examples.map((e: string, i: number) => (
                      <li key={i}>{editable ? <EditableText value={e} path={["sections", String(idx), "examples", String(i)]} /> : e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {content.summary && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm"><strong>Resumen:</strong>{" "}
                <EditableText value={content.summary} path={["summary"]} multiline />
              </p>
            </div>
          )}
        </div>
      );

    case "lesson_plan":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {content.grade && <p><strong>Grado:</strong> <EditableText value={content.grade} path={["grade"]} /></p>}
            {content.duration && <p><strong>Duración:</strong> <EditableText value={content.duration} path={["duration"]} /></p>}
          </div>
          {content.objective && (
            <div className="text-sm bg-primary/5 p-3 rounded-lg">
              <strong>Objetivo:</strong>{" "}
              <EditableText value={content.objective} path={["objective"]} multiline />
            </div>
          )}
          {content.phases?.map((p: any, i: number) => (
            <div key={i} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">
                <EditableText value={p.name} path={["phases", String(i), "name"]} /> ({p.duration})
              </h3>
              <div className="text-sm text-foreground">
                <EditableText value={p.activities} path={["phases", String(i), "activities"]} multiline />
              </div>
              {p.resources && <p className="text-xs text-muted-foreground mt-1">📚 {editable ? <EditableText value={p.resources} path={["phases", String(i), "resources"]} /> : p.resources}</p>}
            </div>
          ))}
          {content.evaluation && (
            <div className="text-sm p-3 bg-muted/30 rounded-lg">
              <strong>Evaluación:</strong>{" "}
              <EditableText value={content.evaluation} path={["evaluation"]} multiline />
            </div>
          )}
        </div>
      );

    case "rubric":
      return (
        <div className="space-y-4">
          {content.objective && (
            <div className="text-sm bg-primary/5 p-3 rounded-lg">
              <strong>Objetivo:</strong>{" "}
              <EditableText value={content.objective} path={["objective"]} multiline />
            </div>
          )}
          {content.criteria?.map((c: any, i: number) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <div className="p-3 bg-muted/30 font-semibold text-sm flex justify-between">
                <EditableText value={c.name} path={["criteria", String(i), "name"]} />
                {c.weight && <span className="text-muted-foreground">{editable ? <EditableText value={String(c.weight)} path={["criteria", String(i), "weight"]} className="w-16" /> : `${c.weight}%`}</span>}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
                {Object.entries(c.descriptions || {}).map(([level, desc]) => (
                  <div key={level} className="p-3">
                    <p className="text-xs font-semibold text-primary mb-1">{level}</p>
                    <div className="text-xs text-muted-foreground">
                      {editable ? (
                        <EditableText value={String(desc)} path={["criteria", String(i), "descriptions", level]} multiline />
                      ) : String(desc)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    case "slides":
      return (
        <SlideViewer
          slides={content?.slides || []}
          title={content?.title}
          theme={content?.theme}
          editable={editable}
          onSlideChange={
            onContentChange
              ? (index, updatedSlide) => {
                  const copy = JSON.parse(JSON.stringify(content));
                  copy.slides[index] = updatedSlide;
                  onContentChange(copy);
                }
              : undefined
          }
        />
      );

    case "crossword":
      return <CrosswordGrid content={content} interactive />;

    case "story":
      return <StoryViewer content={content} />;

    default:
      return <pre className="text-xs overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
  }
}
