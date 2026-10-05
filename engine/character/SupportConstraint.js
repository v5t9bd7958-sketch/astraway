// ASTRAWAY 2.0
// SupportConstraint
//
// Ограничивает продвижение тела, когда опорная нога
// приближается к кинематическому пределу.
//
// НЕ двигает Character.
// НЕ двигает Skeleton.
// НЕ запускает шаг.
//
// Только вычисляет:
// progressionPermission 0..1
// stepDemand для опорных ног.
//
// Character остаётся владельцем движения.
// Gait остаётся владельцем шага.

import {
    clamp01,
    finite
} from "./MathUtils.js";


export default class SupportConstraint {

    constructor(
        skeleton,
        gait,
        options = {}
    ) {

        if (!skeleton) {

            throw new Error(
                "SupportConstraint requires Skeleton"
            );
        }

        if (!gait) {

            throw new Error(
                "SupportConstraint requires Gait"
            );
        }


        this.skeleton =
            skeleton;

        this.gait =
            gait;


        /*
         * Reserve keeps the leg slightly away
         * from full anatomical extension.
         *
         * 0.05 = 5% reserve.
         */
        this.reserve =
            clamp01(
                finite(
                    options.reserve,
                    0.05
                )
            );


        /*
         * Distance at which the constraint starts
         * reducing progression.
         *
         * Below this point:
         *     permission = 1
         *
         * Near max reach:
         *     permission approaches 0.
         */
        this.softStart =
            clamp01(
                finite(
                    options.softStart,
                    0.70
                )
            );


        this.progressionPermission =
            1;


        this.stepDemand = {

            left: false,
            right: false
        };


        this.metrics = {

            left: this.createMetrics(),
            right: this.createMetrics()
        };
    }


    createMetrics() {

        return {

            planted: false,

            distance: 0,

            maximumReach: 0,

            usableReach: 0,

            normalizedReach: 0,

            permission: 1,

            demand: false
        };
    }


    // =====================================================
    // UPDATE
    // =====================================================

    update() {

        const left =
            this.evaluateLeg(
                "left",
                "thighL",
                "shinL"
            );


        const right =
            this.evaluateLeg(
                "right",
                "thighR",
                "shinR"
            );


        this.metrics.left =
            left;

        this.metrics.right =
            right;


        /*
         * A stepping leg does not constrain the body.
         *
         * Only currently planted legs participate.
         */
        const permissions = [];

        if (left.planted) {

            permissions.push(
                left.permission
            );
        }

        if (right.planted) {

            permissions.push(
                right.permission
            );
        }


        /*
         * No planted support:
         * do not introduce an artificial movement lock.
         */
        if (
            permissions.length === 0
        ) {

            this.progressionPermission =
                1;

        } else {

            this.progressionPermission =
                Math.min(
                    ...permissions
                );
        }


        this.progressionPermission =
            clamp01(
                finite(
                    this.progressionPermission,
                    1
                )
            );


        this.stepDemand.left =
            left.demand;

        this.stepDemand.right =
            right.demand;


        return this.getState();
    }


    // =====================================================
    // LEG EVALUATION
    // =====================================================

    evaluateLeg(
        side,
        thighName,
        shinName
    ) {

        const leg =
            this.gait.legs[side];


        const thigh =
            this.skeleton.getBone(
                thighName
            );


        const shin =
            this.skeleton.getBone(
                shinName
            );


        if (
            !leg ||
            !thigh ||
            !shin
        ) {

            return this.createMetrics();
        }


        /*
         * Only a planted foot is a support constraint.
         */
        const planted =
            !!leg.planted &&
            !leg.stepping;


        if (!planted) {

            return {

                ...this.createMetrics(),

                planted: false
            };
        }


        const dx =
            leg.plantedPosition.x -
            thigh.worldX;


        const dy =
            leg.plantedPosition.y -
            thigh.worldY;


        const distance =
            Math.hypot(
                dx,
                dy
            );


        const upperLength =
            Math.max(
                0,
                finite(
                    thigh.length,
                    0
                )
            ) *
            Math.max(
                0,
                finite(
                    thigh.worldScale,
                    1
                )
            );


        const lowerLength =
            Math.max(
                0,
                finite(
                    shin.length,
                    0
                )
            ) *
            Math.max(
                0,
                finite(
                    shin.worldScale,
                    1
                )
            );


        const maximumReach =
            upperLength +
            lowerLength;


        /*
         * Reserve is taken from the anatomical maximum.
         *
         * Example:
         *
         * max = 66
         * reserve = 5%
         * usable = 62.7
         */
        const usableReach =
            maximumReach *
            (
                1 -
                this.reserve
            );


        /*
         * Safety fallback.
         */
        if (
            usableReach <= 0.000001
        ) {

            return {

                planted: true,

                distance,

                maximumReach,

                usableReach,

                normalizedReach: 1,

                permission: 0,

                demand: true
            };
        }


        /*
         * Start reducing movement when the leg reaches
         * the configured soft-start fraction.
         */
        const softStartDistance =
            usableReach *
            this.softStart;


        let permission = 1;


        if (
            distance >
            softStartDistance
        ) {

            const span =
                usableReach -
                softStartDistance;


            if (
                span <= 0.000001
            ) {

                permission = 0;

            } else {

                permission =
                    1 -
                    (
                        distance -
                        softStartDistance
                    ) /
                    span;
            }
        }


        permission =
            clamp01(
                permission
            );


        /*
         * Hard demand is reached before the mathematical
         * IK limit. This gives Gait a chance to initiate
         * a new step while the body is still valid.
         */
        const demand =
            distance >=
            usableReach;


        const normalizedReach =
            clamp01(
                distance /
                Math.max(
                    usableReach,
                    0.000001
                )
            );


        return {

            planted: true,

            distance,

            maximumReach,

            usableReach,

            normalizedReach,

            permission,

            demand
        };
    }


    // =====================================================
    // API
    // =====================================================

    getPermission() {

        return this.progressionPermission;
    }


    getStepDemand() {

        return {

            left:
                this.stepDemand.left,

            right:
                this.stepDemand.right
        };
    }


    getState() {

        return {

            progressionPermission:
                this.progressionPermission,

            stepDemand: {

                left:
                    this.stepDemand.left,

                right:
                    this.stepDemand.right
            },

            left: {

                ...this.metrics.left
            },

            right: {

                ...this.metrics.right
            }
        };
    }


    reset() {

        this.progressionPermission =
            1;


        this.stepDemand.left =
            false;

        this.stepDemand.right =
            false;


        this.metrics.left =
            this.createMetrics();

        this.metrics.right =
            this.createMetrics();
    }
}
