// ASTRAWAY 2.0
// Surface / Branch geometry
//
// A walkable surface is represented by a polyline.
// Each point has:
//   - world position
//   - tangent
//   - normal
//   - cumulative distance
//
// The character can therefore query:
//   t -> position
//   t -> tangent
//   t -> normal
//   world point -> nearest t

import {
    EPSILON,
    clamp,
    clamp01,
    distance,
    distanceSq,
    finite,
    lerp,
    normalize,
    projectPointOnSegment
} from "../character/MathUtils.js";


export class Surface {

    constructor(options = {}) {

        this.id =
            options.id ||
            `surface-${Math.random()
                .toString(36)
                .slice(2, 9)}`;


        this.name =
            options.name ||
            this.id;


        this.width =
            Math.max(
                1,
                finite(options.width, 40)
            );


        this.points = [];

        this.segments = [];

        this.totalLength = 0;


        if (
            Array.isArray(
                options.points
            )
        ) {

            this.setPoints(
                options.points
            );
        }
    }


    // -----------------------------------------------------
    // POINTS
    // -----------------------------------------------------

    setPoints(points) {

        this.points = [];

        for (const point of points) {

            if (
                !point ||
                !finite(point.x) ||
                !finite(point.y)
            ) {
                continue;
            }

            this.points.push({

                x: point.x,

                y: point.y,

                distance: 0
            });
        }


        this.rebuild();

        return this;
    }


    addPoint(x, y) {

        if (
            !finite(x) ||
            !finite(y)
        ) {
            return this;
        }


        this.points.push({

            x,

            y,

            distance: 0
        });


        this.rebuild();

        return this;
    }


    // -----------------------------------------------------
    // GEOMETRY BUILD
    // -----------------------------------------------------

    rebuild() {

        this.segments = [];

        this.totalLength = 0;


        if (this.points.length === 0) {
            return;
        }


        this.points[0].distance = 0;


        // -----------------------------------------------
        // Calculate cumulative distances
        // -----------------------------------------------

        for (
            let i = 1;
            i < this.points.length;
            i++
        ) {

            const previous =
                this.points[i - 1];

            const current =
                this.points[i];


            const segmentLength =
                distance(
                    previous,
                    current
                );


            this.totalLength +=
                segmentLength;


            current.distance =
                this.totalLength;
        }


        // -----------------------------------------------
        // Build segments
        // -----------------------------------------------

        for (
            let i = 0;
            i < this.points.length - 1;
            i++
        ) {

            const a =
                this.points[i];

            const b =
                this.points[i + 1];


            const dx =
                b.x - a.x;

            const dy =
                b.y - a.y;


            const length =
                Math.hypot(
                    dx,
                    dy
                );


            if (length < EPSILON) {
                continue;
            }


            const tangent =
                normalize(
                    dx,
                    dy,
                    1,
                    0
                );


            const normal = {

                x: -tangent.y,

                y: tangent.x
            };


            this.segments.push({

                index: i,

                a: {
                    x: a.x,
                    y: a.y
                },

                b: {
                    x: b.x,
                    y: b.y
                },

                length,

                startDistance:
                    a.distance,

                endDistance:
                    b.distance,

                tangent,

                normal
            });
        }
    }


    // -----------------------------------------------------
    // T <-> DISTANCE
    // -----------------------------------------------------

    distanceToT(distanceValue) {

        if (
            this.totalLength <= EPSILON
        ) {
            return 0;
        }


        return clamp01(
            distanceValue /
            this.totalLength
        );
    }


    tToDistance(t) {

        return (
            clamp01(t) *
            this.totalLength
        );
    }


    // -----------------------------------------------------
    // FIND SEGMENT
    // -----------------------------------------------------

    findSegmentByDistance(
        distanceValue
    ) {

        if (
            this.segments.length === 0
        ) {
            return null;
        }


        const d =
            clamp(
                finite(distanceValue, 0),
                0,
                this.totalLength
            );


        // Fast endpoint checks.

        if (
            d <=
            this.segments[0]
                .startDistance
        ) {

            return this.segments[0];
        }


        const last =
            this.segments[
                this.segments.length - 1
            ];


        if (
            d >=
            last.endDistance
        ) {

            return last;
        }


        // Binary search.

        let low = 0;

        let high =
            this.segments.length - 1;


        while (low <= high) {

            const mid =
                (low + high) >> 1;


            const segment =
                this.segments[mid];


            if (
                d >= segment.startDistance &&
                d <= segment.endDistance
            ) {

                return segment;
            }


            if (
                d <
                segment.startDistance
            ) {

                high =
                    mid - 1;
            }
            else {

                low =
                    mid + 1;
            }
        }


        return last;
    }


    // -----------------------------------------------------
    // T -> FRAME
    // -----------------------------------------------------

