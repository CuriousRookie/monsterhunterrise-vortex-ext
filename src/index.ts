import path from 'path';
import child_process from 'child_process';
import { fs, types, util } from 'vortex-api';

import { setFluffyPath } from './actions';
import { mhrReducer } from './reducers';

// Game
const GAME_ID = 'monsterhunterrise';
const STEAM_ID = '1446780';
const MHR_EXEC = 'MonsterHunterRise.exe';

// PAK
const MOD_NAME_PATTERN = /(?<modName>.+?)-\d+-.+/g;
const RETOOL_PATH = path.join(__dirname, 'tool');
const RETOOL_EXE = 'REtool.exe';
const FILE_HASH_LIST = 'mhrisePC.list';

// Extensions
const EXT_PLUGIN = '.dll';
const EXT_SCRIPT = '.lua';
const EXT_FONT = '.otf';
const EXT_QUEST = '.json';
const EXT_PAK = '.pak';

// Folders
const DIR_NATIVES = 'natives';
const DIR_REFRAMEWORK = 'reframework';
const DIR_PLUGIN = 'plugins';
const DIR_SCRIPT = 'autorun';
const DIR_FONT = 'fonts';
const DIR_QUEST = 'quests';
const SUB_DIRS = [DIR_PLUGIN, DIR_SCRIPT, DIR_FONT, DIR_QUEST];

// Requirements
const REFRAMEWORK_DLL_FILE = 'dinput8.dll';
const REFRAMEWORK_D2D_DLL_FILE = 'reframework-d2d.dll';
const REFRAMEWORK_D2D_LUA_FILE = 'reframework-d2d.lua';
const FIRST_NATIVES_DLL_FILE = 'FirstNatives.dll';

// Tool
const HUNTER_PIE_EXEC = 'HunterPie.exe';
const FLUFFY_MANAGER_EXEC = 'Modmanager.exe';
const FLUFFY_MOD_PATH = ['Games', 'MHRISE', 'Mods'];
const FLUFFY_MOD_TYPE = 'mhr-fluffy-mod';
const tools = [
    {
        id: 'HunterPieV2',
        name: 'HunterPie V2',
        logo: 'HunterPieV2.jpg',
        executable: () => HUNTER_PIE_EXEC,
        requiredFiles: [
            HUNTER_PIE_EXEC,
        ],
    },
    {
        id: 'FluffyManager5000',
        name: 'Fluffy Manager 5000',
        logo: 'FluffyManager5000.jpg',
        executable: () => FLUFFY_MANAGER_EXEC,
        requiredFiles: [
            FLUFFY_MANAGER_EXEC,
        ],
    },
];

function main(context: types.IExtensionContext) {
    context.registerReducer(['settings', GAME_ID], mhrReducer);

    context.registerGame({
        id: GAME_ID,
        name: 'Monster Hunter Rise',
        mergeMods: true,
        queryPath: findGame,
        supportedTools: tools,
        queryModPath: () => '.',
        logo: 'gameart.jpg',
        executable: () => MHR_EXEC,
        requiredFiles: [
            MHR_EXEC,
        ],
        environment: {
            SteamAppId: STEAM_ID,
        },
        details: {
            steamAppId: STEAM_ID,
        },
        setup: (discovery) => prepareForModding(context.api, discovery),
    });

    // structure archive
    context.registerInstaller('mhr-well-structure-installer', 30, supportedWellStructure, installWellStructure);
    context.registerInstaller('mhr-sub-directory-installer', 35, supportedSubDirectory, installSubDirectory);

    // delegate to fluffy manager
    context.registerModType(FLUFFY_MOD_TYPE, 40, isMHR, () => findFluffyModPath(context.api), testFluffyMod, { name: 'Fluffy Mod' });
    context.registerInstaller('mhr-fluffy-pak-installer', 40, supportedFluffyPak, installFluffyPak);
    context.registerInstaller('mhr-fluffy-native-installer', 40, supportedFluffyNative, installFluffyNative);

    // pure dll plugin, lua script, otf font or json quest
    context.registerInstaller('mhr-guess-dll-installer', 45, (files, gameId) => supportedGuessType(files, gameId, EXT_PLUGIN), (files) => installGuessType(files, EXT_PLUGIN, DIR_PLUGIN));
    context.registerInstaller('mhr-guess-lua-installer', 45, (files, gameId) => supportedGuessType(files, gameId, EXT_SCRIPT), (files) => installGuessType(files, EXT_SCRIPT, DIR_SCRIPT));
    context.registerInstaller('mhr-guess-font-installer', 45, (files, gameId) => supportedGuessType(files, gameId, EXT_FONT), (files) => installGuessType(files, EXT_FONT, DIR_FONT));
    context.registerInstaller('mhr-guess-json-installer', 45, (files, gameId) => supportedGuessType(files, gameId, EXT_QUEST), (files) => installGuessType(files, EXT_QUEST, DIR_QUEST));

    // unsupported archive structure mod may be installed to game directory by queryModPath setting '.'
    return true;
}

