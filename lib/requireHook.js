'use strict';

const Module = require('module').Module;
const cached = { load: Module._load, hookedAt: null, listener: null };

/**
 * Module hooker function that will replace Module._load and invoke the cached.listener
 * with module and timing information
 */

function hooker(name, parent) {
  const timeIn = Date.now();
  const exports = cached.load.apply(Module, arguments);
  const timeOut = Date.now();

  // should be the last loaded children
  const mod = parent.children[parent.children.length - 1];

  // call the listener
  cached.listener({
    name: name,
    filename: mod ? mod.filename : name,
    module: mod,
    parent: parent,
    exports: exports,
    requiredOn: timeIn,
    startedIn: timeOut - timeIn
  });

  return exports;
}

/**
 * Hook Node's require() so the configured callback will
 * be invocked with additional module and time loading
 * information information
 *
 * @param {Function} [listener] - optional listener if
 * @method hook
 */

function hook(listener) {
  if (typeof listener !== 'undefined') {
    if (typeof listener !== 'function') {
      throw new Error('expected listener to be a function, but got: ' + (typeof listener));
    }
    // set the listener
    cached.listener = listener;
  }

  Module._load = hooker;
  cached.hookedAt = new Date();
}

/**
 * Unhook Node's require() to the original function. Sets the original loader,
 * then resets hooking time.
 */

function unhook() {
  Module._load = cached.load;
  cached.hookedAt = null;
}

/**
 * Export a function that set the callback and
 * return hook/unhook control functionality
 * @param {Function} `listener` require() listener
 * @param {Boolean} [autohook=true] optional flag telling if the hooking will be started automatically
 * @return hook/unhook control function
 */

module.exports = function(listener, autohook) {
  if (typeof listener !== 'function') {
    throw new Error('The hooking function should be set');
  }

  // set the listener
  cached.listener = listener;

  if (autohook !== false) {
    hook();
  }

  return {
    hookedAt: cached.hookedAt,
    hook: hook,
    unhook: unhook
  };
};
