// ASTRAWAY 2.0
// Gravity Frame
//
// Responsibility:
// - determine the local support frame of the character
// - place pelvis above the supporting surface
// - provide stable left/right foot anchors
// - orient torso and legs against the support normal
//
// GravityFrame does NOT:
// - own Skeleton anatomy
// - perform IK
// - perform gait
// - move the character along the route
// - render anything
//
// Character owns integration.
// Skeleton owns anatomy.
// Surface owns route geometry.
// Gait owns locomotion.
import {
    finite,
    normalize
} from "./MathUtils.js";
export class GravityFrame {
    constructor(options = {}) {
        this.footSeparation =
            Math.max(
                1,
                finite(
                    options.footSeparation,
                    18
                )
            );
        this.pelvisClearance =
            Math.max(
                0,
                finite(
                    options.pelvisClearance,
                    3
                )
            );
        this.worldUp = {
            x: 0,
            y: -1
        };
        this.frame = {
            position: {
                x: 0,
                y: 0
            },
            tangent: {
                x: 1,
                y: 0
            },
            normal: {
                x: 0,
                y: -1
            },
            down: {
                x: 0,
                y: 1
            },
            facingAngle: 0,
            pelvis: {
                x: 0,
                y: 0
            },
            leftFoot: {
                x: -9,
                y: 0
            },
            rightFoot: {
                x: 9,
                y: 0
            },
            standingHeight: 0
        };
    }
    // -----------------------------------------------------
    // BUILD FRAME
    // -----------------------------------------------------
    compute(
        surfaceFrame,
        skeleton
    ) {
        const tangent =
            normalize(
                finite(
                    surfaceFrame?.tangent?.x,
                    1
                ),
                finite(
                    surfaceFrame?.tangent?.y,
                    0
                ),
                1,
                0
            );
        const rawNormal =
            normalize(
                finite(
                    surfaceFrame?.normal?.x,
                    -tangent.y
                ),
                finite(
                    surfaceFrame?.normal?.y,
                    tangent.x
                ),
                -tangent.y,
                tangent.x
            );
        /*
         * Surface normals in AstraWay are route-side normals.
         *
         * For a horizontal surface the route normal can point
         * downward because the world uses +Y as down.
         *
         * Therefore we orient the support normal so that it
         * points toward the physically plausible "up" side
         * whenever the world-up direction gives us a clear answer.
         *
         * On a vertical surface the dot product approaches zero,
         * so the route's declared side remains authoritative.
         */
        const upDot =
            rawNormal.x * this.worldUp.x +
            rawNormal.y * this.worldUp.y;
        let normal = {
            x: rawNormal.x,
            y: rawNormal.y
        };
        if (upDot > 0) {
            normal.x *= -1;
            normal.y *= -1;
        }
        const down = {
            x: -normal.x,
            y: -normal.y
        };
        const position = {
            x:
                finite(
                    surfaceFrame?.position?.x,
                    0
                ),
            y:
                finite(
                    surfaceFrame?.position?.y,
                    0
                )
        };
        /*
         * Anatomical standing height:
         *
         * hip → knee
         * knee → ankle
         * ankle joint
         * plus the small pelvis/hip offset.
         *
         * We deliberately use Skeleton lengths rather than
         * duplicating anatomical constants here.
         */
        let thighLength = 34;
        let shinLength = 32;
        let ankleLength = 5;
        if (skeleton) {
            thighLength =
                this.getLength(
                    skeleton,
                    "thighL",
                    thighLength
                );
            shinLength =
                this.getLength(
                    skeleton,
                    "shinL",
                    shinLength
                );
            ankleLength =
                this.getLength(
                    skeleton,
                    "ankleL",
                    ankleLength
                );
        }
        const standingHeight =
            thighLength +
            shinLength +
            ankleLength +
            this.pelvisClearance;
        /*
         * The pelvis sits above the contact line.
         */
        const pelvis = {
            x:
                position.x +
                normal.x *
                standingHeight,
            y:
                position.y +
                normal.y *
                standingHeight
        };
        /*
         * Feet are separated along the surface tangent.
         *
         * "left" and "right" here mean the anatomical sides
         * of the character, not screen-left/screen-right.
         */
        const halfWidth =
            this.footSeparation * 0.5;
        const leftFoot = {
            x:
                position.x -
                tangent.x *
                halfWidth,
            y:
                position.y -
                tangent.y *
                halfWidth
        };
        const rightFoot = {
            x:
                position.x +
                tangent.x *
                halfWidth,
            y:
                position.y +
                tangent.y *
                halfWidth
        };
        /*
         * Facing follows the route tangent.
         *
         * Character may later override this for looking,
         * climbing, hanging or combat.
         */
        const facingAngle =
            Math.atan2(
                tangent.y,
                tangent.x
            );
        this.frame = {
            position,
            tangent,
            normal,
            down,
            facingAngle,
            pelvis,
            leftFoot,
            rightFoot,
            standingHeight
        };
        return this.frame;
    }
    // -----------------------------------------------------
    // HELPERS
    // -----------------------------------------------------
    getLength(
        skeleton,
        name,
        fallback
    ) {
        if (
            !skeleton ||
            typeof skeleton.getAnatomicalLength !==
                "function"
        ) {
            return fallback;
        }
        const value =
            skeleton.getAnatomicalLength(
                name
            );
        return Math.max(
            0,
            finite(
                value,
                fallback
            )
        );
    }
    getFrame() {
        return this.frame;
    }
    getPelvisPosition() {
        return {
            x:
                this.frame.pelvis.x,
            y:
                this.frame.pelvis.y
        };
    }
    getFootTargets() {
        return {
            left: {
                x:
                    this.frame.leftFoot.x,
                y:
                    this.frame.leftFoot.y
            },
            right: {
                x:
                    this.frame.rightFoot.x,
                y:
                    this.frame.rightFoot.y
            }
        };
    }
    validate() {
        const f =
            this.frame;
        const finitePoint =
            point =>
                Number.isFinite(point.x) &&
                Number.isFinite(point.y);
        return {
            valid:
                finitePoint(f.position) &&
                finitePoint(f.normal) &&
                finitePoint(f.tangent) &&
                finitePoint(f.pelvis) &&
                finitePoint(f.leftFoot) &&
                finitePoint(f.rightFoot),
            frame: f
        };
    }
}
export default GravityFrame;
