import { useMemo, useState, useEffect } from "react";
import type { CrosswordContent } from "@/pages/resources/Crossword";
import { cn } from "@/lib/utils";

interface Props {
  content: CrosswordContent;
  showSolution?: boolean;
  interactive?: boolean;
}

export function CrosswordGrid({ content, showSolution = false, interactive = true }: Props) {
  const { grid, rows, cols, numbered, across, down, placed } = content;

  // user input grid (uppercase letters)
  const [userGrid, setUserGrid] = useState<string[][]>(() =>
    Array.from({ length: rows }, () => Array(cols).fill("")),
  );

  useEffect(() => {
    setUserGrid(Array.from({ length: rows }, () => Array(cols).fill("")));
  }, [rows, cols, content.theme]);

  const numberMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of numbered) m[`${n.row}-${n.col}`] = n.n;
    return m;
  }, [numbered]);

  const isCorrect = (r: number, c: number) => {
    const expected = grid[r][c];
    if (!expected) return null;
    const user = userGrid[r]?.[c]?.toUpperCase() || "";
    if (!user) return null;
    return user === expected;
  };

  const allCorrect = useMemo(() => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] && userGrid[r][c]?.toUpperCase() !== grid[r][c]) return false;
      }
    }
    return true;
  }, [userGrid, grid, rows, cols]);

  const handleChange = (r: number, c: number, val: string) => {
    const letter = val
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-ZÑ]/g, "")
      .slice(-1);
    setUserGrid((prev) => {
      const copy = prev.map((row) => [...row]);
      copy[r][c] = letter;
      return copy;
    });
    if (letter) {
      const next = document.querySelector<HTMLInputElement>(
        `input[data-cell="${r}-${c + 1}"]`,
      );
      next?.focus();
    }
  };

  const handleKeyDown = (r: number, c: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const current = userGrid[r]?.[c] || "";
      if (!current) {
        e.preventDefault();
        const prev = document.querySelector<HTMLInputElement>(
          `input[data-cell="${r}-${c - 1}"]`,
        );
        if (prev) {
          prev.focus();
          setUserGrid((g) => {
            const copy = g.map((row) => [...row]);
            if (copy[r][c - 1] !== undefined) copy[r][c - 1] = "";
            return copy;
          });
        }
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      setUserGrid((g) => {
        const copy = g.map((row) => [...row]);
        copy[r][c] = "";
        return copy;
      });
    } else if (e.key === "ArrowRight") {
      document.querySelector<HTMLInputElement>(`input[data-cell="${r}-${c + 1}"]`)?.focus();
    } else if (e.key === "ArrowLeft") {
      document.querySelector<HTMLInputElement>(`input[data-cell="${r}-${c - 1}"]`)?.focus();
    } else if (e.key === "ArrowDown") {
      document.querySelector<HTMLInputElement>(`input[data-cell="${r + 1}-${c}"]`)?.focus();
    } else if (e.key === "ArrowUp") {
      document.querySelector<HTMLInputElement>(`input[data-cell="${r - 1}-${c}"]`)?.focus();
    }
  };

  // Choose cell size to fit ~600px wide
  const cellPx = Math.max(22, Math.min(36, Math.floor(560 / cols)));

  return (
    <div className="space-y-4">
      {interactive && allCorrect && (
        <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-2 text-sm text-primary font-medium">
          🎉 ¡Crucigrama completado correctamente!
        </div>
      )}

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        {/* Grid */}
        <div className="overflow-auto">
          <div
            className="inline-grid bg-foreground/80 p-px rounded-md"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
              gap: "1px",
            }}
          >
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const letter = grid[r][c];
                const num = numberMap[`${r}-${c}`];
                if (!letter) {
                  return (
                    <div
                      key={`${r}-${c}`}
                      className="bg-foreground"
                      style={{ width: cellPx, height: cellPx }}
                    />
                  );
                }
                const correctness = isCorrect(r, c);
                return (
                  <div
                    key={`${r}-${c}`}
                    className="relative bg-background"
                    style={{ width: cellPx, height: cellPx }}
                  >
                    {num !== undefined && (
                      <span
                        className="absolute top-0 left-0.5 text-[8px] font-semibold text-muted-foreground leading-none pointer-events-none"
                        style={{ fontSize: Math.max(7, cellPx / 4) }}
                      >
                        {num}
                      </span>
                    )}
                    {showSolution ? (
                      <div
                        className="w-full h-full flex items-center justify-center font-bold text-foreground"
                        style={{ fontSize: cellPx * 0.55 }}
                      >
                        {letter}
                      </div>
                    ) : interactive ? (
                      <input
                        data-cell={`${r}-${c}`}
                        value={userGrid[r][c]}
                        onChange={(e) => handleChange(r, c, e.target.value)}
                        maxLength={1}
                        className={cn(
                          "w-full h-full text-center font-bold uppercase bg-transparent outline-none focus:bg-primary/10",
                          correctness === true && "text-primary",
                          correctness === false && "text-destructive",
                        )}
                        style={{ fontSize: cellPx * 0.55 }}
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Clues */}
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2 uppercase tracking-wide text-xs">Horizontales</h3>
            <ol className="space-y-1 text-muted-foreground">
              {across.map((c) => (
                <li key={`a-${c.number}`}><span className="font-semibold text-foreground">{c.number}.</span> {c.clue}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2 uppercase tracking-wide text-xs">Verticales</h3>
            <ol className="space-y-1 text-muted-foreground">
              {down.map((c) => (
                <li key={`d-${c.number}`}><span className="font-semibold text-foreground">{c.number}.</span> {c.clue}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
