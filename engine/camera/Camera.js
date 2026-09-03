/**
 * Camera.js
 *
 * Canvas 2D камера для ASTRAWAY.
 *
 * Координатная система:
 *   worldX → screenX
 *   worldY → screenY
 *
 * Никаких перестановок X/Y и поворотов мира.
 *
 * Совместима с Game.js:
 *   new Camera({ followSpeed, zoom })
 *   camera.setWorldBounds(...)
 *   camera.setViewport(...)
 *   camera.follow(...)
 *   camera.update(...)
 *   camera.worldToScreen(...)
 *   camera.screenToWorld(...)
 */

export class Camera {

    constructor(options = {}) {

        this.worldWidth = 1600;
        this.worldHeight = 5190;

        this.x = this.worldWidth / 2;
        this.y = this.worldHeight / 2;

        this.targetX = this.x;
        this.targetY = this.y;

        this.zoom = Number.isFinite(options.zoom)
            ? options.zoom
            : 1;

        this.followSpeed = Number.isFinite(options.followSpeed)
            ? Math.max(0.01, options.followSpeed)
            : 7;

        // Совместимость со старым API.
        this.smoothing = Number.isFinite(options.smoothing)
            ? Math.max(0.01, options.smoothing)
            : this.followSpeed;

        this.viewportW = 0;
        this.viewportH = 0;

        this.minX = 0;
        this.maxX = this.worldWidth;

        this.minY = 0;
        this.maxY = this.worldHeight;
    }


    // --------------------------------------------------
    // WORLD BOUNDS
    // --------------------------------------------------

    setWorldBounds(
        width,
        height
    ) {

        if (
            Number.isFinite(width) &&
            width > 0
        ) {
            this.worldWidth = width;
        }

        if (
            Number.isFinite(height) &&
            height > 0
        ) {
            this.worldHeight = height;
        }

        this.minX = 0;
        this.maxX = this.worldWidth;

        this.minY = 0;
        this.maxY = this.worldHeight;

        this.x = this.clampX(this.x);
        this.y = this.clampY(this.y);

        this.targetX = this.clampX(this.targetX);
        this.targetY = this.clampY(this.targetY);
    }


    // --------------------------------------------------
    // VIEWPORT
    // --------------------------------------------------

    setViewport(
        width,
        height
    ) {

        if (
            Number.isFinite(width) &&
            width >= 0
        ) {
            this.viewportW = width;
        }

        if (
            Number.isFinite(height) &&
            height >= 0
        ) {
            this.viewportH = height;
        }

        this.x = this.clampX(this.x);
        this.y = this.clampY(this.y);
    }


    // --------------------------------------------------
    // FOLLOW
    // --------------------------------------------------

    follow(worldPos) {

        if (
            !worldPos ||
            !Number.isFinite(worldPos.x) ||
            !Number.isFinite(worldPos.y)
        ) {
            return;
        }

        this.targetX = worldPos.x;
        this.targetY = worldPos.y;
    }


    // --------------------------------------------------
    // UPDATE
    // --------------------------------------------------

    update(dt) {

        if (
            !Number.isFinite(dt) ||
            dt <= 0
        ) {
            return;
        }

        const speed = Math.max(
            0.01,
            this.followSpeed
        );

        const factor =
            1 - Math.exp(-speed * dt);

        this.x +=
            (this.targetX - this.x) *
            factor;

        this.y +=
            (this.targetY - this.y) *
            factor;

        this.x = this.clampX(this.x);
        this.y = this.clampY(this.y);
    }


    // --------------------------------------------------
    // WORLD → SCREEN
    // --------------------------------------------------

    worldToScreen(
        wx,
        wy
    ) {

        const safeX = Number.isFinite(wx)
            ? wx
            : 0;

        const safeY = Number.isFinite(wy)
            ? wy
            : 0;

        return {

            x:
                (safeX - this.x) *
                this.zoom +
                this.viewportW / 2,

            y:
                (safeY - this.y) *
                this.zoom +
                this.viewportH / 2
        };
    }


    // --------------------------------------------------
    // SCREEN → WORLD
    //
    // Принимает:
    //   screenToWorld(x, y)
    //
    // И одновременно:
    //   screenToWorld({ x, y })
    //
    // Это важно для текущего InputController.
    // --------------------------------------------------

    screenToWorld(
        sx,
        sy
    ) {

        let screenX = sx;
        let screenY = sy;

        if (
            sx &&
            typeof sx === 'object'
        ) {

            screenX = sx.x;
            screenY = sx.y;
        }

        if (
            !Number.isFinite(screenX) ||
            !Number.isFinite(screenY)
        ) {

            return {
                x: this.x,
                y: this.y
            };
        }

        return {

            x:
                (screenX - this.viewportW / 2) /
                this.zoom +
                this.x,

            y:
                (screenY - this.viewportH / 2) /
                this.zoom +
                this.y
        };
    }


    // --------------------------------------------------
    // SNAP
    // --------------------------------------------------

    snapTo(worldPos) {

        if (
            !worldPos ||
            !Number.isFinite(worldPos.x) ||
            !Number.isFinite(worldPos.y)
        ) {
            return;
        }

        this.x = this.clampX(worldPos.x);
        this.y = this.clampY(worldPos.y);

        this.targetX = this.x;
        this.targetY = this.y;
    }


    // --------------------------------------------------
    // ZOOM
    // --------------------------------------------------

    setZoom(zoom) {

        if (
            !Number.isFinite(zoom) ||
            zoom <= 0
        ) {
            return;
        }

        this.zoom = zoom;

        this.x = this.clampX(this.x);
        this.y = this.clampY(this.y);
    }


    // --------------------------------------------------
    // INTERNAL CLAMP
    // --------------------------------------------------

    clampX(value) {

        const halfWorldViewport =
            this.viewportW > 0
                ? this.viewportW / (2 * this.zoom)
                : 0;

        const min =
            this.minX +
            Math.min(
                halfWorldViewport,
                this.worldWidth / 2
            );

        const max =
            this.maxX -
            Math.min(
                halfWorldViewport,
                this.worldWidth / 2
            );

        if (min > max) {
            return this.worldWidth / 2;
        }

        return Math.max(
            min,
            Math.min(max, value)
        );
    }


    clampY(value) {

        const halfWorldViewport =
            this.viewportH > 0
                ? this.viewportH / (2 * this.zoom)
                : 0;

        const min =
            this.minY +
            Math.min(
                halfWorldViewport,
                this.worldHeight / 2
            );

        const max =
            this.maxY -
            Math.min(
                halfWorldViewport,
                this.worldHeight / 2
            );

        if (min > max) {
            return this.worldHeight / 2;
        }

        return Math.max(
            min,
            Math.min(max, value)
        );
    }
}
