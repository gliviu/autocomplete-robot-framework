const namedRegexp = require("named-js-regexp");
const fs = require('fs');
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
  if (libdoc.keywordspec && libdoc.keywordspec.kw) {
    return true
  }
  return false
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
  const keywords = [];

  const libdoc = getLibdoc(fileContent)
  if (!libdoc.keywordspec || !libdoc.keywordspec.kw) {
    return undefined
  }

  let libdocKeywords = libdoc.keywordspec.kw
  if(!Array.isArray(libdocKeywords)){
    libdocKeywords = [libdocKeywords]
  }

  libdocKeywords.forEach(libdocKeyword => {
    const keywordName = libdocKeyword.name
    const keywordDoc = libdocKeyword.doc
    const keywordArgs = getArguments(libdocKeyword)
    keywords.push({
      name: keywordName,
      documentation: keywordDoc,
      arguments: keywordArgs
    });
  })

  fillLineNumbers(fileContent, keywords);

  return {
    testCases: [],
    keywords: keywords,
    libraries: [],
    resources: []
  };

}

const getArguments = function (libdocKeyword) {
  const arguments = libdocKeyword.arguments.arg
  if (!arguments) {
    return []
  }
  if (Array.isArray(arguments)) {
    return arguments
  }
  return [arguments]
}

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

function getLibdoc(fileContent) {
  return xmlParser.parse(fileContent, {
    attributeNamePrefix: '',
    ignoreAttributes: false,
    attrValueProcessor: (val, attrName) => he.decode(val, { isAttributeValue: true }),
    tagValueProcessor: (val, tagName) => he.decode(val),
  });
}

module.exports = {
  parse: parse,
  isLibdoc: isLibdoc
}
