import {
    EPSILON,
    clamp01,
    distance,
    finite,
    finitePoint
} from "../character/MathUtils.js";


/**
 * NavigationNode
 *
 * Узел навигационного графа.
 *
 * position:
 *     мировая координата узла.
 *
 * surface:
 *     объект Surface, к которому относится узел.
 *
 * t:
 *     положение на поверхности 0..1.
 */
export class NavigationNode {

    constructor(id, options = {}) {

        this.id = id;

        this.position = {
            x: Number(options.x) || 0,
            y: Number(options.y) || 0
        };

        this.surface = options.surface || null;

        this.t = clamp01(
            Number.isFinite(options.t)
                ? options.t
                : 0
        );

        this.radius = Math.max(
            0,
            Number(options.radius) || 18
        );

        this.tags = Array.isArray(options.tags)
            ? [...options.tags]
            : [];

        this.edges = [];
    }


    addEdge(edge) {

        if (!edge) {
            return;
        }

        if (!this.edges.includes(edge)) {
            this.edges.push(edge);
        }
    }


    removeEdge(edge) {

        const index = this.edges.indexOf(edge);

        if (index !== -1) {
            this.edges.splice(index, 1);
        }
    }


    hasEdgeTo(nodeId) {

        return this.edges.some(
            edge => edge.to && edge.to.id === nodeId
        );
    }


    distanceToPoint(point) {

        return distance(
            this.position,
            point
        );
    }


    containsPoint(point) {

        return this.distanceToPoint(point) <= this.radius;
    }


    validate() {

        if (!this.id) {
            return false;
        }

        if (!finitePoint(this.position)) {
            return false;
        }

        if (!finite(this.t)) {
            return false;
        }

        if (!finite(this.radius)) {
            return false;
        }

        return true;
    }
}


/**
 * NavigationEdge
 *
 * Связь между двумя узлами.
 *
 * cost:
 *     стоимость перехода для Pathfinder.
 *
 * type:
 *     тип перехода:
 *       walk
 *       climb
 *       jump
 *       fall
 *       custom
 *
 * bidirectional:
 *     можно ли идти в обе стороны.
 */
export class NavigationEdge {

    constructor(from, to, options = {}) {

        this.from = from;
        this.to = to;

        this.type = options.type || "walk";

        this.cost = Number.isFinite(options.cost)
            ? Math.max(0, options.cost)
            : distance(
                from.position,
                to.position
            );

        this.bidirectional =
            options.bidirectional !== false;

        this.enabled =
            options.enabled !== false;

        this.requiredState =
            options.requiredState || null;

        this.tags = Array.isArray(options.tags)
            ? [...options.tags]
            : [];
    }


    getCost() {

        return this.cost;
    }


    canTraverse(state = {}) {

        if (!this.enabled) {
            return false;
        }

        if (
            this.requiredState &&
            state[this.requiredState] !== true
        ) {
            return false;
        }

        return true;
    }


    validate() {

        if (!this.from || !this.to) {
            return false;
        }

        if (!finite(this.cost)) {
            return false;
        }

        return true;
    }
}


/**
 * NavigationGraph
 *
 * Главный граф навигации мира.
 */
export class NavigationGraph {

    constructor() {

        this.nodes = new Map();

        this.edges = [];

        this.surfaceNodes = new Map();
    }


    clear() {

        this.nodes.clear();

        this.edges.length = 0;

        this.surfaceNodes.clear();
    }


    addNode(id, options = {}) {

        if (!id) {
            throw new Error(
                "NavigationGraph.addNode: id is required"
            );
        }

        if (this.nodes.has(id)) {
            return this.nodes.get(id);
        }

        const node = new NavigationNode(
            id,
            options
        );

        this.nodes.set(
            id,
            node
        );

        this.registerSurfaceNode(node);

        return node;
    }


    addNodeObject(node) {

        if (!(node instanceof NavigationNode)) {
            throw new Error(
                "NavigationGraph.addNodeObject: invalid node"
            );
        }

        if (this.nodes.has(node.id)) {
            return this.nodes.get(node.id);
        }

        this.nodes.set(
            node.id,
            node
        );

        this.registerSurfaceNode(node);

        return node;
    }


    getNode(id) {

        return this.nodes.get(id) || null;
    }


    hasNode(id) {

        return this.nodes.has(id);
    }


    removeNode(id) {

        const node = this.nodes.get(id);

        if (!node) {
            return false;
        }

        for (const edge of [...this.edges]) {

            if (
                edge.from === node ||
                edge.to === node
            ) {
                this.removeEdge(edge);
            }
        }

        this.nodes.delete(id);

        this.unregisterSurfaceNode(node);

        return true;
    }


    connect(fromId, toId, options = {}) {

        const from = this.getNode(fromId);
        const to = this.getNode(toId);

        if (!from || !to) {
            throw new Error(
                `NavigationGraph.connect: unknown node ${fromId} -> ${toId}`
            );
        }

        const edge = new NavigationEdge(
            from,
            to,
            options
        );

        this.edges.push(edge);

        from.addEdge(edge);

        if (edge.bidirectional) {

            const reverse = new NavigationEdge(
                to,
                from,
                {
                    ...options,
                    bidirectional: false
                }
            );

            this.edges.push(reverse);

            to.addEdge(reverse);

            reverse.reverseOf = edge;
            edge.reverseOf = reverse;
        }

        return edge;
    }


