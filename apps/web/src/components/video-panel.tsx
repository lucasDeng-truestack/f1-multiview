"use client";

import "./panel.css";

export function VideoPanel() {
  return (
    <div className="pw-panel pw-empty">
      <span className="pw-panel-title">Video</span>
      <p className="pw-empty-text">
        No stream connected. Onboard video can be added later via an embed you
        provide.
      </p>
    </div>
  );
}
