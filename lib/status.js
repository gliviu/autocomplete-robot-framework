const fs = require('fs')
const marked = require('marked')
const keywordsRepo = require('./keywords')
const libManager = require('./library-manager')
const common = require('./common')
const robotParser = require('./parse-robot')

function getResourceInfo(resourcePath){
  const info = {status: 'n/a', resourceName: 'n/a', resourcePath: 'n/a', libraries: [], resources: []}
  try{
    if(!resourcePath){
      info.status = `Error occurred while gathering status: current editor path could not be determined`
    } else{
      const resourceKey = common.getResourceKey(resourcePath)
      const currentResource = keywordsRepo.resourcesMap[resourceKey]
      info.resourcePath = resourcePath
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
          const libInfo = {name: libraryName, status: 'n/a', sourcePath: 'n/a'}
          const managedLibrary = libManager.getLibrariesByName().get(libraryName)
          if(managedLibrary){
            if(managedLibrary.fallback){
              libInfo.status = 'Loading python library failed. Falled back on library provided with this package'
            } else{
              libInfo.status = managedLibrary.status==='success'?'Loaded':'Errors occurred during loading'
            }
            libInfo.error = managedLibrary.message
            libInfo.sourcePath = managedLibrary.xmlLibdocPath || libInfo.sourcePath
          } else{
            libInfo.status =  'Unknown error occurred while loading library'
          }
          info.libraries.push(libInfo)
        }

        // Imported resources
        for(const importedResource of currentResource.imports.resources){
          const resourceName = importedResource.name
          const resInfo = {name: resourceName, status: 'n/a', multiple: false, sourcePath: 'n/a', sourcePaths: []}
          const resourcesByName = keywordsRepo.getResourcesByName().get(resourceName)
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

function buildImportedLibrariesOutput(libraries){
  const output = []
  output.push('Libraries')
  if(libraries.length==0){
    output.push(tab('No libraries imported', 1))
  }
  for(const library of libraries){
    output.push(tab(library.name, 1))
    output.push(tab(`Status: ${library.status}`, 2))
    if(library.error){
      output.push(tab('Error:', 2))
      output.push(tab(trim(library.error), 3))
    }
    output.push(tab(`Path: ${library.sourcePath}`, 2))

  }
  return output
}

function buildImportedResourcesOutput(resources){
  const output = []
  output.push('Resources')
  if(resources.length==0){
    output.push(tab('No resources imported', 1))
  }
  for(const resource of resources){
    output.push(tab(resource.name, 1))
    output.push(tab(`Status: ${resource.status}`, 2))
    if(resource.error){
      output.push(tab('Error:', 2))
      output.push(tab(trim(resource.error), 3))
    }
    if(resource.multiple){
      output.push(tab(`Paths:`, 2))
      for(const path of resource.sourcePaths){
        output.push(tab(path, 3))
      }
    } else{
      output.push(tab(`Path: ${resource.sourcePath}`, 2))
    }
  }
  return output
}

function buildOutput(info){
  const output = []
  output.push(`Status: ${info.status}`)
  if(info.error){
      output.push('Error:')
      output.push(tab(trim(info.error), 1))
  }
  output.push(`Name: ${info.resourceName}`)
  output.push(`Path: ${info.resourcePath}`)
  output.push(...buildImportedLibrariesOutput(info.libraries))
  output.push(...buildImportedResourcesOutput(info.resources))
  return output.join('\n')
}

module.exports = {
  renderStatus(resourcePath){
    const info = getResourceInfo(resourcePath)
    const markdownUri = 'arfm://arfm'
    const view = document.createElement("pre")
    view.getTitle = () => 'Robot'
    view.getURI= () => markdownUri
    view.getIconName= () => 'info'
    view.innerHTML = buildOutput(info)

    const disposable = atom.workspace.addOpener((uri) => uri === markdownUri ? view : undefined)
    atom.workspace.open(markdownUri)
    disposable.dispose()
  }
}
