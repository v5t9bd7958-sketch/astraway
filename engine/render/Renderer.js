/**
 * ASTRAWAY — Character Lab Renderer
 *
 * Никакого старого мира.
 * Никакого фона.
 * Никакой навигации.
 * Никаких маршрутов.
 * Никаких фотографий.
 *
 * Renderer рисует только:
 *
 * Canvas
 *   ↓
 * Character
 *   ↓
 * Skeleton
 *
 * Вся логика движения и позы остаётся
 * внутри Character / Skeleton / Gait / IK / FBC.
 */

export class Renderer {

    constructor(canvas) {

        if (!canvas) {
            throw new Error(
                'Renderer: Canvas не передан.'
            );
        }

        this.canvas = canvas;

        this.ctx =
            canvas.getContext('2d');

        if (!this.ctx) {
            throw new Error(
                'Renderer: Canvas 2D context недоступен.'
            );
        }

        this.width = 0;
        this.height = 0;

        this.viewportW = 0;
        this.viewportH = 0;

        this.devicePixelRatio = 1;

        this.camera = null;
        this.world = null;
        this.character = null;

        this.debug = false;

        this._resizeHandler =
            () => {
                this.resize();
            };

        window.addEventListener(
            'resize',
            this._resizeHandler,
            { passive: true }
        );

        this.resize();
    }


    // =====================================================
    // RESIZE
    // =====================================================

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


    // =====================================================
    // CAMERA
    // =====================================================

    setCamera(camera) {

        this.camera = camera;

        if (this.camera) {

            this.camera.setViewport(
                this.width,
                this.height
            );
        }
    }


    // =====================================================
    // WORLD
    // =====================================================

    setWorld(world) {

        this.world = world;

        this.character =
            world &&
            typeof world.getCharacter === 'function'
                ? world.getCharacter()
                : null;
    }


    // =====================================================
    // DEBUG
    // =====================================================

    setDebug(enabled) {

        /*
         * Старого debug-world больше нет.
         *
         * Флаг оставляем совместимым
         * с Game/main.js.
         */

        this.debug =
            Boolean(enabled);

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


    // =====================================================
    // CLEAR
    // =====================================================

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

        /*
         * Чистый нейтральный фон.
         *
         * Это НЕ изображение и НЕ игровой фон.
         */
        ctx.fillStyle = '#050505';

        ctx.fillRect(
            0,
            0,
            this.viewportW,
            this.viewportH
        );
    }


    // =====================================================
    // MAIN RENDER
    // =====================================================

    render(
        world = null,
        camera = null
    ) {

        if (world) {
            this.setWorld(world);
        }

        if (camera) {
            this.setCamera(camera);
        }

        this.clear();

        if (!this.camera) {
            return;
        }

        if (
            !this.character &&
            this.world &&
            typeof this.world.getCharacter === 'function'
        ) {

            this.character =
                this.world.getCharacter();
        }

        this.renderCharacter();
    }


    // =====================================================
    // CHARACTER
    // =====================================================

    renderCharacter() {

        const character =
            this.character;

        if (
            !character ||
            !character.skeleton
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
         * -------------------------------------------------
         * World → Screen
         * -------------------------------------------------
         */

        const worldToScreen =
            (
                x,
                y
            ) => {

                if (
                    this.camera &&
                    typeof this.camera.worldToScreen ===
                        'function'
                ) {

                    return this.camera.worldToScreen(
                        x,
                        y
                    );
                }

                return {
                    x:
                        this.viewportW * 0.5 +
                        x,

                    y:
                        this.viewportH * 0.5 +
                        y
                };
            };


        /*
         * -------------------------------------------------
         * Bone
         * -------------------------------------------------
         */

        const drawBone =
            bone => {

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
                    worldToScreen(
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

                const length =
                    Math.max(
                        0,
                        bone.length *
                        scale
                    );

                const end =
                    worldToScreen(

                        bone.worldX +
                        Math.cos(
                            bone.worldAngle
                        ) *
                        length,

                        bone.worldY +
                        Math.sin(
                            bone.worldAngle
                        ) *
                        length
                    );


                let width = 5;

                switch (bone.role) {

                    case 'pelvis':
                    case 'chest':
                    case 'spine':
                        width = 7;
                        break;

                    case 'head':
                        width = 8;
                        break;

                    case 'limb':
                        width = 5;
                        break;

                    default:
                        width = 4;
                }


                ctx.save();

                ctx.lineCap =
                    'round';

                ctx.lineJoin =
                    'round';

                ctx.strokeStyle =
                    '#d8d8d8';

                ctx.lineWidth =
                    width;

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
         * -------------------------------------------------
         * Joint
         * -------------------------------------------------
         */

        const drawJoint =
            bone => {

                if (!bone) {
                    return;
                }

                if (
                    !Number.isFinite(
                        bone.worldX
                    ) ||
                    !Number.isFinite(
                        bone.worldY
                    )
                ) {
                    return;
                }

                const point =
                    worldToScreen(
                        bone.worldX,
                        bone.worldY
                    );

                let radius = 4;

                if (
                    bone.role === 'head'
                ) {
                    radius = 7;
                }

                if (
                    bone.role === 'pelvis'
                ) {
                    radius = 6;
                }

                ctx.save();

                ctx.fillStyle =
                    '#f0f0f0';

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
         * -------------------------------------------------
         * Все кости.
         *
         * Renderer ничего не знает
         * о конкретной анатомии.
         *
         * Skeleton сам является источником истины.
         * -------------------------------------------------
         */

        const bones =
            Array.from(
                skeleton.bones.values()
            );

        for (
            const bone
            of bones
        ) {

            drawBone(
                bone
            );
        }


        /*
         * Сначала кости,
         * затем суставы.
         */

        for (
            const bone
            of bones
        ) {

            drawJoint(
                bone
            );
        }
    }


    // =====================================================
    // DESTROY
    // =====================================================

    destroy() {

        window.removeEventListener(
            'resize',
            this._resizeHandler
        );

        this.camera = null;
        this.world = null;
        this.character = null;
        this.canvas = null;
        this.ctx = null;
    }
}


export default Renderer;
