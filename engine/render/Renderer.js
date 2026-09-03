/**
 * ASTRAWAY
 * Renderer.js
 *
 * Canvas 2D renderer.
 *
 * Архитектурный контракт:
 *
 * World
 *   ↓
 * Camera
 *   ↓
 * Renderer
 *   ↓
 * Canvas
 *
 * Renderer не меняет мировые координаты.
 * X остаётся X.
 * Y остаётся Y.
 */
export class Renderer {
    constructor(
        canvas,
        camera = null,
        world = null,
        character = null,
        gameState = null
    ) {
        if (!canvas) {
            throw new Error(
                'Renderer: Canvas не передан.'
            );
        }
        this.canvas =
            canvas;
        this.ctx =
            canvas.getContext('2d');
        if (!this.ctx) {
            throw new Error(
                'Renderer: Canvas 2D context недоступен.'
            );
        }
        this.camera =
            camera;
        this.world =
            world;
        this.character =
            character;
        this.gameState =
            gameState;
        this.width = 0;
        this.height = 0;
        this.viewportW = 0;
        this.viewportH = 0;
        this.devicePixelRatio =
            1;
        this.backgroundImage =
            null;
        this.backgroundLoaded =
            false;
        /*
         * В имени файла действительно
         * присутствует пробел.
         *
         * Битый background.jpg НЕ используется.
         */
        this.backgroundPath =
            'assets/background.jpg%20.jpeg';
        this.debug =
            false;
        this._resizeHandler =
            () => {
                this.resize();
            };
        window.addEventListener(
            'resize',
            this._resizeHandler
        );
        this.resize();
    }
    resize() {
        const rect =
            this.canvas.getBoundingClientRect();
        const width =
            Number.isFinite(rect.width) &&
            rect.width > 0
                ? rect.width
                : window.innerWidth;
        const height =
            Number.isFinite(rect.height) &&
            rect.height > 0
                ? rect.height
                : window.innerHeight;
        this.width =
            width;
        this.height =
            height;
        this.viewportW =
            width;
        this.viewportH =
            height;
        this.devicePixelRatio =
            Math.max(
                1,
                Math.min(
                    window.devicePixelRatio || 1,
                    2
                )
            );
        this.canvas.width =
            Math.max(
                1,
                Math.round(
                    width *
                    this.devicePixelRatio
                )
            );
        this.canvas.height =
            Math.max(
                1,
                Math.round(
                    height *
                    this.devicePixelRatio
                )
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
    loadBackground(
        path = this.backgroundPath
    ) {
        return new Promise(
            resolve => {
                const image =
                    new Image();
                image.onload =
                    () => {
                        this.backgroundImage =
                            image;
                        this.backgroundLoaded =
                            true;
                        this.render();
                        resolve(
                            image
                        );
                    };
                image.onerror =
                    () => {
                        this.backgroundImage =
                            null;
                        this.backgroundLoaded =
                            false;
                        /*
                         * Важно:
                         * ошибка изображения
                         * НЕ останавливает игру.
                         */
                        console.warn(
                            'ASTRAWAY Renderer: фон не загрузился:',
                            path
                        );
                        this.render();
                        resolve(
                            null
                        );
                    };
                image.src =
                    path;
            }
        );
    }
    setDebug(
        enabled
    ) {
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
        return this.debug;
    }
    isDebugEnabled() {
        return this.debug;
    }
    clear() {
        const ctx =
            this.ctx;
        ctx.setTransform(
            this.devicePixelRatio,
            0,
            0,
            this.devicePixelRatio,
            0,
            0
        );
        ctx.clearRect(
            0,
            0,
            this.viewportW,
            this.viewportH
        );
    }
    render(
        world = null,
        camera = null
    ) {
        if (world) {
            this.world =
                world;
        }
        if (camera) {
            this.camera =
                camera;
        }
        if (
            this.world &&
            typeof this.world.getCharacter ===
                'function'
        ) {
            this.character =
                this.world.getCharacter();
        }
        this.clear();
        /*
         * Даже если камера ещё не готова,
         * Canvas должен иметь видимый фон.
         */
        if (!this.camera) {
            this._renderFallback();
            return;
        }
        this._renderBackground();
        if (
            this.isDebugEnabled()
        ) {
            this._renderSurfaces();
            this._renderNavigation();
            this._renderWorldBounds();
        }
        this._renderCharacter();
        if (
            this.isDebugEnabled()
        ) {
            this._renderDebugGrid();
        }
    }
    _renderFallback() {
        const ctx =
            this.ctx;
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
    }
    _renderBackground() {
        const ctx =
            this.ctx;
        if (
            !this.backgroundImage
        ) {
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
            Number.isFinite(
                world.width
            )
                ? world.width
                : this.camera.worldWidth;
        const worldHeight =
            world &&
            Number.isFinite(
                world.height
            )
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
        const screenWidth =
            bottomRight.x -
            topLeft.x;
        const screenHeight =
            bottomRight.y -
            topLeft.y;
        ctx.save();
        ctx.imageSmoothingEnabled =
            true;
        ctx.drawImage(
            this.backgroundImage,
            topLeft.x,
            topLeft.y,
            screenWidth,
            screenHeight
        );
        ctx.restore();
    }
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
        ctx.lineWidth =
            3;
        ctx.strokeStyle =
            'rgba(255,255,255,0.55)';
        for (
            const surface
            of this.world.surfaces.values()
        ) {
            if (
                !surface ||
                !Array.isArray(
                    surface.points
                ) ||
                surface.points.length < 2
            ) {
                continue;
            }
            ctx.beginPath();
            surface.points.forEach(
                (
                    point,
                    index
                ) => {
                    const screen =
                        this.camera.worldToScreen(
                            point.x,
                            point.y
                        );
                    if (
                        index === 0
                    ) {
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
    _renderNavigation() {
        if (
            !this.world ||
            !this.world.navigation
        ) {
            return;
        }
        const graph =
            this.world.navigation;
        const ctx =
            this.ctx;
        ctx.save();
        /*
         * NavigationGraph.edges —
         * настоящий массив.
         */
        if (
            Array.isArray(
                graph.edges
            )
        ) {
            ctx.lineWidth =
                2;
            ctx.strokeStyle =
                'rgba(255,220,50,0.8)';
            for (
                const edge
                of graph.edges
            ) {
                if (
                    !edge ||
                    !edge.from ||
                    !edge.to
                ) {
                    continue;
                }
                const from =
                    edge.from.position;
                const to =
                    edge.to.position;
                if (
                    !from ||
                    !to
                ) {
                    continue;
                }
                const a =
                    this.camera.worldToScreen(
                        from.x,
                        from.y
                    );
                const b =
                    this.camera.worldToScreen(
                        to.x,
                        to.y
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
        }
        /*
         * NavigationGraph.nodes —
         * Map.
         */
        if (
            graph.nodes &&
            typeof graph.nodes.values ===
                'function'
        ) {
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
                    '#44ff44';
                ctx.fill();
            }
        }
        ctx.restore();
    }
    _renderCharacter() {
        const character =
            this.character;
        if (
            !character ||
            !character.position
        ) {
            return;
        }
        const position =
            character.position;
        if (
            !Number.isFinite(
                position.x
            ) ||
            !Number.isFinite(
                position.y
            )
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
         * Временный диагностический
         * персонаж.
         *
         * Реальный Skeleton уже существует
         * в Character, но отдельного
         * skeletal Canvas renderer пока
         * нет.
         */
        const size =
            Math.max(
                18,
                28 *
                this.camera.zoom
            );
        ctx.translate(
            screen.x,
            screen.y
        );
        const angle =
            Number.isFinite(
                character.moveAngle
            )
                ? character.moveAngle
                : 0;
        ctx.rotate(
            angle
        );
        ctx.fillStyle =
            '#e8c87a';
        ctx.strokeStyle =
            '#4a3a2a';
        ctx.lineWidth =
            2;
        ctx.beginPath();
        if (
            typeof ctx.roundRect ===
            'function'
        ) {
            ctx.roundRect(
                -size * 0.35,
                -size * 0.75,
                size * 0.7,
                size * 1.3,
                size * 0.12
            );
        } else {
            ctx.rect(
                -size * 0.35,
                -size * 0.75,
                size * 0.7,
                size * 1.3
            );
        }
        ctx.fill();
        ctx.stroke();
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
    }
    _renderWorldBounds() {
        if (!this.world) {
            return;
        }
        const width =
            Number.isFinite(
                this.world.width
            )
                ? this.world.width
                : this.camera.worldWidth;
        const height =
            Number.isFinite(
                this.world.height
            )
                ? this.world.height
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
            'rgba(255,0,0,0.7)';
        ctx.lineWidth =
            2;
        ctx.strokeRect(
            a.x,
            a.y,
            b.x - a.x,
            b.y - a.y
        );
        ctx.restore();
    }
    _renderDebugGrid() {
        const ctx =
            this.ctx;
        const step =
            100;
        ctx.save();
        ctx.lineWidth =
            1;
        ctx.strokeStyle =
            'rgba(255,255,255,0.08)';
        for (
            let x = 0;
            x <= this.world.width;
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
                    this.world.height
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
            y <= this.world.height;
            y += step
        ) {
            const a =
                this.camera.worldToScreen(
                    0,
                    y
                );
            const b =
                this.camera.worldToScreen(
                    this.world.width,
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
    destroy() {
        window.removeEventListener(
            'resize',
            this._resizeHandler
        );
        this.backgroundImage =
            null;
        this.character =
            null;
        this.world =
            null;
        this.camera =
            null;
        this.canvas =
            null;
        this.ctx =
            null;
    }
}
export default Renderer;
