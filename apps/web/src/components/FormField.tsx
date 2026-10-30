import type { ReactNode } from "react";
import ui from "./ui.module.css";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  help,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div
      className={[ui.field, className].filter(Boolean).join(" ")}
      data-testid="form-field"
    >
      <label className={ui.label} htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {help ? <span className={ui.hint}>{help}</span> : null}
      {error ? <span className={ui.errorText}>{error}</span> : null}
    </div>
  );
}
