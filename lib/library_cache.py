""" Converts robot framework keyword libraries into libdoc
and adds them into a directory cache, invalidated by their compilation time. """
import importlib
import os
import sys
import json
import traceback
from collections import namedtuple

# _cache_dir = os.path.join(tempfile.gettempdir(), 'robot-lib-cache')


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

def _get_module(library_name):
    namespaces = library_name.split('.')
    try:
        return importlib.import_module(library_name)
    except ImportError:
        try:
            parent = '.'.join(namespaces[0:-1])
            if len(parent) > 0:
                module = importlib.import_module(parent)
                class_name = namespaces[-1]
                if hasattr(module, class_name):
                    return module
                else:
                    return None
        except ImportError:
            return None


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
    module_modif_time = _get_modified_time(getattr(module, '__file__'))
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


def store_libraries(libraries, cache_dir):
    result = {}
    for library_name in libraries:
        result[library_name] = {'name': library_name, 'status': 'pending', 'message': 'To be imported'}
    if not _is_robot_framework_available():
        for library_name in libraries:
            result[library_name] = {
                'name': library_name,
                'status': 'error',
                'message': 'Robot framework not installed or not accessible from PYTHONPATH %s' % sys.path
                }
        return result
    if not os.path.exists(cache_dir):
        os.mkdir(cache_dir)
    for library_name in libraries:
        try:
            module = _get_module(library_name)
            if not module:
                result[library_name] = {
                    'name': library_name,
                    'status': 'error',
                    'message': "Could not find '%s' or not accessible from PYTHONPATH - %s" % (library_name, sys.path)
                    }
                continue
            cache = _cached(library_name, module, cache_dir)
            if not cache.cached:
                xml_libdoc_path = _generate_libdoc_xml(library_name, cache_dir)
                result[library_name] = {
                    'name': library_name,
                    'status': 'success',
                    'xmlLibdocPath': xml_libdoc_path
                    }
            else:
                result[library_name] = {
                    'name': library_name,
                    'status': 'success',
                    'xmlLibdocPath': cache.xml_libdoc_path
                    }
        except Exception as exc:
            error = "Unexpected error: %s, %s" % (exc, traceback.format_exc())
            result[library_name] = {'name': library_name, 'status': 'error', 'message': error}
    return result

def _main():
    if len(sys.argv) != 3:
        exit(1)

    # Redirect output so that various module initialization do not polute our Json result.
    null_stream = open(os.devnull, "w")
    orig_stdout = sys.stdout
    sys.stdout = null_stream

    library_names = sys.argv[1].split(',')
    cache_dir = sys.argv[2]
    result = store_libraries(library_names, cache_dir)

    sys.stdout = orig_stdout
    print json.dumps(result)

_main()
exit(0)
