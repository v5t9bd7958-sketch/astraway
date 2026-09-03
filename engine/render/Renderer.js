/**
 * Renderer.js
 *
 * Canvas renderer ASTRAWAY.
 *
 * Архитектура:
 *
 *   World coordinates
 *          ↓
 *       Camera
 *          ↓
 *   Canvas screen coordinates
 *
 * X остаётся X.
 * Y остаётся Y.
 *
 * Поддерживает:
 *   - портретный мир;
 *   - фон;
 *   - поверхности;
 *   - navigation graph;
 *   - персонажа;
 *   - debug mode;
 *   - resize;
 *   - загрузку background;
 *   - совместимость с Game.js.
 */

export class Renderer {

    constructor(
        canvas,
        camera = null,
        world = null,
        character = null,
        gameState = null
    ) {

        this.canvas = canvas;

        if (!this.canvas) {
            throw new Error(
                'Renderer: Canvas не передан.'
            );
        }

        this.ctx =
            this.canvas.getContext('2d');

        if (!this.ctx) {
            throw new Error(
                'Renderer: невозможно получить 2D Canvas context.'
            );
        }

        this.camera = camera;
        this.world = world;
        this.character = character;
        this.gameState = gameState;

        this.viewportW = 0;
        this.viewportH = 0;

        this.backgroundImage = null;
        this.backgroundLoaded = false;

        this.backgroundPath =
            'assets/background.jpg .jpeg';

        this.debug = false;

        this.devicePixelRatio =
            Math.max(
                1,
                Math.min(
                    window.devicePixelRatio || 1,
                    2
                )
            );

        this._resizeHandler =
            () => this.resize();

        window.addEventListener(
            'resize',
            this._resizeHandler
        );

        this.resize();
    }


    // --------------------------------------------------
    // RESIZE
    // --------------------------------------------------

    resize() {

        const rect =
            this.canvas.getBoundingClientRect();

        const width =
            rect.width ||
            window.innerWidth;

        const height =
            rect.height ||
            window.innerHeight;

        this.viewportW = width;
        this.viewportH = height;

        this.devicePixelRatio =
            Math.max(
                1,
                Math.min(
                    window.devicePixelRatio || 1,
                    2
                )
            );

        this.canvas.width =
            Math.round(
                width *
                this.devicePixelRatio
            );

        this.canvas.height =
            Math.round(
                height *
                this.devicePixelRatio
            );

        this.ctx.setTransform(
            this.devicePixelRatio,
            0,
            0,
            this.devicePixelRatio,
            0,
            0
        );

        if (this.camera) {

            this.camera.setViewport(
                width,
                height
            );
        }
    }


    // --------------------------------------------------
    // BACKGROUND
    // --------------------------------------------------

    loadBackground(
        path = this.backgroundPath
    ) {

        return new Promise(
            (resolve) => {

                const img =
                    new Image();

                img.onload =
                    () => {

                        this.backgroundImage =
                            img;

                        this.backgroundLoaded =
                            true;

                        resolve(img);

                        this.render();
                    };

                img.onerror =
                    () => {

                        console.warn(
                            'Renderer: не удалось загрузить фон:',
                            path
                        );

                        this.backgroundImage =
                            null;

                        this.backgroundLoaded =
                            false;

                        resolve(null);
                    };

                img.src = path;
            }
        );
    }


    // --------------------------------------------------
    // DEBUG
    // --------------------------------------------------

    setDebug(enabled) {

        this.debug =
            Boolean(enabled);

        if (this.gameState) {
            this.gameState.debugMode =
                this.debug;
        }

        this.render();
    }


    toggleDebug() {

        this.setDebug(
            !this.debug
        );
    }


    // --------------------------------------------------
    // MAIN RENDER
    // --------------------------------------------------

    render(
        world = this.world,
        camera = this.camera
    ) {

        if (world) {
            this.world = world;
        }

        if (camera) {
            this.camera = camera;
        }

        this.clear();

        if (!this.camera) {
            return;
        }

        // 1. ФОН
        this._renderBackground();

        // 2. DEBUG WORLD
        if (this.isDebugEnabled()) {

            this._renderSurfaces();

            this._renderNavGraph();

            this._renderWorldBounds();
        }

        // 3. CHARACTER
        this._renderCharacter();

        // 4. DEBUG
        if (this.isDebugEnabled()) {

            this._renderDebugGrid();
        }
    }


    // --------------------------------------------------
    // CLEAR
    // --------------------------------------------------

    clear() {

        this.ctx.save();

        this.ctx.setTransform(
            this.devicePixelRatio,
            0,
            0,
            this.devicePixelRatio,
            0,
            0
        );

        this.ctx.clearRect(
            0,
            0,
            this.viewportW,
            this.viewportH
        );

        this.ctx.restore();
    }


    // --------------------------------------------------
    // BACKGROUND
    // --------------------------------------------------

