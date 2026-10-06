// ASTRAWAY 2.0
// PoseComposer — единственный gameplay-layer writer локальной позы костей.
//
// Получает:
//   - MotionTargets (от Gait)
//   - upperBodyOffsets (от FullBodyController)
//   - данные для IK
//
// Делает:
//   1. применяет additive offsets верхней части тела
//   2. решает IK ног
//   3. записывает итоговые localAngle
//
// НЕ делает:
//   - перемещение root
//   - permission / stepDemand
//   - BodyState
//   - gait phase
//   - принятие решений о движении

import {
    solveTwoBoneIK
} from "./IK.js";

import {
    clamp,
    finite,
    normalizeAngle
} from "./MathUtils.js";

export default class PoseComposer {

    /**
     * @param {import("./Skeleton.js").default} skeleton
     */
    constructor(skeleton) {

        if (
            !skeleton ||
            typeof skeleton.getBone !== "function"
        ) {
            throw new Error(
                "PoseComposer: valid Skeleton is required"
            );
        }

        this.skeleton = skeleton;
    }

    /**
     * Единственная точка записи локальной позы.
     *
     * @param {object} options
     * @param {object} options.motionTargets  - { left, right } world foot targets from Gait
     * @param {object} options.upperBodyOffsets - { boneName: offset } from FBC
     * @param {object} [options.poleLeft]
     * @param {object} [options.poleRight]
     */
    compose(options = {}) {

        const motionTargets =
            options.motionTargets || null;

        const upperBodyOffsets =
            options.upperBodyOffsets || {};

        const poleLeft =
            options.poleLeft || null;

        const poleRight =
            options.poleRight || null;

        // -------------------------------------------------
        // 1. Upper body additive offsets
        // -------------------------------------------------

        this._applyUpperBodyOffsets(
            upperBodyOffsets
        );

        // -------------------------------------------------
        // 2. Leg IK from MotionTargets
        // -------------------------------------------------

        if (
            motionTargets &&
            motionTargets.left &&
            motionTargets.right
        ) {

            this._solveLeg(
                "thighL",
                "shinL",
                "ankleL",
                "footL",
                motionTargets.left,
                poleLeft
            );

            this._solveLeg(
                "thighR",
                "shinR",
                "ankleR",
                "footR",
                motionTargets.right,
                poleRight
            );
        }
    }

    // =====================================================
    // UPPER BODY
    // =====================================================

    _applyUpperBodyOffsets(offsets) {

        if (!offsets) {
            return;
        }

        const names = [
            "spineLower",
            "spineMid",
            "spineUpper",
            "chest",
            "upperArmL",
            "upperArmR",
            "forearmL",
            "forearmR",
            "neck",
            "head"
        ];

        for (const name of names) {

            const bone =
                this.skeleton.getBone(name);

            if (!bone) {
                continue;
            }

            const offset =
                finite(
                    offsets[name],
                    0
                );

            const rest =
                finite(
                    bone.restAngle,
                    0
                );

            bone.localAngle =
                normalizeAngle(
                    rest + offset
                );
        }
    }

    // =====================================================
    // LEG IK
    // =====================================================

    _solveLeg(
        thighName,
        shinName,
        ankleName,
        footName,
        target,
        pole
    ) {

        const thigh =
            this.skeleton.getBone(thighName);

        const shin =
            this.skeleton.getBone(shinName);

        const ankle =
            this.skeleton.getBone(ankleName);

        if (!thigh || !shin || !ankle) {
            return;
        }

        const upperLength =
            this.skeleton.getAnatomicalLength(thighName);

        const lowerLength =
            this.skeleton.getAnatomicalLength(shinName);

        const hipPosition = {
            x: finite(thigh.worldX, 0),
            y: finite(thigh.worldY, 0)
        };

        // Reach envelope clamp
        const maxReach =
            upperLength + lowerLength - 0.5;

        const dx =
            finite(target.x, hipPosition.x) -
            hipPosition.x;

        const dy =
            finite(target.y, hipPosition.y) -
            hipPosition.y;

        const dist =
            Math.hypot(dx, dy);

        let clampedTarget = {
            x: finite(target.x, hipPosition.x),
            y: finite(target.y, hipPosition.y)
        };

        if (dist > maxReach && dist > 0.0001) {

            const scale =
                maxReach / dist;

            clampedTarget = {
                x: hipPosition.x + dx * scale,
                y: hipPosition.y + dy * scale
            };
        }

        const result =
            solveTwoBoneIK(
                hipPosition,
                clampedTarget,
                upperLength,
                lowerLength,
                pole,
                {
                    minReach: 1
                }
            );

        this.skeleton.setWorldBoneAngle(
            thighName,
            result.hipAngle
        );

        this.skeleton.setWorldBoneAngle(
            shinName,
            result.kneeAngle
        );

        const foot =
            this.skeleton.getBone(footName);

        if (foot) {

            foot.localAngle =
                finite(
                    foot.restAngle,
                    0
                );
        }
    }
}
