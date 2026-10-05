import {
    CHARACTER_LAB_IMAGE
} from "../../character-lab/geometry-source.js";


export class Renderer {

    constructor(canvas) {

        if (!canvas) {
            throw new Error(
                "Renderer: Canvas не передан."
            );
        }

        this.canvas =
            canvas;

        this.ctx =
            canvas.getContext("2d");

        if (!this.ctx) {
            throw new Error(
                "Renderer: Canvas 2D context недоступен."
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

        /*
         * CHARACTER LAB BACKGROUND
         *
         * Изображение является только визуальным слоем.
         * Геометрия из Geometry.js не рисует мир,
         * а используется логикой персонажа.
         */

        this.backgroundImage =
            new Image();

        this.backgroundImageLoaded =
            false;

        this.backgroundImage.onerror =
            () => {

                this.backgroundImageLoaded =
                    false;

                this.render();
            };

        this.backgroundImage.onload =
            () => {

                this.backgroundImageLoaded =
                    true;

                this.render();
            };

        this.backgroundImage.src =
            new URL(
                "../../character-lab/IMG_2597.jpeg",
                import.meta.url
            ).href;


        this._resizeHandler =
            () => this.resize();

        window.addEventListener(
            "resize",
            this._resizeHandler,
            { passive: true }
        );

        this.resize();
    }


    resize() {

        const rect =
            this.canvas
                .getBoundingClientRect();

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


    setCamera(camera) {

        this.camera =
            camera;

        if (camera) {

            camera.setViewport(
                this.width,
                this.height
            );
        }
    }


    setWorld(world) {

        this.world =
            world;

        this.character =
            world?.getCharacter?.() ??
            null;
    }


    setDebug(enabled) {

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

        ctx.fillStyle =
            "#050505";

        ctx.fillRect(
            0,
            0,
            this.viewportW,
            this.viewportH
        );
    }


    worldToScreen(x, y) {

        if (
            this.camera &&
            typeof this.camera.worldToScreen ===
                "function"
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
    }


    drawPolyline(
        points,
        close = false
    ) {

        if (
            !points ||
            points.length === 0
        ) {
            return;
        }

        const ctx =
            this.ctx;

        ctx.beginPath();

        points.forEach(
            (
                point,
                index
            ) => {

                const screen =
                    this.worldToScreen(
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

        if (close) {
            ctx.closePath();
        }

        ctx.stroke();
    }


    /*
     * Рисует исходную фотографию Character Lab.
     *
     * ВАЖНО:
     *
     * Геометрия фотографии задана в пикселях.
     * Geometry.pixelToWorld() переводит эти координаты
     * в ту же мировую систему, которую использует персонаж.
     *
     * Поэтому изображение и collision-геометрия
     * должны совпадать независимо от масштаба камеры.
     */

    drawBackground() {

        if (
            !this.backgroundImageLoaded ||
            !this.world ||
            !this.camera
        ) {
            return;
        }

        const geometry =
            this.world.getGeometry?.();

        if (!geometry) {
            return;
        }

        if (
            typeof geometry.pixelToWorld !==
            "function"
        ) {
            return;
        }

        const imageWidth =
            CHARACTER_LAB_IMAGE.width;

        const imageHeight =
            CHARACTER_LAB_IMAGE.height;


        const topLeft =
            geometry.pixelToWorld({
                x: 0,
                y: 0
            });

        const bottomRight =
            geometry.pixelToWorld({
                x: imageWidth,
                y: imageHeight
            });


        const screenTopLeft =
            this.worldToScreen(
                topLeft.x,
                topLeft.y
            );

        const screenBottomRight =
            this.worldToScreen(
                bottomRight.x,
                bottomRight.y
            );


        const width =
            screenBottomRight.x -
            screenTopLeft.x;

        const height =
            screenBottomRight.y -
            screenTopLeft.y;


        if (
            !Number.isFinite(
                screenTopLeft.x
            ) ||
            !Number.isFinite(
                screenTopLeft.y
            ) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width === 0 ||
            height === 0
        ) {
            return;
        }


        const ctx =
            this.ctx;

        ctx.save();

        ctx.imageSmoothingEnabled =
            true;

        ctx.drawImage(
            this.backgroundImage,
            screenTopLeft.x,
            screenTopLeft.y,
            width,
            height
        );

        ctx.restore();
    }


    /*
     * Технический debug-overlay.
     *
     * Эти линии НЕ являются игровым фоном.
     * Они показываются только при debug=true.
     */

    drawGeometry() {

        const geometry =
            this.world?.getGeometry?.();

        if (!geometry) {
            return;
        }

        const ctx =
            this.ctx;

        ctx.save();

        ctx.lineCap =
            "round";

        ctx.lineJoin =
            "round";


        /*
         * GROUND
         */

        ctx.lineWidth =
            3;

        ctx.strokeStyle =
            "#7f8cff";

        this.drawPolyline(
            geometry
                .getGround()
                .points
        );


        /*
         * HILL
         */

        ctx.strokeStyle =
            "#5f6d80";

        this.drawPolyline(
            geometry
                .getHill()
                .points
        );


        /*
         * STEPS
         */

        ctx.strokeStyle =
            "#b7b7b7";

        for (
            const step
            of geometry.getSteps()
        ) {

            this.drawPolyline(
                step.points,
                true
            );
        }


        /*
         * LADDER
         */

        const ladder =
            geometry.getLadder();

        ctx.strokeStyle =
            "#c8a36a";

        this.drawPolyline(
            ladder.leftRail
        );

        this.drawPolyline(
            ladder.rightRail
        );


        /*
         * BEAM
         */

        const beam =
            geometry.getBeam();

        ctx.strokeStyle =
            "#d6b078";

        this.drawPolyline(
            beam.points,
            true
        );


        /*
         * ROPE
         */

        const rope =
            geometry.getRope();

        ctx.strokeStyle =
            "#d8d8d8";

        this.drawPolyline(
            rope.points
        );

        ctx.restore();
    }


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


        /*
         * 1. Реальный фон Character Lab
         */

        this.drawBackground();


        /*
         * 2. Техническая геометрия —
         *    только в debug-режиме.
         */

        if (this.debug) {

            this.drawGeometry();
        }


        /*
         * 3. Персонаж поверх фона.
         */

        this.renderCharacter();
    }


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
                "function"
        ) {
            return;
        }

        const ctx =
            this.ctx;


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
                    this.worldToScreen(
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
                    this.worldToScreen(
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

                let width =
                    5;

                if (
                    bone.role === "pelvis" ||
                    bone.role === "chest" ||
                    bone.role === "spine"
                ) {

                    width = 7;

                } else if (
                    bone.role === "head"
                ) {

                    width = 8;
                }

                ctx.save();

                ctx.lineCap =
                    "round";

                ctx.lineJoin =
                    "round";

                ctx.strokeStyle =
                    "#d8d8d8";

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
                    this.worldToScreen(
                        bone.worldX,
                        bone.worldY
                    );

                let radius =
                    4;

                if (
                    bone.role === "head"
                ) {

                    radius = 7;

                } else if (
                    bone.role === "pelvis"
                ) {

                    radius = 6;
                }

                ctx.save();

                ctx.fillStyle =
                    "#f0f0f0";

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


        for (
            const bone
            of bones
        ) {

            drawJoint(
                bone
            );
        }
    }


    destroy() {

        window.removeEventListener(
            "resize",
            this._resizeHandler
        );

        if (this.backgroundImage) {

            this.backgroundImage.onload =
                null;

            this.backgroundImage.onerror =
                null;

            this.backgroundImage.src =
                "";
        }

        this.backgroundImage =
            null;

        this.camera = null;
        this.world = null;
        this.character = null;
        this.canvas = null;
        this.ctx = null;
    }
}


export default Renderer;
