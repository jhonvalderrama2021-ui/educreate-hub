/**
 * Punto único desde el que las pruebas e2e importan `test` y `expect`.
 * Extiende aquí el fixture si necesitas estado compartido (sesión iniciada,
 * datos de prueba, etc.) en vez de importar directamente de @playwright/test.
 */
export { test, expect } from "@playwright/test";
