import { Character } from '../character/Character.js';
import Surface from '../world/Surface.js';


export class World {

    constructor(options = {}) {

        /*
         * Размер пока условный.
         * Это больше не размер старой картинки дерева.
         */

        this.width =
            options.width ??
            1600;

        this.height =
            options.height ??
            2400;


        /*
         * Только одна нейтральная
         * лабораторная поверхность.
         *
         * Никаких старых маршрутов.
         */

        this.surfaces =
            new Map();


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


        this.started =
            false;

        this.initialized =
            false;
    }


    // =====================================================
    // INITIALIZE
    // =====================================================

    initialize() {

        if (this.initialized) {
            return;
        }


        this.createCharacterLab();


        this.initializeCharacter();


        this.initialized =
            true;
    }


    // =====================================================
    // CHARACTER LAB
    // =====================================================

    createCharacterLab() {

        /*
         * Нейтральный пол.
         *
         * Он существует только как
         * геометрия для Character/Gait.
         *
         * Renderer его НЕ рисует.
         *
         * Поэтому никаких линий,
         * маршрутов или старой сетки
         * на экране не будет.
         */

        const floor =
            new Surface({

                id:
                    'character_lab_floor',

                name:
                    'Character Lab Floor',

                width:
                    160,

                normalSide:
                    'left',

                points: [

                    {
                        x: -700,
                        y: 0
                    },

                    {
                        x: 700,
                        y: 0
                    }
                ]
            });


        this.surfaces.set(
            floor.id,
            floor
        );
    }


    // =====================================================
    // CHARACTER
    // =====================================================

    initializeCharacter() {

        const floor =
            this.surfaces.get(
                'character_lab_floor'
            );


        if (!floor) {

            throw new Error(
                'ASTRAWAY Character Lab: поверхность отсутствует.'
            );
        }


        const startT =
            0.5;


        const startPoint =
            floor.getPoint(
                startT
            );


        this.character.initialize(
            startPoint,
            floor,
            startT
        );
    }


    // =====================================================
    // START
    // =====================================================

    start() {

        if (!this.initialized) {
            this.initialize();
        }


        this.started =
            true;
    }


    // =====================================================
    // STOP
    // =====================================================

    stop() {

        this.started =
            false;


        if (
            this.character &&
            typeof this.character.stop ===
                'function'
        ) {

            this.character.stop();
        }
    }


    // =====================================================
    // UPDATE
    // =====================================================

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
    }


    // =====================================================
    // GETTERS
    // =====================================================

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


    getSurface(id) {

        return (
            this.surfaces.get(id) ??
            null
        );
    }


    // =====================================================
    // OLD NAVIGATION — REMOVED
    // =====================================================

    handleTap() {

        /*
         * Navigation removed.
         *
         * Позже здесь будет новый
         * interaction/traversal system.
         */

        return false;
    }


    // =====================================================
    // VALIDATION
    // =====================================================

    validate() {

        const errors = [];


        for (
            const surface
            of this.surfaces.values()
        ) {

            if (
                typeof surface.validate ===
                    'function' &&
                surface.validate() !== true
            ) {

                errors.push({
                    type:
                        'surface',

                    id:
                        surface.id
                });
            }
        }


        if (
            typeof this.character.validate ===
                'function'
        ) {

            const characterResult =
                this.character.validate();


            if (
                !characterResult.valid
            ) {

                errors.push({
                    type:
                        'character',

                    details:
                        characterResult
                });
            }
        }


        return {

            valid:
                errors.length === 0,

            errors
        };
    }


    // =====================================================
    // SNAPSHOT
    // =====================================================

    snapshot() {

        return {

            initialized:
                this.initialized,

            started:
                this.started,

            surfaces:
                this.getSurfaces()
                    .map(
                        surface =>
                            surface.snapshot()
                    ),

            character:
                typeof this.character.getState ===
                    'function'
                    ? this.character.getState()
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
