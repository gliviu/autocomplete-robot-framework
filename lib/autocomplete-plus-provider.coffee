fs = require 'fs'
pathUtils = require 'path'
os = require 'os'
autocomplete = require './autocomplete'
keywordsRepo = require './keywords'
robotParser = require './parse-robot'
libdocParser = require './parse-libdoc'
libManager = require './library-manager'
common = require './common'

BUILTIN_STANDARD_LIBS = ['BuiltIn', 'Collections', 'DateTime', 'Dialogs', 'OperatingSystem', 'Process', 'Screenshot', 'String', 'Telnet', 'XML']
BUILTIN_EXTERNAL_LIBS = ['FtpLibrary', 'HttpLibrary.HTTP', 'MongoDBLibrary', 'Rammbock', 'RemoteSwingLibrary', 'RequestsLibrary', 'Selenium2Library', 'SeleniumLibrary', 'SSHLibrary', 'SwingLibrary']
BUILTIN_STANDARD_DEFINITIONS_DIR = pathUtils.join(__dirname, '../standard-definitions')
BUILTIN_EXTERNAL_DEFINITIONS_DIR = pathUtils.join(__dirname, '../external-definitions')
CFG_KEY = 'autocomplete-robot-framework'
MAX_FILE_SIZE = 1024 * 1024
MAX_KEYWORDS_SUGGESTIONS_CAP = 100
PYTHON_LIBDOC_DIR = pathUtils.join(os.tmpdir(), 'robot-lib-cache') # Place to store imported Python libdoc files

# Used to avoid multiple concurrent reloadings
scheduleReload = false

isRobotFile = (fileContent, filePath, settings) ->
  ext = pathUtils.extname(filePath)
  if ext == '.robot'
    return true
  if ext in settings.robotExtensions and robotParser.isRobot(fileContent)
    return true
  return false

isLibdocXmlFile = (fileContent, filePath, settings) ->
  ext = pathUtils.extname(filePath)
  return ext is '.xml' and libdocParser.isLibdoc(fileContent)

readdir = (path) ->
  new Promise (resolve, reject) ->
    callback = (err, files) ->
      if err
        reject(err)
      else
        resolve(files)
    fs.readdir(path, callback)

scanDirectory = (path, settings) ->
  return readdir(path).then (result) ->
    promise = Promise.resolve()
    # Chain promises to avoid freezing atom ui
    for name in result
      do (name) ->
        promise = promise.then ->
          return processFile(path, name, fs.lstatSync("#{path}/#{name}"), settings)
    return promise

processFile = (path, name, stat, settings) ->
  fullPath = "#{path}/#{name}"
  ext = pathUtils.extname(fullPath)
  if stat.isDirectory() and name not in settings.excludeDirectories
    return scanDirectory(fullPath, settings)
  if stat.isFile() and stat.size < settings.maxFileSize
    fileContent = fs.readFileSync(fullPath).toString()
    if isRobotFile(fileContent, fullPath, settings)
      console.log "Parsing #{fullPath} ..."  if provider.settings.debug
      parsedRobotInfo = robotParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath)
      return Promise.resolve()
    if settings.processLibdocFiles and isLibdocXmlFile(fileContent, fullPath, settings)
      console.log "Parsing #{fullPath} ..."  if provider.settings.debug
      parsedRobotInfo = libdocParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath)
      return Promise.resolve()
  return Promise.resolve()