// Support
async function findGame(): Promise<string> {
    return util.steam.findByAppId(STEAM_ID)
        .then((game: types.IGameStoreEntry) => game.gamePath);
}

function findFluffyPath(api: types.IExtensionApi): string {
    const state = api.getState();
    return util.getSafe(state, ['settings', GAME_ID, 'fluffyPath'], '');
}

function isMHR(gameId: string): boolean {
    return gameId === GAME_ID;
}

function findFluffyModPath(api: types.IExtensionApi): string {
    const storedFluffyPath = findFluffyPath(api);
    if (storedFluffyPath === '') {
        throw new Error('fluffy path not found');
    }
    return path.join(storedFluffyPath, ...FLUFFY_MOD_PATH);
}

function isSubDirectory(name: string): boolean {
    return SUB_DIRS.indexOf(name) !== -1;
}

// Check requirements
async function prepareForModding(api: types.IExtensionApi, discovery: types.IDiscoveryResult): Promise<void> {
    await fs.ensureDirAsync(discovery.path);

    // user will close dialog with order: reframework, reframework-d2d, first-natives, fluffy
    await checkFluffyRequirement(api);

    const firstNatives = [
        path.join(discovery.path, DIR_REFRAMEWORK, DIR_PLUGIN, FIRST_NATIVES_DLL_FILE)
    ];
    await checkRequirement(api, 'First-Natives', '848', firstNatives);

    const reframeworkD2D = [
        path.join(discovery.path, DIR_REFRAMEWORK, DIR_PLUGIN, REFRAMEWORK_D2D_DLL_FILE),
        path.join(discovery.path, DIR_REFRAMEWORK, DIR_SCRIPT, REFRAMEWORK_D2D_LUA_FILE),
    ];
    await checkRequirement(api, 'Reframework-Direct2D', '134', reframeworkD2D);

    const reframework = [
        path.join(discovery.path, REFRAMEWORK_DLL_FILE)
    ];
    await checkRequirement(api, 'Reframework', '26', reframework);
}

async function checkRequirement(api: types.IExtensionApi, name: string, id: string, files: string[]): Promise<void | any[]> {
    return Promise.all(files.map(file => fs.statAsync(file)))
        .catch(() => {
            api.showDialog('question', `${name} required`, {
                text: `Monster Hunter Rise requires "${name}" for most mods to install and function correctly.\n`
                    + `Vortex is able to install ${name} automatically (as a mod) but please ensure it is enabled\n`
                    + 'and deployed at all times.',
            }, [
                { label: 'Skip Download' },
                {
                    label: `Download ${name}`,
                    action: () => util.opn(`https://www.nexusmods.com/monsterhunterrise/mods/${id}`).catch(() => undefined),
                },
            ]);
        });
}

