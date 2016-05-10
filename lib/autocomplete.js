var robotParser = require('./parse-robot');
var libdocParser = require('./parse-libdoc');
var fs = require('fs');
var util = require('util');
var pathUtils = require('path')

// Holds suggestions indexed by file
var allSuggestions = {};

var reset = function(path) {
  if(path){
    for(var key in allSuggestions){
      if(key.indexOf(path)===0){
        delete allSuggestions[key]
      }
    }
  } else{
    allSuggestions = {};
  }
}

var processRobotBuffer = function(bufferContent, path, settings) {
  settings = settings || {};
  ext = pathUtils.extname(path)
  parseData = robotParser.parse(bufferContent);
  var suggestions = [];

  path = pathUtils.normalize(path);
  fileName = pathUtils.basename(path, ext);
  parseData.keywords.forEach(function(keyword) {
    suggestions.push({
      snippet : buildText(keyword),
      displayText : buildDisplayText(keyword, settings),
      type : 'keyword',
      leftLabel : buildLeftLabel(keyword),
      rightLabel : buildRightLabel(keyword, path, fileName),
      description : buildDescription(keyword),
      keyword : keyword,
    })
  });

  allSuggestions[path] = {
    hasTestCases : parseData.hasTestCases,
    suggestions : suggestions,
    fileName : fileName
  }
}

var processLibdocBuffer = function(fileContent, path, settings) {
  settings = settings || {};
  var parsedData = libdocParser.parse(fileContent);
  var suggestions = [];
  path = pathUtils.normalize(path);
  fileName = pathUtils.basename(path, pathUtils.extname(path));
  parsedData.keywords.forEach(function(keyword) {
    suggestions.push({
      snippet : buildText(keyword),
      displayText : buildDisplayText(keyword, settings),
      type : 'keyword',
      leftLabel : buildLeftLabel(keyword),
      rightLabel : buildRightLabel(keyword, path, fileName),
      description : buildDescription(keyword),
      keyword : keyword,
    })
  });

  allSuggestions[path] = {
    hasTestCases : parsedData.hasTestCases,
    suggestions : suggestions,
    fileName : fileName
  }
};

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

var getSuggestions = function(prefix, currentlyEditedPath, settings) {
  prefix = prefix.trim().toLowerCase();
  if (!prefix) {
    return [];
  }
  currentlyEditedPath = pathUtils.normalize(currentlyEditedPath);
  settings = settings || {};
  var suggestions = [];
  var librarySuggestions = [];
  var prefixRegexp = createPrefixRegexp(prefix, settings);
  for ( var path in allSuggestions) {
    var currentSuggestions = allSuggestions[path];
    if (currentSuggestions) {
      if (currentlyEditedPath === path || !currentSuggestions.hasTestCases) {
        // Library name suggestions
        if(settings.showLibrarySuggestions){
          var libraryNameMatch = (currentSuggestions.fileName.toLowerCase().indexOf(prefix) === 0);
          if(libraryNameMatch){
              librarySuggestions.push(currentSuggestions.fileName);
          }
        }

        // Keyword suggestions
        var fileNameMatch = false;  // If true, suggests all keywords inside robot file
        if (settings.matchFileName) {
          var fileNameMatchPrefixRegexp;
          fileNameMatch = (prefix.indexOf(currentSuggestions.fileName
                  .toLowerCase()) === 0);
          if (fileNameMatch) {
            var newPrefix = prefix.substring(
                currentSuggestions.fileName.length, prefix.length);
            fileNameMatchPrefixRegexp = createPrefixRegexp(newPrefix, settings);
          }
        }
        for (var i = 0; i < currentSuggestions.suggestions.length; i++) {
          var currentSuggestion = currentSuggestions.suggestions[i];

          var match;
          if (settings.matchFileName && fileNameMatch) {
            match = fileNameMatchPrefixRegexp
              .exec(currentSuggestion.keyword.name);
          } else {
            match = prefixRegexp.exec(currentSuggestion.keyword.name)
          }
          if (match) {
            suggestions.push({
              suggestion : currentSuggestion,
              index : match.index,
              matched : match[0].toLowerCase() === prefix,
              currentFile : currentlyEditedPath === path,
              fileNameMatch : fileNameMatch,
              matcher: match,
            });
          }
        }
      }
    }
  }

  buildMatchScores(suggestions);

  suggestions.sort(function(a, b) {
    var scorea = (a.index==0 ? 1 : 0) + (a.matched ? 1 : 0) + (a.currentFile ? 1 : 0)
        + (a.fileNameMatch ? 1 : 0) + a.matchScore;
    var scoreb = (b.index==0 ? 1 : 0) + (b.matched ? 1 : 0) + (b.currentFile ? 1 : 0)
        + (b.fileNameMatch ? 1 : 0) + b.matchScore;
    if(scorea===scoreb){
      return compareString(a.suggestion.keyword.name, b.suggestion.keyword.name)
    } else{
      return scoreb - scorea;
    }
  });

  var result = [];
  librarySuggestions.forEach(function(libraryName) {
    result.push({
      text : libraryName,
      displayText : libraryName,
      type : 'import',
    });
  });
  suggestions.forEach(function(currentSuggestion) {
    var suggestion = currentSuggestion.suggestion;
    result.push({
      snippet : suggestion.snippet,
      displayText : suggestion.displayText,
      type : suggestion.type,
      leftLabel : suggestion.leftLabel,
      rightLabel : suggestion.rightLabel,
      description : suggestion.description
    });
  });
  return result;
};

