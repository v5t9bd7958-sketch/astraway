import { Game } from './core/Game.js';


const canvas =
    document.getElementById(
        'game-canvas'
    );


if (!canvas) {

    throw new Error(
        'ASTRAWAY: #game-canvas не найден.'
    );
}


const startScreen =
    document.getElementById(
        'start-screen'
    );


const startButton =
    document.getElementById(
        'start-button'
    );


const restartButton =
    document.getElementById(
        'restart-button'
    );


const game =
    new Game({
        canvas
    });


function hideStartScreen() {

    if (!startScreen) {
        return;
    }

    startScreen.classList.add(
        'hidden'
    );
}


function showStartScreen() {

    if (!startScreen) {
        return;
    }

    startScreen.classList.remove(
        'hidden'
    );
}


function startGame() {

    hideStartScreen();

    game.start();
}


function restartGame() {

    game.restart();
}


if (startButton) {

    startButton.addEventListener(
        'click',
        startGame
    );
}


if (restartButton) {

    restartButton.addEventListener(
        'click',
        restartGame
    );
}


game.onReady = () => {

    /*
     * Debug мира больше не существует.
     */

    game.setDebug(false);
};


game.onStart = () => {

    hideStartScreen();
};


game.onStop = () => {

    showStartScreen();
};


window.astraway = {
    game
};


game.initialize();