async function checkFluffyRequirement(api: types.IExtensionApi): Promise<string> {
    let fluffyPath: string;

    const storedFluffyPath = findFluffyPath(api);
    const exist = storedFluffyPath !== '';
    if (exist) {
        fluffyPath = storedFluffyPath;
    } else {
        // hard link require fluffy manager installed on the same drive as game
        await api.showDialog('question', 'Fluffy Manager 5000 required', {
            text: 'Monster Hunter Rise requires Fluffy Manager 5000 for some mods to install correctly.\n'
                + 'Before select your Fluffy Manager 5000 folder, you can first download it from nexusmod.',
        }, [
            { label: 'Skip Download And Select' },
            {
                label: `Download Fluffy Manager 5000 And Select`,
                action: () => util.opn(`https://www.nexusmods.com/monsterhunterrise/mods/7`).catch(() => undefined),
            },
        ]);

        fluffyPath = await api.selectDir({ title: 'Select Fluffy Manager 5000 folder' });
        await fs.statAsync(path.join(fluffyPath, FLUFFY_MANAGER_EXEC));
        api.store.dispatch(setFluffyPath(fluffyPath));
    }

    const fluffyModPath = path.join(fluffyPath, ...FLUFFY_MOD_PATH);
    await fs.statAsync(fluffyModPath).catch(() => fs.mkdirsAsync(fluffyModPath));
    return Promise.resolve(fluffyPath);
}

// Method for mod type
function testFluffyMod(instructions: types.IInstruction[]): Promise<boolean> {
    const filtered = instructions.filter(instr => instr.type === 'copy');
    const matches = filtered.filter(instr => path.extname(instr.source) === 'zip');
    return Promise.resolve(matches.length !== 0);
}

// Method for mod installer
function supportedWellStructure(files: string[], gameId: string): Promise<types.ISupportedResult> {
    const supported = (gameId === GAME_ID)
        && (files.find(file => file.split(path.sep).indexOf(DIR_REFRAMEWORK) !== -1) !== undefined);
    return Promise.resolve({ supported: supported, requiredFiles: [] });
}

function installWellStructure(files: string[]): Promise<types.IInstallResult> {
    const sample = files.find(file => file.split(path.sep).indexOf(DIR_REFRAMEWORK) !== -1);
    const idx = sample.indexOf(DIR_REFRAMEWORK + path.sep);

    const filtered = files.filter(file => (path.extname(file) !== '') && (file.split(path.sep).indexOf(DIR_REFRAMEWORK) !== -1));
    const instructions = filtered.map(file => {
        return {
            type: 'copy' as types.InstructionType,
            source: file,
            destination: file.substring(idx),
        };
    });
    return Promise.resolve({ instructions });
}

function supportedSubDirectory(files: string[], gameId: string): Promise<types.ISupportedResult> {
    const supported = (gameId === GAME_ID)
        && (files.find(file => file.split(path.sep).filter(isSubDirectory).length !== 0) !== undefined);
    return Promise.resolve({ supported: supported, requiredFiles: [] });
}

function installSubDirectory(files: string[]): Promise<types.IInstallResult> {
    const sample = files.find(file => file.split(path.sep).filter(isSubDirectory).length !== 0);
    const idx = sample.indexOf(SUB_DIRS.find(dir => sample.indexOf(dir + path.sep) !== -1) + path.sep);

    const filtered = files.filter(file => (path.extname(file) !== '') && (file.split(path.sep).filter(isSubDirectory).length !== 0));
    const instructions = filtered.map(file => {
        return {
            type: 'copy' as types.InstructionType,
            source: file,
            destination: path.join(DIR_REFRAMEWORK, file.substring(idx)),
        };
    });
    return Promise.resolve({ instructions });
}

async function repackage(destinationPath: string, repackagePath: string): Promise<types.IInstallResult> {
    // define the name of the newly created archive and make sure it's placed inside the current destination path
    const archiveName = path.basename(destinationPath, '.installing') + '.zip';
    const archivePath = path.join(destinationPath, archiveName);

    // read the contents of the destination path (the extracted mod's root path)
    const relativePaths = await fs.readdirAsync(repackagePath);
    const szip = new util.SevenZip();
    await szip.add(archivePath, relativePaths.map((relativePath: string) => path.join(repackagePath, relativePath)), { raw: ['-r'] });

    // the installer instructions should only copy over the archive we just created
    const setModType: types.IInstruction = {
        type: 'setmodtype',
        value: FLUFFY_MOD_TYPE,
    };
    const copy: types.IInstruction = {
        type: 'copy',
        source: archiveName,
        destination: archiveName,
    };
    const instructions = [setModType, copy];
    return Promise.resolve({ instructions });
}

