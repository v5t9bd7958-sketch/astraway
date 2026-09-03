/**
 * Renderer.js
 *
 * Отрисовывает игровой мир на SVG (или Canvas, если переделать под Canvas).
 * Использует Camera.worldToScreen для преобразования координат.
 * Фон (изображение дерева) рисуется с учётом позиции камеры.
 *
 * Поддерживает режим отладки (показывает узлы, рёбра, нормали).
 */

import { WORLD_WIDTH, WORLD_HEIGHT } from '../world/World.js';

export class Renderer {
  /**
   * @param {SVGSVGElement} svg
   * @param {Camera} camera
   * @param {World} world
   * @param {Character} character
   * @param {GameState} gameState
   */
  constructor(svg, camera, world, character, gameState) {
    this.svg = svg;
    this.camera = camera;
    this.world = world;
    this.character = character;
    this.gameState = gameState;

    // SVG элементы
    this.backgroundLayer = null;
    this.worldLayer = null;
    this.characterLayer = null;
    this.debugLayer = null;

    // Загруженное изображение фона
    this.backgroundImage = null;

    this.viewportW = window.innerWidth;
    this.viewportH = window.innerHeight;

    this._initLayers();
    this._loadBackground();
  }

  // ─────────────────────────────────────────────
  // ИНИЦИАЛИЗАЦИЯ
  // ─────────────────────────────────────────────

  _initLayers() {
    // Очищаем SVG
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    // Создаём группы (layers) для разных объектов
    const createGroup = (id) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', id);
      this.svg.appendChild(g);
      return g;
    };

