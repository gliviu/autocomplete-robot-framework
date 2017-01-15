autocompletePlusProvider = require './autocomplete-plus-provider'
autocompleteRobotProvider = require('./autocomplete-robot-provider')

module.exports =
  activate: -> autocompletePlusProvider.load()
  deactivate: -> autocompletePlusProvider.unload()
  getAutocompletePlusProvider: -> autocompletePlusProvider
  getAutocompleteRobotProvider: -> autocompleteRobotProvider
  config:
    processLibdocFiles:
      title: 'Scan projects for libdoc xml files'
      type: 'boolean'
      default: true
      order: 2
    showLibrarySuggestions:
      title: 'Show library name suggestions'
      type: 'boolean'
      default: true
      order: 3
    removeDotNotation:
      title: 'Avoid dot notation in suggestions, ie. \'BuiltIn.convhex\' will be suggested as \'Convert To Hex\' instead of \'BuiltIn.Convert To Hex\''
      type: 'boolean'
      default: true
      order: 4
    suggestArguments:
      title: 'Add arguments after keyword name'
      type: 'boolean'
      default: true
      order: 5
    includeDefaultArguments:
      title: 'Include keyword arguments with default values among sugested arguments'
      type: 'boolean'
      default: false
      order: 6
    excludeDirectories:
      title: 'Names of directories or files to be excluded from showing suggestions (comma sepparated)'
      type: 'array'
      default: []
      items:
        type: 'string'
      order: 10
    globalScopeModifier:
      title: 'Names of directories or files to be excluded from showing suggestions (comma sepparated)'
      type: 'string'
      default: 'glob'
      order: 11
    internalScopeModifier:
      title: 'Names of directories or files to be excluded from showing suggestions (comma sepparated)'
      type: 'string'
      default: 'this'
      order: 12
    pythonExecutable:
      title: 'Python executable'
      type: 'string'
      default: 'python'
      order: 13
    debug:
      title: 'Debug'
      type: 'boolean'
      default: false
      order: 200
