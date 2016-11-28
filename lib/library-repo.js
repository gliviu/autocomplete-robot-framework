const pathUtils = require('path')
const child_process = require('child_process')

const paramRegexp = /\$\{([^\}]+)\}/g

const libraryCache = {}
const EXEC_TIMEOUT_MILLIS=10000

module.exports = {
  // Removes everything except libraries found in 'libraryNames'
  reset(libraryNames = []){
    for(const libraryName in libraryCache){
      if(libraryNames.indexOf(libraryName)==-1){
        delete libraryCache[libraryName]
      }
    }
  },
  // Transforms Python libraries specified by name and saves them in libDir
  importLibraries(libraryNames, libDir){
    console.log('importing... - todo: remove' + new Date())
    return new Promise((resolve)=>{
      const scriptPath = pathUtils.join(__dirname, 'library_cache.py')
      child_process.exec(`python ${scriptPath}  ${libraryNames.join(',')} ${libDir}`, {timeout: EXEC_TIMEOUT_MILLIS}, (error, stdout, stderr)=>{
        const libraries = []
        if(error){
          for(const libraryName of libraryNames){
            libraries.push({name: libraryName, message: error.toString(), status: 'error'})
          }
        } else if(stderr.length>0){
          for(const libraryName of libraryNames){
            libraries.push({name: libraryName, message: stderr, status: 'error'})
          }
        } else{
          let cache = undefined
          let error = undefined
          try{
            cache = JSON.parse(stdout)
          } catch(e){
            error = e.stack?e.stack:e.toString()
          }
          if(cache){
            for(const key in cache){
              libraries.push(cache[key])
            }
          } else{
            for(const libraryName of libraryNames){
              libraries.push({name: libraryName, message: error, status: 'error'})
            }
          }
        }
        newLibraries = this.appendLibraries(libraries)
        resolve(newLibraries)
      })
    })
  },
  appendLibraries(libraries){
    const result = []
    for(const library of libraries){
      const existingLibrary = libraryCache[library.name]
      if(library.status==='error' && existingLibrary && existingLibrary.status==='success'){
        result.push(existingLibrary)
        continue // don't override valid library with one that has errors
      } else{
        libraryCache[library.name] = library
        result.push(library)
      }
    }
    return result
  },
  updateLibrary(newLib){
    const oldLib = libraryCache[library.name]
    if(oldLib){
      libraryCache[library.name] = Object.assign(oldLib, newLib)
    }
  },
  getLibraries(){
    const libraries = new Map()
    for(const libraryName in libraryCache){
      libraries.set(libraryName, cloneLibrary(libraryCache[libraryName]))
    }
    return libraries
  },
  printDebugInfo(){
    console.log(`Library manager: ${JSON.stringify(libraryCache, null, 2)}`);
  }

}


// Builds PYTHONPATH with env parameters - ${env}
// Deprecated
function buildPythonPath(pythonpath){
  const rawPaths = pythonpath.split(/;|:/)
  const paths = [], errors = []
  for(const rawPath of rawPaths){
    let path = rawPath;
    while(match = paramRegexp.exec(rawPath)){
      const param = match[0]
      const envKey = match[1]
      const value = process.env[envKey]
      if(value){
        path = path.replace(param, value)
      }
    }
    paths.push(path)
  }
  return paths
}

function cloneLibrary(library){
  return {
    name: library.name,
    status: library.status,
    message: library.message,
    xmlLibdocPath: library.xmlLibdocPath
  }
}
