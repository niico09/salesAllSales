const STEAM_TYPES = {
    GAME: 'game',
    GAMES: 'games',
    DLC: 'dlc',
    PACKAGE: 'package',
    DEMO: 'demo',
    MOD: 'mod',
    VIDEO: 'video',
    MUSIC: 'music',
    HARDWARE: 'hardware',
    SERIES: 'series',
    TOOL: 'tool',
    CONFIG: 'config',
    APPLICATION: 'application',
    ADVERTISING: 'advertising',
    UNKNOWN: 'unknown'
};

const STEAM_FILTERS = {
    VALID_TYPES: [
        STEAM_TYPES.GAME,
        STEAM_TYPES.GAMES,
        STEAM_TYPES.DLC,
        STEAM_TYPES.PACKAGE
    ]
};

module.exports = {
    STEAM_TYPES,
    STEAM_FILTERS
};
