// ASTRAWAY 2.0
// Distance-driven procedural gait.
//
// Foot targets are generated from the character's
// anatomical rest pose instead of being placed near
// the pelvis.
//
// The gait system does not depend on frame rate
// for step timing decisions.
// Phase advances from actual travelled distance.
//
// Each leg has:
//   - planted foot position
//   - current foot position
//   - step start
//   - step target
//   - swing progress
//
// Surface normal controls the vertical anatomical
// offset and foot lift, so the character follows
// curved / tilted branches naturally.

import {
    clamp01,
    damp,
    distance,
    lerp,
    lerpPoint,
    addScaled,
    finite,
    normalize
} from "./MathUtils.js";


export class Gait {

    constructor(options = {}) {

        this.stepLength =
            Math.max(
                1,
                finite(options.stepLength, 28)
            );

        this.stepWidth =
            Math.max(
                0,
                finite(options.stepWidth, 20)
            );

        this.stepHeight =
            Math.max(
                0,
                finite(options.stepHeight, 10)
            );

        this.stepDuration =
            Math.max(
                0.05,
                finite(options.stepDuration, 0.18)
            );

        this.stepOverlap =
            clamp01(
                finite(options.stepOverlap, 0.5)
            );

        this.idleDamping =
            Math.max(
                0.001,
                finite(options.idleDamping, 16)
            );


        // -------------------------------------------------
        // ANATOMICAL REST POSE
        // -------------------------------------------------
        //
        // Current Skeleton geometry:
        //
        // pelvis
        //   -> hip:   x = +/-10, y = 4
        //   -> knee:  y = 27
        //   -> ankle: y = 27
        //
        // Therefore:
        //
        // ankle from pelvis:
        //   left  = (-10, 58)
        //   right = ( 10, 58)
        //
        // In the character frame:
        //   X = movement tangent
        //   Y = surface normal
        //
        // This is the important correction that prevents
        // the IK solver from folding the legs underneath
        // the pelvis.
        //

        this.legRestLength =
            Math.max(
                1,
                finite(options.legRestLength, 58)
            );

        this.hipOffset =
            Math.max(
                0,
                finite(options.hipOffset, 10)
            );


        this.phase = 0;

        this.distanceAccumulator = 0;

        this.initialized = false;


        this.legs = {

            left:
                this.createLeg(-1),

            right:
                this.createLeg(1)
        };
    }


    createLeg(side) {

        return {

            side,

            planted: false,

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

            progress: 0,

            stepping: false,

            lastSurfaceT: 0,

            lastStepDistance: 0
        };
    }


    initialize(
        characterPosition,
        tangent,
        normal,
        surface,
        surfaceT
    ) {

        const frame =
            this.getFrame(
                tangent,
                normal
            );


        const base =
            this.getRestFootPositions(
                characterPosition,
                frame.tangent,
                frame.normal
            );


        this.setLegPosition(
            this.legs.left,
            base.left
        );

        this.setLegPosition(
            this.legs.right,
            base.right
        );


        this.legs.left.lastSurfaceT =
            finite(
                surfaceT,
                0
            );

        this.legs.right.lastSurfaceT =
            finite(
                surfaceT,
                0
            );


        this.initialized = true;
    }


    setLegPosition(
        leg,
        position
    ) {

        leg.position = {
            x: position.x,
            y: position.y
        };

        leg.plantedPosition = {
            x: position.x,
            y: position.y
        };

        leg.startPosition = {
            x: position.x,
            y: position.y
        };

        leg.targetPosition = {
            x: position.x,
            y: position.y
        };

        leg.progress = 0;
        leg.stepping = false;
        leg.planted = true;
    }


    getFrame(
        tangent,
        normal
    ) {

        const t =
            normalize(
                tangent?.x,
                tangent?.y,
                1,
                0
            );

        let n =
            normalize(
                normal?.x,
                normal?.y,
                -t.y,
                t.x
            );


        // Ensure perpendicular frame.

        const dot =
            t.x * n.x +
            t.y * n.y;


        n = {

            x:
                n.x -
                t.x * dot,

            y:
                n.y -
                t.y * dot
        };


        n =
            normalize(
                n.x,
                n.y,
                -t.y,
                t.x
            );


        return {

            tangent: t,

            normal: n
        };
    }


    // -----------------------------------------------------
    // ANATOMICAL FOOT POSITIONS
    // -----------------------------------------------------
    //
    // These positions mirror the actual Skeleton rest
    // pose.
    //
    // Horizontal branch example:
    //
    //              character
    //                  O
    //                  |
    //                  |
    //              L     R
    //              |     |
    //
    // Feet are approximately 58 px below the pelvis,
    // not immediately beside it.
    //

    getRestFootPositions(
        characterPosition,
        tangent,
        normal
    ) {

        const leftBase =
            addScaled(
                characterPosition,
                normal,
                this.legRestLength
            );

        const rightBase =
            addScaled(
                characterPosition,
                normal,
                this.legRestLength
            );


        // Match Skeleton hip offsets.
        //
        // Left ankle:
        //   -hipOffset along tangent
        //
        // Right ankle:
        //   +hipOffset along tangent
        //
        const left =
            addScaled(
                leftBase,
                tangent,
                -this.hipOffset
            );

        const right =
            addScaled(
                rightBase,
                tangent,
                this.hipOffset
            );


        return {
            left,
            right
        };
    }


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


