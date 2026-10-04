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
                followSpeed: 7,
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


        this.running = false;
        this.started = false;

        this.lastTime = 0;
        this.animationFrame = null;

        this.maxDeltaTime = 0.05;

        this.onReady = null;
        this.onStart = null;
        this.onStop = null;
        this.onUpdate = null;


        this.handleResize =
            this.handleResize.bind(
                this
            );

        this.loop =
            this.loop.bind(
                this
            );


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


        this.renderer.setWorld(
            this.world
        );


        this.renderer.resize();


        this.camera.setViewport(
            this.renderer.width,
            this.renderer.height
        );


        const startTarget =
            this.world.getCameraTarget();


        this.camera.setPosition(
            startTarget.x,
            startTarget.y
        );


        /*
         * НИКАКОГО:
         *
         * background
         * navigation
         * route image
         * tree image
         * character image
         *
         * здесь больше нет.
         */


        this.started = true;


        if (
            typeof this.onReady ===
            'function'
        ) {

            this.onReady(
                this
            );
        }
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


        this.running = true;


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

            this.onStart(
                this
            );
        }
    }


    // =====================================================
    // STOP
    // =====================================================

    stop() {

        if (!this.running) {
            return;
        }


        this.running = false;


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

            this.onStop(
                this
            );
        }
    }


    // =====================================================
    // RESTART
    // =====================================================

    restart() {

        this.stop();


        this.world =
            new World();


        this.world.initialize();


        this.renderer.setWorld(
            this.world
        );


        this.camera.reset();


        const restartTarget =
            this.world.getCameraTarget();


        this.camera.setPosition(
            restartTarget.x,
            restartTarget.y
        );


        this.started = true;


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


        if (
            !Number.isFinite(dt)
        ) {

            dt = 0;
        }


        dt =
            Math.min(
                Math.max(
                    dt,
                    0
                ),
                this.maxDeltaTime
            );


        this.update(
            dt
        );


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

        this.world.update(
            dt
        );


        const cameraTarget =
            this.world.getCameraTarget();


        this.camera.follow(
            cameraTarget
        );


        this.camera.update(
            dt
        );


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
    }


    // =====================================================
    // INPUT
    // =====================================================

    handleTap() {

        /*
         * Старой навигации больше нет.
         *
         * Пока Character Lab не использует
         * tap-to-path.
         */

        return false;
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


        this.world = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;
    }
}


export default Game;
