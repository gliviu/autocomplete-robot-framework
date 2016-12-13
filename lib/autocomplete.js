var keywordsRepo = require('./keywords');
var pathUtils = require('path')
var util = require('util');
var common = require('./common.js')

var getSuggestions = function(prefix, currentResourceKey, settings) {
  if(!prefix.trim()){
    return [];
  }
  settings = settings || {};

  var suggestions = [];

  var libraryNameSuggestions = getLibraryNameSuggestions(prefix, settings);
  Array.prototype.push.apply(suggestions, libraryNameSuggestions);

  var keywordSuggestions = getKeywordSuggestions(prefix, currentResourceKey, settings);
  Array.prototype.push.apply(suggestions, keywordSuggestions);

  return suggestions;
}

// Suggests library names (ie. 'built' suggests 'BuiltIn')
var getLibraryNameSuggestions = function(prefix, settings){
  var suggestions = [];
  prefixLowerCase = prefix.trim().toLowerCase();

  var resourcesMap = keywordsRepo.resourcesMap;
  var libraryNameSuggestions = [];
  for ( var resourceKey in resourcesMap) {
    var resource = resourcesMap[resourceKey];
    if (resource) {
      if(settings.showLibrarySuggestions){
        var libraryNameMatch = (resource.name.toLowerCase().indexOf(prefixLowerCase) === 0);
        if(libraryNameMatch){
          libraryNameSuggestions.push({
            text : resource.name,
            displayText : resource.name,
            type : 'import',
            replacementPrefix : prefix
          });
        }
      }
    }
  }

  libraryNameSuggestions.sort(function(a, b) {
    return compareString(a.displayText, b.displayText)
  });

  return libraryNameSuggestions;
}

// Use dot notation to limit suggestions to a certain library if required.
// A prefix of 'builtin.' should suggest all keywords within 'BuiltIn' library.
// 'builtin.run' should suggest all keywords matching 'run' within 'BuiltIn' library.
// This is enforced by 'resourceFilter' which will limit our search to only a certain library
// and 'keywordPrefix' which will contain only the keyword part of the prefix
// (for 'builtin.run' prefix, keywordPrefix will be 'run').
var getDotNotationInfo = function(prefix, settings){
  prefixLowerCase = prefix.trim().toLowerCase();
  var resourcesMap = keywordsRepo.resourcesMap;
  for ( var resourceKey in resourcesMap) {
    var resource = resourcesMap[resourceKey];
    if (resource) {
      if(prefixLowerCase.startsWith(resource.name.toLowerCase()+'.')){
        return {
          dotNotation : true,
          keywordPrefix : prefix.substring(resource.name.length+1, prefix.length),
          resourceKey : resourceKey
        };
      }
    }
  }
  // Leave only the part after dot
  var dotIndex = prefix.lastIndexOf('.');
  if(dotIndex!=-1){
    prefix = prefix.substring(dotIndex+1, prefix.length);
  }
  return {
    dotNotation : false,
    keywordPrefix : prefix
  };
}

var getKeywordSuggestions = function(prefix, currentResourcePath, settings) {
  currentResourceName = pathUtils.basename(currentResourcePath, pathUtils.extname(currentResourcePath));
  currentResourceKey = common.getResourceKey(currentResourcePath);

  var dotNotationInfo = getDotNotationInfo(prefix, settings);

  var scoredKeywords;
  var replacementPrefix; // This is used by autocomplete-plus to replace the prefix with actual suggestion.
  if(dotNotationInfo.dotNotation){
    // Get suggestion
    scoredKeywords = keywordsRepo.score(dotNotationInfo.keywordPrefix, [dotNotationInfo.resourceKey]);
    sortScoredKeywords(scoredKeywords, currentResourceName);

    if(!settings.removeDotNotation){
      // Replace keyword part of the prefix with suggestion
      replacementPrefix = dotNotationInfo.keywordPrefix;
    } else{
      // Replace whole prefix with suggestion
      replacementPrefix = prefix;
    }
  } else {
    scoredKeywords = keywordsRepo.score(dotNotationInfo.keywordPrefix, getImports(currentResourceKey));
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace keyword part of the prefix with suggestion
    replacementPrefix = dotNotationInfo.keywordPrefix;
  }

  // Remove local (non visible) suggestions
  // Keywords within robot files containing test cases are not visible outside.
  var visibleKeywords = [];
  scoredKeywords.forEach(function(scoredKeyword){
    var keyword = scoredKeyword.keyword;
    var loadLocalKeywords = (currentResourceKey === keyword.resource.resourceKey); // Indicates whether we are looking for keywords in current ressource
    var isVisibleKeyword = true;
    if(keyword.local && !loadLocalKeywords){
      isVisibleKeyword = false;
    }
    if(isVisibleKeyword){
      visibleKeywords.push(keyword);
    }
  })

  // Convert to common suggestions format
  var keywordSuggestions = [];
  for(var i = 0; i < visibleKeywords.length; i++){
    var keyword = visibleKeywords[i];
    resourceKey = keyword.resource.resourceKey;
    keywordSuggestions.push({
      name: keyword.name,
      local: keyword.local,
      snippet : buildText(keyword),
      displayText : buildDisplayText(keyword, settings),
      type : 'keyword',
      leftLabel : buildLeftLabel(keyword),
      rightLabel : buildRightLabel(keyword, resourceKey, keyword.resource.name),
      description : buildDescription(keyword),
      replacementPrefix : replacementPrefix,
      resourceKey : resourceKey,
      keyword : keyword,
    })
  }

  if(keywordSuggestions.length > settings.maxKeywordsSuggestionsCap){
    keywordSuggestions.length = settings.maxKeywordsSuggestionsCap;
  }
  return keywordSuggestions;
}