    _renderBackground() {

        const ctx =
            this.ctx;

        const image =
            this.backgroundImage;

        if (!image) {

            // Нейтральный фон до загрузки изображения.
            ctx.save();

            ctx.fillStyle =
                '#111';

            ctx.fillRect(
                0,
                0,
                this.viewportW,
                this.viewportH
            );

            ctx.restore();

            return;
        }

        const world =
            this.world;

        const worldWidth =
            world &&
            Number.isFinite(world.width)
                ? world.width
                : this.camera.worldWidth;

        const worldHeight =
            world &&
            Number.isFinite(world.height)
                ? world.height
                : this.camera.worldHeight;

        const topLeft =
            this.camera.worldToScreen(
                0,
                0
            );

        const bottomRight =
            this.camera.worldToScreen(
                worldWidth,
                worldHeight
            );

        const screenX =
            topLeft.x;

        const screenY =
            topLeft.y;

        const screenW =
            bottomRight.x -
            topLeft.x;

        const screenH =
            bottomRight.y -
            topLeft.y;

        ctx.save();

        ctx.imageSmoothingEnabled =
            true;

        ctx.drawImage(
            image,
            screenX,
            screenY,
            screenW,
            screenH
        );

        ctx.restore();
    }


    // --------------------------------------------------
    // SURFACES
    // --------------------------------------------------

    _renderSurfaces() {

        if (
            !this.world ||
            !this.world.surfaces
        ) {
            return;
        }

        const ctx =
            this.ctx;

        ctx.save();

        ctx.lineWidth = 2;

        ctx.strokeStyle =
            'rgba(255,255,255,0.45)';

        for (
            const surface
            of this.world.surfaces.values()
        ) {

            if (
                !surface ||
                !Array.isArray(surface.points) ||
                surface.points.length < 2
            ) {
                continue;
            }

            ctx.beginPath();

            surface.points.forEach(
                (point, index) => {

                    const screen =
                        this.camera.worldToScreen(
                            point.x,
                            point.y
                        );

                    if (index === 0) {

                        ctx.moveTo(
                            screen.x,
                            screen.y
                        );

                    } else {

                        ctx.lineTo(
                            screen.x,
                            screen.y
                        );
                    }
                }
            );

            ctx.stroke();
        }

        ctx.restore();
    }


    // --------------------------------------------------
    // NAVIGATION GRAPH
    // --------------------------------------------------

