// ASTRAWAY 2.0
// Full Body Controller
//
// Единственный владелец процедурной позы верхней части тела.
//
// Pipeline:
// GravityFrame + Gait + BodyState
//              ↓
//        locomotion state
//              ↓
//          full pose
//              ↓
// pelvis/root — Character
// spine       — FBC
// shoulders   — FBC
// arms        — FBC
// head        — FBC
//
// FBC НЕ делает FK.
// FBC НЕ решает IK.
// FBC НЕ двигает персонажа.
// FBC строит целостную позу относительно текущего
// gravity frame и состояния опор.

import {
    clamp,
    clamp01,
    damp,
    finite,
    shortestAngleDelta
} from "../MathUtils.js";


const DEFAULTS = {

    // -----------------------------------------------------
    // BODY
    // -----------------------------------------------------

    forwardLean:
        0.12,

    lateralBalance:
        0.10,

    accelerationLean:
        0.045,

    torsoCounter:
        0.045,

    // -----------------------------------------------------
    // WALK
    // -----------------------------------------------------

    pelvisRhythm:
        0.055,

    torsoRhythm:
        0.065,

    shoulderCounter:
        0.055,

    armSwing:
        0.48,

    armSwingMin:
        0.035,

    elbowFlex:
        0.22,

    elbowBase:
        0.10,

    // -----------------------------------------------------
    // HEAD
    // -----------------------------------------------------

    neckLook:
        0.20,

    headLook:
        0.48,

    headStabilize:
        0.20,

    // -----------------------------------------------------
    // DAMPING
    // -----------------------------------------------------

    intensityDamp:
        8,

    accelerationDamp:
        7,

    torsoDamp:
        12,

    armDamp:
        14,

    headDamp:
        15,

    // -----------------------------------------------------
    // SAFETY
    // -----------------------------------------------------

    maxSpine:
        0.42,

    maxArm:
        0.65,

    maxHead:
        0.60,

    unstableBoost:
        1.25,

    speedForFullIntensity:
        90
};


export default class FullBodyController {

    constructor(
        skeleton,
        bodyState,
        options = {}
    ) {

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


        this.skeleton =
            skeleton;

        this.bodyState =
            bodyState;

        this.gravityFrame =
            gravityFrame;

        this.gait =
            gait;


        this.tuning = {
            ...DEFAULTS,
            ...directTuning,
            ...tuning
        };


        this.bones = {

            spineLower:
                skeleton.getBone(
                    "spineLower"
                ),

            spineMid:
                skeleton.getBone(
                    "spineMid"
                ),

            spineUpper:
                skeleton.getBone(
                    "spineUpper"
                ),

            chest:
                skeleton.getBone(
                    "chest"
                ),

            upperArmL:
                skeleton.getBone(
                    "upperArmL"
                ),

            upperArmR:
                skeleton.getBone(
                    "upperArmR"
                ),

            forearmL:
                skeleton.getBone(
                    "forearmL"
                ),

            forearmR:
                skeleton.getBone(
                    "forearmR"
                ),

            neck:
                skeleton.getBone(
                    "neck"
                ),

            head:
                skeleton.getBone(
                    "head"
                )
        };


        for (
            const [name, bone]
            of Object.entries(this.bones)
        ) {

            if (!bone) {

                throw new Error(
                    `FullBodyController: missing bone "${name}"`
                );
            }
        }


        this.targets = {};
        this.offsets = {};

        for (
            const name
            of Object.keys(this.bones)
        ) {

            this.targets[name] = 0;
            this.offsets[name] = 0;
        }


        this.intensity =
            0;

        this.previousSpeed =
            0;

        this.acceleration =
            0;

        this.hasPreviousSpeed =
            false;
    }


    // =====================================================
    // UPDATE
    // =====================================================

