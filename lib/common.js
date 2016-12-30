const pathUtils = require('path');
module.exports = {
  getResourceKey(resourcePath){
    return pathUtils.normalize(resourcePath).toLowerCase();
  },
  eqSet(set1, set2) {
    if (set1.size !== set2.size) return false;
    for (var a of set1) if (!set2.has(a)) return false;
    return true;
  }
}
