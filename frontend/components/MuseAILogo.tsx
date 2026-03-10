"use client";

import React from "react";

type LogoTheme = "dark" | "light" | "gold";
type LogoVariant = "horizontal" | "horizontal-compact" | "icon-only";

interface MuseAILogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  iconSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

const THEME_COLORS = {
  dark: {
    icon: "#C9A84C",
    muse: "#F5F0E8",
    ai: "#C9A84C",
    divider: "#444444",
    by: "#666666",
    tagline: "#999999",
  },
  light: {
    icon: "#C9A84C",
    muse: "#0A0A0A",
    ai: "#C9A84C",
    divider: "#CCCCCC",
    by: "#999999",
    tagline: "#777777",
  },
  gold: {
    icon: "#C9A84C",
    muse: "#C9A84C",
    ai: "#C9A84C",
    divider: "#C9A84C",
    by: "#C9A84C",
    tagline: "#C9A84C",
  },
} as const;

const MuseAIIcon = ({
  size = 36,
  color = "#C9A84C",
}: {
  size: number;
  color: string;
}) => {
  const s = size;
  const pad = s * 0.1;
  const vfSize = s - pad * 2;
  const vfX = pad;
  const vfY = pad;
  const cLen = vfSize * 0.26;
  const cR = vfSize * 0.09;
  const sw = s * 0.072;

  const wfW = vfSize * 0.56;
  const wfCX = s / 2;
  const wfCY = s / 2 + s * 0.04;
  const wfX = wfCX - wfW / 2;
  const maxH = vfSize * 0.36;
  const barCount = 9;
  const barGap = wfW / (barCount - 1);
  const barRatios = [0.18, 0.32, 0.52, 0.75, 1.0, 0.75, 0.52, 0.32, 0.18];

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M ${vfX + cLen} ${vfY} L ${vfX + cR} ${vfY} Q ${vfX} ${vfY} ${vfX} ${vfY + cR} L ${vfX} ${vfY + cLen}`}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M ${vfX + vfSize - cLen} ${vfY} L ${vfX + vfSize - cR} ${vfY} Q ${vfX + vfSize} ${vfY} ${vfX + vfSize} ${vfY + cR} L ${vfX + vfSize} ${vfY + cLen}`}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M ${vfX} ${vfY + vfSize - cLen} L ${vfX} ${vfY + vfSize - cR} Q ${vfX} ${vfY + vfSize} ${vfX + cR} ${vfY + vfSize} L ${vfX + cLen} ${vfY + vfSize}`}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M ${vfX + vfSize - cLen} ${vfY + vfSize} L ${vfX + vfSize - cR} ${vfY + vfSize} Q ${vfX + vfSize} ${vfY + vfSize} ${vfX + vfSize} ${vfY + vfSize - cR} L ${vfX + vfSize} ${vfY + vfSize - cLen}`}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {barRatios.map((ratio, i) => (
        <line
          key={i}
          x1={wfX + i * barGap}
          y1={wfCY - (maxH * ratio) / 2}
          x2={wfX + i * barGap}
          y2={wfCY + (maxH * ratio) / 2}
          stroke={color}
          strokeWidth={sw * 0.85}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};

export const MuseAILogo = ({
  variant = "horizontal",
  theme = "dark",
  iconSize = 36,
  className,
  style,
}: MuseAILogoProps) => {
  const c = THEME_COLORS[theme];
  const fontSize = iconSize * 0.72;
  const bySize = iconSize * 0.28;
  const tagSize = iconSize * 0.3;

  if (variant === "icon-only") {
    return (
      <span className={className} style={style} aria-label="MuseAI">
        <MuseAIIcon size={iconSize} color={c.icon} />
      </span>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: iconSize * 0.28,
        userSelect: "none",
        ...style,
      }}
      aria-label="MuseAI by GuideQR.ai"
    >
      <MuseAIIcon size={iconSize} color={c.icon} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: iconSize * 0.22,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontStyle: "italic",
            fontSize: `${fontSize}px`,
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: c.muse }}>Muse</span>
          <span style={{ color: c.ai }}>AI</span>
        </span>

        {variant === "horizontal" && (
          <>
            <div
              style={{
                width: "1px",
                height: `${fontSize * 0.72}px`,
                background: c.divider,
                flexShrink: 0,
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "1px",
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), Arial, sans-serif",
                  fontSize: `${bySize}px`,
                  color: c.by,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                by
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), Arial, sans-serif",
                  fontSize: `${tagSize}px`,
                  color: c.tagline,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                GuideQR.ai
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MuseAILogo;
