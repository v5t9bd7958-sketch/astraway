// ASTRAWAY 2.0
// Character controller.
//
// Architecture:
//
// Character
// ├─ Skeleton            = anatomy / hierarchy / rest pose
// ├─ Gait                = locomotion / foot targets
// ├─ BodyState           = COM / contacts / balance
// ├─ FullBodyController  = upper-body procedural pose
// ├─ IK                  = mathematical leg solving
// └─ Animation           = state machine
//
// Character owns:
// - movement
// - facing
// - look
// - root position / root angle
// - pose orchestration order
// - leg IK integration
// - final FK
//
// Character does NOT own:
// - anatomical hierarchy
// - bone lengths
// - upper-body procedural offsets (FullBodyController)
// - COM / balance math (BodyState)
// - rendering


import Skeleton from "./Skeleton.js";

import {
    solveTwoBoneIK
} from "./IK.js";

import Gait from "./Gait.js";

import BodyState from "./BodyState.js";

import FullBodyController from "./FullBodyController.js";

import AnimationStateMachine, {
    ANIMATION_STATES
} from "./AnimationStateMachine.js";

import {
    dampAngle,
    finite,
    normalize
} from "./MathUtils.js";


export class Character {

    constructor(options = {}) {

        this.position = {
            x:
                finite(
                    options.x,
                    0
                ),

            y:
                finite(
                    options.y,
                    0
                )
        };


        this.moveAngle =
            finite(
                options.angle,
                0
            );

        this.lookAngle =
            this.moveAngle;

        this.targetMoveAngle =
            this.moveAngle;

        this.targetLookAngle =
            this.lookAngle;


        this.speed =
            Math.max(
                1,
                finite(
                    options.speed,
                    90
                )
            );


        this.turnSpeed =
            Math.max(
                0.01,
                finite(
                    options.turnSpeed,
                    10
                )
            );


        this.lookTurnSpeed =
            Math.max(
                0.01,
                finite(
                    options.lookTurnSpeed,
                    8
                )
            );


        this.velocity = {
            x: 0,
            y: 0
        };


        this.travelledDistance =
            0;

        this.isMoving =
            false;


        this.currentSurface =
            null;

        this.currentSurfaceT =
            0;


        this.path = [];
        this.pathIndex = 0;


        this.lookTarget =
            null;


        // =================================================
        // CORE SYSTEMS
        // =================================================

        this.skeleton =
            new Skeleton();


        this.gait =
            new Gait({

                stepLength:
                    finite(
                        options.stepLength,
                        30
                    ),

                stepHeight:
                    finite(
                        options.stepHeight,
                        11
                    ),

                stepDuration:
                    finite(
                        options.stepDuration,
                        0.18
                    )
            });


        this.gait.bindSkeleton(
            this.skeleton
        );


        /*
         * BodyState owns:
         * - total mass
         * - center of mass
         * - contacts
         * - support
         * - balance
         */

        this.bodyState =
            new BodyState(
                this.skeleton
            );


        /*
         * FullBodyController owns:
         * - torso
         * - arms
         * - neck
         * - head
         *
         * Gait is provided as read-only locomotion
         * state for procedural arm motion.
         */

        this.fullBody =
            new FullBodyController(
                this.skeleton,
                this.bodyState,
                {
                    gait:
                        this.gait
                }
            );


        this.animation =
            new AnimationStateMachine();


        this.footTargets = {

            left: {
                x: 0,
                y: 0
            },

            right: {
                x: 0,
                y: 0
            }
        };


        /*
         * Pole points are currently kept as stable
         * anatomical references.
         *
         * They will later be derived from the
         * gravity frame / movement frame.
         */

        this.poleLeft = {
            x: 0,
            y: 0
        };


        this.poleRight = {
            x: 0,
            y: 0
        };


        this.initialized =
            false;
    }


    // =====================================================
    // INITIALIZATION
    // =====================================================

