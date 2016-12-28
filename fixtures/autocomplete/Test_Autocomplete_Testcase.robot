*** Settings ***
Resource  a/utils.txt


*** Variables ***
${VARIABLE1}    value
${VARIABLE2}    value

*** Test Cases ***
test1
    Private keyword
*** Keywords ***
Private keyword
    Log
    
