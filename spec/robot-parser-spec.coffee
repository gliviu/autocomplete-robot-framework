robotParser = require('../lib/parse-robot')
fs = require 'fs'
pathUtils = require 'path'

describe 'Robot parser', ->
  fixturePath = "#{__dirname}/../fixtures/parser"
  body = "  body"
  it 'correctly handle tabs and spaces', ->
    file = fs.readFileSync("#{fixturePath}/tabs.robot").toString()
    robot = robotParser.parse(file)
    expect(robot.testCases[0]?.name).toEqual 't2'
    expect(robot.keywords[0]?.name).toEqual 'test1 kw'
    expect(robot.keywords[1]?.name).toEqual 'test3 kw'
    expect(robot.keywords[2]?.name).toEqual 'test5 kw'
    expect(robot.keywords[3]?.name).toEqual 'test7 kw'
    expect(robot.keywords[4]).toBeUndefined()
  describe 'Section parsing', ->
    validSections = ['*** Keywords      ***', ' *keywords*', ' **** keywords ****', '*keywords*', '* keywords *', '***** keywords ******', '*keywords*    ', '* keywords  2 * ', '* keywords   2', '* keywords  *2', '* keywords  *2  ', '* keywords *  2', '* keywords  *  2', ' *** keywords    ** 22']
    invalidSections = ['  *** Keywords ***', '***   Keywords ***', '     *keywords*', '     *keywords*    ', '*keywords2*', '* keywords 2 *', '* keywords *2', '* keywords * 2', '*  keywords', '****  keywords', '    ****  keywords', '**  keywords  **', ' ****  keywords', ' ***************************************************************** keywords ********************************************************************** 22222222222222222222222222222222222222222222222222222222222222222222']
    it 'correctly interprets line ending', ->
      delim = '\n'
      robot = robotParser.parse("*test cases*#{delim}t1#{delim}#{body}#{delim}*keywords*#{delim}k1#{delim}#{body}#{delim}")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      expect(robot.testCases[0]?.name).toEqual 't1'
      delim = '\n\r'
      robot = robotParser.parse("*test cases*#{delim}t1#{delim}#{body}#{delim}*keywords*#{delim}k1#{delim}#{body}#{delim}")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      expect(robot.testCases[0]?.name).toEqual 't1'
      delim = '\r'
      robot = robotParser.parse("*test cases*#{delim}t1#{delim}#{body}#{delim}*keywords*#{delim}k1#{delim}#{body}#{delim}")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      expect(robot.testCases[0]?.name).toEqual 't1'
    it 'parses valid sections', ->
      for section in validSections
        robot = robotParser.parse("#{section}\nk1\n#{body}")
        expect(robot.keywords[0]?.name).toEqual 'k1'
      for section in validSections
        robot = robotParser.parse("*test cases*\n#{section}\nk1\n#{body}")
        expect(robot.keywords[0]?.name).toEqual 'k1'
    it 'ignores invalid sections', ->
      for section in invalidSections
        robot = robotParser.parse("#{section}\nk1\n#{body}")
        expect(robot.keywords.length).toEqual 0
      for section in invalidSections
        robot = robotParser.parse("*test cases*\n#{section}\nk1\n#{body}")
        expect(robot.keywords.length).toEqual 0
    it 'correctly parses all variants of sections', ->
      robot = robotParser.parse("*keywords*\nk1\n")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      robot = robotParser.parse("*keyword*\nk1\n")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      robot = robotParser.parse("*settings*\nLibrary  lib1\n")
      expect(robot.libraries[0]?.name).toEqual 'lib1'
      robot = robotParser.parse("*setting*\nLibrary  lib1\n")
      expect(robot.libraries[0]?.name).toEqual 'lib1'
      robot = robotParser.parse("*test cases*\ntc1\n")
      expect(robot.testCases[0]?.name).toEqual 'tc1'
      robot = robotParser.parse("*test case*\ntc1\n")
      expect(robot.testCases[0]?.name).toEqual 'tc1'
      robot = robotParser.parse("*testcases*\ntc1\n")
      expect(robot.testCases[0]?.name).toEqual 'tc1'
      robot = robotParser.parse("*testcase*\ntc1\n")
      expect(robot.testCases[0]?.name).toEqual 'tc1'
  describe 'Keyword parsing', ->
    it 'correctly interprets line ending', ->
      delim = '\n'
      robot = robotParser.parse("*keywords*#{delim}k1#{delim}#{body}#{delim}k2#{delim}#{body}#{delim}")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      expect(robot.keywords[1]?.name).toEqual 'k2'
      delim = '\r\n'
      robot = robotParser.parse("*keywords*#{delim}k1#{delim}#{body}#{delim}k2#{delim}#{body}#{delim}")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      expect(robot.keywords[1]?.name).toEqual 'k2'
      delim = '\r'
      robot = robotParser.parse("*keywords*#{delim}k1#{delim}#{body}#{delim}k2#{delim}#{body}#{delim}")
      expect(robot.keywords[0]?.name).toEqual 'k1'
      expect(robot.keywords[1]?.name).toEqual 'k2'
    it 'parses valid keyword names', ->
      file = fs.readFileSync("#{fixturePath}/keywords.robot").toString()
      robot = robotParser.parse(file)
      expect(robot.keywords[0]?.name).toEqual 'test1 kw'
      expect(robot.keywords[1]?.name).toEqual 'test2 kw'
      expect(robot.keywords[2]?.name).toEqual 'test4 kw'
      expect(robot.keywords[3]?.name).toEqual 'test5 kw'
      expect(robot.keywords[4]?.name).toEqual 'test7 kw'
      expect(robot.keywords[5]).toBeUndefined()
    it 'parses valid test case names', ->
      file = fs.readFileSync("#{fixturePath}/keywords.robot").toString()
      robot = robotParser.parse(file)
      expect(robot.testCases[0]?.name).toEqual 't1'
      expect(robot.testCases[1]?.name).toEqual 't2'
      expect(robot.testCases[2]?.name).toEqual 't4'
      expect(robot.testCases[3]).toBeUndefined()
    it 'be able to parse keywords containing escapes', ->
      file = fs.readFileSync("#{fixturePath}/keywords2.robot").toString()
      robot = robotParser.parse(file)
      expect(robot.keywords[0]?.name).toEqual 'test escapes'
describe "Robot file detection", ->
  it 'should detect correct robot files', ->
    fixturePath = "#{__dirname}/../fixtures/parser/detectRobot"

    content = fs.readFileSync("#{fixturePath}/detect-ok1.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok2.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok3.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok4.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok5.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok6.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok7.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok8.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

    content = fs.readFileSync("#{fixturePath}/detect-ok9.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(true);

  it 'should detect incorrect robot files', ->
    fixturePath = "#{__dirname}/../fixtures/parser/detectRobot"

    content = fs.readFileSync("#{fixturePath}/detect-wrong1.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(false);

    content = fs.readFileSync("#{fixturePath}/detect-wrong2.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(false);

    content = fs.readFileSync("#{fixturePath}/detect-wrong3.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(false);

    content = fs.readFileSync("#{fixturePath}/detect-wrong4.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(false);

    content = fs.readFileSync("#{fixturePath}/detect-wrong5.robot").toString()
    isRobot = robotParser.isRobot(content)
    expect(isRobot).toBe(false);
