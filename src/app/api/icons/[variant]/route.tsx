import { ImageResponse } from "next/og";

export const runtime = "edge";

const BG = "#1f2530";
const FG = "#cc9433";

type IconSpec = {
  size: number;
  /** Fraction of canvas used for the glyph (rest is padding). */
  glyphScale: number;
};

const VARIANTS: Record<string, IconSpec> = {
  "192": { size: 192, glyphScale: 0.7 },
  "512": { size: 512, glyphScale: 0.7 },
  // Maskable: glyph kept inside the ~80% safe zone Android masks to.
  "maskable-512": { size: 512, glyphScale: 0.5 },
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ variant: string }> },
) {
  const { variant } = await context.params;
  const spec = VARIANTS[variant];

  if (!spec) {
    return new Response("Not found", { status: 404 });
  }

  const glyphSize = Math.round(spec.size * spec.glyphScale);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BG,
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
      width: spec.size,
      height: spec.size,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
