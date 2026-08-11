import { ImageResponse } from "next/og";

export const alt = "Invoicey — automatizace faktur bez zbytečného klikání";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#fffaf6",
        color: "#392d28",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background:
            "radial-gradient(circle at 28% 25%, rgba(220,155,121,.55), transparent 42%), radial-gradient(circle at 82% 80%, rgba(220,155,121,.28), transparent 38%)",
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexDirection: "column",
          maxWidth: "980px",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: "18px" }}>
          <div
            style={{
              alignItems: "center",
              background: "#dc9b79",
              borderRadius: "22px",
              boxShadow: "0 10px 24px rgba(76,48,36,.15)",
              display: "flex",
              fontSize: "38px",
              fontWeight: 800,
              height: "72px",
              justifyContent: "center",
              width: "72px",
            }}
          >
            I
          </div>
          <div style={{ fontSize: "34px", fontWeight: 700 }}>Invoicey</div>
        </div>
        <div
          style={{
            fontSize: "76px",
            fontWeight: 750,
            letterSpacing: "-4px",
            lineHeight: 1.02,
            marginTop: "58px",
            maxWidth: "940px",
          }}
        >
          Automatizace faktur bez zbytečného klikání.
        </div>
        <div
          style={{
            color: "#786761",
            fontSize: "28px",
            lineHeight: 1.4,
            marginTop: "28px",
          }}
        >
          Jedna validovaná faktura. Web, PDF, ISDOC, QR i AI.
        </div>
      </div>
    </div>,
    size,
  );
}
