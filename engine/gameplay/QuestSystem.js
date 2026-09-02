export class QuestSystem {

    constructor() {

        this.state = {};

        this.quests = new Map();

        this.flags = new Map();

        this.variables = new Map();

        this.onStateChanged = null;
    }


    setStateChangedCallback(callback) {

        this.onStateChanged =
            typeof callback === "function"
                ? callback
                : null;
    }


    defineQuest(id, options = {}) {

        if (!id) {
            throw new Error(
                "QuestSystem.defineQuest: id is required"
            );
        }

        if (this.quests.has(id)) {
            return this.quests.get(id);
        }

        const quest = {

            id,

            title:
                options.title ||
                id,

            description:
                options.description ||
                "",

            state:
                options.state ||
                "locked",

            steps:
                Array.isArray(options.steps)
                    ? options.steps.map(
                        step => ({
                            id: step.id,
                            completed:
                                step.completed === true,
                            data:
                                step.data || {}
                        })
                    )
                    : [],

            data:
                options.data || {}
        };

        this.quests.set(
            id,
            quest
        );

        this.emitStateChanged();

        return quest;
    }


    getQuest(id) {

        return this.quests.get(id) || null;
    }


    hasQuest(id) {

        return this.quests.has(id);
    }


    setQuestState(id, state) {

        const quest =
            this.getQuest(id);

        if (!quest) {
            return false;
        }

        quest.state = state;

        this.emitStateChanged();

        return true;
    }


    startQuest(id) {

        return this.setQuestState(
            id,
            "active"
        );
    }


    completeQuest(id) {

        return this.setQuestState(
            id,
            "completed"
        );
    }


    failQuest(id) {

        return this.setQuestState(
            id,
            "failed"
        );
    }


    isQuestActive(id) {

        const quest =
            this.getQuest(id);

        return (
            quest !== null &&
            quest.state === "active"
        );
    }


    isQuestCompleted(id) {

        const quest =
            this.getQuest(id);

        return (
            quest !== null &&
            quest.state === "completed"
        );
    }


    completeStep(
        questId,
        stepId
    ) {

        const quest =
            this.getQuest(
                questId
            );

        if (!quest) {
            return false;
        }

        const step =
            quest.steps.find(
                item =>
                    item.id === stepId
            );

        if (!step) {
            return false;
        }

        step.completed = true;

        this.emitStateChanged();

        this.checkQuestCompletion(
            quest
        );

        return true;
    }


    isStepCompleted(
        questId,
        stepId
    ) {

        const quest =
            this.getQuest(
                questId
            );

        if (!quest) {
            return false;
        }

        const step =
            quest.steps.find(
                item =>
                    item.id === stepId
            );

        return (
            step !== undefined &&
            step.completed === true
        );
    }


    checkQuestCompletion(quest) {

        if (!quest) {
            return false;
        }

        if (quest.steps.length === 0) {
            return false;
        }

        const complete =
            quest.steps.every(
                step =>
                    step.completed === true
            );

        if (complete) {

            quest.state =
                "completed";

            this.emitStateChanged();

            return true;
        }

        return false;
    }


    setFlag(id, value = true) {

        if (!id) {
            return;
        }

        this.flags.set(
            id,
            Boolean(value)
        );

        this.emitStateChanged();
    }


    getFlag(id) {

        return (
            this.flags.get(id) === true
        );
    }


    hasFlag(id) {

        return this.flags.has(id);
    }


    clearFlag(id) {

        if (!id) {
            return;
        }

        this.flags.delete(id);

        this.emitStateChanged();
    }


    setVariable(id, value) {

        if (!id) {
            return;
        }

        this.variables.set(
            id,
            value
        );

        this.emitStateChanged();
    }


    getVariable(
        id,
        fallback = null
    ) {

        return this.variables.has(id)
            ? this.variables.get(id)
            : fallback;
    }


    hasVariable(id) {

        return this.variables.has(id);
    }


    removeVariable(id) {

        if (!id) {
            return;
        }

        this.variables.delete(id);

        this.emitStateChanged();
    }


    setStateValue(
        path,
        value
    ) {

        if (!path) {
            return;
        }

        const parts =
            String(path)
                .split(".")
                .filter(Boolean);

        if (parts.length === 0) {
            return;
        }

        let target =
            this.state;

        for (
            let i = 0;
            i < parts.length - 1;
            i++
        ) {

            const key =
                parts[i];

            if (
                typeof target[key] !==
                "object" ||
                target[key] === null
            ) {

                target[key] = {};
            }

            target =
                target[key];
        }

        target[
            parts[parts.length - 1]
        ] = value;

        this.emitStateChanged();
    }


    getStateValue(
        path,
        fallback = null
    ) {

        if (!path) {
            return fallback;
        }

        const parts =
            String(path)
                .split(".")
                .filter(Boolean);

        let value =
            this.state;

        for (
            const key
            of parts
        ) {

            if (
                value === null ||
                value === undefined ||
                !(key in value)
            ) {
                return fallback;
            }

            value =
                value[key];
        }

        return value;
    }


    removeStateValue(path) {

        if (!path) {
            return;
        }

        const parts =
            String(path)
                .split(".")
                .filter(Boolean);

        if (parts.length === 0) {
            return;
        }

        let target =
            this.state;

        for (
            let i = 0;
            i < parts.length - 1;
            i++
        ) {

            const key =
                parts[i];

            if (
                !target[key] ||
                typeof target[key] !==
                "object"
            ) {
                return;
            }

            target =
                target[key];
        }

        delete target[
            parts[parts.length - 1]
        ];

        this.emitStateChanged();
    }


    reset() {

        this.state = {};

        this.quests.clear();

        this.flags.clear();

        this.variables.clear();

        this.emitStateChanged();
    }


    emitStateChanged() {

        if (this.onStateChanged) {

            this.onStateChanged(
                this.snapshot()
            );
        }
    }


    snapshot() {

        const quests = {};

        for (
            const [id, quest]
            of this.quests
        ) {

            quests[id] = {

                id: quest.id,

                title: quest.title,

                description:
                    quest.description,

                state:
                    quest.state,

                steps:
                    quest.steps.map(
                        step => ({
                            id: step.id,
                            completed:
                                step.completed,
                            data:
                                step.data
                        })
                    ),

                data:
                    quest.data
            };
        }

        const flags = {};

        for (
            const [id, value]
            of this.flags
        ) {

            flags[id] = value;
        }

        const variables = {};

        for (
            const [id, value]
            of this.variables
        ) {

            variables[id] = value;
        }

        return {

            state:
                structuredCloneSafe(
                    this.state
                ),

            quests,

            flags,

            variables
        };
    }


    validate() {

        return (
            this.state !== null &&
            typeof this.state === "object" &&
            this.quests instanceof Map &&
            this.flags instanceof Map &&
            this.variables instanceof Map
        );
    }
}


function structuredCloneSafe(value) {

    if (
        typeof structuredClone ===
        "function"
    ) {

        try {
            return structuredClone(value);
        } catch (_) {
            // fallback ниже
        }
    }

    try {

        return JSON.parse(
            JSON.stringify(value)
        );

    } catch (_) {

        return {};
    }
}


export default QuestSystem;
