""" Converts robot framework keyword libraries into libdoc
and adds them into a directory cache, invalidated by their compilation time.
Outputs Json string with this format:
{
    libraries:{
        'library_name'{
          name: 'library_name',
          status: 'error/success',
          message: 'error or warning message',
          xmlLibdocPath: 'path of libdoc file',
          sourcePath: 'path of python file'
        },
        ...
    },
    'environment': {
        'pythonVersion': '',
        'moduleSearchPath': '',
        'pythonExecutable': '',
        'platform': ''
        'pythonPath': '',
        'jythonPath': '',
        'classPath': '',
        'ironpythonPath': '',
    }
}

"""
import importlib
import os
import sys
import json
import traceback
import inspect
from collections import namedtuple

STANDARD_LIBRARY_NAMES = ['BuiltIn', 'Collections', 'DateTime', 'Dialogs'
                          , 'OperatingSystem', 'Process', 'Remote'
                          , 'Screenshot', 'String', 'Telnet', 'XML']
STANDARD_LIBRARY_PACKAGE = 'robot.libraries'

def _is_robot_framework_available():
    try:
        importlib.import_module('robot')
        return True
    except ImportError:
        return False


def _import_libdoc_module():
    try:
        module = importlib.import_module('robot.libdocpkg')
        if hasattr(module, 'LibraryDocumentation'):
            return getattr(module, 'LibraryDocumentation')
        raise ValueError('robot.libdocpkg.LibraryDocumentation could not be found')
    except ImportError:
        raise ValueError('robot.libdocpkg could not be imported')

def _get_module_source(module):
    try:
        sourceFile = inspect.getsourcefile(module)
        if sourceFile is not None:
            return sourceFile
    except TypeError:
        pass

    try:
        sourceFile = inspect.getfile(module)
        if sourceFile is not None:
            return sourceFile
    except TypeError:
        pass

    try:
        sourceFile = getattr(module, '__file__')
        if sourceFile is not None:
            return sourceFile
    except AttributeError:
        pass

    return None

def _get_module(library_name):
    namespaces = library_name.split('.')
    try:
        return (importlib.import_module(library_name), None)
    except ImportError as e1:
        parent = '.'.join(namespaces[0:-1])
        if len(parent) > 0:
            try:
                module = importlib.import_module(parent)
                class_name = namespaces[-1]
                if hasattr(module, class_name):
                    return (module, None)
                else:
                    return (None, str(e1))
            except ImportError as e2:
                return (None, str(e2))
        else:
            return (None, str(e1))


def _get_modified_time(file_path):
    try:
        return os.path.getmtime(file_path)
    except OSError:
        return 0


def _cached(library_name, module, cache_dir):
    library_file = library_name+'.xml'
    library_path = os.path.join(cache_dir, library_file)
    Cache = namedtuple('Cache', ['cached', 'xml_libdoc_path'])
    if not os.path.exists(library_path):
        return Cache(cached=False, xml_libdoc_path=None)
    module_modif_time = _get_modified_time(_get_module_source(module))
    chache_modif_time = _get_modified_time(library_path)
    if module_modif_time > chache_modif_time:
        return Cache(cached=False, xml_libdoc_path=None)
    return Cache(cached=True, xml_libdoc_path=library_path)

def _generate_libdoc_xml(library_name, cache_dir):
    library_file = library_name+'.xml'
    library_path = os.path.join(cache_dir, library_file)
    LibraryDocumentation = _import_libdoc_module()
    libdoc = LibraryDocumentation(library_or_resource=library_name)
    libdoc.save(library_path, 'XML')
    return library_path


def _store_libraries(libraries, cache_dir):
    library_map = {}
    for library_name in libraries:
        library_map[library_name] = {'name': library_name, 'status': 'pending', 'message': 'To be imported'}
    if not os.path.exists(cache_dir):
        os.mkdir(cache_dir)
    for library_name in libraries:
        try:
            # Fix library name for standard robot libraries
            if library_name in STANDARD_LIBRARY_NAMES:
                full_library_name = ("%s.%s"
                                     % (STANDARD_LIBRARY_PACKAGE, library_name))
            else:
                full_library_name = library_name
            (module, error) = _get_module(full_library_name)
            if not module:
                library_map[library_name] = {
                    'name': library_name,
                    'status': 'error',
                    'message': "Could not import '%s': '%s'" % (library_name, error)
                    }
                continue
            cache = _cached(library_name, module, cache_dir)
            if not cache.cached:
                xml_libdoc_path = _generate_libdoc_xml(library_name, cache_dir)
                library_map[library_name] = {
                    'name': library_name,
                    'status': 'success',
                    'xmlLibdocPath': xml_libdoc_path,
                    'sourcePath': _get_module_source(module)
                    }
            else:
                library_map[library_name] = {
                    'name': library_name,
                    'status': 'success',
                    'xmlLibdocPath': cache.xml_libdoc_path,
                    'sourcePath': _get_module_source(module)
                    }
        except Exception as exc:
            error = "Unexpected error: %s, %s" % (exc, traceback.format_exc())
            library_map[library_name] = {'name': library_name, 'status': 'error', 'message': error}
    return {
        'libraries': library_map, 
        'environment': {
            'pythonVersion': sys.version,
            'pythonExecutable': sys.executable,
            'platform': sys.platform,
            'pythonPath':     os.getenv('PYTHONPATH', 'n/a'),
            'jythonPath':     os.getenv('JYTHONPATH', 'n/a'),
            'classPath':      os.getenv('CLASSPATH', 'n/a'),
            'ironpythonPath': os.getenv('IRONPYTHONPATH', 'n/a'),
            'moduleSearchPath': sys.path,
        }}

def _main():
    required_argument_no = 4
    if len(sys.argv) != required_argument_no:
        print("Wrong arguments. Required %d arguments. Received %d" %(required_argument_no, len(sys.argv)))
        exit(1)

    library_names = sys.argv[1].split(',')
    additional_module_search_paths = sys.argv[2].split(',')
    cache_dir = sys.argv[3]
    
    sys.path.extend(additional_module_search_paths)

    if not _is_robot_framework_available():
        print("Robot framework is not installed.")
        exit(1)

    # Redirect output so that various module initialization do not polute our Json result.
    null_stream = open(os.devnull, "w")
    orig_stdout = sys.stdout
    sys.stdout = null_stream

    result = _store_libraries(library_names, cache_dir)

    sys.stdout = orig_stdout
    print(json.dumps(result))

_main()
exit(0)
