pathUtils = require('path')
robotParser = require('../lib/parse-robot')
libdocParser = require('../lib/parse-libdoc')
fs = require 'fs'
PACKAGE_NAME = 'autocomplete-robot-framework'
CFG_KEY = 'autocomplete-robot-framework'

TIMEOUT=5000 #ms

describe 'Autocomplete Robot Provider', ->
  [provider, editor]=[]
  beforeEach ->
    waitsForPromise -> atom.packages.activatePackage(PACKAGE_NAME)
    runs ->
      mainModule = atom.packages.getActivePackage(PACKAGE_NAME).mainModule
      autocompletePlusProvider = mainModule.getAutocompletePlusProvider()
      provider = mainModule.getAutocompleteRobotProvider()
      waitsForPromise -> atom.workspace.open('autocomplete/Test_Autocomplete_Testcase.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
      waitsFor ->
        return !autocompletePlusProvider.loading
      , 'Provider should finish loading', TIMEOUT
  it 'finds keyword by name', ->
    keywords = provider.getKeywordsByName('Run Program')
    expect(keywords).toBeDefined()
    expect(keywords.length).toEqual 1
    keyword = keywords[0]
    resource = provider.getResourceByKey(keyword.resourceKey)
    expect(pathUtils.basename(resource.path)).toEqual 'Test_Autocomplete_Keywords.rOBOt'
  it 'finds duplicated keywords by name', ->
    keywords = provider.getKeywordsByName('non existing keyword')
    expect(keywords).toBeDefined()
    expect(keywords.length).toEqual 0
    keywords = provider.getKeywordsByName('Duplicated keyword')
    expect(keywords).toBeDefined()
    expect(keywords.length).toEqual 2
  it 'finds resource by key', ->
    resource = provider.getResourceByKey('non existing resource')
    expect(resource).not.toBeDefined()
    resourceKey = editor.getPath().toLowerCase()
    resource = provider.getResourceByKey(resourceKey)
    expect(resource).toBeDefined()
    expect(resource.keywords.length).toBeGreaterThan 0
    expect(resource.keywords[0].name).toEqual 'Private keyword'
  it 'provides all keyword names', ->
    kwNames = provider.getKeywordNames()
    expect(kwNames).toContain('Run Program', 'Dot.punctuation keyword', 'Duplicated keyword')
    expect(kwNames.indexOf('Duplicated keyword')).toEqual(kwNames.lastIndexOf('Duplicated keyword'))
    for name in kwNames
      keywords = provider.getKeywordsByName(name)
      expect(keywords.length).toBeGreaterThan 0
  it 'provides all resource keys', ->
    resourceKeys = provider.getResourceKeys()
    resourceNames = []
    for resourceKey in resourceKeys
      resourceNames.push(pathUtils.basename(resourceKey))
    expect(resourceNames).toContain 'test_autocomplete_keywords.robot'
    for resourceKey in resourceKeys
      resource = provider.getResourceByKey(resourceKey)
      expect(resource).toBeDefined()
  it 'provides library source information', ->
    keywords = provider.getKeywordsByName('Should Match')
    expect(keywords).toBeDefined()
    expect(keywords.length).toEqual 1
    keyword = keywords[0]
    resource = provider.getResourceByKey(keyword.resourceKey)
    expect(resource.libraryPath).toContain '.py'
