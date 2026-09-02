/*
 * Canvas rainfall.
 *
 * The first attempt used two animated repeating-linear-gradients, which tiles
 * one uniform pattern across the viewport; two overlapping repeats at
 * different scales beat against each other and read as television static.
 *
 * Discrete drops fix that. Each one gets its own depth, and depth drives
 * length, speed and opacity together - near drops are long, fast and bright,
 * far ones short, slow and faint. That spread is what your eye reads as rain
 * rather than as texture.
 *
 * Several callers can ask for rain at once (real weather, Konami mode) and
 * the strongest request wins, so neither has to know about the other.
 */

type Drop = {
  x: number;
  y: number;
  depth: number;   // 0 far, 1 near
  len: number;
  speed: number;
};

const MAX_DROPS = 320;
const SLANT = 0.18;   // horizontal drift per unit of fall

const demand = new Map<string, number>();

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let drops: Drop[] = [];
let running = false;
let width = 0;
let height = 0;
let calm = false;

function reduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function intensity(): number {
  let max = 0;
  demand.forEach(value => { if (value > max) max = value; });
  return Math.min(1, Math.max(0, max));
}

function resize() {
  if (!canvas || !ctx) return;

  // Draw at device resolution or the streaks look chunky on a retina screen
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawn(): Drop {
  const depth = Math.random();
  return {
    x: Math.random() * (width + height * SLANT) - height * SLANT,
    y: Math.random() * -height,
    depth,
    len: 8 + depth * 26,
    speed: 5 + depth * 13,
  };
}

function sync() {
  const want = Math.round(intensity() * MAX_DROPS);

  while (drops.length < want) drops.push(spawn());
  if (drops.length > want) drops.length = want;
}

function frame() {
  if (!ctx || !canvas) return;

  sync();
  ctx.clearRect(0, 0, width, height);

  if (drops.length === 0) {
    running = false;
    canvas.style.opacity = '0';
    return;
  }

  canvas.style.opacity = '1';
  ctx.lineCap = 'round';

  for (const drop of drops) {
    const fall = calm ? 0 : drop.speed;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(198, 216, 240, ${0.12 + drop.depth * 0.38})`;
    ctx.lineWidth = 0.7 + drop.depth * 1.1;
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - drop.len * SLANT, drop.y + drop.len);
    ctx.stroke();

    drop.y += fall;
    drop.x -= fall * SLANT;

    if (drop.y - drop.len > height) {
      Object.assign(drop, spawn(), { y: -drop.len });
    }
  }

  requestAnimationFrame(frame);
}

/** Ask for rain. Strength 0..1; the loudest caller wins. */
export function setRain(source: string, strength: number) {
  demand.set(source, strength);

  if (!canvas) return;
  if (intensity() > 0 && !running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

export function mountRain(target: HTMLCanvasElement) {
  canvas = target;
  ctx = canvas.getContext('2d');
  if (!ctx) return;

  calm = reduceMotion();
  window.matchMedia?.('(prefers-reduced-motion: reduce)')
    ?.addEventListener?.('change', e => { calm = e.matches; });

  resize();
  window.addEventListener('resize', () => {
    resize();
    // positions were picked for the old size; start them over
    drops = [];
  });

  if (intensity() > 0 && !running) {
    running = true;
    requestAnimationFrame(frame);
  }
}
