const fs = require('fs')
const pathUtils = require('path')
const marked = require('marked')
const keywordsRepo = require('./keywords')
const libManager = require('./library-manager')
const common = require('./common')
const robotParser = require('./parse-robot')

function pythonExecutablecInfo(pythonExecutable){
  return new Promise((resolve) =>{
    try{
      const spawn = require('child_process').spawn;
      const python = spawn(pythonExecutable, ['--version']);
      const output = []

      python.on('error', (error) => {
        if(error.toString().indexOf('ENOENT')>=0){
          resolve({status: 'error', executable: pythonExecutable, message: `Command '${pythonExecutable}' could not be found`})
        } else{
          resolve({status: 'error', executable: pythonExecutable, message: (error.stack ? error.stack : error)})
        }
      });
      python.on('close', (code) => {
        if(code===0){
          resolve({status: 'success', executable: pythonExecutable, version: output.map(s => s.replace(/\n|\r/, '')).join('')})
        } else{
          resolve({status: 'error', executable: pythonExecutable, message: `Command '${pythonExecutable}' returned exit code '${code}'`})
        }
      });
      python.stdout.on('data', data => output.push(data.toString()))
      python.stderr.on('data', data => output.push(data.toString()))
    }catch(error){
      resolve({status: 'error', executable: pythonExecutable, message: (error.stack ? error.stack : error)})
    }
  })
}

function getEnvironmentInfo(settings){
  return {
    pythonPath:     process.env.PYTHONPATH || 'n/a',
    jythonPath:     process.env.JYTHONPATH || 'n/a',
    classPath:      process.env.CLASSPATH || 'n/a',
    ironpythonPath: process.env.IRONPYTHONPATH || 'n/a',
  }
}

function getResourceInfo(resourcePath){
  const info = {status: 'n/a', resourceName: 'n/a', resourceFileName: 'n/a', resourcePath: 'n/a', libraries: [], resources: []}
  try{
    if(!resourcePath){
      info.status = `Error occurred while gathering status: current editor path could not be determined`
    } else{
      const resourceKey = common.getResourceKey(resourcePath)
      const currentResource = keywordsRepo.resourcesMap[resourceKey]
      info.resourcePath = resourcePath
      info.resourceFileName = pathUtils.basename(resourcePath)
      if(!currentResource){
        info.resourcePath = resourcePath
        info.resourceName = 'n/a'
        const fileContent = fs.readFileSync(resourcePath).toString()
        const isRobotFile = robotParser.isRobot(fileContent)
        if(isRobotFile){
          info.status = `Resource is not indexed. Make sure it is part of current Atom projects.`
        } else{
          info.status = `Resource is not a valid robot file.`
        }
      } else{
        info.status = 'Parsed/Ok'
        info.resourcePath = resourcePath
        info.resourceName = currentResource.name

        // Imported libraries
        for(const library of currentResource.imports.libraries){
          const libraryName = library.name
          const libInfo = {name: libraryName, status: 'n/a', sourcePath: 'n/a', libdocPath: 'n/a'}
          const managedLibrary = libManager.getLibrariesByName().get(libraryName)
          if(managedLibrary){
            if(managedLibrary.fallback){
              libInfo.status = 'Loading python library failed. Using fallback library.'
            } else{
              libInfo.status = managedLibrary.status==='success'?'Loaded':'Errors occurred during loading'
            }
            libInfo.error = managedLibrary.message
            libInfo.sourcePath = managedLibrary.sourcePath || libInfo.sourcePath
            libInfo.libdocPath = managedLibrary.xmlLibdocPath || libInfo.libdocPath
          } else{
            libInfo.status =  'Library not loaded yet'
          }
          info.libraries.push(libInfo)
        }

        // Imported resources
        for(const importedResource of currentResource.imports.resources){
          const resourceName = importedResource.name
          const resourceExtension = importedResource.extension
          const resInfo = {name: `${resourceName}${resourceExtension}`, status: 'n/a', multiple: false, sourcePath: 'n/a', sourcePaths: []}
          let resourcesByName = keywordsRepo.getResourcesByName(true).get(resourceName.toLowerCase()) || []
          resourcesByName = resourcesByName.filter(res => res.extension.toLowerCase() === resourceExtension.toLowerCase())
          if(!resourcesByName){
            resInfo.status =  'Resource could not be found'
          } else if(resourcesByName.length === 1){
            const resource = resourcesByName[0]
            resInfo.status = 'Loaded'
            resInfo.sourcePath = resource.path
          } else{
            resInfo.status = 'Multiple resources detected'
            resInfo.multiple = true
            resInfo.sourcePaths = resourcesByName.map(res => res.path)
          }
          info.resources.push(resInfo)
        }
      }
    }
  }catch(error){
    info.status = 'Error occurred while gathering status'
    info.error =  error.stack ? error.stack : error
  }

  return info
}

