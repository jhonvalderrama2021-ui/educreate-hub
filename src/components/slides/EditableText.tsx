import { useEffect, useRef, CSSProperties } from "react";

interface Props {
  value: string;
  onChange?: (newValue: string) => void;
  editable?: boolean;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div" | "strong";
  style?: CSSProperties;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}

/**
 * Inline-editable text. When editable=true, click to edit.
 * Calls onChange with the new text on blur.
 */
export function EditableText({
  value,
  onChange,
  editable = false,
  as = "span",
  style,
  className,
  placeholder,
  multiline = false,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  // Keep DOM in sync only when value changes externally (not while editing)
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = value || "";
    }
  }, [value]);

  const handleBlur = () => {
    if (!ref.current || !onChange) return;
    const next = ref.current.textContent || "";
    if (next !== value) onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
    if (e.key === "Escape") {
      if (ref.current) ref.current.textContent = value || "";
      (e.target as HTMLElement).blur();
    }
  };

  const Tag: any = as;
  const editableStyle: CSSProperties = editable
    ? {
        outline: "none",
        cursor: "text",
        borderRadius: "4px",
        transition: "background 0.15s, box-shadow 0.15s",
        ...style,
      }
    : style || {};

  return (
    <Tag
      ref={ref}
      className={`${className || ""} ${editable ? "slide-editable" : ""}`.trim()}
      style={editableStyle}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
    >
      {value}
    </Tag>
  );
}
