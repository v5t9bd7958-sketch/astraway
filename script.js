// ===== ASTRA GAME ENGINE =====
// Telegram Mini App - Hidden Object Adventure

class AstraGame {
    constructor() {
        this.found = 0;
        this.total = 5;
        this.objectsFound = new Set();
        this.soundEnabled = true;
        this.trollState = 'idle';
        this.trollPos = { x: 50, y: 85 }; // Стартовая позиция (центр, у корней)
        this.isMoving = false;
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
        this.hintTimer = null;
        this.tapTimer = null;

        // Walkable зоны (проценты от фона)
        this.walkableZones = [
            // Центральный ствол
            { x1: 35, y1: 20, x2: 65, y2: 90 },
            // Левая ветка
            { x1: 5, y1: 50, x2: 40, y2: 65 },
            // Правая ветка
            { x1: 55, y1: 55, x2: 95, y2: 85 },
            // Верхние ветки
            { x1: 10, y1: 5, x2: 90, y2: 25 },
            // Нижние корни
            { x1: 5, y1: 80, x2: 95, y2: 95 }
        ];

        // Координаты объектов (проценты)
        this.objects = [
            { id: 'obj-1', x: 84, y: 78, name: 'Горшок' },
            { id: 'obj-2', x: 49, y: 48, name: 'Дверь' },
            { id: 'obj-3', x: 68, y: 21, name: 'Веточка' },
            { id: 'obj-4', x: 13, y: 85, name: 'Гриб' },
            { id: 'obj-5', x: 10, y: 11, name: 'Цветок' }
        ];

        this.init();
    }

    init() {
        this.setupTelegram();
        this.setupEventListeners();
        this.setupAudio();
        this.startTrollBehavior();
        this.updateCounter();
    }

    // ===== TELEGRAM INTEGRATION =====
    setupTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            const tg = Telegram.WebApp;
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();

            // Тема
            const theme = tg.colorScheme || 'dark';
            document.body.classList.add(theme);

