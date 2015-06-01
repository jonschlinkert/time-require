'use strict';

var chalk = lazyRequire(require)('chalk');

function lazyRequire(fn) {
  var cache = {};
  return function (name) {
    return function () {
      if (cache.hasOwnProperty(name)) return cache[name];
      try {
        return (cache[name] = fn(name));
      } catch (err) {
        console.log(chalk().yellow(err));
        process.exit(1);
      }
    };
  };
}

/**
 * Expose `lazyRequire`
 */

module.exports = lazyRequire;
