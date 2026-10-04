import {
    clamp,
    clamp01,
    damp,
    finite,
    shortestAngleDelta
} from "../MathUtils.js";

const DEFAULTS = {
    forwardLeanMax: 0.14,
    lateralLeanMax: 0.07,
    turnLeanMax: 0.06,

    spineLowerShare: 0.34,
    spineMidShare: 0.26,
    spineUpperShare: 0.22,
    chestShare: 0.18,

    chestCounterScale: 0.50,

    armSwingMax: 0.50,
    armSwingIdle: 0.03,

    forearmBaseFlex: 0.12,
    forearmSwingFlex: 0.28,

    neckLookShare: 0.22,
    headLookShare: 0.58,
    headStabilize: 0.18,

    intensityDamp: 8,
    accelDamp: 6,
    torsoDamp: 11,
    armDamp: 13,
    headDamp: 15,

    unstableBoost: 1.30,

    speedForFullIntensity: 90,

    maxTorsoOffset: 0.48,
    maxArmOffset: 0.70,
    maxHeadOffset: 0.65
};

export default class FullBodyController {
    constructor(skeleton, bodyState, options = {}) {
        if (!skeleton) {
            throw new Error(
                "FullBodyController: skeleton is required"
            );
        }

        if (!bodyState) {
            throw new Error(
                "FullBodyController: bodyState is required"
            );
        }

        const {
            gravityFrame = null,
            gait = null,
            tuning = {},
            ...directTuning
        } = options || {};

        this.skeleton = skeleton;
        this.bodyState = bodyState;

        this.tuning = {
            ...DEFAULTS,
            ...directTuning,
            ...tuning
        };

        this.gravityFrame = gravityFrame;
        this.gait = gait;

        /*
         * Current pose offsets.
         * These are local-angle offsets relative to each bone's
         * anatomical rest angle.
         */
        this.offsets = {
            spineLower: 0,
            spineMid: 0,
            spineUpper: 0,
            chest: 0,

            upperArmL: 0,
            upperArmR: 0,

            forearmL: 0,
            forearmR: 0,

            neck: 0,
            head: 0
        };

        /*
         * Desired pose targets before damping.
         */
        this.targets = {
            spineLower: 0,
            spineMid: 0,
            spineUpper: 0,
            chest: 0,

            upperArmL: 0,
            upperArmR: 0,

            forearmL: 0,
            forearmR: 0,

            neck: 0,
            head: 0
        };

        this.intensity = 0;

        this.previousSpeed = 0;
        this.smoothedAcceleration = 0;
        this._hasPrevSpeed = false;

        /*
         * Cache all bones used by the controller.
         * No repeated skeleton lookups during the frame.
         */
        this.bones = {
            spineLower: this.skeleton.getBone("spineLower"),
            spineMid: this.skeleton.getBone("spineMid"),
            spineUpper: this.skeleton.getBone("spineUpper"),
            chest: this.skeleton.getBone("chest"),

            upperArmL: this.skeleton.getBone("upperArmL"),
            upperArmR: this.skeleton.getBone("upperArmR"),

            forearmL: this.skeleton.getBone("forearmL"),
            forearmR: this.skeleton.getBone("forearmR"),

            neck: this.skeleton.getBone("neck"),
            head: this.skeleton.getBone("head")
        };

        this._validateBoneCache();
    }

    _validateBoneCache() {
        for (const [name, bone] of Object.entries(this.bones)) {
            if (!bone) {
                throw new Error(
                    `FullBodyController: required bone "${name}" not found`
                );
            }
        }
    }

