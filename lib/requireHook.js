'use strict';

const { Module } = require('module');
const cached = { load: Module._load, hookedAt: null, listener: null };

/**
 * Module loader function that will replace Module._load and invoke the cached.listener
 * with module and timing information
 */

const loader = (...args) => {
  const [name, parent] = args;
  const timeIn = Date.now();
  const requires = cached.load.call(Module, ...args);
  const timeOut = Date.now();

  // should be the last loaded children
  const mod = parent.children[parent.children.length - 1];

  // call the listener
  cached.listener({
    name,
    filename: mod ? mod.filename : name,
    module: mod,
    parent,
    exports: requires,
    requiredOn: timeIn,
    startedIn: timeOut - timeIn
  });

  return requires;
}

/**
 * Hook Node's require() so the configured callback will
 * be invocked with additional module and time loading
 * information information
 *
 * @param {Function} [listener] - optional listener if
 * @method hook
 */

const hook = listener => {
  let type = typeof listener;
  if (type !== 'undefined') {
    if (type !== 'function') {
      throw new Error(`Expected listener to be a function, received: "${type}"`);
    }

    // cache the listener
    cached.listener = listener;
  }

  Module._load = loader;
  cached.hookedAt = new Date();
};

/**
 * Unhook Node's require() to the original function.
 * Sets the original loader, then resets hooking time.
 */

const unhook = () => {
  Module._load = cached.load;
  cached.hookedAt = null;
};

/**
 * Export a function that set the callback and return hook/unhook control functionality
 * @param {Function} `listener` require() listener
 * @param {Boolean} [autohook=true] optional flag telling if the hooking will be started automatically
 * @return hook/unhook control function
 */

module.exports = (listener, autohook) => {
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
    hook,
    unhook
  };
};
