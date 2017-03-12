'use babel'
import pathUtils from 'path'
import fs from 'fs'

/**
 * Returns resource or library path based on import path. If not found returns undefined.
 * Always returns normalized paths.
 * importPath - Library/Resource import path
 * currentDir - path of the file containing the impot
 */
export function resolve(importPath, currentDir){
  if(isPathComputed(importPath)){
    return undefined
  }
  if(pathUtils.isAbsolute(importPath)){
    return isFile(importPath)?pathUtils.normalize(importPath):undefined
  }

  // relative uncomputed path
  const absolutePath = pathUtils.join(currentDir, importPath)
  return isFile(absolutePath)?pathUtils.normalize(absolutePath):undefined
}

/**
 * Returns true if path is computed from variables.
 */
function isPathComputed(path){
    return path.search(/\$\{.*?\}/)!=-1
}

function isFile(path){
  if(fs.existsSync(path)){
    return fs.statSync(path).isFile()
  }
  return false
}
