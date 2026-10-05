import { Character } from "../character/Character.js";
import Geometry from "./Geometry.js";


/*
 * Минимальный compatibility adapter.
 *
 * Это НЕ старый Surface.js.
 *
 * Он существует только потому, что текущий
 * Character ещё ожидает surface.getPoint()
 * и surface.getFrame().
 *
 * Позже этот контракт будет заменён
 * Contact Provider / Perception.
 */
class GroundSurface {

    constructor(points) {

        this.id =
            "character_lab_ground";

        this.name =
            "Character Lab Ground";

        this.points =
            points;
    }

    getPoint(t = 0.5) {

        const a =
            this.points[0];

        const b =
            this.points[1];

        const clamped =
            Math.max(
                0,
                Math.min(
                    1,
                    t
                )
            );

        return {
            x:
                a.x +
                (b.x - a.x) *
                clamped,

            y:
                a.y +
                (b.y - a.y) *
                clamped
        };
    }

    getFrame(t = 0.5) {

        const position =
            this.getPoint(t);

        const a =
            this.points[0];

        const b =
            this.points[1];

        const dx =
            b.x - a.x;

        const dy =
            b.y - a.y;

        const length =
            Math.hypot(
                dx,
                dy
            ) || 1;

        const tangent = {
            x:
                dx / length,

            y:
                dy / length
        };

        const normal = {
            x:
                -tangent.y,

            y:
                tangent.x
        };

        return {
            position,

            tangent,

            normal,

            angle:
                Math.atan2(
                    tangent.y,
                    tangent.x
                ),

            t:
                Math.max(
                    0,
                    Math.min(
                        1,
                        t
                    )
                )
        };
    }

    validate() {

        return (
            this.points.length === 2 &&
            this.points.every(
                point =>
                    Number.isFinite(
                        point.x
                    ) &&
                    Number.isFinite(
                        point.y
                    )
            )
        );
    }

    snapshot() {

        return {
            id:
                this.id,

            name:
                this.name,

            points:
                this.points.map(
                    point => ({
                        ...point
                    })
                )
        };
    }
}


export class World {

    constructor(options = {}) {

        this.geometry =
            new Geometry();

        this.ground =
            new GroundSurface(
                this.geometry
                    .getGround()
                    .points
            );

        /*
         * Bounds are derived from Character Lab geometry
         * (pixel source → world via Geometry), not magic numbers.
         *
         * Image 826×1372, PPU=2:
         *   X ≈ [-206.5 … +206.5]
         *   Y ≈ [-460 … 0]  (beam → ground)
         *
         * Padding keeps ladder/beam/hill edges on-screen.
         */
        const bounds =
            this.computeBounds();

        this.minX = bounds.minX;
        this.maxX = bounds.maxX;
        this.minY = bounds.minY;
        this.maxY = bounds.maxY;

        this.width =
            this.maxX - this.minX;

        this.height =
            this.maxY - this.minY;

        this.surfaces =
            new Map([
                [
                    this.ground.id,
                    this.ground
                ]
            ]);

        this.character =
            new Character({

                x: 0,

                y: 0,

                speed:
                    options.characterSpeed ??
                    120,

                turnSpeed:
                    options.turnSpeed ??
                    8,

                lookTurnSpeed:
                    options.lookTurnSpeed ??
                    10
            });

        /*
         * Place character near image centre (world X ≈ 0)
         * so the lab reads correctly under a portrait camera.
         * Ground spans ≈ [-206.5 … 8.5] → t ≈ 0.96.
         */
        this.startT =
            options.startT ??
            0.96;

        this.started =
            false;

        this.initialized =
            false;
    }


    computeBounds() {

        const geometry =
            this.geometry;

        const points = [];

        const pushPoints =
            list => {
                if (!Array.isArray(list)) {
                    return;
                }
                for (const p of list) {
                    if (
                        p &&
                        Number.isFinite(p.x) &&
                        Number.isFinite(p.y)
                    ) {
                        points.push(p);
                    }
                }
            };

        pushPoints(
            geometry.getGround().points
        );
        pushPoints(
            geometry.getHill().points
        );
        for (const step of geometry.getSteps()) {
            pushPoints(step.points);
        }
        const ladder =
            geometry.getLadder();
        pushPoints(ladder.leftRail);
        pushPoints(ladder.rightRail);
        pushPoints(
            geometry.getBeam().points
        );
        pushPoints(
            geometry.getRope().points
        );

        let minX = 0;
        let maxX = 0;
        let minY = 0;
        let maxY = 0;

        if (points.length > 0) {
            minX = points[0].x;
            maxX = points[0].x;
            minY = points[0].y;
            maxY = points[0].y;

            for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
        }

        const padX = 24;
        const padY = 48;

        return {
            minX: minX - padX,
            maxX: maxX + padX,
            minY: minY - padY,
            maxY: maxY + padY
        };
    }


    initialize() {

        if (this.initialized) {
            return;
        }

        const startPoint =
            this.ground.getPoint(
                this.startT
            );

        this.character.initialize(
            startPoint,
            this.ground,
            this.startT
        );

        this.initialized =
            true;
    }


    start() {

        if (!this.initialized) {
            this.initialize();
        }

        this.started =
            true;
    }


    stop() {

        this.started =
            false;

        if (
            this.character &&
            typeof this.character.stop ===
                "function"
        ) {

            this.character.stop();
        }
    }


    update(dt) {

        if (
            !this.initialized ||
            !this.started
        ) {
            return;
        }

        this.character.update(dt);
    }


    getCharacter() {

        return this.character;
    }


    getCameraTarget() {

        return this.character
            .getWorldPosition();
    }


    getSurfaces() {

        return [
            ...this.surfaces.values()
        ];
    }


    getSurface(id) {

        return (
            this.surfaces.get(id) ??
            null
        );
    }


    getGeometry() {

        return this.geometry;
    }


    validate() {

        const errors = [];

        for (
            const surface
            of this.surfaces.values()
        ) {

            if (
                typeof surface.validate ===
                    "function" &&
                surface.validate() !== true
            ) {

                errors.push({
                    type:
                        "surface",

                    id:
                        surface.id
                });
            }
        }

        if (
            typeof this.character.validate ===
                "function"
        ) {

            const result =
                this.character.validate();

            if (!result.valid) {

                errors.push({
                    type:
                        "character",

                    details:
                        result
                });
            }
        }

        return {

            valid:
                errors.length === 0,

            errors
        };
    }


    snapshot() {

        return {

            initialized:
                this.initialized,

            started:
                this.started,

            geometry:
                this.geometry.snapshot(),

            surfaces:
                this.getSurfaces()
                    .map(
                        surface =>
                            surface.snapshot()
                    ),

            character:
                typeof this.character.getState ===
                    "function"
                    ? this.character.getState()
                    : null
        };
    }
}


export function createWorld(
    options = {}
) {

    const world =
        new World(
            options
        );

    world.initialize();

    return world;
}


export default World;
