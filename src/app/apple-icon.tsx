import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "#1f2530",
          borderRadius: 40,
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 50 L28 14 H36 L50 50 H42.5 L39 40 H25 L21.5 50 Z M27.2 33 H36.8 L32 19.5 Z"
            fill="#cc9433"
          />
        </svg>
      </div>
    ),
    size,
  );
}
