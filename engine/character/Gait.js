// ASTRAWAY 2.0
// Procedural locomotion / gait.
//
// Gait owns ONLY locomotion:
// - step timing
// - planted feet
// - swing trajectory
// - foot targets
// - incremental locomotion phase
// - step demand
//
// Gait does NOT own:
// - anatomy
// - IK
// - balance
// - COM
// - progression permission
//
// Character = orchestrator.
// Skeleton = anatomical source of truth.
// IK = mathematical solver.
// SupportConstraint = support / reach constraint.
//
// Important:
//
// Character.position remains the owner of body progression.
//
// Gait may REQUEST a step.
// Gait never moves Character.position directly.

import {
    clamp01,
    distance,
    finite,
    normalize,
    lerpPoint,
    addScaled
} from "./MathUtils.js";


// =====================================================
// HELPERS
// =====================================================

function wrap01(value) {

    const safe =
        finite(
            value,
            0
        );

    return (
        ((safe % 1) + 1) % 1
    );
}


// =====================================================
// GAIT
// =====================================================

export class Gait {

    constructor(options = {}) {

        this.stepLength =
            Math.max(
                1,
                finite(
                    options.stepLength,
                    30
                )
            );


        this.stepHeight =
            Math.max(
                0,
                finite(
                    options.stepHeight,
                    11
                )
            );


        this.stepDuration =
            Math.max(
                0.05,
                finite(
                    options.stepDuration,
                    0.18
                )
            );


        this.stepOverlap =
            clamp01(
                finite(
                    options.stepOverlap,
                    0.5
                )
            );


        this.idleDamping =
            Math.max(
                0.001,
                finite(
                    options.idleDamping,
                    16
                )
            );


        /*
         * External request to make a step.
         *
         * 0 = no additional demand
         * 1 = immediate strong demand
         *
         * This is supplied by SupportConstraint.
         *
         * Gait consumes the value but does not calculate
         * support / balance / reach itself.
         */

        this.stepDemand = 0;


        this.skeleton = null;


        // -------------------------------------------------
        // INCREMENTAL LOCOMOTION PHASE
        // -------------------------------------------------

        /*
         * Phase is always incremental.
         *
         * It is NOT reconstructed from total travelled
         * distance.
         */

        this.phase = 0;


        /*
         * Compatibility / diagnostic accumulator.
         *
         * This is NOT the source of phase.
         */

        this.distanceAccumulator = 0;


        /*
         * Previous Character.position.
         *
         * Used to derive signed body displacement.
         */

        this.previousCharacterPosition =
            null;


        /*
         * +1 = along surface tangent
         * -1 = against surface tangent
         */

        this.movementDirection = 1;


        this.initialized = false;


        this.legs = {

            left:
                this.createLeg(-1),

            right:
                this.createLeg(1)
        };
    }


    // =====================================================
    // SKELETON
    // =====================================================

    bindSkeleton(skeleton) {

        if (!skeleton) {

            throw new Error(
                "Gait.bindSkeleton: skeleton is required"
            );
        }


        const required = [

            "pelvis",
            "thighL",
            "shinL",
            "ankleL",

            "thighR",
            "shinR",
            "ankleR"
        ];


        for (
            const name of required
        ) {

            if (
                typeof skeleton.getBone !==
                    "function" ||
                !skeleton.getBone(name)
            ) {

                throw new Error(
                    `Gait.bindSkeleton: missing bone "${name}"`
                );
            }
        }


        this.skeleton =
            skeleton;


        return this;
    }


    requireSkeleton() {

        if (!this.skeleton) {

            throw new Error(
                "Gait requires a bound Skeleton"
            );
        }


        return this.skeleton;
    }


    // =====================================================
    // LEG STATE
    // =====================================================

    createLeg(side) {

        return {

            side,

            planted:
                false,

            stepping:
                false,


            position: {
                x: 0,
                y: 0
            },


            plantedPosition: {
                x: 0,
                y: 0
            },


            startPosition: {
                x: 0,
                y: 0
            },


            targetPosition: {
                x: 0,
                y: 0
            },


            progress:
                0,


            lastSurfaceT:
                0
        };
    }


    // =====================================================
    // SKELETON FOOT POSITIONS
    // =====================================================

    getSkeletonFootPositions() {

        const skeleton =
            this.requireSkeleton();


        const ankleL =
            skeleton.getBone(
                "ankleL"
            );


        const ankleR =
            skeleton.getBone(
                "ankleR"
            );


        return {

            left: {

                x:
                    ankleL.worldX,

                y:
                    ankleL.worldY
            },


            right: {

                x:
                    ankleR.worldX,

                y:
                    ankleR.worldY
            }
        };
    }


