import {
    clamp,
    damp,
    lerp,
    finitePoint
} from "../character/MathUtils.js";


export class Camera {

    constructor(options = {}) {

        this.position = {
            x: Number(options.x) || 0,
            y: Number(options.y) || 0
        };

        this.target = {
            x: this.position.x,
            y: this.position.y
        };

        this.offset = {
            x: Number(options.offsetX) || 0,
            y: Number(options.offsetY) || 0
        };

        this.followSpeed =
            Number.isFinite(options.followSpeed)
                ? Math.max(0, options.followSpeed)
                : 7;

        this.zoom =
            Number.isFinite(options.zoom)
                ? Math.max(0.1, options.zoom)
                : 1;

        this.minZoom =
            Number.isFinite(options.minZoom)
                ? Math.max(0.1, options.minZoom)
                : 0.5;

        this.maxZoom =
            Number.isFinite(options.maxZoom)
                ? Math.max(this.minZoom, options.maxZoom)
                : 2.5;

        this.viewport = {
            width: 1,
            height: 1
        };

        this.worldBounds = null;

        this.enabled = true;
    }


    setViewport(width, height) {

        this.viewport.width =
            Math.max(1, Number(width) || 1);

        this.viewport.height =
            Math.max(1, Number(height) || 1);
    }


    setPosition(x, y) {

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return;
        }

        this.position.x = x;
        this.position.y = y;

        this.target.x = x;
        this.target.y = y;

        this.clampToBounds();
    }


    setTarget(x, y) {

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return;
        }

        this.target.x = x;
        this.target.y = y;
    }


    follow(point, immediate = false) {

        if (!finitePoint(point)) {
            return;
        }

        this.target.x =
            point.x + this.offset.x;

        this.target.y =
            point.y + this.offset.y;

        if (immediate) {

            this.position.x = this.target.x;
            this.position.y = this.target.y;

            this.clampToBounds();
        }
    }


    setOffset(x, y) {

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return;
        }

        this.offset.x = x;
        this.offset.y = y;
    }


    setZoom(value) {

        if (!Number.isFinite(value)) {
            return;
        }

        this.zoom =
            clamp(
                value,
                this.minZoom,
                this.maxZoom
            );
    }


    zoomBy(delta) {

        if (!Number.isFinite(delta)) {
            return;
        }

        this.setZoom(
            this.zoom + delta
        );
    }


    setWorldBounds(bounds) {

        if (!bounds) {

            this.worldBounds = null;

            return;
        }

        const minX =
            Number.isFinite(bounds.minX)
                ? bounds.minX
                : -Infinity;

        const maxX =
            Number.isFinite(bounds.maxX)
                ? bounds.maxX
                : Infinity;

        const minY =
            Number.isFinite(bounds.minY)
                ? bounds.minY
                : -Infinity;

        const maxY =
            Number.isFinite(bounds.maxY)
                ? bounds.maxY
                : Infinity;

        this.worldBounds = {
            minX: Math.min(minX, maxX),
            maxX: Math.max(minX, maxX),
            minY: Math.min(minY, maxY),
            maxY: Math.max(minY, maxY)
        };

        this.clampToBounds();
    }


    clearWorldBounds() {

        this.worldBounds = null;
    }


    clampToBounds() {

        if (!this.worldBounds) {
            return;
        }

        const halfWidth =
            this.viewport.width /
            (2 * this.zoom);

        const halfHeight =
            this.viewport.height /
            (2 * this.zoom);

        const bounds =
            this.worldBounds;

        if (
            Number.isFinite(bounds.minX) &&
            Number.isFinite(bounds.maxX)
        ) {

            const minCameraX =
                bounds.minX + halfWidth;

            const maxCameraX =
                bounds.maxX - halfWidth;

            if (
                minCameraX <= maxCameraX
            ) {

                this.position.x =
                    clamp(
                        this.position.x,
                        minCameraX,
                        maxCameraX
                    );
            } else {

                this.position.x =
                    (bounds.minX + bounds.maxX) / 2;
            }
        }

        if (
            Number.isFinite(bounds.minY) &&
            Number.isFinite(bounds.maxY)
        ) {

            const minCameraY =
                bounds.minY + halfHeight;

            const maxCameraY =
                bounds.maxY - halfHeight;

            if (
                minCameraY <= maxCameraY
            ) {

                this.position.y =
                    clamp(
                        this.position.y,
                        minCameraY,
                        maxCameraY
                    );
            } else {

                this.position.y =
                    (bounds.minY + bounds.maxY) / 2;
            }
        }
    }


    update(dt) {

        if (!this.enabled) {
            return;
        }

        if (
            !Number.isFinite(dt) ||
            dt <= 0
        ) {
            return;
        }

        const smoothing =
            1 -
            Math.exp(
                -this.followSpeed * dt
            );

        this.position.x =
            lerp(
                this.position.x,
                this.target.x,
                smoothing
            );

        this.position.y =
            lerp(
                this.position.y,
                this.target.y,
                smoothing
            );

        this.clampToBounds();
    }


    worldToScreen(point) {

        if (!finitePoint(point)) {
            return {
                x: 0,
                y: 0
            };
        }

        return {
            x:
                (
                    point.x -
                    this.position.x
                ) *
                this.zoom +
                this.viewport.width / 2,

            y:
                (
                    point.y -
                    this.position.y
                ) *
                this.zoom +
                this.viewport.height / 2
        };
    }


    screenToWorld(point) {

        if (!finitePoint(point)) {
            return {
                x: this.position.x,
                y: this.position.y
            };
        }

        return {
            x:
                (
                    point.x -
                    this.viewport.width / 2
                ) /
                this.zoom +
                this.position.x,

            y:
                (
                    point.y -
                    this.viewport.height / 2
                ) /
                this.zoom +
                this.position.y
        };
    }


    getVisibleWorldRect() {

        const halfWidth =
            this.viewport.width /
            (2 * this.zoom);

        const halfHeight =
            this.viewport.height /
            (2 * this.zoom);

        return {
            minX:
                this.position.x -
                halfWidth,

            maxX:
                this.position.x +
                halfWidth,

            minY:
                this.position.y -
                halfHeight,

            maxY:
                this.position.y +
                halfHeight
        };
    }


    getPosition() {

        return {
            x: this.position.x,
            y: this.position.y
        };
    }


    getTarget() {

        return {
            x: this.target.x,
            y: this.target.y
        };
    }


    getZoom() {

        return this.zoom;
    }


    reset() {

        this.position.x = 0;
        this.position.y = 0;

        this.target.x = 0;
        this.target.y = 0;

        this.zoom = 1;

        this.offset.x = 0;
        this.offset.y = 0;

        this.worldBounds = null;
    }


    validate() {

        return (
            Number.isFinite(this.position.x) &&
            Number.isFinite(this.position.y) &&
            Number.isFinite(this.target.x) &&
            Number.isFinite(this.target.y) &&
            Number.isFinite(this.zoom) &&
            this.zoom > 0
        );
    }
}


export default Camera;
