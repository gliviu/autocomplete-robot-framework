var util = require('util');
var pathUtils = require('path')
var fuzzaldrin = require('fuzzaldrin-plus')
var robotParser = require('./parse-robot');
var libdocParser = require('./parse-libdoc');

// Keywords mapped by Robot resource files
// Format:
// {
//     '/dir1/dir2/BuiltIn.xml': {
//         name: 'BuiltIn',
//         extension: '.xml',
//         keywords: [{
//                 name: '',
//                 documentation: '',
//                 arguments: ['', '', ...],
//                 local: true/false # Whether keyword is only visible locally
//                 resource:{
//                      resourceKey: '/dir1/dir2/BuiltIn.xml',
//                      name: 'BuiltIn',
//                      extension: '.xml',
//                      hasTestCases: false,
//                      hasKeywords: true
//                 }
//             }, ...
//         ],
//         hasTestCases: false,
//         hasKeywords: true
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
    for(var key in resourcesMap){
      if(key.indexOf(resourceFilter)===0){
        delete resourcesMap[key]
      }
    }
  } else{
    resourcesMap = {};
  }
  rebuildKeywordsMap();
}

var resetKeywordsMap = function(resourceKey, keywords){
  var newKwList;
  keywords.forEach(function(keyword){
    var kwList = keywordsMap[keyword.name];
    if(kwList){
      newKwList = [];
      kwList.forEach(function(kw){
        if(kw.resource.resourceKey!==resourceKey){
          newKwList.push(kw);
        }
      });
      if(newKwList.length>0){
        keywordsMap[keyword.name] = newKwList;
      } else{
        delete keywordsMap[keyword.name];
      }
    }
  });
}

var rebuildKeywordsMap = function(){
  var resourceKey, resource, keywordList;
  keywordsMap = {};
  for(resourceKey in resourcesMap){
    resource = resourcesMap[resourceKey];
    addKeywordsToMap(resource.keywords);
  }
}

var addKeywordsToMap = function(keywords){
  var keywordList;
  keywords.forEach(function(keyword){
    keywordList = keywordsMap[keyword.name];
    if(!keywordList){
      keywordList = []
      keywordsMap[keyword.name] = keywordList;
    }
    keywordList.push(keyword);
  });
}

// Parses robot file for keywords and adds them to repository under resource specified by resourceKey.
var addRobotKeywords = function(fileContent, resourceKey) {
  var parsedData = robotParser.parse(fileContent);
  processParsedData(parsedData, resourceKey);
}

// Parses xml libdoc file for keywords and adds them to repository under resource specified by resourceKey.
var addLibdocKeywords = function(fileContent, resourceKey) {
  var parsedData = libdocParser.parse(fileContent);
  processParsedData(parsedData, resourceKey);
}

var processParsedData = function(parsedData, resourceKey){
  resourceKey = pathUtils.normalize(resourceKey);
  ext = pathUtils.extname(resourceKey);
  var resourceName = pathUtils.basename(resourceKey, ext);
  var resource = {
    resourceKey : resourceKey,
    name : resourceName,
    extension: ext,
    hasTestCases : parsedData.hasTestCases,
    hasKeywords : parsedData.hasKeywords
  }

  // Add some helper properties to each keyword
  for(var i = 0; i<parsedData.keywords.length; i++){
    parsedData.keywords[i].resource = resource;
    parsedData.keywords[i].local = parsedData.hasTestCases;
  }

  // Populate keywordsMap
  if(resourcesMap[resourceKey]){
    resetKeywordsMap(resourceKey, resourcesMap[resourceKey].keywords);
  }
  addKeywordsToMap(parsedData.keywords);

  // Populate resourcesMap
  resourcesMap[resourceKey] = {
    name: resourceName,
    extension: ext,
    keywords: parsedData.keywords,
    hasTestCases : parsedData.hasTestCases,
    hasKeywords : parsedData.hasKeywords
  };

}

// Returns a list of keywords scored by query string.
// resourceFilter: if specified, returns suggestions only by matched resources
// If 'query' is not defined or is '', returns all keywords. Scores will be identical for each entry.
// 'excludeResourceFilter' has precedence over 'resourceFilter'.
var score = function(query, resourceFilter, excludeResourceFilter) {
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

module.exports = {
  reset : reset,
  addRobotKeywords: addRobotKeywords,
  addLibdocKeywords : addLibdocKeywords,
  score : score,
  printDebugInfo : printDebugInfo,
  resourcesMap: resourcesMap,
}
