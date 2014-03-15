// Copyright 2013 Clark DuVall
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var COMMANDS = COMMANDS || {};

function replaceAll(find, replace, str) {
      return str.replace(new RegExp(find, 'g'), replace);
}

function GetOutput(outname){
    $text = $.ajax({
        url: "out/" + outname,
        async: false,
        cache: false
    }).responseText
    $text = replaceAll('redprophet', 'rawls', $text);
    return $text;

}

function OutputCmd(me, outname){
$output = GetOutput(outname).split("\n");
    for($i = 0; $i < $output.length; $i++){
        me._terminal.write($output[$i]+"\n");
        me._terminal.newStdout();
    }
}

function sleep(millis, callback) {
        setTimeout(function()
        { callback(); }
       , millis);
}

COMMANDS.cat =  function(argv, cb) {
   var filenames = this._terminal.parseArgs(argv).filenames,
       stdout;

   this._terminal.scroll();
   if (!filenames.length) {
      this._terminal.returnHandler = function() {
         stdout = this.stdout();
         if (!stdout)
            return;
         stdout.innerHTML += '<br>' + stdout.innerHTML + '<br>';
         this.scroll();
         this.newStdout();
      }.bind(this._terminal);
      return;
   }
   filenames.forEach(function(filename, i) {
      var entry = this._terminal.getEntry(filename);

      if (!entry)
         this._terminal.write('cat: ' + filename + ': No such file or directory');
      else if (entry.type === 'dir')
         this._terminal.write('cat: ' + filename + ': Is a directory.');
      else
         this._terminal.write(entry.contents);
      if (i !== filenames.length - 1)
         this._terminal.write('<br>');
   }, this);
   cb();
}

COMMANDS.squadron = function(argv, cb) {

    $args = this._terminal.parseArgs(argv)['filenames'];
    if($args[0] == 'setup'){
        OutputCmd(this, 'setup');
        NextState();
    } else if ($args[0] == 'init') {
        if(this._terminal.cwd.name != 'repo')
        {
            this._terminal.write('please cd into repo dir');
            cb();
            return;
        }
        OutputCmd(this, 'init');
        NextState();
        
    }else {
        OutputCmd(this, 'squadronhelp');
    }
    

    cb();
}

COMMANDS.next = function(argv, cb) {

    $crums = $(".breadcrum a");
    $num = $crums.length;
    for($i = 0; $i < $num; $i++){
        if($($crums[$i]).hasClass('next')){
            window.location = $($crums[$i]).attr('href');
            return;
        }
   }
    this._terminal.write('At the end of the tutorial');
    cb();
}

COMMANDS.mkdir = function(argv, cb) {
    $args = this._terminal.parseArgs(argv)['filenames'];
    if($args.length == 0){
        this._terminal.newStdout();
        cb();
        return;
    }
    $dirName = $args[0];
    //Find where we need to add the dir
    //$where = filename ? this._terminal.getEntry(filename) : this._terminal.cwd
    if($dirName.indexOf("/") != -1)
    {
        $partialSearch = $dirName.substring(0, $dirName.lastIndexOf("/"));
        $where = this._terminal.getEntry($partialSearch);
        if($where == undefined || $where == null){
            this._terminal.write("Path is invalid");
            this._terminal.newStdout();
            cb();
            return;
        }
        $dirName = $dirName.substring($dirName.lastIndexOf("/")+1);
        debugger;
    } else {
        $where = this._terminal.fs;
    }
    $dir = new Object();
    $dir.name = $dirName;
    $dir.type = "dir";
    $dir.contents = new Array();
    if(!this._terminal._HasBlock($dirName, this._terminal.cwd)){
        $where.contents.push($dir);
        this._terminal._addDirs(this._terminal.fs, this._terminal.fs);
        this._terminal.reloadCWD();
    } else {
        this._terminal.write("Directory already exists.");
    }
    this._terminal.newStdout();
    cb();
    return;
}

COMMANDS.previous = function(argv, cb) {

    $crums = $(".breadcrum a");
    $num = $crums.length;
    for($i = 0; $i < $num; $i++){
        if($($crums[$i]).hasClass('current')){
            window.location = $($crums[$i-1]).attr('href');  
            return;
        }
   }
    this._terminal.write('At the begining of the tutorial');
    cb();
}  


COMMANDS.pip = function(argv, cb) {
    $args = this._terminal.parseArgs(argv)['filenames'];
    if($args[0] != 'install' || $args[1] != 'squadron'){
        this._terminal.write('invalid pip command<br/>');
        this._terminal.newStdout();
        cb();
        return;
    }
    $output = GetOutput("pipinstall").split("\n");
    for($i = 0; $i < $output.length; $i++){
        this._terminal.write($output[$i]+"\n");
        this._terminal.newStdout();
        
    }
    cb();
    NextState();
}

COMMANDS.cd = function(argv, cb) {
   var filename = this._terminal.parseArgs(argv).filenames[0],
       entry;

   if (!filename)
      filename = '~';
   entry = this._terminal.getEntry(filename);
   if (!entry)
      this._terminal.write('bash: cd: ' + filename + ': No such file or directory');
   else if (entry.type !== 'dir')
      this._terminal.write('bash: cd: ' + filename + ': Not a directory.');
   else
      this._terminal.cwd = entry;
   cb();
}

