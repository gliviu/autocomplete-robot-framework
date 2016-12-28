robotParser = require('../lib/parse-robot')
libdocParser = require('../lib/parse-libdoc')
common = require('../lib/common')
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
    process.env.PYTHONPATH=pathUtils.join(__dirname, '../fixtures/libraries')
    waitsForPromise -> atom.packages.activatePackage(PACKAGE_NAME)
    runs ->
      provider = atom.packages.getActivePackage(PACKAGE_NAME).mainModule.getAutocompletePlusProvider()
    waitsForPromise -> atom.workspace.open('autocomplete/test_autocomplete_keywords.robot')
    waitsFor ->
      return !provider.loading
    , 'Provider should finish loading', 500
    runs ->
      editor = atom.workspace.getActiveTextEditor()

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

  describe 'Library management', ->
    beforeEach ->
      waitsForPromise -> atom.workspace.open('autocomplete/Test_Libraries.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
    it 'should import modules', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.setText('  testmod')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(2)
          expect(suggestions[0].type).toEqual('import')
          expect(suggestions[0].displayText).toEqual('TestModule')
          expect(suggestions[1].type).toEqual('keyword')
          expect(suggestions[1].displayText).toEqual('Test Module Keyword')
          expect(suggestions[1].description).toEqual('Test module documentation. Arguments: param1, param2')
    it 'should import classes', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.setText('  testclas1')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Test Class Keyword 1')
          expect(suggestions[0].description).toEqual('Test class documentation. Arguments: param1')
    it 'should handle classes with import parameters', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  testclparam')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Test Class Keyword Params')
    it 'should import Robot Framework builtin libraries', ->
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.setText('  appefi')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Append To File')
    it 'should not suggest private keywords', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.setText('  package.modules.TestModule.')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)

  describe 'Scope modifiers', ->
    it 'reacts on removeDotNotation configuration changes', ->
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
    describe 'Default scope modifiers', ->
      it 'limits suggestions to current imports', ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        runs ->
          editor.insertText('  k')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            suggestedUnits = new Set()
            for suggestion in suggestions when suggestion.type is 'keyword'
              suggestedUnits.add(suggestion.rightLabel)
            expect(['Test_Autocomplete_Libdoc', 'FileSizeLimit', 'BuiltIn', 'Test_Autocomplete_Keywords', 'package.modules.TestModule'].sort()).toEqual(Array.from(suggestedUnits).sort())
      it 'suggests all keywords from resources having the same name', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  utility')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(2)
            expect(suggestions[0].type).toEqual('keyword')
            expect(suggestions[0].snippet).toEqual('utility 1')
            expect(suggestions[1].type).toEqual('keyword')
            expect(suggestions[1].snippet).toEqual('utility 2')
        waitsForPromise -> atom.workspace.open('autocomplete/test_autocomplete_testcase.robot')
        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  utility')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].type).toEqual('keyword')
            expect(suggestions[0].snippet).toEqual('utility 1 text')

    describe 'File scope modifiers', ->
      it 'supports file scope modifier with libraries containing dot in their name', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  HttpLibrary.HTTP.d')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(0)
            expect(suggestions[0]?.displayText).toEqual('DELETE')
      it 'supports file scope modifier with resources', ->
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
      it 'suggests all keywords from resources having the same name', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  utils.')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(3)
            expect(suggestions[0].type).toEqual('keyword')
            expect(suggestions[0].snippet).toEqual('utility 1')
            expect(suggestions[1].type).toEqual('keyword')
            expect(suggestions[1].snippet).toEqual('utility 1 text')
            expect(suggestions[2].type).toEqual('keyword')
            expect(suggestions[2].snippet).toEqual('utility 2')
      it 'does not suggests keywords if resource/library name is incomplete', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  FilePrefi.')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(10)
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  FilePrefix2.')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(10)
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  package.modules.TestModul.')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(10)
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  package.modules.TestModule2.')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(10)
      it 'suggests library names that are imported in other robot files', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  operatings')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('OperatingSystem')
      it 'does not not suggest library names that are not imported in any robot file', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  screensho') # Builtin screenshot library
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)
      it 'suggests BuiltIn library even if it is not imported in any robot file', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  builtin') # Builtin screenshot library
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('BuiltIn')
      it 'supports mixed case for library name suggestions', ->
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
      it 'suggests libraries by their short name', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  TestModule')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(1)
            expect(suggestions[0].type).toEqual('import')
            expect(suggestions[0].text).toEqual('package.modules.TestModule')
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  TestClass')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(1)
            expect(suggestions[0].type).toEqual('import')
            expect(suggestions[0].text).toEqual('package.classes.TestClass')
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  RobotFile')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].type).toEqual('import')
            expect(suggestions[0].text).toEqual('namespace.separated.RobotFile')
      it 'suggests libraries by their full name', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  package')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(3)
            expect(suggestions[0].type).toEqual('import')
            expect(suggestions[0].text).toEqual('package.classes.TestClass')
            expect(suggestions[1].type).toEqual('import')
            expect(suggestions[1].text).toEqual('package.classes.TestClassParams')
            expect(suggestions[2].type).toEqual('import')
            expect(suggestions[2].text).toEqual('package.modules.TestModule')
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  namespace')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].type).toEqual('import')
            expect(suggestions[0].text).toEqual('namespace.separated.RobotFile')
      it 'supports file scope modifier with mixed case', ->
        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  BUILTIN.CALLME')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Call Method')
    describe 'Global scope modifiers', ->
      it 'supports global scope modifier', ->
        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  glob.appendfil')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Append To File')
      it 'suggests all keywords from resources having the same name', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  glob.utility')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toBeGreaterThan(2)
            expect(suggestions[0].type).toEqual('keyword')
            expect(suggestions[0].snippet).toEqual('utility 1')
            expect(suggestions[1].type).toEqual('keyword')
            expect(suggestions[1].snippet).toEqual('utility 2')
    describe 'Internal scope modifiers', ->
      it 'supports internal scope modifier', ->
        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  this.k')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(5)
            expect(suggestions[0]?.displayText).toEqual('Test keyword')
            expect(suggestions[1]?.displayText).toEqual('priv.keyword')
            expect(suggestions[2]?.displayText).toEqual('Priv test keyword')
            expect(suggestions[3]?.displayText).toEqual('Duplicated keyword')
            expect(suggestions[4]?.displayText).toEqual('Dot.punctuation keyword')
    describe 'Unknown scope modifiers', ->
      it 'behaves exactly as default scope modifier', ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        runs ->
          editor.insertText('  UnkwnownLibrary.k')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            suggestedUnits = new Set()
            for suggestion in suggestions when suggestion.type is 'keyword'
              suggestedUnits.add(suggestion.rightLabel)
            expect(['Test_Autocomplete_Libdoc', 'FileSizeLimit', 'BuiltIn', 'Test_Autocomplete_Keywords', 'package.modules.TestModule'].sort()).toEqual(Array.from(suggestedUnits).sort())

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
            expect(suggestions[0].displayText).toEqual('Limit File Size Keyword')
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
