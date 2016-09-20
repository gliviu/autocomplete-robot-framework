
*** Test Cases ***
t1
    test1 kw    a3

 t2
    test1 kw    a3

  t3
    test1 kw    a3

t4
    test1 kw    a3

*** Keywords ***
test1 kw
    [Arguments]    ${a3}
    log    test1kw
    test2 kw        ${a3}

 test2 kw
    [Arguments]    ${a3}
    log    test1kw
    test3 kw    ${a3}

  test3 kw
    [Arguments]    ${a3}
    log    test1kw
    test1 kw        ${a3}

test4 kw
    [Arguments]    ${a3}
    log    test1kw
    test1 kw        ${a3}