loadBuiltInLibraries = (settings) ->
  keywordsRepo.reset(BUILTIN_STANDARD_DEFINITIONS_DIR)
  keywordsRepo.reset(BUILTIN_EXTERNAL_DEFINITIONS_DIR)

  resourcesByName = {}
  for resourceKey, resource of keywordsRepo.resourcesMap
    resourcesByName[resource.name] = resource

  for libraryName in BUILTIN_STANDARD_LIBS
    if !resourcesByName[libraryName] and settings.standardLibrary[libraryName]
      fullPath = pathUtils.join(BUILTIN_STANDARD_DEFINITIONS_DIR, "#{libraryName}.xml")
      fileContent = fs.readFileSync(fullPath).toString()
      console.log "Parsing #{fullPath} ..."  if provider.settings.debug
      parsedRobotInfo = libdocParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath)
  for libraryName in BUILTIN_EXTERNAL_LIBS
    if !resourcesByName[libraryName] and settings.externalLibrary[libraryName]
      fullPath = pathUtils.join(BUILTIN_EXTERNAL_DEFINITIONS_DIR, "#{libraryName}.xml")
      fileContent = fs.readFileSync(fullPath).toString()
      console.log "Parsing #{fullPath} ..."  if provider.settings.debug
      parsedRobotInfo = libdocParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, fullPath)

readConfig = ()->
  settings =
    robotExtensions: ['.robot', '.txt']
    debug: undefined              # True/false for verbose console output
    maxFileSize: undefined        # Files bigger than this will not be loaded in memory
    maxKeywordsSuggestionsCap: undefined  # Maximum number of suggested keywords
    excludeDirectories: undefined # Directories not to be scanned
    removeDotNotation: undefined   # Avoid dot notation in suggestions, ie. BuiltIn.convhex will be suggested as "Convert To Hex" instead of "BuiltIn.Convert To Hex"
    showArguments: undefined      # Shows keyword arguments in suggestions
    processLibdocFiles: undefined # Process '.xml' files representing libdoc definitions
    showLibrarySuggestions: undefined # Suggest library names
    standardLibrary: {}
    externalLibrary: {}
  provider.settings = settings

  settings.debug = atom.config.get("#{CFG_KEY}.debug") || false
  settings.showArguments = atom.config.get("#{CFG_KEY}.showArguments") || false
  settings.maxFileSize = atom.config.get("#{CFG_KEY}.maxFileSize") || MAX_FILE_SIZE
  settings.maxKeywordsSuggestionsCap = atom.config.get("#{CFG_KEY}.maxKeywordsSuggestionsCap") || MAX_KEYWORDS_SUGGESTIONS_CAP
  settings.excludeDirectories = atom.config.get("#{CFG_KEY}.excludeDirectories")
  settings.removeDotNotation = atom.config.get("#{CFG_KEY}.removeDotNotation")
  settings.processLibdocFiles = atom.config.get("#{CFG_KEY}.processLibdocFiles")
  settings.showLibrarySuggestions = atom.config.get("#{CFG_KEY}.showLibrarySuggestions")
  for lib in BUILTIN_STANDARD_LIBS
    settings.standardLibrary[lib]=atom.config.get("#{CFG_KEY}.standardLibrary.#{escapeLibraryName(lib)}")
  for lib in BUILTIN_EXTERNAL_LIBS
    settings.externalLibrary[lib]=atom.config.get("#{CFG_KEY}.externalLibrary.#{escapeLibraryName(lib)}")

# Some library names contain characters forbidden in config property names, such as '.'.
# This function removes offending characters.
escapeLibraryName = (libraryName) ->
    return libraryName.replace(/\./, '');

projectDirectoryExists = (filePath) ->
  try
    return fs.statSync(filePath).isDirectory()
  catch err
    return false
fileExists = (filePath) ->
  try
    return fs.statSync(filePath).isFile()
  catch err
    return false

