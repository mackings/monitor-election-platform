import { ImageResponse } from "next/og";

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
          background: "#4f46e5",
        }}
      >
        <span style={{ color: "white", fontSize: 224, fontWeight: 700, fontFamily: "sans-serif", letterSpacing: -6 }}>
          EM
        </span>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