    update(
        dt,
        context = {}
    ) {

        const safeDt =
            clamp(
                finite(dt, 0),
                0,
                0.1
            );


        if (safeDt <= 0) {
            return;
        }


        if (context.gravityFrame) {

            this.gravityFrame =
                context.gravityFrame;
        }


        if (context.gait) {

            this.gait =
                context.gait;
        }


        const speed =
            Math.max(
                0,
                finite(
                    context.speed,
                    0
                )
            );


        const moving =
            context.isMoving === true ||
            speed > 0.5;


        const moveAngle =
            finite(
                context.moveAngle,
                0
            );


        const lookAngle =
            finite(
                context.lookAngle,
                moveAngle
            );


        const turnRate =
            finite(
                context.turnRate,
                0
            );


        // -------------------------------------------------
        // INTENSITY
        // -------------------------------------------------

        const speedRatio =
            clamp01(
                speed /
                Math.max(
                    1,
                    this.tuning.speedForFullIntensity
                )
            );


        const targetIntensity =
            moving
                ? speedRatio
                : 0;


        this.intensity =
            damp(
                this.intensity,
                targetIntensity,
                this.tuning.intensityDamp,
                safeDt
            );


        // -------------------------------------------------
        // ACCELERATION
        // -------------------------------------------------

        if (this.hasPreviousSpeed) {

            const rawAcceleration =
                (
                    speed -
                    this.previousSpeed
                ) /
                Math.max(
                    safeDt,
                    0.0001
                );


            this.acceleration =
                damp(
                    this.acceleration,
                    rawAcceleration,
                    this.tuning.accelerationDamp,
                    safeDt
                );

        } else {

            this.hasPreviousSpeed =
                true;

            this.acceleration =
                0;
        }


        this.previousSpeed =
            speed;


        // -------------------------------------------------
        // BALANCE
        // -------------------------------------------------

        const balance =
            typeof this.bodyState.getBalance ===
                "function"
                ? this.bodyState.getBalance()
                : null;


        const weight =
            this.bodyState.weightDistribution ||
            {
                left: 0.5,
                right: 0.5
            };


        const balanceBoost =
            !balance?.supported
                ? 1
                : balance.stable
                    ? 1
                    : this.tuning.unstableBoost;


        // -------------------------------------------------
        // GAIT
        // -------------------------------------------------

        const gait =
            this.gait;


        const phase =
            gait &&
            Number.isFinite(
                gait.phase
            )
                ? gait.phase
                : finite(
                    context.gaitPhase,
                    0
                );


        /*
         * phase:
         *
         * 0 → 1
         *
         * gait uses one complete alternating cycle.
         */
        const cycle =
            phase *
            Math.PI *
            2;


        const stride =
            Math.sin(
                cycle
            );


        const oppositeStride =
            -stride;


        /*
         * Weight transfer is deliberately independent
         * from the visual arm swing.
         *
         * This makes the torso respond to actual support
         * rather than merely following a sine wave.
         */
        const weightShift =
            clamp(
                finite(
                    weight.right,
                    0.5
                ) -
                finite(
                    weight.left,
                    0.5
                ),
                -1,
                1
            );


        // -------------------------------------------------
        // SURFACE FRAME
        // -------------------------------------------------

        const frame =
            this.gravityFrame?.frame ||
            this.gravityFrame?.getFrame?.() ||
            null;


        /*
         * GravityFrame has already rotated the root so that
         * local +X follows the surface tangent and local
         * -Y follows surface normal.
         *
         * Therefore the full body corrections below remain
         * local anatomical corrections.
         */


        // -------------------------------------------------
        // BALANCE INPUT
        // -------------------------------------------------

        let balanceLateral =
            0;


        if (
            balance &&
            balance.comOffset &&
            Number.isFinite(
                balance.comOffset.x
            )
        ) {

            /*
             * BodyState provides COM offset in the current
             * support frame.
             */
            balanceLateral =
                clamp(
                    balance.comOffset.x /
                    24,
                    -1,
                    1
                );
        }


        // -------------------------------------------------
        // FORWARD LEAN
        // -------------------------------------------------

        const locomotion =
            clamp01(
                this.intensity
            );


        const accelerationInput =
            clamp(
                this.acceleration /
                Math.max(
                    1,
                    this.tuning.speedForFullIntensity
                ),
                -1,
                1
            );


        const forward =
            locomotion *
            this.tuning.forwardLean +
            accelerationInput *
            this.tuning.accelerationLean;


        // -------------------------------------------------
        // LATERAL BALANCE
        // -------------------------------------------------

        const lateral =
            balanceLateral *
            this.tuning.lateralBalance *
            balanceBoost;


        /*
         * Weight transfer adds a small dynamic component.
         */
        const transfer =
            weightShift *
            this.tuning.pelvisRhythm *
            0.60;


        // -------------------------------------------------
        // TORSO
        // -------------------------------------------------

        /*
         * The spine is a distributed chain.
         *
         * No single-bone "lean".
         *
         * Lower:
         *   pelvis → lumbar
         *
         * Mid:
         *   lumbar → thoracic
         *
         * Upper:
         *   thoracic → chest
         *
         * Chest:
         *   counter-rotation / stabilization
         */

        const torsoRhythm =
            stride *
            this.tuning.torsoRhythm *
            locomotion;


        this.targets.spineLower =
            clamp(
                forward * 0.34 +
                lateral * 0.35 +
                transfer * 0.30 +
                torsoRhythm * 0.30,
                -this.tuning.maxSpine,
                this.tuning.maxSpine
            );


        this.targets.spineMid =
            clamp(
                forward * 0.27 +
                lateral * 0.30 +
                transfer * 0.20 +
                torsoRhythm * 0.50,
                -this.tuning.maxSpine,
                this.tuning.maxSpine
            );


        this.targets.spineUpper =
            clamp(
                forward * 0.22 +
                lateral * 0.20 +
                transfer * 0.10 +
                torsoRhythm * 0.30,
                -this.tuning.maxSpine,
                this.tuning.maxSpine
            );


        /*
         * Chest counteracts lower-body rhythm.
         */
        this.targets.chest =
            clamp(
                -torsoRhythm *
                this.tuning.torsoCounter,
                -this.tuning.maxSpine,
                this.tuning.maxSpine
            );


        // -------------------------------------------------
        // SHOULDERS
        // -------------------------------------------------

        /*
         * Opposite shoulder compensation:
         *
         * left leg forward
         *     →
         * right shoulder forward
         *
         * This is what prevents the upper body from
         * remaining a rigid cross.
         */
        const shoulder =
            oppositeStride *
            this.tuning.shoulderCounter *
            locomotion;


        // -------------------------------------------------
        // ARMS
        // -------------------------------------------------

        const armAmplitude =
            moving
                ? Math.max(
                    this.tuning.armSwingMin,
                    this.tuning.armSwing *
                    locomotion
                )
                : this.tuning.armSwingMin;


        const turnDamping =
            1 -
            Math.min(
                0.35,
                Math.abs(
                    turnRate
                ) *
                0.04
            );


        /*
         * Arms are coupled to opposite legs.
         */
        this.targets.upperArmL =
            clamp(
                (
                    stride *
                    armAmplitude +
                    shoulder
                ) *
                turnDamping,
                -this.tuning.maxArm,
                this.tuning.maxArm
            );


        this.targets.upperArmR =
            clamp(
                (
                    oppositeStride *
                    armAmplitude -
                    shoulder
                ) *
                turnDamping,
                -this.tuning.maxArm,
                this.tuning.maxArm
            );


        // -------------------------------------------------
        // ELBOWS
        // -------------------------------------------------

        const elbow =
            this.tuning.elbowBase +
            Math.abs(
                stride
            ) *
            this.tuning.elbowFlex *
            locomotion;


        this.targets.forearmL =
            clamp(
                elbow,
                -this.tuning.maxArm,
                this.tuning.maxArm
            );


        this.targets.forearmR =
            clamp(
                elbow,
                -this.tuning.maxArm,
                this.tuning.maxArm
            );


        // -------------------------------------------------
        // HEAD
        // -------------------------------------------------

        const lookDelta =
            shortestAngleDelta(
                moveAngle,
                lookAngle
            );


        const lookInput =
            clamp(
                lookDelta /
                Math.PI,
                -1,
                1
            );


        /*
         * Head stabilizes against torso movement.
         */
        this.targets.neck =
            clamp(
                lookInput *
                this.tuning.neckLook -
                torsoRhythm *
                0.20,
                -this.tuning.maxHead,
                this.tuning.maxHead
            );


        this.targets.head =
            clamp(
                lookInput *
                this.tuning.headLook -
                torsoRhythm *
                this.tuning.headStabilize,
                -this.tuning.maxHead,
                this.tuning.maxHead
            );


        // -------------------------------------------------
        // DAMP
        // -------------------------------------------------

        for (
            const name
            of Object.keys(
                this.offsets
            )
        ) {

            const isArm =
                name === "upperArmL" ||
                name === "upperArmR" ||
                name === "forearmL" ||
                name === "forearmR";


            const isHead =
                name === "neck" ||
                name === "head";


            const rate =
                isHead
                    ? this.tuning.headDamp
                    : isArm
                        ? this.tuning.armDamp
                        : this.tuning.torsoDamp;


            this.offsets[name] =
                damp(
                    this.offsets[name],
                    this.targets[name],
                    rate,
                    safeDt
                );
        }


        this.applyPose();
    }


