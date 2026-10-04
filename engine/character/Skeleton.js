// ASTRAWAY 2.0
// Procedural 29-bone character skeleton
//
// Canonical anatomy:
//
// pelvis
// ├─ spineLower → spineMid → spineUpper → chest → neck → head
// │                                            ├─ eyeL
// │                                            └─ eyeR
// │
// │                                            ├─ clavicleL
// │                                            │    └─ upperArmL
// │                                            │         └─ forearmL
// │                                            │              └─ wristL
// │                                            │                   └─ handL
// │                                            │
// │                                            └─ clavicleR
// │                                                 └─ upperArmR
// │                                                      └─ forearmR
// │                                                           └─ wristR
// │                                                                └─ handR
// │
// ├─ thighL → shinL → ankleL → footL → toeL
// └─ thighR → shinR → ankleR → footR → toeR
//
// 29 bones total.
//
// This class owns only:
// - anatomical hierarchy
// - local transforms
// - world transforms
// - bone metadata
// - skeleton validation
//
// Animation, gait, IK, gravity and rendering stay outside.

import {
    dampAngle,
    finite,
    normalizeAngle
} from "./MathUtils.js";


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

        // Authoritative anatomical segment length.
        this.length = Math.max(0, finite(length));

        // Metadata for future IK / animation / rendering systems.
        this.role = role;
        this.side = side;

        // Local transform.
        this.localX = 0;
        this.localY = 0;
        this.localAngle = 0;
        this.localScale = 1;

        // World transform.
        this.worldX = 0;
        this.worldY = 0;
        this.worldAngle = 0;
        this.worldScale = 1;

        this.children = [];
    }


    setLocalPosition(x, y) {
        this.localX = finite(x);
        this.localY = finite(y);

        return this;
    }


    setLocalAngle(angle) {
        this.localAngle = normalizeAngle(
            finite(angle)
        );

        return this;
    }


    setWorldPosition(x, y) {
        this.worldX = finite(x);
        this.worldY = finite(y);

        return this;
    }


    setWorldAngle(angle) {
        this.worldAngle = normalizeAngle(
            finite(angle)
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
            x: Math.cos(this.worldAngle),
            y: Math.sin(this.worldAngle)
        };
    }
}


export default class Skeleton {

    constructor() {

        this.bones = new Map();

        this.root = null;

        this._build();

        this.updateWorldTransforms();
    }


    _addBone(
        name,
        parentName = null,
        x = 0,
        y = 0,
        length = 0,
        role = "joint",
        side = "center"
    ) {

        const parent = parentName
            ? this.bones.get(parentName)
            : null;

        if (parentName && !parent) {
            throw new Error(
                `Skeleton parent "${parentName}" not found`
            );
        }

        const bone = new Bone(
            name,
            parent,
            length,
            role,
            side
        );

        bone.setLocalPosition(
            x,
            y
        );

        this.bones.set(
            name,
            bone
        );

        if (parent) {

            parent.children.push(
                bone
            );

        } else if (!this.root) {

            this.root = bone;
        }

        return bone;
    }