    update(dt, context = {}) {
        const safeDt = clamp(
            finite(dt, 0),
            0,
            0.1
        );

        if (safeDt <= 0) {
            return;
        }

        const speed = Math.max(
            0,
            finite(context.speed, 0)
        );

        /*
         * The speed fallback is intentional.
         * FBC must continue working even if Character forgets
         * to explicitly pass isMoving.
         */
        const isMoving =
            context.isMoving === true ||
            speed > 0.5;

        const moveAngle = finite(
            context.moveAngle,
            0
        );

        const lookAngle = finite(
            context.lookAngle,
            moveAngle
        );

        const turnRate = finite(
            context.turnRate,
            0
        );

        if (context.gravityFrame) {
            this.gravityFrame = context.gravityFrame;
        }

        if (context.gait) {
            this.gait = context.gait;
        }

        /*
         * Movement intensity.
         *
         * 0 = idle
         * 1 = full configured locomotion intensity
         */
        const speedRatio = clamp01(
            speed /
            Math.max(
                1,
                this.tuning.speedForFullIntensity
            )
        );

        const targetIntensity = isMoving
            ? speedRatio
            : 0;

        this.intensity = damp(
            this.intensity,
            targetIntensity,
            this.tuning.intensityDamp,
            safeDt
        );

        /*
         * First-frame acceleration protection.
         *
         * The first speed sample establishes the baseline instead
         * of producing a fake acceleration spike.
         */
        let acceleration = 0;

        if (this._hasPrevSpeed) {
            acceleration =
                (speed - this.previousSpeed) /
                Math.max(safeDt, 0.0001);
        } else {
            this._hasPrevSpeed = true;
        }

        this.previousSpeed = speed;

        this.smoothedAcceleration = damp(
            this.smoothedAcceleration,
            acceleration,
            this.tuning.accelDamp,
            safeDt
        );

        /*
         * BodyState is authoritative for balance.
         *
         * API:
         * {
         *   supported,
         *   stable,
         *   supportPoint,
         *   comOffset
         * }
         */
        const balance =
            typeof this.bodyState.getBalance === "function"
                ? this.bodyState.getBalance()
                : null;

        const weightDistribution =
            this.bodyState.weightDistribution || null;

        /*
         * Unsupported body:
         * slightly increase active response.
         *
         * Supported + stable:
         * normal response.
         *
         * Supported + unstable:
         * stronger correction.
         */
        const balanceScale =
            !balance?.supported
                ? 1.10
                : balance.stable
                    ? 1.0
                    : this.tuning.unstableBoost;

        /*
         * Actual gait state is preferred over a synthetic phase.
         */
        const armMotion =
            this._resolveArmMotion(
                isMoving,
                context
            );

        this._computeTargets({
            speed,
            isMoving,
            moveAngle,
            lookAngle,
            turnRate,
            balance,
            weightDistribution,
            balanceScale,
            armMotion
        });

        this._dampOffsets(safeDt);

        /*
         * FBC writes local pose only.
         *
         * IMPORTANT:
         * No skeleton.updateWorldTransforms() here.
         *
         * Character owns the final FK pass after IK.
         */
        this._applyPose();
    }

    /*
     * Resolve actual arm direction from the stepping leg.
     *
     * right leg stepping -> left arm forward
     * left leg stepping  -> right arm forward
     *
     * Returns:
     *   direction: -1 / +1
     *   envelope:  0..1
     */
    _resolveArmMotion(isMoving, context) {
        const gait = this.gait;

        if (
            gait &&
            gait.legs &&
            gait.legs.left &&
            gait.legs.right
        ) {
            const left = gait.legs.left;
            const right = gait.legs.right;

            if (right.stepping) {
                const progress = clamp01(
                    finite(right.progress, 0)
                );

                return {
                    direction: 1,
                    envelope: this._stepEnvelope(
                        progress,
                        1
                    )
                };
            }

            if (left.stepping) {
                const progress = clamp01(
                    finite(left.progress, 0)
                );

                return {
                    direction: -1,
                    envelope: this._stepEnvelope(
                        progress,
                        -1
                    )
                };
            }

            /*
             * Both feet planted.
             *
             * Keep only a very small residual motion so the body
             * does not freeze mechanically between steps.
             */
            if (
                Number.isFinite(gait.phase) &&
                isMoving
            ) {
                const phase = gait.phase * Math.PI * 2;

                return {
                    direction: Math.sin(phase) >= 0
                        ? 1
                        : -1,
                    envelope:
                        Math.abs(Math.sin(phase)) * 0.15
                };
            }
        }

        /*
         * Context fallback for compatibility.
         */
        if (context.rightStepping === true) {
            const progress = clamp01(
                finite(context.rightStepProgress, 0.5)
            );

            return {
                direction: 1,
                envelope: this._stepEnvelope(
                    progress,
                    1
                )
            };
        }

        if (context.leftStepping === true) {
            const progress = clamp01(
                finite(context.leftStepProgress, 0.5)
            );

            return {
                direction: -1,
                envelope: this._stepEnvelope(
                    progress,
                    -1
                )
            };
        }

        if (
            Number.isFinite(context.gaitPhase) &&
            isMoving
        ) {
            const phase =
                context.gaitPhase *
                Math.PI *
                2;

            return {
                direction: Math.sin(phase) >= 0
                    ? 1
                    : -1,
                envelope:
                    Math.abs(Math.sin(phase)) * 0.15
            };
        }

        return {
            direction: 0,
            envelope: 0
        };
    }

