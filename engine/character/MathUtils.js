// ASTRAWAY 2.0
// Character Math Utilities
// Pure math helpers. No DOM. No rendering dependencies.

export const EPSILON = 0.000001;


export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


export function clamp01(value) {
    return clamp(value, 0, 1);
}


export function lerp(a, b, t) {
    return a + (b - a) * t;
}


export function inverseLerp(a, b, value) {

    if (Math.abs(b - a) < EPSILON) {
        return 0;
    }

    return (value - a) / (b - a);
}


export function remap(
    value,
    inMin,
    inMax,
    outMin,
    outMax
) {

    const t =
        inverseLerp(
            inMin,
            inMax,
            value
        );

    return lerp(
        outMin,
        outMax,
        t
    );
}


export function smoothstep(
    edge0,
    edge1,
    value
) {

    const t =
        clamp01(
            inverseLerp(
                edge0,
                edge1,
                value
            )
        );

    return t * t * (3 - 2 * t);
}


export function smootherstep(
    edge0,
    edge1,
    value
) {

    const t =
        clamp01(
            inverseLerp(
                edge0,
                edge1,
                value
            )
        );

    return (
        t *
        t *
        t *
        (
            t *
            (t * 6 - 15) +
            10
        )
    );
}


export function damp(
    current,
    target,
    smoothing,
    dt
) {

    const factor =
        1 -
        Math.exp(
            -Math.max(0, smoothing) *
            Math.max(0, dt)
        );

    return (
        current +
        (target - current) *
        factor
    );
}


export function dampAngle(
    current,
    target,
    smoothing,
    dt
) {

    const delta =
        shortestAngleDelta(
            current,
            target
        );

    const factor =
        1 -
        Math.exp(
            -Math.max(0, smoothing) *
            Math.max(0, dt)
        );

    return normalizeAngle(
        current +
        delta * factor
    );
}


/*
 * distance()
 *
 * Поддерживает оба контракта:
 *
 * distance(x1, y1, x2, y2)
 * distance(pointA, pointB)
 */
export function distance(
    x1,
    y1,
    x2,
    y2
) {

    if (
        typeof x1 === 'object' &&
        x1 !== null &&
        typeof y1 === 'object' &&
        y1 !== null
    ) {

        const a = x1;
        const b = y1;

        x1 = a.x;
        y1 = a.y;
        x2 = b.x;
        y2 = b.y;
    }

    const dx =
        x2 - x1;

    const dy =
        y2 - y1;

    return Math.hypot(
        dx,
        dy
    );
}


/*
 * distanceSq()
 *
 * Поддерживает оба контракта:
 *
 * distanceSq(x1, y1, x2, y2)
 * distanceSq(pointA, pointB)
 */
export function distanceSq(
    x1,
    y1,
    x2,
    y2
) {

    if (
        typeof x1 === 'object' &&
        x1 !== null &&
        typeof y1 === 'object' &&
        y1 !== null
    ) {

        const a = x1;
        const b = y1;

        x1 = a.x;
        y1 = a.y;
        x2 = b.x;
        y2 = b.y;
    }

    const dx =
        x2 - x1;

    const dy =
        y2 - y1;

    return (
        dx * dx +
        dy * dy
    );
}


export function length(x, y) {
    return Math.hypot(x, y);
}


export function normalize(
    x,
    y,
    fallbackX = 1,
    fallbackY = 0
) {

    const len =
        Math.hypot(
            x,
            y
        );

    if (len < EPSILON) {

        return {
            x: fallbackX,
            y: fallbackY
        };
    }

    return {
        x: x / len,
        y: y / len
    };
}


export function dot(
    ax,
    ay,
    bx,
    by
) {

    return (
        ax * bx +
        ay * by
    );
}


export function cross(
    ax,
    ay,
    bx,
    by
) {

    return (
        ax * by -
        ay * bx
    );
}


export function add(a, b) {

    return {
        x: a.x + b.x,
        y: a.y + b.y
    };
}


export function subtract(a, b) {

    return {
        x: a.x - b.x,
        y: a.y - b.y
    };
}


export function multiply(
    vector,
    scalar
) {

    return {
        x: vector.x * scalar,
        y: vector.y * scalar
    };
}