reloadAutocompleteData = ->
  if provider.loading
    console.log  'Schedule loading autocomplete data' if provider.settings.debug
    scheduleReload = true
  else
    console.log  'Loading autocomplete data' if provider.settings.debug
    provider.loading = true
    promise = Promise.resolve()
    # Chain promises to avoid freezing atom ui due to too many concurrent processes
    for path of provider.robotProjectPaths when (projectDirectoryExists(path) and
    provider.robotProjectPaths[path].status == 'project-initial')
      do (path) ->
        projectName = pathUtils.basename(path)
        console.log  "Loading project #{projectName}" if provider.settings.debug
        console.time "Robot project #{projectName} loading time:" if provider.settings.debug
        provider.robotProjectPaths[path].status = 'project-loading'
        keywordsRepo.reset(path)
        promise = promise.then ->
          return scanDirectory(path, provider.settings).then ->
            console.log  "Project #{projectName} loaded" if provider.settings.debug
            console.timeEnd "Robot project #{projectName} loading time:" if provider.settings.debug
            provider.robotProjectPaths[path].status = 'project-loaded'
    promise = promise.then ->
      console.log 'Importing libraries...' if provider.settings.debug
      return libManager.importLibraries(PYTHON_LIBDOC_DIR, provider.settings)
    .then ->
      loadBuiltInLibraries(provider.settings)
    .then ->
      console.log 'Autocomplete data loaded' if provider.settings.debug
      provider.printDebugInfo()  if provider.settings.debug
      provider.loading = false
      if scheduleReload
        scheduleReload = false
        reloadAutocompleteData()
    .catch (error) ->
      console.error "Error occurred while reloading robot autocomplete data: #{if error.stack then error.stack else error}"
      provider.loading = false
      if scheduleReload
        scheduleReload = false
        reloadAutocompleteData()

# true/false when new libraries have been added since last edit.
isLibraryInfoUpdatedForEditor = (oldLibraries, newLibraries) ->
  oldLibraries = oldLibraries.map((library) -> library.name)
  newLibraries = newLibraries.map((library) -> library.name)
  return !common.arrEqual(oldLibraries, newLibraries)

reloadAutocompleteDataForEditor = (editor, useBuffer, settings) ->
  path = editor.getPath()
  if !path
    return
  dirPath = pathUtils.dirname(path)
  if fileExists(path) and pathUtils.normalize(dirPath)!=PYTHON_LIBDOC_DIR
    fileContent = if useBuffer then editor.getBuffer().getText() else fs.readFileSync(path).toString()
    if isRobotFile(fileContent, path, settings)
      parsedRobotInfo = robotParser.parse(fileContent);
      resourceKey = common.getResourceKey(path)
      oldLibraries = if keywordsRepo.resourcesMap[resourceKey] then keywordsRepo.resourcesMap[resourceKey].libraries else []
      keywordsRepo.addKeywords(parsedRobotInfo, path)
      newLibraries = keywordsRepo.resourcesMap[resourceKey].libraries
      libraryInfoUpdated = isLibraryInfoUpdatedForEditor(oldLibraries, newLibraries)
      if libraryInfoUpdated
        libManager.importLibraries(PYTHON_LIBDOC_DIR, settings)
    else if isLibdocXmlFile(fileContent, path, settings)
      parsedRobotInfo = libdocParser.parse(fileContent);
      keywordsRepo.addKeywords(parsedRobotInfo, path)
    else
      keywordsRepo.reset(path)

updateRobotProjectPathsWhenEditorOpens = (editor, settings) ->
  editorPath = editor.getPath()
  if !editorPath
    return
  dirPath = pathUtils.dirname(editorPath)
  if pathUtils.normalize(dirPath)!=PYTHON_LIBDOC_DIR
    text = editor.getBuffer().getText()
    ext = pathUtils.extname(editorPath)
    isRobot = isRobotFile(text, editorPath, settings)
    for projectPath in getAtomProjectPathsForEditor(editor)
      if !provider.robotProjectPaths[projectPath] and isRobot
        # New robot project detected
        provider.robotProjectPaths[projectPath] = {status: 'project-initial'}
        reloadAutocompleteData()

