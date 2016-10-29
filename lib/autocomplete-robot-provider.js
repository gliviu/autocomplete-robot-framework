'use babel'
const common = require('./common')
const keywordsRepo = require('./keywords')

function buildKeyword(keyword){
  return {
    name: keyword.name,
    documentation : keyword.documentation,
    arguments : [...keyword.arguments],
    rowNo : keyword.rowNo,
    colNo : keyword.colNo,
    resource : {
      resourcekeywordey : keyword.resource.resourceKey,
      path : keyword.resource.path,
      name : keyword.resource.name,
      extension : keyword.resource.extension,
      hasTestCases : keyword.resource.hasTestCases,
      hasKeywords : keyword.resource.hasKeywords
    }
  }
}

function buildResource(resource){
  return {
    name: resource.name,
    extension: resource.extension,
    path: resource.path,
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
      const resourceKey = common.getResourceKey(resourcePath)
      resource = keywordsRepo.resourcesMap[resourceKey]
      return resource?buildResource(resource):undefined
    }
  }
