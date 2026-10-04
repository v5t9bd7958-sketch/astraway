// ASTRAWAY 2.0
// BodyState — derived physical state of the character body.
//
// Architecture:
//
// WORLD
//   ↓
// SURFACE
//   ↓
// GRAVITY FRAME
//   ↓
// BODY STATE
//   ↓
// FULL BODY CONTROLLER
//
// BodyState owns:
// - center of mass (COM)
// - total mass
// - foot contact / plant / weight state
// - weight distribution
// - balance evaluation
//
// BodyState does NOT own:
// - pose
// - IK
// - gait
// - animation
// - surface sampling
// - gravity frame creation
// - skeleton mutation
//
// COM uses bone segment midpoints.
// Bones with mass <= 0 are ignored.
// World segment length includes bone.worldScale.


import {
    clamp01,
    finite
} from "./MathUtils.js";


// =========================================================
// BODY STATE
// =========================================================

export default class BodyState {

    /**
     * @param {import("./Skeleton.js").default} skeleton
     */
    constructor(skeleton) {

        if (
            !skeleton ||
            typeof skeleton.getBone !== "function" ||
            !(skeleton.bones instanceof Map)
        ) {
            throw new Error(
                "BodyState requires a valid Skeleton instance"
            );
        }


        this.skeleton =
            skeleton;


        // -------------------------------------------------
        // MASS / CENTER OF MASS
        // -------------------------------------------------

        this.totalMass =
            0;

        this.com = {
            x: 0,
            y: 0
        };


        // -------------------------------------------------
        // FEET
        // -------------------------------------------------

        this.feet = {
            left: this._createFootState(),
            right: this._createFootState()
        };


        this.weightDistribution = {
            left: 0,
            right: 0
        };


        // -------------------------------------------------
        // BALANCE
        // -------------------------------------------------

        // World-space horizontal threshold for now.
        // Later FullBodyController + GravityFrame can
        // evaluate balance in the local gravity frame.
        this.balanceThreshold =
            12;

        this.balance = {
            supported: false,
            stable: false,
            supportPoint: {
                x: 0,
                y: 0
            },
            comOffset: {
                x: 0,
                y: 0
            }
        };


        // Initial derived state.
        this.update();
    }


    // =====================================================
    // INTERNAL HELPERS
    // =====================================================

    _createFootState() {

        return {
            contact: false,
            planted: false,
            weight: 0,

            point: {
                x: 0,
                y: 0
            },

            normal: {
                x: 0,
                y: -1
            }
        };
    }


    _isValidSide(side) {

        return (
            side === "left" ||
            side === "right"
        );
    }


    _getFoot(side) {

        if (!this._isValidSide(side)) {
            return null;
        }

        return this.feet[side];
    }


    // =====================================================
    // UPDATE
    // =====================================================

    /**
     * Recalculate derived body state from the current
     * skeleton transforms and stored foot contacts.
     *
     * Does not mutate the skeleton.
     */
    update() {

        this.recalculateCOM();
        this.updateBalance();

        return this;
    }


    // =====================================================
    // CENTER OF MASS
    // =====================================================

    /**
     * Calculate:
     *
     * COM = Σ(midpoint × mass) / Σ(mass)
     *
     * Bone midpoint:
     *
     * origin +
     * direction(worldAngle) *
     * (length * worldScale * 0.5)
     *
     * This matches Skeleton world-segment geometry.
     *
     * Bones with mass <= 0 are ignored.
     * Zero-length bones contribute at their origin.
     */
    recalculateCOM() {

        let sumMass =
            0;

        let sumX =
            0;

        let sumY =
            0;


        for (
            const bone
            of this.skeleton.bones.values()
        ) {

            const mass =
                finite(
                    bone.mass,
                    0
                );


            if (mass <= 0) {
                continue;
            }


            const length =
                Math.max(
                    0,
                    finite(
                        bone.length,
                        0
                    )
                );


            const worldScale =
                Math.max(
                    0,
                    finite(
                        bone.worldScale,
                        1
                    )
                );


            const angle =
                finite(
                    bone.worldAngle,
                    0
                );


            const originX =
                finite(
                    bone.worldX,
                    0
                );

            const originY =
                finite(
                    bone.worldY,
                    0
                );


            // World-space half segment length.
            const half =
                length *
                worldScale *
                0.5;


            const midX =
                originX +
                Math.cos(angle) *
                half;

            const midY =
                originY +
                Math.sin(angle) *
                half;


            sumMass +=
                mass;

            sumX +=
                midX * mass;

            sumY +=
                midY * mass;
        }


        this.totalMass =
            sumMass;


        if (sumMass > 0) {

            this.com.x =
                sumX / sumMass;

            this.com.y =
                sumY / sumMass;

        } else {

            // Safe fallback to pelvis position.
            const pelvis =
                this.skeleton.getBone(
                    "pelvis"
                );


            if (pelvis) {

                this.com.x =
                    finite(
                        pelvis.worldX,
                        0
                    );

                this.com.y =
                    finite(
                        pelvis.worldY,
                        0
                    );

            } else {

                this.com.x =
                    0;

                this.com.y =
                    0;
            }
        }


        return this.com;
    }


