import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** The QR matrix for `text` (true = dark module), no quiet zone. Error correction M, like the terminal code. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}

/** Modules of quiet zone the QR standard asks for on every side. */
export const QUIET_ZONE = 4;

/** SVG path data: one horizontal run per `M x y h w v1 h-w z`, offset by the quiet zone. */
export function qrPath(matrix: boolean[][], quiet = QUIET_ZONE): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      parts.push(`M${start + quiet} ${y + quiet}h${x - start}v1h-${x - start}z`);
    }
  });
  return parts.join("");
}

export interface QrCodeProps {
  /** What the code encodes. Never rendered as text or put in an attribute. */
  value: string;
  /** Accessible name. Must not contain the value. */
  label: string;
  className?: string;
}

/**
 * Draws `value` as an inline SVG: black modules on a white square with a 4-module quiet zone, so it scans in the
 * dark theme too. It scales with its container. Colours are literal on purpose: a QR code must be dark on light
 * whatever the theme, and these two values are not part of the theme.
 */
export default function QrCode({ value, label, className }: QrCodeProps) {
  const { path, size } = useMemo(() => {
    const matrix = qrMatrix(value);
    return { path: qrPath(matrix), size: matrix.length + QUIET_ZONE * 2 };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
