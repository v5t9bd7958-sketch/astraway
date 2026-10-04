/**
 * ASTRAWAY
 * Renderer.js
 *
 * Canvas 2D renderer.
 *
 * Renderer отвечает только за визуализацию.
 *
 * Он НЕ отвечает за:
 * - анатомию;
 * - движение;
 * - IK;
 * - gait;
 * - gravity;
 * - баланс;
 * - animation state.
 *
 * Источник истины:
 *
 * Skeleton
 *     ↓
 * Character / Gait / IK / Dynamics
 *     ↓
 * Renderer
 *     ↓
 * Canvas
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

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        if (!this.ctx) {
            throw new Error(
                'Renderer: Canvas 2D context недоступен.'
            );
        }

        this.camera = camera;
        this.world = world;
        this.character = character;
        this.gameState = gameState;

        this.width = 0;
        this.height = 0;

        this.viewportW = 0;
        this.viewportH = 0;

        this.devicePixelRatio = 1;

        this.backgroundImage = null;
        this.backgroundLoaded = false;

        this.backgroundPath =
            'assets/background.jpg%20.jpeg';

        /*
         * Debug layer (отладочный слой).
         *
         * По умолчанию выключен.
         */
        this.debug = false;

        this._resizeHandler = () => {
            this.resize();
        };

        window.addEventListener(
            'resize',
            this._resizeHandler
        );

        this.resize();
    }

    /*
     * =========================================================
     * VIEWPORT
     * =========================================================
     */

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

        this.width = width;
        this.height = height;

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

    /*
     * =========================================================
     * BACKGROUND
     * =========================================================
     */

    loadBackground(
        path = this.backgroundPath
    ) {
        return new Promise(
            resolve => {
                const image =
                    new Image();

                image.onload = () => {
                    this.backgroundImage =
                        image;

                    this.backgroundLoaded =
                        true;

                    this.render();

                    resolve(image);
                };

                image.onerror = () => {
                    this.backgroundImage =
                        null;

                    this.backgroundLoaded =
                        false;

                    console.warn(
                        'ASTRAWAY Renderer: фон не загрузился:',
                        path
                    );

                    this.render();

                    resolve(null);
                };

                image.src = path;
            }
        );
    }

    /*
     * =========================================================
     * DEBUG
     * =========================================================
     */

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

        return this.debug;
    }

    isDebugEnabled() {
        return this.debug;
    }

    /*
     * =========================================================
     * CLEAR
     * =========================================================
     */

    clear() {
        const ctx = this.ctx;

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

    /*
     * =========================================================
     * MAIN RENDER
     * =========================================================
     */

    render(
        world = null,
        camera = null
    ) {
        if (world) {
            this.world = world;
        }

        if (camera) {
            this.camera = camera;
        }

        /*
         * Character берётся из World.
         *
         * Renderer не создаёт персонажа
         * и не хранит отдельную копию.
         */
        if (
            this.world &&
            typeof this.world.getCharacter ===
                'function'
        ) {
            this.character =
                this.world.getCharacter();
        }

        this.clear();

        if (!this.camera) {
            this._renderFallback();
            return;
        }

        this._renderBackground();

        /*
         * Debug-only geometry.
         */
        if (this.isDebugEnabled()) {
            this._renderSurfaces();
            this._renderNavigation();
            this._renderWorldBounds();
        }

        /*
         * Character всегда поверх мира.
         */
        this._renderCharacter();

        if (this.isDebugEnabled()) {
            this._renderDebugGrid();
        }
    }

    /*
     * =========================================================
     * FALLBACK
     * =========================================================
     */

    _renderFallback() {
        const ctx = this.ctx;

        ctx.save();

        ctx.fillStyle = '#111';

        ctx.fillRect(
            0,
            0,
            this.viewportW,
            this.viewportH
        );

        ctx.restore();
    }

    /*
     * =========================================================
     * BACKGROUND
     * =========================================================
     */

    _renderBackground() {
        const ctx = this.ctx;

        if (!this.backgroundImage) {
            ctx.save();

            ctx.fillStyle = '#111';

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

    /*
     * =========================================================
     * DEBUG SURFACES
     * =========================================================
     */

    _renderSurfaces() {
        if (
            !this.world ||
            !this.world.surfaces
        ) {
            return;
        }

        const ctx = this.ctx;

        ctx.save();

        ctx.lineWidth = 3;

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

    /*
     * =========================================================
     * DEBUG NAVIGATION
     * =========================================================
     */

    _renderNavigation() {
        if (
            !this.world ||
            !this.world.navigation
        ) {
            return;
        }

        const graph =
            this.world.navigation;

        const ctx = this.ctx;

        ctx.save();

        if (
            Array.isArray(
                graph.edges
            )
        ) {
            ctx.lineWidth = 2;

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

                ctx.fillStyle =
                    'rgba(255,220,50,0.9)';

                ctx.arc(
                    screen.x,
                    screen.y,
                    3,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }
        }

        ctx.restore();
    }

    /*
     * =========================================================
     * CHARACTER
     * =========================================================
     *
     * Renderer НЕ знает анатомию.
     *
     * Он работает с Bone API:
     *
     * worldX
     * worldY
     * worldAngle
     * worldScale
     * length
     *
     * Поэтому изменение Skeleton не требует
     * переписывать Renderer.
     */

    _renderCharacter() {
        const character =
            this.character;

        if (
            !character ||
            !character.skeleton ||
            !this.camera
        ) {
            return;
        }

        const skeleton =
            character.skeleton;

        if (
            !skeleton.bones ||
            typeof skeleton.bones.values !==
                'function'
        ) {
            return;
        }

        const ctx = this.ctx;

        /*
         * -----------------------------------------------------
         * Bone lookup
         * -----------------------------------------------------
         */

        const getBone =
            name => {
                if (
                    typeof skeleton.getBone !==
                        'function'
                ) {
                    return null;
                }

                return skeleton.getBone(
                    name
                );
            };

        /*
         * -----------------------------------------------------
         * World → screen
         * -----------------------------------------------------
         */

        const getScreenPoint =
            bone => {
                if (!bone) {
                    return null;
                }

                if (
                    !Number.isFinite(
                        bone.worldX
                    ) ||
                    !Number.isFinite(
                        bone.worldY
                    )
                ) {
                    return null;
                }

                return this.camera.worldToScreen(
                    bone.worldX,
                    bone.worldY
                );
            };

        /*
         * -----------------------------------------------------
         * Draw one anatomical bone.
         *
         * ВАЖНО:
         *
         * Не используем следующую кость
         * для определения длины.
         *
         * Собственная длина кости:
         *
         * bone.length
         *
         * Собственный мировой угол:
         *
         * bone.worldAngle
         *
         * Это делает Renderer независимым
         * от конкретной иерархии.
         * -----------------------------------------------------
         */

        const drawBone =
            (
                name,
                width,
                alpha = 1
            ) => {
                const bone =
                    getBone(name);

                if (!bone) {
                    return;
                }

                if (
                    !Number.isFinite(
                        bone.worldX
                    ) ||
                    !Number.isFinite(
                        bone.worldY
                    ) ||
                    !Number.isFinite(
                        bone.worldAngle
                    ) ||
                    !Number.isFinite(
                        bone.length
                    )
                ) {
                    return;
                }

                const start =
                    this.camera.worldToScreen(
                        bone.worldX,
                        bone.worldY
                    );

                const scale =
                    Number.isFinite(
                        bone.worldScale
                    )
                        ? Math.abs(
                            bone.worldScale
                        )
                        : 1;

                const worldLength =
                    Math.max(
                        0,
                        bone.length *
                        scale
                    );

                const endWorldX =
                    bone.worldX +
                    Math.cos(
                        bone.worldAngle
                    ) *
                    worldLength;

                const endWorldY =
                    bone.worldY +
                    Math.sin(
                        bone.worldAngle
                    ) *
                    worldLength;

                const end =
                    this.camera.worldToScreen(
                        endWorldX,
                        endWorldY
                    );

                ctx.save();

                ctx.globalAlpha =
                    alpha;

                ctx.lineCap =
                    'round';

                ctx.lineJoin =
                    'round';

                ctx.lineWidth =
                    width;

                ctx.strokeStyle =
                    'rgba(18,20,28,0.96)';

                ctx.beginPath();

                ctx.moveTo(
                    start.x,
                    start.y
                );

                ctx.lineTo(
                    end.x,
                    end.y
                );

                ctx.stroke();

                ctx.restore();
            };

        /*
         * -----------------------------------------------------
         * Draw joint marker.
         * -----------------------------------------------------
         */

        const drawJoint =
            (
                name,
                radius
            ) => {
                const bone =
                    getBone(name);

                const point =
                    getScreenPoint(
                        bone
                    );

                if (!point) {
                    return;
                }

                ctx.save();

                ctx.fillStyle =
                    'rgba(40,44,56,0.98)';

                ctx.beginPath();

                ctx.arc(
                    point.x,
                    point.y,
                    radius,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.restore();
            };

        /*
         * =====================================================
         * LEGS
         * =====================================================
         */

        drawBone(
            'thighL',
            11
        );

        drawBone(
            'shinL',
            10
        );

        drawBone(
            'ankleL',
            8
        );

        drawBone(
            'footL',
            7
        );

        drawBone(
            'toeL',
            5
        );

        drawBone(
            'thighR',
            11
        );

        drawBone(
            'shinR',
            10
        );

        drawBone(
            'ankleR',
            8
        );

        drawBone(
            'footR',
            7
        );

        drawBone(
            'toeR',
            5
        );

        /*
         * =====================================================
         * SPINE
         * =====================================================
         */

        drawBone(
            'spineLower',
            15
        );

        drawBone(
            'spineMid',
            16
        );

        drawBone(
            'spineUpper',
            17
        );

        drawBone(
            'chest',
            18
        );

        drawBone(
            'neck',
            12
        );

        /*
         * Head is rendered separately.
         * Therefore the head segment itself is not used
         * as a simple line.
         */

        /*
         * =====================================================
         * LEFT ARM
         * =====================================================
         */

        drawBone(
            'clavicleL',
            8
        );

        drawBone(
            'upperArmL',
            9
        );

        drawBone(
            'forearmL',
            8
        );

        drawBone(
            'wristL',
            7
        );

        drawBone(
            'handL',
            6
        );

        /*
         * =====================================================
         * RIGHT ARM
         * =====================================================
         */

        drawBone(
            'clavicleR',
            8
        );

        drawBone(
            'upperArmR',
            9
        );

        drawBone(
            'forearmR',
            8
        );

        drawBone(
            'wristR',
            7
        );

        drawBone(
            'handR',
            6
        );

        /*
         * =====================================================
         * JOINTS
         * =====================================================
         */

        const joints = [
            ['pelvis', 10],

            ['spineLower', 6],
            ['spineMid', 6],
            ['spineUpper', 7],
            ['chest', 9],
            ['neck', 6],

            ['clavicleL', 5],
            ['upperArmL', 6],
            ['forearmL', 5],
            ['wristL', 4],

            ['clavicleR', 5],
            ['upperArmR', 6],
            ['forearmR', 5],
            ['wristR', 4],

            ['thighL', 7],
            ['shinL', 6],
            ['ankleL', 5],

            ['thighR', 7],
            ['shinR', 6],
            ['ankleR', 5]
        ];

        joints.forEach(
            ([name, radius]) => {
                drawJoint(
                    name,
                    radius
                );
            }
        );

        /*
         * =====================================================
         * HEAD
         * =====================================================
         */

        const head =
            getBone('head');

        const headPoint =
            getScreenPoint(
                head
            );

        if (headPoint) {
            const headRadius =
                head &&
                Number.isFinite(
                    head.length
                )
                    ? Math.max(
                        15,
                        head.length *
                        (head.worldScale || 1) *
                        0.42
                    )
                    : 18;

            ctx.save();

            ctx.fillStyle =
                'rgba(28,31,40,0.98)';

            ctx.beginPath();

            ctx.arc(
                headPoint.x,
                headPoint.y,
                headRadius,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.strokeStyle =
                'rgba(180,190,210,0.65)';

            ctx.lineWidth = 2;

            ctx.stroke();

            ctx.restore();
        }

        /*
         * =====================================================
         * EYES
         * =====================================================
         */

        [
            'eyeL',
            'eyeR'
        ].forEach(
            name => {
                const eye =
                    getScreenPoint(
                        getBone(name)
                    );

                if (!eye) {
                    return;
                }

                ctx.save();

                ctx.fillStyle =
                    'rgba(230,245,255,0.95)';

                ctx.beginPath();

                ctx.arc(
                    eye.x,
                    eye.y,
                    3.2,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.restore();
            }
        );
    }

    /*
     * =========================================================
     * DEBUG WORLD BOUNDS
     * =========================================================
     */

    _renderWorldBounds() {
        if (
            !this.world ||
            !this.camera
        ) {
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

        const ctx = this.ctx;

        ctx.save();

        ctx.strokeStyle =
            'rgba(0,255,120,0.7)';

        ctx.lineWidth = 2;

        ctx.strokeRect(
            a.x,
            a.y,
            b.x - a.x,
            b.y - a.y
        );

        ctx.restore();
    }

    /*
     * =========================================================
     * DEBUG GRID
     * =========================================================
     */

    _renderDebugGrid() {
        if (!this.camera) {
            return;
        }

        const ctx = this.ctx;

        ctx.save();

        ctx.strokeStyle =
            'rgba(255,255,255,0.08)';

        ctx.lineWidth = 1;

        const step = 100;

        const worldWidth =
            this.world?.width ||
            2400;

        const worldHeight =
            this.world?.height ||
            5190;

        for (
            let x = 0;
            x <= worldWidth;
            x += step
        ) {
            const p1 =
                this.camera.worldToScreen(
                    x,
                    0
                );

            const p2 =
                this.camera.worldToScreen(
                    x,
                    worldHeight
                );

            ctx.beginPath();

            ctx.moveTo(
                p1.x,
                p1.y
            );

            ctx.lineTo(
                p2.x,
                p2.y
            );

            ctx.stroke();
        }

        for (
            let y = 0;
            y <= worldHeight;
            y += step
        ) {
            const p1 =
                this.camera.worldToScreen(
                    0,
                    y
                );

            const p2 =
                this.camera.worldToScreen(
                    worldWidth,
                    y
                );

            ctx.beginPath();

            ctx.moveTo(
                p1.x,
                p1.y
            );

            ctx.lineTo(
                p2.x,
                p2.y
            );

            ctx.stroke();
        }

        ctx.restore();
    }

    /*
     * =========================================================
     * DESTROY
     * =========================================================
     */

    destroy() {
        window.removeEventListener(
            'resize',
            this._resizeHandler
        );

        this.backgroundImage = null;
        this.character = null;
        this.world = null;
        this.camera = null;
        this.canvas = null;
        this.ctx = null;
    }
}

export default Renderer;