    // =====================================================
    // FRAME
    // =====================================================

    getFrame(
        tangent,
        normal
    ) {

        const t =
            normalize(

                finite(
                    tangent?.x,
                    1
                ),

                finite(
                    tangent?.y,
                    0
                ),

                1,
                0
            );


        let n =
            normalize(

                finite(
                    normal?.x,
                    -t.y
                ),

                finite(
                    normal?.y,
                    t.x
                ),

                -t.y,
                t.x
            );


        const dot =
            t.x * n.x +
            t.y * n.y;


        n =
            normalize(

                n.x -
                t.x * dot,

                n.y -
                t.y * dot,

                -t.y,
                t.x
            );


        return {

            tangent:
                t,

            normal:
                n
        };
    }


    // =====================================================
    // INITIALIZATION
    // =====================================================

    initialize(
        characterPosition,
        tangent,
        normal,
        surface,
        surfaceT
    ) {

        this.requireSkeleton();


        const frame =
            this.getFrame(
                tangent,
                normal
            );


        /*
         * Initial foot positions come directly
         * from Skeleton.
         *
         * No duplicated:
         * - hip width
         * - leg length
         * - ankle offset
         */

        const feet =
            this.getSkeletonFootPositions();


        this.setLegPosition(
            this.legs.left,
            feet.left
        );


        this.setLegPosition(
            this.legs.right,
            feet.right
        );


        const t =
            finite(
                surfaceT,
                0
            );


        this.legs.left.lastSurfaceT =
            t;

        this.legs.right.lastSurfaceT =
            t;


        this.phase = 0;

        this.distanceAccumulator =
            0;


        this.stepDemand =
            0;


        /*
         * First frame establishes the reference position.
         *
         * We deliberately do not infer movement from
         * the distance between construction and first update.
         */

        this.previousCharacterPosition = {

            x:
                finite(
                    characterPosition?.x,
                    0
                ),

            y:
                finite(
                    characterPosition?.y,
                    0
                )
        };


        this.movementDirection =
            1;


        this.initialized =
            true;
    }


    setLegPosition(
        leg,
        position
    ) {

        leg.position = {

            x:
                finite(
                    position.x,
                    0
                ),

            y:
                finite(
                    position.y,
                    0
                )
        };


        leg.plantedPosition = {

            x:
                leg.position.x,

            y:
                leg.position.y
        };


        leg.startPosition = {

            x:
                leg.position.x,

            y:
                leg.position.y
        };


        leg.targetPosition = {

            x:
                leg.position.x,

            y:
                leg.position.y
        };


        leg.progress =
            0;


        leg.stepping =
            false;


        leg.planted =
            true;
    }


    // =====================================================
    // STEP DEMAND
    // =====================================================

    setStepDemand(value) {

        this.stepDemand =
            clamp01(
                finite(
                    value,
                    0
                )
            );


        return this.stepDemand;
    }


    getStepDemand() {

        return this.stepDemand;
    }


    // =====================================================
    // UPDATE
    // =====================================================