function buildMatchScores(suggestions){
  for (var i = 0; i < suggestions.length; i++) {
    var suggestion = suggestions[i];
    suggestion.matchScore = createMatchScore(suggestion.matcher);
  }
  normalizeMatchScores(suggestions);
}

var createMatchScore = function(match){
  var score = 0;
  for (var i = 1; i < match.length; i++) {
    score+=match[i].length;
  }
  return score;
}

var normalizeMatchScores = function(suggestions){
  suggestions.sort(function(a, b){
    return b.matchScore-a.matchScore;
  });
  var currentScore = 0;
  var previousMatchScore = undefined;
  for (var i = 0; i < suggestions.length; i++) {
    var suggestion = suggestions[i];
    if(suggestion.matchScore===previousMatchScore){
      suggestion.matchScore = currentScore-1;
    } else{
      previousMatchScore = suggestion.matchScore;
      suggestion.matchScore = currentScore;
      currentScore++;
    }
  }
  return suggestions
}


/**
 * Given prefix 'seva' creates regex /(^| )s(?=e|.*? e)(.*?)e(?=v|.*? v)(.*?)v(?=a|.*? a)(.*?)a/
 * Matches highlighted in uppercase below:
 *   SEt global VAriable
 *   SEt VAriable
 * This regex will only match at beginning of words. For example 'SEt xVAriable' will not match as 'VA' does not start a word in this case.
 * Note that in order for match score to work (see buildMatchScores() above) it is necessary to have capture groups in between matches.
 * For example above 'SEt global VAriable', we have to capture 't global '. This will be used by the scoring algorithm.
 */
var createPrefixRegexp = function(prefix, settings) {
  var prefixRegexpArr = [];
  if (settings.matchPrefixStartOnly) {
    prefixRegexpArr.push('^');
  }
  if(prefix.length===1){
    prefixRegexpArr.push('(^|[ .])')
    prefixRegexpArr.push(escapeRegExp(prefix.charAt(i)))
  } else{
    prefixRegexpArr.push('(^|[ .])')
    for (var i = 0; i < prefix.length; i++) {
      if(i===0){
        prefixRegexpArr.push(escapeRegExp(prefix.charAt(i)))
        var nextChar = prefix.charAt(i+1);
        prefixRegexpArr.push('(?='+nextChar+'|.*?[ .]'+nextChar+')')
      } else if(i<prefix.length){
        prefixRegexpArr.push('(.*?)')
        prefixRegexpArr.push(escapeRegExp(prefix.charAt(i)))
        var nextChar = prefix.charAt(i+1);
        prefixRegexpArr.push('(?='+nextChar+'|.*?[ .]'+nextChar+')')
      } else{
        prefixRegexpArr.push('(.*?)')
        prefixRegexpArr.push(escapeRegExp(prefix.charAt(i)))
      }
    }
  }
  prefixRegexpArr.push('');
  return new RegExp(prefixRegexpArr.join(''), 'i');
};

//http://stackoverflow.com/questions/1179366/is-there-a-javascript-strcmp
var compareString = function(str1, str2){
  return ( ( str1 == str2 ) ? 0 : ( ( str1 > str2 ) ? 1 : -1 ) );
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
var escapeRegExp = function(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole
                                                        // matched string
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
var endsWith = function(searchString, position) {
  var subjectString = this.toString();
  if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
    position = subjectString.length;
  }
  position -= searchString.length;
  var lastIndex = subjectString.indexOf(searchString, position);
  return lastIndex !== -1 && lastIndex === position;
};

function printDebugInfo(options) {
  options = options || {
    showLibdocFiles: true,
    showRobotFiles: true,
    showAllSuggestions: false
  };
  var robotFiles = [], libdocFiles = [];
  var ext;
  for(key in allSuggestions){
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
    console.log('All suggestions: ' + JSON.stringify(allSuggestions, null, 2));
  }
}

module.exports = {
  reset : reset,
  processRobotBuffer : processRobotBuffer,
  processLibdocBuffer : processLibdocBuffer,
  getSuggestions : getSuggestions,
  printDebugInfo : printDebugInfo
}
