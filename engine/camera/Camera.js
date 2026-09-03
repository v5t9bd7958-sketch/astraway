/**
 * Camera.js
 *
 * 2D камера для портретного мира.
 * Не переставляет оси. Использует worldX → screenX, worldY → screenY.
 * Поддерживает плавное слежение (smoothing), зум (zoom), и корректный screen→world.
 *
 * Важно: viewport — это размеры SVG-контейнера (или Canvas) в пикселях.
 * Мировые координаты: 0..WORLD_WIDTH, 0..WORLD_HEIGHT.
 */

export class Camera {
  /**
   * @param {number} worldWidth   — ширина мира (например, 2400)
   * @param {number} worldHeight  — высота мира (например, 5190)
   * @param {object} options
   * @param {number} [options.smoothing=5]   — скорость слежения (чем больше, тем быстрее)
   * @param {number} [options.zoom=1]        — начальный зум
   */
  constructor(worldWidth, worldHeight, { smoothing = 5, zoom = 1 } = {}) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Позиция камеры в мировых координатах (центр viewport)
    this.x = worldWidth / 2;
    this.y = worldHeight / 2;

    // Целевая позиция (для плавного слежения)
    this.targetX = this.x;
    this.targetY = this.y;

    this.zoom = zoom;
    this.smoothing = smoothing; // 1 = мгновенно, больше = медленнее

    // Размер viewport (задаётся при рендере)
    this.viewportW = 0;
    this.viewportH = 0;
  }

  /**
   * Установить размер видимой области (вызывается при ресайзе или в render).
   */
  setViewport(width, height) {
    this.viewportW = width;
    this.viewportH = height;
  }

  /**
   * Установить цель для слежения (позиция персонажа в мире).
   * @param {{x:number, y:number}} worldPos
   */
  follow(worldPos) {
    this.targetX = worldPos.x;
    this.targetY = worldPos.y;
  }

  /**
   * Обновить позицию камеры (плавное приближение к цели).
   * @param {number} dt  — дельта времени в секундах
   */
  update(dt) {
    if (dt <= 0) return;
    // Плавное движение: чем больше smoothing, тем медленнее приближение
    const factor = 1 - Math.exp(-this.smoothing * dt);
    this.x += (this.targetX - this.x) * factor;
    this.y += (this.targetY - this.y) * factor;

    // Не даём камере выходить за границы мира (опционально)
    const halfW = (this.viewportW / 2) / this.zoom;
    const halfH = (this.viewportH / 2) / this.zoom;
    this.x = Math.max(halfW, Math.min(this.worldWidth - halfW, this.x));
    this.y = Math.max(halfH, Math.min(this.worldHeight - halfH, this.y));
  }

  /**
   * Преобразовать мировые координаты → экранные (SVG или Canvas).
   * @param {number} wx  — мировая x
   * @param {number} wy  — мировая y
   * @returns {{x:number, y:number}}
   */
  worldToScreen(wx, wy) {
    const scale = this.zoom;
    const screenX = (wx - this.x) * scale + this.viewportW / 2;
    const screenY = (wy - this.y) * scale + this.viewportH / 2;
    return { x: screenX, y: screenY };
  }

  /**
   * Преобразовать экранные координаты → мировые (для тапов).
   * @param {number} sx  — экранная x (в пикселях SVG/Canvas)
   * @param {number} sy  — экранная y
   * @returns {{x:number, y:number}}
   */
  screenToWorld(sx, sy) {
    const scale = this.zoom;
    const wx = (sx - this.viewportW / 2) / scale + this.x;
    const wy = (sy - this.viewportH / 2) / scale + this.y;
    return { x: wx, y: wy };
  }

  /**
   * Мгновенно установить камеру в позицию (без сглаживания).
   */
  snapTo(worldPos) {
    this.x = worldPos.x;
    this.y = worldPos.y;
    this.targetX = this.x;
    this.targetY = this.y;
  }
}
