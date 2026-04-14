

# Plan: Mejorar calidad visual de diapositivas y exportación

## Problema actual

1. **Vista previa en la app (imagen 2):** Las diapositivas se renderizan como texto plano sin estilos — los iconos de Material Icons aparecen como texto ("star"), sin colores, sin tarjetas, sin estructura visual. Esto indica que el HTML generado por la IA no se está renderizando correctamente en el iframe, o que la IA está generando HTML pobre.

2. **Exportación PDF/PPTX (imagen 1):** Los exportadores actuales extraen solo texto plano del HTML con `DOMParser` y lo escriben como líneas de texto simples. Se pierde todo el diseño visual (colores, tarjetas, iconos, layout).

## Solución propuesta

### 1. Mejorar el visor de iframe (SlideViewer)
- Asegurar que el iframe permita cargar recursos externos (Google Fonts, Material Icons) cambiando el `sandbox` attribute para incluir `allow-scripts` (necesario para que las fuentes se carguen correctamente).
- Verificar que el iframe tenga dimensiones correctas y el escalado funcione bien.

### 2. Mejorar la exportación a PDF usando html2canvas
- Reemplazar la exportación actual (que extrae texto plano) por un enfoque basado en **html2canvas**: renderizar cada iframe como imagen y pegarla en el PDF.
- Esto preserva el diseño visual exacto de cada diapositiva.
- Instalar `html2canvas` como dependencia.

### 3. Mejorar la exportación a PPTX
- En vez de extraer texto plano, renderizar cada slide HTML a imagen con html2canvas y añadir cada imagen como fondo de slide en pptxgenjs.
- El resultado será visualmente fiel al visor.

### 4. Mejorar el prompt de la IA (Edge Function)
- Reforzar el prompt para que genere HTML autocontenido con estilos inline más robustos.
- Asegurar que cada slide incluya los `<link>` correctos de Google Fonts y Material Icons.
- Añadir ejemplos más específicos de layouts esperados.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/SlideViewer.tsx` | Ajustar sandbox del iframe, mejorar escalado |
| `src/pages/resources/GenerateResource.tsx` | Reescribir `exportSlidesToPdf` y `exportSlidesToPptx` usando html2canvas |
| `supabase/functions/generate-resource/index.ts` | Mejorar prompt de slides |
| `package.json` | Agregar `html2canvas` |

## Detalle técnico

**Exportación con html2canvas:**
- Crear un iframe temporal oculto con el HTML del slide a 1280x720
- Esperar a que cargue (incluyendo fuentes)
- Usar html2canvas para capturar como imagen
- Insertar en PDF (jsPDF) o PPTX (pptxgenjs como imagen de fondo)

**Iframe sandbox:**
- Cambiar de `sandbox="allow-same-origin"` a `sandbox="allow-same-origin allow-scripts"` para que Google Fonts y Material Icons se carguen correctamente.