    update(
        dt,
        travelledDistance,
        characterPosition,
        tangent,
        normal,
        surface,
        surfaceT,
        moving
    ) {

        if (!this.initialized) {

            this.initialize(
                characterPosition,
                tangent,
                normal,
                surface,
                surfaceT
            );
        }


        const frame =
            this.getFrame(
                tangent,
                normal
            );


        // -------------------------------------------------
        // SIGNED BODY MOVEMENT
        // -------------------------------------------------

        let signedMovement =
            0;


        if (
            this.previousCharacterPosition
        ) {

            const dx =
                finite(
                    characterPosition?.x,
                    0
                ) -
                this.previousCharacterPosition.x;


            const dy =
                finite(
                    characterPosition?.y,
                    0
                ) -
                this.previousCharacterPosition.y;


            /*
             * Projection of actual body displacement
             * onto the geometric surface tangent.
             *
             * > 0 = along tangent
             * < 0 = against tangent
             * = 0 = no locomotion along this surface
             */

            signedMovement =
                dx *
                frame.tangent.x +

                dy *
                frame.tangent.y;
        }


        this.previousCharacterPosition = {

            x:
                finite(
                    characterPosition?.x,
                    0
                ),

            y:
                finite(
                    characterPosition?.y,
                    0
                )
        };


        const safeSignedMovement =
            finite(
                signedMovement,
                0
            );


        // -------------------------------------------------
        // INCREMENTAL PHASE
        // -------------------------------------------------

        if (
            moving &&
            Math.abs(
                safeSignedMovement
            ) >
            0.000001
        ) {

            this.movementDirection =
                safeSignedMovement >= 0
                    ? 1
                    : -1;


            /*
             * Unsigned diagnostic accumulator.
             */

            this.distanceAccumulator +=
                Math.abs(
                    safeSignedMovement
                );


            /*
             * Phase is incremental.
             *
             * Forward  -> phase increases.
             * Backward -> phase decreases.
             * Idle     -> phase remains still.
             *
             * Changing stepLength does not
             * retroactively modify phase.
             */

            this.phase =
                wrap01(

                    this.phase +

                    safeSignedMovement /

                    Math.max(
                        this.stepLength * 2,
                        1
                    )
                );
        }


        // -------------------------------------------------
        // STEP DECISION
        // -------------------------------------------------

        if (moving) {

            this.tryStartStep(

                this.legs.left,

                frame,

                surface,

                surfaceT,

                this.movementDirection
            );


            this.tryStartStep(

                this.legs.right,

                frame,

                surface,

                surfaceT,

                this.movementDirection
            );
        }


        // -------------------------------------------------
        // FOOT MOTION
        // -------------------------------------------------

        this.updateLeg(

            this.legs.left,

            dt,

            frame.normal
        );


        this.updateLeg(

            this.legs.right,

            dt,

            frame.normal
        );


        // -------------------------------------------------
        // IDLE
        // -------------------------------------------------

        if (!moving) {

            this.stabilizeIdle(
                this.legs.left,
                dt
            );


            this.stabilizeIdle(
                this.legs.right,
                dt
            );
        }


        return {

            left:
                this.getFootPosition(
                    "left"
                ),

            right:
                this.getFootPosition(
                    "right"
                ),

            phase:
                this.phase,

            stepDemand:
                this.stepDemand,

            leftStepping:
                this.legs.left.stepping,

            rightStepping:
                this.legs.right.stepping,

            leftPlanted:
                this.legs.left.planted,

            rightPlanted:
                this.legs.right.planted
        };
    }


    // =====================================================
    // STEP DECISION
    // =====================================================

    tryStartStep(
        leg,
        frame,
        surface,
        surfaceT,
        movementDirection = 1
    ) {

        if (
            leg.stepping
        ) {
            return;
        }


        /*
         * Current planted foot is the anatomical
         * reference.
         */

        const current =
            leg.position;


        const forwardDistance =
            this.stepLength * 0.65;


        const direction =
            movementDirection >= 0
                ? 1
                : -1;


        const target =
            addScaled(

                current,

                frame.tangent,

                forwardDistance *
                direction
            );


        const desiredDistance =
            distance(
                current,
                target
            );


        if (
            desiredDistance <
            this.stepLength * 0.5
        ) {

            return;
        }


        // -------------------------------------------------
        // RHYTHM
        // -------------------------------------------------

        const expectedPhase =
            leg.side < 0

                ? this.phase

                : (
                    this.phase +
                    0.5
                ) % 1;


        const rhythmReady =
            expectedPhase >
                this.stepOverlap ||

            expectedPhase <
                0.15;


        // -------------------------------------------------
        // DEMAND
        // -------------------------------------------------

        /*
         * A strong support demand may override rhythm.
         *
         * This is deliberately not a direct "force step"
         * boolean.
         *
         * The threshold allows normal gait rhythm to remain
         * primary, while severe stretch can request an
         * earlier step.
         */

        const demandReady =
            this.stepDemand >= 0.65;


        /*
         * Normal rhythm or sufficiently strong support
         * demand can initiate a step.
         */

        if (
            !rhythmReady &&
            !demandReady
        ) {

            return;
        }


        /*
         * If demand is present, prefer the leg that is
         * currently under support pressure.
         *
         * If both legs receive the same demand, normal
         * phase ordering still prevents simultaneous steps
         * unless the rhythm allows it.
         */

        if (
            this.stepDemand > 0 &&
            !rhythmReady
        ) {

            const other =
                leg.side < 0
                    ? this.legs.right
                    : this.legs.left;


            /*
             * Never start a second step while the opposite
             * leg is already swinging under demand.
             *
             * This preserves a single-support transition.
             */

            if (
                other.stepping
            ) {

                return;
            }
        }


        this.startStep(
            leg,
            target,
            surfaceT
        );
    }


