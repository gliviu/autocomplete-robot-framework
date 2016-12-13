robotParser = require('../lib/parse-robot')
libdocParser = require('../lib/parse-libdoc')
fs = require 'fs'
pathUtils = require 'path'
PACKAGE_NAME = 'autocomplete-robot-framework'
CFG_KEY = 'autocomplete-robot-framework'

# Credits - https://raw.githubusercontent.com/atom/autocomplete-atom-api/master/spec/provider-spec.coffee
getCompletions = (editor, provider)->
  cursor = editor.getLastCursor()
  start = cursor.getBeginningOfCurrentWordBufferPosition()
  end = cursor.getBufferPosition()
  prefix = editor.getTextInRange([start, end])
  request =
    editor: editor
    bufferPosition: end
    scopeDescriptor: cursor.getScopeDescriptor()
    prefix: prefix
  provider.getSuggestions(request)

describe 'Robot Framework keywords autocompletions', ->
  [editor, provider] = []
  beforeEach ->
    waitsForPromise -> atom.packages.activatePackage(PACKAGE_NAME)
    runs ->
      provider = atom.packages.getActivePackage(PACKAGE_NAME).mainModule.getAutocompletePlusProvider()
    waitsForPromise -> atom.workspace.open('autocomplete/test_autocomplete_keywords.robot')
    waitsFor ->
      return !provider.loading
    , 'Provider should finish loading', 500
    runs ->
      editor = atom.workspace.getActiveTextEditor()

  describe 'Library management', ->
    process.env.PYTHONPATH=pathUtils.join(__dirname, '../fixtures/libraries')
    beforeEach ->
      waitsForPromise -> atom.workspace.open('autocomplete/Test_Libraries.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
    it 'should import modules', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.setText('  testmod')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Test Module Keyword')
          expect(suggestions[0].description).toEqual('Test module documentation. Arguments: param1, param2')
    it 'should import classes', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.setText('  testclas')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Test Class Keyword')
          expect(suggestions[0].description).toEqual('Test class documentation. Arguments: param1')
    it 'should import Robot Framework builtin libraries', ->
      runs ->
        atom.config.set("#{CFG_KEY}.standardLibrary.OperatingSystem", false)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.setText('  appefi')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Append To File')

  describe 'Keywords autocomplete', ->
    it 'suggest standard keywords', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.insertText('  callm')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Call Method')
    it 'suggest keywords in current editor', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.insertText('  runprog')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Run Program')
    it 'shows documentation in suggestions', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  withdoc')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(3)
          expect(suggestions[0]?.displayText).toEqual('With documentation')
          expect(suggestions[0]?.description).toEqual('documentation. Arguments: arg1, arg2, arg3')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  withdoc2')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('With documentation 2')
          expect(suggestions[0]?.description).toEqual('documentation. Arguments: arg1, arg2, arg3')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  withoutdoc')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('Without documentation')
          expect(suggestions[0]?.description).toEqual(' Arguments: arg1, arg2, arg3')
    it 'shows arguments in suggestions', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  witharg')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('With arguments')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  withoutarg')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('Without arguments')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  withdefarg')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('With default value arguments')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  withemb')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('With embedded ${arg1} arguments ${arg2}')
    it 'accept prefix containing dot', ->
      runs ->
        atom.config.set("#{CFG_KEY}.externalLibrary.HttpLibraryHTTP", true)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  HttpLibrary.HTTP.d')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('DELETE')
    it 'shows suggestions from current editor first', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.insertText('  run')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(2)
          expect(suggestions[0]?.displayText).toEqual('Run Program')
    it 'does not show keywords private to other files', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.insertText('  privatek')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(0)
    it 'shows keywords visible only inside current file', ->
      waitsForPromise -> atom.workspace.open('autocomplete/test_autocomplete_testcase.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  privatek')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Private keyword')
    it 'matches beginning of word', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  dp')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(1)
          expect(suggestions[0]?.displayText).toEqual('Dot.punctuation keyword')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  dot')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(1)
          expect(suggestions[0]?.displayText).toEqual('Dot.punctuation keyword')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  punct')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Dot.punctuation keyword')
    it 'supports mixed case', ->
      waitsForPromise -> atom.workspace.open('autocomplete/test_autocomplete_testcase.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  callme')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  CALLME')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
    it 'suggests nothing for empty prefix', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('    ')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(0)
    it 'supports multi-word suggestions', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('  with def val arg')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('With default value arguments')
      runs ->
        editor.insertText('  with args    with def val arg')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('With default value arguments')
      runs ->
        editor.insertText('  withdef valarg')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('With default value arguments')
      runs ->
        editor.insertText('  w d v a')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('With default value arguments')
      runs ->
        editor.insertText('  there should be no keyword')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(0)

  describe 'Dot notation', ->
    it 'supports dot notation', ->
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  fileprefix.')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(2)
          expect(suggestions[0]?.displayText).toEqual('File keyword 1')
          expect(suggestions[1]?.displayText).toEqual('File keyword 2')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin.callme')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin.')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(1)
          expect(suggestions[0]?.displayText).not.toEqual('BuiltIn')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('BuiltIn')
    it 'react on removeDotNotation configuration changes', ->
      runs ->
        atom.config.set("#{CFG_KEY}.removeDotNotation", true)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin.callme')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
          expect(suggestions[0]?.replacementPrefix).toEqual('builtin.callme')
      runs ->
        atom.config.set("#{CFG_KEY}.removeDotNotation", false)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin.callme')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
          expect(suggestions[0]?.replacementPrefix).toEqual('callme')
    it 'supports dot notation with mixed case', ->
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  BUILTIN.CALLME')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
    it 'does not replace unknown library name when dot notation is used', ->
      runs ->
        atom.config.set("#{CFG_KEY}.removeDotNotation", true)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  UnknownLibrary.callmethod')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
          expect(suggestions[0]?.replacementPrefix).toEqual('callmethod');
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin.callme')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Call Method')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin.')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(1)
          expect(suggestions[0]?.displayText).not.toEqual('BuiltIn')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  builtin')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('BuiltIn')

  describe 'Library name autocomplete', ->
    it 'suggest library names', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  built')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('BuiltIn')
    it 'support mixed case for library name suggestions', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  BUILT')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('BuiltIn')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  bUilTi')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('BuiltIn')

  describe 'Autocomplete configuration', ->
    it 'react on showArguments configuration changes', ->
      runs ->
        atom.config.set("#{CFG_KEY}.showArguments", true)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  runprog')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Run Program - args')
      runs ->
        atom.config.set("#{CFG_KEY}.showArguments", false)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  runprog')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('Run Program')
    it 'react on excludeDirectories configuration changes', ->
      runs ->
        atom.config.set("#{CFG_KEY}.excludeDirectories", [])
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  runprog')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Run Program')
      runs ->
        atom.config.set("#{CFG_KEY}.excludeDirectories", ['autocomplete'])
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  runprog')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)
    it 'react on processLibdocFiles configuration changes', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  autocompletelibdoc')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('Autocomplete libdoc test')
      runs ->
        atom.config.set("#{CFG_KEY}.processLibdocFiles", false)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  autocompletelibdoc')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)
    it 'react on maxFileSize configuration changes', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  limitfilesize')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('Limit File Size')
      runs ->
        atom.config.set("#{CFG_KEY}.maxFileSize", 39)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  limitfilesize')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)
    it 'react on showLibrarySuggestions configuration changes', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  built')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('BuiltIn')
      runs ->
        atom.config.set("#{CFG_KEY}.showLibrarySuggestions", false)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', 500
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  built')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)