COMMANDS.ls = function(argv, cb) {
   var result = this._terminal.parseArgs(argv),
       args = result.args,
       filename = result.filenames[0],
       entry = filename ? this._terminal.getEntry(filename) : this._terminal.cwd,
       maxLen = 0,
       writeEntry;

   writeEntry = function(e, str) {
      this.writeLink(e, str);
      if (args.indexOf('l') > -1) {
         if ('description' in e)
            this.write(' - ' + e.description);
         this.write('<br>');
      } else {
         // Make all entries the same width like real ls. End with a normal
         // space so the line breaks only after entries.
         this.write(Array(maxLen - e.name.length + 2).join('&nbsp') + ' ');
      }
   }.bind(this._terminal);

   if (!entry)
      this._terminal.write('ls: cannot access ' + filename + ': No such file or directory');
   else if (entry.type === 'dir') {
      var dirStr = this._terminal.dirString(entry);
      maxLen = entry.contents.reduce(function(prev, cur) {
         return Math.max(prev, cur.name.length);
      }, 0);
   
    //handle empty directories 
    if(entry.contents.length == 2) {
        cb();
        return;
    }

      for (var i in entry.contents) {
         var e = entry.contents[i];
         if(e.type == undefined){
            continue;
         }
         if (args.indexOf('a') > -1 || e.name[0] !== '.')
            writeEntry(e, dirStr + '/' + e.name);
      }
   } else {
      maxLen = entry.name.length;
      writeEntry(entry, filename);
   }
   cb();
}



COMMANDS.dir = COMMANDS.ls;

COMMANDS.gimp = function(argv, cb) {
   var filename = this._terminal.parseArgs(argv).filenames[0],
       entry,
       imgs;

   if (!filename) {
      this._terminal.write('gimp: please specify an image file.');
      cb();
      return;
   }

   entry = this._terminal.getEntry(filename);
   if (!entry || entry.type !== 'img') {
      this._terminal.write('gimp: file ' + filename + ' is not an image file.');
   } else {
      this._terminal.write('<img src="' + entry.contents + '"/>');
      imgs = this._terminal.div.getElementsByTagName('img');
      imgs[imgs.length - 1].onload = function() {
         this.scroll();
      }.bind(this._terminal);
      if ('caption' in entry)
         this._terminal.write('<br/>' + entry.caption);
   }
   cb();
}

COMMANDS.reload = function(argv, cb) {
    this._terminal._reloadFS();
    cb();
}

COMMANDS.save = function(argv, cb) {
    this._terminal._saveFS();
    cb();
}


COMMANDS.clear = function(argv, cb) {
   this._terminal.div.innerHTML = '';
   cb();
}

COMMANDS.sudo = function(argv, cb) {
   var count = 0;
   this._terminal.returnHandler = function() {
      if (++count < 3) {
         this.write('<br/>Sorry, try again.<br/>');
         this.write('[sudo] password for ' + this.config.username + ': ');
         this.scroll();
      } else {
         this.write('<br/>sudo: 3 incorrect password attempts');
         cb();
      }
   }.bind(this._terminal);
   this._terminal.write('[sudo] password for ' + this._terminal.config.username + ': ');
   this._terminal.scroll();
}

COMMANDS.login = function(argv, cb) {
   this._terminal.returnHandler = function() {
      var username = this.stdout().innerHTML;

      this.scroll();
      if (username)
         this.config.username = username;
      this.write('<br>Password: ');
      this.scroll();
      this.returnHandler = function() { cb(); }
   }.bind(this._terminal);
   this._terminal.write('Username: ');
   this._terminal.newStdout();
   this._terminal.scroll();
}

COMMANDS.tree = function(argv, cb) {
   var term = this._terminal,
       home;

   function writeTree(dir, level) {
      dir.contents.forEach(function(entry) {
         var str = '';

         //if (entry.name.startswith('.'))
         //   return;
         if (entry.name == '.' || entry.name == '..'){
            return;
        }


         for (var i = 0; i < level; i++)
            str += '|  ';
         str += '|&mdash;&mdash;';
         term.write(str);
         term.writeLink(entry, term.dirString(dir) + '/' + entry.name);
         term.write('<br>');
         if (entry.type === 'dir')
            writeTree(entry, level + 1);
      });
   };
   home = this._terminal.getEntry('~');
   this._terminal.writeLink(home, '~');
   this._terminal.write('<br>');
   writeTree(home, 0);
   cb();
}

COMMANDS.help = function(argv, cb) {
   this._terminal.write(
       'You can navigate either by clicking on the navigation below or by typing "next" or "previous".<br/>');
   this._terminal.write('Commands are:<br>');
   for (var c in this._terminal.commands) {
      if (this._terminal.commands.hasOwnProperty(c) && !c.startswith('_'))
         this._terminal.write(c + '  ');
   }
   cb();
}
