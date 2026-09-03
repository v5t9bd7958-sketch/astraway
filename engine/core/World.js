import { NavigationGraph } from '../world/NavigationGraph.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { Character } from '../character/Character.js';
import {
    InteractionSystem,
    InteractionNode
} from '../gameplay/InteractionSystem.js';
import { QuestSystem } from '../gameplay/QuestSystem.js';
import {
    createASTRAWAYSurfaces,
    createASTRAWAYNavigation
} from '../world/RouteNetwork.js';
export class World {
    constructor(options = {}) {
        this.width =
            options.width ?? 2400;
        this.height =
            options.height ?? 5190;
        this.surfaces =
            new Map();
        this.navigation =
            new NavigationGraph();
        this.pathfinder =
            new Pathfinder(
                this.navigation
            );
        this.questSystem =
            new QuestSystem();
        this.character =
            new Character({
                x:
                    options.characterX ??
                    0,
                y:
                    options.characterY ??
                    0,
                speed:
                    options.characterSpeed ??
                    120,
                turnSpeed:
                    options.turnSpeed ??
                    8,
                lookTurnSpeed:
                    options.lookTurnSpeed ??
                    10
            });
        this.interactionSystem =
            new InteractionSystem();
        this.interactionSystem.setCharacter(
            this.character
        );
        this.interactionSystem.setQuestSystem(
            this.questSystem
        );
        this.started = false;
        this.initialized = false;
        this.onInteraction = null;
        this.onTargetChanged = null;
        this._lastInteractionTarget =
            null;
    }
    initialize() {
        if (this.initialized) {
            return;
        }
        this.createSurfaces();
        this.createNavigation();
        this.createInteractions();
        this.createQuests();
        this.initializeCharacter();
        this.initialized = true;
    }
    createSurfaces() {
        createASTRAWAYSurfaces(
            this
        );
    }
    addSurface(surface) {
        if (
            !surface ||
            !surface.id
        ) {
            return false;
        }
        this.surfaces.set(
            surface.id,
            surface
        );
        return true;
    }
    getSurface(id) {
        return (
            this.surfaces.get(id) ??
            null
        );
    }
    getSurfaces() {
        return [
            ...this.surfaces.values()
        ];
    }
    createNavigation() {
        createASTRAWAYNavigation(
            this
        );
    }
    addSurfaceNode(
        id,
        surface,
        t,
        options = {}
    ) {
        const point =
            surface.getPoint(t);
        return this.navigation.addNode(
            id,
            {
                x: point.x,
                y: point.y,
                surface,
                t,
                radius:
                    options.radius ??
                    36,
                tags:
                    options.tags ??
                    []
            }
        );
    }
    connect(
        fromId,
        toId,
        options = {}
    ) {
        return this.navigation.connect(
            fromId,
            toId,
            options
        );
    }
    createInteractions() {
        const root =
            this.getSurface(
                's14_left_root_loop'
            );
        const center =
            this.getSurface(
                's08_central_trunk'
            );
        const lower =
            this.getSurface(
                's16_right_root_loop'
            );
        if (
            !root ||
            !center ||
            !lower
        ) {
            return;
        }
        this.addInteraction(
            'root',
            root,
            0.18,
            'Корневой узел'
        );
        this.addInteraction(
            'center',
            center,
            0.55,
            'Центральный узел'
        );
        this.addInteraction(
            'lower',
            lower,
            0.55,
            'Нижний узел'
        );
    }
    addInteraction(
        id,
        surface,
        t,
        label
    ) {
        const position =
            surface.getPoint(t);
        const node =
            new InteractionNode({
                id,
                position,
                radius: 42,
                requiredDistance: 34,
                action: context => {
                    this.handleInteraction(
                        id,
                        context
                    );
                    return {
                        success: true,
                        id
                    };
                },
                data: {
                    label,
                    surfaceId:
                        surface.id,
                    surfaceT:
                        t
                }
            });
        this.interactionSystem.addNodeObject(
            node
        );
        return node;
    }
    handleInteraction(
        id,
        context
    ) {
        this.questSystem.setFlag(
            `${id}_found`,
            true
        );
        this.questSystem.completeStep(
            'astraway_intro',
            id
        );
        if (
            typeof this.onInteraction ===
            'function'
        ) {
            this.onInteraction(
                id,
                context
            );
        }
    }
    createQuests() {
        this.questSystem.defineQuest(
            'astraway_intro',
            {
                title:
                    'Путь открыт',
                steps: [
                    {
                        id: 'root',
                        title:
                            'Исследовать корневой узел'
                    },
                    {
                        id: 'center',
                        title:
                            'Исследовать центральный узел'
                    },
                    {
                        id: 'lower',
                        title:
                            'Исследовать нижний узел'
                    }
                ]
            }
        );
        this.questSystem.startQuest(
            'astraway_intro'
        );
    }
    initializeCharacter() {
        const root =
            this.getSurface(
                's14_left_root_loop'
            );
        if (!root) {
            throw new Error(
                'ASTRAWAY: стартовая поверхность отсутствует.'
            );
        }
        const startT =
            0.08;
        const startPoint =
            root.getPoint(
                startT
            );
        this.character.initialize(
            startPoint,
            root,
            startT
        );
    }
    start() {
        if (!this.initialized) {
            this.initialize();
        }
        this.started = true;
    }
    stop() {
        this.started = false;
        if (
            typeof this.character.stop ===
            'function'
        ) {
            this.character.stop();
        }
    }
    update(dt) {
        if (
            !this.initialized ||
            !this.started
        ) {
            return;
        }
        this.character.update(
            dt
        );
        this.interactionSystem.update(
            dt
        );
        const target =
            this.interactionSystem
                .getCurrentTarget();
        if (
            target !==
            this._lastInteractionTarget
        ) {
            this._lastInteractionTarget =
                target;
            if (
                typeof this.onTargetChanged ===
                'function'
            ) {
                this.onTargetChanged(
                    target
                );
            }
        }
    }
    moveCharacterTo(
        worldPoint
    ) {
        if (!worldPoint) {
            return false;
        }
        const path =
            this.pathfinder.findPath(
                this.character.getWorldPosition(),
                worldPoint
            );
        if (
            !path ||
            path.length === 0
        ) {
            return false;
        }
        this.character.setPath(
            path
        );
        return true;
    }
    interactAt(
        worldPoint
    ) {
        if (!worldPoint) {
            return false;
        }
        return this.interactionSystem
            .requestInteractionAt(
                worldPoint
            );
    }
    handleTap(
        worldPoint
    ) {
        if (!worldPoint) {
            return false;
        }
        const target =
            this.interactionSystem
                .findTarget(
                    worldPoint
                );
        if (target) {
            return this.interactionSystem
                .requestInteraction(
                    target
                );
        }
        return this.moveCharacterTo(
            worldPoint
        );
    }
    getCharacter() {
        return this.character;
    }
    getCameraTarget() {
        return this.character
            .getWorldPosition();
    }
    getInteractionNodes() {
        return this.interactionSystem
            .getAllNodes();
    }
    validate() {
        const errors = [];
        for (
            const surface of
            this.surfaces.values()
        ) {
            if (
                typeof surface.validate ===
                'function'
            ) {
                if (
                    surface.validate() !==
                    true
                ) {
                    errors.push({
                        type:
                            'surface',
                        id:
                            surface.id
                    });
                }
            }
        }
        if (
            typeof this.navigation.validate ===
            'function'
        ) {
            if (
                this.navigation.validate() !==
                true
            ) {
                errors.push({
                    type: 'navigation'
                });
            }
        }
        if (
            typeof this.character.validate ===
            'function'
        ) {
            if (
                this.character.validate() !==
                true
            ) {
                errors.push({
                    type: 'character'
                });
            }
        }
        if (
            typeof this.interactionSystem.validate ===
            'function'
        ) {
            if (
                this.interactionSystem.validate() !==
                true
            ) {
                errors.push({
                    type: 'interaction'
                });
            }
        }
        if (
            typeof this.questSystem.validate ===
            'function'
        ) {
            if (
                this.questSystem.validate() !==
                true
            ) {
                errors.push({
                    type: 'quest'
                });
            }
        }
        return {
            valid:
                errors.length === 0,
            errors
        };
    }
    snapshot() {
        return {
            initialized:
                this.initialized,
            started:
                this.started,
            surfaces:
                this.getSurfaces()
                    .map(surface => {
                        if (
                            typeof surface.snapshot ===
                            'function'
                        ) {
                            return surface.snapshot();
                        }
                        return {
                            id:
                                surface.id,
                            name:
                                surface.name
                        };
                    }),
            character:
                typeof this.character.getState ===
                'function'
                    ? this.character.getState()
                    : null,
            quest:
                typeof this.questSystem.snapshot ===
                'function'
                    ? this.questSystem.snapshot()
                    : null
        };
    }
}
export function createWorld(
    options = {}
) {
    const world =
        new World(
            options
        );
    world.initialize();
    return world;
}
export default World;
