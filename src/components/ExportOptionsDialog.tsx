import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Download, Image as ImageIcon, X } from "lucide-react";
import type { ExportOptions } from "@/lib/export-resource";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: "pdf" | "docx";
  onConfirm: (options: ExportOptions) => Promise<void> | void;
}

const STORAGE_KEY = "educrea.exportOptions.v1";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ExportOptionsDialog({ open, onOpenChange, format, onConfirm }: Props) {
  const [logo, setLogo] = useState<string | undefined>();
  const [watermark, setWatermark] = useState<string | undefined>();
  const [opacity, setOpacity] = useState<number>(12);
  const [exporting, setExporting] = useState(false);

  // Load remembered images
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setLogo(parsed.logo);
        setWatermark(parsed.watermark);
        setOpacity(parsed.opacity ?? 12);
      }
    } catch {/* ignore */}
  }, [open]);

  const persist = (next: { logo?: string; watermark?: string; opacity: number }) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {/* ignore */}
  };

  const handleLogo = async (file?: File) => {
    if (!file) return;
    const url = await fileToDataUrl(file);
    setLogo(url);
    persist({ logo: url, watermark, opacity });
  };

  const handleWatermark = async (file?: File) => {
    if (!file) return;
    const url = await fileToDataUrl(file);
    setWatermark(url);
    persist({ logo, watermark: url, opacity });
  };

  const clearLogo = () => { setLogo(undefined); persist({ logo: undefined, watermark, opacity }); };
  const clearWatermark = () => { setWatermark(undefined); persist({ logo, watermark: undefined, opacity }); };

  const handleConfirm = async () => {
    setExporting(true);
    try {
      await onConfirm({
        logoDataUrl: logo,
        watermarkDataUrl: watermark,
        watermarkOpacity: opacity / 100,
      });
      onOpenChange(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Opciones de exportación ({format.toUpperCase()})</DialogTitle>
          <DialogDescription>
            Personaliza tu documento con el logo de tu institución y/o una marca de agua. Ambos son opcionales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Logo institucional (esquina superior derecha)</Label>
            <div className="flex items-center gap-3">
              {logo ? (
                <div className="relative">
                  <img src={logo} alt="Logo" className="h-16 w-16 object-contain border border-border rounded-md bg-background" />
                  <button onClick={clearLogo} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 border border-dashed border-border rounded-md flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => handleLogo(e.target.files?.[0])}
                className="flex-1"
              />
            </div>
          </div>

          {/* Watermark */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Marca de agua (centrada en cada página)</Label>
            <div className="flex items-center gap-3">
              {watermark ? (
                <div className="relative">
                  <img src={watermark} alt="Marca de agua" className="h-16 w-16 object-contain border border-border rounded-md bg-background" style={{ opacity: opacity / 100 + 0.4 }} />
                  <button onClick={clearWatermark} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 border border-dashed border-border rounded-md flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => handleWatermark(e.target.files?.[0])}
                className="flex-1"
              />
            </div>
            {watermark && format === "pdf" && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Opacidad de la marca de agua</span>
                  <span>{opacity}%</span>
                </div>
                <Slider
                  value={[opacity]}
                  min={5}
                  max={40}
                  step={1}
                  onValueChange={(v) => { setOpacity(v[0]); persist({ logo, watermark, opacity: v[0] }); }}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? "Generando..." : `Descargar ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