    getCOM() {

        return {
            x: this.com.x,
            y: this.com.y
        };
    }


    getTotalMass() {

        return this.totalMass;
    }


    // =====================================================
    // FOOT CONTACT
    // =====================================================

    /**
     * Set contact state for one foot.
     *
     * @param {"left"|"right"} side
     * @param {boolean} contact
     * @param {{x:number,y:number}|null} point
     * @param {{x:number,y:number}|null} normal
     */
    setFootContact(
        side,
        contact,
        point = null,
        normal = null
    ) {

        const foot =
            this._getFoot(side);


        if (!foot) {
            return this;
        }


        foot.contact =
            !!contact;


        // Update contact point only when valid data
        // is explicitly supplied.
        if (
            point &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
        ) {

            foot.point.x =
                point.x;

            foot.point.y =
                point.y;
        }


        // Update contact normal only when valid.
        if (
            normal &&
            Number.isFinite(normal.x) &&
            Number.isFinite(normal.y)
        ) {

            const length =
                Math.hypot(
                    normal.x,
                    normal.y
                );


            if (length > 1e-8) {

                foot.normal.x =
                    normal.x / length;

                foot.normal.y =
                    normal.y / length;
            }
        }


        // A foot cannot remain planted after
        // losing contact.
        if (!foot.contact) {

            foot.planted =
                false;
        }


        return this;
    }


    /**
     * @param {"left"|"right"} side
     * @param {boolean} planted
     */
    setFootPlanted(
        side,
        planted
    ) {

        const foot =
            this._getFoot(side);


        if (!foot) {
            return this;
        }


        // Planting requires actual contact.
        foot.planted =
            !!planted &&
            foot.contact;


        return this;
    }


    /**
     * Set left/right weight distribution.
     *
     * Values are clamped to [0, 1].
     * If their sum exceeds 1, they are normalized.
     *
     * @param {number} leftWeight
     * @param {number} rightWeight
     */
    setFootWeight(
        leftWeight,
        rightWeight
    ) {

        let left =
            clamp01(
                finite(
                    leftWeight,
                    0
                )
            );


        let right =
            clamp01(
                finite(
                    rightWeight,
                    0
                )
            );


        const sum =
            left + right;


        if (sum > 1) {

            left /=
                sum;

            right /=
                sum;
        }


        this.weightDistribution.left =
            left;

        this.weightDistribution.right =
            right;


        this.feet.left.weight =
            left;

        this.feet.right.weight =
            right;


        return this;
    }


    /**
     * Reset both feet to a non-contact state.
     */
    resetContacts() {

        this.feet.left =
            this._createFootState();

        this.feet.right =
            this._createFootState();


        this.weightDistribution.left =
            0;

        this.weightDistribution.right =
            0;


        return this;
    }


    // =====================================================
    // BALANCE
    // =====================================================

    /**
     * Minimal balance model.
     *
     * supported:
     *   at least one foot has contact.
     *
     * supportPoint:
     *   - one contacting foot → that foot
     *   - two contacting feet → weighted average
     *   - two contacts with zero total weight → simple average
     *
     * comOffset:
     *   COM - supportPoint
     *
     * stable:
     *   horizontal COM offset is within threshold.
     *
     * NOTE:
     * Current horizontal test uses world X.
     * Gravity-relative balance will be handled later
     * when GravityFrame is consumed by the controller.
     */
    updateBalance() {

        const left =
            this.feet.left;

        const right =
            this.feet.right;


        const leftContact =
            left.contact;

        const rightContact =
            right.contact;


        const supported =
            leftContact ||
            rightContact;


        this.balance.supported =
            supported;


        // No support → no stable balance.
        if (!supported) {

            this.balance.stable =
                false;


            // Keep the state deterministic.
            this.balance.supportPoint.x =
                this.com.x;

            this.balance.supportPoint.y =
                this.com.y;


            this.balance.comOffset.x =
                0;

            this.balance.comOffset.y =
                0;


            return this.balance;
        }


        // -------------------------------------------------
        // SUPPORT POINT
        // -------------------------------------------------

        let supportX =
            0;

        let supportY =
            0;


        if (
            leftContact &&
            rightContact
        ) {

            const leftWeight =
                clamp01(
                    finite(
                        left.weight,
                        0
                    )
                );

            const rightWeight =
                clamp01(
                    finite(
                        right.weight,
                        0
                    )
                );


            const weightSum =
                leftWeight +
                rightWeight;


            if (weightSum > 1e-8) {

                supportX =
                    (
                        left.point.x *
                        leftWeight +

                        right.point.x *
                        rightWeight
                    ) /
                    weightSum;


                supportY =
                    (
                        left.point.y *
                        leftWeight +

                        right.point.y *
                        rightWeight
                    ) /
                    weightSum;

            } else {

                // No weight information:
                // use geometric midpoint.
                supportX =
                    (
                        left.point.x +
                        right.point.x
                    ) *
                    0.5;


                supportY =
                    (
                        left.point.y +
                        right.point.y
                    ) *
                    0.5;
            }

        } else if (leftContact) {

            supportX =
                left.point.x;

            supportY =
                left.point.y;

        } else {

            supportX =
                right.point.x;

            supportY =
                right.point.y;
        }


        this.balance.supportPoint.x =
            finite(
                supportX,
                0
            );

        this.balance.supportPoint.y =
            finite(
                supportY,
                0
            );


        // -------------------------------------------------
        // COM OFFSET
        // -------------------------------------------------

        this.balance.comOffset.x =
            finite(
                this.com.x -
                this.balance.supportPoint.x,
                0
            );


        this.balance.comOffset.y =
            finite(
                this.com.y -
                this.balance.supportPoint.y,
                0
            );


        // -------------------------------------------------
        // STABILITY
        // -------------------------------------------------

        const threshold =
            Math.max(
                0,
                finite(
                    this.balanceThreshold,
                    12
                )
            );


        this.balance.stable =
            Math.abs(
                this.balance.comOffset.x
            ) <=
            threshold;


        return this.balance;
    }


