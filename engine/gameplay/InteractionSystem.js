import {
    distance,
    finite,
    finitePoint
} from "../character/MathUtils.js";


export class InteractionNode {

    constructor(id, options = {}) {

        this.id = id;

        this.position = {
            x: Number(options.x) || 0,
            y: Number(options.y) || 0
        };

        this.radius =
            Number.isFinite(options.radius)
                ? Math.max(0, options.radius)
                : 24;

        this.requiredDistance =
            Number.isFinite(options.requiredDistance)
                ? Math.max(0, options.requiredDistance)
                : 35;

        this.action =
            typeof options.action === "function"
                ? options.action
                : null;

        this.enabled =
            options.enabled !== false;

        this.tags =
            Array.isArray(options.tags)
                ? [...options.tags]
                : [];

        this.state =
            options.state || {};

        this.data =
            options.data || {};
    }


    containsPoint(point) {

        if (!this.enabled) {
            return false;
        }

        if (!finitePoint(point)) {
            return false;
        }

        return (
            distance(
                this.position,
                point
            ) <= this.radius
        );
    }


    canInteract(character) {

        if (!this.enabled || !character) {
            return false;
        }

        const characterPosition =
            character.getWorldPosition();

        if (
            !finitePoint(
                characterPosition
            )
        ) {
            return false;
        }

        return (
            distance(
                characterPosition,
                this.position
            ) <=
            this.requiredDistance
        );
    }


    execute(context = {}) {

        if (!this.enabled) {
            return false;
        }

        if (!this.action) {
            return true;
        }

        this.action(
            {
                node: this,
                ...context
            }
        );

        return true;
    }


    setEnabled(enabled) {

        this.enabled =
            Boolean(enabled);
    }


    validate() {

        return (
            Boolean(this.id) &&
            finitePoint(this.position) &&
            finite(this.radius) &&
            finite(this.requiredDistance)
        );
    }
}


export class InteractionSystem {

    constructor(options = {}) {

        this.nodes = new Map();

        this.character = null;

        this.questSystem =
            options.questSystem || null;

        this.onInteraction =
            typeof options.onInteraction === "function"
                ? options.onInteraction
                : null;

        this.onTargetChanged =
            typeof options.onTargetChanged === "function"
                ? options.onTargetChanged
                : null;

        this.currentTarget = null;

        this.pendingTarget = null;

        this.pendingAction = false;
    }


    setCharacter(character) {

        this.character = character;
    }


    setQuestSystem(questSystem) {

        this.questSystem =
            questSystem;
    }


    addNode(id, options = {}) {

        if (!id) {
            throw new Error(
                "InteractionSystem.addNode: id is required"
            );
        }

        if (this.nodes.has(id)) {
            return this.nodes.get(id);
        }

        const node =
            new InteractionNode(
                id,
                options
            );

        this.nodes.set(
            id,
            node
        );

        return node;
    }


    addNodeObject(node) {

        if (!(node instanceof InteractionNode)) {
            throw new Error(
                "InteractionSystem.addNodeObject: invalid node"
            );
        }

        this.nodes.set(
            node.id,
            node
        );

        return node;
    }


    getNode(id) {

        return this.nodes.get(id) || null;
    }


    removeNode(id) {

        const node =
            this.nodes.get(id);

        if (!node) {
            return false;
        }

        if (
            this.currentTarget === node
        ) {
            this.setCurrentTarget(null);
        }

        if (
            this.pendingTarget === node
        ) {
            this.pendingTarget = null;
        }

        return this.nodes.delete(id);
    }


    clear() {

        this.nodes.clear();

        this.currentTarget = null;

        this.pendingTarget = null;

        this.pendingAction = false;
    }


    findTarget(point) {

        if (!finitePoint(point)) {
            return null;
        }

        let nearest = null;
        let nearestDistance = Infinity;

        for (
            const node
            of this.nodes.values()
        ) {

            if (!node.enabled) {
                continue;
            }

            const d =
                distance(
                    point,
                    node.position
                );

            if (
                d <= node.radius &&
                d < nearestDistance
            ) {

                nearestDistance = d;

                nearest = node;
            }
        }

        return nearest;
    }


    setCurrentTarget(node) {

        if (
            this.currentTarget === node
        ) {
            return;
        }

        this.currentTarget =
            node || null;

        if (this.onTargetChanged) {

            this.onTargetChanged(
                this.currentTarget
            );
        }
    }


    requestInteraction(node) {

        if (!node || !node.enabled) {
            return false;
        }

        this.pendingTarget = node;

        this.pendingAction = true;

        this.setCurrentTarget(node);

        return true;
    }


    requestInteractionAt(point) {

        const node =
            this.findTarget(point);

        if (!node) {
            return false;
        }

        return this.requestInteraction(
            node
        );
    }


    update() {

        if (
            !this.character ||
            !this.pendingAction ||
            !this.pendingTarget
        ) {
            return;
        }

        const node =
            this.pendingTarget;

        if (!node.enabled) {

            this.cancelPendingInteraction();

            return;
        }

        if (
            !node.canInteract(
                this.character
            )
        ) {
            return;
        }

        this.executeInteraction(
            node
        );
    }


    executeInteraction(node) {

        if (!node) {
            return false;
        }

        const context = {
            character:
                this.character,

            questSystem:
                this.questSystem
        };

        const result =
            node.execute(
                context
            );

        if (this.onInteraction) {

            this.onInteraction(
                node,
                result,
                context
            );
        }

        this.pendingTarget = null;

        this.pendingAction = false;

        this.setCurrentTarget(null);

        return result;
    }


    cancelPendingInteraction() {

        this.pendingTarget = null;

        this.pendingAction = false;
    }


    getCurrentTarget() {

        return this.currentTarget;
    }


    getPendingTarget() {

        return this.pendingTarget;
    }


    isWaitingForInteraction() {

        return (
            this.pendingAction &&
            this.pendingTarget !== null
        );
    }


    getAllNodes() {

        return [
            ...this.nodes.values()
        ];
    }


    validate() {

        for (
            const node
            of this.nodes.values()
        ) {

            if (!node.validate()) {
                return false;
            }
        }

        return true;
    }


    snapshot() {

        return {
            currentTarget:
                this.currentTarget
                    ? this.currentTarget.id
                    : null,

            pendingTarget:
                this.pendingTarget
                    ? this.pendingTarget.id
                    : null,

            pendingAction:
                this.pendingAction,

            nodes:
                this.getAllNodes().map(
                    node => ({
                        id: node.id,
                        x: node.position.x,
                        y: node.position.y,
                        radius: node.radius,
                        requiredDistance:
                            node.requiredDistance,
                        enabled:
                            node.enabled,
                        tags: [...node.tags]
                    })
                )
        };
    }
}


export default InteractionSystem;
