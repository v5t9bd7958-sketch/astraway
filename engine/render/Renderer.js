import { finite } from "../character/MathUtils.js";


export class Renderer {

    constructor(canvas, options = {}) {

        if (!canvas) {
            throw new Error(
                "Renderer: canvas is required"
            );
        }

        this.canvas = canvas;

        this.ctx =
            canvas.getContext("2d", {
                alpha: false,
                desynchronized: true
            });

        if (!this.ctx) {
            throw new Error(
                "Renderer: Canvas 2D context unavailable"
            );
        }

        this.width = 1;
        this.height = 1;

        this.devicePixelRatio =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );

        this.backgroundImage = null;

        this.backgroundLoaded = false;

        this.backgroundPath =
            options.backgroundPath ||
            "./assets/background.jpg .jpeg";

        this.characterColor =
            options.characterColor ||
            "#d7d0c2";

        this.characterDark =
            options.characterDark ||
            "#302b29";

        this.surfaceColor =
            options.surfaceColor ||
            "rgba(255,255,255,0.08)";

        this.debug = false;

        this.resizeObserver = null;

        this.resize(
            window.innerWidth,
            window.innerHeight
        );

        this.loadBackground(
            this.backgroundPath
        );

        this.installResizeObserver();
    }


    installResizeObserver() {

        if (
            typeof ResizeObserver === "undefined"
        ) {
            return;
        }

        this.resizeObserver =
            new ResizeObserver(
                entries => {

                    const entry =
                        entries[0];

                    if (!entry) {
                        return;
                    }

                    const rect =
                        entry.contentRect;

                    this.resize(
                        rect.width,
                        rect.height
                    );
                }
            );

        this.resizeObserver.observe(
            this.canvas
        );
    }


    resize(width, height) {

        width =
            Math.max(
                1,
                Number(width) || 1
            );

        height =
            Math.max(
                1,
                Number(height) || 1
            );

        this.width = width;
        this.height = height;

        this.devicePixelRatio =
            Math.min(
                window.devicePixelRatio || 1,
                2
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

        this.canvas.style.width =
            `${width}px`;

        this.canvas.style.height =
            `${height}px`;

        this.ctx.setTransform(
            this.devicePixelRatio,
            0,
            0,
            this.devicePixelRatio,
            0,
            0
        );

        this.ctx.imageSmoothingEnabled = true;
    }


    loadBackground(path) {

        if (!path) {
            return;
        }

        const image =
            new Image();

        image.onload = () => {

            this.backgroundImage =
                image;

            this.backgroundLoaded =
                true;
        };

        image.onerror = () => {

            this.backgroundImage = null;

            this.backgroundLoaded =
                false;
        };

        image.src = path;
    }


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

        this.ctx.fillStyle =
            "#101010";

        this.ctx.fillRect(
            0,
            0,
            this.width,
            this.height
        );

        this.ctx.restore();
    }


    render(world) {

        if (!world) {
            return;
        }

        this.clear();

        const camera =
            world.camera;

        if (!camera) {
            return;
        }

        this.renderBackground(
            camera
        );

        this.renderSurfaces(
            world,
            camera
        );

        this.renderCharacter(
            world.character,
            camera
        );

        if (this.debug) {

            this.renderDebug(
                world,
                camera
            );
        }
    }


    renderBackground(camera) {

        if (
            !this.backgroundLoaded ||
            !this.backgroundImage
        ) {
            return;
        }

        const image =
            this.backgroundImage;

        const visible =
            camera.getVisibleWorldRect();

        const imageWidth =
            image.naturalWidth ||
            image.width;

        const imageHeight =
            image.naturalHeight ||
            image.height;

        if (
            imageWidth <= 0 ||
            imageHeight <= 0
        ) {
            return;
        }

        /*
         * Фон пока работает как одна мировая плоскость.
         *
         * На следующем визуальном этапе он будет разделён
         * на четыре параллакс-слоя.
         */

        const scale =
            Math.max(
                visible.maxX - visible.minX,
                visible.maxY - visible.minY
            ) /
            Math.max(
                imageWidth,
                imageHeight
            );

        const drawWidth =
            imageWidth * scale;

        const drawHeight =
            imageHeight * scale;

        const centerX =
            (
                visible.minX +
                visible.maxX
            ) / 2;

        const centerY =
            (
                visible.minY +
                visible.maxY
            ) / 2;

        const topLeftWorldX =
            centerX -
            drawWidth / 2;

        const topLeftWorldY =
            centerY -
            drawHeight / 2;

        const topLeftScreen =
            camera.worldToScreen({
                x: topLeftWorldX,
                y: topLeftWorldY
            });

        this.ctx.drawImage(
            image,
            topLeftScreen.x,
            topLeftScreen.y,
            drawWidth *
                camera.zoom,
            drawHeight *
                camera.zoom
        );
    }


    renderSurfaces(world, camera) {

        if (
            !world.surfaces ||
            !Array.isArray(world.surfaces)
        ) {
            return;
        }

        if (!this.debug) {
            return;
        }

        this.ctx.save();

        this.ctx.lineWidth = 2;

        this.ctx.strokeStyle =
            this.surfaceColor;

        for (
            const surface
            of world.surfaces
        ) {

            if (
                !surface ||
                !Array.isArray(surface.points)
            ) {
                continue;
            }

            if (surface.points.length < 2) {
                continue;
            }

            this.ctx.beginPath();

            for (
                let i = 0;
                i < surface.points.length;
                i++
            ) {

                const point =
                    surface.points[i];

                const screen =
                    camera.worldToScreen(
                        point
                    );

                if (i === 0) {

                    this.ctx.moveTo(
                        screen.x,
                        screen.y
                    );

                } else {

                    this.ctx.lineTo(
                        screen.x,
                        screen.y
                    );
                }
            }

            this.ctx.stroke();
        }

        this.ctx.restore();
    }


    renderCharacter(
        character,
        camera
    ) {

        if (!character) {
            return;
        }

        const skeleton =
            character.skeleton;

        if (!skeleton) {
            return;
        }

        const bones =
            skeleton.bones;

        if (!bones) {
            return;
        }

        this.ctx.save();

        this.ctx.lineCap =
            "round";

        this.ctx.lineJoin =
            "round";

        /*
         * Сначала рисуем тело.
         */

        this.drawBone(
            bones.pelvis,
            camera,
            13
        );

        this.drawBone(
            bones.spine,
            camera,
            10
        );

        this.drawBone(
            bones.chest,
            camera,
            11
        );

        this.drawBone(
            bones.neck,
            camera,
            7
        );

        this.drawBone(
            bones.head,
            camera,
            15
        );

        /*
         * Руки.
         */

        this.drawBone(
            bones.shoulderL,
            camera,
            7
        );

        this.drawBone(
            bones.elbowL,
            camera,
            6
        );

        this.drawBone(
            bones.wristL,
            camera,
            5
        );

        this.drawBone(
            bones.handL,
            camera,
            4
        );

        this.drawBone(
            bones.shoulderR,
            camera,
            7
        );

        this.drawBone(
            bones.elbowR,
            camera,
            6
        );

        this.drawBone(
            bones.wristR,
            camera,
            5
        );

        this.drawBone(
            bones.handR,
            camera,
            4
        );

        /*
         * Ноги.
         */

        this.drawBone(
            bones.hipL,
            camera,
            8
        );

        this.drawBone(
            bones.kneeL,
            camera,
            7
        );

        this.drawBone(
            bones.ankleL,
            camera,
            5
        );

        this.drawBone(
            bones.footL,
            camera,
            6
        );

        this.drawBone(
            bones.hipR,
            camera,
            8
        );

        this.drawBone(
            bones.kneeR,
            camera,
            7
        );

        this.drawBone(
            bones.ankleR,
            camera,
            5
        );

        this.drawBone(
            bones.footR,
            camera,
            6
        );

        /*
         * Голова.
         */

        this.drawHead(
            bones.head,
            camera
        );

        /*
         * Глаза.
         */

        this.drawEye(
            bones.eyeL,
            camera
        );

        this.drawEye(
            bones.eyeR,
            camera
        );

        this.ctx.restore();
    }


    drawBone(
        bone,
        camera,
        width
    ) {

        if (!bone) {
            return;
        }

        const start =
            bone.worldStart;

        const end =
            bone.worldEnd;

        if (
            !start ||
            !end ||
            !finite(start.x) ||
            !finite(start.y) ||
            !finite(end.x) ||
            !finite(end.y)
        ) {
            return;
        }

        const a =
            camera.worldToScreen(
                start
            );

        const b =
            camera.worldToScreen(
                end
            );

        this.ctx.beginPath();

        this.ctx.strokeStyle =
            this.characterColor;

        this.ctx.lineWidth =
            width *
            camera.zoom;

        this.ctx.moveTo(
            a.x,
            a.y
        );

        this.ctx.lineTo(
            b.x,
            b.y
        );

        this.ctx.stroke();

        /*
         * Сустав.
         */

        this.ctx.fillStyle =
            this.characterColor;

        this.ctx.beginPath();

        this.ctx.arc(
            b.x,
            b.y,
            Math.max(
                2,
                width *
                camera.zoom *
                0.45
            ),
            0,
            Math.PI * 2
        );

        this.ctx.fill();
    }


    drawHead(
        bone,
        camera
    ) {

        if (!bone) {
            return;
        }

        const center =
            camera.worldToScreen(
                bone.worldStart
            );

        const radius =
            16 *
            camera.zoom;

        this.ctx.fillStyle =
            this.characterColor;

        this.ctx.beginPath();

        this.ctx.arc(
            center.x,
            center.y,
            radius,
            0,
            Math.PI * 2
        );

        this.ctx.fill();
    }


    drawEye(
        bone,
        camera
    ) {

        if (!bone) {
            return;
        }

        const point =
            camera.worldToScreen(
                bone.worldStart
            );

        const radius =
            Math.max(
                1.5,
                2.2 *
                camera.zoom
            );

        this.ctx.fillStyle =
            this.characterDark;

        this.ctx.beginPath();

        this.ctx.arc(
            point.x,
            point.y,
            radius,
            0,
            Math.PI * 2
        );

        this.ctx.fill();
    }


    renderDebug(
        world,
        camera
    ) {

        const character =
            world.character;

        if (character) {

            const position =
                character.getWorldPosition();

            const screen =
                camera.worldToScreen(
                    position
                );

            this.ctx.save();

            this.ctx.fillStyle =
                "#ffffff";

            this.ctx.beginPath();

            this.ctx.arc(
                screen.x,
                screen.y,
                3,
                0,
                Math.PI * 2
            );

            this.ctx.fill();

            this.ctx.restore();
        }


        if (
            world.navigationGraph &&
            typeof world.navigationGraph.getAllNodes ===
            "function"
        ) {

            this.renderNavigationDebug(
                world.navigationGraph,
                camera
            );
        }
    }


    renderNavigationDebug(
        graph,
        camera
    ) {

        const nodes =
            graph.getAllNodes();

        this.ctx.save();

        for (const node of nodes) {

            if (!node || !node.position) {
                continue;
            }

            const point =
                camera.worldToScreen(
                    node.position
                );

            this.ctx.fillStyle =
                "#ffcc00";

            this.ctx.beginPath();

            this.ctx.arc(
                point.x,
                point.y,
                5,
                0,
                Math.PI * 2
            );

            this.ctx.fill();
        }

        this.ctx.restore();
    }


    setDebug(enabled) {

        this.debug =
            Boolean(enabled);
    }


    toggleDebug() {

        this.debug =
            !this.debug;

        return this.debug;
    }


    destroy() {

        if (this.resizeObserver) {

            this.resizeObserver.disconnect();

            this.resizeObserver = null;
        }

        this.backgroundImage = null;

        this.backgroundLoaded = false;
    }
}


export default Renderer;