        const safeDistance =
            Math.max(
                0,
                finite(
                    travelledDistance,
                    0
                )
            );


        // -------------------------------------------------
        // DISTANCE-BASED PHASE
        // -------------------------------------------------

        if (
            moving &&
            safeDistance > 0
        ) {

            this.distanceAccumulator +=
                safeDistance;

            this.phase =
                (
                    this.distanceAccumulator /
                    Math.max(
                        this.stepLength * 2,
                        1
                    )
                ) % 1;
        }


        // -------------------------------------------------
        // START STEPS
        // -------------------------------------------------

        if (moving) {

            this.tryStartStep(
                this.legs.left,
                characterPosition,
                frame,
                surface,
                surfaceT
            );

            this.tryStartStep(
                this.legs.right,
                characterPosition,
                frame,
                surface,
                surfaceT
            );
        }


        // -------------------------------------------------
        // UPDATE FEET
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

            left: {

                x:
                    this.legs.left.position.x,

                y:
                    this.legs.left.position.y
            },

            right: {

                x:
                    this.legs.right.position.x,

                y:
                    this.legs.right.position.y
            },

            phase:
                this.phase,

            leftStepping:
                this.legs.left.stepping,

            rightStepping:
                this.legs.right.stepping
        };
    }


    tryStartStep(
        leg,
        characterPosition,
        frame,
        surface,
        surfaceT
    ) {

        if (leg.stepping) {
            return;
        }


        // -------------------------------------------------
        // REST POSITION
        // -------------------------------------------------

        const restBase =
            addScaled(
                characterPosition,
                frame.normal,
                this.legRestLength
            );


        const restPosition =
            addScaled(
                restBase,
                frame.tangent,
                leg.side *
                this.hipOffset
            );


        // -------------------------------------------------
        // STEP TARGET
        // -------------------------------------------------
        //
        // Both feet move FORWARD relative to the
        // character.
        //
        // side is used only for the lateral/anatomical
        // offset.
        //

        const forwardDistance =
            this.stepLength * 0.55;


        const target =
            addScaled(
                restPosition,
                frame.tangent,
                forwardDistance
            );


        // -------------------------------------------------
        // HOW FAR IS THE CURRENT FOOT FROM ITS DESIRED
        // POSITION?
        // -------------------------------------------------

        const desiredDistance =
            distance(
                leg.position,
                target
            );


        if (
            desiredDistance <
            this.stepLength * 0.35
        ) {
            return;
        }


        // -------------------------------------------------
        // ALTERNATING RHYTHM
        // -------------------------------------------------

        const expectedPhase =
            leg.side < 0
                ? this.phase
                : (
                    this.phase + 0.5
                ) % 1;


        const rhythmReady =
            expectedPhase >
                this.stepOverlap ||
            expectedPhase <
                0.15;


        if (!rhythmReady) {
            return;
        }


        this.startStep(
            leg,
            target,
            surface,
            surfaceT
        );
    }


    startStep(
        leg,
        target,
        surface,
        surfaceT
    ) {

        leg.stepping = true;

        leg.planted = false;

        leg.progress = 0;

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

        leg.lastStepDistance =
            distance(
                leg.startPosition,
                leg.targetPosition
            );
    }


    updateLeg(
        leg,
        dt,
        normal
    ) {

        if (!leg.stepping) {

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
                finite(dt, 0)
            );


        leg.progress =
            clamp01(
                leg.progress +
                safeDt /
                this.stepDuration
            );


        const p =
            leg.progress;


        // Smoothstep.

        const eased =
            p * p *
            (3 - 2 * p);


        let position =
            lerpPoint(
                leg.startPosition,
                leg.targetPosition,
                eased
            );


        // -------------------------------------------------
        // FOOT LIFT
        // -------------------------------------------------

        const lift =
            Math.sin(
                p * Math.PI
            );

        const liftAmount =
            lift * lift *
            this.stepHeight;


        position =
            addScaled(
                position,
                normal,
                liftAmount
            );


        leg.position =
            position;


        // -------------------------------------------------
        // LAND
        // -------------------------------------------------

        if (p >= 1) {

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

            leg.stepping = false;

            leg.planted = true;

            leg.progress = 0;
        }
    }


    stabilizeIdle(
        leg,
        dt
    ) {

        const safeDt =
            Math.max(
                0,
                finite(dt, 0)
            );


        const factor =
            1 -
            Math.exp(
                -this.idleDamping *
                safeDt
            );


        leg.position.x =
            lerp(
                leg.position.x,
                leg.plantedPosition.x,
                factor
            );

        leg.position.y =
            lerp(
                leg.position.y,
                leg.plantedPosition.y,
                factor
            );
    }


    getFootPosition(side) {

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


    reset() {

        this.phase = 0;

        this.distanceAccumulator = 0;

        this.initialized = false;


        for (
            const leg of [
                this.legs.left,
                this.legs.right
            ]
        ) {

            leg.stepping = false;

            leg.planted = false;

            leg.progress = 0;

            leg.position.x = 0;
            leg.position.y = 0;

            leg.plantedPosition.x = 0;
            leg.plantedPosition.y = 0;

            leg.startPosition.x = 0;
            leg.startPosition.y = 0;

            leg.targetPosition.x = 0;
            leg.targetPosition.y = 0;
        }
    }
}


export default Gait;
