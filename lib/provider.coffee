fs = require 'fs'
pathUtils = require 'path'
autocomplete = require './autocomplete'
robotParser = require './parse-robot'
libdocParser = require './parse-libdoc'

STANDARD_LIBS = ['BuiltIn', 'Collections', 'DateTime', 'Dialogs', 'OperatingSystem', 'Process', 'Screenshot', 'String', 'Telnet', 'XML']
EXTERNAL_LIBS = ['FtpLibrary', 'HttpLibrary.HTTP', 'MongoDBLibrary', 'Rammbock', 'RemoteSwingLibrary', 'RequestsLibrary', 'Selenium2Library', 'SeleniumLibrary', 'SSHLibrary', 'SwingLibrary']
STANDARD_DEFINITIONS_DIR = pathUtils.join(__dirname, '../standard-definitions')
EXTERNAL_DEFINITIONS_DIR = pathUtils.join(__dirname, '../external-definitions')
CFG_KEY = 'autocomplete-robot-framework'
MAX_FILE_SIZE = 1024 * 1024

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
      autocomplete.processRobotBuffer(fileContent, fullPath, settings)
      return Promise.resolve()
    if settings.processLibdocFiles and isLibdocXmlFile(fileContent, fullPath, settings)
      autocomplete.processLibdocBuffer(fileContent, fullPath, settings)
      return Promise.resolve()
  return Promise.resolve()


processStandardDefinitionsFile = (dirPath, fileName, settings) ->
  path = pathUtils.join dirPath, fileName
  fileContent = fs.readFileSync(path).toString()
  if isLibdocXmlFile(fileContent, path, settings)
    autocomplete.processLibdocBuffer(fileContent, path, settings)

processStandardDefinitions = (settings) ->
  autocomplete.reset(STANDARD_DEFINITIONS_DIR)
  autocomplete.reset(EXTERNAL_DEFINITIONS_DIR)

  for lib in STANDARD_LIBS
    if settings.standardLibrary[lib]         then processStandardDefinitionsFile(STANDARD_DEFINITIONS_DIR, "#{lib}.xml", settings)
  for lib in EXTERNAL_LIBS
    if settings.externalLibrary[lib]         then processStandardDefinitionsFile(EXTERNAL_DEFINITIONS_DIR, "#{lib}.xml", settings)


readConfig = ()->
  settings =
    matchPrefixStartOnly: false # If true, suggests only if prefix matches start of keyword
    matchFileName: true # If true will show only results from the file name specified by prefix (Ie. 'builtinshould' will return all suggestions from BuiltIn library that contain 'should')
    robotExtensions: ['.robot', '.txt']
    debug: undefined    # True/false for verbose console output
    maxFileSize: undefined    # Files bigger than this will not be loaded in memory
    excludeDirectories: undefined # Directories not to be scanned
    showArguments: undefined # Shows keyword arguments in suggestions
    processLibdocFiles: undefined    # Process '.xml' files representing libdoc definitions
    showLibrarySuggestions: undefined # Suggest library names
    standardLibrary: {}
    externalLibrary: {}
  provider.settings = settings

  settings.debug = atom.config.get("#{CFG_KEY}.debug") || false
  settings.showArguments = atom.config.get("#{CFG_KEY}.showArguments") || false
  settings.maxFileSize = atom.config.get("#{CFG_KEY}.maxFileSize") || MAX_FILE_SIZE
  settings.excludeDirectories = atom.config.get("#{CFG_KEY}.excludeDirectories")
  settings.processLibdocFiles = atom.config.get("#{CFG_KEY}.processLibdocFiles")
  settings.showLibrarySuggestions = atom.config.get("#{CFG_KEY}.showLibrarySuggestions")
  for lib in STANDARD_LIBS
    settings.standardLibrary[lib]=atom.config.get("#{CFG_KEY}.standardLibrary.#{escapeLibraryName(lib)}")
  for lib in EXTERNAL_LIBS
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
    processStandardDefinitions(provider.settings)
    promise = Promise.resolve()
    # Chain promises to avoid freezing atom ui due to too many concurrent processes
    for path of provider.robotProjectPaths when (projectDirectoryExists(path) and
    provider.robotProjectPaths[path].status == 'project-initial')
      do (path) ->
        projectName = pathUtils.basename(path)
        console.log  "Loading project #{projectName}" if provider.settings.debug
        console.time "Robot project #{projectName} loading time:" if provider.settings.debug
        provider.robotProjectPaths[path].status = 'project-loading'
        autocomplete.reset(path)
        promise = promise.then ->
          return scanDirectory(path, provider.settings).then ->
            console.log  "Project #{projectName} loaded" if provider.settings.debug
            console.timeEnd "Robot project #{projectName} loading time:" if provider.settings.debug
            provider.robotProjectPaths[path].status = 'project-loaded'
    promise.then ->
      console.log 'Autocomplete data loaded' if provider.settings.debug
      provider.printDebugInfo()  if provider.settings.debug
      provider.loading = false
      if scheduleReload
        scheduleReload = false
        reloadAutocompleteData()
    .catch (error) ->
      console.error "Error occurred while reloading robot autocomplete data: #{error}"
      provider.loading = false
      if scheduleReload
        scheduleReload = false
        reloadAutocompleteData()


reloadAutocompleteDataForEditor = (editor, useBuffer, settings) ->
  path = editor.getPath()
  if path and fileExists(path)
    fileContent = if useBuffer then editor.getBuffer().getText() else fs.readFileSync(path).toString()
    if isRobotFile(fileContent, path, settings)
      autocomplete.processRobotBuffer(fileContent, path, settings)
    else
      autocomplete.reset(path)

updateRobotProjectPathsWhenEditorOpens = (editor, settings) ->
  editorPath = editor.getPath()
  if editorPath
    text = editor.getBuffer().getText()
    ext = pathUtils.extname(editorPath)
    isRobot = isRobotFile(text, editorPath, settings)
    for projectPath in getAtomProjectPathsForEditor(editor)
      if !provider.robotProjectPaths[projectPath] and isRobot
        # New robot project detected
        provider.robotProjectPaths[projectPath] = {status: 'project-initial'}

        reloadAutocompleteData()

getAtomProjectPathsForEditor = (editor) ->
  res = []
  editorPath = editor.getPath()
  for projectDirectory in atom.project.getDirectories()
    if projectDirectory.contains(editorPath)
      res.push(projectDirectory.getPath())
  return res

provider =
  settings : {}
  selector: '.text.robot'
  disableForSelector: '.comment, .variable, .punctuation, .string, .storage, .keyword'
  loading: undefined    # Set to 'true' during autocomplete data async loading
  # List of projects that contain robot files. Initially empty, will be completed
  # once user starts editing files.
  robotProjectPaths: undefined
  getSuggestions: ({editor, bufferPosition, scopeDescriptor, prefix}) ->
    new Promise (resolve) ->
      path = editor?.buffer.file?.path
      suggestions = autocomplete.getSuggestions(prefix, path, provider.settings)
      resolve(suggestions)
  unload: ->
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

    # Atom commands
    atom.commands.add 'atom-text-editor', 'Robot Framework:Print debug info', ->
      autocomplete.printDebugInfo({
        showRobotFiles: true,
        showLibdocFiles: true,
        showAllSuggestions: true
      })

  printDebugInfo: ->
    autocomplete.printDebugInfo()

module.exports = provider
