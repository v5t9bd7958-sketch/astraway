// ASTRAWAY 2.0
// Procedural Character Skeleton
// Local transforms -> World transforms
//
// Skeleton contains only character geometry.
// Animation and IK modify transforms.
// Rendering is handled elsewhere.

import {
    clamp,
    dampAngle,
    finite,
    normalizeAngle
} from "./MathUtils.js";


class Bone {

    constructor(name, parent = null, length = 0) {

        this.name = name;
        this.parent = parent;

        this.length = Math.max(0, finite(length));

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
        length = 0
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
            length
        );

        bone.setLocalPosition(x, y);

        this.bones.set(name, bone);

        if (parent) {
            parent.children.push(bone);
        } else if (!this.root) {
            this.root = bone;
        }

        return bone;
    }


    _build() {

        /*
         *                head
         *                 |
         *                neck
         *                 |
         *               chest
         *             /       \
         *        shoulderL   shoulderR
         *           |             |
         *         elbow         elbow
         *           |             |
         *         wrist         wrist
         *
         *                |
         *              pelvis
         *             /      \
         *          hipL      hipR
         *           |          |
         *         knee       knee
         *           |          |
         *         ankle      ankle
         *           |          |
         *          foot       foot
         *
         * Extra eye bones allow the renderer to aim the eyes
         * independently from the head.
         */


        // ROOT

        this._addBone(
            "pelvis",
            null,
            0,
            0,
            0
        );


        // SPINE

        this._addBone(
            "spine",
            "pelvis",
            0,
            -24,
            24
        );

        this._addBone(
            "chest",
            "spine",
            0,
            -24,
            24
        );

        this._addBone(
            "neck",
            "chest",
            0,
            -16,
            16
        );

        this._addBone(
            "head",
            "neck",
            0,
            -14,
            28
        );


        // EYES

        this._addBone(
            "eyeL",
            "head",
            -8,
            -4,
            0
        );

        this._addBone(
            "eyeR",
            "head",
            8,
            -4,
            0
        );


        // LEFT ARM

        this._addBone(
            "shoulderL",
            "chest",
            -14,
            -8,
            14
        );

        this._addBone(
            "elbowL",
            "shoulderL",
            -14,
            0,
            22
        );

        this._addBone(
            "wristL",
            "elbowL",
            -22,
            0,
            18
        );

        this._addBone(
            "handL",
            "wristL",
            -18,
            0,
            10
        );


        // RIGHT ARM

        this._addBone(
            "shoulderR",
            "chest",
            14,
            -8,
            14
        );

        this._addBone(
            "elbowR",
            "shoulderR",
            14,
            0,
            22
        );

        this._addBone(
            "wristR",
            "elbowR",
            22,
            0,
            18
        );

        this._addBone(
            "handR",
            "wristR",
            18,
            0,
            10
        );


        // LEFT LEG

        this._addBone(
            "hipL",
            "pelvis",
            -10,
            4,
            16
        );

        this._addBone(
            "kneeL",
            "hipL",
            0,
            27,
            27
        );

        this._addBone(
            "ankleL",
            "kneeL",
            0,
            27,
            10
        );

        this._addBone(
            "footL",
            "ankleL",
            7,
            0,
            12
        );


        // RIGHT LEG

        this._addBone(
            "hipR",
            "pelvis",
            10,
            4,
            16
        );

        this._addBone(
            "kneeR",
            "hipR",
            0,
            27,
            27
        );

        this._addBone(
            "ankleR",
            "kneeR",
            0,
            27,
            10
        );

        this._addBone(
            "footR",
            "ankleR",
            7,
            0,
            12
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


    _updateBoneWorld(bone, parent) {

        if (!parent) {

            bone.worldX = bone.localX;
            bone.worldY = bone.localY;

            bone.worldAngle = normalizeAngle(
                bone.localAngle
            );

            bone.worldScale = bone.localScale;

        } else {

            const cos = Math.cos(
                parent.worldAngle
            );

            const sin = Math.sin(
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

        const bone = this.requireBone(name);

        const parent = bone.parent;

        const target = normalizeAngle(
            worldAngle
        );

        let finalAngle = target;

        if (smoothing > 0 && dt > 0) {

            finalAngle = dampAngle(
                bone.worldAngle,
                target,
                smoothing,
                dt
            );
        }

        if (!parent) {

            bone.localAngle = finalAngle;

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

        const bone = this.requireBone(name);

        const targetX = finite(x);
        const targetY = finite(y);

        if (!bone.parent) {

            bone.localX = targetX;
            bone.localY = targetY;

            this.updateWorldTransforms();

            return;
        }


        const parent = bone.parent;

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

        bone.localX =
            (dx * cos - dy * sin) /
            Math.max(
                parent.worldScale,
                0.000001
            );

        bone.localY =
            (dx * sin + dy * cos) /
            Math.max(
                parent.worldScale,
                0.000001
            );

        this.updateWorldTransforms();
    }


    getWorldPoint(
        boneName,
        localX = 0,
        localY = 0
    ) {

        const bone = this.requireBone(
            boneName
        );

        const cos = Math.cos(
            bone.worldAngle
        );

        const sin = Math.sin(
            bone.worldAngle
        );

        const scaledX =
            localX * bone.worldScale;

        const scaledY =
            localY * bone.worldScale;

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
            this.getBone(startName);

        const end =
            this.getBone(endName);

        if (!start || !end) {
            return [];
        }


        const chain = [];

        let current = end;

        while (current) {

            chain.unshift(current);

            if (current === start) {
                return chain;
            }

            current = current.parent;
        }

        return [];
    }


    resetPose() {

        for (const bone of this.bones.values()) {

            bone.localAngle = 0;
            bone.localScale = 1;
        }

        this.updateWorldTransforms();
    }


    dampPose(
        targetAngles,
        smoothing,
        dt
    ) {

        for (const [
            name,
            targetAngle
        ] of Object.entries(targetAngles)) {

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
                error: "Skeleton has no root"
            };
        }


        for (const bone of this.bones.values()) {

            const values = [
                bone.localX,
                bone.localY,
                bone.localAngle,
                bone.worldX,
                bone.worldY,
                bone.worldAngle,
                bone.worldScale
            ];

            if (
                values.some(
                    value =>
                        !Number.isFinite(value)
                )
            ) {

                return {
                    valid: false,
                    error:
                        `Invalid transform in bone "${bone.name}"`
                };
            }
        }


        return {
            valid: true,
            boneCount: this.bones.size
        };
    }


    snapshot() {

        const result = {};

        for (const bone of this.bones.values()) {

            result[bone.name] = {
                x: bone.worldX,
                y: bone.worldY,
                angle: bone.worldAngle,
                scale: bone.worldScale
            };
        }

        return result;
    }
}


export { Bone };
