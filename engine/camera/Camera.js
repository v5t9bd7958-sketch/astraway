/**
 * Camera.js
 * Canvas 2D camera for ASTRAWAY.
 *
 * X остаётся X.
 * Y остаётся Y.
 * Никаких перестановок осей и поворотов мира.
 */

export class Camera {

    constructor(options = {}) {

        this.worldWidth =
            Number.isFinite(options.worldWidth)
                ? options.worldWidth
                : 1600;

        this.worldHeight =
            Number.isFinite(options.worldHeight)
                ? options.worldHeight
                : 1000;

        this.zoom =
            Number.isFinite(options.zoom) && options.zoom > 0
                ? options.zoom
                : 1;

        this.followSpeed =
            Number.isFinite(options.followSpeed)
                ? Math.max(0.01, options.followSpeed)
                : 7;

        this.smoothing =
            Number.isFinite(options.smoothing)
                ? Math.max(0.01, options.smoothing)
                : this.followSpeed;

        this.viewportW = 0;
        this.viewportH = 0;

        this.minX = 0;
        this.maxX = this.worldWidth;

        this.minY = 0;
        this.maxY = this.worldHeight;

        this.x = this.worldWidth / 2;
        this.y = this.worldHeight / 2;

        this.targetX = this.x;
        this.targetY = this.y;
    }


    setWorldBounds(widthOrBounds, height) {

        if (
            widthOrBounds &&
            typeof widthOrBounds === 'object'
        ) {

            const bounds = widthOrBounds;

            if (
                Number.isFinite(bounds.minX) &&
                Number.isFinite(bounds.maxX)
            ) {

                this.minX = bounds.minX;
                this.maxX = bounds.maxX;
                this.worldWidth =
                    bounds.maxX - bounds.minX;

            } else if (
                Number.isFinite(bounds.width)
            ) {

                this.minX = 0;
                this.maxX = bounds.width;
                this.worldWidth = bounds.width;
            }


            if (
                Number.isFinite(bounds.minY) &&
                Number.isFinite(bounds.maxY)
            ) {

                this.minY = bounds.minY;
                this.maxY = bounds.maxY;
                this.worldHeight =
                    bounds.maxY - bounds.minY;

            } else if (
                Number.isFinite(bounds.height)
            ) {

                this.minY = 0;
                this.maxY = bounds.height;
                this.worldHeight = bounds.height;
            }

        } else {

            if (
                Number.isFinite(widthOrBounds) &&
                widthOrBounds > 0
            ) {

                this.worldWidth =
                    widthOrBounds;
            }

            if (
                Number.isFinite(height) &&
                height > 0
            ) {

                this.worldHeight =
                    height;
            }

            this.minX = 0;
            this.maxX = this.worldWidth;

            this.minY = 0;
            this.maxY = this.worldHeight;
        }


        this.x = this.clampX(this.x);
        this.y = this.clampY(this.y);

        this.targetX = this.clampX(this.targetX);
        this.targetY = this.clampY(this.targetY);
    }


    setViewport(width, height) {

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


    setPosition(x, y) {

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {

            return;
        }

        this.x = this.clampX(x);
        this.y = this.clampY(y);

        this.targetX = this.x;
        this.targetY = this.y;
    }


    reset() {

        this.x =
            this.clampX(
                this.worldWidth / 2
            );

        this.y =
            this.clampY(
                this.worldHeight / 2
            );

        this.targetX = this.x;
        this.targetY = this.y;
    }


    snapTo(worldPos) {

        if (
            !worldPos ||
            !Number.isFinite(worldPos.x) ||
            !Number.isFinite(worldPos.y)
        ) {

            return;
        }

        this.setPosition(
            worldPos.x,
            worldPos.y
        );
    }


    follow(worldPos) {

        if (
            !worldPos ||
            !Number.isFinite(worldPos.x) ||
            !Number.isFinite(worldPos.y)
        ) {

            return;
        }

        this.targetX =
            this.clampX(worldPos.x);

        this.targetY =
            this.clampY(worldPos.y);
    }


    update(dt) {

        if (
            !Number.isFinite(dt) ||
            dt <= 0
        ) {

            return;
        }

        const factor =
            1 -
            Math.exp(
                -this.followSpeed * dt
            );

        this.x +=
            (this.targetX - this.x) *
            factor;

        this.y +=
            (this.targetY - this.y) *
            factor;

        this.x = this.clampX(this.x);
        this.y = this.clampY(this.y);
    }


    worldToScreen(wx, wy) {

        const x =
            Number.isFinite(wx)
                ? wx
                : 0;

        const y =
            Number.isFinite(wy)
                ? wy
                : 0;

        return {

            x:
                (x - this.x) *
                this.zoom +
                this.viewportW / 2,

            y:
                (y - this.y) *
                this.zoom +
                this.viewportH / 2
        };
    }


    screenToWorld(sx, sy) {

        let x = sx;
        let y = sy;

        if (
            sx &&
            typeof sx === 'object'
        ) {

            x = sx.x;
            y = sx.y;
        }

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {

            return {
                x: this.x,
                y: this.y
            };
        }

        return {

            x:
                (x - this.viewportW / 2) /
                this.zoom +
                this.x,

            y:
                (y - this.viewportH / 2) /
                this.zoom +
                this.y
        };
    }


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


    clampX(value) {

        const halfViewport =
            this.viewportW > 0
                ? this.viewportW /
                  (2 * this.zoom)
                : 0;

        const span =
            Math.min(
                halfViewport,
                this.worldWidth / 2
            );

        const min =
            this.minX + span;

        const max =
            this.maxX - span;

        if (min > max) {

            return (
                this.minX +
                this.maxX
            ) / 2;
        }

        return Math.max(
            min,
            Math.min(
                max,
                Number.isFinite(value)
                    ? value
                    : min
            )
        );
    }


    clampY(value) {

        const halfViewport =
            this.viewportH > 0
                ? this.viewportH /
                  (2 * this.zoom)
                : 0;

        const span =
            Math.min(
                halfViewport,
                this.worldHeight / 2
            );

        const min =
            this.minY + span;

        const max =
            this.maxY - span;

        if (min > max) {

            return (
                this.minY +
                this.maxY
            ) / 2;
        }

        return Math.max(
            min,
            Math.min(
                max,
                Number.isFinite(value)
                    ? value
                    : min
            )
        );
    }
}


export default Camera;
