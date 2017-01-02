const pathUtils = require('path')
const child_process = require('child_process')

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
  // Imports libraries defined in libraryNames.
  // Each successful imported library will have a corresponding libdoc xml.
  // libDir: directory where libdoc xml files are stored.
  // pythonExecutable: python command name or path
  importLibraries(libraryNames, libDir, pythonExecutable){
    console.log('importing... - todo: remove' + new Date())
    return new Promise((resolve, reject)=>{
      try{
        if(!pythonExecutable){
          const libraries = buildErrorResponse(libraryNames, 'Bad arguments: pythonExecutable missing')
          resolve(this.appendLibraries(libraries))
          return
        }
        if(!libDir){
          const libraries = buildErrorResponse(libraryNames, 'Bad arguments: libDir missing')
          resolve(this.appendLibraries(libraries))
          return
        }
        const scriptPath = pathUtils.join(__dirname, 'library_cache.py')
        const parameters = {
          libraryNames: libraryNames,
          cacheDir: libDir
        }
        let output = []
        libCache = child_process.spawn(pythonExecutable, [scriptPath, libraryNames.join(','), libDir])

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
          const newLibraries = this.appendLibraries(libraries)
          resolve(newLibraries)
        }

        libCache.stdout.on('data', data => output.push(data.toString()))
        libCache.stderr.on('data', data => output.push(data.toString()))
        libCache.on('close', onClose)
        libCache.on('error', (err) => {output.push(`Error occurred running '${pythonExecutable}': '${err}'`)})
      } catch(err){
        const error = err.stack ? err.stack : err
        const newLibraries = this.appendLibraries(buildErrorResponse(libraryNames, error))
        resolve(newLibraries)
      }

    })
  },
  appendLibraries(libraries){
    const result = []
    for(const library of libraries){
      const existingLibrary = libraryCache[library.name]
      if(library.status==='error' && existingLibrary && existingLibrary.status==='success'){
        result.push(existingLibrary)
        existingLibrary.message = library.message
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
      Object.assign(oldLib, newLib)
    } else{
      console.warn(`Unknown library: '${libraryName}'`);
    }
  },
  getLibrariesByName(){
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


function cloneLibrary(library){
  return {
    name: library.name,
    status: library.status,
    fallback: library.fallback,
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
