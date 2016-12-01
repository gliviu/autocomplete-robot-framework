'use babel'
import fs from 'fs';
import pathUtils from 'path';
import os from 'os';
import autocomplete from './autocomplete';
import keywordsRepo from './keywords';
import robotParser from './parse-robot';
import libdocParser from './parse-libdoc';
import libManager from './library-manager';
import common from './common';

const BUILTIN_STANDARD_LIBS = ['BuiltIn', 'Collections', 'DateTime', 'Dialogs', 'OperatingSystem', 'Process', 'Screenshot', 'String', 'Telnet', 'XML'];
const BUILTIN_EXTERNAL_LIBS = ['FtpLibrary', 'HttpLibrary.HTTP', 'MongoDBLibrary', 'Rammbock', 'RemoteSwingLibrary', 'RequestsLibrary', 'Selenium2Library', 'SeleniumLibrary', 'SSHLibrary', 'SwingLibrary'];
const BUILTIN_STANDARD_DEFINITIONS_DIR = pathUtils.join(__dirname, '../standard-definitions');
const BUILTIN_EXTERNAL_DEFINITIONS_DIR = pathUtils.join(__dirname, '../external-definitions');
const CFG_KEY = 'autocomplete-robot-framework';
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_KEYWORDS_SUGGESTIONS_CAP = 100;
const PYTHON_LIBDOC_DIR = pathUtils.join(os.tmpdir(), 'robot-lib-cache'); // Place to store imported Python libdoc files

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

function isLibdocXmlFile(fileContent, filePath, settings) {
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
      if (provider.settings.debug) { console.log(`Parsing ${fullPath} ...`); }
      var parsedRobotInfo = robotParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath);
      return Promise.resolve();
    }
    if (settings.processLibdocFiles && isLibdocXmlFile(fileContent, fullPath, settings)) {
      if (provider.settings.debug) { console.log(`Parsing ${fullPath} ...`); }
      var parsedRobotInfo = libdocParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath);
      return Promise.resolve();
    }
  }
  return Promise.resolve();
};

function loadBuiltInLibraries(settings) {
  keywordsRepo.reset(BUILTIN_STANDARD_DEFINITIONS_DIR);
  keywordsRepo.reset(BUILTIN_EXTERNAL_DEFINITIONS_DIR);
  
  let resourcesByName = {};
  for (let resourceKey in keywordsRepo.resourcesMap) {
    let resource = keywordsRepo.resourcesMap[resourceKey];
    resourcesByName[resource.name] = resource;
  }
  
  for (var libraryName of BUILTIN_STANDARD_LIBS) {
    if (!resourcesByName[libraryName] && settings.standardLibrary[libraryName]) {
      let fullPath = pathUtils.join(BUILTIN_STANDARD_DEFINITIONS_DIR, `${libraryName}.xml`);
      let fileContent = fs.readFileSync(fullPath).toString();
      if (provider.settings.debug) { console.log(`Parsing ${fullPath} ...`); }
      let parsedRobotInfo = libdocParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath);
    }
  }
  for (libraryName of BUILTIN_EXTERNAL_LIBS) {
    if (!resourcesByName[libraryName] && settings.externalLibrary[libraryName]) {
      let fullPath = pathUtils.join(BUILTIN_EXTERNAL_DEFINITIONS_DIR, `${libraryName}.xml`);
      let fileContent = fs.readFileSync(fullPath).toString();
      if (provider.settings.debug) { console.log(`Parsing ${fullPath} ...`); }
      let parsedRobotInfo = libdocParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath);
    }
  }
};

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
    standardLibrary: {},
    externalLibrary: {}
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
  for (let lib of BUILTIN_STANDARD_LIBS) {
    settings.standardLibrary[lib]=atom.config.get(`${CFG_KEY}.standardLibrary.${escapeLibraryName(lib)}`);
  }
  return BUILTIN_EXTERNAL_LIBS.map((lib) =>
    settings.externalLibrary[lib]=atom.config.get(`${CFG_KEY}.externalLibrary.${escapeLibraryName(lib)}`));
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
    return scheduleReload = true;
  } else {
    if (provider.settings.debug) { console.log('Loading autocomplete data'); }
    provider.loading = true;
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
          return provider.robotProjectPaths[path].status = 'project-loaded';
        })
      );
    }
  }
  promise.then(function() {
    if (provider.settings.debug) { console.log('Importing libraries...'); }
    return libManager.importLibraries(PYTHON_LIBDOC_DIR, provider.settings);
  })
  .then(() => loadBuiltInLibraries(provider.settings))
  .then(function() {
    if (provider.settings.debug) { console.log('Autocomplete data loaded'); }
    if (provider.settings.debug) { provider.printDebugInfo(); }
    provider.loading = false;
    if (scheduleReload) {
      scheduleReload = false;
      return reloadAutocompleteData();
    }
  })
  .catch(function(error) {
    console.error(`Error occurred while reloading robot autocomplete data: ${error.stack ? error.stack : error}`);
    provider.loading = false;
    if (scheduleReload) {
      scheduleReload = false;
      return reloadAutocompleteData();
    }
  });
}
};

