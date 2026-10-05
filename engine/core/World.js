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
         * World bounds intentionally cover
         * the whole current Character Lab,
         * including the beam above the character.
         */
        this.width = 413;

        this.height = 920;

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

        this.startT =
            options.startT ??
            0.5;

        this.started =
            false;

        this.initialized =
            false;
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