export function copyPoint(point) {

    return {
        x: point.x,
        y: point.y
    };
}


export function lerpPoint(
    a,
    b,
    t
) {

    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t)
    };
}


export function addScaled(
    point,
    direction,
    scalar
) {

    return {
        x:
            point.x +
            direction.x * scalar,

        y:
            point.y +
            direction.y * scalar
    };
}


export function rotateVector(
    x,
    y,
    angle
) {

    const c =
        Math.cos(angle);

    const s =
        Math.sin(angle);

    return {
        x:
            x * c -
            y * s,

        y:
            x * s +
            y * c
    };
}


export function rotatePoint(
    point,
    pivot,
    angle
) {

    const dx =
        point.x -
        pivot.x;

    const dy =
        point.y -
        pivot.y;

    const rotated =
        rotateVector(
            dx,
            dy,
            angle
        );

    return {
        x:
            pivot.x +
            rotated.x,

        y:
            pivot.y +
            rotated.y
    };
}


export function angleOf(x, y) {
    return Math.atan2(y, x);
}


export function angleBetween(
    ax,
    ay,
    bx,
    by
) {

    return Math.atan2(
        cross(
            ax,
            ay,
            bx,
            by
        ),
        dot(
            ax,
            ay,
            bx,
            by
        )
    );
}


export function normalizeAngle(angle) {

    const twoPi =
        Math.PI * 2;

    let result =
        angle % twoPi;

    if (result <= -Math.PI) {
        result += twoPi;
    }

    if (result > Math.PI) {
        result -= twoPi;
    }

    return result;
}


export function shortestAngleDelta(
    from,
    to
) {

    return normalizeAngle(
        to - from
    );
}


export function angleLerp(
    from,
    to,
    t
) {

    return normalizeAngle(
        from +
        shortestAngleDelta(
            from,
            to
        ) *
        clamp01(t)
    );
}


export function pointFromAngle(
    angle,
    radius = 1
) {

    return {
        x:
            Math.cos(angle) *
            radius,

        y:
            Math.sin(angle) *
            radius
    };
}


export function projectPointOnSegment(
    point,
    a,
    b
) {

    const abx =
        b.x - a.x;

    const aby =
        b.y - a.y;

    const lengthSq =
        abx * abx +
        aby * aby;

    if (lengthSq < EPSILON) {

        return {
            x: a.x,
            y: a.y,
            t: 0
        };
    }

    const apx =
        point.x - a.x;

    const apy =
        point.y - a.y;

    const t =
        clamp01(
            (
                apx * abx +
                apy * aby
            ) /
            lengthSq
        );

    return {
        x:
            a.x +
            abx * t,

        y:
            a.y +
            aby * t,

        t
    };
}


export function distanceToSegment(
    point,
    a,
    b
) {

    const projected =
        projectPointOnSegment(
            point,
            a,
            b
        );

    return distance(
        point.x,
        point.y,
        projected.x,
        projected.y
    );
}


export function nearlyEqual(
    a,
    b,
    epsilon = 0.0001
) {

    return (
        Math.abs(a - b) <=
        epsilon
    );
}


export function nearlyEqualPoints(
    a,
    b,
    epsilon = 0.0001
) {

    return (
        nearlyEqual(
            a.x,
            b.x,
            epsilon
        ) &&
        nearlyEqual(
            a.y,
            b.y,
            epsilon
        )
    );
}


export function finite(
    value,
    fallback = 0
) {

    return Number.isFinite(value)
        ? value
        : fallback;
}


export function finitePoint(
    point,
    fallbackX = 0,
    fallbackY = 0
) {

    return {
        x:
            finite(
                point?.x,
                fallbackX
            ),

        y:
            finite(
                point?.y,
                fallbackY
            )
    };
}


export function safeHypot(
    x,
    y
) {

    const result =
        Math.hypot(
            x,
            y
        );

    return Number.isFinite(result)
        ? result
        : 0;
}


export function signNonZero(
    value,
    fallback = 1
) {

    if (value > EPSILON) {
        return 1;
    }

    if (value < -EPSILON) {
        return -1;
    }

    return fallback;
}
