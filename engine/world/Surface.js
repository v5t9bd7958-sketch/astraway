// ASTRAWAY 2.0
// Surface / Branch geometry
//
// A walkable surface is represented by a polyline.
//
// The surface provides:
//   - world position
//   - continuous tangent
//   - continuous normal
//   - cumulative distance
//   - nearest-point projection
//
// IMPORTANT:
// Geometry remains a polyline.
// Frames are smoothed independently so that
// character orientation and IK do not snap
// at sharp segment boundaries.

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

        // Continuous frame data at each
        // original polyline vertex.
        this.vertexFrames = [];

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
        this.vertexFrames = [];
        this.totalLength = 0;


        if (
            this.points.length === 0
        ) {
            return;
        }


        this.points[0].distance = 0;


        // -----------------------------------------------
        // Cumulative distances
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
        // Build geometric segments
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


            if (
                length < EPSILON
            ) {
                continue;
            }


            const tangent =
                normalize(
                    dx,
                    dy,
                    1,
                    0
                );


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

                tangent
            });
        }


        this.buildVertexFrames();
    }


    // -----------------------------------------------------
    // CONTINUOUS FRAME
    // -----------------------------------------------------

    buildVertexFrames() {

        this.vertexFrames = [];


        if (
            this.points.length === 0
        ) {
            return;
        }


        /*
         * We derive a tangent for every original
         * vertex.
         *
         * Interior vertices use the direction
         * halfway between the incoming and
         * outgoing directions.
         *
         * If the directions are almost opposite,
         * averaging would approach zero and could
         * produce an unstable frame. In that case
         * we deliberately keep the incoming
         * direction.
         */


        for (
            let i = 0;
            i < this.points.length;
            i++
        ) {

            let tangent;


            // First vertex.
            if (i === 0) {

                tangent =
                    this.getSegmentTangent(
                        0
                    );
            }


            // Last vertex.
            else if (
                i ===
                this.points.length - 1
            ) {

                tangent =
                    this.getSegmentTangent(
                        this.points.length - 2
                    );
            }


            // Interior vertex.
            else {

                const incoming =
                    this.getSegmentTangent(
                        i - 1
                    );

                const outgoing =
                    this.getSegmentTangent(
                        i
                    );


                if (
                    !incoming ||
                    !outgoing
                ) {

                    tangent =
                        incoming ||
                        outgoing || {
                            x: 1,
                            y: 0
                        };
                }
                else {

                    const dot =
                        incoming.x *
                        outgoing.x +
                        incoming.y *
                        outgoing.y;


                    /*
                     * Normal case:
                     * blend both directions.
                     */
                    if (
                        dot >
                        -0.999
                    ) {

                        const blended = {

                            x:
                                incoming.x +
                                outgoing.x,

                            y:
                                incoming.y +
                                outgoing.y
                        };


                        const length =
                            Math.hypot(
                                blended.x,
                                blended.y
                            );


                        if (
                            length >
                            EPSILON
                        ) {

                            tangent =
                                normalize(
                                    blended.x,
                                    blended.y,
                                    incoming.x,
                                    incoming.y
                                );
                        }
                        else {

                            tangent =
                                incoming;
                        }
                    }

                    /*
                     * Near 180-degree reversal.
                     *
                     * Do not create a zero-length
                     * tangent. Keep the incoming
                     * direction stable.
                     */
                    else {

                        tangent =
                            incoming;
                    }
                }
            }


            tangent =
                normalize(
                    tangent.x,
                    tangent.y,
                    1,
                    0
                );


            const normal = {

                x: -tangent.y,
                y: tangent.x
            };


            this.vertexFrames.push({

                tangent: {
                    x: tangent.x,
                    y: tangent.y
                },

                normal: {
                    x: normal.x,
                    y: normal.y
                }
            });
        }
    }


    getSegmentTangent(index) {

        if (
            index < 0 ||
            index >= this.segments.length
        ) {
            return null;
        }


        const segment =
            this.segments[index];


        return {

            x: segment.tangent.x,
            y: segment.tangent.y
        };
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


        let low = 0;

        let high =
            this.segments.length - 1;


        while (
            low <= high
        ) {

            const mid =
                (low + high) >> 1;

            const segment =
                this.segments[mid];


            if (
                d >=
                    segment.startDistance &&
                d <=
                    segment.endDistance
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

            const point =
                this.points[0];

            return {

                position: {
                    x: point.x,
                    y: point.y
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
            segment.length > EPSILON
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


        /*
         * The geometric position remains
         * exactly on the original segment.
         *
         * The frame is interpolated between
         * the vertex frames surrounding that
         * segment.
         */

        const startFrame =
            this.vertexFrames[
                segment.index
            ];

        const endFrame =
            this.vertexFrames[
                segment.index + 1
            ];


        let tangent;


        if (
            startFrame &&
            endFrame
        ) {

            const blended = {

                x:
                    lerp(
                        startFrame.tangent.x,
                        endFrame.tangent.x,
                        segmentT
                    ),

                y:
                    lerp(
                        startFrame.tangent.y,
                        endFrame.tangent.y,
                        segmentT
                    )
            };


            tangent =
                normalize(
                    blended.x,
                    blended.y,
                    segment.tangent.x,
                    segment.tangent.y
                );
        }
        else {

            tangent = {

                x: segment.tangent.x,
                y: segment.tangent.y
            };
        }


        const normal = {

            x: -tangent.y,
            y: tangent.x
        };


        return {

            position: {
                x,
                y
            },

            tangent: {
                x: tangent.x,
                y: tangent.y
            },

            normal: {
                x: normal.x,
                y: normal.y
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


                const projectedT =
                    this.distanceToT(
                        worldDistance
                    );


                /*
                 * IMPORTANT:
                 *
                 * Projection still uses the
                 * exact geometric segment.
                 *
                 * But the returned tangent and
                 * normal come from getFrame(),
                 * giving callers the same smooth
                 * frame used during movement.
                 */

                const frame =
                    this.getFrame(
                        projectedT
                    );


                best = {

                    point: {
                        x: projected.x,
                        y: projected.y
                    },

                    t:
                        projectedT,

                    distance:
                        Math.sqrt(
                            dSq
                        ),

                    segmentIndex:
                        segment.index,

                    tangent: {
                        x:
                            frame.tangent.x,

                        y:
                            frame.tangent.y
                    },

                    normal: {
                        x:
                            frame.normal.x,

                        y:
                            frame.normal.y
                    }
                };
            }
        }


        return best;
    }


    projectT(point) {

        return this.projectPoint(
            point
        ).t;
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
        }


        for (
            let i = 0;
            i < this.vertexFrames.length;
            i++
        ) {

            const frame =
                this.vertexFrames[i];


            if (
                !frame ||
                !finite(
                    frame.tangent.x
                ) ||
                !finite(
                    frame.tangent.y
                )
            ) {

                errors.push(
                    `Invalid vertex tangent ${i}.`
                );
            }


            if (
                !frame ||
                !finite(
                    frame.normal.x
                ) ||
                !finite(
                    frame.normal.y
                )
            ) {

                errors.push(
                    `Invalid vertex normal ${i}.`
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
