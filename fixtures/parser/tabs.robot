# this file is not to be edited by Atom
		      
***	Test Cases ***
t1
    test1 kw    a3

    		      
*** Test Cases 	2***
t2
    test1 kw    a3

***	Test Cases ***
t3
    test1 kw    a3
    
*** Keywords ***
test1 kw
    [Arguments]    ${a3}
    log    test1kw
    test2 kw        ${a3}

	test2 kw
    [Arguments]    ${a3}
    log    test1kw
    test1 kw        ${a3}

 test3 kw
    [Arguments]    ${a3}
    log    test1kw
    test3 kw    ${a3}

  test4 kw
    [Arguments]    ${a3}
    log    test1kw
    test1 kw        ${a3}

test5 kw
    [Arguments]    ${a3}
    log    test1kw
    test1 kw        ${a3}
