// ASTRAWAY 2.0
// Character Animation State Machine

import {
    clamp,
    finite
} from "./MathUtils.js";


export const ANIMATION_STATES = Object.freeze({

    IDLE: "idle",
    WALK: "walk",
    CLIMB: "climb",
    TURN: "turn",
    LOOK: "look",
    INTERACT: "interact",
    REACT: "react",
    JUMP: "jump",
    FALL: "fall"
});


export class AnimationStateMachine {

    constructor() {

        this.state =
            ANIMATION_STATES.IDLE;

        this.previousState =
            null;

        this.stateTime = 0;

        this.stateProgress = 0;

        this.locked = false;

        this.lockTime = 0;

        this.transitionSerial = 0;
    }


    update(dt) {

        const safeDt =
            Math.max(
                0,
                finite(dt, 0)
            );

        this.stateTime += safeDt;

        this.stateProgress =
            clamp(
                this.stateTime,
                0,
                1
            );


        if (this.locked) {

            this.lockTime =
                Math.max(
                    0,
                    this.lockTime - safeDt
                );

            if (this.lockTime <= 0) {

                this.locked = false;
            }
        }
    }


    canChange() {

        return !this.locked;
    }


    setState(
        nextState,
        options = {}
    ) {

        if (
            !Object.values(
                ANIMATION_STATES
            ).includes(nextState)
        ) {

            throw new Error(
                `Unknown animation state: ${nextState}`
            );
        }


        if (
            nextState === this.state &&
            !options.force
        ) {

            return false;
        }


        if (
            this.locked &&
            !options.force
        ) {

            return false;
        }


        this.previousState =
            this.state;

        this.state =
            nextState;

        this.stateTime = 0;

        this.stateProgress = 0;

        this.transitionSerial++;


        if (
            options.lockDuration !== undefined
        ) {

            this.lock(
                options.lockDuration
            );
        }


        return true;
    }


    lock(duration) {

        this.locked = true;

        this.lockTime =
            Math.max(
                0,
                finite(duration, 0)
            );

        if (this.lockTime <= 0) {

            this.locked = false;
        }
    }


    unlock() {

        this.locked = false;

        this.lockTime = 0;
    }


    is(state) {

        return this.state === state;
    }


    isAny(...states) {

        return states.includes(
            this.state
        );
    }


    getState() {

        return this.state;
    }


    getPreviousState() {

        return this.previousState;
    }


    getStateTime() {

        return this.stateTime;
    }


    getProgress() {

        return this.stateProgress;
    }


    reset() {

        this.state =
            ANIMATION_STATES.IDLE;

        this.previousState = null;

        this.stateTime = 0;

        this.stateProgress = 0;

        this.locked = false;

        this.lockTime = 0;

        this.transitionSerial = 0;
    }


    snapshot() {

        return {

            state: this.state,

            previousState:
                this.previousState,

            stateTime:
                this.stateTime,

            progress:
                this.stateProgress,

            locked:
                this.locked,

            lockTime:
                this.lockTime,

            transitionSerial:
                this.transitionSerial
        };
    }
}


export default AnimationStateMachine;