    initialize(
        position,
        surface = null,
        surfaceT = 0
    ) {

        if (position) {

            this.position.x =
                finite(
                    position.x,
                    this.position.x
                );

            this.position.y =
                finite(
                    position.y,
                    this.position.y
                );
        }


        this.currentSurface =
            surface;

        this.currentSurfaceT =
            finite(
                surfaceT,
                0
            );


        if (surface) {

            const frame =
                surface.getFrame(
                    this.currentSurfaceT
                );

            this.position.x =
                frame.position.x;

            this.position.y =
                frame.position.y;
        }


        /*
         * Root first.
         */

        this.skeleton.setRootPosition(
            this.position.x,
            this.position.y
        );


        this.skeleton.setRootAngle(
            this.moveAngle
        );


        /*
         * Root placement only.
         * Upper body is owned by FBC.
         */

        this.updateSkeletonBase();


        /*
         * FK is required here because Gait initializes
         * from the actual ankle world positions.
         */

        this.skeleton.updateWorldTransforms();


        /*
         * Start procedural systems from a clean state.
         */

        this.fullBody.reset();
        this.bodyState.reset();


        /*
         * Gait must read actual ankle positions.
         */

        if (surface) {

            const frame =
                surface.getFrame(
                    this.currentSurfaceT
                );


            this.gait.initialize(
                this.position,
                frame.tangent,
                frame.normal,
                surface,
                this.currentSurfaceT
            );

        } else {

            this.gait.initialize(
                this.position,

                {
                    x:
                        Math.cos(
                            this.moveAngle
                        ),

                    y:
                        Math.sin(
                            this.moveAngle
                        )
                },

                {
                    x: 0,
                    y: -1
                },

                null,
                0
            );
        }


        this.initialized =
            true;
    }


    // =====================================================
    // PATH
    // =====================================================

    setPath(path) {

        if (
            !Array.isArray(path)
        ) {

            this.path = [];
            this.pathIndex = 0;
            this.isMoving = false;

            return;
        }


        this.path =
            path
                .filter(Boolean)
                .map(
                    point => ({

                        x:
                            finite(
                                point.x,
                                0
                            ),

                        y:
                            finite(
                                point.y,
                                0
                            ),

                        surface:
                            point.surface ||
                            null,

                        t:
                            finite(
                                point.t,
                                0
                            )
                    })
                );


        this.pathIndex = 0;


        this.isMoving =
            this.path.length > 0;


        this.animation.setState(

            this.isMoving
                ? ANIMATION_STATES.WALK
                : ANIMATION_STATES.IDLE
        );
    }


    clearPath() {

        this.path = [];
        this.pathIndex = 0;

        this.isMoving = false;

        this.velocity.x = 0;
        this.velocity.y = 0;


        this.animation.setState(
            ANIMATION_STATES.IDLE
        );
    }


    // =====================================================
    // LOOK
    // =====================================================

    setLookTarget(target) {

        if (!target) {

            this.lookTarget =
                null;

            return;
        }


        this.lookTarget = {

            x:
                finite(
                    target.x,
                    this.position.x
                ),

            y:
                finite(
                    target.y,
                    this.position.y
                )
        };
    }


    clearLookTarget() {

        this.lookTarget =
            null;

        this.targetLookAngle =
            this.moveAngle;
    }


    // =====================================================
    // SURFACE
    // =====================================================

    setSurface(
        surface,
        t = 0
    ) {

        this.currentSurface =
            surface;

        this.currentSurfaceT =
            finite(
                t,
                0
            );


        if (!surface) {
            return;
        }


        const frame =
            surface.getFrame(
                this.currentSurfaceT
            );


        this.position.x =
            frame.position.x;

        this.position.y =
            frame.position.y;


        this.skeleton.setRootPosition(
            this.position.x,
            this.position.y
        );


        this.skeleton.setRootAngle(
            this.moveAngle
        );


        /*
         * Root only.
         */

        this.updateSkeletonBase();


        /*
         * Gait initialization needs valid world
         * ankle positions after moving the root.
         */

        this.skeleton.updateWorldTransforms();


        this.gait.initialize(
            this.position,
            frame.tangent,
            frame.normal,
            surface,
            this.currentSurfaceT
        );
    }


    updateSurfaceFromPathPoint(point) {

        if (
            !point ||
            !point.surface
        ) {
            return;
        }


        if (
            point.surface !==
            this.currentSurface
        ) {

            this.setSurface(
                point.surface,
                point.t
            );
        }
    }


    // =====================================================
    // UPDATE
    // =====================================================

