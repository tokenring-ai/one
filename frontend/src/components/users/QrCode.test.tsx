import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { qrMatrix as serverQrMatrix } from "@tokenring-ai/web-host/terminalQr";
import QrCode, { QUIET_ZONE, qrMatrix, qrPath } from "./QrCode.tsx";

const LINK = "http://192.168.1.20:14008/#access=3q2-7wG4n0x8Yk1b9hZpA5uR6tVdLmCsQe_JfXoIhNa";

/** Reads the drawn SVG path back into a matrix (quiet zone removed). */
function matrixFromPath(path: string, size: number): boolean[][] {
  const grid = Array.from({ length: size + QUIET_ZONE * 2 }, () => Array.from({ length: size + QUIET_ZONE * 2 }, () => false));
  for (const match of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, width] = [Number(match[1]), Number(match[2]), Number(match[3])];
    for (let i = 0; i < width; i++) grid[y]![x + i] = true;
  }
  return grid.slice(QUIET_ZONE, QUIET_ZONE + size).map(row => row.slice(QUIET_ZONE, QUIET_ZONE + size));
}

describe("QrCode", () => {
  it("draws exactly the module matrix that encodes the link, matching the one printed in the terminal", () => {
    const matrix = qrMatrix(LINK);
    expect(matrix).toEqual(serverQrMatrix(LINK));
    expect(matrixFromPath(qrPath(matrix), matrix.length)).toEqual(matrix);
  });

  it("renders an inline, scalable svg: black on white with a 4-module quiet zone", () => {
    const size = qrMatrix(LINK).length;
    render(<QrCode value={LINK} label="QR code that signs in as maria" />);
    const svg = screen.getByRole("img", { name: "QR code that signs in as maria" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${size + 8} ${size + 8}`);
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.querySelector("rect")?.getAttribute("fill")).toBe("white");
    expect(svg.querySelector("path")?.getAttribute("fill")).toBe("black");
    // Nothing in the first four rows or columns is dark.
    const quiet = qrPath(qrMatrix(LINK));
    expect([...quiet.matchAll(/M(\d+) (\d+)h/g)].every(m => Number(m[1]) >= QUIET_ZONE && Number(m[2]) >= QUIET_ZONE)).toBe(true);
  });

  it("never puts the link in the accessible name or any attribute", () => {
    const { container } = render(<QrCode value={LINK} label="QR code that signs in as maria" />);
    expect(container.innerHTML).not.toContain("access=");
    expect(container.innerHTML).not.toContain("3q2-7wG4");
  });
});