    /*
     * Step envelope.
     *
     * The direction is NOT derived from progress.
     * Progress describes where the leg is inside its step.
     * Direction comes from which leg is stepping.
     *
     * The curve deliberately differs from a plain sin(PI * p):
     * - gentle start
     * - stronger mid-step
     * - slightly longer release
     *
     * This is a locomotion envelope, not a physical simulation.
     */
    _stepEnvelope(progress, direction) {
        const p = clamp01(
            finite(progress, 0)
        );

        if (p <= 0 || p >= 1) {
            return 0;
        }

        /*
         * Smoothstep gives a controlled 0→1→0 base envelope.
         */
        const rise =
            p * p * (3 - 2 * p);

        /*
         * Mild asymmetry.
         *
         * Positive direction slightly favors the earlier part
         * of the swing, negative direction slightly favors the
         * later part. This is deliberately subtle.
         */
        const bias =
            direction >= 0
                ? 0.92 + 0.08 * (1 - p)
                : 0.92 + 0.08 * p;

        /*
         * Convert smoothstep into a hump.
         *
         * The second factor prevents a flat plateau.
         */
        const release =
            1 -
            p * 0.18;

        return clamp01(
            rise *
            (1 - p * 0.72) *
            1.75 *
            bias *
            release
        );
    }