    getBalance() {

        return {
            supported:
                this.balance.supported,

            stable:
                this.balance.stable,

            supportPoint: {
                x:
                    this.balance.supportPoint.x,

                y:
                    this.balance.supportPoint.y
            },

            comOffset: {
                x:
                    this.balance.comOffset.x,

                y:
                    this.balance.comOffset.y
            }
        };
    }


    // =====================================================
    // RESET
    // =====================================================

    reset() {

        this.resetContacts();


        this.balanceThreshold =
            12;


        this.update();


        return this;
    }


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        // -------------------------------------------------
        // SKELETON
        // -------------------------------------------------

        if (
            !this.skeleton ||
            typeof this.skeleton.getBone !== "function" ||
            !(this.skeleton.bones instanceof Map)
        ) {

            return {
                valid: false,
                error:
                    "BodyState has no valid Skeleton"
            };
        }


        // -------------------------------------------------
        // MASS
        // -------------------------------------------------

        if (
            !Number.isFinite(
                this.totalMass
            ) ||
            this.totalMass <= 0
        ) {

            return {
                valid: false,
                error:
                    `Invalid totalMass: ${this.totalMass}`
            };
        }


        // -------------------------------------------------
        // COM
        // -------------------------------------------------

        if (
            !Number.isFinite(
                this.com.x
            ) ||
            !Number.isFinite(
                this.com.y
            )
        ) {

            return {
                valid: false,
                error:
                    "COM is not finite"
            };
        }


        // -------------------------------------------------
        // FEET
        // -------------------------------------------------

        for (
            const side
            of ["left", "right"]
        ) {

            const foot =
                this.feet[side];


            if (!foot) {

                return {
                    valid: false,
                    error:
                        `Missing foot state: ${side}`
                };
            }


            if (
                typeof foot.contact !== "boolean" ||
                typeof foot.planted !== "boolean"
            ) {

                return {
                    valid: false,
                    error:
                        `Invalid contact flags on ${side}`
                };
            }


            if (
                !Number.isFinite(
                    foot.weight
                ) ||
                foot.weight < 0 ||
                foot.weight > 1
            ) {

                return {
                    valid: false,
                    error:
                        `Invalid weight on ${side}: ${foot.weight}`
                };
            }


            if (
                !Number.isFinite(
                    foot.point.x
                ) ||
                !Number.isFinite(
                    foot.point.y
                )
            ) {

                return {
                    valid: false,
                    error:
                        `Non-finite point on ${side}`
                };
            }


            if (
                !Number.isFinite(
                    foot.normal.x
                ) ||
                !Number.isFinite(
                    foot.normal.y
                )
            ) {

                return {
                    valid: false,
                    error:
                        `Non-finite normal on ${side}`
                };
            }
        }


        // -------------------------------------------------
        // WEIGHT DISTRIBUTION
        // -------------------------------------------------

        const wd =
            this.weightDistribution;


        if (
            !Number.isFinite(wd.left) ||
            !Number.isFinite(wd.right) ||
            wd.left < 0 ||
            wd.right < 0 ||
            wd.left > 1 ||
            wd.right > 1 ||
            wd.left + wd.right > 1 + 1e-8
        ) {

            return {
                valid: false,
                error:
                    "Invalid weightDistribution"
            };
        }


        // -------------------------------------------------
        // BALANCE
        // -------------------------------------------------

        const balance =
            this.balance;


        if (
            typeof balance.supported !== "boolean" ||
            typeof balance.stable !== "boolean" ||

            !Number.isFinite(
                balance.supportPoint.x
            ) ||

            !Number.isFinite(
                balance.supportPoint.y
            ) ||

            !Number.isFinite(
                balance.comOffset.x
            ) ||

            !Number.isFinite(
                balance.comOffset.y
            )
        ) {

            return {
                valid: false,
                error:
                    "Invalid balance state"
            };
        }


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return {
            valid: true,

            totalMass:
                this.totalMass,

            com: {
                x:
                    this.com.x,

                y:
                    this.com.y
            }
        };
    }
}
