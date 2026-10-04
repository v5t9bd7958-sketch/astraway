// ASTRAWAY 2.0
// Anatomical procedural humanoid skeleton.
//
// 29 bones.
//
// Architecture:
//
//                         head
//                          │
//                        neck
//                          │
//                        chest
//                     ┌────┴────┐
//                clavicleL   clavicleR
//                    │           │
//                 upperArm    upperArm
//                    │           │
//                 forearm     forearm
//                    │           │
//                  wrist       wrist
//                    │           │
//                  hand        hand
//
//                         spineUpper
//                            │
//                         spineMid
//                            │
//                        spineLower
//                            │
//                          pelvis
//                       ┌────┴────┐
//                    thighL    thighR
//                       │          │
//                    shinL      shinR
//                       │          │
//                    ankleL    ankleR
//                       │          │
//                    footL      footR
//                       │          │
//                     toeL      toeR
//
// Skeleton owns:
// - hierarchy
// - anatomy
// - local transforms
// - world transforms
// - rest pose
// - structural validation
//
// Skeleton does NOT own:
// - animation
// - gait
// - IK
// - gravity
// - rendering


import {
    dampAngle,
    finite,
    normalizeAngle
} from "./MathUtils.js";


// =========================================================
// BONE
// =========================================================

class Bone {

    constructor(
        name,
        parent = null,
        length = 0,
        role = "joint",
        side = "center"
    ) {

        this.name = name;
        this.parent = parent;

        // -------------------------------------------------
        // ANATOMY
        // -------------------------------------------------

        this.length =
            Math.max(
                0,
                finite(length, 0)
            );

        this.role = role;
        this.side = side;

        // -------------------------------------------------
        // REST POSE
        // -------------------------------------------------
        //
        // The rest pose is the anatomical neutral pose.
        // Animation is an offset from this pose.
        //

        this.restX = 0;
        this.restY = 0;
        this.restAngle = 0;
        this.restScale = 1;

        // -------------------------------------------------
        // LOCAL TRANSFORM
        // -------------------------------------------------

        this.localX = 0;
        this.localY = 0;
        this.localAngle = 0;
        this.localScale = 1;

        // -------------------------------------------------
        // WORLD TRANSFORM
        // -------------------------------------------------

        this.worldX = 0;
        this.worldY = 0;
        this.worldAngle = 0;
        this.worldScale = 1;

        this.children = [];
    }


    setRestTransform(
        x,
        y,
        angle = 0,
        scale = 1
    ) {

        this.restX =
            finite(x, 0);

        this.restY =
            finite(y, 0);

        this.restAngle =
            normalizeAngle(
                finite(angle, 0)
            );

        this.restScale =
            Math.max(
                0.000001,
                finite(scale, 1)
            );

        this.resetToRest();

        return this;
    }


    resetToRest() {

        this.localX =
            this.restX;

        this.localY =
            this.restY;

        this.localAngle =
            this.restAngle;

        this.localScale =
            this.restScale;

        return this;
    }


    setLocalPosition(x, y) {

        this.localX =
            finite(x, 0);

        this.localY =
            finite(y, 0);

        return this;
    }


    setLocalAngle(angle) {

        this.localAngle =
            normalizeAngle(
                finite(angle, 0)
            );

        return this;
    }


    setWorldPosition(x, y) {

        this.worldX =
            finite(x, 0);

        this.worldY =
            finite(y, 0);

        return this;
    }


    setWorldAngle(angle) {

        this.worldAngle =
            normalizeAngle(
                finite(angle, 0)
            );

        return this;
    }


    getWorldPosition() {

        return {
            x: this.worldX,
            y: this.worldY
        };
    }


    getWorldDirection() {

        return {
            x:
                Math.cos(
                    this.worldAngle
                ),

            y:
                Math.sin(
                    this.worldAngle
                )
        };
    }


    getWorldEnd() {

        return {
            x:
                this.worldX +
                Math.cos(
                    this.worldAngle
                ) *
                this.length *
                this.worldScale,

            y:
                this.worldY +
                Math.sin(
                    this.worldAngle
                ) *
                this.length *
                this.worldScale
        };
    }
}


// =========================================================
// SKELETON
// =========================================================

export default class Skeleton {

    constructor() {

        this.bones =
            new Map();

        this.root =
            null;

        this._build();

        this.updateWorldTransforms();
    }


