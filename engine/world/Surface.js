// ============================================================
// engine/world/Surface.js
// ASTRAWAY — vertical route surface
// ============================================================

const EPSILON = 0.000001;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function distance(a, b) {
    return Math.hypot(
        b.x - a.x,
        b.y - a.y
    );
}

function normalize(x, y) {
    const length = Math.hypot(x, y);

    if (length <= EPSILON) {
        return { x: 1, y: 0 };
    }

    return {
        x: x / length,
        y: y / length
    };
}

export class Surface {

    constructor(options = {}) {

        this.id =
            String(options.id || '');

        this.name =
            options.name ||
            this.id;

        this.width =
            Math.max(
                1,
                finite(options.width, 70)
            );

        this.normalSide =
            options.normalSide === 'right'
                ? 'right'
                : 'left';

        this.points =
            Array.isArray(options.points)
                ? options.points
                    .map(point => ({
                        x: finite(point?.x),
                        y: finite(point?.y)
                    }))
                    .filter(Boolean)
                : [];

        this.segments = [];

        this.totalLength = 0;

        this.cumulativeLengths = [];

        this.build();
    }


    build() {

        this.segments.length = 0;

        this.cumulativeLengths = [0];

        this.totalLength = 0;

        if (this.points.length < 2) {
            return;
        }

        for (
            let i = 0;
            i < this.points.length - 1;
            i++
        ) {

            const a = this.points[i];
            const b = this.points[i + 1];

            const length =
                distance(a, b);

            if (length <= EPSILON) {
                continue;
            }

            const tangent =
                normalize(
                    b.x - a.x,
                    b.y - a.y
                );

            this.segments.push({
                index: i,
                a,
                b,
                length,
                startDistance:
                    this.totalLength,
                endDistance:
                    this.totalLength + length,
                tangent
            });

            this.totalLength += length;

            this.cumulativeLengths.push(
                this.totalLength
            );
        }
    }


    getLength() {
        return this.totalLength;
    }


    getPoint(t = 0) {

        if (this.points.length === 0) {
            return {
                x: 0,
                y: 0
            };
        }

        if (this.points.length === 1) {
            return {
                x: this.points[0].x,
                y: this.points[0].y
            };
        }

        const distanceAlong =
            clamp01(t) *
            this.totalLength;

        const segment =
            this.findSegmentAtDistance(
                distanceAlong
            );

        if (!segment) {
            const last =
                this.points[
                    this.points.length - 1
                ];

            return {
                x: last.x,
                y: last.y
            };
        }

        const local =
            segment.length <= EPSILON
                ? 0
                : (
                    distanceAlong -
                    segment.startDistance
                ) / segment.length;

        return {
            x:
                segment.a.x +
                (
                    segment.b.x -
                    segment.a.x
                ) *
                local,

            y:
                segment.a.y +
                (
                    segment.b.y -
                    segment.a.y
                ) *
                local
        };
    }


    getFrame(t = 0) {

        const safeT =
            clamp01(t);

        const position =
            this.getPoint(safeT);

        if (this.segments.length === 0) {

            return {
                position,
                tangent: {
                    x: 1,
                    y: 0
                },
                normal: {
                    x: 0,
                    y: -1
                },
                t: safeT
            };
        }

        const segment =
            this.findSegmentAtDistance(
                safeT *
                this.totalLength
            );

        const tangent =
            segment
                ? segment.tangent
                : {
                    x: 1,
                    y: 0
                };

        let normal;

        if (this.normalSide === 'right') {

            normal = {
                x: tangent.y,
                y: -tangent.x
            };

        } else {

            normal = {
                x: -tangent.y,
                y: tangent.x
            };
        }

        return {
            position,
            tangent,
            normal,
            t: safeT
        };
    }


    findSegmentAtDistance(
        distanceAlong
    ) {

        if (this.segments.length === 0) {
            return null;
        }

        const d =
            Math.max(
                0,
                Math.min(
                    this.totalLength,
                    distanceAlong
                )
            );

        for (
            const segment
            of this.segments
        ) {

            if (
                d >= segment.startDistance &&
                d <= segment.endDistance
            ) {
                return segment;
            }
        }

        return this.segments[
            this.segments.length - 1
        ];
    }


