const xmlParser = require('fast-xml-parser');
const he = require('he');

// Matches only the keyword name
var keywordNameRegexp = /<kw name="([^"]+)"/g;

/**
* True/false if file is recognized as xml libdoc or not.
*
*/
var isLibdoc = function (fileContent) {
  const libdoc = getLibdoc(fileContent)
  if (!getLibdocKeywords(libdoc)) {
    return false
  }
  return true
}

/**
* Parses libdoc xml files.
* Returns result in this form:
*  {
*      keywords: [
*          {name: '', documentation: '', arguments: ['', '', ...], rowNo: 0, colNo: 0},
*          ...
*      ],
*  }
*/
const parse = function (fileContent) {
  const libdoc = getLibdoc(fileContent)
  if (!libdoc.keywordspec) {
    return undefined
  }

  let libdocKeywords = getLibdocKeywords(libdoc);
  if (!libdocKeywords) {
    return undefined
  }

  const keywords = libdocKeywords.map(libdocKeyword => ({
    name: libdocKeyword.name,
    documentation: libdocKeyword.doc,
    arguments: getArguments(libdocKeyword)
  }))

  fillLineNumbers(fileContent, keywords);

  return {
    testCases: [],
    keywords: keywords,
    libraries: [],
    resources: []
  };

}

/**
 * Converts libdoc xml content into json.
 */
function getLibdoc(fileContent) {
  return xmlParser.parse(fileContent, {
    attributeNamePrefix: '',
    ignoreAttributes: false,
    attrValueProcessor: (val, attrName) => he.decode(val, { isAttributeValue: true }),
    tagValueProcessor: (val, tagName) => he.decode(val),
  });
}

/**
 * Extracts keywords from libdoc content.
 */
function getLibdocKeywords(libdoc) {
  if (!libdoc.keywordspec) {
    return undefined
  }
  let libdocKeywords = getLibdocKeywordsV3(libdoc)
  if (!libdocKeywords) {
    libdocKeywords = getLibdocKeywordsV4(libdoc)
  }
  return libdocKeywords
}

/**
 * Returns keywords for libdoc <4.0.0
 */
function getLibdocKeywordsV3(libdoc) {
  let libdocKeywords = libdoc.keywordspec.kw;
  if (!libdocKeywords) {
    return undefined
  }
  if (!Array.isArray(libdocKeywords)) {
    libdocKeywords = [libdocKeywords];
  }
  return libdocKeywords;
}

/**
 * Returns keywords for libdoc >=v4.0.0
 */
function getLibdocKeywordsV4(libdoc) {
  if (!libdoc.keywordspec.keywords || !libdoc.keywordspec.keywords.kw) {
    return undefined
  }
  let libdocKeywords = libdoc.keywordspec.keywords.kw;
  if (!Array.isArray(libdocKeywords)) {
    libdocKeywords = [libdocKeywords];
  }
  return libdocKeywords;
}

/**
 * Extracts keyword arguments from keyword.
 */
const getArguments = function (libdocKeyword) {
  if (!libdocKeyword.arguments || !libdocKeyword.arguments.arg) {
    return []
  }

  let libdocArguments = libdocKeyword.arguments.arg
  if (!Array.isArray(libdocArguments)) {
    libdocArguments = [libdocArguments]
  }

  let arguments = getArgumentsV3(libdocArguments)
  if (arguments.length === 0) {
    arguments = getArgumentsV4(libdocArguments)
  }
  return arguments
}

/**
 * Returns arguments for libdoc <4.0.0
 */
const getArgumentsV3 = function (libdocArguments) {
  return libdocArguments.filter(libdocArgument => isString(libdocArgument))
}

/**
 * Returns arguments for libdoc >=v4.0.0
 */
const getArgumentsV4 = function (libdocArguments) {
  return libdocArguments
    .map(libdocArgument => libdocArgument.repr)
    .filter(repr => repr !== undefined)
}

/**
 * Maps each keyword with the corresponding line number inside libdoc file.
 */
var fillLineNumbers = function (fileContent, keywords) {
  var kwMap = {};
  var match;
  for (var i = 0; i < keywords.length; i++) {
    var keyword = keywords[i];
    kwMap[keyword.name] = keyword;
  }
  var lines = fileContent.split(/\r\n|\n|\r/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    while (match = keywordNameRegexp.exec(line)) {
      var keyword = kwMap[match[1].trim()];
      if (keyword) {
        keyword.rowNo = i;
        keyword.colNo = match.index;
      }
    }
  }
}

function isString(val) {
  return (typeof val) === 'string';
}

module.exports = {
  parse: parse,
  isLibdoc: isLibdoc
}
