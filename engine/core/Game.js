import { World } from './World.js';
import { Camera } from '../camera/Camera.js';
import { Renderer } from '../render/Renderer.js';


export class Game {

    constructor(options = {}) {

        this.canvas = options.canvas ?? null;

        if (!this.canvas) {
            throw new Error('ASTRAWAY: canvas не передан в Game.');
        }


        this.world = options.world ?? new World();

        this.camera = options.camera ?? new Camera({
            followSpeed: 7,
            zoom: 1
        });


        this.renderer = options.renderer ?? new Renderer(
            this.canvas
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

        this.handleResize = this.handleResize.bind(this);
        this.loop = this.loop.bind(this);

        window.addEventListener(
            'resize',
            this.handleResize,
            { passive: true }
        );
    }


    initialize() {

        if (this.started) {
            return;
        }


        this.world.initialize();


        this.renderer.resize();


        this.camera.setViewport(
            this.renderer.width,
            this.renderer.height
        );


        this.camera.setWorldBounds({
            minX: 0,
            minY: 0,
            maxX: this.world.width,
            maxY: this.world.height
        });


        this.camera.setPosition(
            this.world.getCameraTarget()
        );


        this.renderer.loadBackground()
            .catch(() => {
                // Отсутствие изображения не должно ломать игровой цикл.
            });


        this.started = true;


        if (typeof this.onReady === 'function') {
            this.onReady(this);
        }
    }


    start() {

        if (!this.started) {
            this.initialize();
        }


        if (this.running) {
            return;
        }


        this.world.start();

        this.running = true;

        this.lastTime = performance.now();

        this.animationFrame =
            requestAnimationFrame(this.loop);


        if (typeof this.onStart === 'function') {
            this.onStart(this);
        }
    }


    stop() {

        if (!this.running) {
            return;
        }


        this.running = false;


        if (this.animationFrame !== null) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame = null;
        }


        this.world.stop();


        if (typeof this.onStop === 'function') {
            this.onStop(this);
        }
    }


    restart() {

        this.stop();

        this.world = new World();

        this.world.initialize();


        this.camera.reset(
            this.world.getCameraTarget()
        );


        this.started = true;

        this.start();
    }


    loop(timestamp) {

        if (!this.running) {
            return;
        }


        let dt =
            (timestamp - this.lastTime) / 1000;


        this.lastTime = timestamp;


        if (!Number.isFinite(dt)) {
            dt = 0;
        }


        dt = Math.min(
            Math.max(dt, 0),
            this.maxDeltaTime
        );


        this.update(dt);
        this.render();


        this.animationFrame =
            requestAnimationFrame(this.loop);
    }


    update(dt) {

        this.world.update(dt);


        const cameraTarget =
            this.world.getCameraTarget();


        this.camera.follow(
            cameraTarget
        );


        this.camera.update(dt);


        if (typeof this.onUpdate === 'function') {
            this.onUpdate(dt, this);
        }
    }


    render() {

        this.renderer.render(
            this.world,
            this.camera
        );
    }


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


    handleTap(worldPoint) {

        return this.world.handleTap(
            worldPoint
        );
    }


    setDebug(enabled) {

        this.renderer.setDebug(
            enabled
        );
    }


    toggleDebug() {

        return this.renderer.toggleDebug();
    }


    getWorld() {

        return this.world;
    }


    getCamera() {

        return this.camera;
    }


    getRenderer() {

        return this.renderer;
    }


    validate() {

        const worldResult =
            this.world.validate();


        return {
            valid: worldResult.valid,
            errors: worldResult.errors
        };
    }


    destroy() {

        this.stop();


        window.removeEventListener(
            'resize',
            this.handleResize
        );


        if (
            this.renderer &&
            typeof this.renderer.destroy === 'function'
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
