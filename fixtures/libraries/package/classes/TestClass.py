ROBOT_LIBRARY_VERSION='1.2.4'

print 'init6'

class TestClass(object):
    def __init__(self):
        print 'init self'
    def test_class_keyword_1(self, param1):
        """
        Test class documentation
        """
        return 'result'
