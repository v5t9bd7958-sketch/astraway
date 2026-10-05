// ASTRAWAY 2.0
// Procedural locomotion / gait.
//
// Gait owns ONLY locomotion:
// - step timing
// - planted feet
// - swing trajectory
// - foot targets
// - incremental locomotion phase
//
// Gait does NOT own anatomy.
// All anatomical positions come from Skeleton.
//
// Skeleton = source of truth for:
// pelvis / thigh / shin / ankle / foot.
//
// Character = orchestrator.
// IK = mathematical solver.
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
        finite(value, 0);
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
        this.skeleton = null;
        // Incremental locomotion phase.
        // Always kept in [0, 1).
        this.phase = 0;
        /*
         * Compatibility / diagnostic accumulator.
         *
         * This is NOT the source of phase anymore.
         */
        this.distanceAccumulator = 0;
        /*
         * Previous Character.position.
         *
         * Gait derives signed body displacement from
         * the actual Character position rather than
         * trusting an unsigned distance value.
         */
        this.previousCharacterPosition = null;
        /*
         * Last actual locomotion direction relative
         * to the current surface tangent.
         *
         * +1 = along tangent
         * -1 = against tangent
         */
        this.movementDirection = 1;
        this.initialized = false;
        this.legs = {
            left: this.createLeg(-1),
            right: this.createLeg(1)
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
        for (const name of required) {
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
        this.skeleton = skeleton;
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
            planted: false,
            stepping: false,
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
            lastSurfaceT: 0
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
                x: ankleL.worldX,
                y: ankleL.worldY
            },
            right: {
                x: ankleR.worldX,
                y: ankleR.worldY
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
                finite(tangent?.x, 1),
                finite(tangent?.y, 0),
                1,
                0
            );
        let n =
            normalize(
                finite(normal?.x, -t.y),
                finite(normal?.y, t.x),
                -t.y,
                t.x
            );
        const dot =
            t.x * n.x +
            t.y * n.y;
        n =
            normalize(
                n.x - t.x * dot,
                n.y - t.y * dot,
                -t.y,
                t.x
            );
        return {
            tangent: t,
            normal: n
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
        this.legs.left.lastSurfaceT = t;
        this.legs.right.lastSurfaceT = t;
        this.phase = 0;
        this.distanceAccumulator = 0;
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
        this.movementDirection = 1;
        this.initialized = true;
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
        leg.progress = 0;
        leg.stepping = false;
        leg.planted = true;
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
        let signedMovement = 0;
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
                dx * frame.tangent.x +
                dy * frame.tangent.y;
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
            ) > 0.000001
        ) {
            this.movementDirection =
                safeSignedMovement >= 0
                    ? 1
                    : -1;
            /*
             * Keep this accumulator unsigned for
             * compatibility / diagnostics only.
             */
            this.distanceAccumulator +=
                Math.abs(
                    safeSignedMovement
                );
            /*
             * IMPORTANT:
             *
             * Phase is incremental.
             *
             * It is NOT reconstructed from the total
             * accumulated distance.
             *
             * Therefore:
             *
             * forward  -> phase increases
             * backward -> phase decreases
             * idle     -> phase stays still
             *
             * Changing stepLength does not retroactively
             * modify the existing phase.
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
         *
         * We do not reconstruct anatomy here.
         */
        const current =
            leg.position;
        const forwardDistance =
            this.stepLength * 0.65;
        /*
         * IMPORTANT:
         *
         * Step direction follows actual locomotion
         * direction relative to the surface tangent.
         *
         * Forward:
         *     +tangent
         *
         * Backward:
         *     -tangent
         */
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
        if (
            !rhythmReady
        ) {
            return;
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
        const eased =
            p * p *
            (3 - 2 * p);
        let position =
            lerpPoint(
                leg.startPosition,
                leg.targetPosition,
                eased
            );
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
            leg.stepping = false;
            leg.planted = true;
            leg.progress = 0;
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
    reset() {
        this.phase = 0;
        this.distanceAccumulator = 0;
        this.previousCharacterPosition = null;
        this.movementDirection = 1;
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
    // =====================================================
    // VALIDATION
    // =====================================================
    validate() {
        if (
            !this.skeleton
        ) {
            return {
                valid: false,
                error:
                    "Gait has no Skeleton"
            };
        }
        return {
            valid: true,
            initialized:
                this.initialized,
            skeletonBound:
                true
        };
    }
}
export default Gait;
