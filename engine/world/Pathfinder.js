// ============================================================
// engine/world/Pathfinder.js
// ASTRAWAY — A* + movement/transition path metadata
// ============================================================

import {
    distance,
    distanceSq,
    finitePoint
} from '../character/MathUtils.js';


export class Pathfinder {

    constructor(graph) {

        if (!graph) {
            throw new Error(
                'Pathfinder: NavigationGraph is required'
            );
        }

        this.graph = graph;
    }


    findPath(
        startPoint,
        targetPoint,
        options = {}
    ) {

        if (
            !finitePoint(startPoint) ||
            !finitePoint(targetPoint)
        ) {
            return [];
        }

        const state =
            options.state || {};

        const startNode =
            options.startNode ||
            this.graph.findNearestNode(
                startPoint,
                {
                    surface:
                        options.startSurface ||
                        null,

                    maxDistance:
                        Number.isFinite(
                            options.maxStartDistance
                        )
                            ? options.maxStartDistance
                            : Infinity
                }
            );

        const targetNode =
            options.targetNode ||
            this.graph.findNearestNode(
                targetPoint,
                {
                    surface:
                        options.targetSurface ||
                        null,

                    maxDistance:
                        Number.isFinite(
                            options.maxTargetDistance
                        )
                            ? options.maxTargetDistance
                            : Infinity
                }
            );

        if (
            !startNode ||
            !targetNode
        ) {
            return [];
        }

        if (
            startNode === targetNode
        ) {

            return this.buildDirectPath(
                startPoint,
                targetPoint,
                startNode
            );
        }

        const nodePath =
            this.findNodePath(
                startNode,
                targetNode,
                state
            );

        if (
            !nodePath.length
        ) {
            return [];
        }

        return this.buildPath(
            startPoint,
            targetPoint,
            nodePath
        );
    }


    findNodePath(
        startNode,
        targetNode,
        state = {}
    ) {

        if (
            !startNode ||
            !targetNode
        ) {
            return [];
        }

        if (
            startNode === targetNode
        ) {
            return [startNode];
        }

        const openSet =
            new Set([
                startNode
            ]);

        const cameFrom =
            new Map();

        const gScore =
            new Map();

        const fScore =
            new Map();

        for (
            const node
            of this.graph.getAllNodes()
        ) {

            gScore.set(
                node,
                Infinity
            );

            fScore.set(
                node,
                Infinity
            );
        }

        gScore.set(
            startNode,
            0
        );

        fScore.set(
            startNode,
            this.heuristic(
                startNode,
                targetNode
            )
        );

        while (
            openSet.size > 0
        ) {

            const current =
                this.getLowestScoreNode(
                    openSet,
                    fScore
                );

            if (!current) {
                break;
            }

            if (
                current === targetNode
            ) {

                return this.reconstructPath(
                    cameFrom,
                    current
                );
            }

            openSet.delete(
                current
            );

            const neighbors =
                this.graph.getNeighbors(
                    current.id,
                    state
                );

            for (
                const item
                of neighbors
            ) {

                const neighbor =
                    item.node;

                const edge =
                    item.edge;

                if (
                    !neighbor ||
                    !edge
                ) {
                    continue;
                }

                const transitionPenalty =
                    this.getTransitionPenalty(
                        edge
                    );

                const tentativeG =
                    (
                        gScore.get(
                            current
                        ) ??
                        Infinity
                    ) +
                    edge.getCost() +
                    transitionPenalty;

                const knownG =
                    gScore.get(
                        neighbor
                    ) ??
                    Infinity;

                if (
                    tentativeG <
                    knownG
                ) {

                    cameFrom.set(
                        neighbor,
                        {
                            node: current,
                            edge
                        }
                    );

                    gScore.set(
                        neighbor,
                        tentativeG
                    );

                    fScore.set(
                        neighbor,
                        tentativeG +
                        this.heuristic(
                            neighbor,
                            targetNode
                        )
                    );

                    openSet.add(
                        neighbor
                    );
                }
            }
        }

        return [];
    }


    getTransitionPenalty(edge) {

        if (!edge) {
            return 0;
        }

        switch (
            String(
                edge.type ||
                ''
            ).toUpperCase()
        ) {

            case 'HANG':
                return 140;

            case 'SWING':
                return 220;

            case 'JUMP':
                return 110;

            default:
                return 0;
        }
    }


    reconstructPath(
        cameFrom,
        current
    ) {

        const path = [
            current
        ];

        let cursor =
            current;

        while (
            cameFrom.has(
                cursor
            )
        ) {

            const record =
                cameFrom.get(
                    cursor
                );

            cursor =
                record.node;

            path.push({
                ...cursor,

                _edgeFromPrevious:
                    record.edge
            });
        }

        path.reverse();

        return path;
    }


    getLowestScoreNode(
        openSet,
        scores
    ) {

        let best = null;
        let bestScore = Infinity;

        for (
            const node
            of openSet
        ) {

            const score =
                scores.get(
                    node
                ) ??
                Infinity;

            if (
                score <
                bestScore
            ) {

                bestScore =
                    score;

                best =
                    node;
            }
        }

        return best;
    }


    heuristic(
        nodeA,
        nodeB
    ) {

        if (
            !nodeA ||
            !nodeB
        ) {
            return Infinity;
        }

        return distance(
            nodeA.position,
            nodeB.position
        );
    }


