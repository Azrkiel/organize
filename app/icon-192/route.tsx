import { ImageResponse } from "next/og";

export const runtime = "edge";

// A simple monogram, generated at request time (cached by Vercel's CDN) instead of a checked-in
// PNG — avoids needing an image-processing dependency just to produce two icon sizes.
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
          borderRadius: 32,
        }}
      >
        <div style={{ color: "#fafafa", fontSize: 104, fontWeight: 600, fontFamily: "sans-serif" }}>O</div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
