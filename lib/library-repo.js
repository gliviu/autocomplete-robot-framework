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
  importLibraries(libraryNames, settings){
    console.log('importing... - todo: remove' + new Date())
    return new Promise((resolve, reject)=>{
      if(!settings.pythonExe){
        const libraries = buildErrorResponse(libraryNames, 'Bad arguments: pythonExe missing')
        resolve(this.appendLibraries(libraries))
        return
      }
      if(!settings.libDir){
        const libraries = buildErrorResponse(libraryNames, 'Bad arguments: libDir missing')
        resolve(this.appendLibraries(libraries))
        return
      }
      const scriptPath = pathUtils.join(__dirname, 'library_cache.py')
      const parameters = {
        libraryNames: libraryNames,
        cacheDir: settings.libDir
      }
      let output = []
      libCache = child_process.spawn(settings.pythonExe, [scriptPath, libraryNames.join(','), settings.libDir])

      const onClose = () =>{
        const libraries = []
        let cache = undefined
        let error = undefined
        const outputStr = output.join('')
        if(outputStr.length===0){
          error = 'No response received from library_cache.py'
        } else{
          try{
            cache = JSON.parse(outputStr)
          } catch(e){
            error = outputStr
          }
        }
        if(cache){
          for(const key in cache){
            libraries.push(cache[key])
          }
        } else{
          error = error || 'Unexpected error occurred when running library_cache.py'
          libraries.push(...buildErrorResponse(libraryNames, error))
        }
        newLibraries = this.appendLibraries(libraries)
        resolve(newLibraries)
      }

      libCache.stdout.on('data', data => output.push(data))
      libCache.stderr.on('data', data => output.push(data))
      libCache.on('close', onClose)
      libCache.on('error', (err) => {output.push(`Error occurred running '${settings.pythonExe}': '${err}'`)})

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
    const libraryName = newLib.name
    const oldLib = libraryCache[libraryName]
    if(oldLib){
      libraryCache[libraryName] = Object.assign(oldLib, newLib)
    } else{
      console.warn(`Unknown library: '${libraryName}'`);
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

function buildErrorResponse(libraryNames, error){
  const libraries = []
  for(const libraryName of libraryNames){
    libraries.push({name: libraryName, message: error.toString(), status: 'error'})
  }
  return libraries
}
