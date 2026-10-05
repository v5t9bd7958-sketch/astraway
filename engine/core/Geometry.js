import {
    CHARACTER_LAB_IMAGE,
    CHARACTER_LAB_GEOMETRY
} from "../../character-lab/geometry-source.js";

/*
 * 2 source pixels = 1 world unit.
 *
 * Это НЕ часть source geometry.
 * Это игровая система координат.
 */
export const PIXELS_PER_WORLD_UNIT = 2;

export class Geometry {

    constructor(
        source = CHARACTER_LAB_GEOMETRY,
        image = CHARACTER_LAB_IMAGE
    ) {
        this.source = source;
        this.image = image;

        /*
         * Image center becomes world X = 0.
         *
         * Ground level becomes world Y = 0.
         */
        this.origin = {
            x: image.width / 2,
            y: source.ground.points[0].y
        };
    }

    pixelToWorld(point) {

        return {
            x:
                (point.x - this.origin.x) /
                PIXELS_PER_WORLD_UNIT,

            y:
                (point.y - this.origin.y) /
                PIXELS_PER_WORLD_UNIT
        };
    }

    pointsToWorld(points) {

        return points.map(
            point =>
                this.pixelToWorld(point)
        );
    }

    getGround() {

        return {
            ...this.source.ground,

            points:
                this.pointsToWorld(
                    this.source.ground.points
                )
        };
    }

    getHill() {

        return {
            ...this.source.hill,

            points:
                this.pointsToWorld(
                    this.source.hill.points
                )
        };
    }

    getSteps() {

        return this.source.steps.map(
            step => ({
                ...step,

                points:
                    this.pointsToWorld(
                        step.points
                    )
            })
        );
    }

    getLadder() {

        return {
            ...this.source.ladder,

            leftRail:
                this.pointsToWorld(
                    this.source.ladder.leftRail
                ),

            rightRail:
                this.pointsToWorld(
                    this.source.ladder.rightRail
                )
        };
    }

    getBeam() {

        return {
            ...this.source.beam,

            points:
                this.pointsToWorld(
                    this.source.beam.points
                )
        };
    }

    getRope() {

        return {
            ...this.source.rope,

            points:
                this.pointsToWorld(
                    this.source.rope.points
                )
        };
    }

    snapshot() {

        return {
            image: {
                ...this.image
            },

            origin: {
                ...this.origin
            },

            pixelsPerWorldUnit:
                PIXELS_PER_WORLD_UNIT,

            ground:
                this.getGround(),

            hill:
                this.getHill(),

            steps:
                this.getSteps(),

            ladder:
                this.getLadder(),

            beam:
                this.getBeam(),

            rope:
                this.getRope()
        };
    }
}

export default Geometry;
