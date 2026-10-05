/**
 * ASTRAWAY — Game
 *
 * Чистый Character Lab.
 *
 * Никакого:
 * - background
 * - дерева
 * - navigation
 * - routes
 * - старой сетки
 * - старых изображений
 */

import { World } from './World.js';
import { Camera } from '../camera/Camera.js';
import { Renderer } from '../render/Renderer.js';


export class Game {

    constructor(options = {}) {

        this.canvas =
            options.canvas ?? null;

        if (!this.canvas) {

            throw new Error(
                'ASTRAWAY: canvas не передан в Game.'
            );
        }


        this.world =
            options.world ??
            new World();


        this.camera =
            options.camera ??
            new Camera({

                followSpeed: 12,

                zoom: 1
            });


        this.renderer =
            options.renderer ??
            new Renderer(
                this.canvas
            );


        this.renderer.setCamera(
            this.camera
        );


        this.running =
            false;

        this.started =
            false;

        this.lastTime =
            0;

        this.animationFrame =
            null;

        this.maxDeltaTime =
            0.05;


        this.onReady =
            null;

        this.onStart =
            null;

        this.onStop =
            null;

        this.onUpdate =
            null;


        this.handleResize =
            this.handleResize.bind(this);

        this.loop =
            this.loop.bind(this);


        window.addEventListener(
            'resize',
            this.handleResize,
            { passive: true }
        );
    }


    // =====================================================
    // INITIALIZE
    // =====================================================

    initialize() {

        if (this.started) {
            return;
        }


        this.world.initialize();


        /*
         * Bounds come directly from World.
         */
        const minX =
            Number.isFinite(this.world.minX)
                ? this.world.minX
                : -226.5;

        const maxX =
            Number.isFinite(this.world.maxX)
                ? this.world.maxX
                : 226.5;

        const minY =
            Number.isFinite(this.world.minY)
                ? this.world.minY
                : -500;

        const maxY =
            Number.isFinite(this.world.maxY)
                ? this.world.maxY
                : 40;


        this.camera.setWorldBounds({

            minX,

            maxX,

            minY,

            maxY
        });


        this.renderer.setWorld(
            this.world
        );


        this.renderer.resize();


        this.camera.setViewport(
            this.renderer.width,
            this.renderer.height
        );


        /*
         * IMPORTANT:
         *
         * First calculate the correct framing
         * for the entire Character Lab.
         */
        this.fitCameraToLab();


        /*
         * DO NOT snap the camera to the character here.
         *
         * The Character Lab is a visual test arena.
         * Its initial framing must remain the framing
         * calculated above.
         */


        this.started =
            true;


        if (
            typeof this.onReady ===
            'function'
        ) {

            this.onReady(this);
        }
    }


    // =====================================================
    // CAMERA FIT
    // =====================================================

    fitCameraToLab() {

        const viewW =
            this.camera.viewportW || 1;

        const viewH =
            this.camera.viewportH || 1;


        const worldW =
            Math.max(
                1,
                this.camera.worldWidth
            );

        const worldH =
            Math.max(
                1,
                this.camera.worldHeight
            );


        /*
         * Character Lab is designed primarily
         * for portrait 9:16.
         *
         * Fit the complete lab vertically.
         */
        const isPortrait =
            viewH >= viewW * 0.9;


        let zoom;


        if (isPortrait) {

            const margin =
                0.88;

            zoom =
                (
                    viewH *
                    margin
                ) /
                worldH;

        } else {

            zoom =
                Math.min(
                    1.35,
                    (
                        viewH *
                        0.55
                    ) /
                    100
                );
        }


        zoom =
            Math.max(
                0.35,
                Math.min(
                    zoom,
                    2.5
                )
            );


        this.camera.setZoom(
            zoom
        );


        /*
         * Centre the camera on the COMPLETE
         * calculated world bounds.
         *
         * This is the critical part.
         *
         * The image itself is included in World bounds,
         * therefore this centre includes the full photo.
         */
        const centerX =
            (
                this.camera.minX +
                this.camera.maxX
            ) / 2;

        const centerY =
            (
                this.camera.minY +
                this.camera.maxY
            ) / 2;


        this.camera.setPosition(
            centerX,
            centerY
        );


        /*
         * Lock the initial target to the same
         * framing so the next update() does not
         * immediately pull the camera to the character.
         */
        this.camera.targetX =
            centerX;

        this.camera.targetY =
            centerY;
    }


