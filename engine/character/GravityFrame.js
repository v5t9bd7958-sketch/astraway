// ASTRAWAY 2.0
// Gravity Frame
//
// Responsibility:
// - determine the local support frame
// - place pelvis relative to the supporting surface
// - place foot/ankle targets consistently with Skeleton anatomy
// - orient the character to the surface
//
// GravityFrame does NOT:
// - own Skeleton anatomy
// - perform IK
// - perform gait
// - move the character
// - render anything
//
// Character owns integration.
// Skeleton owns anatomy.
// Surface owns route geometry.
// Gait owns locomotion.

import {
    finite,
    normalize
} from "./MathUtils.js";

export class GravityFrame {

    constructor(options = {}) {

        this.pelvisClearance =
            Math.max(
                0,
                finite(
                    options.pelvisClearance,
                    0
                )
            );

        this.worldUp = {
            x: 0,
            y: -1
        };

        this.frame = {
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
                y: -1
            },

            down: {
                x: 0,
                y: 1
            },

            facingAngle: 0,

            pelvis: {
                x: 0,
                y: 0
            },

            leftFoot: {
                x: -9,
                y: 0
            },

            rightFoot: {
                x: 9,
                y: 0
            },

            standingHeight: 69
        };
    }


    // =====================================================
    // BUILD FRAME
    // =====================================================

    compute(
        surfaceFrame,
        skeleton
    ) {

        // -------------------------------------------------
        // SURFACE TANGENT
        // -------------------------------------------------

        const tangent =
            normalize(
                finite(
                    surfaceFrame?.tangent?.x,
                    1
                ),
                finite(
                    surfaceFrame?.tangent?.y,
                    0
                ),
                1,
                0
            );


        // -------------------------------------------------
        // SURFACE NORMAL
        // -------------------------------------------------
        //
        // Surface.js returns a route-side normal.
        //
        // In canvas coordinates:
        //
        // +Y = down
        // -Y = up
        //
        // Therefore we explicitly orient the support
        // normal toward world-up whenever possible.
        //

        const rawNormal =
            normalize(
                finite(
                    surfaceFrame?.normal?.x,
                    -tangent.y
                ),
                finite(
                    surfaceFrame?.normal?.y,
                    tangent.x
                ),
                -tangent.y,
                tangent.x
            );


        const upDot =
            rawNormal.x *
                this.worldUp.x +
            rawNormal.y *
                this.worldUp.y;


        let normal = {
            x: rawNormal.x,
            y: rawNormal.y
        };


        // If the supplied normal points away from
        // world-up, reverse it.
        //
        // IMPORTANT:
        // upDot < 0 means the normal points downward.

        if (upDot < 0) {

            normal.x *= -1;
            normal.y *= -1;
        }


        const down = {
            x: -normal.x,
            y: -normal.y
        };


        // -------------------------------------------------
        // SURFACE POSITION
        // -------------------------------------------------

        const position = {

            x:
                finite(
                    surfaceFrame?.position?.x,
                    0
                ),

            y:
                finite(
                    surfaceFrame?.position?.y,
                    0
                )
        };


        // -------------------------------------------------
        // READ REAL SKELETON ANATOMY
        // -------------------------------------------------
        //
        // IK solves:
        //
        // thigh + shin
        //
        // and targets the ankle origin.
        //
        // Therefore ankle.length MUST NOT be included
        // in the standing height.
        //

        let thighLength = 34;
        let shinLength = 32;

        let leftHipOffsetX = -9;
        let rightHipOffsetX = 9;

        let hipDownOffset = 3;


        if (skeleton) {

            thighLength =
                this.getLength(
                    skeleton,
                    "thighL",
                    thighLength
                );

            shinLength =
                this.getLength(
                    skeleton,
                    "shinL",
                    shinLength
                );


            const thighL =
                typeof skeleton.getBone ===
                    "function"
                    ? skeleton.getBone(
                        "thighL"
                    )
                    : null;


            const thighR =
                typeof skeleton.getBone ===
                    "function"
                    ? skeleton.getBone(
                        "thighR"
                    )
                    : null;


            if (thighL) {

                leftHipOffsetX =
                    finite(
                        thighL.localX,
                        leftHipOffsetX
                    );

                hipDownOffset =
                    finite(
                        thighL.localY,
                        hipDownOffset
                    );
            }


            if (thighR) {

                rightHipOffsetX =
                    finite(
                        thighR.localX,
                        rightHipOffsetX
                    );
            }
        }


        // -------------------------------------------------
        // STANDING HEIGHT
        // -------------------------------------------------
        //
        // Pelvis
        //   ↓ hip offset
        // Hip
        //   ↓ thigh
        // Knee
        //   ↓ shin
        // Ankle target
        //
        // Therefore:
        //
        // pelvis height =
        // thigh + shin + hip offset
        //
        // For our current Skeleton:
        //
        // 34 + 32 + 3 = 69
        //

        const standingHeight =
            thighLength +
            shinLength +
            Math.abs(
                hipDownOffset
            ) +
            this.pelvisClearance;


        // -------------------------------------------------
        // PELVIS
        // -------------------------------------------------

        const pelvis = {

            x:
                position.x +
                normal.x *
                standingHeight,

            y:
                position.y +
                normal.y *
                standingHeight
        };


        // -------------------------------------------------
        // FOOT / ANKLE TARGETS
        // -------------------------------------------------
        //
        // We intentionally derive these from the actual
        // thigh origins in Skeleton.
        //
        // This prevents GravityFrame from inventing a
        // different anatomy than Skeleton.
        //
        // The current Skeleton has:
        //
        // thighL = (-9, 3)
        // thighR = ( 9, 3)
        //
        // Therefore the ankle targets are placed at
        // matching tangent offsets from the surface point.
        //

        const leftFoot = {

            x:
                position.x +
                tangent.x *
                leftHipOffsetX,

            y:
                position.y +
                tangent.y *
                leftHipOffsetX
        };


        const rightFoot = {

            x:
                position.x +
                tangent.x *
                rightHipOffsetX,

            y:
                position.y +
                tangent.y *
                rightHipOffsetX
        };


        // -------------------------------------------------
        // FACING
        // -------------------------------------------------

        const facingAngle =
            Math.atan2(
                tangent.y,
                tangent.x
            );


        // -------------------------------------------------
        // STORE FRAME
        // -------------------------------------------------

        this.frame = {

            position,

            tangent,

            normal,

            down,

            facingAngle,

            pelvis,

            leftFoot,

            rightFoot,

            standingHeight
        };


        return this.frame;
    }


    // =====================================================
    // HELPERS
    // =====================================================

    getLength(
        skeleton,
        name,
        fallback
    ) {

        if (
            !skeleton ||
            typeof skeleton.getAnatomicalLength !==
                "function"
        ) {

            return fallback;
        }


        const value =
            skeleton.getAnatomicalLength(
                name
            );


        return Math.max(
            0,
            finite(
                value,
                fallback
            )
        );
    }


    // =====================================================
    // ACCESSORS
    // =====================================================

    getFrame() {

        return this.frame;
    }


    getPelvisPosition() {

        return {

            x:
                this.frame.pelvis.x,

            y:
                this.frame.pelvis.y
        };
    }


    getFootTargets() {

        return {

            left: {

                x:
                    this.frame.leftFoot.x,

                y:
                    this.frame.leftFoot.y
            },

            right: {

                x:
                    this.frame.rightFoot.x,

                y:
                    this.frame.rightFoot.y
            }
        };
    }


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        const f =
            this.frame;


        const finitePoint =
            point =>
                Number.isFinite(
                    point.x
                ) &&
                Number.isFinite(
                    point.y
                );


        const valid =
            finitePoint(
                f.position
            ) &&
            finitePoint(
                f.tangent
            ) &&
            finitePoint(
                f.normal
            ) &&
            finitePoint(
                f.down
            ) &&
            finitePoint(
                f.pelvis
            ) &&
            finitePoint(
                f.leftFoot
            ) &&
            finitePoint(
                f.rightFoot
            ) &&
            Number.isFinite(
                f.facingAngle
            ) &&
            Number.isFinite(
                f.standingHeight
            );


        return {

            valid,

            frame: f
        };
    }
}


export default GravityFrame;
