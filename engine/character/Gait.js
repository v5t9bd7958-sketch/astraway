// ASTRAWAY 2.0
// Distance-driven procedural gait.
//
// The gait system does not depend on frame rate.
// Phase advances from actual travelled distance.
//
// Each leg has:
//   - planted foot position
//   - current foot position
//   - step start
//   - step target
//   - swing progress
//
// Surface normal controls foot lift, so the character can
// walk on curved / tilted branches.

import {
    clamp,
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
                finite(options.stepWidth, 16)
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


        this.phase = 0;

        this.distanceAccumulator = 0;

        this.initialized = false;


        this.legs = {

            left: this.createLeg(-1),

            right: this.createLeg(1)
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
            this.getFootBase(
                characterPosition,
                frame.tangent,
                frame.normal
            );


        this.legs.left.position =
            {
                x: base.left.x,
                y: base.left.y
            };

        this.legs.left.plantedPosition =
            {
                x: base.left.x,
                y: base.left.y
            };


        this.legs.right.position =
            {
                x: base.right.x,
                y: base.right.y
            };

        this.legs.right.plantedPosition =
            {
                x: base.right.x,
                y: base.right.y
            };


        this.legs.left.targetPosition =
            {
                x: base.left.x,
                y: base.left.y
            };

        this.legs.right.targetPosition =
            {
                x: base.right.x,
                y: base.right.y
            };


        this.legs.left.lastSurfaceT =
            surfaceT;

        this.legs.right.lastSurfaceT =
            surfaceT;


        this.initialized = true;
    }


    getFrame(tangent, normal) {

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


        // Ensure the frame remains perpendicular.

        const dot =
            t.x * n.x +
            t.y * n.y;


        n = {

            x: n.x - t.x * dot,

            y: n.y - t.y * dot
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


    getFootBase(
        characterPosition,
        tangent,
        normal
    ) {

        const halfWidth =
            this.stepWidth * 0.5;


        return {

            left: addScaled(
                characterPosition,
                normal,
                halfWidth
            ),

            right: addScaled(
                characterPosition,
                normal,
                -halfWidth
            )
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

        if (moving && safeDistance > 0) {

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
        // Determine whether a new step is required.
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
        // Update both feet.
        // -------------------------------------------------

        this.updateLeg(
            this.legs.left,
            dt,
            frame.normal,
            moving
        );

        this.updateLeg(
            this.legs.right,
            dt,
            frame.normal,
            moving
        );


        // -------------------------------------------------
        // Idle = gradually return feet to stable planted
        // positions without snapping.
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
                {
                    x: this.legs.left.position.x,
                    y: this.legs.left.position.y
                },

            right:
                {
                    x: this.legs.right.position.x,
                    y: this.legs.right.position.y
                },

            phase: this.phase,

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


        const base =
            addScaled(
                characterPosition,
                frame.normal,
                -leg.side *
                this.stepWidth *
                0.5
            );


        const forward =
            addScaled(
                base,
                frame.tangent,
                leg.side *
                this.stepLength *
                0.55
            );


        const desiredDistance =
            distance(
                leg.position,
                forward
            );


        // Foot is already close enough.

        if (
            desiredDistance <
            this.stepLength * 0.35
        ) {
            return;
        }


        // Alternating rhythm.
        //
        // Left and right are offset by half a cycle.
        const expectedPhase =
            leg.side < 0
                ? this.phase
                : (this.phase + 0.5) % 1;


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
            forward,
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

        leg.progress = 0;

        leg.startPosition =
            {
                x: leg.position.x,
                y: leg.position.y
            };

        leg.targetPosition =
            {
                x: target.x,
                y: target.y
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
        normal,
        moving
    ) {

        if (!leg.stepping) {

            leg.position =
                {
                    x: leg.plantedPosition.x,
                    y: leg.plantedPosition.y
                };

            return;
        }


        // Progress is based on actual elapsed time only
        // for the internal swing animation. The decision
        // to take a step is distance-driven.

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


        // Smooth swing curve.

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
        // Foot lift
        //
        // sin² gives:
        //   0 at takeoff
        //   maximum at middle
        //   0 at landing
        //
        // Lift follows SURFACE NORMAL, not global Y.
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


        if (p >= 1) {

            leg.position =
                {
                    x: leg.targetPosition.x,
                    y: leg.targetPosition.y
                };

            leg.plantedPosition =
                {
                    x: leg.targetPosition.x,
                    y: leg.targetPosition.y
                };

            leg.stepping = false;

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

            x: leg.position.x,

            y: leg.position.y
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

            leg.progress = 0;

            leg.position.x = 0;
            leg.position.y = 0;

            leg.plantedPosition.x = 0;
            leg.plantedPosition.y = 0;
        }
    }
}


export default Gait;
