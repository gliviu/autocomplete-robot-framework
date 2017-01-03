'use babel'
const common = require('./common')
const keywordsRepo = require('./keywords')

function buildKeyword(keyword){
  return {
    name: keyword.name,
    documentation : keyword.documentation,
    arguments : [...keyword.arguments],
    startRowNo : keyword.rowNo,
    startColNo : keyword.colNo,
    resource : {
      path : keyword.resource.path,
      libraryPath : keyword.resource.libraryPath,
      hasTestCases : keyword.resource.hasTestCases,
      hasKeywords : keyword.resource.hasKeywords
    }
  }
}

function buildResource(resource){
  return {
    path: resource.path,
    libraryPath: resource.libraryPath,
    hasTestCases: resource.hasTestCases,
    hasKeywords: resource.hasKeywords,
    keywords: resource.keywords?resource.keywords.map(k => buildKeyword(k)):[]
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
  getResourcePaths(){
    const resourcePaths = []
    for(let resourceKey in keywordsRepo.resourcesMap){
      const resource = keywordsRepo.resourcesMap[resourceKey]
      resourcePaths.push(resource.path)
    }
    return resourcePaths
  },
  getKeywordsByName(keywordName){
    const keywords = keywordsRepo.keywordsMap[keywordName.toLowerCase()]
    return keywords?keywords.map(k => buildKeyword(k)):[]
  },
  getResourceByPath(resourcePath){
    for(const resourceKey in keywordsRepo.resourcesMap){
      const resource = keywordsRepo.resourcesMap[resourceKey]
      if(resource && resource.path===resourcePath){
        return buildResource(resource)
      }
    }
    return undefined
  }
}
