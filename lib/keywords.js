var util = require('util');
var pathUtils = require('path')
var fuzzaldrin = require('fuzzaldrin-plus')
var common = require('./common.js');

// Keywords mapped by Robot resource files
// Format:
// {
//     '/dir1/dir2/builtin.xml': {
//         resourceKey: 'builtin',
//         name: 'BuiltIn',
//         extension: '.xml',
//         path: '/dir1/dir2/BuiltIn.xml',
//         libraryPath: '/dir1/dir2/BuiltIn.py'
//         hasTestCases: false,
//         hasKeywords: true,
//         isLibrary: true
//         imports: {
//           libraries: [{name: 'libraryName', alias: 'withNameAlias'}, ...],
//           resources: [{name: 'resourceName', extension: '.robot'}, ...],
//         },
//         keywords: [{
//                 name: '',
//                 documentation: '',
//                 arguments: ['', '', ...],
//                 rowNo: 0,
//                 colNo: 0,
//                 local: true/false # Whether keyword is only visible locally
//                 resource:{
//                      resourceKey: '/dir1/dir2/builtin.xml',
//                      name: 'BuiltIn',
//                      extension: '.xml',
//                      path: '/dir1/dir2/BuiltIn.xml'
//                      hasTestCases: false,
//                      hasKeywords: true,
//                      imports: {
//                          libraries: [{name: 'libraryName', alias: 'withNameAlias'}, ...],
//                          resources: [{name: 'resourceName', extension: '.robot'}, ...],
//                      }
//                 }
//             }, ...
//         ],
//     },
//     ...
// }
var resourcesMap = {};

// Keywords mapped by keyword name
var keywordsMap = {};

// Removes keywords depending on resourceFilter.
// Undefined resourceFilter will cause all keywords to be cleared.
var reset = function(resourceFilter) {
  if(resourceFilter){
    resourceFilter = common.getResourceKey(resourceFilter);
    for(var key in resourcesMap){
      if(key.indexOf(resourceFilter)===0){
        delete resourcesMap[key];
      }
    }
  } else{
    clearObj(resourcesMap);
  }
  rebuildKeywordsMap();
}

var resetKeywordsMap = function(resourceKey, keywords){
  resourceKey = common.getResourceKey(resourceKey);
  var newKwList;
  keywords.forEach(function(keyword){
    var kwname = keyword.name.toLowerCase();
    var kwList = keywordsMap[kwname];
    if(kwList){
      newKwList = [];
      kwList.forEach(function(kw){
        if(kw.resource.resourceKey!==resourceKey){
          newKwList.push(kw);
        }
      });
      if(newKwList.length>0){
        keywordsMap[kwname] = newKwList;
      } else{
        delete keywordsMap[kwname];
      }
    }
  });
}

var rebuildKeywordsMap = function(){
  var resourceKey, resource, keywordList;
  clearObj(keywordsMap);
  for(resourceKey in resourcesMap){
    resource = resourcesMap[resourceKey];
    addKeywordsToMap(resource.keywords);
  }
}

var addKeywordsToMap = function(keywords){
  var keywordList;
  keywords.forEach(function(keyword){
    var kwname = keyword.name.toLowerCase();
    keywordList = keywordsMap[kwname];
    if(!keywordList){
      keywordList = []
      keywordsMap[kwname] = keywordList;
    }
    keywordList.push(keyword);
  });
}

var addResource = function(parsedRobotInfo, resourcePath) {
  var resourceName = pathUtils.basename(resourcePath, pathUtils.extname(resourcePath));
  addKeywords(parsedRobotInfo, common.getResourceKey(resourcePath), resourcePath, resourceName)
}

var addLibrary = function(parsedRobotInfo, libdocPath, libraryName, sourcePath) {
  addKeywords(parsedRobotInfo, common.getResourceKey(libraryName), libdocPath, libraryName, true, sourcePath)
}

