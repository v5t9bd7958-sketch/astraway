    // -----------------------------------------------------
    // WORLD POINT -> SURFACE T
    // -----------------------------------------------------
    //
    // Compatibility method used by Character
    // and Pathfinder.
    //
    // Keeps projection logic centralized in
    // projectPoint() and returns only normalized T.
    //

    projectT(point) {

        if (
            !point ||
            this.segments.length === 0
        ) {
            return 0;
        }

        const projection =
            this.projectPoint(point);

        if (
            !projection ||
            !Number.isFinite(projection.t)
        ) {
            return 0;
        }

        return clamp01(
            projection.t
        );
    }
