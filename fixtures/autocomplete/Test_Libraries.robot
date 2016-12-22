*** Settings ***
Library   package.modules.TestModule
Library   package.classes.TestClass
Library   package.classes.TestClassParams  cp1='cp1param'
Library   OperatingSystem

*** Test Cases ***
t1
    ${res}  Test Class Keyword Params    xxx
    ${res}  Test Class Keyword    yyy
    ${res}  Test Module Keyword    zzz    ttt
