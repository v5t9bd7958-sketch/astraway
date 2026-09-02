// ASTRAWAY 2.0
// Renderer
// World -> Camera -> Screen
export class Renderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas ?? null;
        if (!this.canvas) {
            throw new Error(
                'ASTRAWAY: Renderer требует canvas.'
            );
        }
        this.ctx =
            this.canvas.getContext('2d', {
                alpha: false
            });
        if (!this.ctx) {
            throw new Error(
                'ASTRAWAY: Canvas 2D context недоступен.'
            );
        }
        this.debug =
            options.debug === true;
        this.background =
            new Image();
        this.backgroundLoaded = false;
        this.backgroundError = false;
        this.backgroundSrc =
            './assets/background.jpg%20.jpeg';
        this.background.onload = () => {
            this.backgroundLoaded = true;
            this.backgroundError = false;
        };
        this.background.onerror = () => {
            this.backgroundLoaded = false;
            this.backgroundError = true;
        };
        this.background.src =
            this.backgroundSrc;
        this.width = 1;
        this.height = 1;
        this.resize();
    }
    resize(width, height) {
        let nextWidth = width;
        let nextHeight = height;
        if (!Number.isFinite(nextWidth)) {
            nextWidth =
                this.canvas.clientWidth ||
                window.innerWidth ||
                1;
        }
        if (!Number.isFinite(nextHeight)) {
            nextHeight =
                this.canvas.clientHeight ||
                window.innerHeight ||
                1;
        }
        nextWidth =
            Math.max(
                1,
                Math.floor(nextWidth)
            );
        nextHeight =
            Math.max(
                1,
                Math.floor(nextHeight)
            );
        this.width = nextWidth;
        this.height = nextHeight;
        this.canvas.width = nextWidth;
        this.canvas.height = nextHeight;
        this.ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );
    }
    clear() {
        this.ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );
        this.ctx.fillStyle = '#10100f';
        this.ctx.fillRect(
            0,
            0,
            this.width,
            this.height
        );
    }
    loadBackground() {
        if (
            this.backgroundLoaded &&
            this.background.naturalWidth > 0
        ) {
            return Promise.resolve(
                this.background
            );
        }
        return new Promise((resolve, reject) => {
            const onLoad = () => {
                cleanup();
                resolve(this.background);
            };
            const onError = () => {
                cleanup();
                reject(
                    new Error(
                        'ASTRAWAY: background не загружен.'
                    )
                );
            };
            const cleanup = () => {
                this.background.removeEventListener(
                    'load',
                    onLoad
                );
                this.background.removeEventListener(
                    'error',
                    onError
                );
            };
            this.background.addEventListener(
                'load',
                onLoad,
                { once: true }
            );
            this.background.addEventListener(
                'error',
                onError,
                { once: true }
            );
            if (!this.background.src) {
                this.background.src =
                    this.backgroundSrc;
            }
        });
    }
    setDebug(enabled) {
        this.debug =
            enabled === true;
    }
    toggleDebug() {
        this.debug =
            !this.debug;
        return this.debug;
    }
    render(world, camera) {
        this.clear();
        if (!world || !camera) {
            return;
        }
        this.renderBackground(camera);
        this.renderSurfaces(
            world,
            camera
        );
        this.renderCharacter(
            world.character,
            camera
        );
        if (this.debug) {
            this.renderDebug(
                world,
                camera
            );
        }
    }
    renderBackground(camera) {
        if (
            !this.backgroundLoaded ||
            !this.background.complete ||
            this.background.naturalWidth <= 0 ||
            this.background.naturalHeight <= 0
        ) {
            this.ctx.fillStyle = '#181713';
            this.ctx.fillRect(
                0,
                0,
                this.width,
                this.height
            );
            return;
        }
        const imageWidth =
            this.background.naturalWidth;
        const imageHeight =
            this.background.naturalHeight;
        const scale =
            Math.max(
                this.width / imageWidth,
                this.height / imageHeight
            );
        const drawWidth =
            imageWidth * scale;
        const drawHeight =
            imageHeight * scale;
        const x =
            (this.width - drawWidth) * 0.5;
        const y =
            (this.height - drawHeight) * 0.5;
        this.ctx.drawImage(
            this.background,
            x,
            y,
            drawWidth,
            drawHeight
        );
    }
    renderSurfaces(world, camera) {
        let surfaces = [];
        if (
            world &&
            typeof world.getSurfaces ===
            'function'
        ) {
            surfaces =
                world.getSurfaces();
        }
        if (!Array.isArray(surfaces)) {
            return;
        }
        for (const surface of surfaces) {
            if (!surface) {
                continue;
            }
            this.renderSurface(
                surface,
                camera
            );
        }
    }
    renderSurface(surface, camera) {
        const points =
            Array.isArray(surface.points)
                ? surface.points
                : null;
        if (
            !points ||
            points.length < 2
        ) {
            return;
        }
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        let first = true;
        for (const point of points) {
            if (
                !point ||
                !Number.isFinite(point.x) ||
                !Number.isFinite(point.y)
            ) {
                continue;
            }
            const screen =
                camera.worldToScreen({
                    x: point.x,
                    y: point.y
                });
            if (
                !screen ||
                !Number.isFinite(screen.x) ||
                !Number.isFinite(screen.y)
            ) {
                continue;
            }
            if (first) {
                ctx.moveTo(
                    screen.x,
                    screen.y
                );
                first = false;
            } else {
                ctx.lineTo(
                    screen.x,
                    screen.y
                );
            }
        }
        if (first) {
            ctx.restore();
            return;
        }
        const zoom =
            Number.isFinite(camera.zoom)
                ? camera.zoom
                : 1;
        const width =
            Number.isFinite(surface.width)
                ? surface.width
                : 60;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#604a36';
        ctx.lineWidth =
            Math.max(
                8,
                width * zoom
            );
        ctx.stroke();
        ctx.restore();
    }
    renderCharacter(character, camera) {
        if (!character) {
            return;
        }
        const skeleton =
            character.skeleton;
        if (!skeleton) {
            this.renderCharacterFallback(
                character,
                camera
            );
            return;
        }
        const bonePairs = [
            ['pelvis', 'spine'],
            ['spine', 'chest'],
            ['chest', 'neck'],
            ['neck', 'head'],
            ['chest', 'shoulderL'],
            ['shoulderL', 'elbowL'],
            ['elbowL', 'wristL'],
            ['wristL', 'handL'],
            ['chest', 'shoulderR'],
            ['shoulderR', 'elbowR'],
            ['elbowR', 'wristR'],
            ['wristR', 'handR'],
            ['pelvis', 'hipL'],
            ['hipL', 'kneeL'],
            ['kneeL', 'ankleL'],
            ['ankleL', 'footL'],
            ['pelvis', 'hipR'],
            ['hipR', 'kneeR'],
            ['kneeR', 'ankleR'],
            ['ankleR', 'footR']
        ];
        const ctx = this.ctx;
        const zoom =
            Number.isFinite(camera.zoom)
                ? camera.zoom
                : 1;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ead8bc';
        ctx.lineWidth =
            Math.max(
                3,
                5 * zoom
            );
        for (const pair of bonePairs) {
            const from =
                skeleton.getBone(pair[0]);
            const to =
                skeleton.getBone(pair[1]);
            if (!from || !to) {
                continue;
            }
            if (
                !Number.isFinite(from.worldX) ||
                !Number.isFinite(from.worldY) ||
                !Number.isFinite(to.worldX) ||
                !Number.isFinite(to.worldY)
            ) {
                continue;
            }
            const a =
                camera.worldToScreen({
                    x: from.worldX,
                    y: from.worldY
                });
            const b =
                camera.worldToScreen({
                    x: to.worldX,
                    y: to.worldY
                });
            ctx.beginPath();
            ctx.moveTo(
                a.x,
                a.y
            );
            ctx.lineTo(
                b.x,
                b.y
            );
            ctx.stroke();
        }
        const joints = [
            'pelvis',
            'chest',
            'head',
            'shoulderL',
            'elbowL',
            'wristL',
            'handL',
            'shoulderR',
            'elbowR',
            'wristR',
            'handR',
            'hipL',
            'kneeL',
            'ankleL',
            'footL',
            'hipR',
            'kneeR',
            'ankleR',
            'footR'
        ];
        ctx.fillStyle = '#f2dfc0';
        for (const name of joints) {
            const bone =
                skeleton.getBone(name);
            if (!bone) {
                continue;
            }
            if (
                !Number.isFinite(bone.worldX) ||
                !Number.isFinite(bone.worldY)
            ) {
                continue;
            }
            const point =
                camera.worldToScreen({
                    x: bone.worldX,
                    y: bone.worldY
                });
            const radius =
                name === 'head'
                    ? 12
                    : 4;
            ctx.beginPath();
            ctx.arc(
                point.x,
                point.y,
                Math.max(
                    1,
                    radius * zoom
                ),
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        ctx.restore();
    }
    renderCharacterFallback(
        character,
        camera
    ) {
        if (
            !character ||
            typeof character.getWorldPosition !==
            'function'
        ) {
            return;
        }
        const position =
            character.getWorldPosition();
        if (
            !position ||
            !Number.isFinite(position.x) ||
            !Number.isFinite(position.y)
        ) {
            return;
        }
        const point =
            camera.worldToScreen({
                x: position.x,
                y: position.y
            });
        const zoom =
            Number.isFinite(camera.zoom)
                ? camera.zoom
                : 1;
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#f2dfc0';
        ctx.beginPath();
        ctx.arc(
            point.x,
            point.y,
            18 * zoom,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
    }
    renderDebug(world, camera) {
        const ctx = this.ctx;
        const surfaces =
            typeof world.getSurfaces ===
            'function'
                ? world.getSurfaces()
                : [];
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font =
            '13px sans-serif';
        ctx.fillText(
            `ASTRAWAY`,
            12,
            20
        );
        ctx.fillText(
            `surfaces: ${surfaces.length}`,
            12,
            39
        );
        if (world.character) {
            const position =
                world.character
                    .getWorldPosition();
            if (position) {
                ctx.fillText(
                    `character: ${Math.round(position.x)}, ${Math.round(position.y)}`,
                    12,
                    58
                );
            }
        }
        ctx.restore();
    }
    destroy() {
        if (this.background) {
            this.background.onload = null;
            this.background.onerror = null;
            this.background.src = '';
        }
        this.background = null;
        this.backgroundLoaded = false;
        this.backgroundError = false;
        this.ctx = null;
        this.canvas = null;
    }
}
export default Renderer;
