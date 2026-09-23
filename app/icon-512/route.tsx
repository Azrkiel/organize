import { ImageResponse } from "next/og";

export const runtime = "edge";

// No rounded corners and the glyph kept well inside center: this one is declared "maskable" in
// the manifest, so Android applies its own crop shape — padding here keeps the "O" from being
// clipped by that mask.
export async function GET() {
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
        <div style={{ color: "#fafafa", fontSize: 220, fontWeight: 600, fontFamily: "sans-serif" }}>O</div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
