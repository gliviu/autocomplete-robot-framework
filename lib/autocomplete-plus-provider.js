'use babel'
const fs = require('fs')
const pathUtils = require('path')
const os = require('os')
const minimatch = require('minimatch')
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

const FALLBACK_LIBRARY_DIR = pathUtils.join(__dirname, '../fallback-libraries');


// Used to avoid multiple concurrent reloadings
let scheduleReload = false;

function isRobotFile(fileContent, filePath, settings) {
  let ext = pathUtils.extname(filePath);
  if (ext.toLowerCase() === '.robot') {
    return true;
  }
  if (settings.robotExtensions.includes(ext.toLowerCase()) && robotParser.isRobot(fileContent)) {
    return true;
  }
  return false;
};

function isLibdocXmlFile(fileContent, filePath) {
  let ext = pathUtils.extname(filePath);
  return ext.toLowerCase() === '.xml' && libdocParser.isLibdoc(fileContent);
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
  if(settings.excludeDirectories){
    const matched = settings.excludeDirectories.filter(pattern => minimatch(name, pattern))
    if(matched.length > 0){
      return Promise.resolve();
    }
  }
  let fullPath = `${path}/${name}`;
  let ext = pathUtils.extname(fullPath);
  if (stat.isDirectory()) {
    return scanDirectory(fullPath, settings);
  }
  if (stat.isFile() && stat.size < settings.maxFileSize) {
    let fileContent = fs.readFileSync(fullPath).toString();
    if (isRobotFile(fileContent, fullPath, settings)) {
      var parsedRobotInfo = robotParser.parse(fileContent);
      keywordsRepo.addResource(parsedRobotInfo, fullPath);
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
    suggestArguments: undefined,      // Add arguments after keyword name when suggesting
    includeDefaultArguments: undefined,      // Include default keyword arguments (ie. level=INFO) among sugested arguments
    processLibdocFiles: undefined, // Process '.xml' files representing libdoc definitions
    showLibrarySuggestions: undefined, // Suggest library names
    internalScopeModifier: undefined, // If used, internal scope modifier will suggest only keywords from local resource
    pythonExecutable: undefined,  // Python command name or path
  };
  provider.settings = settings;

  // hidden settings
  settings.internalScopeModifier = atom.config.get(`${CFG_KEY}.internalScopeModifier`) || 'this';
  settings.showArguments = atom.config.get(`${CFG_KEY}.showArguments`) || false;
  settings.maxFileSize = atom.config.get(`${CFG_KEY}.maxFileSize`) || MAX_FILE_SIZE;
  settings.maxKeywordsSuggestionsCap = atom.config.get(`${CFG_KEY}.maxKeywordsSuggestionsCap`) || MAX_KEYWORDS_SUGGESTIONS_CAP;

  settings.debug = atom.config.get(`${CFG_KEY}.debug`);
  settings.suggestArguments = atom.config.get(`${CFG_KEY}.suggestArguments`);
  settings.includeDefaultArguments = atom.config.get(`${CFG_KEY}.includeDefaultArguments`);
  settings.argumentSeparator = atom.config.get(`${CFG_KEY}.argumentSeparator`);
  settings.excludeDirectories = atom.config.get(`${CFG_KEY}.excludeDirectories`);
  settings.removeDotNotation = atom.config.get(`${CFG_KEY}.removeDotNotation`);
  settings.processLibdocFiles = atom.config.get(`${CFG_KEY}.processLibdocFiles`);
  settings.showLibrarySuggestions = atom.config.get(`${CFG_KEY}.showLibrarySuggestions`);
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

function getFallbackLibraryPaths(fallbackLibraryDir){
  try{
    return fs.readdirSync(fallbackLibraryDir).map(fileName => pathUtils.join(fallbackLibraryDir, fileName))
  } catch(error){
    console.error(error.stack ? error.stack : error)
    return []
  }
}

function processAllImportsFirstPass(){
  const missingRessourcePaths = keywordsRepo.resolveAllImports()
  return missingRessourcePaths
}

function processResourceImportsFirstPass(resourceKey){
  const resource = keywordsRepo.resourcesMap[resourceKey]
  if(resource){
    const missingRessourcePaths = keywordsRepo.resolveImports(resource)
    return missingRessourcePaths
  } else{
    return new Set()
  }
}

function processImportsSecondPass(missingRessourcePaths){
  let newResources = 0
  missingRessourcePaths.forEach(importedPath => {
    console.log(`importedPath: ${importedPath}`);
    const fileContent = fs.readFileSync(importedPath).toString()
    if (isRobotFile(fileContent, importedPath, provider.settings)) {
      const parsedRobotInfo = robotParser.parse(fileContent);
      keywordsRepo.addResource(parsedRobotInfo, importedPath);
      newResources++
    }
  })
  if(newResources>0){
    keywordsRepo.resolveAllImports()
  }
}

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
    if (provider.settings.debug) { console.log('Resolving imports...'); }
    if (provider.settings.debug) { console.time(`Imports resolved in`); }
    const missingRessourcePaths = processAllImportsFirstPass()
    processImportsSecondPass(missingRessourcePaths)
    if (provider.settings.debug) { console.timeEnd(`Imports resolved in`); }
  })
  .then(() => {
    if (provider.settings.debug) { console.log('Importing libraries...'); }
    const fallbackLibrariesPaths = getFallbackLibraryPaths(FALLBACK_LIBRARY_DIR)
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
      keywordsRepo.addResource(parsedRobotInfo, path);
      const missingRessourcePaths = processResourceImportsFirstPass(resourceKey)
      processImportsSecondPass(missingRessourcePaths)
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

const bddPrefixRegex = /^(given|when|then|and|but) /i
function processBddPrefixes(prefix) {
  const prefixes = [prefix]
  const match = bddPrefixRegex.exec(prefix)
  if(match) {
    prefixes.push(prefix.substring(match[0].length, prefix.length))
  }
  return prefixes
}

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
    prefixes = processBddPrefixes(prefix)
    return new Promise(function(resolve) {
      let allSuggestions = []
      let path = (editor && editor.buffer && editor.buffer.file)?editor.buffer.file.path:undefined
      for(pref of prefixes) {
        const suggestions = autocomplete.getSuggestions(pref, path, provider.settings);
        allSuggestions = allSuggestions.concat(suggestions)
      }
      return resolve(allSuggestions);
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
      if (provider.loading) {
        atom.notifications.addWarning('Autocomplete data loading is currently in progress.', {dismissable: true})
        return
      }
      keywordsRepo.reset()
      libManager.reset()
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
