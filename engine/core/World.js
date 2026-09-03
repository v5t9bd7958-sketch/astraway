// ============================================================
// engine/core/World.js
// ИЗМЕНЕНИЯ ТОЛЬКО ДЛЯ МАРШРУТОВ
// ============================================================


// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import {
    createASTRAWAYSurfaces,
    createASTRAWAYNavigation
} from '../world/RouteNetwork.js';


// ------------------------------------------------------------
// REPLACE World.createSurfaces()
// ------------------------------------------------------------

createSurfaces() {

    createASTRAWAYSurfaces(
        this
    );
}


// ------------------------------------------------------------
// REPLACE World.createNavigation()
// ------------------------------------------------------------

createNavigation() {

    createASTRAWAYNavigation(
        this
    );
}


// ------------------------------------------------------------
// MOVE START
// ------------------------------------------------------------
// 2400 × 5190
// Старт остаётся привязанным к Surface.
// Не использовать старые x/y 1600×1000.
// ------------------------------------------------------------

initializeCharacter() {

    const root =
        this.getSurface(
            's14_left_root_loop'
        );

    if (!root) {
        throw new Error(
            'ASTRAWAY: стартовая поверхность отсутствует.'
        );
    }

    const startT =
        0.08;

    const startPoint =
        root.getPoint(
            startT
        );

    this.character.initialize(
        startPoint,
        root,
        startT
    );
}


// ============================================================
// NEXT TASK:
// Заменить в World.js только createSurfaces(),
// createNavigation() и initializeCharacter() блоками выше.
// ============================================================
