"use client";

import "./panel.css";
import "./video-panel.css";

export function VideoPanel() {
  return (
    <div className="pw-panel">
      <div className="pw-panel-head">
        <span className="pw-panel-title">Video</span>
        <span className="pw-panel-meta">no stream</span>
      </div>
      <div className="pw-video-body">
        <div className="pw-video-frame">
          <span className="pw-video-copy">Stream provider not configured.</span>
        </div>
      </div>
    </div>
  );
}
