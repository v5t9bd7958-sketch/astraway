// ============================================================
// engine/world/RouteNetwork.js
// ASTRAWAY — 18 surfaces / vertical navigation network
// ============================================================

import { Surface } from './Surface.js';

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 5190;

const SOURCE_WIDTH = 720;
const SOURCE_HEIGHT = 1456;

const SCALE_X =
    WORLD_WIDTH /
    SOURCE_WIDTH;

const SCALE_Y =
    WORLD_HEIGHT /
    SOURCE_HEIGHT;


function point(x, y) {

    return {
        x: x * SCALE_X,
        y: y * SCALE_Y
    };
}


const ROUTES = [

    {
        id: 's01_upper_left_spine',
        name: 'Верхний левый ствол',
        width: 72,
        normalSide: 'left',
        points: [
            [258, 28],
            [245, 80],
            [250, 130],
            [280, 170],
            [305, 210],
            [320, 260],
            [330, 310]
        ]
    },

    {
        id: 's02_left_crown',
        name: 'Левая крона',
        width: 78,
        normalSide: 'left',
        points: [
            [145, 160],
            [145, 230],
            [150, 280],
            [185, 315],
            [225, 320],
            [275, 330],
            [315, 360]
        ]
    },

    {
        id: 's03_left_outer',
        name: 'Левая внешняя ветвь',
        width: 82,
        normalSide: 'left',
        points: [
            [18, 190],
            [18, 270],
            [35, 340],
            [70, 395],
            [145, 415],
            [220, 420],
            [280, 435],
            [330, 455]
        ]
    },

    {
        id: 's04_upper_right_spine',
        name: 'Верхний правый ствол',
        width: 74,
        normalSide: 'right',
        points: [
            [520, 40],
            [520, 90],
            [505, 140],
            [495, 190],
            [460, 230],
            [420, 260],
            [380, 290],
            [360, 320]
        ]
    },

    {
        id: 's05_right_crown',
        name: 'Правая верхняя ветвь',
        width: 76,
        normalSide: 'right',
        points: [
            [360, 300],
            [410, 315],
            [470, 315],
            [520, 320],
            [550, 300],
            [570, 270]
        ]
    },

    {
        id: 's06_right_outer',
        name: 'Правая внешняя ветвь',
        width: 80,
        normalSide: 'right',
        points: [
            [570, 270],
            [585, 300],
            [600, 320],
            [635, 320],
            [700, 325]
        ]
    },

    {
        id: 's07_right_middle',
        name: 'Правая средняя ветвь',
        width: 82,
        normalSide: 'right',
        points: [
            [365, 410],
            [420, 410],
            [470, 390],
            [520, 370],
            [565, 345],
            [610, 330]
        ]
    },

    {
        id: 's08_central_trunk',
        name: 'Центральный ствол',
        width: 88,
        normalSide: 'right',
        points: [
            [350, 320],
            [345, 380],
            [350, 440],
            [345, 500],
            [335, 560],
            [320, 620],
            [305, 680]
        ]
    },

    {
        id: 's09_left_middle',
        name: 'Левая средняя дорожка',
        width: 76,
        normalSide: 'left',
        points: [
            [325, 450],
            [300, 500],
            [275, 560],
            [240, 630],
            [200, 690],
            [150, 730],
            [125, 780]
        ]
    },

    {
        id: 's10_left_platform',
        name: 'Левая площадка',
        width: 88,
        normalSide: 'left',
        points: [
            [125, 780],
            [125, 820],
            [155, 850],
            [215, 855],
            [275, 875],
            [330, 900]
        ]
    },

    {
        id: 's11_main_down',
        name: 'Главная нисходящая ветвь',
        width: 94,
        normalSide: 'right',
        points: [
            [305, 660],
            [335, 700],
            [370, 750],
            [410, 800],
            [455, 850],
            [500, 900],
            [550, 950],
            [610, 980]
        ]
    },

    {
        id: 's12_right_upper_loop',
        name: 'Правая верхняя дуга',
        width: 84,
        normalSide: 'right',
        points: [
            [550, 950],
            [575, 1000],
            [580, 1050],
            [575, 1100],
            [540, 1120],
            [490, 1110],
            [450, 1090],
            [430, 1070]
        ]
    },

    {
        id: 's13_inner_return',
        name: 'Внутренний возврат',
        width: 82,
        normalSide: 'left',
        points: [
            [430, 1070],
            [390, 1040],
            [350, 1000],
            [330, 950],
            [330, 900]
        ]
    },

    {
        id: 's14_left_root_loop',
        name: 'Левый корневой маршрут',
        width: 92,
        normalSide: 'left',
        points: [
            [70, 1050],
            [30, 1090],
            [30, 1160],
            [40, 1210],
            [80, 1250],
            [150, 1270],
            [210, 1260],
            [260, 1210],
            [310, 1170],
            [360, 1130]
        ]
    },

    {
        id: 's15_lower_center',
        name: 'Нижний центральный узел',
        width: 86,
        normalSide: 'right',
        points: [
            [360, 1130],
            [390, 1110],
            [430, 1080]
        ]
    },

    {
        id: 's16_right_root_loop',
        name: 'Правый корневой маршрут',
        width: 94,
        normalSide: 'right',
        points: [
            [365, 1130],
            [365, 1180],
            [400, 1220],
            [470, 1240],
            [540, 1240],
            [590, 1210],
            [610, 1170],
            [680, 1160]
        ]
    },

    {
        id: 's17_right_root_tip',
        name: 'Правый концевой корень',
        width: 82,
        normalSide: 'right',
        points: [
            [610, 1170],
            [620, 1140],
            [680, 1140],
            [700, 1150]
        ]
    },

    {
        id: 's18_lower_cross',
        name: 'Нижняя поперечная ветвь',
        width: 86,
        normalSide: 'left',
        points: [
            [430, 1080],
            [450, 1100],
            [480, 1120],
            [520, 1140],
            [560, 1145]
        ]
    }

];