    getFrame(t) {

        if (
            this.segments.length === 0
        ) {

            return {

                position: {
                    x: 0,
                    y: 0
                },

                tangent: {
                    x: 1,
                    y: 0
                },

                normal: {
                    x: 0,
                    y: 1
                },

                t: 0,

                distance: 0
            };
        }


        const safeT =
            clamp01(
                finite(t, 0)
            );


        const distanceValue =
            this.tToDistance(
                safeT
            );


        const segment =
            this.findSegmentByDistance(
                distanceValue
            );


        if (!segment) {

            return {

                position: {
                    x: this.points[0].x,
                    y: this.points[0].y
                },

                tangent: {
                    x: 1,
                    y: 0
                },

                normal: {
                    x: 0,
                    y: 1
                },

                t: 0,

                distance: 0
            };
        }


        const localDistance =
            distanceValue -
            segment.startDistance;


        const segmentT =
            segment.length >
            EPSILON
                ? clamp01(
                    localDistance /
                    segment.length
                )
                : 0;


        const x =
            lerp(
                segment.a.x,
                segment.b.x,
                segmentT
            );


        const y =
            lerp(
                segment.a.y,
                segment.b.y,
                segmentT
            );


        return {

            position: {
                x,
                y
            },

            tangent: {
                x: segment.tangent.x,
                y: segment.tangent.y
            },

            normal: {
                x: segment.normal.x,
                y: segment.normal.y
            },

            t: safeT,

            distance:
                distanceValue,

            segmentIndex:
                segment.index,

            segmentT
        };
    }


    // -----------------------------------------------------
    // T -> POSITION
    // -----------------------------------------------------

    getPoint(t) {

        return this.getFrame(t).position;
    }


    // -----------------------------------------------------
    // T -> TANGENT
    // -----------------------------------------------------

    getTangent(t) {

        return this.getFrame(t).tangent;
    }


    // -----------------------------------------------------
    // T -> NORMAL
    // -----------------------------------------------------

    getNormal(t) {

        return this.getFrame(t).normal;
    }


    // -----------------------------------------------------
    // WORLD POINT -> NEAREST POINT
    // -----------------------------------------------------

    projectPoint(point) {

        if (
            !point ||
            this.segments.length === 0
        ) {

            return {

                point: {
                    x: 0,
                    y: 0
                },

                t: 0,

                distance: Infinity,

                segmentIndex: -1
            };
        }


        let best = null;

        let bestDistanceSq =
            Infinity;


        for (
            const segment
            of this.segments
        ) {

            const projected =
                projectPointOnSegment(
                    point,
                    segment.a,
                    segment.b
                );


            const dSq =
                distanceSq(
                    point,
                    projected
                );


            if (
                dSq <
                bestDistanceSq
            ) {

                bestDistanceSq =
                    dSq;


                const along =
                    distance(
                        segment.a,
                        projected
                    );


                const worldDistance =
                    segment.startDistance +
                    along;


                best = {

                    point: {
                        x: projected.x,
                        y: projected.y
                    },

                    t:
                        this.distanceToT(
                            worldDistance
                        ),

                    distance:
                        Math.sqrt(
                            dSq
                        ),

                    segmentIndex:
                        segment.index,

                    tangent: {
                        x: segment.tangent.x,
                        y: segment.tangent.y
                    },

                    normal: {
                        x: segment.normal.x,
                        y: segment.normal.y
                    }
                };
            }
        }


        return best;
    }


    projectT(point) {

        return this.projectPoint(point).t;
    }


    // -----------------------------------------------------
    // WALKABILITY
    // -----------------------------------------------------

    containsPoint(
        point,
        tolerance = null
    ) {

        if (!point) {
            return false;
        }


        const allowed =
            tolerance === null
                ? this.width * 0.5
                : Math.max(
                    0,
                    tolerance
                );


        const result =
            this.projectPoint(
                point
            );


        return (
            result.distance <=
            allowed
        );
    }


    // -----------------------------------------------------
    // NAVIGATION HELPERS
    // -----------------------------------------------------

    getLength() {

        return this.totalLength;
    }


    getStartPoint() {

        return this.getPoint(0);
    }


    getEndPoint() {

        return this.getPoint(1);
    }


    getDirectionAt(t) {

        return this.getTangent(t);
    }


    getNormalAt(t) {

        return this.getNormal(t);
    }


    // -----------------------------------------------------
    // DEBUG / VALIDATION
    // -----------------------------------------------------

    validate() {

        const errors = [];


        if (
            this.points.length <
            2
        ) {

            errors.push(
                "Surface requires at least 2 points."
            );
        }


        if (
            !finite(
                this.totalLength
            ) ||
            this.totalLength < 0
        ) {

            errors.push(
                "Invalid totalLength."
            );
        }


        for (
            const segment
            of this.segments
        ) {

            if (
                !finite(
                    segment.length
                ) ||
                segment.length <= 0
            ) {

                errors.push(
                    `Invalid segment ${segment.index}.`
                );
            }


            if (
                !finite(
                    segment.tangent.x
                ) ||
                !finite(
                    segment.tangent.y
                )
            ) {

                errors.push(
                    `Invalid tangent ${segment.index}.`
                );
            }


            if (
                !finite(
                    segment.normal.x
                ) ||
                !finite(
                    segment.normal.y
                )
            ) {

                errors.push(
                    `Invalid normal ${segment.index}.`
                );
            }
        }


        return {

            valid:
                errors.length === 0,

            errors
        };
    }
}


export default Surface;
