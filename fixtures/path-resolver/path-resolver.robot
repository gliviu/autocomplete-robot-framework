*variables*
${a}  a

*settings*
Resource  pr1.robot
Resource  ./pr2.robot
Resource  a/pr3.robot
Resource  ../path-resolver/a/pr4.robot
Resource  ${a}/pr5.robot
Resource  wrong/pr7.robot
Resource  ../../fixtures-ext-proj/path-resolver/external-resource.robot
Resource  pr6.robot


*testcases*
t1
