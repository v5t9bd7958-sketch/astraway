/**
 * World.js
 *
 * ASTRAWAY — Level 1: The Ancient Tree (портретная ориентация)
 *
 * World space: 2400 × 5190 (соответствует изображению)
 *
 * Поверхности (surfaces) — 18 маршрутов по жёлтым линиям.
 * Каждая поверхность содержит:
 *   - id, points[] (координаты в мире)
 *   - width (половина ширины ветки)
 *   - normalSide (+1 = персонаж сверху)
 *
 * Навигационный граф строится автоматически с шагом 70 wu.
 * Для каждого ребра вычисляется тип движения (WALK / CRAWL / CLIMB).
 * Добавлены:
 *   - концевые узлы (isEndNode) для краёв веток
 *   - переходы HANG и SWING для висения и раскачивания
 *   - точки хвата (GRIP) для рук
 *
 * ВСЕ КООРДИНАТЫ — ПОРТРЕТНЫЕ (Y растёт вниз).
 */

import { Surface }          from './Surface.js';
import { NavigationGraph, MovementType } from '../navigation/NavigationGraph.js';

// ─── World dimensions ────────────────────────────────────────────────────────
export const WORLD_WIDTH  = 2400;
export const WORLD_HEIGHT = 5190;

// ─── Movement types (расширенные) ──────────────────────────────────────────
export const MoveType = Object.freeze({
  WALK:  'walk',
  CRAWL: 'crawl',
  CLIMB: 'climb',
  JUMP:  'jump',
  HANG:  'hang',   // висение на руках
  SWING: 'swing',  // раскачивание
  GRIP:  'grip',   // точка хвата (для рук)
});

// ─── Helper: генерация плотных узлов ────────────────────────────────────────
function densePoints(polyline, step = 70) {
  const result = [];
  if (polyline.length === 0) return result;
  result.push({ ...polyline[0] });

  let accumulated = 0;
  for (let i = 1; i < polyline.length; i++) {
    const ax = polyline[i - 1].x, ay = polyline[i - 1].y;
    const bx = polyline[i].x,     by = polyline[i].y;
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen < 1e-9) continue;

    let remaining = step - accumulated;
    while (remaining < segLen) {
      const t = remaining / segLen;
      result.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t });
      remaining += step;
    }
    accumulated = segLen - (remaining - step);
  }
  // Всегда добавляем последнюю точку
  const last = polyline[polyline.length - 1];
  const prev = result[result.length - 1];
  if (Math.hypot(last.x - prev.x, last.y - prev.y) > 10) {
    result.push({ ...last });
  }
  return result;
}

/**
 * Определение типа движения по углу наклона сегмента (от горизонтали).
 */
