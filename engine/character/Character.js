// ASTRAWAY 2.0
// Character controller
//
// Combines:
// Skeleton + IK + Gait + Animation State Machine
//
// Important:
// Character does not know anything about Canvas.
// It works entirely in world coordinates.

import Skeleton from "./Skeleton.js";

import {
    solveTwoBoneIK
} from "./IK.js";

import Gait from "./Gait.js";

import AnimationStateMachine, {
    ANIMATION_STATES
} from "./AnimationStateMachine.js";

import {
    clamp,
    damp,
    dampAngle,
    distance,
    finite,
    normalize,
    normalizeAngle,
    shortestAngleDelta
} from "./MathUtils.js";


export class Character {

    constructor(options = {}) {

        this.position = {
            x: finite(options.x, 0),
            y: finite(options.y, 0)
        };


        this.moveAngle =
            finite(options.angle, 0);

        this.lookAngle =
            this.moveAngle;


        this.targetMoveAngle =
            this.moveAngle;

        this.targetLookAngle =
            this.lookAngle;


        this.speed =
            Math.max(
                1,
                finite(options.speed, 90)
            );


        this.turnSpeed =
            Math.max(
                0.01,
                finite(options.turnSpeed, 10)
            );


        this.lookTurnSpeed =
            Math.max(
                0.01,
                finite(options.lookTurnSpeed, 8)
            );


        this.velocity = {
            x: 0,
            y: 0
        };


        this.travelledDistance = 0;


        this.isMoving = false;


        this.currentSurface = null;

        this.currentSurfaceT = 0;


        this.path = [];

        this.pathIndex = 0;


        this.lookTarget = null;


        this.skeleton =
            new Skeleton();


        this.gait =
            new Gait({

                stepLength:
                    finite(
                        options.stepLength,
                        30
                    ),

                stepWidth:
                    finite(
                        options.stepWidth,
                        18
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


        this.poleLeft = {
            x: 0,
            y: 0
        };

        this.poleRight = {
            x: 0,
            y: 0
        };


        this.initialized = false;
    }


    // -----------------------------------------------------
    // INITIALIZATION
    // -----------------------------------------------------

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


        this.skeleton.setRootPosition(
            this.position.x,
            this.position.y
        );

        this.skeleton.setRootAngle(
            this.moveAngle
        );


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
        }


        this.updateSkeletonBase();

        this.initialized = true;
    }


    // -----------------------------------------------------
    // PATH
    // -----------------------------------------------------

    setPath(path) {

        if (!Array.isArray(path)) {

            this.path = [];

            this.pathIndex = 0;

            return;
        }


        this.path =
            path
                .filter(Boolean)
                .map(point => ({

                    x: finite(point.x, 0),

                    y: finite(point.y, 0),

                    surface:
                        point.surface ||
                        null,

                    t:
                        finite(point.t, 0)
                }));


        this.pathIndex = 0;


        this.isMoving =
            this.path.length > 0;


        if (this.isMoving) {

            this.animation.setState(
                ANIMATION_STATES.WALK
            );
        }
        else {

            this.animation.setState(
                ANIMATION_STATES.IDLE
            );
        }
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


    // -----------------------------------------------------
    // LOOK
    // -----------------------------------------------------

    setLookTarget(target) {

        if (!target) {

            this.lookTarget = null;

            return;
        }


        this.lookTarget = {

            x: finite(target.x, this.position.x),

            y: finite(target.y, this.position.y)
        };
    }


    clearLookTarget() {

        this.lookTarget = null;

        this.targetLookAngle =
            this.moveAngle;
    }


    // -----------------------------------------------------
    // SURFACE
    // -----------------------------------------------------

    setSurface(
        surface,
        t = 0
    ) {

        this.currentSurface =
            surface;

        this.currentSurfaceT =
            finite(t, 0);


        if (!surface) {
            return;
        }


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
    }


    updateSurfaceFromPathPoint(point) {

        if (!point) {
            return;
        }


        if (
            point.surface &&
            point.surface !==
            this.currentSurface
        ) {

            this.setSurface(
                point.surface,
                point.t
            );

            return;
        }


        if (point.surface) {

            this.currentSurfaceT =
                finite(
                    point.t,
                    this.currentSurfaceT
                );
        }
    }


    // -----------------------------------------------------
    // MOVEMENT
    // -----------------------------------------------------

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


        this.updateDirection(
            safeDt,
            dx,
            dy
        );


        this.updateLook(
            safeDt
        );


        this.updateSkeletonBase();


        const gaitResult =
            this.updateGait(
                safeDt,
                frameDistance
            );


        this.applyLegIK(
            gaitResult
        );


        this.skeleton.updateWorldTransforms();
    }


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


        this.updateSurfaceFromPathPoint(
            waypoint
        );


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


        const reachDistance =
            Math.max(
                4,
                this.speed * dt
            );


        if (
            d <= reachDistance
        ) {

            this.position.x =
                waypoint.x;

            this.position.y =
                waypoint.y;


            this.currentSurfaceT =
                finite(
                    waypoint.t,
                    this.currentSurfaceT
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


        const direction =
            normalize(
                dx,
                dy,
                Math.cos(this.moveAngle),
                Math.sin(this.moveAngle)
            );


        const step =
            Math.min(
                this.speed * dt,
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


        // If the path point belongs to a surface,
        // keep surface parameter synchronized.

        if (
            waypoint.surface
        ) {

            this.currentSurface =
                waypoint.surface;

            this.currentSurfaceT =
                waypoint.surface.projectT(
                    this.position
                );
        }
    }


    // -----------------------------------------------------
    // BODY DIRECTION
    // -----------------------------------------------------

    updateDirection(
        dt,
        dx,
        dy
    ) {

        if (
            Math.abs(dx) > 0.0001 ||
            Math.abs(dy) > 0.0001
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


        if (
            Math.abs(
                shortestAngleDelta(
                    this.moveAngle,
                    this.targetMoveAngle
                )
            ) > 0.08 &&
            this.isMoving
        ) {

            if (
                this.animation.is(
                    ANIMATION_STATES.WALK
                )
            ) {

                // Keep walking state.
                // Turning is represented continuously
                // through the body angle.
            }
        }
    }


    // -----------------------------------------------------
    // HEAD / UPPER BODY LOOK
    // -----------------------------------------------------

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
        }
        else {

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


    // -----------------------------------------------------
    // SKELETON BASE POSE
    // -----------------------------------------------------

    updateSkeletonBase() {

        this.skeleton.setRootPosition(
            this.position.x,
            this.position.y
        );

        this.skeleton.setRootAngle(
            this.moveAngle
        );


        // Upper body follows look direction.
        // Skeleton handles local/world conversion.

        const lookOffset =
            shortestAngleDelta(
                this.moveAngle,
                this.lookAngle
            );


        const chest =
            this.skeleton.getBone(
                "chest"
            );

        const neck =
            this.skeleton.getBone(
                "neck"
            );

        const head =
            this.skeleton.getBone(
                "head"
            );


        if (chest) {

            chest.localAngle =
                clamp(
                    lookOffset * 0.22,
                    -0.35,
                    0.35
                );
        }


        if (neck) {

            neck.localAngle =
                clamp(
                    lookOffset * 0.45,
                    -0.65,
                    0.65
                );
        }


        if (head) {

            head.localAngle =
                clamp(
                    lookOffset * 0.35,
                    -0.65,
                    0.65
                );
        }


        this.skeleton.updateWorldTransforms();
    }


    // -----------------------------------------------------
    // GAIT
    // -----------------------------------------------------

    updateGait(
        dt,
        travelledDistance
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

            x: -tangent.y,

            y: tangent.x
        };


        if (this.currentSurface) {

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
                travelledDistance,
                this.position,
                tangent,
                normal,
                this.currentSurface,
                this.currentSurfaceT,
                this.isMoving
            );


        this.footTargets.left =
            result.left;

        this.footTargets.right =
            result.right;


        return result;
    }


    // -----------------------------------------------------
    // LEG IK
    // -----------------------------------------------------

    applyLegIK(
        gaitResult
    ) {

        if (!gaitResult) {
            return;
        }


        const leftHip =
            this.skeleton.getBone(
                "hipL"
            );

        const rightHip =
            this.skeleton.getBone(
                "hipR"
            );


        if (!leftHip || !rightHip) {
            return;
        }


        const leftPole =
            this.makeKneePole(
                "left"
            );

        const rightPole =
            this.makeKneePole(
                "right"
            );


        // -----------------------------------------------
        // Left leg
        // -----------------------------------------------

        this.solveLeg(
            "hipL",
            "kneeL",
            "ankleL",
            this.footTargets.left,
            leftPole,
            "left"
        );


        // -----------------------------------------------
        // Right leg
        // -----------------------------------------------

        this.solveLeg(
            "hipR",
            "kneeR",
            "ankleR",
            this.footTargets.right,
            rightPole,
            "right"
        );
    }


    solveLeg(
        hipName,
        kneeName,
        ankleName,
        target,
        pole,
        side
    ) {

        const hip =
            this.skeleton.getBone(
                hipName
            );

        const knee =
            this.skeleton.getBone(
                kneeName
            );

        const ankle =
            this.skeleton.getBone(
                ankleName
            );


        if (
            !hip ||
            !knee ||
            !ankle
        ) {

            return;
        }


        const hipPosition =
            hip.getWorldPosition();


        // Actual skeleton segment lengths.
        //
        // hip -> knee
        // knee -> ankle

        const upperLength =
            Math.max(
                1,
                distance(
                    hipPosition,
                    knee.getWorldPosition()
                )
            );


        const lowerLength =
            Math.max(
                1,
                distance(
                    knee.getWorldPosition(),
                    ankle.getWorldPosition()
                )
            );


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


        this.skeleton.setWorldBoneAngle(
            hipName,
            result.hipAngle
        );


        this.skeleton.setWorldBoneAngle(
            kneeName,
            result.kneeAngle
        );


        this.skeleton.updateWorldTransforms();


        this.skeleton.setWorldBonePosition(
            ankleName,
            result.ankle.x,
            result.ankle.y
        );


        this.skeleton.updateWorldTransforms();


        // Keep foot attached to ankle orientation.
        const foot =
            this.skeleton.getBone(
                side === "left"
                    ? "footL"
                    : "footR"
            );


        if (foot) {

            foot.localAngle = 0;
        }
    }


    makeKneePole(side) {

        const tangent = {

            x:
                Math.cos(
                    this.moveAngle
                ),

            y:
                Math.sin(
                    this.moveAngle
                )
        };


        const normal = {

            x: -tangent.y,

            y: tangent.x
        };


        const sideSign =
            side === "left"
                ? 1
                : -1;


        return {

            x:
                this.position.x +
                normal.x *
                45 *
                sideSign,

            y:
                this.position.y +
                normal.y *
                45 *
                sideSign
        };
    }


    // -----------------------------------------------------
    // EXTERNAL CONTROL
    // -----------------------------------------------------

    setPosition(x, y) {

        this.position.x =
            finite(x, this.position.x);

        this.position.y =
            finite(y, this.position.y);


        this.skeleton.setRootPosition(
            this.position.x,
            this.position.y
        );
    }


    setMovementDirection(
        x,
        y
    ) {

        const direction =
            normalize(
                x,
                y,
                Math.cos(this.moveAngle),
                Math.sin(this.moveAngle)
            );


        this.targetMoveAngle =
            Math.atan2(
                direction.y,
                direction.x
            );
    }


    setLookDirection(
        x,
        y
    ) {

        const direction =
            normalize(
                x,
                y,
                Math.cos(this.lookAngle),
                Math.sin(this.lookAngle)
            );


        this.targetLookAngle =
            Math.atan2(
                direction.y,
                direction.x
            );


        this.lookTarget = null;
    }


    stop() {

        this.clearPath();
    }


    reset() {

        this.position.x = 0;

        this.position.y = 0;

        this.moveAngle = 0;

        this.lookAngle = 0;

        this.targetMoveAngle = 0;

        this.targetLookAngle = 0;

        this.velocity.x = 0;

        this.velocity.y = 0;

        this.travelledDistance = 0;

        this.path = [];

        this.pathIndex = 0;

        this.currentSurface = null;

        this.currentSurfaceT = 0;

        this.lookTarget = null;

        this.isMoving = false;

        this.gait.reset();

        this.animation.reset();

        this.skeleton.resetPose();

        this.skeleton.setRootPosition(
            0,
            0
        );

        this.skeleton.setRootAngle(
            0
        );

        this.skeleton.updateWorldTransforms();

        this.initialized = false;
    }


    // -----------------------------------------------------
    // STATE
    // -----------------------------------------------------

    getState() {

        return this.animation.getState();
    }


    getWorldPosition() {

        return {

            x: this.position.x,

            y: this.position.y
        };
    }


    getVelocity() {

        return {

            x: this.velocity.x,

            y: this.velocity.y
        };
    }


    getFootTargets() {

        return {

            left: {
                x: this.footTargets.left.x,
                y: this.footTargets.left.y
            },

            right: {
                x: this.footTargets.right.x,
                y: this.footTargets.right.y
            }
        };
    }


    validate() {

        const skeletonValid =
            this.skeleton.validate();


        return {

            valid:
                skeletonValid.valid &&
                finite(this.position.x) &&
                finite(this.position.y),

            skeleton:
                skeletonValid,

            position:
                {
                    x: this.position.x,
                    y: this.position.y
                },

            state:
                this.animation.snapshot()
        };
    }
}


export default Character;
