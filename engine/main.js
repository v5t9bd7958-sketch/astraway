import { Game } from './core/Game.js';
import { InputController } from './input/InputController.js';


const canvas = document.getElementById('game-canvas');

const startScreen = document.getElementById('start-screen');
const victoryScreen = document.getElementById('victory-screen');

const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

const message = document.getElementById('message');
const hintButton = document.getElementById('hint-button');
const soundButton = document.getElementById('sound-button');


if (!canvas) {
    throw new Error('ASTRAWAY: #game-canvas не найден.');
}


const game = new Game({
    canvas
});


const input = new InputController(
    canvas,
    game.getCamera()
);


function showMessage(text, duration = 1800) {

    if (!message) {
        return;
    }

    message.textContent = text;
    message.classList.add('visible');

    window.clearTimeout(
        showMessage.timer
    );

    showMessage.timer = window.setTimeout(() => {

        message.classList.remove('visible');

    }, duration);
}


function hideStartScreen() {

    if (!startScreen) {
        return;
    }

    startScreen.classList.add('hidden');
}


function showStartScreen() {

    if (!startScreen) {
        return;
    }

    startScreen.classList.remove('hidden');
}


function hideVictoryScreen() {

    if (!victoryScreen) {
        return;
    }

    victoryScreen.classList.add('hidden');
}


function showVictoryScreen() {

    if (!victoryScreen) {
        return;
    }

    victoryScreen.classList.remove('hidden');
}


function startGame() {

    hideStartScreen();
    hideVictoryScreen();

    game.start();

    input.setEnabled(true);

    showMessage(
        'Коснись ветви, чтобы идти.',
        2200
    );
}


function restartGame() {

    hideVictoryScreen();

    game.restart();

    input.setEnabled(true);
}


input.onTap = (tapData) => {

    if (!game.running) {
        return;
    }

    if (
        !tapData ||
        !tapData.world
    ) {
        return;
    }

    game.handleTap(
        tapData.world
    );
};


game.onReady = () => {

    input.setEnabled(false);

    game.setDebug(true);
};


game.onStart = () => {

    input.setEnabled(true);
};


game.onStop = () => {

    input.setEnabled(false);
};


game.onUpdate = () => {

    const quest =
        game.getWorld()
            .questSystem;

    if (!quest) {
        return;
    }


    if (
        quest.isQuestCompleted &&
        quest.isQuestCompleted('astraway_intro')
    ) {

        if (
            victoryScreen &&
            victoryScreen.classList.contains('hidden')
        ) {
            input.setEnabled(false);

            showVictoryScreen();
        }
    }
};


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


if (hintButton) {

    hintButton.addEventListener(
        'click',
        () => {

            showMessage(
                'Ищи места, где ветви ведут дальше.',
                2400
            );

        }
    );
}


if (soundButton) {

    let soundEnabled = true;

    soundButton.addEventListener(
        'click',
        () => {

            soundEnabled = !soundEnabled;

            soundButton.textContent =
                soundEnabled ? '♪' : '×';

            showMessage(
                soundEnabled
                    ? 'Звук включён.'
                    : 'Звук выключен.',
                1200
            );
        }
    );
}


window.astraway = {
    game,
    input
};


game.initialize();
