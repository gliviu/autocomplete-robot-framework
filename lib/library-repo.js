const pathUtils = require('path')
const child_process = require('child_process')

// Libraries mapped by their name.
// Format:
// 'library_name'{
//   name: 'library_name',
//   status: 'error/success',
//   fallback: true/false,  # Whether this library could not be imported and a fallback library is used instead.
//   message: 'error or warning message',
//   xmlLibdocPath: 'path of libdoc file',
//   sourcePath: 'path of python file'
// }
const libraryCache = {}

let pythonEnvironmentStatus =   {
  status: 'error',
  message: 'Not processed yet',
  pythonExecutable: 'Not processed yet',
  pythonVersion: 'Not processed yet',
  platform: 'Not processed yet',
  pythonPath: 'Not processed yet',
  jythonPath: 'Not processed yet',
  classPath: 'Not processed yet',
  ironpythonPath: 'Not processed yet',
  moduleSearchPath: []
}


const EXEC_TIMEOUT_MILLIS=10000

// Keeps a repository of python libraries.
// Suppports these library operations: import. reset, append, get
module.exports = {
  // Removes everything except libraries found in 'libraryNames'
  reset(libraryNames = []){
    for(const libraryName in libraryCache){
      if(libraryNames.indexOf(libraryName)==-1){
        delete libraryCache[libraryName]
      }
    }
  },
  // Wrapper over library_cache.py.
  // Imports libraries defined in libraryNames.
  // Each successful imported library will have a corresponding libdoc xml.
  // * libDir: directory where libdoc xml files are stored.
  // * moduleSearchPath: additional paths to be added to default Python module search path.
  // * pythonExecutable: python command name or path
  // Returns result as promise.
  importLibraries(libraryNames, libDir, moduleSearchPath, pythonExecutable){
    const uuid = Math.floor((1 + Math.random()) * 0x10000) // todo: remove
    console.log(`Importing START ${uuid}`) // todo: remove
    return new Promise((resolve, reject)=>{
      try{
        if(!pythonExecutable){
          const message = 'Bad arguments: pythonExecutable missing'
          let libraries = buildErrorResponse(libraryNames, message)
          libraries = this.appendLibraries(libraries)
          updatePythonEnvironmentStatusWithError(message, pythonExecutable)
          resolve(libraries)
          return
        }
        if(!libDir){
          const message = 'Bad arguments: libDir missing'
          let libraries = buildErrorResponse(libraryNames, message)
          libraries = this.appendLibraries(libraries)
          updatePythonEnvironmentStatusWithError(message, pythonExecutable)
          resolve(libraries)
          return
        }
        const scriptPath = pathUtils.join(__dirname, 'library_cache.py')
        let output = []
        libCache = child_process.spawn(pythonExecutable, [scriptPath, libraryNames.join(','), moduleSearchPath.join(','), libDir])

        const onClose = () =>{
          const libraries = []
          let result = undefined
          let error = undefined
          const outputStr = output.join('')
          if(outputStr.length===0){
            error = 'No response received from library_cache.py'
          } else{
            try{
              result = JSON.parse(outputStr)
            } catch(e){
              error = outputStr
            }
          }
          if(result){
            for(const key in result.libraries){
              libraries.push(result.libraries[key])
            }
            if(result.environment){
              Object.assign(pythonEnvironmentStatus, result.environment, {status: 'success', message: ''})
              if(!result.environment.pythonExecutable){
                pythonEnvironmentStatus.pythonExecutable = pythonExecutable
              }
            } else{
              updatePythonEnvironmentStatusWithError('Environment information not available', pythonExecutable)
            }
          } else{
            error = error || 'Unexpected error occurred when running library_cache.py'
            libraries.push(...buildErrorResponse(libraryNames, error))
            updatePythonEnvironmentStatusWithError(error, pythonExecutable)
          }
          const newLibraries = this.appendLibraries(libraries)
          console.log(`Importing END ${uuid}`) // todo: remove
          resolve(newLibraries)
        }

        libCache.stdout.on('data', data => output.push(data.toString()))
        libCache.stderr.on('data', data => output.push(data.toString()))
        libCache.on('close', onClose)
        libCache.on('error', (err) => {output.push(`Error occurred running '${pythonExecutable}': '${err}'`)})
      } catch(err){
        const error = err.stack ? err.stack : err
        const newLibraries = this.appendLibraries(buildErrorResponse(libraryNames, error))
        updatePythonEnvironmentStatusWithError(error, pythonExecutable)
        resolve(newLibraries)
      }

    })
  },
  // Appends libraries to repository. If library already exists it is updated
  // except for cases where new library is imported with errors and old library is successful.
  // Each of 'libraries' should follow the repository library structure.
  // Returns newly appended libraries from repository.
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
  // Updates an existing library in repository. If library is not found it is ignored.
  // 'newLib' should follow the repository library structure.
  updateLibrary(newLib){
    const libraryName = newLib.name
    const oldLib = libraryCache[libraryName]
    if(oldLib){
      Object.assign(oldLib, newLib)
    } else{
      console.warn(`Unknown library: '${libraryName}'`);
    }
  },
  // Returns libraries in the repository mapped by name.
  getLibrariesByName(){
    const libraries = new Map()
    for(const libraryName in libraryCache){
      libraries.set(libraryName, cloneLibrary(libraryCache[libraryName]))
    }
    return libraries
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
    return Object.assign({}, pythonEnvironmentStatus)
  },
  printDebugInfo(){
    console.log(`Library manager: ${JSON.stringify(libraryCache, null, 2)}`);
  }

}

function updatePythonEnvironmentStatusWithError(message, pythonExecutable){
  pythonEnvironmentStatus.status = 'error'
  pythonEnvironmentStatus.message = message
  pythonEnvironmentStatus.pythonExecutable = pythonExecutable
  pythonEnvironmentStatus.pythonVersion    = 'n/a'
  pythonEnvironmentStatus.pythonPath       = 'n/a'
  pythonEnvironmentStatus.jythonPath       = 'n/a'
  pythonEnvironmentStatus.classPath        = 'n/a'
  pythonEnvironmentStatus.ironpythonPath   = 'n/a'
  pythonEnvironmentStatus.moduleSearchPath = []
}

function cloneLibrary(library){
  return {
    name: library.name,
    status: library.status,
    fallback: library.fallback,
    message: library.message,
    xmlLibdocPath: library.xmlLibdocPath,
    sourcePath: library.sourcePath
  }
}

function buildErrorResponse(libraryNames, error){
  const libraries = []
  for(const libraryName of libraryNames){
    libraries.push({name: libraryName, message: error.toString(), status: 'error'})
  }
  return libraries
}
