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
    validSections = ['*keywords*', '* keywords *', '***** keywords ******', '     *keywords*', '*keywords*    ', '     *keywords*    ', '* keywords  2 * ', '* keywords   2', '* keywords  *2', '* keywords  *2  ', '* keywords *  2', '* keywords  *  2']
    invalidSections = ['*keywords2*', '* keywords 2 *', '* keywords *2', '* keywords * 2', '*  keywords', '****  keywords', '    ****  keywords', '**  keywords  **', ' ****  keywords']
    it 'test1', ->
      expect(1).toEqual(1)
    it 'correctly interpret line ending', ->
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
    it 'parse valid sections', ->
      for section in validSections
        robot = robotParser.parse("#{section}\nk1\n#{body}")
        expect(robot.keywords[0]?.name).toEqual 'k1'
      for section in validSections
        robot = robotParser.parse("*test cases*\n#{section}\nk1\n#{body}")
        expect(robot.keywords[0]?.name).toEqual 'k1'
    it 'ignore invalid sections', ->
      for section in invalidSections
        robot = robotParser.parse("#{section}\nk1\n#{body}")
        expect(robot.keywords.length).toEqual 0
      for section in invalidSections
        robot = robotParser.parse("*test cases*\n#{section}\nk1\n#{body}")
        expect(robot.keywords.length).toEqual 0
  describe 'Keyword parsing', ->
    it 'correctly interpret line ending', ->
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
    it 'parse valid keyword names', ->
      file = fs.readFileSync("#{fixturePath}/keywords.robot").toString()
      robot = robotParser.parse(file)
      expect(robot.keywords[0]?.name).toEqual 'test1 kw'
      expect(robot.keywords[1]?.name).toEqual 'test2 kw'
      expect(robot.keywords[2]?.name).toEqual 'test4 kw'
      expect(robot.keywords[3]?.name).toEqual 'test5 kw'
      expect(robot.keywords[4]?.name).toEqual 'test7 kw'
      expect(robot.keywords[5]).toBeUndefined()
    it 'parse valid test case names', ->
      file = fs.readFileSync("#{fixturePath}/keywords.robot").toString()
      robot = robotParser.parse(file)
      expect(robot.testCases[0]?.name).toEqual 't1'
      expect(robot.testCases[1]?.name).toEqual 't2'
      expect(robot.testCases[2]?.name).toEqual 't4'
      expect(robot.testCases[3]).toBeUndefined()
