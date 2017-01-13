const libRepo = require('./library-repo')
const keywordsRepo = require('./keywords')
const libdocParser = require('./parse-libdoc')
const common = require('./common')
const pathUtils = require('path')
const os = require('os')
const fs = require('fs')


// List of libdoc xml libraries that will be used if python/robot environment is not available.
const fallbackLibraries = new Map()

// Used to avoid multiple concurrent importings.
// 'idle' - no import hapening
// 'busy' - import is in progress
// 'scheduled' - import is in progress and at least one other import was requested
let importStatus = 'idle'

// Returns array of distinct library names used throught all robot resources
function getLibraryNames(){
  const libraryNames = new Set(['BuiltIn'])
  for(resourceKey in keywordsRepo.resourcesMap){
    const resource = keywordsRepo.resourcesMap[resourceKey]
    for(const library of resource.imports.libraries){
      libraryNames.add(library.name)
    }
  }

  return Array.from(libraryNames)
}

// Returns array of distinct paths holding robot files.
// Will be added to python module search path.
function getRobotDistinctPaths(){
  const res = new Set()
  for(const resourceKey in keywordsRepo.resourcesMap){
    const resource = keywordsRepo.resourcesMap[resourceKey]
    res.add(pathUtils.dirname(resource.path))
  }
  return Array.from(res)
}

function isLibdocXmlFile(fileContent, filePath){
  const ext = pathUtils.extname(filePath)
  if(ext === '.xml' && libdocParser.isLibdoc(fileContent)){
    return true
  }
  return false
}

function parseManagedLibraries(){
  const libraries = libRepo.getLibrariesByName().values()
  for(const library of libraries){
    if(library.status==='success'){
      const libdocPath = library.xmlLibdocPath
      const fileContent = fs.readFileSync(libdocPath).toString()
      if(isLibdocXmlFile(fileContent, libdocPath)){
        parsedRobotInfo = libdocParser.parse(fileContent)
        keywordsRepo.addLibrary(parsedRobotInfo, libdocPath, library.name, library.sourcePath)
      }
      else{
        libRepo.updateLibrary({name: library.name, status: 'error', message: 'Not a valid Libdoc xml file'})
      }
    }
    // todo remove
    // console.log('libraries parsed');
  }
}

/**
* Replaces libraries that could not be loaded with fallback libraries if found.
**/
function loadFailedLibraries(libraryNames){
  const libraries = []
  for(const libraryName of libraryNames){
    const fallbackLibrary = fallbackLibraries.get(libraryName)
    if(fallbackLibrary){
      let fileContent = fs.readFileSync(fallbackLibrary.path).toString();
      libraries.push({
        status: 'success',
        message: 'Library is in process of being imported',
        fallback: true,
        name: libraryName,
        xmlLibdocPath: fallbackLibrary.path
      })
      libRepo.appendLibraries(libraries)
    }
  }
}

// Manages libraries requested by robot files. Uses library-repo to store/retrieve libraries.
module.exports = {
  reset(){
    const libraryNames = getLibraryNames()
    for(const libraryName of libraryNames){
      keywordsRepo.reset(libraryName)
    }
    libRepo.reset()
    fallbackLibraries.clear()
  },
  // Imports all distinct libraries defined in any robot file.
  // Each successful imported library will have a corresponding libdoc xml.
  // libDir: directory where libdoc xml files are stored.
  // pythonExecutable: python command name or path
  importLibraries(libDir, pythonExecutable){
    // const uuid = Math.floor((1 + Math.random()) * 0x10000) // todo: remove
    // console.log(`LM START ${uuid}`) // todo: remove
    if(importStatus==='busy' || importStatus==='scheduled'){
      importStatus = 'scheduled'
      // console.log(`LM END 1 SCHEDULED ${uuid}`) // todo: remove
      return Promise.resolve('scheduled')
    } else{
      importStatus = 'busy'
    }
    const libraryNames = getLibraryNames()
    libRepo.reset(libraryNames)
    keywordsRepo.reset(libDir)
    loadFailedLibraries(libraryNames)
    parseManagedLibraries()
    const moduleSearchPath = getRobotDistinctPaths()
    return libRepo.importLibraries(libraryNames, libDir, moduleSearchPath, pythonExecutable).then (()=>{
      parseManagedLibraries()
      if(importStatus==='busy'){
        importStatus = 'idle'
        // console.log(`LM END 2 FINISHED ${uuid}`) // todo: remove
        return 'finished'
      } else if(importStatus==='scheduled'){
        importStatus = 'idle'
        // console.log(`LM END 3 SCHEDULED ${uuid}`) // todo: remove
        return this.importLibraries(libDir, pythonExecutable)
      }
    })
  },
  // Add libdoc xml libraries that will be used if python/robot environment is not available.
  // libraries: list of paths pointing to libdoc xml files.
  addFallbackLibraries(libdocPaths){
    for(const libraryPath of libdocPaths){
      const libraryName = pathUtils.basename(libraryPath, pathUtils.extname(libraryPath))
      fallbackLibraries.set(libraryName, {path: libraryPath, name: libraryName})
    }
  },
  // Returns list of managed libraries, mapped by name.
  getLibrariesByName(libraryName){
    return libRepo.getLibrariesByName()
  },
  // Returns information about python environment.
  // {
  //    status: 'success/error',
  //    message: 'error/warning message',
  //    pythonExecutable: 'python executable command',
  //    pythonVersion:    'python environment version'
  //    pythonPath:       'PYTHONPATH env variable'
  //    jythonPath:       'JYTHONPATH env variable'
  //    classPath:        'CLASSPATH env variable'
  //    ironpythonPath:   'IRONPYTHONPATH env variable'
  //    moduleSearchPath: ['msp1', ...]
  // }
  getPythonEnvironmentStatus(){
    return libRepo.getPythonEnvironmentStatus()
  },
  printDebugInfo(){
    libRepo.printDebugInfo()
  }
}