    update(dt) {

        const safeDt =
            Math.max(
                0,
                finite(dt, 0)
            );


        if (!this.initialized) {
            return;
        }


        this.animation.update(
            safeDt
        );


        const previousX =
            this.position.x;

        const previousY =
            this.position.y;


        // -------------------------------------------------
        // MOVEMENT
        // -------------------------------------------------

        this.updateMovement(
            safeDt
        );


        const dx =
            this.position.x -
            previousX;

        const dy =
            this.position.y -
            previousY;


        const frameDistance =
            Math.hypot(
                dx,
                dy
            );


        this.travelledDistance +=
            frameDistance;


        // -------------------------------------------------
        // FACING / LOOK
        // -------------------------------------------------

        this.updateDirection(
            safeDt,
            dx,
            dy
        );


        this.updateLook(
            safeDt
        );


        // -------------------------------------------------
        // ROOT
        // -------------------------------------------------

        /*
         * Character owns only root placement.
         *
         * FBC owns upper body.
         * Gait + IK own legs.
         */

        this.updateSkeletonBase();


        /*
         * Root has changed.
         *
         * Update world transforms before systems that
         * read world-space skeleton data.
         */

        this.skeleton.updateWorldTransforms();


        // -------------------------------------------------
        // GAIT
        // -------------------------------------------------

        /*
         * Gait creates / updates foot targets and
         * step state.
         */

        const gaitResult =
            this.updateGait(
                safeDt,
                frameDistance
            );


        // -------------------------------------------------
        // BODY STATE — CONTACTS
        // -------------------------------------------------

        /*
         * Gait reports which feet are actually planted.
         *
         * BodyState must know this before it recomputes
         * COM / balance, otherwise balance is never
         * supported and FullBodyController never receives
         * a real weight / stability signal.
         *
         * Order:
         *
         * setFootContact
         *   -> marks contact + updates contact point
         *
         * setFootPlanted
         *   -> marks planted (requires contact)
         *
         * setFootWeight
         *   -> distributes weight between feet
         */

        const leftPlanted =
            gaitResult.leftPlanted === true;

        const rightPlanted =
            gaitResult.rightPlanted === true;


        this.bodyState.setFootContact(
            "left",
            leftPlanted,
            gaitResult.left
        );

        this.bodyState.setFootPlanted(
            "left",
            leftPlanted
        );


        this.bodyState.setFootContact(
            "right",
            rightPlanted,
            gaitResult.right
        );

        this.bodyState.setFootPlanted(
            "right",
            rightPlanted
        );


        let leftWeight =
            0;

        let rightWeight =
            0;


        if (
            leftPlanted &&
            rightPlanted
        ) {

            leftWeight = 0.5;
            rightWeight = 0.5;

        } else if (leftPlanted) {

            leftWeight = 1;
            rightWeight = 0;

        } else if (rightPlanted) {

            leftWeight = 0;
            rightWeight = 1;
        }


        this.bodyState.setFootWeight(
            leftWeight,
            rightWeight
        );


        // -------------------------------------------------
        // BODY STATE — DERIVED
        // -------------------------------------------------

        /*
         * BodyState computes COM / balance from the
         * current Skeleton world transforms and the
         * contact / weight state above.
         */

        this.bodyState.update();


        // -------------------------------------------------
        // FULL BODY
        // -------------------------------------------------

        const instantSpeed =
            Math.hypot(
                this.velocity.x,
                this.velocity.y
            );


        this.fullBody.update(
            safeDt,
            {
                speed:
                    instantSpeed,

                isMoving:
                    this.isMoving,

                moveAngle:
                    this.moveAngle,

                lookAngle:
                    this.lookAngle
            }
        );


        /*
         * FBC has now changed upper-body local angles.
         *
         * Update world transforms so IK receives
         * the current complete pre-IK pose.
         */

        this.skeleton.updateWorldTransforms();


        // -------------------------------------------------
        // LEG IK
        // -------------------------------------------------

        /*
         * IK modifies only leg joint angles.
         *
         * Skeleton.setWorldBoneAngle() currently performs
         * its own FK internally. This is intentional for
         * compatibility with the existing Skeleton API.
         */

        this.applyLegIK(
            gaitResult
        );


        // -------------------------------------------------
        // FINAL FK
        // -------------------------------------------------

        /*
         * Final authoritative world pose for the frame.
         */

        this.skeleton.updateWorldTransforms();
    }