    // =====================================================
    // INTERNAL BONE CREATION
    // =====================================================

    _addBone(
        name,
        parentName = null,
        x = 0,
        y = 0,
        length = 0,
        role = "joint",
        side = "center",
        restAngle = 0
    ) {

        const parent =
            parentName
                ? this.bones.get(parentName)
                : null;

        if (
            parentName &&
            !parent
        ) {

            throw new Error(
                `Skeleton parent "${parentName}" not found`
            );
        }


        const bone =
            new Bone(
                name,
                parent,
                length,
                role,
                side
            );


        bone.setRestTransform(
            x,
            y,
            restAngle,
            1
        );


        this.bones.set(
            name,
            bone
        );


        if (parent) {

            parent.children.push(
                bone
            );

        } else {

            if (this.root) {

                throw new Error(
                    "Skeleton cannot have multiple roots"
                );
            }

            this.root =
                bone;
        }


        return bone;
    }


    // =====================================================
    // ANATOMICAL BUILD
    // =====================================================

    _build() {

        /*
         * Coordinate convention:
         *
         * +X = character forward/right
         * +Y = down
         * -Y = up
         *
         * Therefore:
         *
         * 0            = forward/right
         * -PI / 2      = upward
         * +PI / 2      = downward
         *
         *
         * Critical invariant:
         *
         * For a continuous chain:
         *
         * child origin =
         * parent endpoint
         *
         * Therefore a child of a bone with length L
         * begins at local X = L, local Y = 0.
         */


        // =================================================
        // PELVIS
        // =================================================

        this._addBone(
            "pelvis",
            null,
            0,
            0,
            0,
            "pelvis",
            "center",
            0
        );


        // =================================================
        // SPINE
        // =================================================
        //
        // Every next vertebral segment begins exactly at
        // the endpoint of the previous segment.
        //
        // The local rest angle is -PI/2, so the torso rises.
        //

        this._addBone(
            "spineLower",
            "pelvis",
            0,
            0,
            12,
            "spine",
            "center",
            -Math.PI / 2
        );


        this._addBone(
            "spineMid",
            "spineLower",
            12,
            0,
            12,
            "spine",
            "center",
            0
        );


        this._addBone(
            "spineUpper",
            "spineMid",
            12,
            0,
            11,
            "spine",
            "center",
            0
        );


        this._addBone(
            "chest",
            "spineUpper",
            11,
            0,
            12,
            "chest",
            "center",
            0
        );


        this._addBone(
            "neck",
            "chest",
            12,
            0,
            10,
            "neck",
            "center",
            0
        );


        this._addBone(
            "head",
            "neck",
            10,
            0,
            18,
            "head",
            "center",
            0
        );


        // =================================================
        // EYES
        // =================================================
        //
        // Eyes are markers, not chain bones.
        // They deliberately branch from the head.
        //

        this._addBone(
            "eyeL",
            "head",
            4,
            -7,
            0,
            "eye",
            "left",
            0
        );


        this._addBone(
            "eyeR",
            "head",
            4,
            7,
            0,
            "eye",
            "right",
            0
        );


        // =================================================
        // LEFT ARM
        // =================================================
        //
        // Clavicle is a branch from the upper chest.
        // It is intentionally NOT forced to begin at the
        // chest endpoint because a clavicle is a branch
        // emerging from the upper torso.
        //
        // Once the clavicle begins, the arm chain is strict:
        //
        // clavicle endpoint
        //      ↓
        // upperArm origin
        //      ↓
        // forearm origin
        //      ↓
        // wrist origin
        //      ↓
        // hand origin
        //


        this._addBone(
            "clavicleL",
            "chest",
            0,
            -3,
            9,
            "clavicle",
            "left",
            -Math.PI / 2
        );


        this._addBone(
            "upperArmL",
            "clavicleL",
            9,
            0,
            24,
            "upperArm",
            "left",
            0
        );


        this._addBone(
            "forearmL",
            "upperArmL",
            24,
            0,
            22,
            "forearm",
            "left",
            0
        );


        this._addBone(
            "wristL",
            "forearmL",
            22,
            0,
            0,
            "wrist",
            "left",
            0
        );


        this._addBone(
            "handL",
            "wristL",
            0,
            0,
            9,
            "hand",
            "left",
            0
        );


        // =================================================
        // RIGHT ARM
        // =================================================

        this._addBone(
            "clavicleR",
            "chest",
            0,
            3,
            9,
            "clavicle",
            "right",
            Math.PI / 2
        );


        this._addBone(
            "upperArmR",
            "clavicleR",
            9,
            0,
            24,
            "upperArm",
            "right",
            0
        );


        this._addBone(
            "forearmR",
            "upperArmR",
            24,
            0,
            22,
            "forearm",
            "right",
            0
        );


        this._addBone(
            "wristR",
            "forearmR",
            22,
            0,
            0,
            "wrist",
            "right",
            0
        );


        this._addBone(
            "handR",
            "wristR",
            0,
            0,
            9,
            "hand",
            "right",
            0
        );


        // =================================================
        // LEFT LEG
        // =================================================
        //
        // Hip is a branch from pelvis.
        //
        // The chain itself is strict:
        //
        // hip
        //  ↓
        // knee
        //  ↓
        // ankle
        //  ↓
        // foot
        //  ↓
        // toe
        //


        this._addBone(
            "thighL",
            "pelvis",
            -9,
            3,
            34,
            "thigh",
            "left",
            Math.PI / 2
        );


        this._addBone(
            "shinL",
            "thighL",
            34,
            0,
            32,
            "shin",
            "left",
            0
        );


        this._addBone(
            "ankleL",
            "shinL",
            32,
            0,
            5,
            "ankle",
            "left",
            0
        );


        this._addBone(
            "footL",
            "ankleL",
            5,
            0,
            13,
            "foot",
            "left",
            -Math.PI / 2
        );


        this._addBone(
            "toeL",
            "footL",
            13,
            0,
            5,
            "toe",
            "left",
            0
        );


        // =================================================
        // RIGHT LEG
        // =================================================

        this._addBone(
            "thighR",
            "pelvis",
            9,
            3,
            34,
            "thigh",
            "right",
            Math.PI / 2
        );


        this._addBone(
            "shinR",
            "thighR",
            34,
            0,
            32,
            "shin",
            "right",
            0
        );


        this._addBone(
            "ankleR",
            "shinR",
            32,
            0,
            5,
            "ankle",
            "right",
            0
        );


        this._addBone(
            "footR",
            "ankleR",
            5,
            0,
            13,
            "foot",
            "right",
            -Math.PI / 2
        );


        this._addBone(
            "toeR",
            "footR",
            13,
            0,
            5,
            "toe",
            "right",
            0
        );
    }