            // Haptic feedback
            this.haptic = tg.HapticFeedback;
        }
    }

    // ===== AUDIO =====
    setupAudio() {
        this.audioCtx = null;
        this.sounds = {};

        // Инициализация по первому touch (iOS требование)
        document.addEventListener('touchstart', () => this.initAudio(), { once: true });
        document.addEventListener('click', () => this.initAudio(), { once: true });
    }

    initAudio() {
        if (this.audioCtx) return;

        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.loadSounds();
        } catch(e) {
            console.log('Audio not available');
        }
    }

    loadSounds() {
        // Генерация звуков через Web Audio API
        this.sounds.found = () => this.playTone(523, 0.3, 'sine'); // C5 - звон
        this.sounds.step = () => this.playTone(150, 0.1, 'triangle', 0.1); // Шаг
        this.sounds.tap = () => this.playTone(800, 0.15, 'square', 0.2); // Стук
        this.sounds.win = () => this.playMelody([523, 659, 784, 1047], 0.5); // Победа
        this.sounds.hint = () => this.playTone(400, 0.2, 'sine', 0.15); // Подсказка
        this.sounds.portal = () => this.playDrone(200, 300, 2); // Портал
    }

    playTone(freq, duration, type = 'sine', volume = 0.3) {
        if (!this.audioCtx || !this.soundEnabled) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    playMelody(notes, duration) {
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, duration, 'sine', 0.3), i * 200);
        });
    }

    playDrone(low, high, duration) {
        if (!this.audioCtx || !this.soundEnabled) return;

        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(low, this.audioCtx.currentTime);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(high, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.audioCtx.currentTime + duration);
        osc2.stop(this.audioCtx.currentTime + duration);
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Стартовый экран
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());

        // Клик/тап по фону - движение тролля
        document.getElementById('game-container').addEventListener('click', (e) => this.handleTap(e));
        document.getElementById('game-container').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTap(e.touches[0]);
        }, { passive: false });

        // Объекты
        this.objects.forEach(obj => {
            const el = document.getElementById(obj.id);
            if (el) {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.findObject(obj.id);
                });
            }
        });

        // UI кнопки
        document.getElementById('hint-button').addEventListener('click', () => this.showHint());
        document.getElementById('sound-toggle').addEventListener('click', () => this.toggleSound());
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
    }

    // ===== GAME LOGIC =====
    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        this.initAudio();
        this.showSpeech(this.hints[0], 4000);
        this.startBackgroundMusic();
    }

    handleTap(e) {
        if (this.isMoving) return;

        const container = document.getElementById('game-container');
        const rect = container.getBoundingClientRect();

        const x = ((e.clientX || e.pageX) - rect.left) / rect.width * 100;
        const y = ((e.clientY || e.pageY) - rect.top) / rect.height * 100;

        // Проверяем, что точка в walkable-зоне
        const nearestPoint = this.findNearestWalkable(x, y);
        if (nearestPoint) {
            this.moveTrollTo(nearestPoint.x, nearestPoint.y);
        }
    }

    findNearestWalkable(x, y) {
        // Проверяем, попадает ли точка в какую-либо зону
        for (const zone of this.walkableZones) {
            if (x >= zone.x1 && x <= zone.x2 && y >= zone.y1 && y <= zone.y2) {
                return { x, y };
            }
        }

        // Если не попала - ищем ближайшую точку на границе зон
        let nearest = null;
        let minDist = Infinity;

        for (const zone of this.walkableZones) {
            const cx = Math.max(zone.x1, Math.min(x, zone.x2));
            const cy = Math.max(zone.y1, Math.min(y, zone.y2));
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

            if (dist < minDist) {
                minDist = dist;
                nearest = { x: cx, y: cy };
            }
        }

        return nearest;
    }

    moveTrollTo(targetX, targetY) {
        if (this.isMoving) return;
        this.isMoving = true;

        const troll = document.getElementById('troll');
        const startX = this.trollPos.x;
        const startY = this.trollPos.y;

        // Расстояние и время
        const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
        const duration = Math.min(dist * 15, 1500); // макс 1.5 сек

        // Направление (для зеркалирования)
        const facingRight = targetX > startX;
        troll.style.transform = `translate(-50%, -100%) scaleX(${facingRight ? 1 : -1})`;

        // Анимация ходьбы
        this.setTrollState('walking');
        this.playStepSound();

        // Движение
        troll.style.transition = `left ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), top ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        troll.style.left = targetX + '%';
        troll.style.top = targetY + '%';

        this.trollPos = { x: targetX, y: targetY };

        setTimeout(() => {
            this.isMoving = false;
            this.setTrollState('idle');
            this.checkNearbyObjects();
        }, duration);
    }

    playStepSound() {
        if (!this.soundEnabled) return;
        const steps = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < steps; i++) {
            setTimeout(() => {
                if (this.sounds.step) this.sounds.step();
            }, i * 250);
        }
    }

    setTrollState(state) {
        const troll = document.getElementById('troll');
        troll.classList.remove('troll-idle', 'troll-walking', 'troll-tapping', 'troll-talking', 'troll-jumping');
        troll.classList.add(`troll-${state}`);
        this.trollState = state;
    }

    checkNearbyObjects() {
        // Проверяем, рядом ли тролль с ненайденными объектами
        const threshold = 12; // % от экрана

        this.objects.forEach(obj => {
            if (this.objectsFound.has(obj.id)) return;

            const dist = Math.sqrt((this.trollPos.x - obj.x) ** 2 + (this.trollPos.y - obj.y) ** 2);

            if (dist < threshold) {
                this.showSpeech(`Ты близко! ${obj.name} где-то рядом...`, 2500);
                this.createHintRing(obj.x, obj.y);
            }
        });
    }

    findObject(objId) {
        if (this.objectsFound.has(objId)) return;

        const obj = this.objects.find(o => o.id === objId);
        if (!obj) return;

        // Проверяем расстояние
        const dist = Math.sqrt((this.trollPos.x - obj.x) ** 2 + (this.trollPos.y - obj.y) ** 2);

        if (dist > 15) {
            // Слишком далеко - тролль идёт к объекту
            this.moveTrollTo(obj.x, obj.y);
            setTimeout(() => this.findObject(objId), 1000);
            return;
        }

        // Нашли!
        this.objectsFound.add(objId);
        this.found++;

        // Визуальные эффекты
        const el = document.getElementById(objId);
        el.classList.add('found');
        this.createParticles(obj.x, obj.y);

        // Звук
        if (this.sounds.found) this.sounds.found();
        if (this.haptic) this.haptic.notificationOccurred('success');

        // Обновление UI
        this.updateCounter();

        // Реплика тролля
        const messages = [
            `Нашёл ${obj.name}! ✨`,
            `Отлично! ${obj.name} обнаружен!`,
            `Ещё один артефакт!`,
            `Великолепно! ${obj.name}!`
        ];
        this.showSpeech(messages[Math.floor(Math.random() * messages.length)], 2500);

        // Проверка победы
        if (this.found >= this.total) {
            setTimeout(() => this.triggerVictory(), 1500);
        }
    }

    createParticles(x, y) {
        const container = document.getElementById('game-container');

        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = x + '%';
            particle.style.top = y + '%';
            particle.style.background = `hsl(${Math.random() * 60 + 40}, 100%, 70%)`;

            const angle = (Math.PI * 2 * i) / 12;
            const distance = 30 + Math.random() * 40;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance - 50;

            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            particle.style.animation = `particleFloat 1.5s ease-out forwards`;

            container.appendChild(particle);
            setTimeout(() => particle.remove(), 1500);
        }
    }

    createHintRing(x, y) {
        const container = document.getElementById('game-container');
        const ring = document.createElement('div');
        ring.className = 'hint-ring';
        ring.style.left = x + '%';
        ring.style.top = y + '%';
        ring.style.transform = 'translate(-50%, -50%)';

        container.appendChild(ring);
        setTimeout(() => ring.remove(), 1500);
    }

    updateCounter() {
        document.getElementById('found-count').textContent = this.found;
    }

    // ===== TROLL BEHAVIOR =====
    startTrollBehavior() {
        // Подсказки каждые 10 секунд
        this.hintTimer = setInterval(() => {
            if (this.found >= this.total) return;
            this.currentHint = (this.currentHint + 1) % this.hints.length;
            this.showSpeech(this.hints[this.currentHint], 3000);
        }, 10000);

        // Стук по экрану каждые 10 секунд
        this.tapTimer = setInterval(() => {
            if (this.isMoving || this.found >= this.total) return;
            this.trollTapScreen();
        }, 10000);
    }

    trollTapScreen() {
        if (this.trollState !== 'idle') return;

        this.setTrollState('tapping');
        if (this.sounds.tap) this.sounds.tap();

        setTimeout(() => {
            if (this.trollState === 'tapping') {
                this.setTrollState('idle');
            }
        }, 2000);
    }

    showSpeech(text, duration = 3000) {
        const bubble = document.getElementById('speech-bubble');
        const bubbleText = bubble.querySelector('.bubble-text');

        bubbleText.textContent = text;
        bubble.classList.add('visible');

        if (this.sounds.hint) this.sounds.hint();

        setTimeout(() => {
            bubble.classList.remove('visible');
        }, duration);
    }

    showHint() {
        if (this.found >= this.total) return;

        // Находим ближайший ненайденный объект
        let nearest = null;
        let minDist = Infinity;

        this.objects.forEach(obj => {
            if (this.objectsFound.has(obj.id)) return;
            const dist = Math.sqrt((this.trollPos.x - obj.x) ** 2 + (this.trollPos.y - obj.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearest = obj;
            }
        });

        if (nearest) {
            this.createHintRing(nearest.x, nearest.y);
            this.showSpeech(`Ищи ${nearest.name}!`, 2000);
            this.moveTrollTo(nearest.x, nearest.y);
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const btn = document.getElementById('sound-toggle');
        btn.textContent = this.soundEnabled ? '🔊' : '🔇';
    }

    // ===== VICTORY =====
    triggerVictory() {
        // Открываем портал
        const portal = document.getElementById('portal');
        portal.classList.add('visible');
        if (this.sounds.portal) this.sounds.portal();

        // Тролль идёт к порталу
        this.moveTrollTo(50, 15);

        setTimeout(() => {
            // Финальная анимация - прыжок
            this.setTrollState('jumping');
            if (this.sounds.win) this.sounds.win();
            if (this.haptic) this.haptic.notificationOccurred('success');

            setTimeout(() => {
                document.getElementById('victory-screen').classList.remove('hidden');
            }, 2000);
        }, 2000);
    }

    // ===== BACKGROUND MUSIC =====
    startBackgroundMusic() {
        if (!this.audioCtx || !this.soundEnabled) return;

        // Простая фоновая мелодия
        const notes = [262, 330, 392, 330, 262, 294, 349, 294]; // C E G E C D F D
        let noteIndex = 0;

        this.bgMusicInterval = setInterval(() => {
            if (!this.soundEnabled) return;
            this.playTone(notes[noteIndex], 0.8, 'sine', 0.08);
            noteIndex = (noteIndex + 1) % notes.length;
        }, 1200);
    }

    // ===== RESTART =====
    restart() {
        this.found = 0;
        this.objectsFound.clear();
        this.objects.forEach(obj => {
            const el = document.getElementById(obj.id);
            if (el) el.classList.remove('found');
        });

        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('portal').classList.remove('visible');

        this.trollPos = { x: 50, y: 85 };
        const troll = document.getElementById('troll');
        troll.style.left = '50%';
        troll.style.top = '85%';
        troll.style.transform = 'translate(-50%, -100%)';
        this.setTrollState('idle');

        this.updateCounter();
        this.showSpeech(this.hints[0], 3000);
    }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    window.game = new AstraGame();
});
