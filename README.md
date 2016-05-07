autocomplete-robot-framework
==========
An [autocomplete-plus](https://github.com/atom/autocomplete-plus) provider for [Robot Framework](http://robotframework.org/).

![Demo](https://raw.githubusercontent.com/gliviu/autocomplete-robot-framework/master/anim.gif)

## Installation
```shell
apm install language-robot-framework
apm install autocomplete-robot-framework
```

## How it works
Open a robot file and the whole project will be scanned for keywords. Space separated **.robot** and **.txt** files are supported. Libdoc xml files should work as well.

[Useful](http://robotframework.org/#test-libraries) definitions are included for convenience.
*  Standard - BuiltIn, Collections, DateTime, Dialogs, OperatingSystem, Process, Screenshot, String, Telnet, XML
*  External - FtpLibrary, HttpLibrary.HTTP, MongoDBLibrary, Rammbock, RemoteSwingLibrary, RequestsLibrary, Selenium2Library, SeleniumLibrary, SSHLibrary, SwingLibrary

External libraries suggestions are disabled by default. They can be toggled in package settings.

If you have your own libdoc library, add it together with the other robot files to have it parsed for keywords.

This package depends on Robot Framework grammar support in Atom. It won't work unless [language-robot-framework](https://atom.io/packages/language-robot-framework) is available. Otherwise it doesn't need Python runtime or Robot Framework installed.