    // =====================================================
    // LOOKUP
    // =====================================================

    getBone(name) {

        return (
            this.bones.get(name) ||
            null
        );
    }


    requireBone(name) {

        const bone =
            this.getBone(name);

        if (!bone) {

            throw new Error(
                `Skeleton bone "${name}" not found`
            );
        }

        return bone;
    }


    // =====================================================
    // ROOT
    // =====================================================

    setRootPosition(x, y) {

        if (!this.root) {
            return;
        }

        this.root.localX =
            finite(x, 0);

        this.root.localY =
            finite(y, 0);

        this.updateWorldTransforms();
    }


    setRootAngle(angle) {

        if (!this.root) {
            return;
        }

        this.root.localAngle =
            normalizeAngle(
                finite(angle, 0)
            );

        this.updateWorldTransforms();
    }


    // =====================================================
    // FORWARD KINEMATICS
    // =====================================================

    updateWorldTransforms() {

        if (!this.root) {
            return;
        }

        this._updateBoneWorld(
            this.root,
            null
        );
    }


    _updateBoneWorld(
        bone,
        parent
    ) {

        if (!parent) {

            bone.worldX =
                bone.localX;

            bone.worldY =
                bone.localY;

            bone.worldAngle =
                normalizeAngle(
                    bone.localAngle
                );

            bone.worldScale =
                bone.localScale;

        } else {

            const parentCos =
                Math.cos(
                    parent.worldAngle
                );

            const parentSin =
                Math.sin(
                    parent.worldAngle
                );


            const scaledX =
                bone.localX *
                parent.worldScale;

            const scaledY =
                bone.localY *
                parent.worldScale;


            bone.worldX =
                parent.worldX +
                scaledX * parentCos -
                scaledY * parentSin;


            bone.worldY =
                parent.worldY +
                scaledX * parentSin +
                scaledY * parentCos;


            bone.worldAngle =
                normalizeAngle(
                    parent.worldAngle +
                    bone.localAngle
                );


            bone.worldScale =
                parent.worldScale *
                bone.localScale;
        }


        for (
            const child
            of bone.children
        ) {

            this._updateBoneWorld(
                child,
                bone
            );
        }
    }


