import {
    clamp01,
    finite,
    normalize,
    lerpPoint,
    addScaled
} from "./MathUtils.js";


export default class Gait {

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


        this.phase = 0;

        this.distanceAccumulator = 0;

        this.previousCharacterPosition = null;

        this.movementDirection = 1;

        this.stepDemand = 0;


        this.legs = {

            left:
                this._createLeg(
                    "left"
                ),

            right:
                this._createLeg(
                    "right"
                )
        };


        this.skeleton = null;


        this.tangent = {
            x: 1,
            y: 0
        };

        this.normal = {
            x: 0,
            y: -1
        };
    }


    bindSkeleton(skeleton) {

        this.skeleton =
            skeleton;
    }


    initialize(
        position = null,
        tangent = null,
        normal = null,
        surface = null,
        surfaceT = 0
    ) {

        this.phase = 0;

        this.distanceAccumulator = 0;

        this.stepDemand = 0;

        this.movementDirection = 1;


        if (position) {

            this.previousCharacterPosition = {

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

        } else {

            this.previousCharacterPosition =
                null;
        }


        if (tangent) {

            this.tangent =
                normalize(
                    finite(
                        tangent.x,
                        1
                    ),

                    finite(
                        tangent.y,
                        0
                    ),

                    1,
                    0
                );
        }


        if (normal) {

            this.normal =
                normalize(
                    finite(
                        normal.x,
                        0
                    ),

                    finite(
                        normal.y,
                        -1
                    ),

                    0,
                    -1
                );
        }


        const left =
            this._getSkeletonWorldPosition(
                "ankleL"
            );

        const right =
            this._getSkeletonWorldPosition(
                "ankleR"
            );


        if (left) {

            this._initializeLeg(
                this.legs.left,
                left
            );
        }


        if (right) {

            this._initializeLeg(
                this.legs.right,
                right
            );
        }
    }


    update(
        dt = 0,
        frameDistance = 0,
        characterPosition = null,
        tangent = null,
        normal = null,
        surface = null,
        surfaceT = 0,
        isMoving = false
    ) {

        const safeDt =
            Math.max(
                0,
                finite(
                    dt,
                    0
                )
            );


        if (tangent) {

            this.tangent =
                normalize(
                    finite(
                        tangent.x,
                        this.tangent.x
                    ),

                    finite(
                        tangent.y,
                        this.tangent.y
                    ),

                    this.tangent.x,
                    this.tangent.y
                );
        }


        if (normal) {

            this.normal =
                normalize(
                    finite(
                        normal.x,
                        this.normal.x
                    ),

                    finite(
                        normal.y,
                        this.normal.y
                    ),

                    this.normal.x,
                    this.normal.y
                );
        }


        const movement =
            this._measureMovement(
                characterPosition
            );


        let signedDistance =
            movement.signedDistance;


        if (
            !Number.isFinite(
                signedDistance
            )
        ) {

            signedDistance =
                finite(
                    frameDistance,
                    0
                ) *
                this.movementDirection;
        }


        if (
            Math.abs(
                signedDistance
            ) <
            0.000001 &&
            Math.abs(
                frameDistance
            ) >
            0.000001
        ) {

            signedDistance =
                Math.abs(
                    frameDistance
                ) *
                this.movementDirection;
        }


        this._updatePhase(
            signedDistance
        );


        if (isMoving) {

            this._tryStartStep(
                "left"
            );

            this._tryStartStep(
                "right"
            );
        }


        this._updateLeg(
            this.legs.left,
            safeDt
        );


        this._updateLeg(
            this.legs.right,
            safeDt
        );


        this._stabilizeIdleLegs();


        if (characterPosition) {

            this.previousCharacterPosition = {

                x:
                    finite(
                        characterPosition.x,
                        0
                    ),

                y:
                    finite(
                        characterPosition.y,
                        0
                    )
            };
        }


        return this._buildCharacterResult();
    }


    setStepDemand(value) {

        this.stepDemand =
            clamp01(
                finite(
                    value,
                    0
                )
            );
    }


    getStepDemand() {

        return clamp01(
            finite(
                this.stepDemand,
                0
            )
        );
    }


    getLegState(side) {

        const leg =
            this.legs[side];


        if (!leg) {
            return null;
        }


        return {

            side:
                leg.side,

            planted:
                leg.planted,

            stepping:
                leg.stepping,

            position:
                leg.position
                    ? {
                        x:
                            leg.position.x,

                        y:
                            leg.position.y
                    }
                    : null,

            plantedPosition:
                leg.plantedPosition
                    ? {
                        x:
                            leg.plantedPosition.x,

                        y:
                            leg.plantedPosition.y
                    }
                    : null,

            startPosition:
                leg.startPosition
                    ? {
                        x:
                            leg.startPosition.x,

                        y:
                            leg.startPosition.y
                    }
                    : null,

            targetPosition:
                leg.targetPosition
                    ? {
                        x:
                            leg.targetPosition.x,

                        y:
                            leg.targetPosition.y
                    }
                    : null,

            progress:
                leg.progress,

            lastSurfaceT:
                leg.lastSurfaceT
        };
    }


    getSnapshot() {

        return {

            phase:
                this.phase,

            distanceAccumulator:
                this.distanceAccumulator,

            movementDirection:
                this.movementDirection,

            stepDemand:
                this.stepDemand,

            left:
                this.getLegState(
                    "left"
                ),

            right:
                this.getLegState(
                    "right"
                )
        };
    }


    reset() {

        this.phase = 0;

        this.distanceAccumulator = 0;

        this.previousCharacterPosition =
            null;

        this.movementDirection = 1;

        this.stepDemand = 0;


        this.legs = {

            left:
                this._createLeg(
                    "left"
                ),

            right:
                this._createLeg(
                    "right"
                )
        };
    }


    validate() {

        return {

            phase:
                finite(
                    this.phase,
                    0
                ),

            distanceAccumulator:
                finite(
                    this.distanceAccumulator,
                    0
                ),

            movementDirection:
                this.movementDirection,

            stepDemand:
                this.getStepDemand(),

            left:
                this.getLegState(
                    "left"
                ),

            right:
                this.getLegState(
                    "right"
                )
        };
    }


    _createLeg(side) {

        return {

            side,

            planted:
                true,

            stepping:
                false,

            position:
                null,

            plantedPosition:
                null,

            startPosition:
                null,

            targetPosition:
                null,

            progress:
                0,

            lastSurfaceT:
                null
        };
    }


    _initializeLeg(
        leg,
        position
    ) {

        const point = {

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


        leg.planted =
            true;

        leg.stepping =
            false;


        leg.position = {
            ...point
        };


        leg.plantedPosition = {
            ...point
        };


        leg.startPosition = {
            ...point
        };


        leg.targetPosition = {
            ...point
        };


        leg.progress = 0;

        leg.lastSurfaceT = null;
    }


    _measureMovement(
        characterPosition
    ) {

        if (
            !characterPosition ||
            !this.previousCharacterPosition
        ) {

            return {
                signedDistance:
                    0
            };
        }


        const dx =
            finite(
                characterPosition.x,
                0
            ) -
            this.previousCharacterPosition.x;


        const dy =
            finite(
                characterPosition.y,
                0
            ) -
            this.previousCharacterPosition.y;


        const signedDistance =
            dx *
            this.tangent.x +

            dy *
            this.tangent.y;


        if (
            Math.abs(
                signedDistance
            ) >
            0.0001
        ) {

            this.movementDirection =
                signedDistance >= 0
                    ? 1
                    : -1;
        }


        return {
            signedDistance
        };
    }


    _updatePhase(
        signedDistance
    ) {

        const magnitude =
            Math.abs(
                finite(
                    signedDistance,
                    0
                )
            );


        this.distanceAccumulator +=
            magnitude;


        const phaseDistance =
            Math.max(
                0.001,
                this.stepLength
            );


        if (
            magnitude >
            0.000001
        ) {

            this.phase =
                (
                    this.phase +
                    magnitude /
                    phaseDistance
                ) %
                1;
        }
    }


    _tryStartStep(side) {

        const leg =
            this.legs[side];


        if (
            !leg ||
            leg.stepping ||
            !leg.position
        ) {
            return;
        }


        const opposite =
            side === "left"
                ? this.legs.right
                : this.legs.left;


        if (
            opposite &&
            opposite.stepping
        ) {
            return;
        }


        const rhythmReady =
            this._rhythmReady(
                side
            );


        const demandReady =
            this.stepDemand >=
            0.65;


        const distanceReady =
            this.distanceAccumulator >=
            this.stepLength * 0.5;


        if (
            !rhythmReady &&
            !demandReady &&
            !distanceReady
        ) {
            return;
        }


        const direction =
            this.movementDirection >= 0
                ? 1
                : -1;


        const stride =
            this.stepLength *
            0.65;


        const target =
            addScaled(
                leg.position,
                this.tangent,
                stride *
                direction
            );


        this._startStep(
            leg,
            target
        );
    }


    _rhythmReady(side) {

        if (
            side === "left"
        ) {

            return (
                this.phase >= 0.45 &&
                this.phase <= 0.62
            );
        }


        return (
            this.phase >= 0.95 ||
            this.phase <= 0.12
        );
    }


    _startStep(
        leg,
        target
    ) {

        if (
            !leg ||
            !leg.position
        ) {
            return;
        }


        leg.stepping =
            true;

        leg.planted =
            false;


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


        leg.progress = 0;

        this.stepDemand = 0;
    }


    _updateLeg(
        leg,
        dt
    ) {

        if (
            !leg ||
            !leg.stepping
        ) {
            return;
        }


        leg.progress +=
            dt /
            this.stepDuration;


        const t =
            clamp01(
                leg.progress
            );


        const eased =
            t *
            t *
            (
                3 -
                2 * t
            );


        let position =
            lerpPoint(
                leg.startPosition,
                leg.targetPosition,
                eased
            );


        const lift =
            Math.sin(
                Math.PI *
                eased
            ) *
            this.stepHeight;


        position =
            addScaled(
                position,
                this.normal,
                -lift
            );


        leg.position =
            position;


        if (
            t >= 1
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


            leg.stepping =
                false;

            leg.planted =
                true;

            leg.progress = 0;


            this.distanceAccumulator =
                0;
        }
    }


    _stabilizeIdleLegs() {

        const left =
            this.legs.left;

        const right =
            this.legs.right;


        if (
            left.planted &&
            !left.stepping &&
            left.plantedPosition
        ) {

            left.position = {

                x:
                    left.plantedPosition.x,

                y:
                    left.plantedPosition.y
            };
        }


        if (
            right.planted &&
            !right.stepping &&
            right.plantedPosition
        ) {

            right.position = {

                x:
                    right.plantedPosition.x,

                y:
                    right.plantedPosition.y
            };
        }
    }


    _buildCharacterResult() {

        const left =
            this.legs.left.position
                ? {
                    x:
                        this.legs.left.position.x,

                    y:
                        this.legs.left.position.y
                }
                : {
                    x: 0,
                    y: 0
                };


        const right =
            this.legs.right.position
                ? {
                    x:
                        this.legs.right.position.x,

                    y:
                        this.legs.right.position.y
                }
                : {
                    x: 0,
                    y: 0
                };


        return {

            left,

            right,

            leftPlanted:
                this.legs.left.planted &&
                !this.legs.left.stepping,

            rightPlanted:
                this.legs.right.planted &&
                !this.legs.right.stepping,

            leftStepping:
                this.legs.left.stepping,

            rightStepping:
                this.legs.right.stepping,

            phase:
                this.phase,

            stepDemand:
                this.stepDemand
        };
    }


    _getSkeletonWorldPosition(
        boneName
    ) {

        if (!this.skeleton) {
            return null;
        }


        if (
            typeof this.skeleton.getBone !==
            "function"
        ) {
            return null;
        }


        const bone =
            this.skeleton.getBone(
                boneName
            );


        if (!bone) {
            return null;
        }


        if (
            typeof bone.getWorldPosition ===
            "function"
        ) {

            return bone.getWorldPosition();
        }


        if (
            Number.isFinite(
                bone.worldX
            ) &&
            Number.isFinite(
                bone.worldY
            )
        ) {

            return {

                x:
                    bone.worldX,

                y:
                    bone.worldY
            };
        }


        return null;
    }
}
