_renderCharacter() {
    const character =
        this.character;
    if (
        !character ||
        !character.position
    ) {
        return;
    }
    const position =
        character.position;
    if (
        !Number.isFinite(
            position.x
        ) ||
        !Number.isFinite(
            position.y
        )
    ) {
        return;
    }
    if (!this.camera) {
        return;
    }
    const screen =
        this.camera.worldToScreen(
            position.x,
            position.y
        );
    const ctx =
        this.ctx;
    ctx.save();
    ctx.fillStyle =
        '#ff3b3b';
    ctx.beginPath();
    ctx.arc(
        screen.x,
        screen.y,
        18,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.fillStyle =
        '#ffffff';
    ctx.font =
        '14px sans-serif';
    ctx.fillText(
        `${Math.round(position.x)}, ${Math.round(position.y)}`,
        screen.x + 22,
        screen.y
    );
    ctx.restore();
}
