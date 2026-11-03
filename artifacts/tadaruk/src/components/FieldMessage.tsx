import { CircleAlert } from 'lucide-react';

export function FieldMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="tadaruk-field-error" role="alert" aria-live="polite">
      <CircleAlert size={14} aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
