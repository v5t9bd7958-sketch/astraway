// ASTRAWAY
// FullBodyController
//
// Владелец процедурной позы верхней части тела.
//
// Ответственность:
// - позвоночник
// - грудная клетка
// - руки
// - предплечья
// - шея
// - голова
//
// НЕ отвечает за:
// - перемещение персонажа
// - FK
// - IK ног
// - построение поверхности
// - навигацию
//
// Получает состояние от:
// Character → движение
// Gait → фаза шага
// BodyState → баланс / распределение веса
// GravityFrame → ориентация относительно поверхности
//
// Важно:
// FBC изменяет только localAngle.
// FK выполняется Character после FBC.
// -----------------------------------------------------

import {
    clamp,
    clamp01,
    damp,
    finite,
    shortestAngleDelta
} from "../MathUtils.js";


const DEFAULTS = {

    // Тело
    forwardLean: 0.12,
    lateralBalance: 0.10,
    accelerationLean: 0.045,
    torsoCounter: 0.045,

    // Походка
    torsoRhythm: 0.065,
    shoulderCounter: 0.055,

    // Руки
    armSwing: 0.48,
    armSwingMin: 0.035,

    // Локти
    elbowFlex: 0.22,
    elbowBase: 0.10,

    // Голова
    neckLook: 0.20,
    headLook: 0.48,
    headStabilize: 0.20,

    // Сглаживание
    intensityDamp: 8,
    accelerationDamp: 7,
    torsoDamp: 12,
    armDamp: 14,
    headDamp: 15,

    // Ограничения
    maxSpine: 0.42,
    maxArm: 0.65,
    maxHead: 0.60,

    // Баланс
    unstableBoost: 1.25,

    // Скорость полного выражения походки
    speedForFullIntensity: 90
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


        // -------------------------------------------------
        // Кости, которыми владеет FBC
        // -------------------------------------------------

        this.bones = {

            spineLower:
                skeleton.getBone("spineLower"),

            spineMid:
                skeleton.getBone("spineMid"),

            spineUpper:
                skeleton.getBone("spineUpper"),

            chest:
                skeleton.getBone("chest"),

            upperArmL:
                skeleton.getBone("upperArmL"),

            upperArmR:
                skeleton.getBone("upperArmR"),

            forearmL:
                skeleton.getBone("forearmL"),

            forearmR:
                skeleton.getBone("forearmR"),

            neck:
                skeleton.getBone("neck"),

            head:
                skeleton.getBone("head")
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


        // -------------------------------------------------
        // Цели и сглаженные значения
        // -------------------------------------------------

        this.targets = {};
        this.offsets = {};


        for (
            const name
            of Object.keys(this.bones)
        ) {

            this.targets[name] = 0;
            this.offsets[name] = 0;
        }


        this.intensity = 0;

        this.previousSpeed = 0;

        this.acceleration = 0;

        this.hasPreviousSpeed = false;
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


        // -------------------------------------------------
        // Внешние зависимости могут передаваться
        // непосредственно через context.
        // -------------------------------------------------

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
        // ИНТЕНСИВНОСТЬ ДВИЖЕНИЯ
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
        // УСКОРЕНИЕ
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
        // BODY STATE
        // -------------------------------------------------

        let balance = null;

        if (
            typeof this.bodyState.getBalance ===
            "function"
        ) {

            balance =
                this.bodyState.getBalance();
        }


        const weight =
            this.bodyState.weightDistribution ||
            {
                left: 0.5,
                right: 0.5
            };


        const leftWeight =
            clamp(
                finite(
                    weight.left,
                    0.5
                ),
                0,
                1
            );


        const rightWeight =
            clamp(
                finite(
                    weight.right,
                    0.5
                ),
                0,
                1
            );


        const weightShift =
            clamp(
                rightWeight -
                leftWeight,
                -1,
                1
            );


        const balanceBoost =
            balance &&
            balance.supported === true &&
            balance.stable === false
                ? this.tuning.unstableBoost
                : 1;


        // -------------------------------------------------
        // GRAVITY FRAME
        //
        // Сам FBC не вращает скелет.
        // Character уже должен поставить root
        // согласно GravityFrame.
        //
        // Здесь наличие frame используется как
        // сигнал, что окружение подключено.
        // -------------------------------------------------

        const frame =
            this.gravityFrame?.frame ||
            (
                typeof this.gravityFrame?.getFrame ===
                "function"
                    ? this.gravityFrame.getFrame()
                    : null
            );


        const environmentActive =
            !!frame;


        // -------------------------------------------------
        // GAIT
        // -------------------------------------------------

        const gaitPhase =
            this.gait &&
            Number.isFinite(
                this.gait.phase
            )
                ? this.gait.phase
                : finite(
                    context.gaitPhase,
                    0
                );


        const phase =
            clamp(
                gaitPhase,
                0,
                1
            );


        const cycle =
            phase *
            Math.PI *
            2;


        const stride =
            Math.sin(cycle);


        const oppositeStride =
            -stride;


        // -------------------------------------------------
        // ИНТЕНСИВНОСТЬ
        // -------------------------------------------------

        const locomotion =
            clamp01(
                this.intensity
            );


        // -------------------------------------------------
        // COM / BALANCE
        // -------------------------------------------------

        let balanceLateral = 0;


        if (
            balance &&
            balance.comOffset &&
            Number.isFinite(
                balance.comOffset.x
            )
        ) {

            balanceLateral =
                clamp(
                    balance.comOffset.x / 24,
                    -1,
                    1
                );
        }


        // -------------------------------------------------
        // УСКОРЕНИЕ
        // -------------------------------------------------

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


        // -------------------------------------------------
        // НАКЛОН ВПЕРЁД
        // -------------------------------------------------

        let forward =
            locomotion *
            this.tuning.forwardLean;


        forward +=
            accelerationInput *
            this.tuning.accelerationLean;


        // Если окружение реально подключено,
        // баланс получает немного больший вес.
        if (environmentActive) {

            forward *=
                1;
        }


        // -------------------------------------------------
        // БОКОВОЙ БАЛАНС
        // -------------------------------------------------

        const lateral =
            balanceLateral *
            this.tuning.lateralBalance *
            balanceBoost;


        // -------------------------------------------------
        // ПЕРЕНОС ВЕСА
        // -------------------------------------------------

        const transfer =
            weightShift *
            this.tuning.torsoCounter *
            0.6;


        // -------------------------------------------------
        // РИТМ ТУЛОВИЩА
        // -------------------------------------------------

        const torsoRhythm =
            stride *
            this.tuning.torsoRhythm *
            locomotion;


        // -------------------------------------------------
        // ПОЗВОНОЧНИК
        // -------------------------------------------------

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


        // -------------------------------------------------
        // ГРУДЬ
        // -------------------------------------------------

        this.targets.chest =
            clamp(
                -torsoRhythm *
                this.tuning.torsoCounter,

                -this.tuning.maxSpine,
                this.tuning.maxSpine
            );


        // -------------------------------------------------
        // ПЛЕЧИ
        // -------------------------------------------------

        const shoulderCounter =
            oppositeStride *
            this.tuning.shoulderCounter *
            locomotion;


        // -------------------------------------------------
        // РУКИ
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
                Math.abs(turnRate) *
                0.04
            );


        this.targets.upperArmL =
            clamp(
                (
                    stride *
                    armAmplitude +
                    shoulderCounter
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
                    shoulderCounter
                ) *
                turnDamping,

                -this.tuning.maxArm,
                this.tuning.maxArm
            );


        // -------------------------------------------------
        // ЛОКТИ
        // -------------------------------------------------

        const elbow =
            this.tuning.elbowBase +
            Math.abs(stride) *
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
        // ГОЛОВА
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


        // -------------------------------------------------
        // ШЕЯ
        // -------------------------------------------------

        this.targets.neck =
            clamp(
                lookInput *
                this.tuning.neckLook -

                torsoRhythm *
                0.20,

                -this.tuning.maxHead,
                this.tuning.maxHead
            );


        // -------------------------------------------------
        // ГОЛОВА
        // -------------------------------------------------

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
        // СГЛАЖИВАНИЕ
        // -------------------------------------------------

        for (
            const name
            of Object.keys(this.offsets)
        ) {

            const isArm =
                name === "upperArmL" ||
                name === "upperArmR" ||
                name === "forearmL" ||
                name === "forearmR";


            const isHead =
                name === "neck" ||
                name === "head";


            let rate;


            if (isHead) {

                rate =
                    this.tuning.headDamp;

            } else if (isArm) {

                rate =
                    this.tuning.armDamp;

            } else {

                rate =
                    this.tuning.torsoDamp;
            }


            this.offsets[name] =
                damp(
                    this.offsets[name],
                    this.targets[name],
                    rate,
                    safeDt
                );
        }


        // -------------------------------------------------
        // APPLY
        // -------------------------------------------------

        this.applyPose();
    }


    // =====================================================
    // APPLY POSE
    // =====================================================

    applyPose() {

        for (
            const [name, bone]
            of Object.entries(this.bones)
        ) {

            const restAngle =
                finite(
                    bone.restAngle,
                    0
                );


            const offset =
                clamp(
                    finite(
                        this.offsets[name],
                        0
                    ),
                    -Math.PI,
                    Math.PI
                );


            bone.localAngle =
                restAngle +
                offset;
        }
    }


    // =====================================================
    // RESET
    // =====================================================

    reset() {

        for (
            const name
            of Object.keys(this.targets)
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


    // =====================================================
    // CONNECTIONS
    // =====================================================

    setGravityFrame(
        gravityFrame
    ) {

        this.gravityFrame =
            gravityFrame || null;
    }


    setGait(
        gait
    ) {

        this.gait =
            gait || null;
    }


    // =====================================================
    // STATE
    // =====================================================

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


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        if (!this.skeleton) {
            return false;
        }

        if (!this.bodyState) {
            return false;
        }


        const finiteObject =
            object =>
                Object.values(object)
                    .every(
                        value =>
                            Number.isFinite(value)
                    );


        if (
            !finiteObject(
                this.targets
            )
        ) {

            return false;
        }


        if (
            !finiteObject(
                this.offsets
            )
        ) {

            return false;
        }


        if (
            !Number.isFinite(
                this.intensity
            )
        ) {

            return false;
        }


        if (
            !Number.isFinite(
                this.acceleration
            )
        ) {

            return false;
        }


        return true;
    }
}
