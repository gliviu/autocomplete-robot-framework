const fs = require('fs')
const pathUtils = require('path')
const os = require('os')
const autocomplete = require('./autocomplete')
const keywordsRepo = require('./keywords')
const robotParser = require('./parse-robot')
const libdocParser = require('./parse-libdoc')
const libManager = require('./library-manager')
const common = require('./common')
const status = require('./status')

const CFG_KEY = 'autocomplete-robot-framework';
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_KEYWORDS_SUGGESTIONS_CAP = 100;
const PYTHON_LIBDOC_DIR = pathUtils.join(os.tmpdir(), 'robot-lib-cache'); // Place to store imported Python libdoc files

const FALLBACK_LIBRARY_NAMES = [
  ...['BuiltIn', 'Collections', 'DateTime', 'Dialogs', 'OperatingSystem', 'Process', 'Remote', 'Screenshot', 'String', 'Telnet', 'XML'],
  ...['FtpLibrary', 'HttpLibrary.HTTP', 'MongoDBLibrary', 'Rammbock', 'RemoteSwingLibrary', 'RequestsLibrary', 'Selenium2Library', 'SeleniumLibrary', 'SSHLibrary', 'SwingLibrary']
];
const FALLBACK_LIBRARY_DIR = pathUtils.join(__dirname, '../fallback-libraries');


// Used to avoid multiple concurrent reloadings
let scheduleReload = false;

function isRobotFile(fileContent, filePath, settings) {
  let ext = pathUtils.extname(filePath);
  if (ext === '.robot') {
    return true;
  }
  if (settings.robotExtensions.includes(ext) && robotParser.isRobot(fileContent)) {
    return true;
  }
  return false;
};

function isLibdocXmlFile(fileContent, filePath) {
  let ext = pathUtils.extname(filePath);
  return ext === '.xml' && libdocParser.isLibdoc(fileContent);
};

function readdir(path){
  return new Promise(function(resolve, reject) {
    let callback = function(err, files) {
      if (err) {
        return reject(err);
      } else {
        return resolve(files);
      }
    };
    return fs.readdir(path, callback);
  })
}

function scanDirectory(path, settings){
  return readdir(path).then(function(result) {
    let promise = Promise.resolve();
    // Chain promises to avoid freezing atom ui
    for (let name of result) {
      promise = promise.then(() => processFile(path, name, fs.lstatSync(`${path}/${name}`), settings))
    }
    return promise;
  });
}

function processFile(path, name, stat, settings) {
  let fullPath = `${path}/${name}`;
  let ext = pathUtils.extname(fullPath);
  if (stat.isDirectory() && !settings.excludeDirectories.includes(name)) {
    return scanDirectory(fullPath, settings);
  }
  if (stat.isFile() && stat.size < settings.maxFileSize) {
    let fileContent = fs.readFileSync(fullPath).toString();
    if (isRobotFile(fileContent, fullPath, settings)) {
      var parsedRobotInfo = robotParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, common.getResourceKey(fullPath), fullPath);
      return Promise.resolve();
    }
    if (settings.processLibdocFiles && isLibdocXmlFile(fileContent, fullPath)) {
      libManager.addFallbackLibraries([fullPath])
      return Promise.resolve();
    }
  }
  return Promise.resolve();
}

