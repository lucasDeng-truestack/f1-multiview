"use client";

import type { ReactNode } from "react";

export function PanelFrame({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pw-frame">
      {children}
      <button
        type="button"
        className="pw-frame-remove"
        aria-label="Remove panel"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