    _build() {

        /*
         * =========================================================
         * ROOT
         * =========================================================
         *
         * pelvis is the single anatomical root.
         *
         * The pelvis is the anchor for:
         * - body orientation
         * - gravity frame
         * - balance
         * - leg IK
         * - center of mass
         */


        this._addBone(
            "pelvis",
            null,
            0,
            0,
            0,
            "pelvis",
            "center"
        );


        /*
         * =========================================================
         * SPINE
         * =========================================================
         *
         * Four torso segments before neck:
         *
         * pelvis
         *   ↓
         * spineLower
         *   ↓
         * spineMid
         *   ↓
         * spineUpper
         *   ↓
         * chest
         *   ↓
         * neck
         *   ↓
         * head
         *
         * This gives future procedural motion enough degrees
         * of freedom for bending, balance and secondary motion.
         */


        this._addBone(
            "spineLower",
            "pelvis",
            0,
            -12,
            12,
            "spine",
            "center"
        );

        this._addBone(
            "spineMid",
            "spineLower",
            0,
            -12,
            12,
            "spine",
            "center"
        );

        this._addBone(
            "spineUpper",
            "spineMid",
            0,
            -11,
            11,
            "spine",
            "center"
        );

        this._addBone(
            "chest",
            "spineUpper",
            0,
            -12,
            12,
            "chest",
            "center"
        );

        this._addBone(
            "neck",
            "chest",
            0,
            -10,
            10,
            "neck",
            "center"
        );

        this._addBone(
            "head",
            "neck",
            0,
            -12,
            18,
            "head",
            "center"
        );


        /*
         * =========================================================
         * EYES
         * =========================================================
         *
         * These are marker bones.
         * They are intentionally zero-length.
         *
         * They branch from the head rather than continuing the
         * head segment.
         */


        this._addBone(
            "eyeL",
            "head",
            -7,
            -4,
            0,
            "eye",
            "left"
        );

        this._addBone(
            "eyeR",
            "head",
            7,
            -4,
            0,
            "eye",
            "right"
        );


        /*
         * =========================================================
         * LEFT ARM
         * =========================================================
         *
         * chest
         *   ↓
         * clavicle
         *   ↓
         * upperArm
         *   ↓
         * forearm
         *   ↓
         * wrist
         *   ↓
         * hand
         *
         * The clavicle creates the missing shoulder structure
         * from the old skeleton.
         */


        this._addBone(
            "clavicleL",
            "chest",
            -5,
            -3,
            9,
            "clavicle",
            "left"
        );

        this._addBone(
            "upperArmL",
            "clavicleL",
            -9,
            0,
            24,
            "upperArm",
            "left"
        );

        this._addBone(
            "forearmL",
            "upperArmL",
            -24,
            0,
            22,
            "forearm",
            "left"
        );

        this._addBone(
            "wristL",
            "forearmL",
            -22,
            0,
            0,
            "wrist",
            "left"
        );

        this._addBone(
            "handL",
            "wristL",
            0,
            0,
            9,
            "hand",
            "left"
        );


        /*
         * =========================================================
         * RIGHT ARM
         * =========================================================
         */


        this._addBone(
            "clavicleR",
            "chest",
            5,
            -3,
            9,
            "clavicle",
            "right"
        );

        this._addBone(
            "upperArmR",
            "clavicleR",
            9,
            0,
            24,
            "upperArm",
            "right"
        );

        this._addBone(
            "forearmR",
            "upperArmR",
            24,
            0,
            22,
            "forearm",
            "right"
        );

        this._addBone(
            "wristR",
            "forearmR",
            22,
            0,
            0,
            "wrist",
            "right"
        );

        this._addBone(
            "handR",
            "wristR",
            0,
            0,
            9,
            "hand",
            "right"
        );


        /*
         * =========================================================
         * LEFT LEG
         * =========================================================
         *
         * pelvis
         *   ↓
         * thigh  = hip → knee
         *   ↓
         * shin   = knee → ankle
         *   ↓
         * ankle
         *   ↓
         * foot
         *   ↓
         * toe
         *
         * The thigh origin is the actual hip joint.
         */


        this._addBone(
            "thighL",
            "pelvis",
            -9,
            3,
            34,
            "thigh",
            "left"
        );

        this._addBone(
            "shinL",
            "thighL",
            0,
            34,
            32,
            "shin",
            "left"
        );

        this._addBone(
            "ankleL",
            "shinL",
            0,
            32,
            5,
            "ankle",
            "left"
        );

        this._addBone(
            "footL",
            "ankleL",
            5,
            0,
            13,
            "foot",
            "left"
        );

        this._addBone(
            "toeL",
            "footL",
            13,
            0,
            5,
            "toe",
            "left"
        );


        /*
         * =========================================================
         * RIGHT LEG
         * =========================================================
         */


        this._addBone(
            "thighR",
            "pelvis",
            9,
            3,
            34,
            "thigh",
            "right"
        );

        this._addBone(
            "shinR",
            "thighR",
            0,
            34,
            32,
            "shin",
            "right"
        );

        this._addBone(
            "ankleR",
            "shinR",
            0,
            32,
            5,
            "ankle",
            "right"
        );

        this._addBone(
            "footR",
            "ankleR",
            5,
            0,
            13,
            "foot",
            "right"
        );

        this._addBone(
            "toeR",
            "footR",
            13,
            0,
            5,
            "toe",
            "right"
        );
    }


