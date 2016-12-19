*** Settings ***
Library   TestPackage.modules.TestModule
Library   TestPackage.classes.TestClass
Library   TestPackage.classes.TestClassParams  cp1='cp1param'
Library   OperatingSystem

*** Test Cases ***
t1
    ${res}  Test Class Keyword Params    xxx
    ${res}  Test Class Keyword    yyy
    ${res}  Test Module Keyword    zzz    ttt
    