    // =====================================================
    // START
    // =====================================================

    start() {

        if (!this.started) {

            this.initialize();
        }


        if (this.running) {
            return;
        }


        this.world.start();


        /*
         * IMPORTANT:
         *
         * Do NOT snap camera to character here.
         *
         * Character Lab starts with the full-lab framing.
         */


        this.running =
            true;


        this.lastTime =
            performance.now();


        this.animationFrame =
            requestAnimationFrame(
                this.loop
            );


        if (
            typeof this.onStart ===
            'function'
        ) {

            this.onStart(this);
        }
    }


    // =====================================================
    // STOP
    // =====================================================

    stop() {

        if (!this.running) {
            return;
        }


        this.running =
            false;


        if (
            this.animationFrame !==
            null
        ) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame =
                null;
        }


        this.world.stop();


        if (
            typeof this.onStop ===
            'function'
        ) {

            this.onStop(this);
        }
    }


    // =====================================================
    // RESTART
    // =====================================================

    restart() {

        this.stop();


        /*
         * Rebuild a clean Character Lab world.
         */
        this.world =
            new World();


        this.world.initialize();


        this.renderer.setWorld(
            this.world
        );


        const minX =
            Number.isFinite(this.world.minX)
                ? this.world.minX
                : -226.5;

        const maxX =
            Number.isFinite(this.world.maxX)
                ? this.world.maxX
                : 226.5;

        const minY =
            Number.isFinite(this.world.minY)
                ? this.world.minY
                : -500;

        const maxY =
            Number.isFinite(this.world.maxY)
                ? this.world.maxY
                : 40;


        this.camera.setWorldBounds({

            minX,

            maxX,

            minY,

            maxY
        });


        this.renderer.resize();


        this.camera.setViewport(
            this.renderer.width,
            this.renderer.height
        );


        /*
         * Recalculate full-lab framing.
         */
        this.fitCameraToLab();


        this.start();
    }


    // =====================================================
    // LOOP
    // =====================================================

    loop(timestamp) {

        if (!this.running) {
            return;
        }


        let dt =
            (
                timestamp -
                this.lastTime
            ) / 1000;


        this.lastTime =
            timestamp;


        if (!Number.isFinite(dt)) {

            dt =
                0;
        }


        dt =
            Math.min(
                Math.max(
                    dt,
                    0
                ),
                this.maxDeltaTime
            );


        this.update(dt);

        this.render();


        this.animationFrame =
            requestAnimationFrame(
                this.loop
            );
    }


    // =====================================================
    // UPDATE
    // =====================================================

    update(dt) {

        this.world.update(dt);


        /*
         * Character Lab camera is intentionally
         * NOT following the character yet.
         *
         * This is a test-arena framing.
         *
         * Later, when the perception/planning/
         * movement architecture is ready, camera
         * following becomes its own explicit system.
         */


        if (
            typeof this.onUpdate ===
            'function'
        ) {

            this.onUpdate(
                dt,
                this
            );
        }
    }


    // =====================================================
    // RENDER
    // =====================================================

    render() {

        this.renderer.render(
            this.world,
            this.camera
        );
    }


    // =====================================================
    // RESIZE
    // =====================================================

    handleResize() {

        if (!this.renderer) {
            return;
        }


        this.renderer.resize();


        this.camera.setViewport(
            this.renderer.width,
            this.renderer.height
        );


        /*
         * Recalculate the complete lab framing
         * after every viewport change.
         */
        this.fitCameraToLab();
    }


    // =====================================================
    // DEBUG
    // =====================================================

    setDebug(enabled) {

        this.renderer.setDebug(
            enabled
        );
    }


    toggleDebug() {

        return this.renderer.toggleDebug();
    }


    // =====================================================
    // GETTERS
    // =====================================================

    getWorld() {

        return this.world;
    }


    getCamera() {

        return this.camera;
    }


    getRenderer() {

        return this.renderer;
    }


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        const result =
            this.world.validate();


        return {

            valid:
                result.valid,

            errors:
                result.errors
        };
    }


    // =====================================================
    // DESTROY
    // =====================================================

    destroy() {

        this.stop();


        window.removeEventListener(
            'resize',
            this.handleResize
        );


        if (
            this.renderer &&
            typeof this.renderer.destroy ===
            'function'
        ) {

            this.renderer.destroy();
        }


        this.world =
            null;

        this.camera =
            null;

        this.renderer =
            null;

        this.canvas =
            null;
    }
}


export default Game;
