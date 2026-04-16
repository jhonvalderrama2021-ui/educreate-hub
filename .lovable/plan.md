
Objetivo

Llevar el recurso “Diapositivas” de un generador HTML básico a un sistema de presentaciones con:
- imágenes reales o generadas integradas de forma visual,
- vista previa consistente,
- exportación fiel a PDF/PPTX,
- calidad visual cercana a Gamma/Z.ai.

Diagnóstico: qué te falta hoy

1. Falta un pipeline real de imágenes
- En tu código actual no existe búsqueda/descarga/inserción real de imágenes.
- El prompt puede “pedir” imágenes, pero la app no tiene un proveedor que las resuelva.

2. El modelo genera HTML libre en vez de una diapositiva estructurada
- Hoy la IA devuelve `html` completo por slide.
- Eso hace que el resultado sea inconsistente, difícil de controlar y frágil para exportar.

3. La exportación sigue siendo frágil
- `slide-export.ts` captura el `iframe` con `html2canvas`, pero:
  - usa espera fija de 2s,
  - no valida `document.fonts.ready`,
  - no espera imágenes cargadas,
  - no resuelve CORS,
  - el `iframe` de export aún no permite scripts.
- Si la slide depende de recursos externos, PDF/PPTX sale mal.

4. No hay generación progresiva real
- `GenerateResource.tsx` espera toda la respuesta completa.
- No existe streaming slide-by-slide como Gamma/Tome/Z.ai.

5. El repositorio de referencia no es “copiar y pegar”
- Ese repo usa una arquitectura distinta: slides estructuradas, temas, editor, escaneo DOM y exportador por elementos.
- Además, su propio README indica que PPTX aún es parcial y PDF no está resuelto del todo.
- Sí sirve como referencia de arquitectura, no como solución literal.

Plan propuesto

Fase 1 — Cambiar la arquitectura de generación
- Dejar de depender de HTML libre generado por IA.
- Cambiar a un esquema JSON de presentación:
```text
presentation
  title
  theme
  outline[]
  slides[]
    - layout
    - title
    - subtitle
    - sections/cards/steps/stats
    - image: { query, alt, placement, style, url }
    - accentColors
```
- La IA genera contenido estructurado; el frontend renderiza con componentes React controlados.

Fase 2 — Motor visual propio de diapositivas
- Crear layouts reutilizables inspirados en el repo de referencia:
  - portada hero
  - split text + image
  - grid de tarjetas
  - proceso/flujo
  - comparación
  - estadísticas
  - timeline
  - cierre/conclusión
- Aplicar una paleta consistente de la plataforma (blanco + azul-morado), no Gamma.
- Esto garantiza que todas las slides se vean bien sin depender de HTML arbitrario.

Fase 3 — Integrar imágenes de verdad
- Añadir un proveedor real de imágenes:
  - opción A: stock real (Unsplash o Pexels)
  - opción B: generadas con OpenAI Images
- La edge function debe resolver cada `image.query` y devolver una `image.url` válida.
- Para exportar bien, las imágenes deben quedar:
  - proxied,
  - almacenadas,
  - o convertidas a data URL/base64.
- Sin esto, seguirás viendo slides “sin imagen” o exports rotos.

Fase 4 — Generación progresiva
- Separar el flujo en 2 pasos:
  1. generar outline,
  2. generar slides una por una.
- Mostrar cada slide renderizada a medida que llega.
- Esto replica la sensación del repo de referencia sin copiar todo su stack.

Fase 5 — Rehacer exportación
- PDF:
  - exportar desde el renderer React final,
  - esperar fuentes + imágenes cargadas,
  - usar assets ya embebidos/proxied,
  - capturar a alta resolución.
- PPTX:
  - no depender solo de screenshot del HTML libre,
  - tomar la idea del repo de referencia: escanear DOM/render y convertir texto, fondos, imágenes y formas a `pptxgenjs`,
  - dejar fallback a imagen solo para elementos no soportados.
- Resultado: PPT editable parcialmente y mucho más fiel.

Fase 6 — Validación y control de calidad
- Normalizar largos de texto para evitar overflow.
- Reglas por layout para que no se rompa el diseño.
- Fallback si una imagen no carga.
- QA obligatorio con generación real + exportación PDF/PPTX.

Qué necesitamos para lograrlo bien

1. Una fuente real de imágenes
- Si quieres fotos reales: necesitamos API de Unsplash o Pexels.
- Si aceptas imágenes generadas: podemos usar OpenAI, pero debe tener acceso a generación de imágenes y asumir costo.

2. Aprobar una refactorización real
- No es un “ajuste menor”.
- Lo correcto es reemplazar el modelo actual basado en `slide.html` por un sistema de slides estructuradas + renderer propio.

3. Mantener el repo de referencia solo como guía
- Sí replicaremos:
  - motor de layouts,
  - tema consistente,
  - pipeline visual,
  - idea de export DOM -> PPTX,
  - generación progresiva.
- No replicaremos:
  - Next.js completo,
  - Plate editor completo,
  - todo su sistema de presentaciones.

Archivos/zonas que tocaría

- `supabase/functions/generate-resource/index.ts`
  - nuevo contrato JSON para slides
  - generación outline + slide specs
  - integración con imágenes
- `src/lib/ai-service.ts`
  - soporte a nuevo formato y, si aplica, streaming
- `src/pages/resources/GenerateResource.tsx`
  - flujo progresivo
  - controles de tema/layout/imágenes
- `src/components/SlideViewer.tsx`
  - render con componentes React, no `iframe` de HTML libre
- nuevo módulo de render:
  - `src/components/slides/*`
- `src/lib/slide-export.ts`
  - export PDF robusto
  - export PPTX por DOM/elementos + fallback visual

Conclusión

Lo que te falta no es solo “mejorar el prompt”: te faltan 4 piezas clave para llegar al resultado que buscas:
- un proveedor real de imágenes,
- un renderer estructurado de diapositivas,
- generación progresiva,
- un exportador pensado para slides reales y no para HTML arbitrario.

Si apruebas este enfoque, el siguiente paso correcto es implementar la Fase 1 a 3 primero (estructura + renderer + imágenes), y después cerrar exportación y streaming sobre esa nueva base.