    // =====================================================
    // WORLD ANGLE CONTROL
    // =====================================================

    setWorldBoneAngle(
        name,
        worldAngle,
        smoothing = 0,
        dt = 0
    ) {

        const bone =
            this.requireBone(name);

        const parent =
            bone.parent;

        const target =
            normalizeAngle(
                finite(worldAngle, 0)
            );

        let finalAngle =
            target;


        if (
            smoothing > 0 &&
            dt > 0
        ) {

            finalAngle =
                dampAngle(
                    bone.worldAngle,
                    target,
                    smoothing,
                    dt
                );
        }


        if (!parent) {

            bone.localAngle =
                finalAngle;

        } else {

            bone.localAngle =
                normalizeAngle(
                    finalAngle -
                    parent.worldAngle
                );
        }


        this.updateWorldTransforms();
    }


    // =====================================================
    // WORLD POSITION CONTROL
    // =====================================================

    setWorldBonePosition(
        name,
        x,
        y
    ) {

        const bone =
            this.requireBone(name);

        const targetX =
            finite(x, 0);

        const targetY =
            finite(y, 0);


        if (!bone.parent) {

            bone.localX =
                targetX;

            bone.localY =
                targetY;

            this.updateWorldTransforms();

            return;
        }


        const parent =
            bone.parent;

        const dx =
            targetX -
            parent.worldX;

        const dy =
            targetY -
            parent.worldY;


        const cos =
            Math.cos(
                -parent.worldAngle
            );

        const sin =
            Math.sin(
                -parent.worldAngle
            );


        const scale =
            Math.max(
                parent.worldScale,
                0.000001
            );


        bone.localX =
            (
                dx * cos -
                dy * sin
            ) /
            scale;


        bone.localY =
            (
                dx * sin +
                dy * cos
            ) /
            scale;


        this.updateWorldTransforms();
    }


    // =====================================================
    // WORLD POINT
    // =====================================================

    getWorldPoint(
        boneName,
        localX = 0,
        localY = 0
    ) {

        const bone =
            this.requireBone(
                boneName
            );


        const cos =
            Math.cos(
                bone.worldAngle
            );

        const sin =
            Math.sin(
                bone.worldAngle
            );


        const scaledX =
            localX *
            bone.worldScale;

        const scaledY =
            localY *
            bone.worldScale;


        return {

            x:
                bone.worldX +
                scaledX * cos -
                scaledY * sin,

            y:
                bone.worldY +
                scaledX * sin +
                scaledY * cos
        };
    }


    // =====================================================
    // BONE END
    // =====================================================

    getBoneEnd(name) {

        return this.requireBone(
            name
        ).getWorldEnd();
    }


    // =====================================================
    // CHAINS
    // =====================================================

    getBoneChain(
        startName,
        endName
    ) {

        const start =
            this.getBone(
                startName
            );

        const end =
            this.getBone(
                endName
            );


        if (
            !start ||
            !end
        ) {

            return [];
        }


        const chain = [];

        let current =
            end;


        while (current) {

            chain.unshift(
                current
            );


            if (
                current ===
                start
            ) {

                return chain;
            }


            current =
                current.parent;
        }


        return [];
    }


    getAnatomicalChain(
        startName,
        endName
    ) {

        return this
            .getBoneChain(
                startName,
                endName
            )
            .map(
                bone => ({

                    name:
                        bone.name,

                    length:
                        bone.length,

                    role:
                        bone.role,

                    side:
                        bone.side
                })
            );
    }


    getAnatomicalLength(name) {

        return this
            .requireBone(name)
            .length;
    }


    // =====================================================
    // REST POSE
    // =====================================================

    resetPose() {

        for (
            const bone
            of this.bones.values()
        ) {

            bone.resetToRest();
        }


        this.updateWorldTransforms();
    }


