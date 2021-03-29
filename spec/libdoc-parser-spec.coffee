libdocParser = require('../lib/parse-libdoc')
fs = require 'fs'
pathUtils = require 'path'

describe "Libdoc xml file detection", ->
  it 'should detect correct libdoc xml files (rf <=v3.x.x)', ->
    fixturePath = "#{__dirname}/../fixtures/parser/parseLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdoc-ok.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(true);
  it 'should detect correct libdoc xml files (rf >=v4)', ->
    fixturePath = "#{__dirname}/../fixtures/parser/parseLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdocV4-ok.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(true);
  it 'should detect incorrect libdoc xml files (rf <=v3.x.x)', ->
    fixturePath = "#{__dirname}/../fixtures/parser/parseLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdoc-wrong1.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

    content = fs.readFileSync("#{fixturePath}/libdoc-wrong2.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

    content = fs.readFileSync("#{fixturePath}/libdoc-wrong3.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

  it 'should detect incorrect libdoc xml files (rf >=v4)', ->
    fixturePath = "#{__dirname}/../fixtures/parser/parseLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdocV4-wrong1.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

    content = fs.readFileSync("#{fixturePath}/libdocV4-wrong2.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

    content = fs.readFileSync("#{fixturePath}/libdocV4-wrong3.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

  it 'should parse libdoc xml files (rf <=v3.x.x)', ->
    expectedParsedRobotInfo = {
      "testCases": [],
      "keywords": [
        {
          "name": "Call Method",
          "documentation": "Call Method doc",
          "arguments": [
            "object",
            "method_name",
            "*args",
            "**kwargs"
          ],
          "rowNo": 6,
          "colNo": 2
        },
        {
          "name": "Catenate<x",
          "documentation": "Catenate doc",
          "arguments": [
            "*items"
          ]
        }
      ],
      "libraries": [],
      "resources": []
    }

    fixturePath = "#{__dirname}/../fixtures/parser/parseLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdoc-parse-v3.xml").toString()
    parsedRobotInfo = libdocParser.parse(content)
    expect(parsedRobotInfo).toEqual(expectedParsedRobotInfo);

  it 'should parse libdoc xml files (rf >=v4.0.0)', ->
    expectedParsedRobotInfo = {
      "testCases": [],
      "keywords": [
        {
          "name": "Call Method v4",
          "documentation": "call method doc",
          "arguments": [
            "object",
            "method_name",
            "*args",
            "**kwargs"
          ],
          "rowNo": 9,
          "colNo": 4
        },
        {
          "name": "Catenate<x v4",
          "documentation": "catenate doc",
          "arguments": [
            "*items"
          ]
        }
      ],
      "libraries": [],
      "resources": []
    }

    fixturePath = "#{__dirname}/../fixtures/parser/parseLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdoc-parse-v4.xml").toString()
    parsedRobotInfo = libdocParser.parse(content)
    expect(parsedRobotInfo).toEqual(expectedParsedRobotInfo);
