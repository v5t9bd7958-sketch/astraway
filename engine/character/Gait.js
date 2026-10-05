import {
  clamp01,
  distance,
  finite,
  normalize,
  lerpPoint,
  addScaled
} from "../core/MathUtils.js";

export default class Gait {
  constructor(options = {}) {
    this.stepLength = finite(options.stepLength, 30);
    this.stepHeight = finite(options.stepHeight, 11);
    this.stepDuration = Math.max(
      0.05,
      finite(options.stepDuration, 0.18)
    );

    this.phase = 0;
    this.distanceAccumulator = 0;

    this.previousCharacterPosition = null;
    this.movementDirection = 1;

    this.stepDemand = 0;

    this.legs = {
      left: this._createLeg("left"),
      right: this._createLeg("right")
    };

    this.skeleton = null;
  }

  bindSkeleton(skeleton) {
    this.skeleton = skeleton;
  }

  initialize(position = null) {
    this.phase = 0;
    this.distanceAccumulator = 0;
    this.previousCharacterPosition = position
      ? { x: position.x, y: position.y }
      : null;

    this.stepDemand = 0;

    if (!this.skeleton) {
      return;
    }

    const left = this.skeleton.getBoneWorldPosition("ankleL");
    const right = this.skeleton.getBoneWorldPosition("ankleR");

    if (left) {
      this._initializeLeg(this.legs.left, left);
    }

    if (right) {
      this._initializeLeg(this.legs.right, right);
    }
  }

  update({
    dt = 0,
    characterPosition = null,
    tangent = { x: 1, y: 0 },
    normal = { x: 0, y: -1 }
  } = {}) {
    const safeDt = Math.max(
      0,
      finite(dt, 0)
    );

    const safeTangent = normalize(
      tangent,
      { x: 1, y: 0 }
    );

    const safeNormal = normalize(
      normal,
      { x: 0, y: -1 }
    );

    const movement = this._measureMovement(
      characterPosition,
      safeTangent
    );

    this._updatePhase(
      movement.signedDistance,
      safeDt
    );

    this._tryStartStep(
      "left",
      safeTangent,
      safeNormal
    );

    this._tryStartStep(
      "right",
      safeTangent,
      safeNormal
    );

    this._updateLeg(
      this.legs.left,
      safeDt,
      safeNormal
    );

    this._updateLeg(
      this.legs.right,
      safeDt,
      safeNormal
    );

    this._stabilizeIdleLegs();

    if (characterPosition) {
      this.previousCharacterPosition = {
        x: characterPosition.x,
        y: characterPosition.y
      };
    }

    return this.getSnapshot();
  }

  setStepDemand(value) {
    this.stepDemand = clamp01(
      finite(value, 0)
    );
  }

  getStepDemand() {
    return clamp01(
      finite(this.stepDemand, 0)
    );
  }

  getLegState(side) {
    const leg = this.legs[side];

    if (!leg) {
      return null;
    }

    return {
      side: leg.side,
      planted: leg.planted,
      stepping: leg.stepping,

      position: leg.position
        ? {
            x: leg.position.x,
            y: leg.position.y
          }
        : null,

      plantedPosition: leg.plantedPosition
        ? {
            x: leg.plantedPosition.x,
            y: leg.plantedPosition.y
          }
        : null,

      startPosition: leg.startPosition
        ? {
            x: leg.startPosition.x,
            y: leg.startPosition.y
          }
        : null,

      targetPosition: leg.targetPosition
        ? {
            x: leg.targetPosition.x,
            y: leg.targetPosition.y
          }
        : null,

      progress: leg.progress,
      lastSurfaceT: leg.lastSurfaceT
    };
  }

  getSnapshot() {
    return {
      phase: this.phase,
      distanceAccumulator: this.distanceAccumulator,
      movementDirection: this.movementDirection,
      stepDemand: this.stepDemand,

      left: this.getLegState("left"),
      right: this.getLegState("right")
    };
  }

  reset() {
    this.phase = 0;
    this.distanceAccumulator = 0;
    this.previousCharacterPosition = null;
    this.movementDirection = 1;
    this.stepDemand = 0;

    this.legs.left = this._createLeg("left");
    this.legs.right = this._createLeg("right");
  }

  validate() {
    return {
      phase: finite(this.phase, 0),
      distanceAccumulator: finite(
        this.distanceAccumulator,
        0
      ),
      movementDirection: this.movementDirection,
      stepDemand: this.getStepDemand(),

      left: this.getLegState("left"),
      right: this.getLegState("right")
    };
  }