    startStep(
        leg,
        target,
        surfaceT
    ) {

        leg.stepping =
            true;


        leg.planted =
            false;


        leg.progress =
            0;


        leg.startPosition = {

            x:
                leg.position.x,

            y:
                leg.position.y
        };


        leg.targetPosition = {

            x:
                target.x,

            y:
                target.y
        };


        leg.lastSurfaceT =
            finite(
                surfaceT,
                leg.lastSurfaceT
            );


        /*
         * A step has now been accepted.
         *
         * Clear the demand so that it must be earned again
         * by the support system if another emergency step
         * becomes necessary.
         */

        this.stepDemand =
            0;
    }


    // =====================================================
    // FOOT MOTION
    // =====================================================

    updateLeg(
        leg,
        dt,
        normal
    ) {

        if (
            !leg.stepping
        ) {

            leg.position = {

                x:
                    leg.plantedPosition.x,

                y:
                    leg.plantedPosition.y
            };


            return;
        }


        const safeDt =
            Math.max(
                0,
                finite(
                    dt,
                    0
                )
            );


        leg.progress =
            clamp01(

                leg.progress +

                safeDt /
                this.stepDuration
            );


        const p =
            leg.progress;


        /*
         * Smoothstep.
         */

        const eased =
            p *
            p *
            (
                3 -
                2 * p
            );


        let position =
            lerpPoint(

                leg.startPosition,

                leg.targetPosition,

                eased
            );


        /*
         * Swing arc.
         */

        const lift =
            Math.sin(
                p * Math.PI
            );


        const liftAmount =
            lift *
            lift *
            this.stepHeight;


        position =
            addScaled(

                position,

                normal,

                liftAmount
            );


        leg.position =
            position;


        if (
            p >= 1
        ) {

            leg.position = {

                x:
                    leg.targetPosition.x,

                y:
                    leg.targetPosition.y
            };


            leg.plantedPosition = {

                x:
                    leg.targetPosition.x,

                y:
                    leg.targetPosition.y
            };


            leg.stepping =
                false;


            leg.planted =
                true;


            leg.progress =
                0;
        }
    }


    // =====================================================
    // IDLE
    // =====================================================

    stabilizeIdle(
        leg,
        dt
    ) {

        const safeDt =
            Math.max(
                0,
                finite(
                    dt,
                    0
                )
            );


        const factor =
            1 -
            Math.exp(

                -this.idleDamping *
                safeDt
            );


        leg.position.x +=

            (
                leg.plantedPosition.x -
                leg.position.x
            ) *
            factor;


        leg.position.y +=

            (
                leg.plantedPosition.y -
                leg.position.y
            ) *
            factor;
    }


    // =====================================================
    // API
    // =====================================================

    getFootPosition(
        side
    ) {

        const leg =
            side === "left"

                ? this.legs.left

                : this.legs.right;


        return {

            x:
                leg.position.x,

            y:
                leg.position.y
        };
    }


    getLegState(
        side
    ) {

        const leg =
            side === "left"

                ? this.legs.left

                : this.legs.right;


        return {

            planted:
                leg.planted,

            stepping:
                leg.stepping,

            progress:
                leg.progress,

            position: {

                x:
                    leg.position.x,

                y:
                    leg.position.y
            },

            plantedPosition: {

                x:
                    leg.plantedPosition.x,

                y:
                    leg.plantedPosition.y
            },

            targetPosition: {

                x:
                    leg.targetPosition.x,

                y:
                    leg.targetPosition.y
            }
        };
    }


    reset() {

        this.phase =
            0;


        this.distanceAccumulator =
            0;


        this.previousCharacterPosition =
            null;


        this.movementDirection =
            1;


        this.stepDemand =
            0;


        this.initialized =
            false;


        for (
            const leg of [
                this.legs.left,
                this.legs.right
            ]
        ) {

            leg.stepping =
                false;


            leg.planted =
                false;


            leg.progress =
                0;


            leg.position.x =
                0;

            leg.position.y =
                0;


            leg.plantedPosition.x =
                0;

            leg.plantedPosition.y =
                0;


            leg.startPosition.x =
                0;

            leg.startPosition.y =
                0;


            leg.targetPosition.x =
                0;

            leg.targetPosition.y =
                0;


            leg.lastSurfaceT =
                0;
        }
    }


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        if (
            !this.skeleton
        ) {

            return {

                valid:
                    false,

                error:
                    "Gait has no Skeleton"
            };
        }


        return {

            valid:
                true,

            initialized:
                this.initialized,

            skeletonBound:
                true,

            phase:
                this.phase,

            stepDemand:
                this.stepDemand
        };
    }
}


export default Gait;
