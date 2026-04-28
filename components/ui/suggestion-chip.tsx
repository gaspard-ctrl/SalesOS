import * as React from "react";

export const SuggestionChip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SuggestionChip({ className = "", children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ds-suggestion-chip ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
});