    projectPoint(point) {

        if (
            !point ||
            this.segments.length === 0
        ) {
            return {
                point: this.getPoint(0),
                t: 0,
                distance: Infinity
            };
        }

        let bestPoint = null;
        let bestDistanceSq = Infinity;
        let bestDistanceAlong = 0;

        for (
            const segment
            of this.segments
        ) {

            const ax = segment.a.x;
            const ay = segment.a.y;

            const bx = segment.b.x;
            const by = segment.b.y;

            const dx = bx - ax;
            const dy = by - ay;

            const lengthSq =
                dx * dx +
                dy * dy;

            if (lengthSq <= EPSILON) {
                continue;
            }

            const px =
                point.x - ax;

            const py =
                point.y - ay;

            const projection =
                clamp01(
                    (
                        px * dx +
                        py * dy
                    ) /
                    lengthSq
                );

            const x =
                ax +
                dx *
                projection;

            const y =
                ay +
                dy *
                projection;

            const distanceSq =
                (
                    point.x - x
                ) ** 2 +
                (
                    point.y - y
                ) ** 2;

            if (
                distanceSq <
                bestDistanceSq
            ) {

                bestDistanceSq =
                    distanceSq;

                bestPoint = {
                    x,
                    y
                };

                bestDistanceAlong =
                    segment.startDistance +
                    segment.length *
                    projection;
            }
        }

        if (!bestPoint) {
            return {
                point: this.getPoint(0),
                t: 0,
                distance: Infinity
            };
        }

        return {
            point: bestPoint,

            t:
                this.totalLength > EPSILON
                    ? clamp01(
                        bestDistanceAlong /
                        this.totalLength
                    )
                    : 0,

            distance:
                Math.sqrt(
                    bestDistanceSq
                )
        };
    }


    projectT(point) {

        const projection =
            this.projectPoint(point);

        return clamp01(
            projection.t
        );
    }


    distanceToT(distanceAlong) {

        if (this.totalLength <= EPSILON) {
            return 0;
        }

        return clamp01(
            distanceAlong /
            this.totalLength
        );
    }


    tToDistance(t) {

        return (
            clamp01(t) *
            this.totalLength
        );
    }


    getMovementType(t = 0) {

        const frame =
            this.getFrame(t);

        const angle =
            Math.atan2(
                Math.abs(frame.tangent.y),
                Math.abs(frame.tangent.x)
            ) *
            180 /
            Math.PI;

        if (angle <= 20) {
            return 'WALK';
        }

        if (angle <= 55) {
            return 'CRAWL';
        }

        return 'CLIMB';
    }


    getAngleDegrees(t = 0) {

        const frame =
            this.getFrame(t);

        return (
            Math.atan2(
                Math.abs(frame.tangent.y),
                Math.abs(frame.tangent.x)
            ) *
            180 /
            Math.PI
        );
    }


    validate() {

        if (!this.id) {
            return false;
        }

        if (this.points.length < 2) {
            return false;
        }

        if (
            !Number.isFinite(
                this.totalLength
            ) ||
            this.totalLength <= 0
        ) {
            return false;
        }

        for (
            const point
            of this.points
        ) {

            if (
                !Number.isFinite(point.x) ||
                !Number.isFinite(point.y)
            ) {
                return false;
            }
        }

        return true;
    }


    snapshot() {

        return {
            id: this.id,
            name: this.name,
            width: this.width,
            normalSide: this.normalSide,
            points:
                this.points.map(
                    point => ({
                        x: point.x,
                        y: point.y
                    })
                ),
            totalLength: this.totalLength
        };
    }
}


export default Surface;


// ============================================================
// NEXT TASK:
// Подключить RouteNetwork.js к createSurfaces()/createNavigation()
// в engine/core/World.js.
// ============================================================