// Adds keywords to repository under resource specified by resourceKey.
var addKeywords = function(parsedRobotInfo, resourceKey, path, name, isLibrary = false, libraryPath = undefined) {
  var extension = pathUtils.extname(path);
  hasTestCases = parsedRobotInfo.testCases.length>0,
  hasKeywords = parsedRobotInfo.keywords.length>0
  var buildImportedResource = (res) => ({
    name: pathUtils.basename(res.path, pathUtils.extname(res.path)),
    extension: pathUtils.extname(res.path)
  })
  var resource = {
    resourceKey,
    path,
    name,
    extension,
    imports: {
      libraries: parsedRobotInfo.libraries,
      resources: parsedRobotInfo.resources.map(buildImportedResource)
    },
    hasTestCases,
    hasKeywords,
    isLibrary,
    libraryPath
  }

  // Add some helper properties to each keyword
  for(var i = 0; i<parsedRobotInfo.keywords.length; i++){
    parsedRobotInfo.keywords[i].resource = resource;
    parsedRobotInfo.keywords[i].local = hasTestCases;
  }

  // Populate keywordsMap
  if(resourcesMap[resourceKey]){
    resetKeywordsMap(resourceKey, resourcesMap[resourceKey].keywords);
  }
  addKeywordsToMap(parsedRobotInfo.keywords);

  // Populate resourcesMap
  resourcesMap[resourceKey] = {
    resourceKey,
    name,
    path,
    extension,
    keywords: parsedRobotInfo.keywords,
    imports: {
      libraries: parsedRobotInfo.libraries,
      resources: parsedRobotInfo.resources.map(buildImportedResource)
    },
    hasTestCases,
    hasKeywords,
    isLibrary,
    libraryPath
  };
  return
}

// Returns a list of keywords scored by query string.
// resourceKeys: limits suggestions to only these resources
// If 'query' is not defined or is '', returns all keywords. Scores will be identical for each entry.
var score = function(query, resourceKeys) {
  query = query || '';
  query = query.trim().toLowerCase();
  var suggestions = [];
  var prepQuery = fuzzaldrin.prepQuery(query);
  for ( var resourceKey in resourcesMap) {
    if(resourceKeys.length>0 && !resourceKeys.includes(resourceKey)){
      continue;
    }
    var resource = resourcesMap[resourceKey];
    if (resource) {
      for (var i = 0; i < resource.keywords.length; i++) {
        var keyword = resource.keywords[i];
        var score = query===''?1:fuzzaldrin.score(keyword.name, query, prepQuery); // If query is empty string, we will show all keywords.
        if (score) {
          suggestions.push({
            keyword : keyword,
            score: score
          });
        }
      }
    }
  }

  return suggestions;
};

function printDebugInfo(options) {
  options = options || {
    showLibdocFiles: true,
    showRobotFiles: true,
    showAllSuggestions: false
  };
  var robotFiles = [], libdocFiles = [];
  var ext;
  for(key in resourcesMap){
    ext = pathUtils.extname(key);
    if(ext==='.xml' || ext==='.html'){
      libdocFiles.push(pathUtils.basename(key));
    } else{
      robotFiles.push(pathUtils.basename(key));
    }
  }
  if(options.showRobotFiles){
    console.log('Autocomplete robot files:' + robotFiles);
  }
  if(options.showLibdocFiles){
    console.log('Autocomplete libdoc files:' + libdocFiles);
  }
  if(options.showAllSuggestions){
    console.log('All suggestions: ' + JSON.stringify(resourcesMap, null, 2));
    // console.log('All suggestions: ' + JSON.stringify(keywordsMap, null, 2));
  }
}

var clearObj = function(obj){
  for (var key in obj){
    if (obj.hasOwnProperty(key)){
      delete obj[key];
    }
  }
}

/**
 * Returns a Map of resources grouped by name.
 * lowerCase: if true, all names will be lowercased
 */
var getResourcesByName = function(lowerCase = false){
  const resourcesByName = new Map()
  for(const resourceKey in resourcesMap){
    const resource = resourcesMap[resourceKey]
    const resourceName = lowerCase?resource.name.toLowerCase():resource.name
    let names = resourcesByName.get(resourceName)
    if(!names){
      names = []
      resourcesByName.set(resourceName, names)
    }
    names.push(resource)
  }
  return resourcesByName;
}

module.exports = {
  reset: reset,
  addResource: addResource,
  addLibrary, addLibrary,
  score: score,
  printDebugInfo: printDebugInfo,
  resourcesMap: resourcesMap,
  keywordsMap: keywordsMap,
  getResourcesByName: getResourcesByName
}
