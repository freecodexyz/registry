let colorCanvas: HTMLCanvasElement | null = null;

export function chartColor(scope: HTMLElement, name: string, fallback: string) {
  const probe = document.createElement("span");

  probe.style.color = `var(${name}, ${fallback})`;
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.visibility = "hidden";
  scope.appendChild(probe);

  const resolved = getComputedStyle(probe).color.trim();
  probe.remove();

  return rasterizeColor(resolved) ?? rasterizeColor(fallback) ?? fallback;
}

function rasterizeColor(color: string) {
  if (!color) return null;

  colorCanvas ??= document.createElement("canvas");
  colorCanvas.width = 1;
  colorCanvas.height = 1;

  const ctx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "rgba(0, 0, 0, 0)";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);

  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0 && !isTransparentColor(color)) return null;

  if (a === 255) return `rgb(${r}, ${g}, ${b})`;

  return `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
}

function isTransparentColor(color: string) {
  return /\btransparent\b|rgba?\([^)]*,\s*0\s*\)|\/\s*0\s*\)?$/i.test(color);
}
