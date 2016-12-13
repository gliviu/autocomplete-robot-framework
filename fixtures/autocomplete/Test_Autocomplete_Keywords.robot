*** Settings ***
Library  Test_Autocomplete_Libdoc
Resource  FileSizeLimit

*** Variables ***
${VARIABLE1}    value
${VARIABLE2}    value

*** Keywords ***
Run Program
    [Arguments]    @{args}
    Run Process    program.py    @{args}    # Named arguments are not recognized from inside @{args}
With documentation
    [Arguments]    ${arg1}    &{arg2}    @{arg3}
    [Documentation]    documentation
With documentation 2
    [Arguments]    ${arg1}    &{arg2}    @{arg3}
    [Documentation]    documentation.
Without documentation
    [Arguments]    ${arg1}    &{arg2}    @{arg3}
With arguments
    [Arguments]    ${arg1}    @{arg2}    &{arg3}
Without arguments
With default value arguments
    [Arguments]    ${arg1}=default value ${VARIABLE1}    ${arg2}    @{arg3}    &{arg4}    ${arg5}=default value    @{arg6}=${VARIABLE1} and ${VARIABLE2}
With embedded ${arg1} arguments ${arg2}
Dot.punctuation keyword
C a p
C p
Priv test keyword
priv.keyword
Ord 2
Ord 1
Ord 3
Test keyword
Duplicated keyword
    