function readConfig(){
  let settings = {
    robotExtensions: ['.robot', '.txt'],
    debug: undefined,              // True/false for verbose console output
    maxFileSize: undefined,        // Files bigger than this will not be loaded in memory
    maxKeywordsSuggestionsCap: undefined,  // Maximum number of suggested keywords
    excludeDirectories: undefined, // Directories not to be scanned
    removeDotNotation: undefined,   // Avoid dot notation in suggestions, ie. BuiltIn.convhex will be suggested as "Convert To Hex" instead of "BuiltIn.Convert To Hex"
    showArguments: undefined,      // Shows keyword arguments in suggestions
    processLibdocFiles: undefined, // Process '.xml' files representing libdoc definitions
    showLibrarySuggestions: undefined, // Suggest library names
    globalScopeModifier: undefined, // If used, glogal scope modifier will suggest = require(all available keywords, no matter current imports
    internalScopeModifier: undefined, // If used, internal scope modifier will suggest only = require(local resource
    pythonExecutable: undefined,  // Python command name or path
  };
  provider.settings = settings;

  settings.debug = atom.config.get(`${CFG_KEY}.debug`) || false;
  settings.showArguments = atom.config.get(`${CFG_KEY}.showArguments`) || false;
  settings.maxFileSize = atom.config.get(`${CFG_KEY}.maxFileSize`) || MAX_FILE_SIZE;
  settings.maxKeywordsSuggestionsCap = atom.config.get(`${CFG_KEY}.maxKeywordsSuggestionsCap`) || MAX_KEYWORDS_SUGGESTIONS_CAP;
  settings.excludeDirectories = atom.config.get(`${CFG_KEY}.excludeDirectories`);
  settings.removeDotNotation = atom.config.get(`${CFG_KEY}.removeDotNotation`);
  settings.processLibdocFiles = atom.config.get(`${CFG_KEY}.processLibdocFiles`);
  settings.showLibrarySuggestions = atom.config.get(`${CFG_KEY}.showLibrarySuggestions`);
  settings.globalScopeModifier = atom.config.get(`${CFG_KEY}.globalScopeModifier`);
  settings.internalScopeModifier = atom.config.get(`${CFG_KEY}.internalScopeModifier`);
  settings.pythonExecutable = atom.config.get(`${CFG_KEY}.pythonExecutable`);
};

// Some library names contain characters forbidden in config property names, such as '.'.
// This function removes offending characters.
function escapeLibraryName(libraryName){
  return libraryName.replace(/\./, '');
}

function projectDirectoryExists(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch (err) {
    return false;
  }
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
};

function reloadAutocompleteData() {
  if (provider.loading) {
    if (provider.settings.debug) { console.log('Schedule loading autocomplete data'); }
    scheduleReload = true;
    return Promise.resolve({status: 'scheduled'})
  } else {
    if (provider.settings.debug) { console.log('Loading autocomplete data'); }
    provider.loading = true;
    libManager.reset()
    let promise = Promise.resolve();
    // Chain promises to avoid freezing atom ui due to too many concurrent processes
    for (let path in provider.robotProjectPaths) {
      if (projectDirectoryExists(path) && provider.robotProjectPaths[path].status === 'project-initial') {
        let projectName = pathUtils.basename(path);
        if (provider.settings.debug) { console.log(`Loading project ${projectName}`); }
        if (provider.settings.debug) { console.time(`Robot project ${projectName} loading time:`); }
        provider.robotProjectPaths[path].status = 'project-loading';
        keywordsRepo.reset(path);
        promise = promise.then(() =>
        scanDirectory(path, provider.settings).then(function() {
          if (provider.settings.debug) { console.log(`Project ${projectName} loaded`); }
          if (provider.settings.debug) { console.timeEnd(`Robot project ${projectName} loading time:`); }
          provider.robotProjectPaths[path].status = 'project-loaded';
        })
      );
    }
  }
  return promise.then(() => {
    if (provider.settings.debug) { console.log('Importing libraries...'); }
    const fallbackLibrariesPaths = FALLBACK_LIBRARY_NAMES
      .map((libname)=>pathUtils.join(FALLBACK_LIBRARY_DIR, `${libname}.xml`))
    libManager.addFallbackLibraries(fallbackLibrariesPaths)
    return libManager.importLibraries(PYTHON_LIBDOC_DIR, provider.settings.pythonExecutable);
  })
  .then(() => {
    if (provider.settings.debug) { console.log('Autocomplete data loaded'); }
    provider.loading = false;
    if (scheduleReload) {
      scheduleReload = false;
      return reloadAutocompleteData();
    } else{
      return Promise.resolve({status: 'reloaded'})
    }
  })
  .catch((error) => {
    console.error(`Error occurred while reloading robot autocomplete data: ${error.stack ? error.stack : error}`);
    provider.loading = false;
    if (scheduleReload) {
      scheduleReload = false;
      return reloadAutocompleteData();
    } else{
      return Promise.resolve({status: 'error', message: error.toString(), stack: error.stack})
    }
  });
}
};

