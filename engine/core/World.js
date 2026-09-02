import { Surface } from '../world/Surface.js';
import { NavigationGraph } from '../world/NavigationGraph.js';
import { Pathfinder } from '../world/Pathfinder.js';

import { Character } from '../character/Character.js';

import {
    InteractionSystem,
    InteractionNode
} from '../gameplay/InteractionSystem.js';

import { QuestSystem } from '../gameplay/QuestSystem.js';


export class World {

    constructor(options = {}) {

        this.width = options.width ?? 1600;
        this.height = options.height ?? 1000;

        this.surfaces = new Map();

        this.navigation = new NavigationGraph();
        this.pathfinder = new Pathfinder(this.navigation);

        this.questSystem = new QuestSystem();

        this.character = new Character({
            x: options.characterX ?? 180,
            y: options.characterY ?? 180,
            speed: options.characterSpeed ?? 120,
            turnSpeed: options.turnSpeed ?? 8,
            lookTurnSpeed: options.lookTurnSpeed ?? 10
        });

        this.interactionSystem = new InteractionSystem();

        this.interactionSystem.setCharacter(this.character);
        this.interactionSystem.setQuestSystem(this.questSystem);

        this.started = false;
        this.initialized = false;

        this.onInteraction = null;
        this.onTargetChanged = null;

        this._lastInteractionTarget = null;
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

        const root = new Surface({
            id: 'root',
            name: 'Главная ветвь',
            width: 90,
            points: [
                { x: 80, y: 360 },
                { x: 190, y: 335 },
                { x: 310, y: 365 },
                { x: 440, y: 305 },
                { x: 590, y: 320 },
                { x: 760, y: 270 },
                { x: 930, y: 300 },
                { x: 1100, y: 245 },
                { x: 1280, y: 265 }
            ]
        });

        const upper = new Surface({
            id: 'upper',
            name: 'Верхняя ветвь',
            width: 78,
            points: [
                { x: 440, y: 305 },
                { x: 510, y: 215 },
                { x: 610, y: 145 },
                { x: 735, y: 110 }
            ]
        });

        const high = new Surface({
            id: 'high',
            name: 'Высокая ветвь',
            width: 72,
            points: [
                { x: 930, y: 300 },
                { x: 990, y: 205 },
                { x: 1080, y: 145 },
                { x: 1210, y: 120 }
            ]
        });

        this.addSurface(root);
        this.addSurface(upper);
        this.addSurface(high);
    }


    addSurface(surface) {

        if (!surface || !surface.id) {
            return false;
        }

        this.surfaces.set(surface.id, surface);

        return true;
    }


    getSurface(id) {

        return this.surfaces.get(id) ?? null;
    }


    createNavigation() {

        const root = this.getSurface('root');
        const upper = this.getSurface('upper');
        const high = this.getSurface('high');

        if (!root || !upper || !high) {
            throw new Error(
                'ASTRAWAY: поверхности не созданы.'
            );
        }


        this.addSurfaceNode('root_0', root, 0.00);
        this.addSurfaceNode('root_1', root, 0.18);
        this.addSurfaceNode('root_2', root, 0.38);
        this.addSurfaceNode('root_3', root, 0.58);
        this.addSurfaceNode('root_4', root, 0.78);
        this.addSurfaceNode('root_5', root, 1.00);

        this.addSurfaceNode('upper_0', upper, 0.00);
        this.addSurfaceNode('upper_1', upper, 0.45);
        this.addSurfaceNode('upper_2', upper, 1.00);

        this.addSurfaceNode('high_0', high, 0.00);
        this.addSurfaceNode('high_1', high, 0.45);
        this.addSurfaceNode('high_2', high, 1.00);


        this.connect('root_0', 'root_1');
        this.connect('root_1', 'root_2');
        this.connect('root_2', 'root_3');
        this.connect('root_3', 'root_4');
        this.connect('root_4', 'root_5');


        this.connect('root_2', 'upper_0');
        this.connect('upper_0', 'upper_1');
        this.connect('upper_1', 'upper_2');


        this.connect('root_3', 'high_0');
        this.connect('high_0', 'high_1');
        this.connect('high_1', 'high_2');
    }


    addSurfaceNode(id, surface, t, options = {}) {

        const point = surface.getPoint(t);

        const node = this.navigation.addNode(
            id,
            {
                x: point.x,
                y: point.y,
                surface,
                t,
                radius: options.radius ?? 36,
                tags: options.tags ?? []
            }
        );

        return node;
    }


    connect(fromId, toId, options = {}) {

        return this.navigation.connect(
            fromId,
            toId,
            options
        );
    }


    createInteractions() {

        const root = this.getSurface('root');
        const upper = this.getSurface('upper');
        const high = this.getSurface('high');

        if (!root || !upper || !high) {
            return;
        }


        this.addInteraction(
            'bud',
            root,
            0.14,
            'Странный бутон'
        );

        this.addInteraction(
            'growth',
            root,
            0.34,
            'Светящийся нарост'
        );

        this.addInteraction(
            'eye',
            upper,
            0.58,
            'Маленький глаз'
        );

        this.addInteraction(
            'seed',
            high,
            0.58,
            'Странное семя'
        );

        this.addInteraction(
            'door',
            root,
            0.90,
            'Дверца'
        );
    }


