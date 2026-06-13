import { ImageResponse } from "next/og";

export const runtime = "edge";

const FG = "#cc9433";
const BG_LIGHT = "#faf8f5";
const BG_DARK = "#16140f";

function clampSize(raw: string | null, fallback: number) {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 64), 4096);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const w = clampSize(url.searchParams.get("w"), 1170);
  const h = clampSize(url.searchParams.get("h"), 2532);
  const dark = url.searchParams.get("dark") === "1";

  const bg = dark ? BG_DARK : BG_LIGHT;
  // Glyph at ~22% of the shorter dimension keeps it iconic but not overwhelming.
  const glyphSize = Math.round(Math.min(w, h) * 0.22);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
      }}
    >
      <svg
        width={glyphSize}
        height={glyphSize}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 50 L28 14 H36 L50 50 H42.5 L39 40 H25 L21.5 50 Z M27.2 33 H36.8 L32 19.5 Z"
          fill={FG}
        />
      </svg>
    </div>,
    {
      width: w,
      height: h,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
