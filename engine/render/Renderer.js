/**
 * ASTRAWAY
 * Renderer.js
 *
 * Canvas 2D renderer.
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

    setDebug(enabled) {
        this.debug = Boolean(enabled);

        if (this.gameState) {
            this.gameState.debugMode =
                this.debug;
        }

        this.render();
    }

    toggleDebug() {
        this.setDebug(!this.debug);

        return this.debug;
    }

    isDebugEnabled() {
        return this.debug;
    }

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

        if (this.isDebugEnabled()) {
            this._renderSurfaces();
            this._renderNavigation();
            this._renderWorldBounds();
        }

        this._renderCharacter();

        if (this.isDebugEnabled()) {
            this._renderDebugGrid();
        }
    }

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

        const world = this.world;

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

    _renderCharacter() {
        const character =
            this.character;

        if (
            !character ||
            !character.position ||
            !character.skeleton ||
            !this.camera
        ) {
            return;
        }

        const skeleton =
            character.skeleton;

        const ctx = this.ctx;

        if (
            !skeleton.bones ||
            typeof skeleton.bones.values !==
                'function'
        ) {
            return;
        }

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

        const drawSegment =
            (
                parentName,
                childName,
                width,
                alpha = 1
            ) => {
                const parent =
                    getBone(
                        parentName
                    );

                const child =
                    getBone(
                        childName
                    );

                if (
                    !parent ||
                    !child
                ) {
                    return;
                }

                const a =
                    getScreenPoint(
                        parent
                    );

                const b =
                    getScreenPoint(
                        child
                    );

                if (
                    !a ||
                    !b
                ) {
                    return;
                }

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
                    a.x,
                    a.y
                );

                ctx.lineTo(
                    b.x,
                    b.y
                );

                ctx.stroke();

                ctx.restore();
            };

        const drawJoint =
            (
                name,
                radius
            ) => {
                const b =
                    getBone(name);

                const p =
                    getScreenPoint(b);

                if (!p) {
                    return;
                }

                ctx.save();

                ctx.fillStyle =
                    'rgba(40,44,56,0.98)';

                ctx.beginPath();

                ctx.arc(
                    p.x,
                    p.y,
                    radius,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.restore();
            };

        /*
         * Ноги.
         *
         * Здесь особенно хорошо
         * видно работу Gait + IK.
         */

        drawSegment(
            'hipL',
            'kneeL',
            10
        );

        drawSegment(
            'kneeL',
            'ankleL',
            9
        );

        drawSegment(
            'ankleL',
            'footL',
            8
        );

        drawSegment(
            'hipR',
            'kneeR',
            10
        );

        drawSegment(
            'kneeR',
            'ankleR',
            9
        );

        drawSegment(
            'ankleR',
            'footR',
            8
        );

        /*
         * Корпус.
         */

        drawSegment(
            'pelvis',
            'spine',
            15
        );

        drawSegment(
            'spine',
            'chest',
            16
        );

        drawSegment(
            'chest',
            'neck',
            12
        );

        /*
         * Левая рука.
         */

        drawSegment(
            'shoulderL',
            'elbowL',
            8
        );

        drawSegment(
            'elbowL',
            'wristL',
            7
        );

        drawSegment(
            'wristL',
            'handL',
            6
        );

        /*
         * Правая рука.
         */

        drawSegment(
            'shoulderR',
            'elbowR',
            8
        );

        drawSegment(
            'elbowR',
            'wristR',
            7
        );

        drawSegment(
            'wristR',
            'handR',
            6
        );

        /*
         * Суставы.
         */

        [
            ['pelvis', 10],

            ['shoulderL', 6],
            ['elbowL', 5],
            ['wristL', 4],

            ['shoulderR', 6],
            ['elbowR', 5],
            ['wristR', 4],

            ['hipL', 6],
            ['kneeL', 6],
            ['ankleL', 5],

            ['hipR', 6],
            ['kneeR', 6],
            ['ankleR', 5]
        ].forEach(
            ([name, radius]) => {
                drawJoint(
                    name,
                    radius
                );
            }
        );

        /*
         * Голова.
         */

        const head =
            getBone('head');

        const neck =
            getScreenPoint(
                getBone('neck')
            );

        if (
            head &&
            neck
        ) {
            const hp =
                getScreenPoint(
                    head
                );

            if (hp) {
                ctx.save();

                ctx.fillStyle =
                    'rgba(28,31,40,0.98)';

                ctx.beginPath();

                ctx.arc(
                    hp.x,
                    hp.y,
                    Math.max(
                        15,
                        head.length *
                        head.worldScale *
                        0.42
                    ),
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.strokeStyle =
                    'rgba(180,190,210,0.65)';

                ctx.lineWidth = 2;

                ctx.stroke();

                ctx.restore();

                /*
                 * Глаза используют
                 * реальные eye bones.
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
        }
    }

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

        for (
            let x = 0;
            x <= (
                this.world?.width ||
                2400
            );
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
                    this.world?.height ||
                    5190
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
            y <= (
                this.world?.height ||
                5190
            );
            y += step
        ) {
            const p1 =
                this.camera.worldToScreen(
                    0,
                    y
                );

            const p2 =
                this.camera.worldToScreen(
                    this.world?.width ||
                    2400,
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