  _createLeg(side) {
    return {
      side,

      planted: true,
      stepping: false,

      position: null,
      plantedPosition: null,

      startPosition: null,
      targetPosition: null,

      progress: 0,
      lastSurfaceT: null
    };
  }

  _initializeLeg(leg, position) {
    const point = {
      x: finite(position.x, 0),
      y: finite(position.y, 0)
    };

    leg.planted = true;
    leg.stepping = false;

    leg.position = { ...point };
    leg.plantedPosition = { ...point };

    leg.startPosition = { ...point };
    leg.targetPosition = { ...point };

    leg.progress = 0;
    leg.lastSurfaceT = null;
  }

  _measureMovement(characterPosition, tangent) {
    if (
      !characterPosition ||
      !this.previousCharacterPosition
    ) {
      return {
        signedDistance: 0
      };
    }

    const dx =
      characterPosition.x -
      this.previousCharacterPosition.x;

    const dy =
      characterPosition.y -
      this.previousCharacterPosition.y;

    const signedDistance =
      dx * tangent.x +
      dy * tangent.y;

    if (Math.abs(signedDistance) > 0.0001) {
      this.movementDirection =
        signedDistance >= 0 ? 1 : -1;
    }

    return {
      signedDistance
    };
  }

  _updatePhase(signedDistance, dt) {
    const magnitude = Math.abs(
      finite(signedDistance, 0)
    );

    this.distanceAccumulator += magnitude;

    if (magnitude > 0) {
      const phaseDistance =
        Math.max(
          0.001,
          this.stepLength
        );

      this.phase =
        (
          this.phase +
          magnitude / phaseDistance
        ) % 1;
    } else if (dt > 0) {
      const stepping =
        this.legs.left.stepping ||
        this.legs.right.stepping;

      if (!stepping) {
        this.phase =
          (this.phase + dt * 0.35) % 1;
      }
    }
  }

  _tryStartStep(side, tangent, normal) {
    const leg = this.legs[side];

    if (!leg || leg.stepping) {
      return;
    }

    const opposite =
      side === "left"
        ? this.legs.right
        : this.legs.left;

    if (opposite.stepping) {
      return;
    }

    if (!leg.position) {
      return;
    }

    const direction =
      this.movementDirection >= 0
        ? 1
        : -1;

    const desiredDistance =
      this.distanceAccumulator;

    const rhythmReady =
      this._rhythmReady(side);

    const demandReady =
      this.stepDemand >= 0.65;

    const distanceReady =
      desiredDistance >=
      this.stepLength * 0.5;

    if (
      !rhythmReady &&
      !demandReady &&
      !distanceReady
    ) {
      return;
    }

    const stride =
      this.stepLength * 0.65;

    const target = addScaled(
      leg.position,
      tangent,
      stride * direction
    );

    this._startStep(
      leg,
      target,
      normal
    );
  }

  _rhythmReady(side) {
    if (side === "left") {
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

  _startStep(leg, target, normal) {
    if (!leg.position) {
      return;
    }

    leg.stepping = true;
    leg.planted = false;

    leg.startPosition = {
      x: leg.position.x,
      y: leg.position.y
    };

    leg.targetPosition = {
      x: target.x,
      y: target.y
    };

    leg.progress = 0;

    this.stepDemand = 0;
  }

  _updateLeg(leg, dt, normal) {
    if (!leg.stepping) {
      return;
    }

    leg.progress +=
      dt / this.stepDuration;

    const t = clamp01(
      leg.progress
    );

    const eased =
      t * t * (3 - 2 * t);

    let position = lerpPoint(
      leg.startPosition,
      leg.targetPosition,
      eased
    );

    const lift =
      Math.sin(
        Math.PI * eased
      ) * this.stepHeight;

    position = addScaled(
      position,
      normal,
      -lift
    );

    leg.position = position;

    if (t >= 1) {
      leg.position = {
        x: leg.targetPosition.x,
        y: leg.targetPosition.y
      };

      leg.plantedPosition = {
        x: leg.targetPosition.x,
        y: leg.targetPosition.y
      };

      leg.stepping = false;
      leg.planted = true;
      leg.progress = 0;

      this.distanceAccumulator = 0;
    }
  }

  _stabilizeIdleLegs() {
    const left = this.legs.left;
    const right = this.legs.right;

    if (
      left.planted &&
      !left.stepping &&
      left.plantedPosition
    ) {
      left.position = {
        x: left.plantedPosition.x,
        y: left.plantedPosition.y
      };
    }

    if (
      right.planted &&
      !right.stepping &&
      right.plantedPosition
    ) {
      right.position = {
        x: right.plantedPosition.x,
        y: right.plantedPosition.y
      };
    }
  }
}