    // =====================================================
    // MOVEMENT
    // =====================================================

    updateMovement(dt) {

        if (
            !this.isMoving ||
            this.pathIndex >=
            this.path.length
        ) {

            this.velocity.x = 0;
            this.velocity.y = 0;

            this.isMoving = false;


            if (
                !this.animation.is(
                    ANIMATION_STATES.IDLE
                )
            ) {

                this.animation.setState(
                    ANIMATION_STATES.IDLE
                );
            }


            return;
        }


        const waypoint =
            this.path[
                this.pathIndex
            ];


        const stepDistance =
            this.speed * dt;


        // -------------------------------------------------
        // SAME SURFACE
        // -------------------------------------------------

        if (
            waypoint.surface &&
            waypoint.surface ===
            this.currentSurface
        ) {

            const surface =
                this.currentSurface;


            const targetT =
                Math.max(
                    0,
                    Math.min(
                        1,
                        waypoint.t
                    )
                );


            const currentT =
                Math.max(
                    0,
                    Math.min(
                        1,
                        this.currentSurfaceT
                    )
                );


            const currentDistance =
                surface.tToDistance(
                    currentT
                );


            const targetDistance =
                surface.tToDistance(
                    targetT
                );


            const remaining =
                targetDistance -
                currentDistance;


            if (
                Math.abs(
                    remaining
                ) <=
                Math.max(
                    0.001,
                    stepDistance
                )
            ) {

                const frame =
                    surface.getFrame(
                        targetT
                    );


                this.position.x =
                    frame.position.x;

                this.position.y =
                    frame.position.y;

                this.currentSurfaceT =
                    targetT;


                this.velocity.x = 0;
                this.velocity.y = 0;


                this.pathIndex++;


                if (
                    this.pathIndex >=
                    this.path.length
                ) {

                    this.clearPath();
                }


                return;
            }


            const directionT =
                remaining > 0
                    ? 1
                    : -1;


            const nextDistance =
                currentDistance +
                directionT *
                stepDistance;


            const nextT =
                surface.distanceToT(
                    nextDistance
                );


            const frame =
                surface.getFrame(
                    nextT
                );


            const previous = {

                x:
                    this.position.x,

                y:
                    this.position.y
            };


            this.position.x =
                frame.position.x;

            this.position.y =
                frame.position.y;

            this.currentSurfaceT =
                nextT;


            const moveDx =
                this.position.x -
                previous.x;

            const moveDy =
                this.position.y -
                previous.y;


            const actualStep =
                Math.hypot(
                    moveDx,
                    moveDy
                );


            if (
                actualStep >
                0.000001 &&
                dt >
                0.000001
            ) {

                this.velocity.x =
                    moveDx / dt;

                this.velocity.y =
                    moveDy / dt;

            } else {

                this.velocity.x =
                    frame.tangent.x *
                    this.speed *
                    directionT;

                this.velocity.y =
                    frame.tangent.y *
                    this.speed *
                    directionT;
            }


            this.targetMoveAngle =
                Math.atan2(
                    frame.tangent.y *
                    directionT,

                    frame.tangent.x *
                    directionT
                );


            return;
        }


        // -------------------------------------------------
        // SURFACE TRANSITION
        // -------------------------------------------------

        if (
            waypoint.surface &&
            waypoint.surface !==
            this.currentSurface
        ) {

            this.setSurface(
                waypoint.surface,
                waypoint.t
            );


            this.pathIndex++;


            if (
                this.pathIndex >=
                this.path.length
            ) {

                this.clearPath();
            }


            return;
        }


        // -------------------------------------------------
        // FREE MOVEMENT
        // -------------------------------------------------

        const dx =
            waypoint.x -
            this.position.x;

        const dy =
            waypoint.y -
            this.position.y;


        const d =
            Math.hypot(
                dx,
                dy
            );


        if (
            d <=
            Math.max(
                4,
                stepDistance
            )
        ) {

            this.position.x =
                waypoint.x;

            this.position.y =
                waypoint.y;


            this.pathIndex++;


            if (
                this.pathIndex >=
                this.path.length
            ) {

                this.clearPath();
            }


            return;
        }


        const direction =
            normalize(
                dx,
                dy,
                Math.cos(
                    this.moveAngle
                ),
                Math.sin(
                    this.moveAngle
                )
            );


        const step =
            Math.min(
                stepDistance,
                d
            );


        this.velocity.x =
            direction.x *
            this.speed;

        this.velocity.y =
            direction.y *
            this.speed;


        this.position.x +=
            direction.x *
            step;

        this.position.y +=
            direction.y *
            step;


        this.targetMoveAngle =
            Math.atan2(
                direction.y,
                direction.x
            );
    }


