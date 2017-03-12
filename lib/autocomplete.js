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
            description : resource.path,
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

// Rules: Scope modifier is optional and no spaces allowes in it. Everything allowed after that.
// Regexp is applied to reversed order prefix.
const VALID_PREFIX=/^([^.]*)(.[^ ]*)?$/

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

  if(![...prefixLowerCase].reverse().join('').match(VALID_PREFIX)){
    scopeModifierInfo.scopeModifier = 'invalid'
    scopeModifierInfo.keywordPrefix = undefined
  } else if(![...prefixLowerCase].includes('.')){
    scopeModifierInfo.scopeModifier = 'default'
    scopeModifierInfo.keywordPrefix = prefix
  } else if(prefixLowerCase.startsWith(`.`)){
    scopeModifierInfo.scopeModifier = 'global'
    scopeModifierInfo.keywordPrefix = prefix.substring(1, prefix.length)
  } else if(settings.internalScopeModifier && prefixLowerCase.startsWith(`${settings.internalScopeModifier}.`)){
    scopeModifierInfo.scopeModifier = 'internal'
    scopeModifierInfo.keywordPrefix = prefix.substring(settings.internalScopeModifier.length+1, prefix.length)
  } else{
    const resourceKeys = new Set()
    let resourceName = undefined
    for ( const resourceKey in resourcesMap) {
      const resource = resourcesMap[resourceKey];
      if (resource && prefixLowerCase.startsWith(`${resource.name.toLowerCase()}.`)) {
        resourceKeys.add(resourceKey)
        resourceName = resource.name
      }
    }
    if(resourceKeys.size>0){
      scopeModifierInfo.scopeModifier = 'file'
      scopeModifierInfo.keywordPrefix = prefix.substring(resourceName.length+1, prefix.length)
      scopeModifierInfo.resourceKeys = resourceKeys
    }
  }
  return scopeModifierInfo
}

var getKeywordSuggestions = function(prefix, currentResourcePath, settings) {
  const currentResourceName = pathUtils.basename(currentResourcePath, pathUtils.extname(currentResourcePath));
  const currentResourceKey = common.getResourceKey(currentResourcePath);

  const scopeModifierInfo = getScopeModifier(prefix, settings);

  const imports = getImports(currentResourceKey)

  let scoredKeywords;
  let replacementPrefix; // This is used by autocomplete-plus to replace the prefix with actual suggestion.
  if(scopeModifierInfo.scopeModifier==='file'){
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, scopeModifierInfo.resourceKeys);
    sortScoredKeywords(scoredKeywords, currentResourceName);

    replacementPrefix = determineReplacementPrefix(prefix, scopeModifierInfo.keywordPrefix, settings)
  } else if (scopeModifierInfo.scopeModifier==='default') {
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, imports);
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace keyword part of the prefix with suggestion
    replacementPrefix = scopeModifierInfo.keywordPrefix;
  } else if (scopeModifierInfo.scopeModifier==='global') {
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, new Set());
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace whole prefix with suggestion
    replacementPrefix = prefix;
  } else if (scopeModifierInfo.scopeModifier==='internal') {
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, new Set([currentResourceKey]));
    sortScoredKeywords(scoredKeywords, currentResourceName);

    // Replace whole prefix with suggestion
    replacementPrefix = prefix;
  } else if (scopeModifierInfo.scopeModifier==='unknown') {
    // 'unknown' is treated just like 'default' scope modifier
    scoredKeywords = keywordsRepo.score(scopeModifierInfo.keywordPrefix, imports);
    sortScoredKeywords(scoredKeywords, currentResourceName);

    replacementPrefix = scopeModifierInfo.keywordPrefix
  } else if (scopeModifierInfo.scopeModifier==='invalid') {
    scoredKeywords = [];

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
  let keywordSuggestions = [];
  for(var i = 0; i < visibleKeywords.length; i++){
    const keyword = visibleKeywords[i];
    const resourceKey = keyword.resource.resourceKey;
    const isAmbiguous = isKeywordAmbiguous(keyword, imports)
    keywordSuggestions.push({
      name: keyword.name,
      local: keyword.local,
      snippet : buildText(keyword, isAmbiguous, settings),
      displayText : buildDisplayText(keyword, settings),
      type : 'keyword',
      leftLabel : buildLeftLabel(keyword),
      rightLabel : buildRightLabel(keyword),
      descriptionMarkdown : buildDocumentationMarkdown(keyword),
      description : buildDocumentation(keyword),
      replacementPrefix : isAmbiguous?prefix:replacementPrefix,
      resourceKey : resourceKey,
      keyword : keyword,
    })
  }

  if(keywordSuggestions.length > settings.maxKeywordsSuggestionsCap){
    keywordSuggestions.length = settings.maxKeywordsSuggestionsCap;
  }
  return keywordSuggestions;
}