    // =====================================================
    // APPLY
    // =====================================================

    applyPose() {

        for (
            const [name, bone]
            of Object.entries(
                this.bones
            )
        ) {

            bone.localAngle =
                bone.restAngle +
                this.offsets[name];
        }
    }


    // =====================================================
    // RESET
    // =====================================================

    reset() {

        for (
            const name
            of Object.keys(
                this.targets
            )
        ) {

            this.targets[name] =
                0;

            this.offsets[name] =
                0;
        }


        this.intensity =
            0;

        this.previousSpeed =
            0;

        this.acceleration =
            0;

        this.hasPreviousSpeed =
            false;


        this.applyPose();
    }


    setGravityFrame(
        gravityFrame
    ) {

        this.gravityFrame =
            gravityFrame ||
            null;
    }


    setGait(
        gait
    ) {

        this.gait =
            gait ||
            null;
    }


    getState() {

        return {

            intensity:
                this.intensity,

            acceleration:
                this.acceleration,

            targets: {
                ...this.targets
            },

            offsets: {
                ...this.offsets
            }
        };
    }


    validate() {

        const validObject =
            object =>
                Object.values(
                    object
                ).every(
                    value =>
                        Number.isFinite(
                            value
                        )
                );


        return (
            !!this.skeleton &&
            !!this.bodyState &&
            validObject(
                this.targets
            ) &&
            validObject(
                this.offsets
            ) &&
            Number.isFinite(
                this.intensity
            )
        );
    }
}