const JUNCTIONS = [

    {
        from: 's01_upper_left_spine',
        fromT: 1,
        to: 's08_central_trunk',
        toT: 0,
        type: 'JUMP'
    },

    {
        from: 's02_left_crown',
        fromT: 1,
        to: 's03_left_outer',
        toT: 1,
        type: 'HANG'
    },

    {
        from: 's03_left_outer',
        fromT: 1,
        to: 's08_central_trunk',
        toT: 0.34,
        type: 'JUMP'
    },

    {
        from: 's04_upper_right_spine',
        fromT: 1,
        to: 's05_right_crown',
        toT: 0,
        type: 'JUMP'
    },

    {
        from: 's05_right_crown',
        fromT: 1,
        to: 's06_right_outer',
        toT: 0,
        type: 'HANG'
    },

    {
        from: 's06_right_outer',
        fromT: 0.45,
        to: 's07_right_middle',
        toT: 1,
        type: 'SWING'
    },

    {
        from: 's07_right_middle',
        fromT: 0,
        to: 's08_central_trunk',
        toT: 0.17,
        type: 'JUMP'
    },

    {
        from: 's08_central_trunk',
        fromT: 0.50,
        to: 's09_left_middle',
        toT: 0,
        type: 'JUMP'
    },

    {
        from: 's09_left_middle',
        fromT: 1,
        to: 's10_left_platform',
        toT: 0,
        type: 'WALK'
    },

    {
        from: 's08_central_trunk',
        fromT: 0.76,
        to: 's11_main_down',
        toT: 0,
        type: 'WALK'
    },

    {
        from: 's10_left_platform',
        fromT: 1,
        to: 's13_inner_return',
        toT: 1,
        type: 'JUMP'
    },

    {
        from: 's11_main_down',
        fromT: 1,
        to: 's12_right_upper_loop',
        toT: 0,
        type: 'HANG'
    },

    {
        from: 's12_right_upper_loop',
        fromT: 1,
        to: 's13_inner_return',
        toT: 0,
        type: 'JUMP'
    },

    {
        from: 's11_main_down',
        fromT: 0.25,
        to: 's14_left_root_loop',
        toT: 0,
        type: 'SWING'
    },

    {
        from: 's14_left_root_loop',
        fromT: 1,
        to: 's15_lower_center',
        toT: 0,
        type: 'JUMP'
    },

    {
        from: 's15_lower_center',
        fromT: 1,
        to: 's16_right_root_loop',
        toT: 0,
        type: 'SWING'
    },

    {
        from: 's16_right_root_loop',
        fromT: 0.82,
        to: 's17_right_root_tip',
        toT: 0,
        type: 'HANG'
    },

    {
        from: 's15_lower_center',
        fromT: 1,
        to: 's18_lower_cross',
        toT: 0,
        type: 'JUMP'
    },

    {
        from: 's18_lower_cross',
        fromT: 1,
        to: 's17_right_root_tip',
        toT: 0.35,
        type: 'SWING'
    },

    {
        from: 's02_left_crown',
        fromT: 0,
        to: 's04_upper_right_spine',
        toT: 0,
        type: 'SWING'
    }

];


function createSurface(definition) {

    return new Surface({
        id: definition.id,
        name: definition.name,
        width: definition.width,
        normalSide: definition.normalSide,

        points:
            definition.points.map(
                ([x, y]) =>
                    point(x, y)
            )
    });
}


function nearestNodeOnSurface(
    nodes,
    surface,
    t
) {

    let best = null;
    let bestDelta = Infinity;

    for (
        const node
        of nodes
    ) {

        if (
            node.surface !== surface
        ) {
            continue;
        }

        const delta =
            Math.abs(
                node.t - t
            );

        if (delta < bestDelta) {
            bestDelta = delta;
            best = node;
        }
    }

    return best;
}


