// ASTRAWAY 2.0
// Analytic 2-Bone IK
// Hip -> Knee -> Ankle
//
// The solver is deliberately defensive:
// - no division by zero
// - no NaN propagation
// - target is clamped to reachable range
// - knee side remains stable
// - optional pole direction controls knee orientation

import {
    EPSILON,
    clamp,
    distance,
    finite,
    normalize,
    angleOf
} from "./MathUtils.js";


export class TwoBoneIK {

    constructor(options = {}) {

        this.minReach =
            Math.max(
                0.001,
                finite(options.minReach, 1)
            );

        this.maxReach =
            Math.max(
                this.minReach,
                finite(options.maxReach, 1000)
            );

        this.kneeSide =
            options.kneeSide === -1
                ? -1
                : 1;
    }


    solve(
        hip,
        target,
        upperLength,
        lowerLength,
        pole = null
    ) {

        const a =
            Math.max(
                0.001,
                finite(upperLength, 1)
            );

        const b =
            Math.max(
                0.001,
                finite(lowerLength, 1)
            );


        const hx = finite(hip.x);
        const hy = finite(hip.y);

        const tx = finite(target.x, hx);
        const ty = finite(target.y, hy);


        let dx = tx - hx;
        let dy = ty - hy;

        let rawDistance =
            Math.hypot(dx, dy);


        // -------------------------------------------------
        // Zero-distance protection
        // -------------------------------------------------

        if (rawDistance < EPSILON) {

            dx = 1;
            dy = 0;

            rawDistance = 0;
        }


        const direction =
            normalize(
                dx,
                dy,
                1,
                0
            );


        // -------------------------------------------------
        // Reachable range
        // -------------------------------------------------

        const minimumDistance =
            Math.max(
                this.minReach,
                Math.abs(a - b) + 0.001
            );

        const maximumDistance =
            Math.min(
                this.maxReach,
                a + b - 0.001
            );


        const d =
            clamp(
                rawDistance,
                minimumDistance,
                maximumDistance
            );


        // -------------------------------------------------
        // Reconstruct reachable target
        // -------------------------------------------------

        const solvedTarget = {

            x:
                hx +
                direction.x * d,

            y:
                hy +
                direction.y * d
        };


        // -------------------------------------------------
        // Choose knee side
        // -------------------------------------------------

        let side =
            this.kneeSide;


        if (pole) {

            const px =
                finite(pole.x, hx);

            const py =
                finite(pole.y, hy);

            const cross =
                dx * (py - hy) -
                dy * (px - hx);

            if (Math.abs(cross) > EPSILON) {

                side =
                    cross < 0
                        ? -1
                        : 1;
            }
        }


        // -------------------------------------------------
        // Law of cosines
        //
        // angle at hip between:
        // hip->target and hip->knee
        // -------------------------------------------------

        let cosHip =
            (
                a * a +
                d * d -
                b * b
            ) /
            (
                2 *
                a *
                Math.max(d, EPSILON)
            );


        cosHip =
            clamp(
                cosHip,
                -1,
                1
            );


        const hipAngle =
            Math.acos(cosHip);


        const targetAngle =
            Math.atan2(
                solvedTarget.y - hy,
                solvedTarget.x - hx
            );


        const kneeAngle =
            targetAngle +
            side * hipAngle;


        const knee = {

            x:
                hx +
                Math.cos(kneeAngle) * a,

            y:
                hy +
                Math.sin(kneeAngle) * a
        };


        // -------------------------------------------------
        // Calculate final ankle angle
        // -------------------------------------------------

        const shinAngle =
            Math.atan2(
                solvedTarget.y - knee.y,
                solvedTarget.x - knee.x
            );


        return {

            hip: {
                x: hx,
                y: hy
            },

            knee,

            ankle: solvedTarget,

            hipAngle: targetAngle,
            kneeAngle: shinAngle,

            requestedTarget: {
                x: tx,
                y: ty
            },

            solvedDistance: d,

            clamped:
                Math.abs(d - rawDistance) >
                0.001,

            reachable:
                rawDistance >= minimumDistance &&
                rawDistance <= maximumDistance
        };
    }
}


export function solveTwoBoneIK(
    hip,
    target,
    upperLength,
    lowerLength,
    pole = null,
    options = {}
) {

    const solver =
        new TwoBoneIK(options);

    return solver.solve(
        hip,
        target,
        upperLength,
        lowerLength,
        pole
    );
}


// ---------------------------------------------------------
// Skeleton integration helper
// ---------------------------------------------------------

export function applyLegIK(
    skeleton,
    hipName,
    kneeName,
    ankleName,
    target,
    pole,
    upperLength,
    lowerLength,
    options = {}
) {

    if (!skeleton) {
        throw new Error(
            "applyLegIK: skeleton is required"
        );
    }


    const hip =
        skeleton.getBone(hipName);

    const knee =
        skeleton.getBone(kneeName);

    const ankle =
        skeleton.getBone(ankleName);


    if (!hip || !knee || !ankle) {

        throw new Error(
            `applyLegIK: invalid chain ` +
            `${hipName} -> ${kneeName} -> ${ankleName}`
        );
    }


    const solver =
        new TwoBoneIK(options);


    const result =
        solver.solve(
            hip.getWorldPosition(),
            target,
            upperLength,
            lowerLength,
            pole
        );


    // -----------------------------------------------------
    // Set hip world angle
    // -----------------------------------------------------

    skeleton.setWorldBoneAngle(
        hipName,
        result.hipAngle
    );


    // -----------------------------------------------------
    // Set knee world angle
    // -----------------------------------------------------

    skeleton.setWorldBoneAngle(
        kneeName,
        result.kneeAngle
    );


    // Recalculate FK after the angular changes.
    skeleton.updateWorldTransforms();


    // -----------------------------------------------------
    // Final ankle position correction
    //
    // The ankle must reach the solved target exactly.
    // This keeps foot contact stable even after numerical
    // rounding.
    // -----------------------------------------------------

    skeleton.setWorldBonePosition(
        ankleName,
        result.ankle.x,
        result.ankle.y
    );


    skeleton.updateWorldTransforms();


    return result;
}


// ---------------------------------------------------------
// Utility for determining a stable pole point
// ---------------------------------------------------------

export function makePolePoint(
    hip,
    target,
    side = 1,
    distanceFromChain = 40
) {

    const dx =
        target.x - hip.x;

    const dy =
        target.y - hip.y;


    const dir =
        normalize(
            dx,
            dy,
            1,
            0
        );


    const normal = {

        x: -dir.y * side,

        y: dir.x * side
    };


    return {

        x:
            (hip.x + target.x) * 0.5 +
            normal.x * distanceFromChain,

        y:
            (hip.y + target.y) * 0.5 +
            normal.y * distanceFromChain
    };
}