// true/false when new libraries have been added since last edit.
function isLibraryInfoUpdatedForEditor(oldLibraries, newLibraries) {
  oldLibraries = oldLibraries.map(library => library.name);
  newLibraries = newLibraries.map(library => library.name);
  return !common.eqSet(new Set(oldLibraries), new Set(newLibraries));
};

function reloadAutocompleteDataForEditor(editor, useBuffer, settings) {
  let path = editor.getPath();
  if (!path) {
    return;
  }
  let dirPath = pathUtils.dirname(path);
  if (fileExists(path) && pathUtils.normalize(dirPath)!==PYTHON_LIBDOC_DIR) {
    let fileContent = useBuffer ? editor.getBuffer().getText() : fs.readFileSync(path).toString();
    if (isRobotFile(fileContent, path, settings)) {
      var parsedRobotInfo = robotParser.parse(fileContent);
      let resourceKey = common.getResourceKey(path);
      let oldLibraries = keywordsRepo.resourcesMap[resourceKey] ? keywordsRepo.resourcesMap[resourceKey].imports.libraries : [];
      keywordsRepo.addKeywords(parsedRobotInfo, common.getResourceKey(path), path);
      let newLibraries = keywordsRepo.resourcesMap[resourceKey].imports.libraries;
      let libraryInfoUpdated = isLibraryInfoUpdatedForEditor(oldLibraries, newLibraries);
      if (libraryInfoUpdated) {
        libManager.importLibraries(PYTHON_LIBDOC_DIR, provider.settings.pythonExecutable);
      }
    } else {
      keywordsRepo.reset(path);
    }
  }
};

// Opens a new project for given editor if none is already opened for it.
// Project opening is handled asynchronously.
// Returns a promise holding 'opened' value after project have been opened.
// Returns a promise holding 'alreadyopen' value if project is already opened
// Returns a promise holding 'norobot' value editor does not represent a robot file.
function openRobotProjectPathForEditor(editor, settings) {
  let editorPath = editor.getPath();
  if (!editorPath) {
    return Promise.resolve('norobot')
  }
  let dirPath = pathUtils.dirname(editorPath);
  if (pathUtils.normalize(dirPath)!==PYTHON_LIBDOC_DIR) {
    let text = editor.getBuffer().getText();
    let ext = pathUtils.extname(editorPath);
    let isRobot = isRobotFile(text, editorPath, settings);
    if(isRobot){
      let robotProjectPathsUpdated = false
      for (let projectPath of getAtomProjectPathsForEditor(editor)) {
        if (!provider.robotProjectPaths[projectPath]) {
          // New robot project detected
          provider.robotProjectPaths[projectPath] = {status: 'project-initial'};
          robotProjectPathsUpdated = true
        }
      }
      if(robotProjectPathsUpdated){
        return reloadAutocompleteData().then(()=>'opened')
      } else{
        return Promise.resolve('alreadyopen')
      }
    } else{
      return Promise.resolve('norobot')
    }
  } else{
    return Promise.resolve('norobot')
  }
};

// Removes paths that are no longer opened in Atom tree view
function cleanRobotProjectPaths() {
  let atomPaths = atom.project.getDirectories().map( directory => directory.path);
  for (let path in provider.robotProjectPaths) {
    if (!atomPaths.includes(path)) {
      delete provider.robotProjectPaths[path];
      keywordsRepo.reset(path);
      if (provider.settings.debug) { console.log(`Removed previously indexed robot projec: '${path}'`); }
    }
  }
};


function getAtomProjectPathsForEditor(editor) {
  let res = [];
  let editorPath = editor.getPath();
  for (let projectDirectory of atom.project.getDirectories()) {
    if (projectDirectory.contains(editorPath)) {
      res.push(projectDirectory.getPath());
    }
  }
  return res;
};