    _computeTargets({
        speed,
        isMoving,
        moveAngle,
        lookAngle,
        turnRate,
        balance,
        weightDistribution,
        balanceScale,
        armMotion
    }) {
        const t = this.tuning;

        const intensity =
            clamp01(this.intensity) *
            balanceScale;

        /*
         * Acceleration normalized against the configured movement
         * scale. This is intentionally conservative.
         */
        const accelerationNorm = clamp(
            this.smoothedAcceleration /
            Math.max(
                1,
                t.speedForFullIntensity
            ),
            -1,
            1
        );

        /*
         * Forward body response.
         */
        const forwardLean = clamp(
            intensity *
                t.forwardLeanMax +
            accelerationNorm *
                0.045,
            -t.forwardLeanMax,
            t.forwardLeanMax
        );

        /*
         * COM-based lateral balance.
         *
         * BodyState currently exposes comOffset in world space.
         * Its current balance implementation uses world X, so that
         * is the signal consumed here.
         */
        let comShift = 0;

        if (
            balance &&
            balance.comOffset &&
            Number.isFinite(
                balance.comOffset.x
            )
        ) {
            comShift = clamp(
                balance.comOffset.x / 30,
                -1,
                1
            );
        }

        /*
         * Weight distribution provides an additional signal.
         *
         * right - left:
         *   positive = more weight on right
         *   negative = more weight on left
         */
        let weightShift = 0;

        if (
            weightDistribution &&
            Number.isFinite(
                weightDistribution.left
            ) &&
            Number.isFinite(
                weightDistribution.right
            )
        ) {
            weightShift = clamp(
                weightDistribution.right -
                weightDistribution.left,
                -1,
                1
            );
        }

        /*
         * COM remains the stronger signal.
         * Weight distribution supplies local responsiveness.
         */
        const lateralInput = clamp(
            comShift * 0.65 +
            weightShift * 0.35,
            -1,
            1
        );

        const lateralLean =
            lateralInput *
            t.lateralLeanMax *
            intensity;

        /*
         * Turning response.
         */
        const turnInput = clamp(
            turnRate / 8,
            -1,
            1
        );

        const turnLean =
            turnInput *
            t.turnLeanMax *
            intensity;

        /*
         * Combined locomotion drive.
         */
        const drive =
            forwardLean +
            lateralLean * 0.40 +
            turnLean * 0.25;

        /*
         * The root pelvis remains authoritative.
         *
         * We distribute the response through the spine instead
         * of inventing a second pelvis rotation layer.
         */
        this.targets.spineLower =
            drive *
            t.spineLowerShare;

        this.targets.spineMid =
            drive *
            t.spineMidShare;

        this.targets.spineUpper =
            drive *
            t.spineUpperShare;

        this.targets.chest =
            drive *
            t.chestShare -
            drive *
            t.chestCounterScale *
            0.12;

        /*
         * ARM SWING
         *
         * Direction:
         *   right leg -> left arm forward
         *   left leg  -> right arm forward
         */
        const swingAmplitude = isMoving
            ? t.armSwingMax *
              clamp01(this.intensity) *
              balanceScale
            : t.armSwingIdle;

        const signedArmSwing =
            armMotion.direction *
            armMotion.envelope *
            swingAmplitude;

        /*
         * Turning suppresses excessive arm swing.
         */
        const turnArmDamping =
            1 -
            Math.min(
                0.45,
                Math.abs(turnInput) *
                0.45
            );

        this.targets.upperArmL =
            clamp(
                signedArmSwing *
                turnArmDamping,
                -t.maxArmOffset,
                t.maxArmOffset
            );

        this.targets.upperArmR =
            clamp(
                -signedArmSwing *
                turnArmDamping,
                -t.maxArmOffset,
                t.maxArmOffset
            );

        /*
         * FOREARMS
         *
         * Baseline flex + locomotion envelope.
         *
         * No dependency on upper-arm angle.
         */
        const forearmFlex =
            t.forearmBaseFlex +
            armMotion.envelope *
            t.forearmSwingFlex *
            clamp01(this.intensity);

        this.targets.forearmL =
            clamp(
                forearmFlex,
                -t.maxArmOffset,
                t.maxArmOffset
            );

        this.targets.forearmR =
            clamp(
                forearmFlex,
                -t.maxArmOffset,
                t.maxArmOffset
            );

        /*
         * HEAD / NECK
         *
         * Shortest angular path prevents snapping at ±PI.
         */
        const lookDelta =
            shortestAngleDelta(
                moveAngle,
                lookAngle
            );

        const normalizedLook = clamp(
            lookDelta / Math.PI,
            -1,
            1
        );

        this.targets.neck =
            normalizedLook *
            t.neckLookShare;

        this.targets.head =
            normalizedLook *
            t.headLookShare -
            this.targets.chest *
            t.headStabilize;

        this.targets.neck = clamp(
            this.targets.neck,
            -t.maxHeadOffset,
            t.maxHeadOffset
        );

        this.targets.head = clamp(
            this.targets.head,
            -t.maxHeadOffset,
            t.maxHeadOffset
        );

        /*
         * Final safety limits.
         */
        this.targets.spineLower = clamp(
            this.targets.spineLower,
            -t.maxTorsoOffset,
            t.maxTorsoOffset
        );

        this.targets.spineMid = clamp(
            this.targets.spineMid,
            -t.maxTorsoOffset,
            t.maxTorsoOffset
        );

        this.targets.spineUpper = clamp(
            this.targets.spineUpper,
            -t.maxTorsoOffset,
            t.maxTorsoOffset
        );

        this.targets.chest = clamp(
            this.targets.chest,
            -t.maxTorsoOffset,
            t.maxTorsoOffset
        );
    }