function buildDenseNodes(
    world,
    surface,
    step = 70
) {

    const graph =
        world.navigation;

    const length =
        surface.getLength();

    const count =
        Math.max(
            2,
            Math.ceil(
                length / step
            ) + 1
        );

    const nodes = [];

    for (
        let i = 0;
        i < count;
        i++
    ) {

        const t =
            i /
            (count - 1);

        const position =
            surface.getPoint(t);

        const node =
            graph.addNode(
                `${surface.id}:n${i}`,
                {
                    x: position.x,
                    y: position.y,

                    surface,

                    t,

                    radius:
                        i === 0 ||
                        i === count - 1
                            ? 44
                            : 30,

                    tags:
                        i === 0 ||
                        i === count - 1
                            ? [
                                'surface-end',
                                'dead-end'
                            ]
                            : [
                                'surface'
                            ]
                }
            );

        node.isEndNode =
            i === 0 ||
            i === count - 1;

        node.surfaceIndex =
            i;

        node.surfaceNodeCount =
            count;

        node.movementType =
            surface.getMovementType(t);

        nodes.push(node);
    }

    for (
        let i = 0;
        i < nodes.length - 1;
        i++
    ) {

        const from =
            nodes[i];

        const to =
            nodes[i + 1];

        const midT =
            (
                from.t +
                to.t
            ) *
            0.5;

        const movementType =
            surface.getMovementType(
                midT
            );

        world.navigation.connect(
            from.id,
            to.id,
            {
                type:
                    movementType,

                bidirectional:
                    true,

                tags: [
                    'surface-edge',
                    movementType
                ]
            }
        );
    }

    return nodes;
}


export function createASTRAWAYSurfaces(
    world
) {

    world.width =
        WORLD_WIDTH;

    world.height =
        WORLD_HEIGHT;

    world.surfaces.clear();

    for (
        const definition
        of ROUTES
    ) {

        world.addSurface(
            createSurface(
                definition
            )
        );
    }

    return world.getSurfaces();
}


export function createASTRAWAYNavigation(
    world
) {

    world.navigation.clear();

    const surfaceNodes =
        new Map();

    for (
        const surface
        of world.getSurfaces()
    ) {

        surfaceNodes.set(
            surface.id,
            buildDenseNodes(
                world,
                surface,
                70
            )
        );
    }


    for (
        const junction
        of JUNCTIONS
    ) {

        const fromSurface =
            world.getSurface(
                junction.from
            );

        const toSurface =
            world.getSurface(
                junction.to
            );

        if (
            !fromSurface ||
            !toSurface
        ) {
            continue;
        }

        const fromNodes =
            surfaceNodes.get(
                fromSurface.id
            ) || [];

        const toNodes =
            surfaceNodes.get(
                toSurface.id
            ) || [];

        const fromNode =
            nearestNodeOnSurface(
                fromNodes,
                fromSurface,
                junction.fromT
            );

        const toNode =
            nearestNodeOnSurface(
                toNodes,
                toSurface,
                junction.toT
            );

        if (
            !fromNode ||
            !toNode
        ) {
            continue;
        }

        const edge =
            world.navigation.connect(
                fromNode.id,
                toNode.id,
                {
                    type:
                        junction.type,

                    bidirectional:
                        true,

                    tags: [
                        'junction',
                        junction.type,
                        'acrobatic'
                    ]
                }
            );

        edge.isJunction = true;
        edge.transitionType =
            junction.type;

        if (
            edge.reverseOf
        ) {
            edge.reverseOf.isJunction =
                true;

            edge.reverseOf.transitionType =
                junction.type;
        }
    }


    for (
        const node
        of world.navigation.getAllNodes()
    ) {

        node.routeRole =
            node.isEndNode
                ? 'DEAD_END'
                : 'ROUTE';

        if (
            node.isEndNode
        ) {

            node.tags = [
                ...new Set([
                    ...node.tags,
                    'hang-capable',
                    'swing-capable'
                ])
            ];
        }
    }

    return {
        surfaces:
            world.getSurfaces(),

        nodes:
            world.navigation.getAllNodes(),

        edges:
            world.navigation.getAllEdges()
    };
}


export function installASTRAWAYRouteNetwork(
    world
) {

    createASTRAWAYSurfaces(
        world
    );

    createASTRAWAYNavigation(
        world
    );

    return {
        width: world.width,
        height: world.height,

        surfaces:
            world.getSurfaces(),

        navigation:
            world.navigation
    };
}


export {
    WORLD_WIDTH,
    WORLD_HEIGHT,
    ROUTES,
    JUNCTIONS
};


export default installASTRAWAYRouteNetwork;


// ============================================================
// NEXT TASK:
// Подключить createASTRAWAYSurfaces() и
// createASTRAWAYNavigation() к World.js.
// ============================================================
