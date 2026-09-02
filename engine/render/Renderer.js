render(world, camera) {

    if (!world) {
        return;
    }

    this.clear();

    if (!camera) {
        return;
    }

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
