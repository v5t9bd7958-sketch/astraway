/**
 * AstraWay — Character Lab
 * SOURCE PIXEL GEOMETRY
 *
 * Reference image: 826 × 1372 px
 * Coordinate origin: top-left
 * Units: pixels
 * Visual tolerance: ±15 px
 *
 * Source data only.
 * No physics.
 * No collision logic.
 * No navigation.
 * No planning.
 */

export const CHARACTER_LAB_IMAGE = {
    width: 826,
    height: 1372
};

export const CHARACTER_LAB_GEOMETRY = {

    ground: {
        id: "ground",
        type: "surface",

        points: [
            { x: 0, y: 1100 },
            { x: 430, y: 1100 }
        ],

        continues: {
            left: true,
            right: false,
            top: false,
            bottom: false
        }
    },

    hill: {
        id: "hill",
        type: "contour",

        points: [
            { x: 0, y: 1100 },
            { x: 25, y: 1080 },
            { x: 55, y: 1050 },
            { x: 85, y: 1010 },
            { x: 110, y: 960 },
            { x: 130, y: 900 },
            { x: 145, y: 830 },
            { x: 155, y: 760 },
            { x: 160, y: 690 },
            { x: 165, y: 620 },
            { x: 170, y: 560 },
            { x: 175, y: 500 },
            { x: 180, y: 440 }
        ],

        continues: {
            left: false,
            right: false,
            top: "unknown",
            bottom: false
        }
    },

    steps: [

        {
            id: "step_1",
            type: "block",

            points: [
                { x: 460, y: 1100 },
                { x: 460, y: 1080 },
                { x: 555, y: 1080 },
                { x: 555, y: 1100 }
            ]
        },

        {
            id: "step_2",
            type: "block",

            points: [
                { x: 555, y: 1060 },
                { x: 555, y: 1040 },
                { x: 640, y: 1040 },
                { x: 640, y: 1060 }
            ]
        },

        {
            id: "step_3",
            type: "block",

            points: [
                { x: 640, y: 1015 },
                { x: 640, y: 995 },
                { x: 700, y: 995 },
                { x: 700, y: 1015 }
            ]
        },

        {
            id: "step_4",
            type: "block",

            points: [
                { x: 700, y: 970 },
                { x: 700, y: 945 },
                { x: 760, y: 945 },
                { x: 760, y: 970 }
            ]
        }
    ],

    ladder: {
        id: "ladder",
        type: "ladder",

        leftRail: [
            { x: 735, y: 945 },
            { x: 735, y: 180 }
        ],

        rightRail: [
            { x: 760, y: 945 },
            { x: 760, y: 180 }
        ],

        continues: {
            top: true,
            bottom: false
        }
    },

    beam: {
        id: "beam",
        type: "beam",

        points: [
            { x: 230, y: 180 },
            { x: 826, y: 180 },
            { x: 826, y: 200 },
            { x: 230, y: 200 }
        ],

        continues: {
            left: false,
            right: true,
            top: false,
            bottom: false
        }
    },

    rope: {
        id: "rope",
        type: "rope",

        points: [
            { x: 285, y: 200 },
            { x: 285, y: 960 }
        ],

        continues: {
            top: false,
            bottom: false
        }
    }
};

export default CHARACTER_LAB_GEOMETRY;
