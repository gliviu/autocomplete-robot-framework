autocomplete-robot-framework
==========
An [autocomplete-plus](https://github.com/atom/autocomplete-plus) provider for [Robot Framework](http://robotframework.org/).

![Demo](https://raw.githubusercontent.com/gliviu/autocomplete-robot-framework/master/anim.gif)


## Install
```shell
apm install language-robot-framework
apm install autocomplete-robot-framework
```

## Usage
Opening a robot file will scan the parent project for keywords that will later be available as suggestions.

Works only for files that are included in an Atom project. Opening an independent robot resource won't provide any suggestions. Space separated **.robot** and **.txt** files are supported.

## Suggestions
Keywords may be suggested by partial keyword name separated or not by spaces, or even acronyms.

```text
run if             # suggests 'Run Keyword If'
sheq               # suggests 'Should Be Equal'
cfl                # acronyms also work and suggest 'Continue For Loop', ...
```
Sugestions are not limited to keywords. Library or resource names are suggested by prefixing their name.

```text
Library    OperatingSystem
Library    robot.libraries.DateTime
Resource   path/MyKeywords.robot

oper               # Suggests OperatingSystem
date               # Suggests robot.libraries.DateTime
robot              # Also suggests robot.libraries.DateTime
my                 # Suggest MyKeywords
```

Note that library names are suggested as long as they are successfully imported. See below.

Using 'WITH NAME' on a library is not taken in consideration at this time.

## Scopes
By default suggestions are limited to imported libraries and resources.
Scope modifiers allow us to override the default scope and search for keywords beyond current imports.
* this. -  suggests keywords from current file only
* . -  searches all  available keywords
* libraryOrResourceName. - limits suggestions to one source

```text
Collections.       # Suggests all keywords from Collections
Collections.copy   # As above but limits suggestions
MyKeywords.        # Same rules apply for resources as well
this.              # Show only local keywords
.append            # Search 'append' through all indexed keywords
```

## Library import
Python libraries have to be scanned for keywords just as regular robot files are.
For this mechanism to work following requirements should be met.
* Python environment is accessible and correctly configured
* Supported versions: cpython 2.7, jython 2.7.0, ironpython 2.7.6
* Python executable is correctly defined in Atom package settings (defaults to 'python')
* Robotframework 3.0 is installed according to [instructions](https://github.com/robotframework/robotframework/blob/master/INSTALL.rst)

Be sure to have PYTHONPATH, JYTHONPATH, CLASSPATH and IRONPYTHONPATH environment properly defined.

At this time libraries with mandatory parameters in constructor are not supported.  
Libraries identified by path do not work - 'Library    path/PythonLibrary.py'  
Take a look at [Status panel](#status) below for troubleshooting wrong imports and python environment problems .

## Fallback libraries
Official Robot Framework [libraries](http://robotframework.org/#libraries) are included for convenience, just in case library import mechanism is not working for some reasons. This could be the case for example if using the RF Jar distribution without any python interpreter available.

Fallback libraries are libdoc xml files generated with libdoc tool. Any such **.xml** file encountered in Atom project will be parsed for keywords together with the other **.robot** files.

To create a fallback library of your own use libdoc tool and copy the result somewhere in robot project so it can be scanned. Note that name of the file must be the fully qualified library name.
If you use the import below

    *** Settings ***
    Library    my.utilities.Arrays

it would need a libdoc named my.utilities.Arrays.xml.

## Status
Status pane shows imported libraries and python environment information together with any error occurred during import process.

It can be activated from **Packages->Robot Framework->Show autocomplete status**.

## Troubleshooting
*  When files are modified outside Atom, autocomplete index may become invalid. Use **Packages->Robot Framework->Reload autocomplete data**. Restarting Atom would have the same effect.
*  **.txt** files are not detected as Robot format automatically. Work around by manually choosing the grammar (open Grammar Selector ctrl-shift-L and pick Robot Framework).
*  Keywords are global to all projects opened in Atom. To mitigate this use [project-viewer](https://atom.io/packages/project-viewer) package or equivalent.
*  Should anything else go wrong, use **Packages->Robot Framework->Print autocomplete debug info** to display internal state in developer console  - **View->Developer->Toggle dev tools**.
*  More information can be shown by toggling Debug option in package settings.

## API
An API is available to enable cooperation with other packages by providing access to underlying keyword repository.
* getKeywordNames()
* getKeywordsByName(name)
* getResourceKeys()
* getResourceByKey(resourceKey)


Resource
```javascript
  {
    resourceKey: 'unique resource identifier',
    path: 'resource path',
    name : 'resource name',
    libraryPath : 'python library source path if available',
    hasTestCases: true/false,
    hasKeywords: true/false,
    isLibrary : true/false,
    imports : {
      libraries : [{name : '', alias : ''}],
      resources : [{
	      name : '',
	      extension : '',
	      resourceKey: '' // available if import is resolved
	      }]
    },
    keywords: [keyword1, ...]
  }
```
Keyword
```javascript
  {
    name: 'keyword name',
    documentation : 'documentation',
    arguments : ['arg1', ...],
    startRowNo : 0,
    startColNo : 0,
    resourceKey : 'parent resource key'
  }
```
## Testing
```apm test```
python/robot framework must be installed and operational. 'python' command must be available in PATH.

## Links
* [project-viewer](https://atom.io/packages/project-viewer) switch between distinct robot projects
* [hyperclick-robot-framework](https://atom.io/packages/hyperclick-robot-framework) go to definition for keywords
* [script](https://atom.io/packages/script) run robot test suites
* [https://robotframework.slack.com/messages/atom/](https://robotframework.slack.com/messages/atom/) discuss [atom.io](https://atom.io/) support for RF

## Changelog
* v3.5.0
  * Add support for [Behavior-driven style](http://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html#behavior-driven-style)
  * Bug fixes
* v3.3.0
   * Added keyword argument separator configuration
* v3.2.0
    * Auto download Atom dependencies using [package-deps](https://github.com/steelbrain/package-deps)
* v3.0.0
    * Import python libraries
    * Scope modifiers
    * Support multiple resources with identical name
    * Status panel
    * Show Atom notifications for various commands
    * Configurable keyword arguments in suggestions
* v2.2.2 - Add support for unicode characters
* v2.1.0 - Allow multi-word suggestions
* v2.0.0
	* Bug fixes
	* Added provider API
*  v1.1.0
  *  Use dot notation to have all suggestions inside single library
  *  Better suggestions are provided by [fuzzaldrin-plus](https://www.npmjs.com/package/fuzzaldrin-plus)
*  v1.0.1
  *  Added Atom commands for data reload and debug info
  *  Debug config option is now available in GUI
  * bug fixes
