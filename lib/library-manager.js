const libRepo = require('./library-repo')
const keywordsRepo = require('./keywords')
const libdocParser = require('./parse-libdoc')
const common = require('./common')
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
    if(FALLBACK_LIBRARY_NAMES.includes(libraryName)){
      let fullPath = pathUtils.join(FALLBACK_LIBRARY_DIR, `${libraryName}.xml`);
      let fileContent = fs.readFileSync(fullPath).toString();
      libraries.push({
        status: 'success',
        fallback: true,
        name: libraryName,
        xmlLibdocPath: fullPath
      })
      libRepo.appendLibraries(libraries)
    }
  }
}



module.exports = {
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
  getLibrariesByName(libraryName){
    return libRepo.getLibrariesByName()
  },
  printDebugInfo(){
    libRepo.printDebugInfo()
  }
}
