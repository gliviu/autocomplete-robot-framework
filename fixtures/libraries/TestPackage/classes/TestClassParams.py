ROBOT_LIBRARY_VERSION='1.2.4'

print 'init6'

class TestClassParams(object):
    def __init__(self, **params):
        self.cp1 = params.get('cp1', 'not provided')
    def test_class_keyword_params(self, param1):
        """
        Test class documentation
        """
        return "Res: %s, %s" % (param1, self.cp1)
