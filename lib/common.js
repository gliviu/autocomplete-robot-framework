const pathUtils = require('path');
module.exports = {
  getResourceKey(resourcePath){
    return pathUtils.normalize(resourcePath).toLowerCase();
  },
  arrIntersect(a1, a2){
    const s2 = new Set(a2)
    return new Set(a1.filter((item) => s2.has(item)))
  },
  arrEqual(a1, a2){
    return a1.length === a2.length && a1.length === this.arrIntersect(a1, a2).size
  }

};

