var pathUtils = require('path');
module.exports = {
  getResourceKey: function(resourcePath){
    return pathUtils.normalize(resourcePath).toLowerCase();
  }
};