    addInteraction(id, surface, t, label) {

        const position = surface.getPoint(t);

        const node = new InteractionNode({
            id,
            position,
            radius: 42,
            requiredDistance: 34,

            action: (context) => {

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
                surfaceId: surface.id,
                surfaceT: t
            }
        });

        this.interactionSystem.addNodeObject(node);

        return node;
    }


    handleInteraction(id, context) {

        switch (id) {

            case 'bud':
                this.questSystem.setFlag(
                    'bud_found',
                    true
                );

                this.questSystem.completeStep(
                    'astraway_intro',
                    'bud'
                );
                break;


            case 'growth':
                this.questSystem.setFlag(
                    'growth_found',
                    true
                );

                this.questSystem.completeStep(
                    'astraway_intro',
                    'growth'
                );
                break;


            case 'eye':
                this.questSystem.setFlag(
                    'eye_found',
                    true
                );

                this.questSystem.completeStep(
                    'astraway_intro',
                    'eye'
                );
                break;


            case 'seed':
                this.questSystem.setFlag(
                    'seed_found',
                    true
                );

                this.questSystem.completeStep(
                    'astraway_intro',
                    'seed'
                );
                break;


            case 'door':
                this.questSystem.setFlag(
                    'door_found',
                    true
                );

                this.questSystem.completeStep(
                    'astraway_intro',
                    'door'
                );
                break;


            default:
                break;
        }


        if (typeof this.onInteraction === 'function') {

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
                title: 'Путь открыт',

                steps: [
                    {
                        id: 'bud',
                        title: 'Найти бутон'
                    },
                    {
                        id: 'growth',
                        title: 'Исследовать нарост'
                    },
                    {
                        id: 'eye',
                        title: 'Посмотреть в глаз'
                    },
                    {
                        id: 'seed',
                        title: 'Найти семя'
                    },
                    {
                        id: 'door',
                        title: 'Найти дверцу'
                    }
                ]
            }
        );

        this.questSystem.startQuest(
            'astraway_intro'
        );
    }


    initializeCharacter() {

        const root = this.getSurface('root');

        if (!root) {
            throw new Error(
                'ASTRAWAY: главная поверхность отсутствует.'
            );
        }

        const startT = 0.05;

        const startPoint =
            root.getPoint(startT);

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

        this.character.stop();
    }


    update(dt) {

        if (
            !this.initialized ||
            !this.started
        ) {
            return;
        }

        this.character.update(dt);

        this.interactionSystem.update(dt);

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


    moveCharacterTo(worldPoint) {

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

        this.character.setPath(path);

        return true;
    }


    interactAt(worldPoint) {

        if (!worldPoint) {
            return false;
        }

        return this.interactionSystem
            .requestInteractionAt(
                worldPoint
            );
    }


    handleTap(worldPoint) {

        if (!worldPoint) {
            return false;
        }


        const interactionTarget =
            this.interactionSystem.findTarget(
                worldPoint
            );


        if (interactionTarget) {

            return this.interactionSystem
                .requestInteraction(
                    interactionTarget
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


    getSurfaces() {

        return [
            ...this.surfaces.values()
        ];
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

                const result =
                    surface.validate();

                if (result !== true) {

                    errors.push({
                        type: 'surface',
                        id: surface.id,
                        result
                    });
                }
            }
        }


        if (
            typeof this.navigation.validate ===
            'function'
        ) {

            const result =
                this.navigation.validate();

            if (result !== true) {

                errors.push({
                    type: 'navigation',
                    result
                });
            }
        }


        if (
            typeof this.character.validate ===
            'function'
        ) {

            const result =
                this.character.validate();

            if (result !== true) {

                errors.push({
                    type: 'character',
                    result
                });
            }
        }


        if (
            typeof this.interactionSystem.validate ===
            'function'
        ) {

            const result =
                this.interactionSystem.validate();

            if (result !== true) {

                errors.push({
                    type: 'interaction',
                    result
                });
            }
        }


        if (
            typeof this.questSystem.validate ===
            'function'
        ) {

            const result =
                this.questSystem.validate();

            if (result !== true) {

                errors.push({
                    type: 'quest',
                    result
                });
            }
        }


        return {
            valid: errors.length === 0,
            errors
        };
    }


    snapshot() {

        return {
            initialized: this.initialized,
            started: this.started,

            surfaces:
                this.getSurfaces()
                    .map(surface => {

                        return typeof surface.snapshot ===
                            'function'

                            ? surface.snapshot()

                            : {
                                id: surface.id,
                                name: surface.name
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


export function createWorld(options = {}) {

    const world =
        new World(options);

    world.initialize();

    return world;
}


export default World;