    buildDirectPath(
        startPoint,
        targetPoint,
        node
    ) {

        if (
            node &&
            node.surface
        ) {

            const surface =
                node.surface;

            const startT =
                surface.projectT(
                    startPoint
                );

            const targetT =
                surface.projectT(
                    targetPoint
                );

            const startProjected =
                surface.getPoint(
                    startT
                );

            const targetProjected =
                surface.getPoint(
                    targetT
                );

            return [
                {
                    x:
                        startProjected.x,

                    y:
                        startProjected.y,

                    surface,

                    t:
                        startT,

                    movementType:
                        surface.getMovementType(
                            startT
                        ),

                    edgeType:
                        null,

                    transition:
                        null
                },

                {
                    x:
                        targetProjected.x,

                    y:
                        targetProjected.y,

                    surface,

                    t:
                        targetT,

                    movementType:
                        surface.getMovementType(
                            targetT
                        ),

                    edgeType:
                        null,

                    transition:
                        null
                }
            ];
        }

        return [
            {
                x: startPoint.x,
                y: startPoint.y,
                surface: null,
                t: 0,
                movementType: 'WALK',
                edgeType: null,
                transition: null
            },

            {
                x: targetPoint.x,
                y: targetPoint.y,
                surface: null,
                t: 0,
                movementType: 'WALK',
                edgeType: null,
                transition: null
            }
        ];
    }


    buildPath(
        startPoint,
        targetPoint,
        nodePath
    ) {

        if (
            !nodePath.length
        ) {
            return [];
        }

        const path = [];

        const first =
            nodePath[0];

        this.addPathPoint(
            path,
            startPoint,
            first.surface,
            first.t,
            {
                movementType:
                    first.surface
                        ? first.surface.getMovementType(
                            first.t
                        )
                        : 'WALK',

                edgeType:
                    null,

                transition:
                    null
            }
        );


        for (
            let i = 0;
            i < nodePath.length;
            i++
        ) {

            const node =
                nodePath[i];

            if (!node) {
                continue;
            }

            const edge =
                node._edgeFromPrevious ||
                null;

            const edgeType =
                edge
                    ? String(
                        edge.type ||
                        ''
                    ).toUpperCase()
                    : null;

            const isTransition =
                edgeType === 'JUMP' ||
                edgeType === 'HANG' ||
                edgeType === 'SWING';

            const movementType =
                node.surface
                    ? node.surface.getMovementType(
                        node.t
                    )
                    : 'WALK';

            this.addPathPoint(
                path,
                node.position,
                node.surface,
                node.t,
                {
                    movementType,
                    edgeType,
                    transition:
                        isTransition
                            ? edgeType
                            : null,

                    isEndNode:
                        node.isEndNode === true
                }
            );
        }


        const lastNode =
            nodePath[
                nodePath.length - 1
            ];

        const lastSurface =
            lastNode &&
            lastNode.surface
                ? lastNode.surface
                : null;

        if (lastSurface) {

            const projected =
                lastSurface.projectPoint(
                    targetPoint
                );

            if (
                projected &&
                projected.point
            ) {

                const movementType =
                    lastSurface.getMovementType(
                        projected.t
                    );

                this.addPathPoint(
                    path,
                    projected.point,
                    lastSurface,
                    projected.t,
                    {
                        movementType,
                        edgeType: null,
                        transition: null
                    }
                );

                return path;
            }
        }

        this.addPathPoint(
            path,
            targetPoint,
            null,
            0,
            {
                movementType: 'WALK',
                edgeType: null,
                transition: null
            }
        );

        return path;
    }


    addPathPoint(
        path,
        point,
        surface,
        t,
        metadata = {}
    ) {

        if (
            !finitePoint(point)
        ) {
            return;
        }

        const safeT =
            Number.isFinite(t)
                ? Math.max(
                    0,
                    Math.min(
                        1,
                        t
                    )
                )
                : 0;

        const previous =
            path[
                path.length - 1
            ];

        if (
            previous &&
            distanceSq(
                previous,
                point
            ) < 0.0001
        ) {

            if (
                previous.surface ===
                surface
            ) {

                previous.t =
                    safeT;
            }

            Object.assign(
                previous,
                metadata
            );

            return;
        }

        path.push({
            x: point.x,
            y: point.y,

            surface:
                surface ||
                null,

            t:
                safeT,

            movementType:
                metadata.movementType ||
                'WALK',

            edgeType:
                metadata.edgeType ||
                null,

            transition:
                metadata.transition ||
                null,

            isEndNode:
                metadata.isEndNode === true
        });
    }


    findNearestSurfacePoint(
        point,
        surfaces
    ) {

        if (
            !finitePoint(point) ||
            !Array.isArray(surfaces) ||
            surfaces.length === 0
        ) {
            return null;
        }

        let best = null;
        let bestDistance = Infinity;

        for (
            const surface
            of surfaces
        ) {

            if (!surface) {
                continue;
            }

            const projection =
                surface.projectPoint(
                    point
                );

            if (!projection) {
                continue;
            }

            if (
                projection.distance <
                bestDistance
            ) {

                bestDistance =
                    projection.distance;

                best = {
                    surface,

                    t:
                        projection.t,

                    point: {
                        x:
                            projection.point.x,

                        y:
                            projection.point.y
                    },

                    distance:
                        projection.distance
                };
            }
        }

        return best;
    }


    validate() {

        return (
            this.graph &&
            typeof this.graph.getNode ===
                'function' &&
            typeof this.graph.getNeighbors ===
                'function'
        );
    }
}


export default Pathfinder;


// ============================================================
// NEXT TASK:
// Подключить RouteNetwork.js к World.js; Character пока НЕ менять.
// ============================================================