    dampPose(
        targetAngles,
        smoothing,
        dt
    ) {

        for (
            const [
                name,
                targetAngle
            ]
            of Object.entries(
                targetAngles || {}
            )
        ) {

            const bone =
                this.getBone(name);

            if (!bone) {
                continue;
            }


            bone.localAngle =
                dampAngle(
                    bone.localAngle,
                    targetAngle,
                    smoothing,
                    dt
                );
        }


        this.updateWorldTransforms();
    }


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        if (!this.root) {

            return {
                valid: false,
                error:
                    "Skeleton has no root"
            };
        }


        if (
            this.bones.size !== 29
        ) {

            return {

                valid: false,

                error:
                    `Expected 29 bones, got ${this.bones.size}`,

                boneCount:
                    this.bones.size
            };
        }


        const continuousRoles =
            new Set([
                "spine",
                "chest",
                "neck",
                "head",
                "upperArm",
                "forearm",
                "wrist",
                "hand",
                "thigh",
                "shin",
                "ankle",
                "foot",
                "toe"
            ]);


        for (
            const bone
            of this.bones.values()
        ) {

            const values = [

                bone.localX,
                bone.localY,
                bone.localAngle,
                bone.localScale,

                bone.worldX,
                bone.worldY,
                bone.worldAngle,
                bone.worldScale,

                bone.restX,
                bone.restY,
                bone.restAngle,
                bone.restScale,

                bone.length
            ];


            if (
                values.some(
                    value =>
                        !Number.isFinite(
                            value
                        )
                )
            ) {

                return {

                    valid: false,

                    error:
                        `Invalid numeric transform in "${bone.name}"`
                };
            }


            if (
                bone.length < 0
            ) {

                return {

                    valid: false,

                    error:
                        `Negative bone length in "${bone.name}"`
                };
            }


            /*
             * Continuous chain invariant:
             *
             * child origin must equal
             * parent endpoint in parent's local frame.
             */

            if (
                bone.parent &&
                continuousRoles.has(
                    bone.role
                ) &&
                bone.parent.length > 0
            ) {

                const dx =
                    bone.localX -
                    bone.parent.length;

                const dy =
                    bone.localY;


                const error =
                    Math.hypot(
                        dx,
                        dy
                    );


                if (
                    error >
                    0.001
                ) {

                    return {

                        valid: false,

                        error:
                            `Broken anatomical connection at "${bone.name}"`,

                        parent:
                            bone.parent.name,

                        expected: {
                            x:
                                bone.parent.length,

                            y: 0
                        },

                        actual: {
                            x:
                                bone.localX,

                            y:
                                bone.localY
                        },

                        errorDistance:
                            error
                    };
                }
            }
        }


        /*
         * Explicit anatomical chains.
         */

        const chains = [

            [
                "pelvis",
                "spineLower",
                "spineMid",
                "spineUpper",
                "chest",
                "neck",
                "head"
            ],

            [
                "clavicleL",
                "upperArmL",
                "forearmL",
                "wristL",
                "handL"
            ],

            [
                "clavicleR",
                "upperArmR",
                "forearmR",
                "wristR",
                "handR"
            ],

            [
                "thighL",
                "shinL",
                "ankleL",
                "footL",
                "toeL"
            ],

            [
                "thighR",
                "shinR",
                "ankleR",
                "footR",
                "toeR"
            ]
        ];


        for (
            const chain
            of chains
        ) {

            for (
                let i = 1;
                i < chain.length;
                i++
            ) {

                const parent =
                    this.requireBone(
                        chain[i - 1]
                    );

                const child =
                    this.requireBone(
                        chain[i]
                    );


                if (
                    child.parent !==
                    parent
                ) {

                    return {

                        valid: false,

                        error:
                            `Invalid hierarchy: ${child.name} is not child of ${parent.name}`
                    };
                }
            }
        }


        return {

            valid: true,

            boneCount:
                this.bones.size,

            root:
                this.root.name
        };
    }


    // =====================================================
    // SNAPSHOT
    // =====================================================

    snapshot() {

        const result = {};


        for (
            const bone
            of this.bones.values()
        ) {

            result[bone.name] = {

                x:
                    bone.worldX,

                y:
                    bone.worldY,

                angle:
                    bone.worldAngle,

                scale:
                    bone.worldScale
            };
        }


        return result;
    }
}


// =========================================================
// EXPORT
// =========================================================

export {
    Bone
};
