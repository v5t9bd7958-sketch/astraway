// ASTRAWAY 2.0
// Character controller.
//
// Architecture (Phase 1):
//
// Character
// ├─ Skeleton            = anatomy / hierarchy / rest pose
// ├─ Gait                = locomotion / foot targets (WalkPattern)
// ├─ BodyState           = COM / contacts / balance (facts)
// ├─ SupportConstraint   = permission / stepDemand
// ├─ FullBodyController  = upper-body offsets producer
// ├─ PoseComposer        = единственный writer локальной позы + IK
// ├─ IK                  = mathematical leg solving
// └─ Animation           = state machine
//
// Character owns:
// - movement
// - facing
// - look
// - root position / root angle
// - orchestration order
//
// Character does NOT own:
// - anatomical hierarchy
// - bone lengths
// - upper-body procedural offsets (FullBodyController)
// - COM / balance math (BodyState)
// - support constraint math (SupportConstraint)
// - final local pose writing (PoseComposer)
// - rendering

import Skeleton from "./Skeleton.js";
import { solveTwoBoneIK } from "./IK.js";
import Gait from "./Gait.js";
import BodyState from "./BodyState.js";
import SupportConstraint from "./SupportConstraint.js";
import FullBodyController from "./FullBodyController.js";
import PoseComposer from "./PoseComposer.js";
import AnimationStateMachine, {
    ANIMATION_STATES
} from "./AnimationStateMachine.js";

import {
    clamp01,
    dampAngle,
    finite,
    normalize
} from "./MathUtils.js";

export class Character {

    constructor(options = {}) {

        this.position = {
            x: finite(options.x, 0),
            y: finite(options.y, 0)
        };

        this.moveAngle = finite(options.angle, 0);
        this.lookAngle = this.moveAngle;
        this.targetMoveAngle = this.moveAngle;
        this.targetLookAngle = this.lookAngle;

        this.speed = Math.max(1, finite(options.speed, 90));
        this.turnSpeed = Math.max(0.01, finite(options.turnSpeed, 10));
        this.lookTurnSpeed = Math.max(0.01, finite(options.lookTurnSpeed, 8));

        this.velocity = { x: 0, y: 0 };
        this.travelledDistance = 0;
        this.isMoving = false;

        this.currentSurface = null;
        this.currentSurfaceT = 0;

        this.path = [];
        this.pathIndex = 0;

        this.lookTarget = null;

        // =================================================
        // CORE SYSTEMS
        // =================================================

        this.skeleton = new Skeleton();

        this.gait = new Gait({
            stepLength: finite(options.stepLength, 30),
            stepHeight: finite(options.stepHeight, 11),
            stepDuration: finite(options.stepDuration, 0.18)
        });

        this.gait.bindSkeleton(this.skeleton);

        this.bodyState = new BodyState(this.skeleton);

        this.supportConstraint = new SupportConstraint(
            this.skeleton,
            this.gait,
            {
                reserve: 0.05,
                softStart: 0.85
            }
        );

        this.fullBody = new FullBodyController(
            this.skeleton,
            this.bodyState,
            {
                gait: this.gait
            }
        );

        this.poseComposer = new PoseComposer(this.skeleton);

        this.animation = new AnimationStateMachine();

        this.footTargets = {
            left: { x: 0, y: 0 },
            right: { x: 0, y: 0 }
        };

        this.poleLeft = { x: 0, y: 0 };
        this.poleRight = { x: 0, y: 0 };

        this.initialized = false;

        this.rootSupportOffset = finite(
            options.rootSupportOffset,
            -69
        );
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================

    initialize(position, surface = null, surfaceT = 0) {

        if (position) {
            this.position.x = finite(position.x, this.position.x);
            this.position.y = finite(position.y, this.position.y);
        }

        this.currentSurface = surface;
        this.currentSurfaceT = finite(surfaceT, 0);

        if (surface) {
            const frame = surface.getFrame(this.currentSurfaceT);
            this.position.x = frame.position.x;
            this.position.y = frame.position.y;
        }

        this.updateSkeletonBase();
        this.skeleton.setRootAngle(this.moveAngle);
        this.skeleton.updateWorldTransforms();

        this.fullBody.reset();
        this.bodyState.reset();
        this.supportConstraint.reset();

        if (surface) {
            const frame = surface.getFrame(this.currentSurfaceT);
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
                    x: Math.cos(this.moveAngle),
                    y: Math.sin(this.moveAngle)
                },
                { x: 0, y: -1 },
                null,
                0
            );
        }

