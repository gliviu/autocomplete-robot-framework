const libRepo = require('./library-repo')
const keywordsRepo = require('./keywords')
const libdocParser = require('./parse-libdoc')
const common = require('./common')
const pathUtils = require('path')
const os = require('os')
const fs = require('fs')


// List of libdoc xml libraries that will be used if python/robot environment is not available.
const fallbackLibraries = new Map()


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
      const fullPath = library.xmlLibdocPath
      const fileContent = fs.readFileSync(fullPath).toString()
      if(isLibdocXmlFile(fileContent, fullPath)){
        parsedRobotInfo = libdocParser.parse(fileContent)
        keywordsRepo.addKeywords(parsedRobotInfo, common.getResourceKey(library.name), fullPath, library.name)
      }
      else{
        libRepo.updateLibrary({name: library.name, status: 'error', message: 'Not a valid Libdoc xml file'})
      }
    }
    // todo remove
    console.log('libraries parsed');
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
        fallback: true,
        name: libraryName,
        xmlLibdocPath: fallbackLibrary.path
      })
      libRepo.appendLibraries(libraries)
    }
  }
}


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
    const libraryNames = getLibraryNames()
    libRepo.reset(libraryNames)
    keywordsRepo.reset(libDir)
    loadFailedLibraries(libraryNames)
    parseManagedLibraries()
    return libRepo.importLibraries(libraryNames, libDir, pythonExecutable).then (()=>{
      parseManagedLibraries()
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
  getLibrariesByName(libraryName){
    return libRepo.getLibrariesByName()
  },
  printDebugInfo(){
    libRepo.printDebugInfo()
  }
}
