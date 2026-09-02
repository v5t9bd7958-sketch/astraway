import { finitePoint } from "../character/MathUtils.js";


export class InputController {

    constructor(canvas, camera, options = {}) {

        if (!canvas) {
            throw new Error(
                "InputController: canvas is required"
            );
        }

        if (!camera) {
            throw new Error(
                "InputController: camera is required"
            );
        }

        this.canvas = canvas;

        this.camera = camera;

        this.enabled = true;

        this.onTap =
            typeof options.onTap === "function"
                ? options.onTap
                : null;

        this.onPointerDown =
            typeof options.onPointerDown === "function"
                ? options.onPointerDown
                : null;

        this.onPointerUp =
            typeof options.onPointerUp === "function"
                ? options.onPointerUp
                : null;

        this.pointer = {
            id: null,
            down: false,
            startX: 0,
            startY: 0,
            x: 0,
            y: 0
        };

        this.tapThreshold =
            Number.isFinite(options.tapThreshold)
                ? Math.max(0, options.tapThreshold)
                : 12;

        this.install();
    }


    install() {

        this.handlePointerDownBound =
            event =>
                this.handlePointerDown(event);

        this.handlePointerUpBound =
            event =>
                this.handlePointerUp(event);

        this.handlePointerCancelBound =
            event =>
                this.handlePointerCancel(event);

        this.handleContextMenuBound =
            event =>
                event.preventDefault();

        this.canvas.addEventListener(
            "pointerdown",
            this.handlePointerDownBound,
            {
                passive: false
            }
        );

        this.canvas.addEventListener(
            "pointerup",
            this.handlePointerUpBound,
            {
                passive: false
            }
        );

        this.canvas.addEventListener(
            "pointercancel",
            this.handlePointerCancelBound,
            {
                passive: false
            }
        );

        this.canvas.addEventListener(
            "contextmenu",
            this.handleContextMenuBound
        );
    }


    handlePointerDown(event) {

        if (!this.enabled) {
            return;
        }

        if (
            event.pointerType === "mouse" &&
            event.button !== 0
        ) {
            return;
        }

        event.preventDefault();

        const point =
            this.getCanvasPoint(event);

        if (!point) {
            return;
        }

        this.pointer.id =
            event.pointerId;

        this.pointer.down = true;

        this.pointer.startX =
            point.x;

        this.pointer.startY =
            point.y;

        this.pointer.x =
            point.x;

        this.pointer.y =
            point.y;

        try {

            this.canvas.setPointerCapture(
                event.pointerId
            );

        } catch (_) {
            // Некоторые WebView могут не поддерживать capture.
        }

        if (this.onPointerDown) {

            this.onPointerDown({
                screen: {
                    x: point.x,
                    y: point.y
                },

                world:
                    this.camera.screenToWorld(
                        point
                    ),

                event
            });
        }
    }


    handlePointerUp(event) {

        if (!this.enabled) {
            return;
        }

        if (!this.pointer.down) {
            return;
        }

        if (
            this.pointer.id !==
            event.pointerId
        ) {
            return;
        }

        event.preventDefault();

        const point =
            this.getCanvasPoint(event);

        if (!point) {

            this.resetPointer();

            return;
        }

        this.pointer.x =
            point.x;

        this.pointer.y =
            point.y;

        const dx =
            point.x -
            this.pointer.startX;

        const dy =
            point.y -
            this.pointer.startY;

        const movement =
            Math.hypot(dx, dy);

        const isTap =
            movement <=
            this.tapThreshold;

        if (isTap) {

            const world =
                this.camera.screenToWorld(
                    point
                );

            if (
                finitePoint(world) &&
                this.onTap
            ) {

                this.onTap({
                    screen: {
                        x: point.x,
                        y: point.y
                    },

                    world: {
                        x: world.x,
                        y: world.y
                    },

                    event
                });
            }
        }

        if (this.onPointerUp) {

            const world =
                this.camera.screenToWorld(
                    point
                );

            this.onPointerUp({
                screen: {
                    x: point.x,
                    y: point.y
                },

                world: {
                    x: world.x,
                    y: world.y
                },

                movement,

                isTap,

                event
            });
        }

        this.resetPointer();
    }


    handlePointerCancel(event) {

        if (
            this.pointer.id ===
            event.pointerId
        ) {

            this.resetPointer();
        }
    }


    getCanvasPoint(event) {

        const rect =
            this.canvas.getBoundingClientRect();

        if (
            !rect ||
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return null;
        }

        const x =
            event.clientX -
            rect.left;

        const y =
            event.clientY -
            rect.top;

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return null;
        }

        return {
            x,
            y
        };
    }


    resetPointer() {

        this.pointer.id = null;

        this.pointer.down = false;

        this.pointer.startX = 0;
        this.pointer.startY = 0;

        this.pointer.x = 0;
        this.pointer.y = 0;
    }


    setEnabled(enabled) {

        this.enabled =
            Boolean(enabled);

        if (!this.enabled) {
            this.resetPointer();
        }
    }


    isEnabled() {

        return this.enabled;
    }


    setTapThreshold(value) {

        if (!Number.isFinite(value)) {
            return;
        }

        this.tapThreshold =
            Math.max(0, value);
    }


    destroy() {

        this.canvas.removeEventListener(
            "pointerdown",
            this.handlePointerDownBound
        );

        this.canvas.removeEventListener(
            "pointerup",
            this.handlePointerUpBound
        );

        this.canvas.removeEventListener(
            "pointercancel",
            this.handlePointerCancelBound
        );

        this.canvas.removeEventListener(
            "contextmenu",
            this.handleContextMenuBound
        );

        this.resetPointer();
    }
}


export default InputController;