    addEdge(edge) {

        if (!(edge instanceof NavigationEdge)) {
            throw new Error(
                "NavigationGraph.addEdge: invalid edge"
            );
        }

        if (!this.nodes.has(edge.from.id)) {
            this.addNodeObject(edge.from);
        }

        if (!this.nodes.has(edge.to.id)) {
            this.addNodeObject(edge.to);
        }

        this.edges.push(edge);

        edge.from.addEdge(edge);

        return edge;
    }


    removeEdge(edge) {

        if (!edge) {
            return false;
        }

        const index = this.edges.indexOf(edge);

        if (index !== -1) {
            this.edges.splice(index, 1);
        }

        if (edge.from) {
            edge.from.removeEdge(edge);
        }

        return index !== -1;
    }


    getNeighbors(nodeId, state = {}) {

        const node = this.getNode(nodeId);

        if (!node) {
            return [];
        }

        const result = [];

        for (const edge of node.edges) {

            if (!edge.canTraverse(state)) {
                continue;
            }

            if (!edge.to) {
                continue;
            }

            result.push({
                node: edge.to,
                edge
            });
        }

        return result;
    }


    registerSurfaceNode(node) {

        if (!node.surface) {
            return;
        }

        const surfaceId = node.surface.id;

        if (!this.surfaceNodes.has(surfaceId)) {
            this.surfaceNodes.set(
                surfaceId,
                []
            );
        }

        const list =
            this.surfaceNodes.get(surfaceId);

        if (!list.includes(node)) {
            list.push(node);
        }
    }


    unregisterSurfaceNode(node) {

        if (!node.surface) {
            return;
        }

        const surfaceId = node.surface.id;

        const list =
            this.surfaceNodes.get(surfaceId);

        if (!list) {
            return;
        }

        const index = list.indexOf(node);

        if (index !== -1) {
            list.splice(index, 1);
        }

        if (list.length === 0) {
            this.surfaceNodes.delete(surfaceId);
        }
    }


    getSurfaceNodes(surface) {

        if (!surface) {
            return [];
        }

        return [
            ...(this.surfaceNodes.get(surface.id) || [])
        ];
    }


    findNearestNode(point, options = {}) {

        if (!finitePoint(point)) {
            return null;
        }

        const maxDistance =
            Number.isFinite(options.maxDistance)
                ? Math.max(0, options.maxDistance)
                : Infinity;

        const surface =
            options.surface || null;

        let nearest = null;
        let nearestDistance = maxDistance;

        for (const node of this.nodes.values()) {

            if (
                surface &&
                node.surface !== surface
            ) {
                continue;
            }

            const d =
                node.distanceToPoint(point);

            if (d < nearestDistance) {

                nearestDistance = d;

                nearest = node;
            }
        }

        return nearest;
    }


    findNodesOnSurface(surface) {

        return this.getSurfaceNodes(surface);
    }


    findClosestConnection(surfaceA, surfaceB) {

        if (!surfaceA || !surfaceB) {
            return null;
        }

        let best = null;
        let bestDistance = Infinity;

        for (const edge of this.edges) {

            if (!edge.from || !edge.to) {
                continue;
            }

            const fromSurface =
                edge.from.surface;

            const toSurface =
                edge.to.surface;

            const matches =
                (
                    fromSurface === surfaceA &&
                    toSurface === surfaceB
                ) ||
                (
                    fromSurface === surfaceB &&
                    toSurface === surfaceA
                );

            if (!matches) {
                continue;
            }

            const d =
                distance(
                    edge.from.position,
                    edge.to.position
                );

            if (d < bestDistance) {

                bestDistance = d;

                best = edge;
            }
        }

        return best;
    }


    getAllNodes() {

        return [...this.nodes.values()];
    }


    getAllEdges() {

        return [...this.edges];
    }


    validate() {

        for (const node of this.nodes.values()) {

            if (!node.validate()) {
                return false;
            }
        }

        for (const edge of this.edges) {

            if (!edge.validate()) {
                return false;
            }

            if (
                !this.nodes.has(edge.from.id) ||
                !this.nodes.has(edge.to.id)
            ) {
                return false;
            }
        }

        return true;
    }


    snapshot() {

        return {
            nodes: this.getAllNodes().map(node => ({
                id: node.id,
                position: {
                    x: node.position.x,
                    y: node.position.y
                },
                surfaceId:
                    node.surface
                        ? node.surface.id
                        : null,
                t: node.t,
                radius: node.radius,
                tags: [...node.tags]
            })),

            edges: this.edges.map(edge => ({
                from: edge.from.id,
                to: edge.to.id,
                type: edge.type,
                cost: edge.cost,
                enabled: edge.enabled
            }))
        };
    }
}


export default NavigationGraph;
