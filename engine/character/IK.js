// ASTRAWAY 2.0
// Analytic 2-Bone IK
//
// Responsibility:
// - solve a two-bone anatomical chain mathematically
// - preserve fixed bone lengths
// - determine knee direction from a pole point
// - safely clamp unreachable targets
//
// This module does NOT:
// - modify Skeleton
// - move bones
// - perform FK
// - control gait
// - control gravity
// - control animation
//
// Character.js owns integration.
// Skeleton.js owns anatomy.


import {
    EPSILON,
    clamp,
    finite,
    normalize
} from "./MathUtils.js";


// =========================================================
// TWO-BONE IK SOLVER
// =========================================================

export function solveTwoBoneIK(
    hip,
    target,
    upperLength,
    lowerLength,
    pole = null,
    options = {}
) {

    // -----------------------------------------------------
    // Anatomical lengths
    // -----------------------------------------------------

    const upper =
        Math.max(
            0.001,
            finite(
                upperLength,
                1
            )
        );

    const lower =
        Math.max(
            0.001,
            finite(
                lowerLength,
                1
            )
        );


    // -----------------------------------------------------
    // Input positions
    // -----------------------------------------------------

    const hx =
        finite(
            hip?.x,
            0
        );

    const hy =
        finite(
            hip?.y,
            0
        );

    const tx =
        finite(
            target?.x,
            hx
        );

    const ty =
        finite(
            target?.y,
            hy
        );


    let dx =
        tx - hx;

    let dy =
        ty - hy;


    let rawDistance =
        Math.hypot(
            dx,
            dy
        );


    // -----------------------------------------------------
    // Zero-distance protection
    //
    // A completely collapsed target has no direction.
    // Use a deterministic fallback direction.
    // -----------------------------------------------------

    if (
        rawDistance <
        EPSILON
    ) {

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


    // -----------------------------------------------------
    // Reachable range
    //
    // A two-bone chain cannot:
    //
    // - contract below |upper - lower|
    // - extend beyond upper + lower
    //
    // Small margins prevent singular configurations.
    // -----------------------------------------------------

    const minReach =
        Math.max(
            0.001,
            finite(
                options.minReach,
                1
            )
        );

    const maxReach =
        Math.max(
            minReach,
            finite(
                options.maxReach,
                upper + lower
            )
        );


    const minimumDistance =
        Math.max(
            minReach,
            Math.abs(
                upper - lower
            ) + 0.001
        );


    const maximumDistance =
        Math.min(
            maxReach,
            upper + lower - 0.001
        );


    const solvedDistance =
        clamp(
            rawDistance,
            minimumDistance,
            maximumDistance
        );


    // -----------------------------------------------------
    // Reachable target
    // -----------------------------------------------------

    const solvedTarget = {

        x:
            hx +
            direction.x *
            solvedDistance,

        y:
            hy +
            direction.y *
            solvedDistance
    };


    // -----------------------------------------------------
    // Knee side
    //
    // The pole determines which side of the
    // hip -> ankle line the knee should occupy.
    //
    // If no pole is supplied, use deterministic fallback.
    // -----------------------------------------------------

    let kneeSide =
        options.kneeSide === -1
            ? -1
            : 1;


    if (pole) {

        const px =
            finite(
                pole.x,
                hx
            );

        const py =
            finite(
                pole.y,
                hy
            );


        const cross =
            dx *
            (py - hy) -
            dy *
            (px - hx);


        if (
            Math.abs(cross) >
            EPSILON
        ) {

            kneeSide =
                cross < 0
                    ? -1
                    : 1;
        }
    }


    // -----------------------------------------------------
    // Law of cosines
    //
    // Finds the angle between:
    //
    // hip -> target
    // hip -> knee
    // -----------------------------------------------------

    let cosHip =
        (
            upper * upper +
            solvedDistance * solvedDistance -
            lower * lower
        ) /
        (
            2 *
            upper *
            Math.max(
                solvedDistance,
                EPSILON
            )
        );


    cosHip =
        clamp(
            cosHip,
            -1,
            1
        );


    const hipOffset =
        Math.acos(
            cosHip
        );


    // -----------------------------------------------------
    // Direction from hip to solved ankle
    // -----------------------------------------------------

    const targetAngle =
        Math.atan2(
            solvedTarget.y - hy,
            solvedTarget.x - hx
        );


    // -----------------------------------------------------
    // Final world angle of thigh
    // -----------------------------------------------------

    const hipAngle =
        targetAngle +
        kneeSide *
        hipOffset;


    // -----------------------------------------------------
    // Knee position
    // -----------------------------------------------------

    const knee = {

        x:
            hx +
            Math.cos(
                hipAngle
            ) *
            upper,

        y:
            hy +
            Math.sin(
                hipAngle
            ) *
            upper
    };


    // -----------------------------------------------------
    // Final world angle of shin
    // -----------------------------------------------------

    const kneeAngle =
        Math.atan2(
            solvedTarget.y -
            knee.y,

            solvedTarget.x -
            knee.x
        );


    // -----------------------------------------------------
    // Result
    //
    // Character.js applies only the returned angles.
    // Skeleton remains the authoritative anatomy.
    // -----------------------------------------------------

    return {

        hip: {
            x: hx,
            y: hy
        },

        knee,

        ankle:
            solvedTarget,

        hipAngle,

        kneeAngle,

        requestedTarget: {
            x: tx,
            y: ty
        },

        solvedDistance,

        clamped:
            Math.abs(
                solvedDistance -
                rawDistance
            ) > 0.001,

        reachable:
            rawDistance >= minimumDistance &&
            rawDistance <= maximumDistance
    };
}
