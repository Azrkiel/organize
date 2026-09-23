import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS reads the web manifest's icons on 16.4+, but still falls back to this convention on
// older versions — worth having since Phase 8's own install step (task 7) is tested on an iPhone.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
        }}
      >
        <div style={{ color: "#fafafa", fontSize: 96, fontWeight: 600, fontFamily: "sans-serif" }}>O</div>
      </div>
    ),
    size
  );
}
