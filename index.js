/**
 * Based on time-require by Ciprian Popa (cyparu)
 * https://github.com/Jaguard/time-require/
 */

'use strict';

const cwd = process.cwd();
const os = require('os');
const path = require('path');
const opts = {
  alias: { v: 'verbose', t: 'threshold', r: 'remove', m: 'max' },
  default: { threshold: 0.01, max: Infinity }
};

const argv = require('minimist')(process.argv.slice(2), opts);
const table = require('text-table');
const colors = require('ansi-colors');

// bind "write" before hook() is called
const write = process.stdout.write.bind(process.stdout);
const { bold, cyan, dim, gray, green, red, unstyle, yellow } = colors;

const hook = require('./lib/requireHook')(hooker);
const requireData = [];

// defaults
const DEFAULT_COLUMNS = 80;
const BAR_CHAR = process.platform === 'win32' ? '■' : '▇';
const sorted = argv.sorted || argv.s;
const NAME_FILE_REGEX = /(.+)( \(.+\))/;

// TODO - configure threshold using CLI ?
const threshold = argv.threshold;
const log = (...args) => write(`${args.join(' ')}\n`, 'utf8');

/**
 * Callback/listener used by requireHook hook to collect all the modules in their loading i
 */

function hooker(data) {
  requireData.push({
    // loading i
    i: requireData.length,
    // time
    time: data.startedIn,
    // label: data.name,
    name: data.name,
    filename: data.filename,
    label: `${data.name} (${data.filename})`
  });
}

function formatTable(tableData, totalTime) {
  const maxColumns = process.stdout.columns || DEFAULT_COLUMNS;

  const remove = filename => {
    let name = filename;
    if (argv.remove && name.startsWith(argv.remove)) {
      name = name.replace(argv.remove, '');
      if (name !== filename && name[0] === '/') {
        name = name.slice(1);
      }
    }

    if (name.includes('node_modules')) {
      name = name.replace('node_modules', dim('node_modules'));
    }
    return name;
  };

  const shorten = name => {
    if (name.startsWith(cwd)) {
      return dim('./') + cyan(remove(path.relative(cwd, name)));
    }
    if (name.startsWith(os.homedir())) {
      return dim('~/') + remove(name.replace(os.homedir() + '/', ''));
    }
    return red(remove(name));
  };

  let rows = [];
  let longestPath = tableData.reduce((n, d) => {
    return Math.max(n, colors.unstyle(shorten(d.filename)).length);
  }, 0);

  let maxOrderChars;
  let counter;

  if (longestPath > maxColumns) {
    longestPath = maxColumns;
  }

  const createBar = percentage => {
    let diff = Math.max(0, maxColumns - longestPath - 12);
    let rounded = (percentage * 100).toString().slice(0, 4);
    let bar = BAR_CHAR.repeat((diff * percentage) + 1);
    return (rounded !== 0) ? `${bar} ${rounded}%` : '0';
  };

  // sort the data if needed
  if (sorted !== false) {
    tableData.sort((a, b) => b.time - a.time);
  }

  // initialize the counter
  counter = 1;

  // get number of chars for padding
  maxOrderChars = tableData.length.toString().length;

  // push the header
  const header = [`#${sorted ? ' [i]' : ''}`, 'module', 'time', '%'];
  rows.push(header.map(h => bold(h.toUpperCase())));
  const sepRow = ['', '', '', ''];
  rows.push(sepRow);

  tableData.forEach(data => {
    if (rows.length - 2 >= argv.max) return;
    const avg = data.time / totalTime;
    let counterLabel;
    let label;
    let match;

    // select just data over the threshold
    if (avg >= threshold) {
      counterLabel = counter++;
      // for sorted collumns show the i loading with padding
      if (sorted) {
        counterLabel += ` [${data.i}]`.padStart(maxOrderChars, ' ');
      }

      label = shorten(data.filename);
      // label = shorten(data.label);
      match = label.match(NAME_FILE_REGEX);

      if (match) {
        label = green(match[1]) + match[2];
      }

      const time = bold(`${data.time}ms`);
      let color;

      // below 5% of total require time
      if (avg < 0.05) color = green;
      // from 5-10% of total require time
      if (avg >= 0.05 && avg <= 0.10) color = yellow;
      // above 10% of total require time
      if (avg > 0.10) color = red;

      const bar = color(createBar(avg));
      const cl = dim(counterLabel);

      rows.push([cl, label, time, bar]);
    }
  });

  // create separator row below header
  const colLengths = [0, 0, 0, 0];
  for (let row of rows) {
    for (let i = 0; i < row.length; i++) {
      colLengths[i] = Math.max(colors.unstyle(row[i]).length, colLengths[i]);
    }
  }

  for (let i = 0; i < sepRow.length; i++) {
    sepRow[i] = dim.gray('─'.repeat(colLengths[i]));
  }

  hook.rows = rows;
  return table(rows, {
    align: ['r', 'l', 'r', 'l'],
    stringLength(str) {
      return unstyle(str).length;
    }
  });
}

// hook process exit to display the report at the end
process.once('exit', function() {
  log();
  log();
  const startTime = hook.hookedAt;
  const totalTime = Date.now() - startTime.getTime();

  let table = formatTable(requireData, totalTime);
  let lines = table.split('\n');
  let totalLen = lines.reduce((a, l) => (a += colors.unstyle(l).length), 0);
  let len = Math.ceil(totalLen / lines.length);
  log(table);

  let diff = requireData.length - hook.rows.length;
  log(dim.gray('─'.repeat(len)));
  log(bold(`Showing the slowest ${red(hook.rows.length - 2)} of ${cyan(requireData.length)} require calls`));
  log(bold('Total time: ') + yellow(`${totalTime}ms`));
  log();
  log(gray('─'.repeat(len)));
  log('-t, --threshold', '  Change the threshold (percent of total require time) for filtering rows.');
  log('               ', '  Example: "-t=0.12" will show requires that take more than 12% of load time.');
  log('-m, --max      ', '  Override threshold and set a hard maximum number of rows to display.');
  log();
  log();
});
