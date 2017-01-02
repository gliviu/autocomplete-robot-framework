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
        const resourceFullName = resource.name
        const resourceName = resourceFullName.split('.').pop()
        const libraryNameMatchName = (resourceName.toLowerCase().indexOf(prefixLowerCase) === 0);
        const libraryNameMatchFullName = (resourceFullName.toLowerCase().indexOf(prefixLowerCase) === 0);
        if(libraryNameMatchName){
          libraryNameSuggestions.push({
            text : resourceFullName,
            displayText : resourceName,
            rightLabel : resourceFullName,
            type : 'import',
            replacementPrefix : prefix
          });
        } else if(libraryNameMatchFullName){
          libraryNameSuggestions.push({
            text : resourceFullName,
            displayText : resourceFullName,
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
var getScopeModifier = function(prefix, settings){
  prefixLowerCase = prefix.trim().toLowerCase();
  const resourcesMap = keywordsRepo.resourcesMap;
  const scopeModifierInfo = {
    scopeModifier : 'unknown',
    keywordPrefix : prefix.substring(prefix.lastIndexOf('.')+1, prefix.length)
  }

  if(![...prefixLowerCase].includes('.')){
    scopeModifierInfo.scopeModifier = 'default'
    scopeModifierInfo.keywordPrefix = prefix
  } else if(prefixLowerCase.startsWith(`.`)){
    scopeModifierInfo.scopeModifier = 'empty'
    scopeModifierInfo.keywordPrefix = undefined
  }
  else if(settings.globalScopeModifier && prefixLowerCase.startsWith(`${settings.globalScopeModifier}.`)){
    scopeModifierInfo.scopeModifier = 'global'
    scopeModifierInfo.keywordPrefix = prefix.substring(settings.globalScopeModifier.length+1, prefix.length)
  } else if(settings.internalScopeModifier && prefixLowerCase.startsWith(`${settings.internalScopeModifier}.`)){
    scopeModifierInfo.scopeModifier = 'internal'
    scopeModifierInfo.keywordPrefix = prefix.substring(settings.internalScopeModifier.length+1, prefix.length)
  } else{
    const resourceKeys = []
    let resourceName = undefined
    for ( const resourceKey in resourcesMap) {
      const resource = resourcesMap[resourceKey];
      if (resource && prefixLowerCase.startsWith(`${resource.name.toLowerCase()}.`)) {
        resourceKeys.push(resourceKey)
        resourceName = resource.name
      }
    }
    if(resourceKeys.length>0){
      scopeModifierInfo.scopeModifier = 'file'
      scopeModifierInfo.keywordPrefix = prefix.substring(resourceName.length+1, prefix.length)
      scopeModifierInfo.resourceKeys = resourceKeys
    }
  }
  return scopeModifierInfo
}

var getKeywordSuggestions = function(prefix, currentResourcePath, settings) {
  currentResourceName = pathUtils.basename(currentResourcePath, pathUtils.extname(currentResourcePath));
  currentResourceKey = common.getResourceKey(currentResourcePath);

  var scopeModifierInfo = getScopeModifier(prefix, settings);
  // todo remove
  console.log(JSON.stringify(scopeModifierInfo));

  var scoredKeywords;
  var replacementPrefix; // This is used by autocomplete-plus to replace the prefix with actual suggestion.
  if(scopeModifierInfo.scopeModifier==='file'){
    // Get suggestion
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, scopeModifierInfo.resourceKeys);
    sortScoredKeywords(scoredKeywords, currentResourceName);

    if(!settings.removeDotNotation){
      // Replace keyword part of the prefix with suggestion
      replacementPrefix = scopeModifierInfo.keywordPrefix;
    } else{
      // Replace whole prefix with suggestion
      replacementPrefix = prefix;
    }
  } else if (scopeModifierInfo.scopeModifier==='default') {
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, getImports(currentResourceKey));
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace keyword part of the prefix with suggestion
    replacementPrefix = scopeModifierInfo.keywordPrefix;
  } else if (scopeModifierInfo.scopeModifier==='global') {
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, []);
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace whole prefix with suggestion
    replacementPrefix = prefix;
  } else if (scopeModifierInfo.scopeModifier==='internal') {
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, [currentResourceKey]);
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace whole prefix with suggestion
    replacementPrefix = prefix;
  } else if (scopeModifierInfo.scopeModifier==='unknown') {
    // 'unknown' is treated just like 'default' scope modifier
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, getImports(currentResourceKey));
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace whole prefix with suggestion
    replacementPrefix = prefix;
  } else{
    throw new Error(`Unknown scope modifier '${scopeModifierInfo.scopeModifier}'`)
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

/*
 * Returns list of distinct resourceKeys representing
 * imported libraries and resources.
 */
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
      const globalResourcesByName = keywordsRepo.getResourcesByName()

      // Import libraries. BuiltIn library is available by default.
      const importedLibraries = [{name: 'BuiltIn'}, ...currentResource.imports.libraries]
      for(const importedLibrary of importedLibraries){
        const resources = globalResourcesByName.get(importedLibrary.name)
        if(resources){
          resources.forEach(res => resourceKeys.add(res.resourceKey))
        }
      }

      // Import resources
      for(const importedResource of currentResource.imports.resources){
        const resources = globalResourcesByName.get(importedResource.name)
        if(resources){
          resources
            .filter(res => importedResource.extension.toLowerCase() === res.extension.toLowerCase())
            .forEach(res => resourceKeys.add(res.resourceKey))
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