    getBone(name) {

        return this.bones.get(name) || null;
    }


    requireBone(name) {

        const bone = this.getBone(name);

        if (!bone) {
            throw new Error(
                `Skeleton bone "${name}" not found`
            );
        }

        return bone;
    }


    setRootPosition(x, y) {

        if (!this.root) {
            return;
        }

        this.root.localX = finite(x);
        this.root.localY = finite(y);

        this.updateWorldTransforms();
    }


    setRootAngle(angle) {

        if (!this.root) {
            return;
        }

        this.root.localAngle = normalizeAngle(
            finite(angle)
        );

        this.updateWorldTransforms();
    }


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

            const cos =
                Math.cos(
                    parent.worldAngle
                );

            const sin =
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
                scaledX * cos -
                scaledY * sin;

            bone.worldY =
                parent.worldY +
                scaledX * sin +
                scaledY * cos;

            bone.worldAngle =
                normalizeAngle(
                    parent.worldAngle +
                    bone.localAngle
                );

            bone.worldScale =
                parent.worldScale *
                bone.localScale;
        }


        for (const child of bone.children) {

            this._updateBoneWorld(
                child,
                bone
            );
        }
    }


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
                worldAngle
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


    setWorldBonePosition(
        name,
        x,
        y
    ) {

        const bone =
            this.requireBone(name);

        const targetX =
            finite(x);

        const targetY =
            finite(y);


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
            ) / scale;

        bone.localY =
            (
                dx * sin +
                dy * cos
            ) / scale;

        this.updateWorldTransforms();
    }


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

        if (!start || !end) {
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


    getAnatomicalLength(name) {

        return this.requireBone(
            name
        ).length;
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


    resetPose() {

        for (
            const bone
            of this.bones.values()
        ) {

            bone.localAngle =
                0;

            bone.localScale =
                1;
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
                targetAngles
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


    validate() {

        if (!this.root) {

            return {
                valid: false,
                error:
                    "Skeleton has no root"
            };
        }


        if (this.bones.size !== 29) {

            return {
                valid: false,

                error:
                    `Expected 29 bones, got ${this.bones.size}`,

                boneCount:
                    this.bones.size
            };
        }


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
                        `Invalid transform in bone "${bone.name}"`
                };
            }


            if (
                bone.length < 0
            ) {

                return {
                    valid: false,

                    error:
                        `Negative length in bone "${bone.name}"`
                };
            }


            /*
             * Only continuous anatomical chains are checked here.
             *
             * Branches such as:
             * - clavicles
             * - eyes
             *
             * are allowed to originate from anatomical regions
             * without being forced to equal the parent's segment
             * length.
             *
             * This keeps validation anatomical rather than purely
             * geometric.
             */

            if (
                bone.role === "eye"
            ) {
                continue;
            }


            if (
                bone.parent &&
                bone.role !== "clavicle" &&
                bone.parent.role !== "clavicle" &&
                bone.parent.role !== "chest"
            ) {

                const distance =
                    Math.hypot(
                        bone.localX,
                        bone.localY
                    );

                const expected =
                    bone.parent.length;


                /*
                 * Zero-length parent joints such as wrists are
                 * deliberate anatomical markers.
                 */

                if (
                    expected > 0 &&
                    Math.abs(
                        distance -
                        expected
                    ) > 0.001
                ) {

                    return {
                        valid: false,

                        error:
                            `Joint distance mismatch at "${bone.name}"`,

                        expected,

                        actual:
                            distance
                    };
                }
            }
        }


        return {
            valid: true,
            boneCount:
                this.bones.size
        };
    }


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


export {
    Bone
};
