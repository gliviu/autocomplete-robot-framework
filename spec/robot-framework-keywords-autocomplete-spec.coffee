robotParser = require('../lib/parse-robot')
libdocParser = require('../lib/parse-libdoc')
libRepo = require('../lib/library-repo')
libManager = require('../lib/library-manager')
keywordsRepo = require('../lib/keywords')
common = require('../lib/common')
fs = require 'fs'
pathUtils = require 'path'
PACKAGE_NAME = 'autocomplete-robot-framework'
CFG_KEY = 'autocomplete-robot-framework'

TIMEOUT=5000 #ms
SEP = pathUtils.sep

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
    waitsFor ->
      return !libManager.loading()
    , 'Provider should finish loading', TIMEOUT
    runs ->
      process.env.PYTHONPATH=pathUtils.join(__dirname, '../fixtures/libraries')
      libRepo.reset()
      libManager.reset()
      keywordsRepo.reset()
    waitsForPromise -> atom.packages.activatePackage(PACKAGE_NAME)
    runs ->
      provider = atom.packages.getActivePackage(PACKAGE_NAME).mainModule.getAutocompletePlusProvider()
    waitsForPromise -> atom.workspace.open('autocomplete/test_autocomplete_keywords.rOBOt')
    waitsFor ->
      return !provider.loading
    , 'Provider should finish loading', TIMEOUT
    runs ->
      editor = atom.workspace.getActiveTextEditor()

  describe 'Keywords autocomplete', ->
    it 'suggests standard keywords', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.insertText('  callm')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Call Method')
    it 'suggests keywords in current editor', ->
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
          expect(suggestions[0].displayText).toEqual('With default value arguments')
          expect(suggestions[0].description).toEqual(' Arguments: arg1=default value ${VARIABLE1}, arg2, arg3, arg4, arg5=default value, arg6=${VARIABLE1} and ${VARIABLE2}')
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
    it 'is able to disable arguments suggestions', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('  log')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('Log    ${1:message}')
      runs ->
        atom.config.set("#{CFG_KEY}.suggestArguments", false)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  log')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('Log')
    it 'is able to hide optional arguments', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('  log')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('Log    ${1:message}')
      runs ->
        atom.config.set("#{CFG_KEY}.includeDefaultArguments", true)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  log')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('Log    ${1:message}    ${2:level=INFO}    ${3:html=False}    ${4:console=False}    ${5:repr=False}')
    it 'supports changing argument separator', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('  runkeyword')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('Run Keyword    ${1:name}    ${2:*args}')
      runs ->
        atom.config.set("#{CFG_KEY}.argumentSeparator", ' | ')
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  runkeyword')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('Run Keyword | ${1:name} | ${2:*args}')
    it 'supports unicode characters in keyword names and arguments', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('  thé')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('The é char is here')
          expect(suggestions[0].description).toEqual(' Arguments: é1=é1 val, é2=${é3} val')

  describe 'Keywords autocomplete in *Settings* section', ->
    beforeEach ->
      console.log (editor.getText())
      console.log (editor.getPath())
      waitsForPromise -> atom.workspace.open('autocomplete/settings.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
    it 'autocompletes keywords in test/suite setup', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('\nTest Setup  runkeys')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('Run Keywords')
    it 'suggests library names', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('\nLibrary  built')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('BuiltIn')
    it 'suggests resource names', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('\nResource  filepref')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0]?.displayText).toEqual('FilePrefix')

  describe 'BDD autocomplete', ->
    beforeEach ->
      waitsForPromise -> atom.workspace.open('autocomplete/bdd.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
    it 'suggests keywords using BDD notation', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      runs ->
        editor.insertText('  given welc')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('welcome page should be open')
      runs ->
        editor.insertText('  when welc')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('welcome page should be open')
      runs ->
        editor.insertText('  then welc')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('welcome page should be open')
      runs ->
        editor.insertText('  and welc')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('welcome page should be open')
      runs ->
        editor.insertText('  but welc')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0].displayText).toEqual('welcome page should be open')

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
    it 'should import Robot Framework builtin libraries when python environment is not available', ->
      runs ->
        atom.config.set("#{CFG_KEY}.pythonExecutable", 'invalid_python_executable')
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.setText('  appefi')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Append To File')
          expect(pathUtils.normalize(suggestions[0].keyword.resource.path)).toContain(pathUtils.normalize('fallback-libraries/OperatingSystem.xml'))
    it 'should not suggest private keywords', ->
      editor.setCursorBufferPosition([Infinity, Infinity])
      editor.setText('  package.modules.TestModule.')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
    it 'should import libraries that are not in pythonpath and reside along with robot files', ->
      waitsForPromise -> atom.workspace.open('autocomplete/a/utils.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  interk')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].displayText).toEqual('Internal Python Kw')

  describe 'Scope modifiers', ->
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
            expect(['Test_Autocomplete_Libdoc', 'FileSizeLimit.robot', 'BuiltIn', 'Test_Autocomplete_Keywords.rOBOt', 'TestModule'].sort()).toEqual(Array.from(suggestedUnits).sort())
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
      it 'reacts on removeDotNotation configuration changes', ->
        runs ->
          atom.config.set("#{CFG_KEY}.removeDotNotation", true)
        waitsFor ->
          return !provider.loading
        , 'Provider should finish loading', TIMEOUT
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
        , 'Provider should finish loading', TIMEOUT
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  builtin.callme')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Call Method')
            expect(suggestions[0]?.replacementPrefix).toEqual('callme')
    describe 'Global scope modifiers', ->
      it 'supports global scope modifier', ->
        runs ->
          editor = atom.workspace.getActiveTextEditor()
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  .appendfil')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Append To File')
      it 'suggests all keywords from resources having the same name', ->
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  .utility')
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
      it 'has same suggestions as default scope modifier', ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        runs ->
          editor.insertText('  UnkwnownLibrary.k')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            suggestedUnits = new Set()
            for suggestion in suggestions when suggestion.type is 'keyword'
              suggestedUnits.add(suggestion.rightLabel)
            expect(['Test_Autocomplete_Libdoc', 'FileSizeLimit.robot', 'BuiltIn', 'Test_Autocomplete_Keywords.rOBOt', 'TestModule'].sort()).toEqual(Array.from(suggestedUnits).sort())
      it 'is not affected by removeDotNotation configuration changes', ->
        runs ->
          atom.config.set("#{CFG_KEY}.removeDotNotation", true)
        waitsFor ->
          return !provider.loading
        , 'Provider should finish loading', TIMEOUT
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  UnknownLibrary.callme')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Call Method')
            expect(suggestions[0]?.replacementPrefix).toEqual('callme')
        runs ->
          atom.config.set("#{CFG_KEY}.removeDotNotation", false)
        waitsFor ->
          return !provider.loading
        , 'Provider should finish loading', TIMEOUT
        runs ->
          editor.setCursorBufferPosition([Infinity, Infinity])
          editor.insertText('  UnknownLibrary.callme')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Call Method')
            expect(suggestions[0]?.replacementPrefix).toEqual('callme')
    describe 'Invalid scope modifiers', ->
      it 'suggests nothing', ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        runs ->
          editor.insertText('  this is an invalid modifier.')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)

  describe 'Autocomplete configuration', ->
    it 'react on showArguments configuration changes', ->
      runs ->
        atom.config.set("#{CFG_KEY}.showArguments", true)
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', TIMEOUT
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
      , 'Provider should finish loading', TIMEOUT
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
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  runprog')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('Run Program')
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  .utility1')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(2)
            expect(suggestions[0]?.displayText).toEqual('utility 1')
            expect(suggestions[1]?.displayText).toEqual('utility 1 text')
      runs ->
        atom.config.set("#{CFG_KEY}.excludeDirectories", ['auto*'])
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  runprog')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)
      runs ->
        atom.config.set("#{CFG_KEY}.excludeDirectories", ['*.robot'])
      waitsFor ->
        return !provider.loading
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  .utility1')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(1)
            expect(suggestions[0]?.displayText).toEqual('utility 1 text')
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
      , 'Provider should finish loading', TIMEOUT
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
      , 'Provider should finish loading', TIMEOUT
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
      , 'Provider should finish loading', TIMEOUT
      runs ->
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  built')
        waitsForPromise ->
          getCompletions(editor, provider).then (suggestions) ->
            expect(suggestions.length).toEqual(0)

  describe 'Ambiguous keywords', ->
    it 'resolves keyword found in diffrent resources using default scope modifier', ->
      waitsForPromise -> atom.workspace.open('autocomplete/test_kw_import1.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  ak')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(2)
          expect(suggestions[0].snippet).toEqual('utils2.abk1')
          expect(suggestions[1].snippet).toEqual('utils3.abk1')
    it 'resolves keyword found in diffrent libraries using default scope modifier', ->
      waitsForPromise -> atom.workspace.open('autocomplete/test_kw_import1.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  delete')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(2)
          expect(suggestions[0].snippet.startsWith('FtpLibrary.Delete')).toBeTruthy()
          expect(suggestions[1].snippet.startsWith('RequestsLibrary.Delete')).toBeTruthy()
    it 'resolves keyword found in diffrent resources using global scope modifier', ->
      waitsForPromise -> atom.workspace.open('autocomplete/test_kw_import1.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  .ak')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(2)
          expect(suggestions[0].snippet).toEqual('utils2.abk1')
          expect(suggestions[1].snippet).toEqual('utils3.abk1')
    it 'resolves keyword found in diffrent resources using file scope modifier', ->
      waitsForPromise -> atom.workspace.open('autocomplete/test_kw_import1.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  utils2.abk')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('utils2.abk1')
      runs ->
        editor.insertText('  utils3.abk')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toBeGreaterThan(0)
          expect(suggestions[0].snippet).toEqual('utils3.abk1')
    it 'resolves keyword found in diffrent resources using internal scope modifier', ->
      waitsForPromise -> atom.workspace.open('autocomplete/a/utils2.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  this.abk')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0].snippet).toEqual('utils2.abk1')

  describe 'Imported resource path resolver', ->
    it 'resolves resource by resource name in the same directory', ->
      waitsForPromise -> atom.workspace.open('path-resolver/path-resolver.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  pr1')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('pr1k')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}pr1.robot")).toBeTruthy()
    it 'resolves resource by resource name in different directory', ->
      waitsForPromise -> atom.workspace.open('path-resolver/path-resolver.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  pr6')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('pr6ka')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}a#{SEP}pr6.robot")).toBeTruthy()
    it 'resolves resource by relative resource path in the same directory', ->
      waitsForPromise -> atom.workspace.open('path-resolver/path-resolver.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  pr2')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('pr2k')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}pr2.robot")).toBeTruthy()
    it 'resolves resource by relative resource path in different directory', ->
      waitsForPromise -> atom.workspace.open('path-resolver/path-resolver.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  pr3')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('pr3ka')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}a#{SEP}pr3.robot")).toBeTruthy()
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  pr4')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('pr4ka')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}a#{SEP}pr4.robot")).toBeTruthy()
    it 'suggests keywords from all resources with same name when import path is computed', ->
      waitsForPromise -> atom.workspace.open('path-resolver/path-resolver.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  pr5')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(2)
          expect(suggestions[0]?.displayText).toEqual('pr5k')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}pr5.robot")).toBeTruthy()
          expect(suggestions[1]?.displayText).toEqual('pr5ka')
          expect(suggestions[1]?.resourceKey.endsWith("path-resolver#{SEP}a#{SEP}pr5.robot")).toBeTruthy()
    it 'suggests keywords from all resources with same name when import path is wrong', ->
      waitsForPromise -> atom.workspace.open('path-resolver/path-resolver.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  pr7')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(2)
          expect(suggestions[0]?.displayText).toEqual('pr7k')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}pr7.robot")).toBeTruthy()
          expect(suggestions[1]?.displayText).toEqual('pr7ka')
          expect(suggestions[1]?.resourceKey.endsWith("path-resolver#{SEP}a#{SEP}pr7.robot")).toBeTruthy()
    it 'resolves external resources', ->
      waitsForPromise -> atom.workspace.open('path-resolver/path-resolver.robot')
      runs ->
        editor = atom.workspace.getActiveTextEditor()
        editor.setCursorBufferPosition([Infinity, Infinity])
        editor.insertText('  prex')
      waitsForPromise ->
        getCompletions(editor, provider).then (suggestions) ->
          suggestions = suggestions.filter (suggestion) -> suggestion.type=='keyword'
          expect(suggestions.length).toEqual(1)
          expect(suggestions[0]?.displayText).toEqual('prext')
          expect(suggestions[0]?.resourceKey.endsWith("path-resolver#{SEP}external-resource.robot")).toBeTruthy()