function tab(text, tabsNo){
  const tabs = Array(tabsNo).fill('    ').join('')
  const output = text.split('\n').map(line => `${tabs}${line}`)
  return output.join('\n')
}
function trim(text){
  const output = text.split('\n').map(line => `${line.trim()}`)
  return output.join('\n')
}

function buildImportedLibrariesOutput(libraries, tabs){
  const output = []
  output.push(tab('Libraries', tabs))
  if(libraries.length==0){
    output.push(tab('No libraries imported', tabs+1))
  }
  for(const library of libraries){
    output.push(tab(library.name, tabs+1))
    output.push(tab(`Status: ${library.status}`, tabs+2))
    if(library.error){
      output.push(tab('Error:', tabs+2))
      output.push(tab(trim(library.error), tabs+3))
    }
    output.push(tab(`Source: ${library.sourcePath}`, tabs+2))
    output.push(tab(`Libdoc: ${library.libdocPath}`, tabs+2))
  }
  return output
}

function buildImportedResourcesOutput(resources, tabs){
  const output = []
  output.push(tab('Resources', tabs))
  if(resources.length==0){
    output.push(tab('No resources imported', tabs+1))
  }
  for(const resource of resources){
    output.push(tab(resource.name, tabs+1))
    output.push(tab(`Status: ${resource.status}`, tabs+2))
    if(resource.error){
      output.push(tab('Error:', tabs+2))
      output.push(tab(trim(resource.error), tabs+3))
    }
    if(resource.multiple){
      output.push(tab(`Paths:`, tabs+2))
      for(const path of resource.sourcePaths){
        output.push(tab(path, tabs+3))
      }
    } else{
      output.push(tab(`Path: ${resource.sourcePath}`, tabs+2))
    }
  }
  return output
}

function buildOutput(resourceInfo, environmentInfo, pythonExecutableInfo){
  const output = []
  output.push(`File: ${resourceInfo.resourceFileName}`)
  output.push(tab(`Status: ${resourceInfo.status}`, 1))

  // Current file
  if(resourceInfo.error){
      output.push(tab('Error:', 1))
      output.push(tab(trim(resourceInfo.error), 2))
  }
  output.push(tab(`Path: ${resourceInfo.resourcePath}`, 1))
  output.push(...buildImportedLibrariesOutput(resourceInfo.libraries, 1))
  output.push(...buildImportedResourcesOutput(resourceInfo.resources, 1))

  // Environment
  output.push(`Environment:`)
  output.push(tab(`PYTHONPATH: ${environmentInfo.pythonPath}`, 1))
  output.push(tab(`JYTHONPATH: ${environmentInfo.jythonPath}`, 1))
  output.push(tab(`CLASSPATH: ${environmentInfo.classPath}`, 1))
  output.push(tab(`IRONPYTHONPATH: ${environmentInfo.ironpythonPath}`, 1))

  // Python
  output.push(`Python:`)
  output.push(tab(`Executable: '${pythonExecutableInfo.executable}'`, 1))
  if(pythonExecutableInfo.status==='success'){
    output.push(tab(`Version: '${pythonExecutableInfo.version}'`, 1))
  } else{
    output.push(tab('Error:', 1))
    output.push(tab(trim(pythonExecutableInfo.message), 2))
  }

  return output.join('\n')
}

module.exports = {
  // Opens a new Atom panel and prints status information.
  renderStatus(resourcePath, settings){
    const resourceInfo = getResourceInfo(resourcePath)
    const environmentInfo = getEnvironmentInfo(settings)
    const markdownUri = 'arfm://arfm'
    const view = document.createElement("pre")
    view.getTitle = () => 'Robot'
    view.getURI= () => markdownUri
    view.getIconName= () => 'info'
    pythonExecutablecInfo(settings.pythonExecutable).then(pythonExecutableInfo =>{
      view.innerHTML = buildOutput(resourceInfo, environmentInfo, pythonExecutableInfo)
    })

    const disposable = atom.workspace.addOpener((uri) => uri === markdownUri ? view : undefined)
    atom.workspace.open(markdownUri)
    disposable.dispose()
  }
}