    // =====================================================
    // DIRECTION
    // =====================================================

    updateDirection(
        dt,
        dx,
        dy
    ) {

        if (
            Math.abs(dx) >
            0.0001 ||
            Math.abs(dy) >
            0.0001
        ) {

            this.targetMoveAngle =
                Math.atan2(
                    dy,
                    dx
                );
        }


        this.moveAngle =
            dampAngle(
                this.moveAngle,
                this.targetMoveAngle,
                this.turnSpeed,
                dt
            );
    }


    // =====================================================
    // LOOK
    // =====================================================

    updateLook(dt) {

        if (this.lookTarget) {

            const dx =
                this.lookTarget.x -
                this.position.x;

            const dy =
                this.lookTarget.y -
                this.position.y;


            if (
                Math.abs(dx) >
                0.001 ||
                Math.abs(dy) >
                0.001
            ) {

                this.targetLookAngle =
                    Math.atan2(
                        dy,
                        dx
                    );
            }

        } else {

            this.targetLookAngle =
                this.moveAngle;
        }


        this.lookAngle =
            dampAngle(
                this.lookAngle,
                this.targetLookAngle,
                this.lookTurnSpeed,
                dt
            );
    }


    // =====================================================
    // BASE POSE
    // =====================================================

    updateSkeletonBase() {

        /*
         * Root placement only.
         *
         * Upper body:
         * FullBodyController
         *
         * Legs:
         * Gait + IK
         *
         * FK:
         * Skeleton
         */

        this.skeleton.setRootPosition(
            this.position.x,
            this.position.y
        );


        this.skeleton.setRootAngle(
            this.moveAngle
        );
    }


    // =====================================================
    // GAIT
    // =====================================================

    updateGait(
        dt,
        frameDistance
    ) {

        let tangent = {

            x:
                Math.cos(
                    this.moveAngle
                ),

            y:
                Math.sin(
                    this.moveAngle
                )
        };


        let normal = {

            x:
                -tangent.y,

            y:
                tangent.x
        };


        if (
            this.currentSurface
        ) {

            const frame =
                this.currentSurface.getFrame(
                    this.currentSurfaceT
                );


            tangent =
                frame.tangent;

            normal =
                frame.normal;
        }


        const result =
            this.gait.update(
                dt,
                frameDistance,
                this.position,
                tangent,
                normal,
                this.currentSurface,
                this.currentSurfaceT,
                this.isMoving
            );


        this.footTargets.left = {

            x:
                result.left.x,

            y:
                result.left.y
        };


        this.footTargets.right = {

            x:
                result.right.x,

            y:
                result.right.y
        };


        return result;
    }


    // =====================================================
    // LEG IK
    // =====================================================

    applyLegIK(gaitResult) {

        if (!gaitResult) {
            return;
        }


        this.solveLeg(

            "thighL",
            "shinL",
            "ankleL",

            gaitResult.left,

            this.poleLeft
        );


        this.solveLeg(

            "thighR",
            "shinR",
            "ankleR",

            gaitResult.right,

            this.poleRight
        );
    }


