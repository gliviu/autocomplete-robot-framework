const libRepo = require('./library-repo')
const keywordsRepo = require('./keywords')
const libdocParser = require('./parse-libdoc')
const pathUtils = require('path')
const os = require('os')
const fs = require('fs')


const FALLBACK_LIBRARY_NAMES = [
  ...['BuiltIn', 'Collections', 'DateTime', 'Dialogs', 'OperatingSystem', 'Process', 'Remote', 'Screenshot', 'String', 'Telnet', 'XML'],
  ...['FtpLibrary', 'HttpLibrary.HTTP', 'MongoDBLibrary', 'Rammbock', 'RemoteSwingLibrary', 'RequestsLibrary', 'Selenium2Library', 'SeleniumLibrary', 'SSHLibrary', 'SwingLibrary']
];
const FALLBACK_LIBRARY_DIR = pathUtils.join(__dirname, '../fallback-libraries');

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
        keywordsRepo.addKeywords(parsedRobotInfo, fullPath, library.name)
      }
      else{
        libRepo.updateLibrary({name: library.name, status: 'error', message: 'Not a valid Libdoc xml file'})
      }
    }
  }
}

/**
* Replaces libraries that could not be loaded with fallback libraries if found.
**/
function substituteFailedLibraries(){
  const libraries = libRepo.getLibrariesByName().values()
  for(const library of libraries){
    if(library.status==='error' && FALLBACK_LIBRARY_NAMES.includes(library.name)){
      let fullPath = pathUtils.join(FALLBACK_LIBRARY_DIR, `${library.name}.xml`);
      let fileContent = fs.readFileSync(fullPath).toString();
      fallbackLib = {
        status: 'success',
        fallback: true,
        message: library.message,
        name: library.name,
        xmlLibdocPath: fullPath
      }
      libRepo.updateLibrary(fallbackLib)
    }
  }
}

module.exports = {
  importLibraries(libDir, pythonExe){
    const libraryNames = getLibraryNames()
    libRepo.reset(libraryNames)
    keywordsRepo.reset(libDir)
    return libRepo.importLibraries(libraryNames, {libDir: libDir, pythonExe: pythonExe}).then (()=>{
      substituteFailedLibraries()
      parseManagedLibraries()
    })
  },
  getLibrariesByName(libraryName){
    return libRepo.getLibrariesByName()
  },
  printDebugInfo(){
    libRepo.printDebugInfo()
  }
}
