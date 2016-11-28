const libRepo = require('./library-repo')
const keywordsRepo = require('./keywords')
const libdocParser = require('./parse-libdoc')
const pathUtils = require('path')
const os = require('os')
const fs = require('fs')


const BUILTIN_STANDARD_LIBS = ['BuiltIn', 'Collections', 'DateTime', 'Dialogs', 'OperatingSystem', 'Process', 'Screenshot', 'String', 'Telnet', 'XML']
const BUILTIN_LIB_PYTHON_PACKAGE = 'robot.libraries'

// Returns array of distinct library names used throught all robot resources
function getLibraryNames(){
  const libraryNames = new Set(['BuiltIn'])
  for(resourceKey in keywordsRepo.resourcesMap){
    const resource = keywordsRepo.resourcesMap[resourceKey]
    for(const library of resource.libraries)
      libraryNames.add(library.name)
  }

  // Convert builtin libraries to full name ie. BuiltIn -> robot.libraries.BuiltIn
  const libraryFullNames = Array.from(libraryNames).map(libraryName => {
    if(BUILTIN_STANDARD_LIBS.indexOf(libraryName)===-1){
      return libraryName
    }
    else{
      return `${BUILTIN_LIB_PYTHON_PACKAGE}.${libraryName}`
    }
  })

  return libraryFullNames
}

function isLibdocXmlFile(fileContent, filePath, settings){
  const ext = pathUtils.extname(filePath)
  if(ext === '.xml' && libdocParser.isLibdoc(fileContent)){
    return true
  }
  return false
}
function pythonToRobotLibraryName(libraryName){
  if(libraryName.indexOf(BUILTIN_LIB_PYTHON_PACKAGE)===0){
    return libraryName.substring(BUILTIN_LIB_PYTHON_PACKAGE.length+1)
  }
  else{
    return libraryName
  }
}

function robotToPythonLibraryName(libraryName){
  if(BUILTIN_STANDARD_LIBS.indexOf(libraryName)!==-1){
    return `${BUILTIN_LIB_PYTHON_PACKAGE}.${libraryName}`
  }
  else{
    return libraryName
  }
}

function parseManagedLibraries(settings){
  const libraries = libRepo.getLibraries().values()
  for(const library of libraries){
    if(library.status==='success'){
      const fullPath = library.xmlLibdocPath
      const fileContent = fs.readFileSync(fullPath).toString()
      if(isLibdocXmlFile(fileContent, fullPath, settings)){
        if(settings.debug) console.log(`Parsing ${fullPath} ...`)
        resourceName = pythonToRobotLibraryName(library.name)
        parsedRobotInfo = libdocParser.parse(fileContent)
        keywordsRepo.addKeywords(parsedRobotInfo, fullPath, resourceName)
      }
      else{
        libRepo.updateLibrary({name: library.name, status: 'error', message: 'Not a valid Libdoc xml file'})
      }
    }
  }
}

module.exports = {
  importLibraries(libDir, settings){
    const libraryNames = getLibraryNames()
    libRepo.reset(libraryNames)
    keywordsRepo.reset(libDir)
    return libRepo.importLibraries(libraryNames, libDir).then (()=>{
      parseManagedLibraries(settings)
    })
  },
  printDebugInfo(){
    libRepo.printDebugInfo()
  }
}