    _dampOffsets(dt) {
        const t = this.tuning;

        this.offsets.spineLower = damp(
            this.offsets.spineLower,
            this.targets.spineLower,
            t.torsoDamp,
            dt
        );

        this.offsets.spineMid = damp(
            this.offsets.spineMid,
            this.targets.spineMid,
            t.torsoDamp,
            dt
        );

        this.offsets.spineUpper = damp(
            this.offsets.spineUpper,
            this.targets.spineUpper,
            t.torsoDamp,
            dt
        );

        this.offsets.chest = damp(
            this.offsets.chest,
            this.targets.chest,
            t.torsoDamp,
            dt
        );

        this.offsets.upperArmL = damp(
            this.offsets.upperArmL,
            this.targets.upperArmL,
            t.armDamp,
            dt
        );

        this.offsets.upperArmR = damp(
            this.offsets.upperArmR,
            this.targets.upperArmR,
            t.armDamp,
            dt
        );

        this.offsets.forearmL = damp(
            this.offsets.forearmL,
            this.targets.forearmL,
            t.armDamp,
            dt
        );

        this.offsets.forearmR = damp(
            this.offsets.forearmR,
            this.targets.forearmR,
            t.armDamp,
            dt
        );

        this.offsets.neck = damp(
            this.offsets.neck,
            this.targets.neck,
            t.headDamp,
            dt
        );

        this.offsets.head = damp(
            this.offsets.head,
            this.targets.head,
            t.headDamp,
            dt
        );
    }

    _applyPose() {
        const b = this.bones;
        const o = this.offsets;

        /*
         * FULL-BODY OWNERSHIP
         *
         * FBC owns:
         *   spine
         *   chest
         *   upper arms
         *   forearms
         *   neck
         *   head
         *
         * FBC does NOT own:
         *   root pelvis transform
         *   leg IK
         *   final FK/world transform update
         *
         * Character performs final skeleton FK after IK.
         */

        b.spineLower.localAngle =
            b.spineLower.restAngle +
            o.spineLower;

        b.spineMid.localAngle =
            b.spineMid.restAngle +
            o.spineMid;

        b.spineUpper.localAngle =
            b.spineUpper.restAngle +
            o.spineUpper;

        b.chest.localAngle =
            b.chest.restAngle +
            o.chest;

        b.upperArmL.localAngle =
            b.upperArmL.restAngle +
            o.upperArmL;

        b.upperArmR.localAngle =
            b.upperArmR.restAngle +
            o.upperArmR;

        b.forearmL.localAngle =
            b.forearmL.restAngle +
            o.forearmL;

        b.forearmR.localAngle =
            b.forearmR.restAngle +
            o.forearmR;

        b.neck.localAngle =
            b.neck.restAngle +
            o.neck;

        b.head.localAngle =
            b.head.restAngle +
            o.head;
    }

    reset() {
        for (const key of Object.keys(this.offsets)) {
            this.offsets[key] = 0;
            this.targets[key] = 0;
        }

        this.intensity = 0;
        this.previousSpeed = 0;
        this.smoothedAcceleration = 0;
        this._hasPrevSpeed = false;

        this._applyPose();
    }

    setGravityFrame(gravityFrame) {
        this.gravityFrame =
            gravityFrame || null;
    }

    setGait(gait) {
        this.gait =
            gait || null;
    }

    getState() {
        return {
            intensity: this.intensity,
            acceleration: this.smoothedAcceleration,

            offsets: {
                ...this.offsets
            },

            targets: {
                ...this.targets
            }
        };
    }

    validate() {
        const finiteObject = object =>
            Object.values(object).every(
                value =>
                    Number.isFinite(value)
            );

        return (
            !!this.skeleton &&
            !!this.bodyState &&
            finiteObject(this.offsets) &&
            finiteObject(this.targets) &&
            Number.isFinite(this.intensity) &&
            Number.isFinite(this.previousSpeed) &&
            Number.isFinite(
                this.smoothedAcceleration
            )
        );
    }
}
