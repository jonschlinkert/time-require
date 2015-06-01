/**
 * timeRequire - measure the time to load all the subsequnt modules by hoocking require() calls
 *
 * @author Ciprian Popa (cyparu)
 * @since 0.0.1
 * @version 0.0.1
 */

"use strict";

var path = require('path');
var lazy = require(path.resolve(__dirname, '..', 'lazy'));
var requireData = [];
var write = process.stdout.write.bind(process.stdout);
var relative = require('relative');
var cwd = process.cwd();

// require hooker should be first module loaded so all the other requires should count as well
/* jshint -W003 */
var hook = require('./requireHook')(_hooker);
var argv = require('minimist')(process.argv.slice(2));
var table = require('text-table');
var dateTime = require('date-time');
var prettyMs = require('pretty-ms');
var repeat = require('repeat-string');
var chalk = lazy(require)('chalk');
var fs = require('fs');

// extra locals
var DEFAULT_COLUMNS = 80;
var BAR_CHAR = process.platform === 'win32' ? '■' : '▇';
var sorted = argv.sorted || argv.s;

// TODO - configure threshold using CLI ?
var threshold = (argv.verbose || argv.v) ? 0.0 : 0.001;
var EXTRA_COLUMNS = sorted ? 24 : 20;

function pad(count, seq) {
  return (count > 1) ? new Array(count).join(seq) : '';
}

function log(str) {
  write(str + '\n', 'utf8');
}

/**
 * Callback/listener used by requireHook hook to collect all the modules in their loading i
 */
function _hooker(data) {
  var filename = relative(cwd, data.filename);
  // use the shortest name
  if (filename.length > data.filename) {
    filename = data.filename;
  }
  requireData.push({
    // loading i
    i: requireData.length,
    // time
    time: data.startedIn,
    label: data.name,
    // label: data.name + ' (' + filename + ')'
    name: data.name,
    filename: filename
  });
}

function formatTable(tableData, totalTime) {
  var NAME_FILE_REX = /(.+)( \(.+\))/;
  var maxColumns = process.stdout.columns || DEFAULT_COLUMNS;
  var validCount = 0;

  // fs.writeFileSync(process.cwd() + '/time.js', JSON.stringify(tableData, null, 2));

  var longestRequire = tableData.reduce(function (acc, data) {
    var avg = data.time / totalTime;
    if (avg < threshold) {
      return acc;
    }
    validCount++;
    return Math.max(acc, data.label.length);
  }, 0);

  var maxBarWidth = (longestRequire > maxColumns / 2)
    ? ((maxColumns - EXTRA_COLUMNS) / 2)
    : (maxColumns - (longestRequire + EXTRA_COLUMNS));

  var processedTableData = [];
  var maxOrderChars;
  var counter;

  function shorten(name) {
    var isAbsolute = name.charAt(0) === '/';
    name = relative(name);
    var nameLength = name.length;
    var partLength;
    var start;
    var end;

    if (name.length < maxBarWidth) {
      if (isAbsolute) {
        name = './' + name;
      }
      return name;
    }

    partLength = Math.floor((maxBarWidth - 3) / 2);
    start = name.substr(0, partLength + 1);
    end = name.substr(nameLength - partLength);

    if (isAbsolute) {
      start = './' + start;
    }
    return start.trim() + '...' + end.trim();
  }

  function createBar(percentage) {
    var rounded = (percentage * 100).toString().slice(0, 4);
    var bar = repeat(BAR_CHAR, (maxBarWidth * percentage) + 1);
    return (rounded !== 0) ? (bar + ' ' + rounded) + '%' : '0';
  }

  // sort the data if needed
  if (sorted !== false) {
    tableData.sort(function(e1, e2) {
      return e2.time - e1.time;
    });
  }

  // initialize the counter
  counter = 1;

  // get number of chars for padding
  maxOrderChars = tableData.length.toString().length;

  // push the header
  processedTableData.push(['#' + (sorted ? ' [i]' : ''), 'module', 'time', '%']);

  tableData.forEach(function(data) {
    var avg = data.time / totalTime;
    var counterLabel;
    var label;
    var match;

    // select just data over the threshold
    if (avg >= threshold) {
      counterLabel = counter++;
      // for sorted collumns show the i loading with padding
      if (sorted) {
        counterLabel += pad(maxOrderChars - data.i.toString().length + 1, ' ') + ' [' + data.i + ']';
      }

      label = shorten(data.label);
      match = label.match(NAME_FILE_REX);

      if (match) {
        label = chalk().green(match[1]) + match[2];
      }

      var time = chalk().bold(prettyMs(data.time));
      var color = chalk().green;
      if (avg > 0.05) color = chalk().yellow;
      if (avg > 0.10) color = chalk().red;
      var bar = color(createBar(avg));
      var cl = chalk().gray(counterLabel);

      processedTableData.push([cl, label, time, bar]);
    }
  });

  return table(processedTableData, {
    align: ['r', 'l', 'r', 'l'],
    stringLength: function(str) {
      return chalk().stripColor(str).length;
    }
  });
}

// hook process exit to display the report at the end
process.once('exit', function() {
  var startTime = hook.hookedAt;
  var totalTime = Date.now() - startTime.getTime();

  var text = 'Start time: ';
  text += chalk().yellow('(' + dateTime(startTime) + ')');
  text += ' [threshold=' + (threshold * 100) + '%' + (sorted ? ',sorted' : '') + ']';

  var header = '\n\n' + chalk().underline(text);

  log(header);
  log(formatTable(requireData, totalTime));
  log(chalk().bold('Total require(): ') + chalk().yellow(requireData.length));
  log(chalk().bold('Total time: ') + chalk().yellow(prettyMs(totalTime)));
});