# Removes paths that are no longer opened in Atom tree view
cleanRobotProjectPaths = () ->
  atomPaths = atom.project.getDirectories().map( (directory) ->
    directory.path
  )
  for path of provider.robotProjectPaths when path not in atomPaths
    delete provider.robotProjectPaths[path]
    keywordsRepo.reset(path)
    console.log  "Removed previously indexed robot projec: '#{path}'" if provider.settings.debug


getAtomProjectPathsForEditor = (editor) ->
  res = []
  editorPath = editor.getPath()
  for projectDirectory in atom.project.getDirectories()
    if projectDirectory.contains(editorPath)
      res.push(projectDirectory.getPath())
  return res


# Normally autocomplete-plus considers '.' as delimiter when building prefixes.
# ie. for 'HttpLibrary.HTTP' it reports only 'HTTP' as prefix.
# This method considers everything until it meets a robot syntax separator (multiple spaces, tabs, ...).
getPrefix = (editor, bufferPosition) ->
  line = editor.lineTextForBufferRow(bufferPosition.row)
  textBeforeCursor = line.substr(0, bufferPosition.column)
  normalized = textBeforeCursor.replace(/[ \t]{2,}/g, '\t')
  reversed = normalized.split("").reverse().join("")
  reversedPrefixMatch = /^[^\t]+/.exec(reversed)
  if(reversedPrefixMatch)
    return reversedPrefixMatch[0].split("").reverse().join("")
  else
    return ''

provider =
  settings : {}
  selector: '.text.robot'
  disableForSelector: '.comment, .variable, .punctuation, .string, .storage, .keyword'
  loading: undefined    # Set to 'true' during autocomplete data async loading
  pathsChangedSubscription: undefined
  # List of projects that contain robot files. Initially empty, will be completed
  # once user starts editing files.
  robotProjectPaths: undefined
  getSuggestions: ({editor, bufferPosition, scopeDescriptor, prefix}) ->
    prefix = getPrefix(editor, bufferPosition)
    new Promise (resolve) ->
      path = editor?.buffer.file?.path
      suggestions = autocomplete.getSuggestions(prefix, path, provider.settings)
      resolve(suggestions)
  unload: ->
    @pathsChangedSubscription.dispose()
  load: ->
    @robotProjectPaths = {}
    # Configuration
    readConfig()
    atom.config.onDidChange CFG_KEY, ({newValue, oldValue})->
      readConfig()
      for path of provider.robotProjectPaths
        provider.robotProjectPaths[path].status = 'project-initial'
      reloadAutocompleteData()

    # React on editor changes
    atom.workspace.observeTextEditors (editor) ->
      updateRobotProjectPathsWhenEditorOpens(editor, provider.settings)

      editorSaveSubscription = editor.onDidSave (event) ->
        reloadAutocompleteDataForEditor(editor, true, provider.settings)
      editorStopChangingSubscription = editor.onDidStopChanging (event) ->
        reloadAutocompleteDataForEditor(editor, true, provider.settings)
      editorDestroySubscription = editor.onDidDestroy ->
        reloadAutocompleteDataForEditor(editor, false, provider.settings)
        editorSaveSubscription.dispose()
        editorStopChangingSubscription.dispose()
        editorDestroySubscription.dispose()

    # React on project paths changes
    @pathsChangedSubscription = atom.project.onDidChangePaths (projectPaths) ->
      cleanRobotProjectPaths()

    # Atom commands
    atom.commands.add 'atom-text-editor', 'Robot Framework:Print autocomplete debug info', ->
      keywordsRepo.printDebugInfo({
        showRobotFiles: true,
        showLibdocFiles: true,
        showAllSuggestions: true
      })
      libManager.printDebugInfo()
    atom.commands.add 'atom-text-editor', 'Robot Framework:Reload autocomplete data', ->
      for path of provider.robotProjectPaths
        provider.robotProjectPaths[path].status = 'project-initial'
      reloadAutocompleteData()

  printDebugInfo: ->
    keywordsRepo.printDebugInfo()

module.exports = provider
