import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LessonPlan() {
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plan de Clase</h1>
          <p className="text-sm text-muted-foreground">Diseña un plan de clase estructurado</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Asignatura</Label>
            <Input id="subject" placeholder="Ej: Matemáticas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">Grado</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar grado" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{`${i + 1}°`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic">Tema</Label>
          <Input id="topic" placeholder="Ej: Ecuaciones lineales" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="objective">Objetivo de aprendizaje</Label>
          <Textarea id="objective" placeholder="Describe el objetivo principal de la clase..." rows={3} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="activities">Actividades</Label>
          <Textarea id="activities" placeholder="Describe las actividades a realizar..." rows={4} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="resources">Recursos necesarios</Label>
            <Textarea id="resources" placeholder="Materiales, herramientas..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evaluation">Evaluación</Label>
            <Textarea id="evaluation" placeholder="Criterios de evaluación..." rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline">Vista previa</Button>
          <Button className="gradient-primary">Guardar plan</Button>
        </div>
      </div>
    </div>
  );
}