        this.initialized = true;
    }

    // =====================================================
    // PATH
    // =====================================================

    setPath(path) {

        if (!Array.isArray(path)) {
            this.path = [];
            this.pathIndex = 0;
            this.isMoving = false;
            return;
        }

        this.path = path
            .filter(Boolean)
            .map(point => ({
                x: finite(point.x, 0),
                y: finite(point.y, 0),
                surface: point.surface || null,
                t: finite(point.t, 0)
            }));

        this.pathIndex = 0;
        this.isMoving = this.path.length > 0;

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

        this.animation.setState(ANIMATION_STATES.IDLE);
    }

    // =====================================================
    // LOOK
    // =====================================================

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
        this.targetLookAngle = this.moveAngle;
    }

    // =====================================================
    // SURFACE
    // =====================================================

    setSurface(surface, t = 0) {

        this.currentSurface = surface;
        this.currentSurfaceT = finite(t, 0);

        if (!surface) {
            return;
        }

        const frame = surface.getFrame(this.currentSurfaceT);

        this.position.x = frame.position.x;
        this.position.y = frame.position.y;

        this.updateSkeletonBase();
        this.skeleton.setRootAngle(this.moveAngle);
        this.skeleton.updateWorldTransforms();

        this.gait.initialize(
            this.position,
            frame.tangent,
            frame.normal,
            surface,
            this.currentSurfaceT
        );

        this.supportConstraint.reset();
    }

    updateSurfaceFromPathPoint(point) {

        if (!point || !point.surface) {
            return;
        }

        if (point.surface !== this.currentSurface) {
            this.setSurface(point.surface, point.t);
        }
    }

    // =====================================================
    // UPDATE — PHASE A (DECISION) + PHASE B (MEASURE)
    // =====================================================

    update(dt) {

        const safeDt = Math.max(0, finite(dt, 0));

        if (!this.initialized) {
            return;
        }

        this.animation.update(safeDt);

        const previousX = this.position.x;
        const previousY = this.position.y;

        // -------------------------------------------------
        // PHASE A — DECISION
        // -------------------------------------------------

        // 1-3. Movement × permission (N-1)
        const progressionPermission =
            this.supportConstraint.getPermission();

        this.updateMovement(safeDt, progressionPermission);

        const dx = this.position.x - previousX;
        const dy = this.position.y - previousY;
        const frameDistance = Math.hypot(dx, dy);

        this.travelledDistance += frameDistance;

        // 4. Facing / Look
        this.updateDirection(safeDt, dx, dy);
        this.updateLook(safeDt);

        // 5. Root
        this.updateSkeletonBase();
        this.skeleton.updateWorldTransforms();

        // 6. Gait → MotionTargets
        const gaitResult = this.updateGait(safeDt, frameDistance);

        // 7. FullBodyController → upperBodyOffsets (producer)
        const instantSpeed = Math.hypot(
            this.velocity.x,
            this.velocity.y
        );

        const upperBodyOffsets = this.fullBody.update(safeDt, {
            speed: instantSpeed,
            isMoving: this.isMoving,
            moveAngle: this.moveAngle,
            lookAngle: this.lookAngle
        });

        // 8. PoseComposer — единственный writer + IK
        this.poseComposer.compose({
            motionTargets: {
                left: gaitResult.left,
                right: gaitResult.right
            },
            upperBodyOffsets,
            poleLeft: this.poleLeft,
            poleRight: this.poleRight
        });

        // 9. Final FK
        this.skeleton.updateWorldTransforms();

        // -------------------------------------------------
        // PHASE B — MEASURE (после финальной позы)
        // -------------------------------------------------

        // 10. Actual contact measurement from final world pose
        const leftFoot = this.skeleton.getBone("ankleL") ||
                         this.skeleton.getBone("footL");
        const rightFoot = this.skeleton.getBone("ankleR") ||
                          this.skeleton.getBone("footR");

        const leftPoint = leftFoot
            ? { x: leftFoot.worldX, y: leftFoot.worldY }
            : gaitResult.left;

        const rightPoint = rightFoot
            ? { x: rightFoot.worldX, y: rightFoot.worldY }
            : gaitResult.right;

        // Gait planted = intent, но точку берём из финальной позы
        const leftPlanted = !!gaitResult.leftPlanted;
        const rightPlanted = !!gaitResult.rightPlanted;

        this.bodyState.setFootContact(
            "left",
            leftPlanted,
            leftPoint
        );
        this.bodyState.setFootPlanted("left", leftPlanted);

        this.bodyState.setFootContact(
            "right",
            rightPlanted,
            rightPoint
        );
        this.bodyState.setFootPlanted("right", rightPlanted);

        let leftWeight = 0;
        let rightWeight = 0;

        if (leftPlanted && rightPlanted) {
            leftWeight = 0.5;
            rightWeight = 0.5;
        } else if (leftPlanted) {
            leftWeight = 1.0;
        } else if (rightPlanted) {
            rightWeight = 1.0;
        }

        this.bodyState.setFootWeight(leftWeight, rightWeight);

        // 11. BodyState (facts from final pose)
        this.bodyState.update();

        // 12. SupportConstraint → permission / stepDemand for N+1
        const supportState = this.supportConstraint.update();

        if (typeof this.gait.setStepDemand === "function") {
            this.gait.setStepDemand(supportState.stepDemand);
        }
    }

    // =====================================================
    // MOVEMENT
    // =====================================================

    updateMovement(dt, progressionPermission = 1) {

        if (
            !this.isMoving ||
            this.pathIndex >= this.path.length
        ) {
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.isMoving = false;

            if (!this.animation.is(ANIMATION_STATES.IDLE)) {
                this.animation.setState(ANIMATION_STATES.IDLE);
            }
            return;
        }

        const waypoint = this.path[this.pathIndex];

        const stepDistance =
            this.speed *
            dt *
            clamp01(finite(progressionPermission, 1));

        // SAME SURFACE
        if (
            waypoint.surface &&
            waypoint.surface === this.currentSurface
        ) {
            const surface = this.currentSurface;
            const targetT = Math.max(0, Math.min(1, waypoint.t));
            const currentT = Math.max(0, Math.min(1, this.currentSurfaceT));

            const currentDistance = surface.tToDistance(currentT);
            const targetDistance = surface.tToDistance(targetT);
            const remaining = targetDistance - currentDistance;

            if (Math.abs(remaining) <= Math.max(0.001, stepDistance)) {

                const frame = surface.getFrame(targetT);
                this.position.x = frame.position.x;
                this.position.y = frame.position.y;
                this.currentSurfaceT = targetT;
                this.velocity.x = 0;
                this.velocity.y = 0;
                this.pathIndex++;

                if (this.pathIndex >= this.path.length) {
                    this.clearPath();
                }
                return;
            }

            const directionT = remaining > 0 ? 1 : -1;
            const nextDistance = currentDistance + directionT * stepDistance;
            const nextT = surface.distanceToT(nextDistance);
            const frame = surface.getFrame(nextT);

            const previous = {
                x: this.position.x,
                y: this.position.y
            };

            this.position.x = frame.position.x;
            this.position.y = frame.position.y;
            this.currentSurfaceT = nextT;

            const moveDx = this.position.x - previous.x;
            const moveDy = this.position.y - previous.y;
            const actualStep = Math.hypot(moveDx, moveDy);

            if (actualStep > 0.000001 && dt > 0.000001) {
                this.velocity.x = moveDx / dt;
                this.velocity.y = moveDy / dt;
            } else {
                this.velocity.x = frame.tangent.x * this.speed * directionT;
                this.velocity.y = frame.tangent.y * this.speed * directionT;
            }

            this.targetMoveAngle = Math.atan2(
                frame.tangent.y * directionT,
                frame.tangent.x * directionT
            );
            return;
        }

        // SURFACE TRANSITION
        if (
            waypoint.surface &&
            waypoint.surface !== this.currentSurface
        ) {
            this.setSurface(waypoint.surface, waypoint.t);
            this.pathIndex++;

            if (this.pathIndex >= this.path.length) {
                this.clearPath();
            }
            return;
        }

        // FREE MOVEMENT
        const dx = waypoint.x - this.position.x;
        const dy = waypoint.y - this.position.y;
        const d = Math.hypot(dx, dy);

        if (d <= Math.max(4, stepDistance)) {

            this.position.x = waypoint.x;
            this.position.y = waypoint.y;
            this.pathIndex++;

            if (this.pathIndex >= this.path.length) {
                this.clearPath();
            }
            return;
        }

        const direction = normalize(
            dx,
            dy,
            Math.cos(this.moveAngle),
            Math.sin(this.moveAngle)
        );

        const step = Math.min(stepDistance, d);

        this.velocity.x = direction.x * this.speed;
        this.velocity.y = direction.y * this.speed;

        this.position.x += direction.x * step;
        this.position.y += direction.y * step;

        this.targetMoveAngle = Math.atan2(direction.y, direction.x);
    }

    // =====================================================
    // DIRECTION / LOOK
    // =====================================================

    updateDirection(dt, dx, dy) {

        if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
            this.targetMoveAngle = Math.atan2(dy, dx);
        }

        this.moveAngle = dampAngle(
            this.moveAngle,
            this.targetMoveAngle,
            this.turnSpeed,
            dt
        );
    }

    updateLook(dt) {

        if (this.lookTarget) {

            const dx = this.lookTarget.x - this.position.x;
            const dy = this.lookTarget.y - this.position.y;

            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
                this.targetLookAngle = Math.atan2(dy, dx);
            }

        } else {
            this.targetLookAngle = this.moveAngle;
        }

        this.lookAngle = dampAngle(
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

        const rootX = this.position.x;
        const rootY = this.position.y + this.rootSupportOffset;

        this.skeleton.setRootPosition(rootX, rootY);
        this.skeleton.setRootAngle(0);
    }

    // =====================================================
    // GAIT
    // =====================================================

    updateGait(dt, frameDistance) {

        let tangent = {
            x: Math.cos(this.moveAngle),
            y: Math.sin(this.moveAngle)
        };

        let normal = {
            x: -tangent.y,
            y: tangent.x
        };

        if (this.currentSurface) {
            const frame = this.currentSurface.getFrame(
                this.currentSurfaceT
            );
            tangent = frame.tangent;
            normal = frame.normal;
        }

        const result = this.gait.update(
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
            x: result.left.x,
            y: result.left.y
        };

        this.footTargets.right = {
            x: result.right.x,
            y: result.right.y
        };

        return result;
    }

    // =====================================================
    // PUBLIC MOVEMENT
    // =====================================================

    moveTo(target, duration = 0) {

        if (!target) return;

        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const d = Math.hypot(dx, dy);

        if (d < 0.001) return;

        if (duration > 0) {
            this.speed = d / duration;
        }

        this.targetMoveAngle = Math.atan2(dy, dx);
        this.isMoving = true;
        this.animation.setState(ANIMATION_STATES.WALK);
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
        this.travelledDistance = 0;
        this.path = [];
        this.pathIndex = 0;
        this.currentSurface = null;
        this.currentSurfaceT = 0;
        this.lookTarget = null;
        this.isMoving = false;

        this.gait.reset();
        this.animation.reset();
        this.bodyState.reset();
        this.supportConstraint.reset();
        this.fullBody.reset();

        this.skeleton.resetPose();
        this.skeleton.setRootPosition(0, 0);
        this.skeleton.setRootAngle(0);
        this.skeleton.updateWorldTransforms();

        this.initialized = false;
    }

    // =====================================================
    // STATE
    // =====================================================

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

    validate() {

        const skeleton = this.skeleton.validate
            ? this.skeleton.validate()
            : { valid: true };

        const gait = this.gait.validate
            ? this.gait.validate()
            : { valid: true };

        return {
            valid:
                skeleton.valid &&
                gait.valid &&
                Number.isFinite(this.position.x) &&
                Number.isFinite(this.position.y),
            skeleton,
            gait,
            position: {
                x: this.position.x,
                y: this.position.y
            },
            state: this.animation.snapshot()
        };
    }
}

export default Character;
