libRepo = require('../lib/library-repo')
fs = require 'fs'
pathUtils = require 'path'
os = require 'os'

describe "Library repository", ->
  settings={
    pythonExe: 'python',
    libDir: pathUtils.join(os.tmpdir(), 'robot-lib-cache')
  }
  process.env.PYTHONPATH=pathUtils.join(__dirname, '../fixtures/libraries')
  it 'should load robot keywords from module', ->
    waitsForPromise ->
      libRepo.importLibraries(['TestPackage.modules.TestModule'], settings)
    runs ->
      libraries = libRepo.getLibraries()
      library = libraries.get('TestPackage.modules.TestModule')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('TestPackage.modules.TestModule')
  it 'should load robot keywords from class with shorthand notation', ->
    waitsForPromise ->
      libRepo.importLibraries(['TestPackage.classes.TestClass'], settings)
    runs ->
      libraries = libRepo.getLibraries()
      library = libraries.get('TestPackage.classes.TestClass')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('TestPackage.classes.TestClass')
  it 'should load robot keywords from class with long notation', ->
    waitsForPromise ->
      libRepo.importLibraries(['TestPackage.classes.TestClass.TestClass'], settings)
    runs ->
      libraries = libRepo.getLibraries()
      library = libraries.get('TestPackage.classes.TestClass.TestClass')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('TestPackage.classes.TestClass.TestClass')
  it 'should load Robot Framework builtin libraries', ->
    waitsForPromise ->
      libRepo.importLibraries(['robot.libraries.OperatingSystem'], settings)
    runs ->
      libraries = libRepo.getLibraries()
      library = libraries.get('robot.libraries.OperatingSystem')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('robot.libraries.OperatingSystem')
