import { Map as OlMap } from 'ol';
import { WindGrid, WindGridService } from './wind-grid';
import MultiPolygon from 'ol/geom/MultiPolygon';
import { toLonLat } from 'ol/proj';

type Particle = {
  x: number;
  y: number;
  age: number;
  dist: number;
};

export class WindOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private trailCanvas: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;

  private rafId = 0;
  private particles: Particle[] = [];
  private grid: WindGrid | null = null;
  isRunning: boolean = false;
  private destroyed = false;

  count = 300;
  lifetime = 42;
  distance = 110;

  particleDensity = 0.00035;
  maxParticles = 1000;
  minParticles = 80;

  private targetParticleCount = this.count;
  private particleLength = 6;
  private trailFadeAlpha = 0.8;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrameId = 0;
  private readonly baseZoom: number;

  // wind animation density, length, lifetime, and speed.
  private readonly BASE_PARTICLE_LENGTH = 7;
  private readonly MIN_PARTICLE_LENGTH = 4.5;
  private readonly MAX_PARTICLE_LENGTH = 9;

  private readonly BASE_LIFETIME = 42;
  private readonly MIN_LIFETIME = 18;
  private readonly MAX_LIFETIME = 30;

  private readonly BASE_DISTANCE = 110;
  private readonly MIN_DISTANCE = 48;
  private readonly MAX_DISTANCE = 150;

  private readonly ZOOM_RESPONSE = 0.3;
  private readonly MAX_SPEED_PX = 2;

  COLOR_STOPS: [number, [number, number, number]][] = [
    [0.0, [3, 5, 18]],
    [0.15, [27, 12, 65]],
    [0.3, [75, 12, 107]],
    [0.45, [120, 28, 109]],
    [0.6, [165, 44, 96]],
    [0.72, [207, 68, 70]],
    [0.85, [237, 105, 37]],
    [1.0, [251, 155, 6]],
  ];

  constructor(
    private map: OlMap,
    private host: HTMLElement,
    private windGridService: WindGridService,
    private boundary: MultiPolygon,
  ) {
    this.baseZoom = this.map.getView().getMinZoom();

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;z-index:1;';
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.host.appendChild(this.canvas);

    this.trailCanvas = document.createElement('canvas');
    this.trailCtx = this.trailCanvas.getContext(
      '2d',
    ) as CanvasRenderingContext2D;
  }

  setGrid(grid: WindGrid) {
    this.grid = grid;
  }

  async start() {
    this.map.getView().setMaxZoom(9);
    if (this.isRunning) return;
    this.isRunning = true;
    this.canvas.style.display = 'block';
    this.syncSize();
    if (
      this.particles.length === 0 &&
      this.canvas.width &&
      this.canvas.height
    ) {
      this.seedParticles();
    }

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.frame());
    }

    this.map.on('change:size', this.syncSize);
    this.map.getView().on('change:resolution', this.syncWindScale);
    this.startResizeObserver();
  }

  stop() {
    
    this.isRunning = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.map.un('change:size', this.syncSize);
    this.map.getView().un('change:resolution', this.syncWindScale);
    this.stopResizeObserver();
    this.clearTrails();
    this.canvas.style.display = 'none';
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    this.particles = [];
    this.grid = null;
    if (this.canvas?.parentNode)
      this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null as any;
    this.ctx = null as any;
    this.trailCanvas = null as any;
    this.trailCtx = null as any;
    this.host = null as any;
    this.map = null as any;
    this.boundary = null as any;
  }

  private syncSize = () => {
    if (!this.canvas || !this.trailCanvas || !this.map) return;

    const viewport = this.map.getViewport();
    const width = viewport.clientWidth || this.host.clientWidth;
    const height = viewport.clientHeight || this.host.clientHeight;

    if (!width || !height) return;

    const resized =
      width !== this.canvas.width || height !== this.canvas.height;

    if (resized) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.trailCanvas.width = width;
      this.trailCanvas.height = height;
      this.clearTrails();
    }

    this.syncAnimationMetrics();

    if (!this.isRunning) return;

    if (resized || this.particles.length === 0) {
      this.seedParticles();
    } else {
      this.reconcileParticleCount();
    }
  };

  private seedParticles() {
    this.particles = Array.from({ length: this.count }, () =>
      this.createParticle(),
    );
  }

  private resetParticle(p: Particle) {
    p.x = Math.random() * this.canvas.width;
    p.y = Math.random() * this.canvas.height;
    p.age = Math.floor(Math.random() * this.lifetime);
    p.dist = 0;
  }

  private syncWindScale = () => {
    const changed = this.syncAnimationMetrics();

    if (!this.isRunning) return;

    this.reconcileParticleCount();

    if (changed) {
      this.clearTrails();
    }
  };

  private syncAnimationMetrics(): boolean {
    const previousCount = this.targetParticleCount;
    const previousLength = this.particleLength;
    const previousLifetime = this.lifetime;
    const previousDistance = this.distance;

    const inverseZoomScale = 1 / this.getZoomScale();
    const area = this.canvas.width * this.canvas.height;
    const target = Math.floor(area * this.particleDensity * inverseZoomScale);

    this.targetParticleCount = Math.round(
      this.clamp(target, this.minParticles, this.maxParticles),
    );
    this.count = this.targetParticleCount;
    this.particleLength = this.clamp(
      this.BASE_PARTICLE_LENGTH * inverseZoomScale,
      this.MIN_PARTICLE_LENGTH,
      this.MAX_PARTICLE_LENGTH,
    );
    this.lifetime = Math.round(
      this.clamp(
        this.BASE_LIFETIME * inverseZoomScale,
        this.MIN_LIFETIME,
        this.MAX_LIFETIME,
      ),
    );
    this.distance = Math.round(
      this.clamp(
        this.BASE_DISTANCE * inverseZoomScale,
        this.MIN_DISTANCE,
        this.MAX_DISTANCE,
      ),
    );
    this.trailFadeAlpha = 0.96;

    return (
      previousCount !== this.targetParticleCount ||
      Math.abs(previousLength - this.particleLength) > 0.1 ||
      previousLifetime !== this.lifetime ||
      previousDistance !== this.distance
    );
  }

  private getZoomScale(): number {
    const zoom = this.map.getView().getZoom() ?? this.baseZoom;
    return Math.pow(2, (zoom - this.baseZoom) * this.ZOOM_RESPONSE);
  }

  private reconcileParticleCount() {
    const diff = this.count - this.particles.length;

    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        this.particles.push(this.createParticle());
      }
    } else if (diff < 0) {
      this.particles.splice(0, -diff);
    }

    for (const particle of this.particles) {
      if (particle.age >= this.lifetime || particle.dist >= this.distance) {
        this.resetParticle(particle);
      }
    }
  }

  private startResizeObserver() {
    window.addEventListener('resize', this.queueResizeSync);

    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => this.queueResizeSync());
    this.resizeObserver.observe(this.host);
  }

  private stopResizeObserver() {
    window.removeEventListener('resize', this.queueResizeSync);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.resizeFrameId) {
      cancelAnimationFrame(this.resizeFrameId);
      this.resizeFrameId = 0;
    }
  }

  private queueResizeSync = () => {
    if (this.resizeFrameId || this.destroyed) return;

    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = 0;

      if (this.destroyed || !this.isRunning || !this.map) return;

      this.map.updateSize();
      this.syncSize();
    });
  };

  private clearTrails() {
    if (!this.ctx || !this.trailCtx || !this.canvas || !this.trailCanvas) {
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.trailCtx.clearRect(
      0,
      0,
      this.trailCanvas.width,
      this.trailCanvas.height,
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private sampleWind(px: number, py: number): { u: number; v: number } | null {
    if (!this.grid) return null;

    const coord = this.map.getCoordinateFromPixel([px, py]);
    if (!coord) return null;

    const [lon, lat] = toLonLat(coord);
    return this.windGridService.interpolateWind(lon, lat, this.grid);
  }

  private lastFrameTime = performance.now();
  private fps = 60;
  private frameCount = 0;

  private frame() {
    if (!this.destroyed && this.isRunning) {
      this.rafId = requestAnimationFrame(() => this.frame());
    } else {
      this.rafId = 0;
      return;
    }

    if (!this.grid || !this.canvas) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.fps = this.fps * 0.9 + (1000 / delta) * 0.1;

    this.frameCount++;
    if (this.frameCount >= 6000) this.frameCount = 0;

    if (this.frameCount % 30 === 0) this.adjustParticles();

    const ctx = this.ctx;
    const trailCtx = this.trailCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    trailCtx.save();

    if (this.frameCount % 600 === 0) {
      trailCtx.clearRect(0, 0, w, h);
    } else {
      trailCtx.globalCompositeOperation = 'destination-in';
      trailCtx.fillStyle = `rgba(0, 0, 0, ${this.trailFadeAlpha})`;
      trailCtx.fillRect(0, 0, w, h);
    }
    trailCtx.restore();

    trailCtx.save();
    this.applyBoundaryClip(trailCtx);

    const resolution = this.map.getView().getResolution() || 1;
    const rawScale = (1 / resolution) * 111_320 * 0.009;

    for (const p of this.particles) {
      const wind = this.sampleWind(p.x, p.y);
      if (!wind || (Math.abs(wind.u) < 0.01 && Math.abs(wind.v) < 0.01)) {
        this.resetParticle(p);
        continue;
      }

      const tAge = p.age / this.lifetime;
      const tDist = Math.min(p.dist / this.distance, 1);
      const fadeIn = Math.min(tAge / 0.1, 1);
      const fadeOut = 1 - Math.max((tAge - 0.7) / 0.3, 0);
      const alpha = fadeIn * fadeOut * (1 - tDist);

      if (alpha <= 0.01) {
        this.resetParticle(p);
        continue;
      }

      this.drawParticle(trailCtx, p, alpha, wind);

      const windSpeed = Math.sqrt(wind.u * wind.u + wind.v * wind.v);
      const pixelsPerFrame = windSpeed * rawScale;
      const clampedScale =
        pixelsPerFrame > this.MAX_SPEED_PX
          ? this.MAX_SPEED_PX / windSpeed
          : rawScale;

      const dx = wind.u * clampedScale;
      const dy = -wind.v * clampedScale;

      p.x += dx;
      p.y += dy;
      p.age += 1;
      p.dist += Math.sqrt(dx * dx + dy * dy);

      if (
        p.age >= this.lifetime ||
        p.dist >= this.distance ||
        p.x < -20 ||
        p.x > w + 20 ||
        p.y < -20 ||
        p.y > h + 20
      ) {
        this.resetParticle(p);
      }
    }

    trailCtx.restore();

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.trailCanvas, 0, 0);
  }

  private applyBoundaryClip(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    let hasValid = false;
    const coords = this.boundary.getCoordinates();
    coords.forEach((polygon: any) => {
      polygon.forEach((ring: any) => {
        ring.forEach((coord: any, i: number) => {
          const pixel = this.map.getPixelFromCoordinate(coord);
          if (!pixel || isNaN(pixel[0]) || isNaN(pixel[1])) return;
          hasValid = true;
          i === 0
            ? ctx.moveTo(pixel[0], pixel[1])
            : ctx.lineTo(pixel[0], pixel[1]);
        });
      });
    });
    ctx.closePath();
    if (hasValid) ctx.clip();
  }

  private adjustParticles() {
    if (this.fps < 30 && this.count > this.minParticles) {
      this.count = Math.max(this.minParticles, this.count - 20);
    } else if (this.fps > 50 && this.count < this.targetParticleCount) {
      this.count = Math.min(this.targetParticleCount, this.count + 20);
    }

    this.reconcileParticleCount();
  }

  private createParticle(): Particle {
    const age = Math.floor(Math.random() * this.lifetime);

    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      age,
      dist: Math.random() * this.distance * (age / this.lifetime),
    };
  }

  private drawParticle(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    alpha: number,
    wind: { u: number; v: number },
  ) {
    const windSpeed = Math.sqrt(wind.u * wind.u + wind.v * wind.v);
    const length = this.particleLength;
    const mag = windSpeed || 1;
    const ux = wind.u / mag;
    const vy = wind.v / mag;
    const dx = ux * length;
    const dy = -vy * length;
    const x2 = p.x + dx;
    const y2 = p.y + dy;

    ctx.save();
    ctx.globalAlpha = Math.max(0.65, Math.min(1, alpha));
    ctx.strokeStyle = this.speedToColor(windSpeed);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = this.clamp(length / 4, 1.2, 1.6);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(1.2, length * 0.4);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  speedToColor(speed: number, maxVelocity: number = 25): string {
    const t = Math.min(Math.max(speed / maxVelocity, 0), 1);
    for (let i = 0; i < this.COLOR_STOPS.length - 1; i++) {
      const [t0, c0] = this.COLOR_STOPS[i];
      const [t1, c1] = this.COLOR_STOPS[i + 1];
      if (t >= t0 && t <= t1) {
        const f = (t - t0) / (t1 - t0);
        return `rgba(${Math.round(c0[0] + (c1[0] - c0[0]) * f)},${Math.round(c0[1] + (c1[1] - c0[1]) * f)},${Math.round(c0[2] + (c1[2] - c0[2]) * f)},0.9)`;
      }
    }
    const [r, g, b] = this.COLOR_STOPS[0][1];
    return `rgba(${r},${g},${b},0.9)`;
  }
}
