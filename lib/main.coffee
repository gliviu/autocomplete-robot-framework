autocompletePlusProvider = require './autocomplete-plus-provider'
autocompleteRobotProvider = require('./autocomplete-robot-provider')

module.exports =
  activate: -> autocompletePlusProvider.load()
  deactivate: -> autocompletePlusProvider.unload()
  getAutocompletePlusProvider: -> autocompletePlusProvider
  getAutocompleteRobotProvider: -> autocompleteRobotProvider
  config:
    processLibdocFiles:
      title: 'Show suggestions from libdoc definition files'
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
    excludeDirectories:
      title: 'Names of directories or files to be excluded from showing suggestions (comma sepparated)'
      type: 'array'
      default: []
      items:
        type: 'string'
      order: 5
    globalScopeModifier:
      title: 'Names of directories or files to be excluded from showing suggestions (comma sepparated)'
      type: 'string'
      default: 'glob'
      items:
        type: 'string'
      order: 6
    internalScopeModifier:
      title: 'Names of directories or files to be excluded from showing suggestions (comma sepparated)'
      type: 'string'
      default: 'this'
      items:
        type: 'string'
      order: 7
    debug:
      title: 'Debug'
      type: 'boolean'
      default: false
      order: 200
