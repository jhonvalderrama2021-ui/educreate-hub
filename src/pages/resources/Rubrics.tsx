import { Table2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface Criterion {
  id: number;
  name: string;
  excellent: string;
  good: string;
  acceptable: string;
  insufficient: string;
}

export default function Rubrics() {
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: 1, name: "", excellent: "", good: "", acceptable: "", insufficient: "" },
  ]);

  const addCriterion = () => {
    setCriteria([...criteria, { id: Date.now(), name: "", excellent: "", good: "", acceptable: "", insufficient: "" }]);
  };

  const removeCriterion = (id: number) => {
    if (criteria.length > 1) setCriteria(criteria.filter((c) => c.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
          <Table2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rúbricas</h1>
          <p className="text-sm text-muted-foreground">Crea rúbricas de evaluación detalladas</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Título de la rúbrica</Label>
            <Input placeholder="Ej: Evaluación de presentación oral" />
          </div>
          <div className="space-y-2">
            <Label>Asignatura</Label>
            <Input placeholder="Ej: Lengua Castellana" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Criterios de evaluación</Label>
            <Button variant="outline" size="sm" onClick={addCriterion}>
              <Plus className="h-4 w-4 mr-1" /> Agregar criterio
            </Button>
          </div>

          {criteria.map((criterion, idx) => (
            <div key={criterion.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Criterio {idx + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeCriterion(criterion.id)} className="h-7 w-7 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input placeholder="Nombre del criterio" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Excelente</Label>
                  <Textarea placeholder="Descripción..." rows={2} className="text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bueno</Label>
                  <Textarea placeholder="Descripción..." rows={2} className="text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aceptable</Label>
                  <Textarea placeholder="Descripción..." rows={2} className="text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Insuficiente</Label>
                  <Textarea placeholder="Descripción..." rows={2} className="text-xs" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline">Vista previa</Button>
          <Button className="gradient-primary">Guardar rúbrica</Button>
        </div>
      </div>
    </div>
  );
}