    solveLeg(
        thighName,
        shinName,
        ankleName,
        target,
        pole
    ) {

        const thigh =
            this.skeleton.getBone(
                thighName
            );

        const shin =
            this.skeleton.getBone(
                shinName
            );

        const ankle =
            this.skeleton.getBone(
                ankleName
            );


        if (
            !thigh ||
            !shin ||
            !ankle
        ) {

            return;
        }


        const upperLength =
            this.skeleton.getAnatomicalLength(
                thighName
            );


        const lowerLength =
            this.skeleton.getAnatomicalLength(
                shinName
            );


        /*
         * Hip is the actual thigh origin
         * from the current world pose.
         */

        const hipPosition = {

            x:
                thigh.worldX,

            y:
                thigh.worldY
        };


        const result =
            solveTwoBoneIK(

                hipPosition,

                target,

                upperLength,

                lowerLength,

                pole,

                {
                    minReach: 1
                }
            );


        /*
         * IK changes only orientations.
         *
         * Skeleton.setWorldBoneAngle() converts the
         * world angle into local space and immediately
         * refreshes world transforms.
         */

        this.skeleton.setWorldBoneAngle(

            thighName,

            result.hipAngle
        );


        this.skeleton.setWorldBoneAngle(

            shinName,

            result.kneeAngle
        );


        /*
         * Foot stays physically attached to ankle.
         *
         * It receives its anatomical rest orientation.
         * Its position is never teleported.
         */

        const footName =
            thighName === "thighL"
                ? "footL"
                : "footR";


        const foot =
            this.skeleton.getBone(
                footName
            );


        if (foot) {

            foot.localAngle =
                foot.restAngle;
        }


        /*
         * Keep current Skeleton behaviour.
         *
         * setWorldBoneAngle() already performs FK,
         * and this explicit pass preserves the existing
         * Character / IK behaviour.
         */

        this.skeleton.updateWorldTransforms();
    }


    // =====================================================
    // PUBLIC MOVEMENT
    // =====================================================

    moveTo(
        target,
        duration = 0
    ) {

        if (!target) {
            return;
        }


        const dx =
            target.x -
            this.position.x;

        const dy =
            target.y -
            this.position.y;


        const d =
            Math.hypot(
                dx,
                dy
            );


        if (
            d <
            0.001
        ) {

            return;
        }


        if (
            duration >
            0
        ) {

            this.speed =
                d /
                duration;
        }


        this.targetMoveAngle =
            Math.atan2(
                dy,
                dx
            );


        this.isMoving =
            true;


        this.animation.setState(
            ANIMATION_STATES.WALK
        );
    }


    stop() {

        this.clearPath();
    }


    // =====================================================
    // RESET
    // =====================================================

    reset() {

        this.position.x = 0;
        this.position.y = 0;


        this.moveAngle = 0;
        this.lookAngle = 0;


        this.targetMoveAngle = 0;
        this.targetLookAngle = 0;


        this.velocity.x = 0;
        this.velocity.y = 0;


        this.travelledDistance =
            0;


        this.path = [];
        this.pathIndex = 0;


        this.currentSurface =
            null;

        this.currentSurfaceT =
            0;


        this.lookTarget =
            null;


        this.isMoving =
            false;


        this.gait.reset();

        this.animation.reset();


        /*
         * Reset procedural state before restoring
         * anatomical rest pose.
         */

        this.bodyState.reset();

        this.fullBody.reset();


        /*
         * Reset to true anatomical rest pose.
         */

        this.skeleton.resetPose();


        this.skeleton.setRootPosition(
            0,
            0
        );


        this.skeleton.setRootAngle(
            0
        );


        this.skeleton.updateWorldTransforms();


        this.initialized =
            false;
    }


    // =====================================================
    // STATE
    // =====================================================

    getState() {

        return this.animation.getState();
    }


    getWorldPosition() {

        return {

            x:
                this.position.x,

            y:
                this.position.y
        };
    }


    getVelocity() {

        return {

            x:
                this.velocity.x,

            y:
                this.velocity.y
        };
    }


    getFootTargets() {

        return {

            left: {

                x:
                    this.footTargets.left.x,

                y:
                    this.footTargets.left.y
            },

            right: {

                x:
                    this.footTargets.right.x,

                y:
                    this.footTargets.right.y
            }
        };
    }


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        const skeleton =
            this.skeleton.validate();


        const gait =
            this.gait.validate();


        return {

            valid:

                skeleton.valid &&

                gait.valid &&

                Number.isFinite(
                    this.position.x
                ) &&

                Number.isFinite(
                    this.position.y
                ),


            skeleton,

            gait,


            position: {

                x:
                    this.position.x,

                y:
                    this.position.y
            },


            state:
                this.animation.snapshot()
        };
    }
}


export default Character;
