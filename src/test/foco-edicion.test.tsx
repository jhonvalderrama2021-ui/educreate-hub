import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";

/**
 * Escribir varias letras seguidas en un campo del recurso.
 *
 * Los campos editables se declaran DENTRO del componente que los pinta. En
 * React eso crea un tipo de componente nuevo en cada renderizado, así que el
 * campo se destruye y se vuelve a crear: el cursor se pierde y solo entra la
 * primera letra de lo que se escribe.
 *
 * Una prueba que escriba UNA letra no lo detecta. Estas escriben una palabra
 * entera, que es lo que hace un docente corrigiendo.
 */

/** Monta el visor con estado real, como en la aplicación. */
function Editor({ inicial, tipo }: { inicial: any; tipo: string }) {
  const [contenido, setContenido] = useState(inicial);
  return (
    <ResourceContentViewer
      type={tipo}
      content={contenido}
      editable
      onContentChange={setContenido}
    />
  );
}

describe("escribir seguido sin perder el cursor", () => {
  it("un campo suelto acepta una palabra entera", async () => {
    const user = userEvent.setup();
    render(<Editor tipo="lesson_plan" inicial={{ objective: "Meta" }} />);

    const campo = screen.getAllByRole("textbox").find(
      (c) => (c as HTMLInputElement).value === "Meta",
    )! as HTMLInputElement;

    await user.click(campo);
    await user.type(campo, " clara");

    expect(campo.value).toBe("Meta clara");
  });

  it("un punto de una lista también", async () => {
    // Las listas son lo que más se corrige en un plan de clase: las acciones
    // del docente, las preguntas orientadoras.
    const user = userEvent.setup();
    render(
      <Editor
        tipo="lesson_plan"
        inicial={{ phases: [{ name: "Inicio", teacherActions: ["Proyectar"] }] }}
      />,
    );

    const campo = screen.getAllByRole("textbox").find(
      (c) => (c as HTMLInputElement).value === "Proyectar",
    )! as HTMLInputElement;

    await user.click(campo);
    await user.type(campo, " el mapa");

    expect(campo.value).toBe("Proyectar el mapa");
  });

  it("una pregunta del examen acepta una frase", async () => {
    const user = userEvent.setup();
    render(
      <Editor
        tipo="icfes"
        inicial={{ questions: [{ number: 1, question: "Cual", options: ["a", "b"], correct: "A" }] }}
      />,
    );

    const campo = screen.getAllByRole("textbox").find(
      (c) => (c as HTMLTextAreaElement).value === "Cual",
    )! as HTMLTextAreaElement;

    await user.click(campo);
    await user.type(campo, " es la respuesta");

    expect(campo.value).toBe("Cual es la respuesta");
  });
});
