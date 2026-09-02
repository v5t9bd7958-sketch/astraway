// ASTRAWAY 2.0
// Renderer
// World -> Camera -> Screen
//
// Renderer НЕ владеет Camera.
// Camera передаётся из Game.render().
// World.surfaces хранится как Map и доступен через world.getSurfaces().

export default class Renderer {

    constructor(canvas, options = {}) {

        this.canvas = canvas;

        this.ctx =
            canvas.getContext('2d', {
                alpha: false
            });

        this.debug =
            options.debug ?? false;

        this.background =
            new Image();

        this.backgroundLoaded = false;

        this.background.src =
            './assets/background.jpg .jpeg';

        this.background.onload = () => {

            this.backgroundLoaded = true;
        };

        this.background.onerror = () => {

            this.backgroundLoaded = false;
        };
    }


    resize(width, height) {

        if (!this.canvas) {
            return;
        }

        this.canvas.width =
            Math.max(1, Math.floor(width));

        this.canvas.height =
            Math.max(1, Math.floor(height));
    }


    clear() {

        if (!this.ctx) {
            return;
        }

        this.ctx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );

        this.ctx.fillStyle =
            '#000';

        this.ctx.fillRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
    }


    render(world, camera) {

        if (!world || !camera) {
            this.clear();
            return;
        }

        this.clear();

        this.renderBackground(
            camera
        );

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

        if (!this.ctx || !camera) {
            return;
        }

        const canvas =
            this.canvas;

        const ctx =
            this.ctx;

        if (
            this.backgroundLoaded &&
            this.background.complete &&
            this.background.naturalWidth > 0
        ) {

            const viewport =
                camera.viewport;

            const scale =
                Math.max(
                    canvas.width /
                        this.background.naturalWidth,

                    canvas.height /
                        this.background.naturalHeight
                );

            const width =
                this.background.naturalWidth *
                scale;

            const height =
                this.background.naturalHeight *
                scale;

            const x =
                (canvas.width - width) * 0.5;

            const y =
                (canvas.height - height) * 0.5;

            ctx.drawImage(
                this.background,
                x,
                y,
                width,
                height
            );

            return;
        }

        // Безопасный fallback,
        // чтобы мир не превращался в пустой экран.

        ctx.save();

        ctx.fillStyle =
            '#111';

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.restore();
    }


    renderSurfaces(world, camera) {

        if (
            !world ||
            !camera ||
            !this.ctx
        ) {
            return;
        }

        const surfaces =
            typeof world.getSurfaces ===
            'function'

                ? world.getSurfaces()

                : [];

        if (!Array.isArray(surfaces)) {
            return;
        }

        for (
            const surface of surfaces
        ) {

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

        if (
            !surface ||
            !camera ||
            !this.ctx
        ) {
            return;
        }

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

        const ctx =
            this.ctx;

        ctx.save();

        ctx.beginPath();

        const first =
            camera.worldToScreen(
                points[0].x,
                points[0].y
            );

        ctx.moveTo(
            first.x,
            first.y
        );

        for (
            let i = 1;
            i < points.length;
            i++
        ) {

            const point =
                points[i];

            const screen =
                camera.worldToScreen(
                    point.x,
                    point.y
                );

            ctx.lineTo(
                screen.x,
                screen.y
            );
        }

        ctx.lineCap =
            'round';

        ctx.lineJoin =
            'round';

        ctx.strokeStyle =
            '#5b4636';

        ctx.lineWidth =
            Math.max(
                8,
                Number(surface.width) || 60
            ) *
            camera.zoom;

        ctx.stroke();

        ctx.restore();
    }


    renderCharacter(character, camera) {

        if (
            !character ||
            !camera ||
            !this.ctx
        ) {
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

        const ctx =
            this.ctx;

        ctx.save();

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

        ctx.lineCap =
            'round';

        ctx.lineJoin =
            'round';

        ctx.strokeStyle =
            '#e6d5b8';

        ctx.lineWidth =
            Math.max(
                3,
                5 * camera.zoom
            );

        for (
            const [fromName, toName]
            of bonePairs
        ) {

            const from =
                skeleton.getBone(
                    fromName
                );

            const to =
                skeleton.getBone(
                    toName
                );

            if (!from || !to) {
                continue;
            }

            const a =
                camera.worldToScreen(
                    from.worldX,
                    from.worldY
                );

            const b =
                camera.worldToScreen(
                    to.worldX,
                    to.worldY
                );

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

        // Bone joints.

        ctx.fillStyle =
            '#f0dfc2';

        const bonesToDraw = [

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

        for (
            const name
            of bonesToDraw
        ) {

            const bone =
                skeleton.getBone(name);

            if (!bone) {
                continue;
            }

            const p =
                camera.worldToScreen(
                    bone.worldX,
                    bone.worldY
                );

            const radius =
                name === 'head'
                    ? 12
                    : 4;

            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                radius * camera.zoom,
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
            !camera ||
            !this.ctx
        ) {
            return;
        }

        const position =
            typeof character.getWorldPosition ===
            'function'

                ? character.getWorldPosition()

                : null;

        if (!position) {
            return;
        }

        const p =
            camera.worldToScreen(
                position.x,
                position.y
            );

        const ctx =
            this.ctx;

        ctx.save();

        ctx.fillStyle =
            '#f0dfc2';

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            18 * camera.zoom,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }


    renderDebug(world, camera) {

        if (
            !world ||
            !camera ||
            !this.ctx
        ) {
            return;
        }

        const ctx =
            this.ctx;

        const surfaces =
            typeof world.getSurfaces ===
            'function'

                ? world.getSurfaces()

                : [];

        ctx.save();

        ctx.fillStyle =
            '#ffffff';

        ctx.font =
            '12px sans-serif';

        ctx.fillText(
            `surfaces: ${surfaces.length}`,
            12,
            20
        );

        if (world.character) {

            const position =
                world.character
                    .getWorldPosition();

            ctx.fillText(
                `character: ${Math.round(position.x)}, ${Math.round(position.y)}`,
                12,
                38
            );
        }

        ctx.restore();
    }
}