function supportedFluffyPak(files: string[], gameId: string): Promise<types.ISupportedResult> {
    const supported = (gameId === GAME_ID)
        && (files.find(file => path.extname(file) === EXT_PAK) !== undefined);
    return Promise.resolve({ supported: supported, requiredFiles: [] });
}

async function installFluffyPak(files: string[], destinationPath: string): Promise<types.IInstallResult> {
    // time of extract pak is expensive, maybe show a warning dialog suggest user download fluffy version if possible

    // create folder in destinationPath
    const archiveName = path.basename(destinationPath, '.installing');
    const extractPath = path.join(destinationPath, archiveName + '.extracting');
    await fs.mkdirAsync(extractPath);

    // extract pak into folder
    const filtered = files.filter(file => path.extname(file) === EXT_PAK);
    filtered.forEach(file => {
        const pakPath = '"' + path.join(destinationPath, file) + '"';
        const commands = [
            path.join(RETOOL_PATH, RETOOL_EXE),
            '-h', '"' + path.join(RETOOL_PATH, FILE_HASH_LIST) + '"',
            '-x', '-skipUnknowns', '-noExtractDir', pakPath,
        ];

        try {
            child_process.execSync(commands.join(' '), {
                cwd: extractPath,
                encoding: 'utf-8',
                stdio: 'inherit',
                windowsHide: true,
            });
        } catch (error) {
            // -skipUnknowns will exit with status 1
            if (error.status !== 1) {
                throw error;
            }
        }
        console.log(`extract ${path.join(archiveName, file)} success`);
    });

    // create modinfo.ini into folder
    const modName = MOD_NAME_PATTERN.exec(archiveName).groups['modName'];
    const data = `name=${modName}\ndescription=${archiveName}\nversion=\nauthor=\n`;
    await fs.writeFileAsync(path.join(extractPath, 'modinfo.ini'), data, { encoding: 'utf-8' });

    return repackage(destinationPath, extractPath);
}

function supportedFluffyNative(files: string[], gameId: string): Promise<types.ISupportedResult> {
    const supported = (gameId === GAME_ID)
        && (files.find(file => (path.basename(file) === 'modinfo.ini') || (file.split(path.sep).indexOf(DIR_NATIVES) !== -1)) !== undefined);
    return Promise.resolve({ supported: supported, requiredFiles: [] });
}

async function installFluffyNative(_files: string[], destinationPath: string): Promise<types.IInstallResult> {
    return repackage(destinationPath, destinationPath);
}

function supportedGuessType(files: string[], gameId: string, ext: string): Promise<types.ISupportedResult> {
    const supported = (gameId === GAME_ID)
        && (files.find(file => path.extname(file) === ext) !== undefined);
    return Promise.resolve({ supported: supported, requiredFiles: [] });
}

function installGuessType(files: string[], ext: string, directory: string): Promise<types.IInstallResult> {
    const sample = files.find(file => path.extname(file) === ext);

    let idx: number;
    if ((ext === EXT_PLUGIN) && (path.basename(sample) === REFRAMEWORK_DLL_FILE)) {
        // reframework dinput8.dll
        return Promise.resolve({
            instructions: [
                {
                    type: 'copy' as types.InstructionType,
                    source: sample,
                    destination: REFRAMEWORK_DLL_FILE,
                }
            ]
        });
    } else if ((ext === EXT_QUEST) && (sample.split(path.sep).indexOf('spawn') !== -1)) {
        // sample entry in archive name like '{folders}\spawn\stage\custom_quest.json'
        idx = sample.indexOf('spawn' + path.sep);
    } else {
        idx = sample.indexOf(path.basename(sample));
    }

    const filtered = files.filter(file => path.extname(file) !== '');
    const instructions = filtered.map(file => {
        return {
            type: 'copy' as types.InstructionType,
            source: file,
            destination: path.join(DIR_REFRAMEWORK, directory, file.substring(idx)),
        };
    });
    return Promise.resolve({ instructions });
}

export default main;
