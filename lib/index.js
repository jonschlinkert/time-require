'use strict';

const write = process.stdout.write.bind(process.stdout);
const argv = require('minimist')(process.argv.slice(2));
const dateTime = require('date-time');
const prettyMs = require('pretty-ms');
const repeat = require('repeat-string');
const table = require('text-table');
const colors = require('ansi-colors');
const stripColor = require('strip-color');
const relative = require('relative');
const hook = require('./requireHook')(hooker);
const cwd = process.cwd();
const requireData = [];

// defaults
const DEFAULT_COLUMNS = 80;
const BAR_CHAR = process.platform === 'win32' ? '■' : '▇';
const sorted = argv.sorted || argv.s;

// TODO - configure threshold using CLI ?
const threshold = (argv.verbose || argv.v) ? 0.0 : 0.001;
const EXTRA_COLUMNS = sorted ? 24 : 20;

function pad(count, seq) {
  return (count > 1) ? new Array(count).join(seq) : '';
}

function log(str) {
  write(str + '\n', 'utf8');
}

/**
 * Callback/listener used by requireHook hook to collect all the modules in their loading i
 */
function hooker(data) {
  const filename = relative(cwd, data.filename);

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
  const maxColumns = process.stdout.columns || DEFAULT_COLUMNS;
  const NAME_FILE_REX = /(.+)( \(.+\))/;

  const longestRequire = tableData.reduce(function(acc, data) {
    const avg = data.time / totalTime;
    if (avg < threshold) {
      return acc;
    }
    return Math.max(acc, data.label.length);
  }, 0);

  const maxBarWidth = (longestRequire > maxColumns / 2)
    ? ((maxColumns - EXTRA_COLUMNS) / 2)
    : (maxColumns - (longestRequire + EXTRA_COLUMNS));

  const processedTableData = [];
  let maxOrderChars;
  let counter;

  function shorten(name) {
    const isAbsolute = name.charAt(0) === '/';
    name = relative(name);
    const nameLength = name.length;
    let partLength;
    let start;
    let end;

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
    const rounded = (percentage * 100).toString().slice(0, 4);
    const bar = repeat(BAR_CHAR, (maxBarWidth * percentage) + 1);
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
    const avg = data.time / totalTime;
    let counterLabel;
    let label;
    let match;

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
        label = colors.green(match[1]) + match[2];
      }

      const time = colors.bold(prettyMs(data.time));
      let color;

      if (avg > 0.05) {
        color = colors.yellow;
      } else if (avg > 0.10) {
        color = colors.red;
      } else {
        color = colors.green;
      }

      const bar = color(createBar(avg));
      const cl = colors.gray(counterLabel);

      processedTableData.push([cl, label, time, bar]);
    }
  });

  return table(processedTableData, {
    align: ['r', 'l', 'r', 'l'],
    stringLength: function(str) {
      return stripColor(str).length;
    }
  });
}

// hook process exit to display the report at the end
process.once('exit', function() {
  const startTime = hook.hookedAt;
  const totalTime = Date.now() - startTime.getTime();

  let text = 'Start time: ';
  text += colors.yellow('(' + dateTime(startTime) + ')');
  text += ' [threshold=' + (threshold * 100) + '%' + (sorted ? ',sorted' : '') + ']';

  const header = '\n\n' + colors.underline(text);

  log(header);
  log(formatTable(requireData, totalTime));
  log(colors.bold('Total require(): ') + colors.yellow(requireData.length));
  log(colors.bold('Total time: ') + colors.yellow(prettyMs(totalTime)));
});