// true/false when new libraries have been added since last edit.
function isLibraryInfoUpdatedForEditor(oldLibraries, newLibraries) {
  oldLibraries = oldLibraries.map(library => library.name);
  newLibraries = newLibraries.map(library => library.name);
  return !common.arrEqual(oldLibraries, newLibraries);
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
      let oldLibraries = keywordsRepo.resourcesMap[resourceKey] ? keywordsRepo.resourcesMap[resourceKey].libraries : [];
      keywordsRepo.addKeywords(parsedRobotInfo, path);
      let newLibraries = keywordsRepo.resourcesMap[resourceKey].libraries;
      let libraryInfoUpdated = isLibraryInfoUpdatedForEditor(oldLibraries, newLibraries);
      if (libraryInfoUpdated) {
        return libManager.importLibraries(PYTHON_LIBDOC_DIR, settings);
      }
    } else if (isLibdocXmlFile(fileContent, path, settings)) {
      var parsedRobotInfo = libdocParser.parse(fileContent);
      return keywordsRepo.addKeywords(parsedRobotInfo, path);
    } else {
      return keywordsRepo.reset(path);
    }
  }
};

function updateRobotProjectPathsWhenEditorOpens(editor, settings) {
  let editorPath = editor.getPath();
  if (!editorPath) {
    return;
  }
  let dirPath = pathUtils.dirname(editorPath);
  if (pathUtils.normalize(dirPath)!==PYTHON_LIBDOC_DIR) {
    let text = editor.getBuffer().getText();
    let ext = pathUtils.extname(editorPath);
    let isRobot = isRobotFile(text, editorPath, settings);
    for (let projectPath of getAtomProjectPathsForEditor(editor)) {
      if (!provider.robotProjectPaths[projectPath] && isRobot) {
        // New robot project detected
        provider.robotProjectPaths[projectPath] = {status: 'project-initial'};
        reloadAutocompleteData();
      }
    }
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
      // let path = __guard__(__guard__(editor, x1 => x1.buffer.file), x => x.path);
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
      return reloadAutocompleteData();
    });
    
    // React on editor changes
    atom.workspace.observeTextEditors(function(editor) {
      let editorDestroySubscription;
      updateRobotProjectPathsWhenEditorOpens(editor, provider.settings);
      
      let editorSaveSubscription = editor.onDidSave(event => reloadAutocompleteDataForEditor(editor, true, provider.settings));
      let editorStopChangingSubscription = editor.onDidStopChanging(event => reloadAutocompleteDataForEditor(editor, true, provider.settings));
      return editorDestroySubscription = editor.onDidDestroy(function() {
        reloadAutocompleteDataForEditor(editor, false, provider.settings);
        editorSaveSubscription.dispose();
        editorStopChangingSubscription.dispose();
        return editorDestroySubscription.dispose();
      });
    });
    
    // React on project paths changes
    this.pathsChangedSubscription = atom.project.onDidChangePaths(projectPaths => cleanRobotProjectPaths());
    
    // Atom commands
    atom.commands.add('atom-text-editor', 'Robot Framework:Print autocomplete debug info', function() {
      keywordsRepo.printDebugInfo({
        showRobotFiles: true,
        showLibdocFiles: true,
        showAllSuggestions: true
      });
      return libManager.printDebugInfo();
    });
    return atom.commands.add('atom-text-editor', 'Robot Framework:Reload autocomplete data', function() {
      for (let path in provider.robotProjectPaths) {
        provider.robotProjectPaths[path].status = 'project-initial';
      }
      return reloadAutocompleteData();
    });
  },
  
  printDebugInfo() {
    return keywordsRepo.printDebugInfo();
  }
};

export default provider;
