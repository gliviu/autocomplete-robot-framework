*** Settings ***

*** Test cases ***
Invalid user name
    Behaviour  u1  p1

Invalid password
    Behaviour  u2  p2

*** Keyword ***
Behaviour
  [Arguments]  ${username}  ${password}

  Given login page is open

  When valid username and password are inserted  ${username}  ${password}
  and credentials are submitted

  Then welcome page should be open

login page is open
  [return]  ${true}

valid username and password are inserted
  [Arguments]  ${username}  ${password}
  [return]    ${true}

welcome page should be open
  [return]    ${false}

credentials are submitted
  [return]    ${true}