// Normally autocomplete-plus considers '.' as delimiter when building prefixes.
// ie. for 'HttpLibrary.HTTP' it reports only 'HTTP' as prefix.
// This method considers everything until it meets a robot syntax separator (multiple spaces, tabs, ...).
function getPrefix(editor, bufferPosition) {
  let line = editor.lineTextForBufferRow(bufferPosition.row);
  let textBeforeCursor = line.substr(0, bufferPosition.column);
  let normalized = textBeforeCursor.replace(/[ \t]{2,}/g, '\t');
  let reversed = normalized.split("").reverse().join("");
  let reversedPrefixMatch = /^[^\t]+/.exec(reversed);
  if(reversedPrefixMatch) {
    return reversedPrefixMatch[0].split("").reverse().join("");
  } else {
    return '';
  }
};

var provider = {
  settings : {},
  selector: '.text.robot',
  disableForSelector: '.comment, .variable, .punctuation, .string, .storage, .keyword',
  loading: undefined,    // Set to 'true' during autocomplete data async loading
  pathsChangedSubscription: undefined,
  // List of projects that contain robot files. Initially empty, will be completed
  // once user starts editing files.
  robotProjectPaths: undefined,
  getSuggestions({editor, bufferPosition, scopeDescriptor, prefix}) {
    prefix = getPrefix(editor, bufferPosition);
    return new Promise(function(resolve) {
      let path = (editor && editor.buffer && editor.buffer.file)?editor.buffer.file.path:undefined
      let suggestions = autocomplete.getSuggestions(prefix, path, provider.settings);
      return resolve(suggestions);
    });
  },
  unload() {
    return this.pathsChangedSubscription.dispose();
  },
  load() {
    this.robotProjectPaths = {};
    // Configuration
    readConfig();
    atom.config.onDidChange(CFG_KEY, function({newValue, oldValue}){
      readConfig();
      for (let path in provider.robotProjectPaths) {
        provider.robotProjectPaths[path].status = 'project-initial';
      }
      reloadAutocompleteData();
    });

    // React on editor changes
    atom.workspace.observeTextEditors(function(editor) {
      const projectOpenStatus = openRobotProjectPathForEditor(editor, provider.settings);
      projectOpenStatus.then((info) =>{
        if(info==='opened' || info==='alreadyopen'){
          let editorSaveSubscription = editor.onDidSave(event => reloadAutocompleteDataForEditor(editor, true, provider.settings));
          let editorStopChangingSubscription = editor.onDidStopChanging(event => reloadAutocompleteDataForEditor(editor, true, provider.settings));
          let editorDestroySubscription = editor.onDidDestroy(function() {
            reloadAutocompleteDataForEditor(editor, false, provider.settings);
            editorSaveSubscription.dispose();
            editorStopChangingSubscription.dispose();
            editorDestroySubscription.dispose();
          });
        }
      })
    });

    // React on project paths changes
    this.pathsChangedSubscription = atom.project.onDidChangePaths(projectPaths => cleanRobotProjectPaths());

    // Atom commands
    atom.commands.add('atom-text-editor', 'Robot Framework:Print autocomplete debug info', () =>  {
      provider.printDebugInfo()
      atom.notifications.addSuccess('Debug info printed in Developer Tools console')
    })
    atom.commands.add('atom-text-editor', 'Robot Framework:Reload autocomplete data', () => {
      for (let path in provider.robotProjectPaths) {
        provider.robotProjectPaths[path].status = 'project-initial';
      }
      reloadAutocompleteData()
      .then((result) => {
        if(result.status === 'scheduled'){
          atom.notifications.addWarning('Autocomplete data loading is currently in progress.', {dismissable: true})
        } else if(result.status === 'reloaded'){
          atom.notifications.addSuccess('Data reloaded')
        } else if(result.status === 'error'){
          atom.notifications.addError(
            `Error occurred during data reloading`,
            {detail: result.message, stack: result.stack, dismissable: true})
        }
      })
    })
    atom.commands.add('atom-text-editor', 'Robot Framework:Show autocomplete status', () => {
      editor = atom.workspace.getActiveTextEditor()
      if(editor){
        status.renderStatus(editor.getPath(), this.settings)
      }
    })
  },

  printDebugInfo() {
    console.log(`Detected robot projects: ${JSON.stringify(provider.robotProjectPaths)}`);
    keywordsRepo.printDebugInfo({
      showRobotFiles: true,
      showLibdocFiles: true,
      showAllSuggestions: true
    });
    libManager.printDebugInfo();
  }
};

module.exports = provider
