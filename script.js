// ============================================================
// ASTRA GAME ENGINE
// Telegram Mini App - Hidden Object Adventure
// Mobile-safe input version
// ============================================================

class AstraGame {
    constructor() {
        // ===== GAME STATE =====
        this.found = 0;
        this.total = 5;
        this.objectsFound = new Set();

        this.soundEnabled = true;
        this.audioCtx = null;
        this.sounds = {};
        this.bgMusicInterval = null;

        // ===== TROLL STATE =====
        this.trollState = 'idle';
        this.trollPos = {
            x: 50,
            y: 85
        };
        this.isMoving = false;

        // ===== TIMERS =====
        this.hintTimer = null;
        this.tapTimer = null;

        // ===== HINTS =====
        this.hints = [
            "Привет! Я твой проводник. Найди 5 артефактов!",
            "Смотри внимательно... артефакты спрятаны в дереве.",
            "Кликай по экрану — я подойду и проверю!",
            "Веточка прячется высоко...",
            "Дверь в дупле — ключ к тайне!",
            "Горшок на правой ветке ждёт...",
            "Синий гриб внизу слева — найди его!",
            "Розовый цветок наверху слева...",
            "Осталось совсем немного!",
            "Портал откроется, когда всё найдёшь!"
        ];

        this.currentHint = 0;

        // ===== WALKABLE ZONES =====
        this.walkableZones = [
            // Центральный ствол
            {
                x1: 35,
                y1: 20,
                x2: 65,
                y2: 90
            },

            // Левая ветка
            {
                x1: 5,
                y1: 50,
                x2: 40,
                y2: 65
            },

            // Правая ветка
            {
                x1: 55,
                y1: 55,
                x2: 95,
                y2: 85
            },

            // Верхние ветки
            {
                x1: 10,
                y1: 5,
                x2: 90,
                y2: 25
            },

            // Нижние корни
            {
                x1: 5,
                y1: 80,
                x2: 95,
                y2: 95
            }
        ];

        // ===== OBJECTS =====
        this.objects = [
            {
                id: 'obj-1',
                x: 84,
                y: 78,
                name: 'Горшок'
            },
            {
                id: 'obj-2',
                x: 49,
                y: 48,
                name: 'Дверь'
            },
            {
                id: 'obj-3',
                x: 68,
                y: 21,
                name: 'Веточка'
            },
            {
                id: 'obj-4',
                x: 13,
                y: 85,
                name: 'Гриб'
            },
            {
                id: 'obj-5',
                x: 10,
                y: 11,
                name: 'Цветок'
            }
        ];

        this.init();
    }

    // ============================================================
    // INIT
    // ============================================================

    init() {
        this.setupTelegram();
        this.setupEventListeners();
        this.setupAudio();
        this.startTrollBehavior();
        this.updateCounter();
    }

    // ============================================================
    // TELEGRAM
    // ============================================================

    setupTelegram() {
        if (
            window.Telegram &&
            window.Telegram.WebApp
        ) {
            const tg = window.Telegram.WebApp;

            try {
                tg.ready();
                tg.expand();

                if (typeof tg.enableClosingConfirmation === 'function') {
                    tg.enableClosingConfirmation();
                }

                const theme = tg.colorScheme || 'dark';

                document.body.classList.add(theme);

                this.haptic = tg.HapticFeedback || null;
            } catch (error) {
                console.log('Telegram WebApp initialization skipped.');
            }
        }
    }

    // ============================================================
    // AUDIO
    // ============================================================

    setupAudio() {
        this.audioCtx = null;
        this.sounds = {};

        // ВАЖНО:
        // Здесь НЕТ preventDefault().
        // iOS требует пользовательского жеста для запуска AudioContext,
        // поэтому достаточно обычного touch/click события.

        const initAudioOnce = () => {
            this.initAudio();
        };

        document.addEventListener(
            'touchstart',
            initAudioOnce,
            {
                once: true,
                passive: true
            }
        );

        document.addEventListener(
            'click',
            initAudioOnce,
            {
                once: true
            }
        );
    }

    initAudio() {
        if (this.audioCtx) {
            return;
        }

        try {
            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContextClass) {
                return;
            }

            this.audioCtx = new AudioContextClass();

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }

            this.loadSounds();
        } catch (error) {
            console.log('Audio not available');
            this.audioCtx = null;
        }
    }

    loadSounds() {
        this.sounds.found = () => {
            this.playTone(
                523,
                0.3,
                'sine'
            );
        };

        this.sounds.step = () => {
            this.playTone(
                150,
                0.1,
                'triangle',
                0.1
            );
        };

        this.sounds.tap = () => {
            this.playTone(
                800,
                0.15,
                'square',
                0.2
            );
        };

        this.sounds.win = () => {
            this.playMelody(
                [523, 659, 784, 1047],
                0.5
            );
        };

        this.sounds.hint = () => {
            this.playTone(
                400,
                0.2,
                'sine',
                0.15
            );
        };

        this.sounds.portal = () => {
            this.playDrone(
                200,
                300,
                2
            );
        };
    }

    playTone(
        freq,
        duration,
        type = 'sine',
        volume = 0.3
    ) {
        if (
            !this.audioCtx ||
            !this.soundEnabled
        ) {
            return;
        }

        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }

            const osc =
                this.audioCtx.createOscillator();

            const gain =
                this.audioCtx.createGain();

            const now =
                this.audioCtx.currentTime;

            osc.type = type;

            osc.frequency.setValueAtTime(
                freq,
                now
            );

            gain.gain.setValueAtTime(
                volume,
                now
            );

            gain.gain.exponentialRampToValueAtTime(
                0.01,
                now + duration
            );

            osc.connect(gain);
            gain.connect(
                this.audioCtx.destination
            );

            osc.start(now);
            osc.stop(
                now + duration
            );
        } catch (error) {
            // Audio failure must never stop the game.
        }
    }

    playMelody(notes, duration) {
        if (!this.audioCtx || !this.soundEnabled) {
            return;
        }

        notes.forEach((note, index) => {
            setTimeout(() => {
                this.playTone(
                    note,
                    duration,
                    'sine',
                    0.3
                );
            }, index * 200);
        });
    }

    playDrone(
        low,
        high,
        duration
    ) {
        if (
            !this.audioCtx ||
            !this.soundEnabled
        ) {
            return;
        }

        try {
            const osc1 =
                this.audioCtx.createOscillator();

            const osc2 =
                this.audioCtx.createOscillator();

            const gain =
                this.audioCtx.createGain();

            const now =
                this.audioCtx.currentTime;

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(
                low,
                now
            );

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(
                high,
                now
            );

            gain.gain.setValueAtTime(
                0.2,
                now
            );

            gain.gain.exponentialRampToValueAtTime(
                0.01,
                now + duration
            );

            osc1.connect(gain);
            osc2.connect(gain);

            gain.connect(
                this.audioCtx.destination
            );

            osc1.start(now);
            osc2.start(now);

            osc1.stop(
                now + duration
            );

            osc2.stop(
                now + duration
            );
        } catch (error) {
            // Ignore audio errors.
        }
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

    setupEventListeners() {
        const startButton =
            document.getElementById('start-btn');

        const backgroundLayer =
            document.getElementById('background-layer');

        const hintButton =
            document.getElementById('hint-button');

        const soundButton =
            document.getElementById('sound-toggle');

        const restartButton =
            document.getElementById('restart-btn');

        // --------------------------------------------------------
        // START
        // --------------------------------------------------------

        if (startButton) {
            startButton.addEventListener(
                'click',
                (event) => {
                    event.stopPropagation();
                    this.startGame();
                }
            );
        }

        // --------------------------------------------------------
        // MOVEMENT
        // --------------------------------------------------------
        //
        // КЛЮЧЕВАЯ ИСПРАВЛЕННАЯ ЧАСТЬ.
        //
        // Раньше touchstart висел на game-container
        // и делал preventDefault().
        //
        // На iPhone это могло подавлять последующий click
        // стартовой кнопки.
        //
        // Теперь движение получает только background-layer.
        // Кнопки и объекты находятся поверх него и не конфликтуют.
        //

        if (backgroundLayer) {
            backgroundLayer.addEventListener(
                'pointerup',
                (event) => {
                    if (
                        event.pointerType === 'mouse' &&
                        event.button !== 0
                    ) {
                        return;
                    }

                    this.handleTap(event);
                }
            );
        }

        // --------------------------------------------------------
        // OBJECTS
        // --------------------------------------------------------

        this.objects.forEach((obj) => {
            const element =
                document.getElementById(obj.id);

            if (!element) {
                return;
            }

            element.addEventListener(
                'click',
                (event) => {
                    event.stopPropagation();
                    this.findObject(obj.id);
                }
            );

            // Для мобильного устройства:
            // pointerup также должен работать,
            // но не вызываем findObject дважды.
            element.addEventListener(
                'pointerup',
                (event) => {
                    event.stopPropagation();
                }
            );
        });

        // --------------------------------------------------------
        // UI
        // --------------------------------------------------------

        if (hintButton) {
            hintButton.addEventListener(
                'click',
                (event) => {
                    event.stopPropagation();
                    this.showHint();
                }
            );
        }

        if (soundButton) {
            soundButton.addEventListener(
                'click',
                (event) => {
                    event.stopPropagation();
                    this.toggleSound();
                }
            );
        }

        if (restartButton) {
            restartButton.addEventListener(
                'click',
                (event) => {
                    event.stopPropagation();
                    this.restart();
                }
            );
        }
    }

    // ============================================================
    // START GAME
    // ============================================================

    startGame() {
        const startScreen =
            document.getElementById('start-screen');

        if (startScreen) {
            startScreen.classList.add('hidden');
        }

        this.initAudio();

        this.showSpeech(
            this.hints[0],
            4000
        );

        this.startBackgroundMusic();
    }

    // ============================================================
    // INPUT / MOVEMENT
    // ============================================================

    handleTap(event) {
        if (this.isMoving) {
            return;
        }

        if (!event) {
            return;
        }

        const container =
            document.getElementById('game-container');

        if (!container) {
            return;
        }

        const rect =
            container.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return;
        }

        const clientX =
            typeof event.clientX === 'number'
                ? event.clientX
                : null;

        const clientY =
            typeof event.clientY === 'number'
                ? event.clientY
                : null;

        if (
            clientX === null ||
            clientY === null
        ) {
            return;
        }

        const x =
            ((clientX - rect.left) /
                rect.width) *
            100;

        const y =
            ((clientY - rect.top) /
                rect.height) *
            100;

        const safeX =
            Math.max(
                0,
                Math.min(100, x)
            );

        const safeY =
            Math.max(
                0,
                Math.min(100, y)
            );

        const nearestPoint =
            this.findNearestWalkable(
                safeX,
                safeY
            );

        if (nearestPoint) {
            this.moveTrollTo(
                nearestPoint.x,
                nearestPoint.y
            );
        }
    }

    findNearestWalkable(x, y) {
        // Сначала проверяем прямое попадание.
        for (const zone of this.walkableZones) {
            if (
                x >= zone.x1 &&
                x <= zone.x2 &&
                y >= zone.y1 &&
                y <= zone.y2
            ) {
                return {
                    x,
                    y
                };
            }
        }

        // Если точка вне зон —
        // ищем ближайшую точку на границе.
        let nearest = null;
        let minDist = Infinity;

        for (const zone of this.walkableZones) {
            const cx =
                Math.max(
                    zone.x1,
                    Math.min(
                        x,
                        zone.x2
                    )
                );

            const cy =
                Math.max(
                    zone.y1,
                    Math.min(
                        y,
                        zone.y2
                    )
                );

            const dx =
                x - cx;

            const dy =
                y - cy;

            const dist =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );

            if (dist < minDist) {
                minDist = dist;

                nearest = {
                    x: cx,
                    y: cy
                };
            }
        }

        return nearest;
    }

    // ============================================================
    // TROLL MOVEMENT
    // ============================================================

    moveTrollTo(
        targetX,
        targetY
    ) {
        if (this.isMoving) {
            return;
        }

        const troll =
            document.getElementById('troll');

        if (!troll) {
            return;
        }

        this.isMoving = true;

        const startX =
            this.trollPos.x;

        const startY =
            this.trollPos.y;

        const dx =
            targetX - startX;

        const dy =
            targetY - startY;

        const dist =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        // Если практически никуда не идём.
        if (dist < 0.5) {
            this.isMoving = false;
            this.setTrollState('idle');
            this.checkNearbyObjects();
            return;
        }

        const duration =
            Math.min(
                Math.max(
                    dist * 15,
                    250
                ),
                1500
            );

        // Направление.
        if (Math.abs(dx) > 0.5) {
            const facingRight =
                targetX > startX;

            troll.style.transform =
                `translate(-50%, -100%) scaleX(${facingRight ? 1 : -1})`;
        }

        this.setTrollState(
            'walking'
        );

        this.playStepSound();

        troll.style.transition =
            `left ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), ` +
            `top ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;

        troll.style.left =
            targetX + '%';

        troll.style.top =
            targetY + '%';

        this.trollPos = {
            x: targetX,
            y: targetY
        };

        setTimeout(() => {
            this.isMoving = false;

            this.setTrollState(
                'idle'
            );

            this.checkNearbyObjects();
        }, duration);
    }

    playStepSound() {
        if (!this.soundEnabled) {
            return;
        }

        const steps =
            Math.floor(
                Math.random() * 3
            ) + 3;

        for (
            let i = 0;
            i < steps;
            i++
        ) {
            setTimeout(() => {
                if (
                    this.sounds.step
                ) {
                    this.sounds.step();
                }
            }, i * 250);
        }
    }

    setTrollState(state) {
        const troll =
            document.getElementById('troll');

        if (!troll) {
            return;
        }

        troll.classList.remove(
            'troll-idle',
            'troll-walking',
            'troll-tapping',
            'troll-talking',
            'troll-jumping'
        );

        troll.classList.add(
            `troll-${state}`
        );

        this.trollState = state;
    }

    // ============================================================
    // OBJECT DETECTION
    // ============================================================

    checkNearbyObjects() {
        const threshold = 12;

        this.objects.forEach(
            (obj) => {
                if (
                    this.objectsFound.has(
                        obj.id
                    )
                ) {
                    return;
                }

                const dx =
                    this.trollPos.x -
                    obj.x;

                const dy =
                    this.trollPos.y -
                    obj.y;

                const dist =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );

                if (
                    dist < threshold
                ) {
                    this.showSpeech(
                        `Ты близко! ${obj.name} где-то рядом...`,
                        2500
                    );

                    this.createHintRing(
                        obj.x,
                        obj.y
                    );
                }
            }
        );
    }

    findObject(objId) {
        if (
            this.objectsFound.has(
                objId
            )
        ) {
            return;
        }

        const obj =
            this.objects.find(
                (item) =>
                    item.id === objId
            );

        if (!obj) {
            return;
        }

        const dx =
            this.trollPos.x -
            obj.x;

        const dy =
            this.trollPos.y -
            obj.y;

        const dist =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        if (dist > 15) {
            this.moveTrollTo(
                obj.x,
                obj.y
            );

            setTimeout(() => {
                this.findObject(
                    objId
                );
            }, 1000);

            return;
        }

        // --------------------------------------------------------
        // OBJECT FOUND
        // --------------------------------------------------------

        this.objectsFound.add(
            objId
        );

        this.found++;

        const element =
            document.getElementById(
                objId
            );

        if (element) {
            element.classList.add(
                'found'
            );
        }

        this.createParticles(
            obj.x,
            obj.y
        );

        if (this.sounds.found) {
            this.sounds.found();
        }

        if (
            this.haptic &&
            typeof this.haptic.notificationOccurred === 'function'
        ) {
            try {
                this.haptic.notificationOccurred(
                    'success'
                );
            } catch (error) {}
        }

        this.updateCounter();

        const messages = [
            `Нашёл ${obj.name}! ✨`,
            `Отлично! ${obj.name} обнаружен!`,
            `Ещё один артефакт!`,
            `Великолепно! ${obj.name}!`
        ];

        const message =
            messages[
                Math.floor(
                    Math.random() *
                    messages.length
                )
            ];

        this.showSpeech(
            message,
            2500
        );

        if (
            this.found >=
            this.total
        ) {
            setTimeout(
                () => {
                    this.triggerVictory();
                },
                1500
            );
        }
    }

    // ============================================================
    // PARTICLES
    // ============================================================

    createParticles(x, y) {
        const container =
            document.getElementById(
                'game-container'
            );

        if (!container) {
            return;
        }

        for (
            let i = 0;
            i < 12;
            i++
        ) {
            const particle =
                document.createElement(
                    'div'
                );

            particle.className =
                'particle';

            particle.style.left =
                x + '%';

            particle.style.top =
                y + '%';

            particle.style.background =
                `hsl(${Math.random() * 60 + 40}, 100%, 70%)`;

            const angle =
                (Math.PI * 2 * i) /
                12;

            const distance =
                30 +
                Math.random() * 40;

            const tx =
                Math.cos(angle) *
                distance;

            const ty =
                Math.sin(angle) *
                distance -
                50;

            particle.style.setProperty(
                '--tx',
                tx + 'px'
            );

            particle.style.setProperty(
                '--ty',
                ty + 'px'
            );

            particle.style.animation =
                'particleFloat 1.5s ease-out forwards';

            container.appendChild(
                particle
            );

            setTimeout(() => {
                particle.remove();
            }, 1500);
        }
    }

    // ============================================================
    // HINT RING
    // ============================================================

    createHintRing(x, y) {
        const container =
            document.getElementById(
                'game-container'
            );

        if (!container) {
            return;
        }

        const ring =
            document.createElement(
                'div'
            );

        ring.className =
            'hint-ring';

        ring.style.left =
            x + '%';

        ring.style.top =
            y + '%';

        ring.style.transform =
            'translate(-50%, -50%)';

        container.appendChild(
            ring
        );

        setTimeout(() => {
            ring.remove();
        }, 1500);
    }

    // ============================================================
    // COUNTER
    // ============================================================

    updateCounter() {
        const counter =
            document.getElementById(
                'found-count'
            );

        if (counter) {
            counter.textContent =
                this.found;
        }
    }

    // ============================================================
    // TROLL AUTONOMOUS BEHAVIOR
    // ============================================================

    startTrollBehavior() {
        if (this.hintTimer) {
            clearInterval(
                this.hintTimer
            );
        }

        if (this.tapTimer) {
            clearInterval(
                this.tapTimer
            );
        }

        // Подсказки каждые 10 секунд.
        this.hintTimer =
            setInterval(() => {
                if (
                    this.found >=
                    this.total
                ) {
                    return;
                }

                this.currentHint =
                    (
                        this.currentHint +
                        1
                    ) %
                    this.hints.length;

                this.showSpeech(
                    this.hints[
                        this.currentHint
                    ],
                    3000
                );
            }, 10000);

        // Стук каждые 10 секунд.
        this.tapTimer =
            setInterval(() => {
                if (
                    this.isMoving ||
                    this.found >=
                    this.total
                ) {
                    return;
                }

                this.trollTapScreen();
            }, 10000);
    }

    trollTapScreen() {
        if (
            this.trollState !==
            'idle'
        ) {
            return;
        }

        this.setTrollState(
            'tapping'
        );

        if (this.sounds.tap) {
            this.sounds.tap();
        }

        setTimeout(() => {
            if (
                this.trollState ===
                'tapping'
            ) {
                this.setTrollState(
                    'idle'
                );
            }
        }, 2000);
    }

    // ============================================================
    // SPEECH
    // ============================================================

    showSpeech(
        text,
        duration = 3000
    ) {
        const bubble =
            document.getElementById(
                'speech-bubble'
            );

        if (!bubble) {
            return;
        }

        const bubbleText =
            bubble.querySelector(
                '.bubble-text'
            );

        if (!bubbleText) {
            return;
        }

        bubbleText.textContent =
            text;

        bubble.classList.add(
            'visible'
        );

        if (this.sounds.hint) {
            this.sounds.hint();
        }

        setTimeout(() => {
            bubble.classList.remove(
                'visible'
            );
        }, duration);
    }

    // ============================================================
    // HINT BUTTON
    // ============================================================

    showHint() {
        if (
            this.found >=
            this.total
        ) {
            return;
        }

        let nearest = null;
        let minDist = Infinity;

        this.objects.forEach(
            (obj) => {
                if (
                    this.objectsFound.has(
                        obj.id
                    )
                ) {
                    return;
                }

                const dx =
                    this.trollPos.x -
                    obj.x;

                const dy =
                    this.trollPos.y -
                    obj.y;

                const dist =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );

                if (
                    dist < minDist
                ) {
                    minDist = dist;
                    nearest = obj;
                }
            }
        );

        if (!nearest) {
            return;
        }

        this.createHintRing(
            nearest.x,
            nearest.y
        );

        this.showSpeech(
            `Ищи ${nearest.name}!`,
            2000
        );

        this.moveTrollTo(
            nearest.x,
            nearest.y
        );
    }

    // ============================================================
    // SOUND TOGGLE
    // ============================================================

    toggleSound() {
        this.soundEnabled =
            !this.soundEnabled;

        const button =
            document.getElementById(
                'sound-toggle'
            );

        if (button) {
            button.textContent =
                this.soundEnabled
                    ? '🔊'
                    : '🔇';
        }

        if (
            this.soundEnabled &&
            !this.audioCtx
        ) {
            this.initAudio();
        }
    }

    // ============================================================
    // VICTORY
    // ============================================================

    triggerVictory() {
        const portal =
            document.getElementById(
                'portal'
            );

        if (portal) {
            portal.classList.add(
                'visible'
            );
        }

        if (this.sounds.portal) {
            this.sounds.portal();
        }

        this.moveTrollTo(
            50,
            15
        );

        setTimeout(() => {
            this.setTrollState(
                'jumping'
            );

            if (this.sounds.win) {
                this.sounds.win();
            }

            if (
                this.haptic &&
                typeof this.haptic.notificationOccurred === 'function'
            ) {
                try {
                    this.haptic.notificationOccurred(
                        'success'
                    );
                } catch (error) {}
            }

            setTimeout(() => {
                const victoryScreen =
                    document.getElementById(
                        'victory-screen'
                    );

                if (victoryScreen) {
                    victoryScreen.classList.remove(
                        'hidden'
                    );
                }
            }, 2000);
        }, 2000);
    }

    // ============================================================
    // BACKGROUND MUSIC
    // ============================================================

    startBackgroundMusic() {
        if (
            !this.audioCtx ||
            !this.soundEnabled
        ) {
            return;
        }

        // Не создаём несколько музыкальных таймеров.
        if (this.bgMusicInterval) {
            return;
        }

        const notes = [
            262,
            330,
            392,
            330,
            262,
            294,
            349,
            294
        ];

        let noteIndex = 0;

        this.bgMusicInterval =
            setInterval(() => {
                if (
                    !this.soundEnabled
                ) {
                    return;
                }

                this.playTone(
                    notes[noteIndex],
                    0.8,
                    'sine',
                    0.08
                );

                noteIndex =
                    (
                        noteIndex + 1
                    ) %
                    notes.length;
            }, 900);
    }

    // ============================================================
    // RESTART
    // ============================================================

    restart() {
        // Останавливаем старую музыку.
        if (this.bgMusicInterval) {
            clearInterval(
                this.bgMusicInterval
            );

            this.bgMusicInterval =
                null;
        }

        // Сбрасываем состояние.
        this.found = 0;
        this.objectsFound.clear();

        this.currentHint = 0;

        this.isMoving = false;

        this.trollPos = {
            x: 50,
            y: 85
        };

        this.trollState =
            'idle';

        // Сбрасываем объекты.
        this.objects.forEach(
            (obj) => {
                const element =
                    document.getElementById(
                        obj.id
                    );

                if (element) {
                    element.classList.remove(
                        'found'
                    );
                }
            }
        );

        // Скрываем портал.
        const portal =
            document.getElementById(
                'portal'
            );

        if (portal) {
            portal.classList.remove(
                'visible'
            );
        }

        // Скрываем экран победы.
        const victoryScreen =
            document.getElementById(
                'victory-screen'
            );

        if (victoryScreen) {
            victoryScreen.classList.add(
                'hidden'
            );
        }

        // Возвращаем стартовую позицию.
        const troll =
            document.getElementById(
                'troll'
            );

        if (troll) {
            troll.style.transition =
                'none';

            troll.style.left =
                '50%';

            troll.style.top =
                '85%';

            troll.style.transform =
                'translate(-50%, -100%) scaleX(1)';
        }

        this.setTrollState(
            'idle'
        );

        this.updateCounter();

        // Возвращаем стартовый экран.
        const startScreen =
            document.getElementById(
                'start-screen'
            );

        if (startScreen) {
            startScreen.classList.remove(
                'hidden'
            );
        }

        // Новая игровая сессия.
        this.showSpeech(
            'Начнём сначала! 🌳',
            2500
        );
    }
}

// ============================================================
// BOOT
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {
        window.game =
            new AstraGame();
    }
);
