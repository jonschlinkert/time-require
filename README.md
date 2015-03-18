# time-require [![NPM version](https://badge.fury.io/js/time-require.svg)](http://badge.fury.io/js/time-require)

> Displays the execution time for Node.js modules loading by hooking require() calls

My personal preferences for [time-require](https://github.com/jaguard/time-require). Not sure if it makes sense to publish this as a module. 

## Install with [npm](npmjs.org)

```bash
npm i time-require --save
```

## Usage

Add the following as the very first thing in a module:

```js
require('time-require');
```

Generates a table that looks something like:

![image](https://cloud.githubusercontent.com/assets/383994/6710335/45c16e08-cd56-11e4-96b5-cc24832a546a.png)


## Contributing
Pull requests and stars are always welcome. For bugs and feature requests, [please create an issue](https://github.com/jonschlinkert/time-require/issues)

## Author

**Jon Schlinkert**
 
+ [github/jonschlinkert](https://github.com/jonschlinkert)
+ [twitter/jonschlinkert](http://twitter.com/jonschlinkert) 

## License
Copyright (c) 2015 Jon Schlinkert  
Released under the MIT license

***

_This file was generated by [verb-cli](https://github.com/assemble/verb-cli) on March 18, 2015._