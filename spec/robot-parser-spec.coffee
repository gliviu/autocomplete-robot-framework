robotParser = require('../lib/parse-robot')
fs = require 'fs'
pathUtils = require 'path'

describe 'Correctly determine sections', ->
  validSections = ['*keywords*', '* keywords *', '***** keywords ******', '     *keywords*', '*keywords*    ', '     *keywords*    ', '* keywords  2 * ', '* keywords   2', '* keywords  *2', '* keywords  *2  ', '* keywords *  2', '* keywords  *  2']
  invalidSections = ['*keywords2*', '* keywords 2 *', '* keywords *2', '* keywords * 2', '*  keywords', '****  keywords', '    ****  keywords', '**  keywords  **', ' ****  keywords']
  it 'parse valid sections', ->
    delim = '\r\n'
    for section in validSections
      robot = robotParser.parse("#{section}#{delim}k1")
      expect(robot.keywords[0]?.name).toEqual 'k1'
    for section in validSections
      robot = robotParser.parse("*test cases*#{delim}#{section}#{delim}k1")
      expect(robot.keywords[0]?.name).toEqual 'k1'
    delim = '\n'
    for section in validSections
      robot = robotParser.parse("#{section}#{delim}k1")
      expect(robot.keywords[0]?.name).toEqual 'k1'
    for section in validSections
      robot = robotParser.parse("*test cases*#{delim}#{section}#{delim}k1")
      expect(robot.keywords[0]?.name).toEqual 'k1'
  it 'ignore invalid sections', ->
    delim = '\r\n'
    for section in invalidSections
      robot = robotParser.parse("#{section}#{delim}k1")
      expect(robot.keywords.length).toEqual 0
    for section in invalidSections
      robot = robotParser.parse("*test cases*#{delim}#{section}#{delim}k1")
      expect(robot.keywords.length).toEqual 0
    delim = '\n'
    for section in invalidSections
      robot = robotParser.parse("#{section}#{delim}k1")
      expect(robot.keywords.length).toEqual 0
    for section in invalidSections
      robot = robotParser.parse("*test cases*#{delim}#{section}#{delim}k1")
      expect(robot.keywords.length).toEqual 0
    