function angleToMoveType(ax, ay, bx, by) {
  const deg = Math.abs(Math.atan2(by - ay, bx - ax) * 180 / Math.PI);
  if (deg < 20)  return MoveType.WALK;
  if (deg < 55)  return MoveType.CRAWL;
  return MoveType.CLIMB;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ПОВЕРХНОСТИ (SURFACE DEFINITIONS)
// Все координаты — в мировом пространстве 2400×5190.
// normalSide: +1 = нормаль направлена влево от направления движения (персонаж сверху)
// ═══════════════════════════════════════════════════════════════════════════════

const SURFACE_DEFS = [

  // ── КОРНИ (внизу) ──────────────────────────────────────────────────────────
  {
    id: 'root_left',
    normalSide: 1,
    width: 30,
    points: [
      { x:  80,  y: 4900 }, // дальний левый корень
      { x: 220,  y: 4870 },
      { x: 380,  y: 4820 },
      { x: 520,  y: 4780 },
      { x: 680,  y: 4750 },
      { x: 820,  y: 4700 },
      { x: 920,  y: 4660 }, // основание левой лестницы
    ],
  },
  {
    id: 'root_right',
    normalSide: 1,
    width: 30,
    points: [
      { x: 1480, y: 4660 }, // около ствола справа
      { x: 1620, y: 4700 },
      { x: 1780, y: 4740 },
      { x: 1960, y: 4790 },
      { x: 2100, y: 4840 },
      { x: 2240, y: 4900 },
      { x: 2380, y: 4950 },
    ],
  },

  // ── НИЖНЯЯ ПОЛКА (слева) ──────────────────────────────────────────────────
  {
    id: 'shelf_lower_left',
    normalSide: 1,
    width: 25,
    points: [
      { x:  60,  y: 4500 },
      { x: 200,  y: 4480 },
      { x: 360,  y: 4460 },
      { x: 500,  y: 4440 },
      { x: 680,  y: 4420 },
      { x: 820,  y: 4400 },
    ],
  },

  // ── ГЛАВНАЯ ДИАГОНАЛЬНАЯ ВЕТКА ────────────────────────────────────────────
  {
    id: 'main_branch',
    normalSide: 1,
    width: 35,
    points: [
      { x:  80,  y: 4380 },
      { x: 220,  y: 4300 },
      { x: 380,  y: 4200 },
      { x: 540,  y: 4100 },
      { x: 700,  y: 3980 },
      { x: 860,  y: 3860 },
      { x: 1000, y: 3750 },
      { x: 1100, y: 3660 },
      { x: 1200, y: 3580 },
      { x: 1320, y: 3500 },
      { x: 1460, y: 3430 },
      { x: 1620, y: 3380 },
      { x: 1800, y: 3360 },
      { x: 1960, y: 3380 },
      { x: 2100, y: 3420 },
      { x: 2260, y: 3480 },
      { x: 2380, y: 3540 },
    ],
  },

  // ── ЛЕСТНИЦА (слева от ствола) ────────────────────────────────────────────
  {
    id: 'stairs_left',
    normalSide: 1,
    width: 20,
    points: [
      { x: 920,  y: 4660 },
      { x: 960,  y: 4540 },
      { x: 980,  y: 4420 },
      { x: 1000, y: 4280 },
      { x: 1020, y: 4140 },
      { x: 1040, y: 4000 },
      { x: 1060, y: 3860 },
      { x: 1080, y: 3750 },
    ],
  },

  // ── ЛЕВАЯ ПЛАТФОРМА ────────────────────────────────────────────────────────
  {
    id: 'ledge_left',
    normalSide: 1,
    width: 40,
    points: [
      { x: 680,  y: 3740 },
      { x: 780,  y: 3740 },
      { x: 880,  y: 3740 },
      { x: 1000, y: 3740 },
      { x: 1080, y: 3740 },
    ],
  },

  // ── СТВОЛ (вертикальный) ──────────────────────────────────────────────────
  {
    id: 'trunk',
    normalSide: 1,
    width: 35,
    points: [
      { x: 1160, y: 4660 },
      { x: 1180, y: 4460 },
      { x: 1200, y: 4260 },
      { x: 1200, y: 4060 },
      { x: 1200, y: 3860 },
      { x: 1200, y: 3660 },
      { x: 1200, y: 3460 },
      { x: 1200, y: 3260 },
      { x: 1200, y: 3060 },
      { x: 1200, y: 2860 },
      { x: 1200, y: 2660 },
      { x: 1180, y: 2460 },
      { x: 1180, y: 2260 },
      { x: 1180, y: 2060 },
      { x: 1160, y: 1860 },
      { x: 1160, y: 1660 },
      { x: 1160, y: 1460 },
      { x: 1160, y: 1260 },
      { x: 1160, y: 1060 },
    ],
  },

  // ── СРЕДНЯЯ ЛЕВАЯ ВЕТКА ────────────────────────────────────────────────────
  {
    id: 'branch_mid_left',
    normalSide: 1,
    width: 25,
    points: [
      { x: 1160, y: 3260 },
      { x: 1020, y: 3200 },
      { x: 880,  y: 3100 },
      { x: 740,  y: 2980 },
      { x: 600,  y: 2860 },
      { x: 460,  y: 2760 },
      { x: 300,  y: 2700 },
      { x: 140,  y: 2700 },
    ],
  },

  // ── СРЕДНЯЯ ПРАВАЯ ВЕТКА ──────────────────────────────────────────────────
  {
    id: 'branch_mid_right',
    normalSide: 1,
    width: 25,
    points: [
      { x: 1240, y: 3260 },
      { x: 1400, y: 3180 },
      { x: 1560, y: 3100 },
      { x: 1720, y: 3040 },
      { x: 1900, y: 3000 },
      { x: 2080, y: 2980 },
      { x: 2260, y: 2980 },
      { x: 2400, y: 3000 },
    ],
  },

  // ── ВЕРХНЯЯ ЛЕВАЯ ВЕТКА (основная) ────────────────────────────────────────
  {
    id: 'branch_upper_left',
    normalSide: 1,
    width: 28,
    points: [
      { x: 1160, y: 2260 },
      { x: 1000, y: 2180 },
      { x: 840,  y: 2080 },
      { x: 680,  y: 1960 },
      { x: 520,  y: 1840 },
      { x: 360,  y: 1760 },
      { x: 200,  y: 1740 },
      { x:  80,  y: 1760 },
    ],
  },

  // ── ВЕРХНЯЯ ЛЕВАЯ ВЕТКА (ответвление) ─────────────────────────────────────
  {
    id: 'branch_upper_left_sub',
    normalSide: 1,
    width: 20,
    points: [
      { x: 680,  y: 1960 },
      { x: 560,  y: 1840 },
      { x: 420,  y: 1700 },
      { x: 280,  y: 1580 },
      { x: 160,  y: 1480 },
      { x:  60,  y: 1420 },
    ],
  },

  // ── ВЕРХНЯЯ ПРАВАЯ ВЕТКА ──────────────────────────────────────────────────
  {
    id: 'branch_upper_right',
    normalSide: 1,
    width: 28,
    points: [
      { x: 1200, y: 2260 },
      { x: 1360, y: 2160 },
      { x: 1520, y: 2060 },
      { x: 1680, y: 1980 },
      { x: 1840, y: 1940 },
      { x: 2000, y: 1940 },
      { x: 2160, y: 1960 },
      { x: 2320, y: 2000 },
      { x: 2400, y: 2020 },
    ],
  },

  // ── КРОНА (верхушка) ──────────────────────────────────────────────────────
  {
    id: 'canopy_top',
    normalSide: 1,
    width: 30,
    points: [
      { x: 1060, y: 1060 },
      { x: 1160, y:  980 },
      { x: 1260, y:  940 },
      { x: 1380, y:  980 },
      { x: 1480, y: 1040 },
    ],
  },

  // ── КРОНА ЛЕВАЯ ────────────────────────────────────────────────────────────
  {
    id: 'canopy_left',
    normalSide: 1,
    width: 20,
    points: [
      { x: 1060, y: 1060 },
      { x:  920, y: 1020 },
      { x:  780, y:  980 },
      { x:  640, y:  960 },
      { x:  500, y:  960 },
      { x:  360, y:  980 },
    ],
  },

  // ── КРОНА ПРАВАЯ ───────────────────────────────────────────────────────────
  {
    id: 'canopy_right',
    normalSide: 1,
    width: 20,
    points: [
      { x: 1480, y: 1040 },
      { x: 1620, y: 1000 },
      { x: 1760, y:  980 },
      { x: 1900, y:  980 },
      { x: 2040, y: 1000 },
      { x: 2160, y: 1020 },
    ],
  },

  // ── МАЛЕНЬКАЯ ВЕТКА-КРЮК (слева вверху) ──────────────────────────────────
  {
    id: 'branch_hook_left',
    normalSide: 1,
    width: 18,
    points: [
      { x: 1160, y: 1660 },
      { x: 1020, y: 1600 },
      { x: 880,  y: 1560 },
      { x: 740,  y: 1540 },
      { x: 600,  y: 1560 },
      { x: 500,  y: 1600 },
    ],
  },

  // ── МАЛЕНЬКАЯ ВЕТКА-КРЮК (справа вверху) ─────────────────────────────────
  {
    id: 'branch_hook_right',
    normalSide: 1,
    width: 18,
    points: [
      { x: 1200, y: 1660 },
      { x: 1340, y: 1600 },
      { x: 1480, y: 1560 },
      { x: 1640, y: 1540 },
      { x: 1800, y: 1560 },
      { x: 1940, y: 1600 },
      { x: 2060, y: 1660 },
      { x: 2200, y: 1700 },
      { x: 2380, y: 1720 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ПЕРЕХОДЫ (JUNCTIONS) — включая новые HANG и SWING
// Формат: { a: [surfaceId, index], b: [surfaceId, index], type, oneWay? }
// index: 'first' | 'last' | число (индекс в исходных точках)
// ═══════════════════════════════════════════════════════════════════════════════

const JUNCTION_DEFS = [

  // --- Обычные переходы (WALK / CRAWL / CLIMB) ---
  { a: ['root_left',  'last'],  b: ['trunk',       'first'], type: MoveType.WALK  },
  { a: ['root_right', 'first'], b: ['trunk',       'first'], type: MoveType.WALK  },
  { a: ['root_left',  'last'],  b: ['stairs_left', 'first'], type: MoveType.WALK  },
  { a: ['stairs_left', 'last'], b: ['ledge_left',  'last'],  type: MoveType.WALK  },
  { a: ['ledge_left',  'last'], b: ['trunk',       3],       type: MoveType.WALK  },
  { a: ['main_branch', 9],      b: ['trunk',       3],       type: MoveType.CRAWL },
  { a: ['main_branch', 8],      b: ['stairs_left', 7],       type: MoveType.CRAWL },
  { a: ['shelf_lower_left', 'last'], b: ['main_branch', 1],  type: MoveType.JUMP  },
  { a: ['trunk', 6],            b: ['branch_mid_left',  'first'], type: MoveType.CRAWL },
  { a: ['trunk', 6],            b: ['branch_mid_right', 'first'], type: MoveType.CRAWL },
  { a: ['trunk', 12],           b: ['branch_upper_left',  'first'], type: MoveType.CRAWL },
  { a: ['trunk', 12],           b: ['branch_upper_right', 'first'], type: MoveType.CRAWL },
  { a: ['branch_upper_left', 3], b: ['branch_upper_left_sub', 'first'], type: MoveType.CRAWL },
  { a: ['trunk', 16],           b: ['branch_hook_left',  'first'], type: MoveType.WALK  },
  { a: ['trunk', 16],           b: ['branch_hook_right', 'first'], type: MoveType.WALK  },
  { a: ['trunk', 18],           b: ['canopy_top',   'first'], type: MoveType.CRAWL },
  { a: ['canopy_top', 'first'], b: ['canopy_left',  'first'], type: MoveType.WALK  },
  { a: ['canopy_top', 'last'],  b: ['canopy_right', 'first'], type: MoveType.WALK  },
  { a: ['branch_hook_right', 4], b: ['branch_upper_right', 5], type: MoveType.JUMP },
  { a: ['branch_mid_left', 2],  b: ['branch_upper_left', 4],  type: MoveType.JUMP },

  // --- НОВЫЕ ПЕРЕХОДЫ: ВИСЕНИЕ (HANG) И РАСКАЧИВАНИЕ (SWING) ---
  // Концевые точки веток, где персонаж может висеть на руках и раскачиваться

  // 1. Край левого корня → висение и раскачивание к правому корню (через пропасть)
  {
    a: ['root_left', 'first'],
    b: ['root_right', 'first'],
    type: MoveType.SWING,
    oneWay: false,
  },

  // 2. Край верхней левой ветки → висение и переход на верхнюю левую суб-ветку
  {
    a: ['branch_upper_left', 'last'],
    b: ['branch_upper_left_sub', 'last'],
    type: MoveType.HANG,
    oneWay: false,
  },

  // 3. Край средней левой ветки → висение и раскачивание к верхней левой ветке
  {
    a: ['branch_mid_left', 'last'],
    b: ['branch_upper_left', 4],
    type: MoveType.SWING,
    oneWay: false,
  },

  // 4. Край средней правой ветки → висение и раскачивание к верхней правой ветке
  {
    a: ['branch_mid_right', 'last'],
    b: ['branch_upper_right', 4],
    type: MoveType.SWING,
    oneWay: false,
  },

  // 5. Край левой кроны → висение и переход на правую крону (раскачивание)
  {
    a: ['canopy_left', 'last'],
    b: ['canopy_right', 'last'],
    type: MoveType.SWING,
    oneWay: false,
  },

  // 6. Край левого крюка → висение и переход на левую крону
  {
    a: ['branch_hook_left', 'last'],
    b: ['canopy_left', 2],
    type: MoveType.HANG,
    oneWay: false,
  },

  // 7. Край правого крюка → висение и переход на правую крону
  {
    a: ['branch_hook_right', 'last'],
    b: ['canopy_right', 2],
    type: MoveType.HANG,
    oneWay: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// КЛАСС WORLD
// ═══════════════════════════════════════════════════════════════════════════════

export class World {
  constructor() {
    this.width  = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;

    /** @type {Map<string, Surface>} */
    this.surfaces = new Map();

    /** @type {NavigationGraph} */
    this.navigationGraph = new NavigationGraph();

    // Реестр узлов: surfaceId → { nodeIds[], dense[] }
    this._surfaceNodes = new Map();

    // Список концевых узлов (для быстрого доступа)
    this._endNodeIds = [];

    // Интерактивные объекты
    this.objects = this._buildObjects();

    this._buildSurfaces();
    this._buildNavGraph();
    this._buildJunctions();

    // Валидация
    const errors = this.navigationGraph.validate();
    if (errors.length > 0) {
      console.warn('World: NavigationGraph validation errors:', errors);
    }
  }

  // ─────────────────────────────────────────────
  // ПОСТРОЕНИЕ
  // ─────────────────────────────────────────────

  _buildSurfaces() {
    for (const def of SURFACE_DEFS) {
      const surface = new Surface(def.id, def.points, {
        width: def.width ?? 28,
        normalSide: def.normalSide ?? 1,
      });
      this.surfaces.set(def.id, surface);
    }
  }

  _buildNavGraph() {
    this._endNodeIds = [];

    for (const def of SURFACE_DEFS) {
      const surface = this.surfaces.get(def.id);
      const dense   = densePoints(def.points, 70);

      const nodeIds = [];
      for (let i = 0; i < dense.length; i++) {
        const id = `${def.id}_n${i}`;
        const t  = dense.length > 1 ? i / (dense.length - 1) : 0;
        this.navigationGraph.addNode(id, dense[i], def.id, t);
        nodeIds.push(id);
      }

      // Соединяем соседние узлы
      for (let i = 0; i < nodeIds.length - 1; i++) {
        const a = dense[i], b = dense[i + 1];
        const mt = angleToMoveType(a.x, a.y, b.x, b.y);
        this.navigationGraph.addEdge(nodeIds[i], nodeIds[i + 1], { movementType: mt });
      }

      this._surfaceNodes.set(def.id, { nodeIds, dense });

      // Помечаем последний узел как концевой
      const lastId = nodeIds[nodeIds.length - 1];
      if (lastId) {
        this._endNodeIds.push(lastId);
        // Добавляем флаг в сам узел (через дополнительное поле)
        const node = this.navigationGraph.getNode(lastId);
        if (node) node.isEndNode = true;
      }
    }
  }

  _buildJunctions() {
    for (const junc of JUNCTION_DEFS) {
      const nodeA = this._resolveJunctionNode(junc.a);
      const nodeB = this._resolveJunctionNode(junc.b);
      if (!nodeA || !nodeB) {
        console.warn(`World: junction skipped — could not resolve`, junc);
        continue;
      }
      const oneWay = junc.oneWay ?? (junc.type === MoveType.JUMP || junc.type === MoveType.SWING);
      this.navigationGraph.addEdge(nodeA, nodeB, {
        movementType: junc.type,
        oneWay,
      });
    }
  }

  /**
   * Преобразует спецификацию [surfaceId, index] в ID узла.
   */
  _resolveJunctionNode([surfaceId, index]) {
    const entry = this._surfaceNodes.get(surfaceId);
    if (!entry) {
      console.warn(`World._resolveJunctionNode: unknown surface '${surfaceId}'`);
      return null;
    }
    const { nodeIds } = entry;
    if (index === 'first') return nodeIds[0] ?? null;
    if (index === 'last')  return nodeIds[nodeIds.length - 1] ?? null;
    // Числовой индекс — ищем ближайший плотный узел к точке из SURFACE_DEFS
    const defPoints = SURFACE_DEFS.find(d => d.id === surfaceId)?.points;
    if (!defPoints || index >= defPoints.length) return nodeIds[0] ?? null;
    const target = defPoints[index];
    return this._nearestNodeOnSurface(surfaceId, target);
  }

  _nearestNodeOnSurface(surfaceId, pos) {
    const entry = this._surfaceNodes.get(surfaceId);
    if (!entry) return null;
    const { nodeIds, dense } = entry;
    let best = null, bestDist = Infinity;
    for (let i = 0; i < dense.length; i++) {
      const d = Math.hypot(dense[i].x - pos.x, dense[i].y - pos.y);
      if (d < bestDist) { bestDist = d; best = nodeIds[i]; }
    }
    return best;
  }

  // ─────────────────────────────────────────────
  // ПУБЛИЧНЫЙ API
  // ─────────────────────────────────────────────

  getSurface(id) { return this.surfaces.get(id); }

  /** Получить все концевые узлы */
  getEndNodes() {
    return this._endNodeIds.map(id => this.navigationGraph.getNode(id)).filter(Boolean);
  }

  nearestNode(worldPos, surfaceId = null) {
    const node = this.navigationGraph.nearestNode(worldPos, surfaceId);
    return node ? { node, nodeId: node.id } : null;
  }

  nearestSurface(worldPos, maxDist = 200) {
    let best = null, bestDist = Infinity;
    for (const surface of this.surfaces.values()) {
      const proj = surface.projectPoint(worldPos);
      if (proj.dist !== undefined && Math.abs(proj.dist) < bestDist) {
        const d = Math.hypot(proj.x - worldPos.x, proj.y - worldPos.y);
        if (d < bestDist && d < maxDist) {
          bestDist = d;
          best = { surface, proj };
        }
      }
    }
    return best;
  }

  // ─────────────────────────────────────────────
  // ОБЪЕКТЫ
  // ─────────────────────────────────────────────

  _buildObjects() {
    return [
      { id: 'obj_mushroom',  icon: '🍄', x: 1340, y: 3380, surfaceId: 'main_branch'       },
      { id: 'obj_door',      icon: '🚪', x: 1180, y: 3060, surfaceId: 'trunk'              },
      { id: 'obj_lantern',   icon: '🏮', x:  460, y: 2760, surfaceId: 'branch_mid_left'    },
      { id: 'obj_crystal',   icon: '💎', x: 1900, y: 2980, surfaceId: 'branch_mid_right'   },
      { id: 'obj_nest',      icon: '🪺', x:  200, y: 1740, surfaceId: 'branch_upper_left'  },
      { id: 'obj_scroll',    icon: '📜', x: 2160, y: 1960, surfaceId: 'branch_upper_right' },
      { id: 'obj_star',      icon: '⭐', x: 1260, y:  940, surfaceId: 'canopy_top'         },
    ];
  }
}
