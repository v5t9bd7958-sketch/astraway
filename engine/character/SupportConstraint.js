import { clamp01, finite, distance } from "../core/MathUtils.js";

export default class SupportConstraint {
  constructor(skeleton, gait, options = {}) {
    this.skeleton = skeleton;
    this.gait = gait;

    this.reserve = clamp01(
      finite(options.reserve, 0.05)
    );

    this.softStart = clamp01(
      finite(options.softStart, 0.85)
    );

    this.permission = 1;
    this.stepDemand = 0;

    this.state = {
      left: null,
      right: null,
      constrainedLeg: null
    };
  }

  update() {
    const left = this._measureLeg("left");
    const right = this._measureLeg("right");

    const measurements = [left, right].filter(
      (measurement) => measurement && measurement.planted
    );

    if (measurements.length === 0) {
      this.permission = 1;
      this.stepDemand = 0;

      this.state = {
        left,
        right,
        constrainedLeg: null
      };

      return this._snapshot();
    }

    let mostConstrained = measurements[0];

    for (let i = 1; i < measurements.length; i += 1) {
      if (
        measurements[i].permission <
        mostConstrained.permission
      ) {
        mostConstrained = measurements[i];
      }
    }

    this.permission = clamp01(
      mostConstrained.permission
    );

    this.stepDemand = clamp01(
      Math.max(...measurements.map(
        (measurement) => measurement.stepDemand
      ))
    );

    this.state = {
      left,
      right,
      constrainedLeg: mostConstrained.side
    };

    return this._snapshot();
  }

  getPermission() {
    return clamp01(
      finite(this.permission, 1)
    );
  }

  getStepDemand() {
    return clamp01(
      finite(this.stepDemand, 0)
    );
  }

  reset() {
    this.permission = 1;
    this.stepDemand = 0;

    this.state = {
      left: null,
      right: null,
      constrainedLeg: null
    };
  }

  validate() {
    return {
      permission: this.getPermission(),
      stepDemand: this.getStepDemand(),
      reserve: this.reserve,
      softStart: this.softStart,
      constrainedLeg: this.state.constrainedLeg,
      left: this.state.left,
      right: this.state.right
    };
  }

  _measureLeg(side) {
    const planted = this._isPlanted(side);

    if (!planted) {
      return {
        side,
        planted: false,
        distance: 0,
        maxReach: 0,
        stretchRatio: 0,
        permission: 1,
        stepDemand: 0
      };
    }

    const hip = this._getHipPosition(side);
    const foot = this._getPlantedFoot(side);

    if (!hip || !foot) {
      return {
        side,
        planted: true,
        distance: 0,
        maxReach: 0,
        stretchRatio: 0,
        permission: 1,
        stepDemand: 0,
        valid: false
      };
    }

    const upperLength = this._getBoneLength(
      side === "left" ? "thighL" : "thighR"
    );

    const lowerLength = this._getBoneLength(
      side === "left" ? "shinL" : "shinR"
    );

    const anatomicalReach =
      upperLength + lowerLength;

    const reserveLength =
      anatomicalReach * this.reserve;

    const maxReach = Math.max(
      0.001,
      anatomicalReach - reserveLength
    );

    const currentDistance = distance(
      hip,
      foot
    );

    const stretchRatio =
      currentDistance / maxReach;

    const permission =
      this._calculatePermission(stretchRatio);

    const stepDemand =
      this._calculateStepDemand(stretchRatio);

    return {
      side,
      planted: true,
      valid: true,
      distance: currentDistance,
      anatomicalReach,
      reserveLength,
      maxReach,
      stretchRatio,
      permission,
      stepDemand
    };
  }

  _calculatePermission(stretchRatio) {
    if (!Number.isFinite(stretchRatio)) {
      return 1;
    }

    if (stretchRatio <= this.softStart) {
      return 1;
    }

    if (stretchRatio >= 1) {
      return 0;
    }

    const range =
      Math.max(
        0.001,
        1 - this.softStart
      );

    const pressure =
      (stretchRatio - this.softStart) / range;

    return clamp01(1 - pressure);
  }

  _calculateStepDemand(stretchRatio) {
    if (!Number.isFinite(stretchRatio)) {
      return 0;
    }

    if (stretchRatio <= this.softStart) {
      return 0;
    }

    if (stretchRatio >= 1) {
      return 1;
    }

    const range =
      Math.max(
        0.001,
        1 - this.softStart
      );

    return clamp01(
      (stretchRatio - this.softStart) / range
    );
  }

  _isPlanted(side) {
    if (!this.gait) {
      return false;
    }

    const state =
      typeof this.gait.getLegState === "function"
        ? this.gait.getLegState(side)
        : null;

    return Boolean(
      state &&
      state.planted &&
      !state.stepping
    );
  }

  _getPlantedFoot(side) {
    if (!this.gait) {
      return null;
    }

    const state =
      typeof this.gait.getLegState === "function"
        ? this.gait.getLegState(side)
        : null;

    if (!state) {
      return null;
    }

    const point =
      state.plantedPosition ||
      state.position ||
      null;

    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    ) {
      return null;
    }

    return {
      x: point.x,
      y: point.y
    };
  }

  _getHipPosition(side) {
    if (!this.skeleton) {
      return null;
    }

    const boneName =
      side === "left"
        ? "thighL"
        : "thighR";

    const bone =
      this.skeleton.bones &&
      this.skeleton.bones[boneName];

    if (!bone) {
      return null;
    }

    const x = Number(
      bone.worldX
    );

    const y = Number(
      bone.worldY
    );

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null;
    }

    return { x, y };
  }

  _getBoneLength(name) {
    if (
      this.skeleton &&
      typeof this.skeleton.getAnatomicalLength === "function"
    ) {
      const value =
        this.skeleton.getAnatomicalLength(name);

      if (
        Number.isFinite(value) &&
        value > 0
      ) {
        return value;
      }
    }

    const bone =
      this.skeleton &&
      this.skeleton.bones &&
      this.skeleton.bones[name];

    if (
      bone &&
      Number.isFinite(bone.length) &&
      bone.length > 0
    ) {
      return bone.length;
    }

    return 0;
  }

  _snapshot() {
    return {
      progressionPermission: this.getPermission(),
      permission: this.getPermission(),
      stepDemand: this.getStepDemand(),
      left: this.state.left,
      right: this.state.right,
      constrainedLeg: this.state.constrainedLeg
    };
  }
}