    _renderNavGraph() {

        if (
            !this.world ||
            !this.world.navigationGraph
        ) {
            return;
        }

        const graph =
            this.world.navigationGraph;

        const ctx =
            this.ctx;

        ctx.save();

        // Рёбра
        if (graph.edges) {

            ctx.lineWidth = 2;

            ctx.strokeStyle =
                'rgba(255,220,50,0.75)';

            for (
                const edge
                of graph.edges.values()
            ) {

                if (
                    !edge ||
                    !edge.from ||
                    !edge.to
                ) {
                    continue;
                }

                const a =
                    edge.from.position;

                const b =
                    edge.to.position;

                if (!a || !b) {
                    continue;
                }

                const sa =
                    this.camera.worldToScreen(
                        a.x,
                        a.y
                    );

                const sb =
                    this.camera.worldToScreen(
                        b.x,
                        b.y
                    );

                ctx.beginPath();

                ctx.moveTo(
                    sa.x,
                    sa.y
                );

                ctx.lineTo(
                    sb.x,
                    sb.y
                );

                ctx.stroke();
            }
        }

        // Узлы
        if (graph.nodes) {

            for (
                const node
                of graph.nodes.values()
            ) {

                if (
                    !node ||
                    !node.position
                ) {
                    continue;
                }

                const screen =
                    this.camera.worldToScreen(
                        node.position.x,
                        node.position.y
                    );

                ctx.beginPath();

                ctx.arc(
                    screen.x,
                    screen.y,
                    5,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    node.isEndNode
                        ? '#ff4444'
                        : '#44ff44';

                ctx.fill();
            }
        }

        ctx.restore();
    }


    // --------------------------------------------------
    // CHARACTER
    // --------------------------------------------------

    _renderCharacter() {

        const character =
            this.character;

        if (!character) {
            return;
        }

        const position =
            character.worldPosition ||
            character.position;

        if (
            !position ||
            !Number.isFinite(position.x) ||
            !Number.isFinite(position.y)
        ) {
            return;
        }

        const screen =
            this.camera.worldToScreen(
                position.x,
                position.y
            );

        const ctx =
            this.ctx;

        ctx.save();

        /*
         * Временный визуальный персонаж.
         *
         * В дальнейшем здесь подключается
         * реальный skeletal renderer.
         */

        const size =
            Math.max(
                16,
                28 *
                this.camera.zoom
            );

        ctx.translate(
            screen.x,
            screen.y
        );

        let angle = 0;

        if (
            Number.isFinite(
                character.moveAngle
            )
        ) {
            angle =
                character.moveAngle;
        }

        ctx.rotate(angle);

        // Тело
        ctx.fillStyle =
            '#e8c87a';

        ctx.strokeStyle =
            '#4a3a2a';

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.roundRect(
            -size * 0.35,
            -size * 0.75,
            size * 0.7,
            size * 1.3,
            size * 0.12
        );

        ctx.fill();

        ctx.stroke();

        // Голова
        ctx.beginPath();

        ctx.arc(
            0,
            -size * 0.95,
            size * 0.28,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.stroke();

        ctx.restore();

        if (
            this.isDebugEnabled()
        ) {

            this._renderCharacterDebug(
                character,
                position,
                screen
            );
        }
    }


    // --------------------------------------------------
    // CHARACTER DEBUG
    // --------------------------------------------------

    _renderCharacterDebug(
        character,
        position,
        screen
    ) {

        const ctx =
            this.ctx;

        ctx.save();

        // Центр персонажа
        ctx.beginPath();

        ctx.arc(
            screen.x,
            screen.y,
            4,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            '#00ffff';

        ctx.fill();

        // Направление
        if (
            Number.isFinite(
                character.moveAngle
            )
        ) {

            const length =
                70 *
                this.camera.zoom;

            const endX =
                screen.x +
                Math.cos(
                    character.moveAngle
                ) *
                length;

            const endY =
                screen.y +
                Math.sin(
                    character.moveAngle
                ) *
                length;

            ctx.beginPath();

            ctx.moveTo(
                screen.x,
                screen.y
            );

            ctx.lineTo(
                endX,
                endY
            );

            ctx.strokeStyle =
                '#ffaa00';

            ctx.lineWidth = 3;

            ctx.stroke();
        }

        // Текущая поверхность
        if (
            character.currentSurface &&
            Number.isFinite(
                character.currentSurfaceT
            )
        ) {

            const surface =
                character.currentSurface;

            const frame =
                surface.getFrame(
                    character.currentSurfaceT
                );

            if (
                frame &&
                frame.tangent
            ) {

                const length =
                    80 *
                    this.camera.zoom;

                const end =
                    this.camera.worldToScreen(
                        position.x +
                        frame.tangent.x *
                        length,

                        position.y +
                        frame.tangent.y *
                        length
                    );

                ctx.beginPath();

                ctx.moveTo(
                    screen.x,
                    screen.y
                );

                ctx.lineTo(
                    end.x,
                    end.y
                );

                ctx.strokeStyle =
                    '#00ffcc';

                ctx.lineWidth = 2;

                ctx.stroke();
            }
        }

        ctx.restore();
    }


    // --------------------------------------------------
    // WORLD BOUNDS
    // --------------------------------------------------

    _renderWorldBounds() {

        const world =
            this.world;

        if (!world) {
            return;
        }

        const width =
            Number.isFinite(world.width)
                ? world.width
                : this.camera.worldWidth;

        const height =
            Number.isFinite(world.height)
                ? world.height
                : this.camera.worldHeight;

        const a =
            this.camera.worldToScreen(
                0,
                0
            );

        const b =
            this.camera.worldToScreen(
                width,
                height
            );

        const ctx =
            this.ctx;

        ctx.save();

        ctx.strokeStyle =
            'rgba(255,0,0,0.6)';

        ctx.lineWidth = 2;

        ctx.strokeRect(
            a.x,
            a.y,
            b.x - a.x,
            b.y - a.y
        );

        ctx.restore();
    }


    // --------------------------------------------------
    // DEBUG GRID
    // --------------------------------------------------

    _renderDebugGrid() {

        const world =
            this.world;

        if (!world) {
            return;
        }

        const width =
            Number.isFinite(world.width)
                ? world.width
                : this.camera.worldWidth;

        const height =
            Number.isFinite(world.height)
                ? world.height
                : this.camera.worldHeight;

        const step = 200;

        const ctx =
            this.ctx;

        ctx.save();

        ctx.strokeStyle =
            'rgba(100,100,100,0.22)';

        ctx.lineWidth = 1;

        for (
            let x = 0;
            x <= width;
            x += step
        ) {

            const a =
                this.camera.worldToScreen(
                    x,
                    0
                );

            const b =
                this.camera.worldToScreen(
                    x,
                    height
                );

            ctx.beginPath();

            ctx.moveTo(
                a.x,
                a.y
            );

            ctx.lineTo(
                b.x,
                b.y
            );

            ctx.stroke();
        }

        for (
            let y = 0;
            y <= height;
            y += step
        ) {

            const a =
                this.camera.worldToScreen(
                    0,
                    y
                );

            const b =
                this.camera.worldToScreen(
                    width,
                    y
                );

            ctx.beginPath();

            ctx.moveTo(
                a.x,
                a.y
            );

            ctx.lineTo(
                b.x,
                b.y
            );

            ctx.stroke();
        }

        ctx.restore();
    }


    // --------------------------------------------------
    // DEBUG STATE
    // --------------------------------------------------

    isDebugEnabled() {

        return Boolean(
            this.debug ||
            (
                this.gameState &&
                this.gameState.debugMode
            )
        );
    }


    // --------------------------------------------------
    // DESTROY
    // --------------------------------------------------

    destroy() {

        window.removeEventListener(
            'resize',
            this._resizeHandler
        );

        this.backgroundImage =
            null;

        this.ctx =
            null;

        this.canvas =
            null;
    }
}
