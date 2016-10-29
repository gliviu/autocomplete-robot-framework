var util = require('util');
var pathUtils = require('path')
var fuzzaldrin = require('fuzzaldrin-plus')
var robotParser = require('./parse-robot');
var libdocParser = require('./parse-libdoc');
var common = require('./common.js');

// Keywords mapped by Robot resource files
// Format:
// {
//     '/dir1/dir2/builtin.xml': {
//         name: 'BuiltIn',
//         extension: '.xml',
//         path: '/dir1/dir2/BuiltIn.xml'
//         hasTestCases: false,
//         hasKeywords: true,
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
//                      hasKeywords: true
//                 }
//             }, ...
//         ]
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

// Parses robot file for keywords and adds them to repository under resource specified by resourceKey.
var addRobotKeywords = function(fileContent, resourcePath) {
  var parsedData = robotParser.parse(fileContent);
  processParsedData(parsedData, resourcePath);
}

// Parses xml libdoc file for keywords and adds them to repository under resource specified by resourceKey.
var addLibdocKeywords = function(fileContent, resourcePath) {
  var parsedData = libdocParser.parse(fileContent);
  processParsedData(parsedData, resourcePath);
}

var processParsedData = function(parsedData, resourcePath){
  var ext = pathUtils.extname(resourcePath);
  var resourceName = pathUtils.basename(resourcePath, ext);
  var resourceKey = common.getResourceKey(resourcePath);
  hasTestCases = parsedData.testCases.length>0,
  hasKeywords = parsedData.keywords.length>0
  var resource = {
    resourceKey : resourceKey,
    path: resourcePath,
    name : resourceName,
    extension: ext,
    hasTestCases : hasTestCases,
    hasKeywords : hasKeywords
  }

  // Add some helper properties to each keyword
  for(var i = 0; i<parsedData.keywords.length; i++){
    parsedData.keywords[i].resource = resource;
    parsedData.keywords[i].local = hasTestCases;
  }

  // Populate keywordsMap
  if(resourcesMap[resourceKey]){
    resetKeywordsMap(resourceKey, resourcesMap[resourceKey].keywords);
  }
  addKeywordsToMap(parsedData.keywords);

  // Populate resourcesMap
  resourcesMap[resourceKey] = {
    name: resourceName,
    path: resourcePath,
    extension: ext,
    keywords: parsedData.keywords,
    hasTestCases : hasTestCases,
    hasKeywords : hasKeywords
  };

}

// Returns a list of keywords scored by query string.
// resourceFilter: if specified, returns suggestions only by matched resources
// If 'query' is not defined or is '', returns all keywords. Scores will be identical for each entry.
// 'excludeResourceFilter' has precedence over 'resourceFilter'.
var score = function(query, resourceFilter, excludeResourceFilter) {
  resourceFilter = resourceFilter?common.getResourceKey(resourceFilter):undefined;
  excludeResourceFilter = excludeResourceFilter?common.getResourceKey(excludeResourceFilter):undefined;

  query = query || '';
  query = query.trim().toLowerCase();
  var suggestions = [];
  var prepQuery = fuzzaldrin.prepQuery(query);
  for ( var resourceKey in resourcesMap) {
    if(excludeResourceFilter && resourceKey.indexOf(excludeResourceFilter)===0){
      continue;
    }
    if(resourceFilter && resourceKey.indexOf(resourceFilter)!==0){
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

module.exports = {
  reset: reset,
  addRobotKeywords: addRobotKeywords,
  addLibdocKeywords: addLibdocKeywords,
  score: score,
  printDebugInfo: printDebugInfo,
  resourcesMap: resourcesMap,
  keywordsMap: keywordsMap
}