var determineReplacementPrefix = function(prefix, keywordPrefix, settings){
  if(!settings.removeDotNotation){
    // Replace keyword part of the prefix with suggestion
    return keywordPrefix
  } else{
    // Replace whole prefix with suggestion
    return prefix
  }
}

/**
 * A keyword is considered ambiguous if it is available from more than one import.
 * An ambiguous keyword should be prefixed with imported resource/library.
 * Example
 *   Library RequestsLibrary
 *   Library FtpLibrary
 *
 *   'delete' autocompletes to FtpLibrary.Delete or RequestsLibrary.Delete
 *   instead of just Delete
 */
var isKeywordAmbiguous = function(keyword, imports){
  const ambiguousKeywords = keywordsRepo.keywordsMap[keyword.name.toLowerCase()]
  if(ambiguousKeywords.length<=1){
    return false
  } else{
    const importedKeywords = ambiguousKeywords.filter(keyword => imports.has(keyword.resource.resourceKey))
    return importedKeywords.length > 1
  }
}

/*
 * Returns a Set of distinct resourceKeys representing
 * imported libraries and resources.
 */
var getImports = function(currentResourceKey){
  const resourceKeys = new Set()

  const currentResource = keywordsRepo.resourcesMap[currentResourceKey]
  if(currentResource){
    const {resourcesByName} = keywordsRepo.computeGroupedResources()

    // Import libraries. BuiltIn library is available by default.
    const importedLibraries = [{name: 'BuiltIn'}, ...currentResource.imports.libraries]
    for(const importedLibrary of importedLibraries){
      const resources = resourcesByName.get(importedLibrary.name)
      if(resources){
        resources.forEach(res => resourceKeys.add(res.resourceKey))
      }
    }

    // Import resources
    for(const importedResource of currentResource.imports.resources){
      if(importedResource.resourceKey){
        // imported resource is properly resolv resolved by path
        resourceKeys.add(importedResource.resourceKey)
      } else{
        // resolve resource by name; multiple resources might be identified for one import
        const resources = resourcesByName.get(importedResource.name)
        if(resources){
          resources
          .filter(res => importedResource.extension.toLowerCase() === res.extension.toLowerCase())
          .forEach(res => resourceKeys.add(res.resourceKey))
        }
      }
    }

    // Current resource is available by default
    resourceKeys.add(currentResourceKey)
  }

  return resourceKeys
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

var buildText = function(keyword, isAmbiguous, settings) {
  var i;
  var argumentsStr = '';
  if(settings.suggestArguments){
    for(let i = 0; i<keyword.arguments.length; i++){
      const argument = keyword.arguments[i]
      const isDefaultArgument = argument.indexOf('=')!=-1
      if(isDefaultArgument && !settings.includeDefaultArguments){
        continue
      } else{
        argumentsStr += util.format('%s${%d:%s}', settings.argumentSeparator, i + 1, argument);
      }
    }
  }
  if(isAmbiguous){
    return `${keyword.resource.name}.${keyword.name}${argumentsStr}`
  } else{
    return `${keyword.name}${argumentsStr}`
  }
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
var buildRightLabel = function(keyword) {
  if(keyword.resource.isLibrary){
    const name = `.${keyword.resource.name}`
    return name.substring(name.lastIndexOf('.')+1)
  } else{
    return pathUtils.basename(keyword.resource.path)
  }
};

var buildDocumentationMarkdown = function(keyword) {
  const argumentsStr = buildArgumentsString(keyword);
  let firstLine = keyword.documentation.split('\n')[0].trim();
  firstLine = firstLine.length===0 || firstLine.endsWith('.')?firstLine:firstLine+'.';
  firstLine = firstLine || 'n/a'
  const path = keyword.resource.libraryPath || keyword.resource.path
  return `${firstLine}\n\n(${argumentsStr})\n\n${path}`;
};

// Needed for Atom prior to 1.14 that do not support markdown.
var buildDocumentation = function(keyword) {
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
