libdocParser = require('../lib/parse-libdoc')
fs = require 'fs'
pathUtils = require 'path'

describe "Libdoc xml file detection", ->
  it 'should detect correct libdoc xml files', ->
    fixturePath = "#{__dirname}/../fixtures/parser/detectLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdoc-ok.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(true);
  it 'should detect incorrect libdoc xml files', ->
    fixturePath = "#{__dirname}/../fixtures/parser/detectLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdoc-wrong.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);
