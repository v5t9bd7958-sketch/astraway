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
         * Bounds come from Geometry-derived World
         * extents, not hard-coded legacy sizes.
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
         * Fit Character Lab into the current viewport
         * so portrait 9:16 shows the full test geometry.
         */
        this.fitCameraToLab();

        const startTarget =
            this.world.getCameraTarget();

        this.camera.setPosition(
            startTarget.x,
            startTarget.y
        );
        this.camera.snapTo(
            startTarget
        );

        this.started = true;
        if (
            typeof this.onReady ===
            'function'
        ) {
            this.onReady(this);
        }
    }

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
         * Portrait: fit full lab height.
         * Landscape / wide: keep a readable
         * character scale instead of shrinking
         * the whole scene into a thin strip.
         */
        const isPortrait =
            viewH >= viewW * 0.9;

        let zoom;

        if (isPortrait) {
            const margin = 0.88;
            zoom =
                (viewH * margin) / worldH;
        } else {
            /*
             * ~1 world unit ≈ 1 CSS px at zoom 1.
             * Character is ~80–100 units tall;
             * 1.1–1.4 is a good lab reading scale.
             */
            zoom = Math.min(
                1.35,
                (viewH * 0.55) / 100
            );
        }

        zoom = Math.max(
            0.35,
            Math.min(zoom, 2.5)
        );

        this.camera.setZoom(zoom);
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
         * После старта ещё раз центрируемся
         * на персонаже.
         */
        const target =
            this.world.getCameraTarget();
        this.camera.snapTo(
            target
        );
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
        this.running = false;
        if (
            this.animationFrame !==
            null
        ) {
            cancelAnimationFrame(
                this.animationFrame
            );
            this.animationFrame = null;
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
         * No navigation / routes / old tree state.
         */
        this.world = new World();
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
        this.fitCameraToLab();

        const target =
            this.world.getCameraTarget();
        this.camera.snapTo(target);

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
            dt = 0;
        }
        dt =
            Math.min(
                Math.max(dt, 0),
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
        const cameraTarget =
            this.world.getCameraTarget();
        this.camera.follow(
            cameraTarget
        );
        this.camera.update(dt);
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
        this.fitCameraToLab();
        if (this.world) {
            const target =
                this.world.getCameraTarget();
            this.camera.snapTo(
                target
            );
        }
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