var getImports = function(currentResourceKey){
  const resourceKeys = new Set()
  const limitSuggestionsToImports = false
  
  if(limitSuggestionsToImports){
    for(const resourceKey in keywordsRepo.resourcesMap){
      resourceKeys.add(resourceKey)
    }
  } else{
    const currentResource = keywordsRepo.resourcesMap[currentResourceKey]
    if(currentResource){
      const resourcesByName = new Map()
      for(const resourceKey in keywordsRepo.resourcesMap){
        const resource = keywordsRepo.resourcesMap[resourceKey]
        resourcesByName.set(resource.name, resource)
      }

      // Import libraries. BuiltIn library is available by default.
      const importedLibraries = [{name: 'BuiltIn'}, ...currentResource.imports.libraries]
      for(const importedLibrary of importedLibraries){
        const resource = resourcesByName.get(importedLibrary.name)
        if(resource){
          resourceKeys.add(resource.resourceKey)
        }
      }
      
      // Import resources
      for(const importedResource of currentResource.imports.resources){
        const resource = resourcesByName.get(importedResource.name)
        if(resource){
          resourceKeys.add(resource.resourceKey)
        }
      }

      // Current resource is available by default
      resourceKeys.add(currentResourceKey)
    }
  }
  
  return Array.from(resourceKeys)
}

// Sort suggested keywords by score. If score is identical sort them alphabetically.
var sortScoredKeywords = function(scoredKeywords, currentResourceName){
  scoredKeywords.sort(function(a, b) {
    var resourceNameA = pathUtils.basename(a.keyword.resource.resourceKey, pathUtils.extname(a.keyword.resource.resourceKey));
    var resourceNameB = pathUtils.basename(b.keyword.resource.resourceKey, pathUtils.extname(b.keyword.resource.resourceKey));

    if(resourceNameA===currentResourceName && resourceNameB!==currentResourceName){
      return -1;
    } else if(resourceNameB===currentResourceName && resourceNameA!==currentResourceName){
      return 1;
    } else if(a.score===b.score){
      return compareString(a.keyword.name, b.keyword.name)
    } else{
      return b.score - a.score;
    }
  });
}

var buildText = function(keyword) {
  var i;
  var argumentsStr = '';
  for (i = 0; i < keyword.arguments.length; i++) {
    var argument = keyword.arguments[i];
    argumentsStr += util.format('    ${%d:%s}', i + 1, argument);
  }

  return keyword.name + argumentsStr;
};

var buildDisplayText = function(keyword, settings) {
  if (settings.showArguments) {
    var argumentsStr = buildArgumentsString(keyword);
    if (argumentsStr){
      return util.format('%s - %s', keyword.name, argumentsStr);
    } else{
      return keyword.name;
    }
  } else {
    return keyword.name;
  }
};

var buildLeftLabel = function(keyword) {
  return '';
};
var buildRightLabel = function(keyword, path, fileName) {
  return fileName;
};
var buildDescription = function(keyword) {
  var argumentsStr = buildArgumentsString(keyword);
  var firstLine = keyword.documentation.split('\n')[0].trim();
  firstLine = firstLine.length===0 || firstLine.endsWith('.')?firstLine:firstLine+'.';
  return util.format('%s Arguments: %s', firstLine, argumentsStr);
};

var buildArgumentsString = function(keyword){
  var i;
  var argumentsStr = '';
  for (i = 0; i < keyword.arguments.length; i++) {
    var argument = keyword.arguments[i];
    argumentsStr += util.format('%s%s', i == 0 ? '' : ', ', argument);
  }
  return argumentsStr;
}

//http://stackoverflow.com/questions/1179366/is-there-a-javascript-strcmp
var compareString = function(str1, str2){
  return ( ( str1 == str2 ) ? 0 : ( ( str1 > str2 ) ? 1 : -1 ) );
}


module.exports = {
  getSuggestions : getSuggestions,
}
