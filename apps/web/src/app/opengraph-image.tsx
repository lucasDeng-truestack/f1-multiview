import { ImageResponse } from "next/og";

// Dark, wordmark-only OG card — instrument, not marketing.
export const runtime = "edge";
export const alt = "PitWall — multiview F1 race-watching tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0C0F",
          border: "1px solid #262B33",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontFamily: "monospace",
            fontWeight: 600,
            letterSpacing: 4,
            color: "#E8EBF0",
          }}
        >
          PitWall
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            fontFamily: "monospace",
            color: "#5B6472",
          }}
        >
          Read the race the way an engineer does.
        </div>
      </div>
    ),
    size,
  );
}
