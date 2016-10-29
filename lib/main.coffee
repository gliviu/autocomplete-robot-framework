provider = require './provider'
autocompleteRobotProvider = require('./autocomplete-robot-provider')

module.exports =
  activate: -> provider.load()
  deactivate: -> provider.unload()
  getAutocompletePlusProvider: -> provider
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
    standardLibrary:
      title: 'Standard library autocomplete'
      type: 'object'
      order: 50
      properties:
        BuiltIn:
          title: 'Show BuiltIn suggestions'
          type: 'boolean'
          default: true
        Collections:
          title: 'Show Collections suggestions'
          type: 'boolean'
          default: true
        DateTime:
          title: 'Show DateTime suggestions'
          type: 'boolean'
          default: true
        Dialogs:
          title: 'Show Dialogs suggestions'
          type: 'boolean'
          default: true
        OperatingSystem:
          title: 'Show OperatingSystem suggestions'
          type: 'boolean'
          default: true
        Process:
          title: 'Show Process suggestions'
          type: 'boolean'
          default: true
        Screenshot:
          title: 'Show Screenshot suggestions'
          type: 'boolean'
          default: true
        String:
          title: 'Show String suggestions'
          type: 'boolean'
          default: true
        Telnet:
          title: 'Show Telnet suggestions'
          type: 'boolean'
          default: true
        XML:
          title: 'Show XML suggestions'
          type: 'boolean'
          default: true
    externalLibrary:
      title: 'External library autocomplete'
      type: 'object'
      order: 100
      properties:
        FtpLibrary:
          title: 'Show FtpLibrary suggestions'
          type: 'boolean'
          default: false
        HttpLibraryHTTP:
          title: 'Show HttpLibrary.HTTP suggestions'
          type: 'boolean'
          default: false
        MongoDBLibrary:
          title: 'Show MongoDBLibrary suggestions'
          type: 'boolean'
          default: false
        Rammbock:
          title: 'Show Rammbock suggestions'
          type: 'boolean'
          default: false
        RemoteSwingLibrary:
          title: 'Show RemoteSwingLibrary suggestions'
          type: 'boolean'
          default: false
        RequestsLibrary:
          title: 'Show RequestsLibrary suggestions'
          type: 'boolean'
          default: false
        Selenium2Library:
          title: 'Show Selenium2Library suggestions'
          type: 'boolean'
          default: false
        SeleniumLibrary:
          title: 'Show SeleniumLibrary suggestions'
          type: 'boolean'
          default: false
        SSHLibrary:
          title: 'Show SSHLibrary suggestions'
          type: 'boolean'
          default: false
        SwingLibrary:
          title: 'Show SwingLibrary suggestions'
          type: 'boolean'
          default: false
    debug:
      title: 'Debug'
      type: 'boolean'
      default: false
      order: 200