    this.backgroundLayer = createGroup('bg-layer');
    this.worldLayer      = createGroup('world-layer');
    this.characterLayer  = createGroup('character-layer');
    this.debugLayer      = createGroup('debug-layer');
  }

  _loadBackground() {
    // Путь к изображению (убедитесь, что файл лежит по этому пути)
    const imgPath = 'assets/background.jpg .jpeg';
    const img = new Image();
    img.onload = () => {
      this.backgroundImage = img;
      // Принудительно перерисовываем
      this.render();
    };
    img.onerror = () => {
      console.warn('Renderer: не удалось загрузить фон', imgPath);
    };
    img.src = imgPath;
  }

  // ─────────────────────────────────────────────
  // РЕНДЕРИНГ
  // ─────────────────────────────────────────────

  render() {
    // Обновляем viewport камеры
    this.viewportW = window.innerWidth;
    this.viewportH = window.innerHeight;
    this.camera.setViewport(this.viewportW, this.viewportH);

    // Очищаем слои (кроме фона, чтобы не пересоздавать элементы)
    this.worldLayer.innerHTML = '';
    this.characterLayer.innerHTML = '';
    this.debugLayer.innerHTML = '';

    // 1. Фон
    this._renderBackground();

    // 2. Поверхности (отладочные линии)
    if (this.gameState.debugMode) {
      this._renderSurfaces();
      this._renderNavGraph();
    }

    // 3. Персонаж
    this._renderCharacter();

    // 4. Отладка (узлы, нормали)
    if (this.gameState.debugMode) {
      this._renderDebug();
    }
  }

  // ─────────────────────────────────────────────
  // ФОН
  // ─────────────────────────────────────────────

  _renderBackground() {
    if (!this.backgroundImage) return;

    // Вычисляем, какую часть изображения видно в текущем viewport
    const scale = this.camera.zoom;
    const halfW = (this.viewportW / 2) / scale;
    const halfH = (this.viewportH / 2) / scale;

    const viewX = this.camera.x - halfW;
    const viewY = this.camera.y - halfH;
    const viewW = this.viewportW / scale;
    const viewH = this.viewportH / scale;

    // Создаём SVG-элемент <image> с обрезкой (clip) или просто используем transform.
    // Проще: рисуем всё изображение, но сдвигаем через transform.
    const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    imgEl.setAttribute('href', this.backgroundImage.src);
    imgEl.setAttribute('width', this.world.width);
    imgEl.setAttribute('height', this.world.height);
    imgEl.setAttribute('preserveAspectRatio', 'none');

    // Применяем трансформацию: сдвиг камеры и масштаб
    // В SVG трансформация применяется к элементу: translate(screenX, screenY) scale(zoom)
    // Но проще использовать матрицу: 
    //   screenX = (worldX - camera.x) * zoom + viewportW/2
    //   screenY = (worldY - camera.y) * zoom + viewportH/2
    // Для фона можно применить transform к группе или к image.
    // Мы применим transform к backgroundLayer.
    const tx = -this.camera.x * this.camera.zoom + this.viewportW / 2;
    const ty = -this.camera.y * this.camera.zoom + this.viewportH / 2;
    this.backgroundLayer.setAttribute('transform', 
      `translate(${tx}, ${ty}) scale(${this.camera.zoom})`
    );

    // Очищаем и добавляем изображение
    while (this.backgroundLayer.firstChild) {
      this.backgroundLayer.removeChild(this.backgroundLayer.firstChild);
    }
    this.backgroundLayer.appendChild(imgEl);
  }

  // ─────────────────────────────────────────────
  // ПОВЕРХНОСТИ (отладка)
  // ─────────────────────────────────────────────

  _renderSurfaces() {
    for (const surface of this.world.surfaces.values()) {
      // Рисуем полилинию поверхности (белая, полупрозрачная)
      const points = surface.points.map(p => this.camera.worldToScreen(p.x, p.y));
      const ptsStr = points.map(p => `${p.x},${p.y}`).join(' ');
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', ptsStr);
      polyline.setAttribute('stroke', 'rgba(255,255,255,0.3)');
      polyline.setAttribute('stroke-width', '2');
      polyline.setAttribute('fill', 'none');
      this.worldLayer.appendChild(polyline);
    }
  }

  _renderNavGraph() {
    // Узлы
    for (const node of this.world.navigationGraph.nodes.values()) {
      const pos = this.camera.worldToScreen(node.position.x, node.position.y);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', node.isEndNode ? '#ff4444' : '#44ff44');
      this.debugLayer.appendChild(circle);
    }
  }

  // ─────────────────────────────────────────────
  // ПЕРСОНАЖ
  // ─────────────────────────────────────────────

  _renderCharacter() {
    const pos = this.character.worldPosition;
    if (!pos) return;
    const screen = this.camera.worldToScreen(pos.x, pos.y);

    // Простой квадрат (позже заменим на скелет)
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', screen.x - 20);
    rect.setAttribute('y', screen.y - 40);
    rect.setAttribute('width', '40');
    rect.setAttribute('height', '60');
    rect.setAttribute('fill', '#e8c87a');
    rect.setAttribute('stroke', '#4a3a2a');
    rect.setAttribute('stroke-width', '2');
    this.characterLayer.appendChild(rect);

    // Отладочно: рисуем направление (касательную)
    if (this.gameState.debugMode && this.character.currentSurface) {
      const tangent = this.character.currentSurface.getTangentAt(this.character.surfaceT || 0);
      const endX = pos.x + tangent.x * 80;
      const endY = pos.y + tangent.y * 80;
      const sEnd = this.camera.worldToScreen(endX, endY);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', screen.x);
      line.setAttribute('y1', screen.y);
      line.setAttribute('x2', sEnd.x);
      line.setAttribute('y2', sEnd.y);
      line.setAttribute('stroke', '#ffaa00');
      line.setAttribute('stroke-width', '3');
      this.debugLayer.appendChild(line);
    }
  }

  // ─────────────────────────────────────────────
  // ОТЛАДКА
  // ─────────────────────────────────────────────

  _renderDebug() {
    // Дополнительная отладка: например, сетка мира
    const step = 200;
    for (let x = 0; x <= this.world.width; x += step) {
      const from = this.camera.worldToScreen(x, 0);
      const to = this.camera.worldToScreen(x, this.world.height);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', 'rgba(100,100,100,0.2)');
      line.setAttribute('stroke-width', '1');
      this.debugLayer.appendChild(line);
    }
    for (let y = 0; y <= this.world.height; y += step) {
      const from = this.camera.worldToScreen(0, y);
      const to = this.camera.worldToScreen(this.world.width, y);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', 'rgba(100,100,100,0.2)');
      line.setAttribute('stroke-width', '1');
      this.debugLayer.appendChild(line);
    }
  }
}
