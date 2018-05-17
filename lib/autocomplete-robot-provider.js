'use babel'
const common = require('./common')
const keywordsRepo = require('./keywords')
const pathUtils = require('path')

function buildImportedLibrary(library){
  return {
    name: library.name,
    alias: library.alias,
    resourceKey: resource.resourceKey
  }
}

function buildImportedResource(resource){
  return {
    name: resource.name,
    extension: resource.extension,
    resourceKey: resource.resourceKey
  }
}

function buildKeyword(keyword){
  const importedResources = keyword.resource.imports.resources || []
  const importedLibraries = keyword.resource.imports.libraries || []
  return {
    name: keyword.name,
    documentation: keyword.documentation,
    arguments: [...keyword.arguments],
    startRowNo: keyword.rowNo,
    startColNo: keyword.colNo,
    resourceKey: keyword.resource.resourceKey,
    // todo: Deprecated.
    resource: {
      path : keyword.resource.path,
      name: keyword.resource.name,
      libraryPath : keyword.resource.libraryPath,
      hasTestCases : keyword.resource.hasTestCases,
      hasKeywords : keyword.resource.hasKeywords,
      isLibrary : keyword.resource.isLibrary,
      imports: {
        libraries: importedLibraries.map(lib => buildImportedLibrary(lib)),
        resources: importedResources.map(res => buildImportedResource(res))
      }
    }
  }
}

function buildResource(resource){
  const importedResources = resource.imports.resources || []
  const importedLibraries = resource.imports.libraries || []
  return {
    resourceKey: resource.resourceKey,
    path: resource.path,
    name: resource.name,
    extension: resource.extension,
    libraryPath: resource.libraryPath,
    hasTestCases: resource.hasTestCases,
    hasKeywords: resource.hasKeywords,
    isLibrary : resource.isLibrary,
    keywords: resource.keywords?resource.keywords.map(k => buildKeyword(k)):[],
    imports: {
      libraries: importedLibraries.map(lib => buildImportedLibrary(lib)),
      resources: importedResources.map(res => buildImportedResource(res))
    }
  }
}

export default {
  getKeywordNames(){
    const kwNames = new Set()
    for(let kwName in keywordsRepo.keywordsMap){
      const keywords = keywordsRepo.keywordsMap[kwName]
      keywords.forEach(kw => kwNames.add(kw.name))
    }
    return [...kwNames]
  },
  getResourceKeys(){
    const resourceKeys = []
    for(let resourceKey in keywordsRepo.resourcesMap){
      resourceKeys.push(resourceKey)
    }
    return resourceKeys
  },
  getKeywordsByName(keywordName){
    const keywords = keywordsRepo.keywordsMap[keywordName.toLowerCase()]
    return keywords?keywords.map(k => buildKeyword(k)):[]
  },
  getResourceByKey(resourceKey){
    const resource = keywordsRepo.resourcesMap[resourceKey]
    return resource?buildResource(resource):undefined
  }
}
