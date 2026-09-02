import {
    distance,
    distanceSq,
    finite,
    finitePoint
} from "../character/MathUtils.js";


export class Pathfinder {

    constructor(graph) {

        if (!graph) {
            throw new Error(
                "Pathfinder: NavigationGraph is required"
            );
        }

        this.graph = graph;
    }


    findPath(startPoint, targetPoint, options = {}) {

        if (
            !finitePoint(startPoint) ||
            !finitePoint(targetPoint)
        ) {
            return [];
        }

        const state = options.state || {};

        const startNode =
            options.startNode ||
            this.graph.findNearestNode(
                startPoint,
                {
                    surface: options.startSurface || null,
                    maxDistance:
                        Number.isFinite(options.maxStartDistance)
                            ? options.maxStartDistance
                            : Infinity
                }
            );

        const targetNode =
            options.targetNode ||
            this.graph.findNearestNode(
                targetPoint,
                {
                    surface: options.targetSurface || null,
                    maxDistance:
                        Number.isFinite(options.maxTargetDistance)
                            ? options.maxTargetDistance
                            : Infinity
                }
            );

        if (!startNode || !targetNode) {
            return [];
        }

        if (startNode === targetNode) {

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

        if (!nodePath.length) {
            return [];
        }

        return this.buildPath(
            startPoint,
            targetPoint,
            nodePath
        );
    }


    findNodePath(startNode, targetNode, state = {}) {

        if (!startNode || !targetNode) {
            return [];
        }

        if (startNode === targetNode) {
            return [startNode];
        }

        const openSet = new Set([
            startNode
        ]);

        const cameFrom = new Map();

        const gScore = new Map();

        const fScore = new Map();

        for (const node of this.graph.getAllNodes()) {

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

        while (openSet.size > 0) {

            const current =
                this.getLowestScoreNode(
                    openSet,
                    fScore
                );

            if (!current) {
                break;
            }

            if (current === targetNode) {

                return this.reconstructPath(
                    cameFrom,
                    current
                );
            }

            openSet.delete(current);

            const neighbors =
                this.graph.getNeighbors(
                    current.id,
                    state
                );

            for (const item of neighbors) {

                const neighbor = item.node;
                const edge = item.edge;

                if (!neighbor || !edge) {
                    continue;
                }

                const tentativeG =
                    (gScore.get(current) ?? Infinity) +
                    edge.getCost();

                const knownG =
                    gScore.get(neighbor) ?? Infinity;

                if (tentativeG < knownG) {

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


    reconstructPath(cameFrom, current) {

        const path = [current];

        let cursor = current;

        while (cameFrom.has(cursor)) {

            const record =
                cameFrom.get(cursor);

            cursor = record.node;

            path.push(cursor);
        }

        path.reverse();

        return path;
    }


    getLowestScoreNode(openSet, scores) {

        let best = null;
        let bestScore = Infinity;

        for (const node of openSet) {

            const score =
                scores.get(node) ?? Infinity;

            if (score < bestScore) {

                bestScore = score;
                best = node;
            }
        }

        return best;
    }


    heuristic(nodeA, nodeB) {

        if (!nodeA || !nodeB) {
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

        const result = [];

        if (node && node.surface) {

            const startT =
                node.surface.projectT(
                    startPoint
                );

            const targetT =
                node.surface.projectT(
                    targetPoint
                );

            const startProjected =
                node.surface.getPoint(
                    startT
                );

            const targetProjected =
                node.surface.getPoint(
                    targetT
                );

            result.push({
                x: startProjected.x,
                y: startProjected.y,
                surface: node.surface,
                t: startT
            });

            if (
                distanceSq(
                    startProjected,
                    targetProjected
                ) > 0.0001
            ) {

                result.push({
                    x: targetProjected.x,
                    y: targetProjected.y,
                    surface: node.surface,
                    t: targetT
                });
            }

            return result;
        }

        result.push({
            x: startPoint.x,
            y: startPoint.y,
            surface: null,
            t: 0
        });

        result.push({
            x: targetPoint.x,
            y: targetPoint.y,
            surface: null,
            t: 0
        });

        return result;
    }


    buildPath(
        startPoint,
        targetPoint,
        nodePath
    ) {

        if (!nodePath.length) {
            return [];
        }

        const path = [];

        this.addPathPoint(
            path,
            startPoint,
            nodePath[0].surface,
            nodePath[0].t
        );

        for (const node of nodePath) {

            if (!node) {
                continue;
            }

            this.addPathPoint(
                path,
                node.position,
                node.surface,
                node.t
            );
        }

        const lastNode =
            nodePath[nodePath.length - 1];

        this.addPathPoint(
            path,
            targetPoint,
            lastNode
                ? lastNode.surface
                : null,
            lastNode
                ? lastNode.t
                : 0
        );

        return path;
    }


    addPathPoint(
        path,
        point,
        surface,
        t
    ) {

        if (!finitePoint(point)) {
            return;
        }

        const safeT =
            Number.isFinite(t)
                ? Math.max(0, Math.min(1, t))
                : 0;

        const previous =
            path[path.length - 1];

        if (
            previous &&
            distanceSq(
                previous,
                point
            ) < 0.0001
        ) {

            if (
                previous.surface === surface
            ) {
                previous.t = safeT;
            }

            return;
        }

        path.push({
            x: point.x,
            y: point.y,
            surface: surface || null,
            t: safeT
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

        for (const surface of surfaces) {

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
                    t: projection.t,
                    point: {
                        x: projection.point.x,
                        y: projection.point.y
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
            typeof this.graph.getNode === "function" &&
            typeof this.graph.getNeighbors === "function"
        );
    }
}


export default Pathfinder;
