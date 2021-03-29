libdocParser = require('../lib/parse-libdoc')
fs = require 'fs'
pathUtils = require 'path'

describe "Libdoc xml file detection", ->
  it 'should detect correct libdoc xml files (rf <=v3.x.x)', ->
    fixturePath = "#{__dirname}/../fixtures/parser/detectLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdoc-ok.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(true);
  it 'should detect correct libdoc xml files (rf >=v4)', ->
    fixturePath = "#{__dirname}/../fixtures/parser/detectLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdocV4-ok.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(true);
  it 'should detect incorrect libdoc xml files (rf <=v3.x.x)', ->
    fixturePath = "#{__dirname}/../fixtures/parser/detectLibdocXml"

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
    fixturePath = "#{__dirname}/../fixtures/parser/detectLibdocXml"

    content = fs.readFileSync("#{fixturePath}/libdocV4-wrong1.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

    content = fs.readFileSync("#{fixturePath}/libdocV4-wrong2.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);

    content = fs.readFileSync("#{fixturePath}/libdocV4-wrong3.xml").toString()
    isLibdoc = libdocParser.isLibdoc(content)
    expect(isLibdoc).toBe(false);
