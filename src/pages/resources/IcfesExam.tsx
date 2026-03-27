import { FileCheck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: string;
}

export default function IcfesExam() {
  const [questions, setQuestions] = useState<Question[]>([
    { id: 1, text: "", options: ["", "", "", ""], correct: "" },
  ]);

  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now(), text: "", options: ["", "", "", ""], correct: "" }]);
  };

  const removeQuestion = (id: number) => {
    if (questions.length > 1) setQuestions(questions.filter((q) => q.id !== id));
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
          <FileCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Examen tipo ICFES</h1>
          <p className="text-sm text-muted-foreground">Genera exámenes con preguntas de selección múltiple</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Título del examen</Label>
            <Input placeholder="Ej: Evaluación de Ciencias Naturales" />
          </div>
          <div className="space-y-2">
            <Label>Área</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="math">Matemáticas</SelectItem>
                <SelectItem value="science">Ciencias Naturales</SelectItem>
                <SelectItem value="social">Ciencias Sociales</SelectItem>
                <SelectItem value="language">Lectura Crítica</SelectItem>
                <SelectItem value="english">Inglés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Preguntas</Label>
            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-1" /> Agregar pregunta
            </Button>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Pregunta {idx + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)} className="h-7 w-7 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea placeholder="Escribe el enunciado de la pregunta..." rows={2} />
              <div className="space-y-2">
                {["A", "B", "C", "D"].map((letter, i) => (
                  <div key={letter} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{letter}.</span>
                    <Input placeholder={`Opción ${letter}`} className="flex-1" />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Respuesta correcta</Label>
                <Select>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {["A", "B", "C", "D"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline">Vista previa</Button>
          <Button className="gradient-primary">Guardar examen</Button>
        </div>
      </div>
    </div>
  );
}
