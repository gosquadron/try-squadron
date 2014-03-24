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

Array.prototype.hasObject = (
          !Array.indexOf ? function (o)
            {
                    var l = this.length + 1;
                        while (l -= 1)
        {
                    if (this[l - 1] === o)
            {
                            return true;
                                    }
    }
    return false;
      } : function (o)
        {
                return (this.indexOf(o) !== -1);
                  }
        );


(function() {
   if (typeof Object.create !== 'function') {
      Object.create = function (o) {
         function F() {}
         F.prototype = o;
         return new F();
      };
   }

   if (!Function.prototype.bind) {
      Function.prototype.bind = function (oThis) {
         if (typeof this !== "function") {
            // closest thing possible to the ECMAScript 5 internal IsCallable function
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
         }

         var aArgs = Array.prototype.slice.call(arguments, 1),
            fToBind = this,
            fNOP = function () {},
            fBound = function () {
               return fToBind.apply(this instanceof fNOP && oThis
                                      ? this
                                      : oThis,
                                    aArgs.concat(Array.prototype.slice.call(arguments)));
            };

         fNOP.prototype = this.prototype;
         fBound.prototype = new fNOP();

         return fBound;
      };
   }

    function censor(key, value) {
        if(value.name == '.' || value.name == '..'){
            return undefined;
        }
        if(value.contents != undefined)
        {
            var newContents = new Array();
            for($i = 0; $i < value.contents.length; $i++)
            {
                if(value.contents[$i].name == '.' || 
                        value.contents[$i].name == '..')
                {
                    continue;
                }
                newContents.push(value.contents[$i]);
            }
            value.contents = newContents;
            return value;
        }
        return value;
    }

    //Completely loads a new FS
   function loadFS(name, cb) {

        if(name.startswith('newfs'))
        {
            cb(name.replace('newfs', ''));
            return;
        } 

       if(name.indexOf('empty.json')>0){
           $empty = {
                   "name": "~",
                   "type": "dir",
                   "contents": [ 
                       ]
                    }; 
            cb(JSON.stringify($empty));
            return;
        } 
      var ajax = new XMLHttpRequest();

      ajax.onreadystatechange = function() {
         if (ajax.readyState == 4 && ajax.status == 200)
            cb(ajax.responseText);
      };
      //We want a fresh copy all the time
      ajax.open('GET', name+'?rand='+Math.floor((Math.random()*20)+1));
      ajax.send();
   };

   var Terminal = {
      init: function(config, fs, commands, cb) {
         this._queue = [];
         this._history = [];
         this._historyIndex = -1;
         this.loadConfig(config);

         if (commands)
            this.loadCommands(commands);

         if (fs)
            this.loadFS(fs, cb);
         else if (cb)
            cb();
      },
    
    dedupeFolders: function($curDir){
        
        if($curDir == undefined || $curDir == null){
            $curDir = this.fs;
        }
        //If there are contents
        if($curDir.contents != undefined && $curDir.contents != null)
        {
            //And there is actually something
            if($curDir.contents.length == 0){
                return;
            }
            //Loop through all of the dirs except . and ..
            $seenNames = new Array();
            for(var i = 0; i < $curDir.contents.length; i++){
                $curItem = $curDir.contents[i];
                if($curItem.name == '.' || $curItem.name == '..' || $curItem.type != "dir"){
                    continue;
                }
                //Seriously, only dirs :)
                if($curItem.type !="dir"){
                    continue;
                }

                //Add the current name and the index 
                $seenNames.push([$curItem.name, i]);
            }
            $seenNames.sort();
            if($seenNames.length > 0){
                $lastSeenName = $seenNames[0][0];
                $lastSeenIndex = $seenNames[0][1];
                if($seenNames.length > 1){
                    for(var i = 1; i < $seenNames.length; i++){
                        $curSeenName = $seenNames[i][0];
                        if($lastSeenName == $curSeenName){

                            $SlaveIndex = $seenNames[i][1];
                            $MasterIndex = $lastSeenIndex;

                            //Let's merge the contents
                            $Master = $curDir.contents[$MasterIndex];
                            $Slave = $curDir.contents[$SlaveIndex];
                            
                            //Loop through slave copy contents 
                            for(var inside=0; inside < $Slave.contents.length; inside++){
                                $slaveItem = $Slave.contents[inside];
                                $Master.contents.push($slaveItem);
                                //Fix the .. in the slaveItem's contents if
                                //applicable
                                if($slaveItem.type == 'link' || $slaveItem.type == 'dir'){
                                    for(var furtherInside = 0; furtherInside < $slaveItem.contents.length; furtherInside++){
                                        $fixSlaveItem = $slaveItem.contents[furtherInside];
                                        if($fixSlaveItem.name == '..'){
                                            $fixSlaveItem.contents = $Master;
                                        } 
                                    }
                                }
                            }

                            //Now remove the slave
                            $curDir.contents.splice($SlaveIndex, 1);

                            //debugger;
                        }
                        $lastSeenName = $curSeenName;
                        $lastSeenIndex = $seenNames[i][1];
                    }
                }
            }

            //Here we would go in depth again
            for(var i = 0; i < $curDir.contents.length; i++){
                $curItem = $curDir.contents[i];
                if($curItem.name == '.' || $curItem.name == '..' || $curItem.type != "dir"){
                    continue;
                }
                this.dedupeFolders($curItem);
            }
            
        }
    },

    //Used for squadron commands, will merge the FS loaded into the cwd.
    loadFSIntoDir: function(name, cb){
        loadFS(name, function(responseText) {
            responseText = replaceAll('redprophet', CONFIG.username, responseText);
            if(typeof $serviceName != 'undefined'  && $serviceName != null){
                responseText = replaceAll('~servicename~', $serviceName, responseText);
            }
            $newfs = JSON.parse(responseText);
            if(this.cwd == undefined || this.cwd == null){
                if(this.fs == undefined || this.fs == null){
                    this.fs = $newfs;
                    this.reloadCWD();
                } else {
                    this.fs.contents = this.fs.contents.concat($newfs.contents);
                    //Remove duplicate folders by merging them
                    this.dedupeFolders();            
                }
                this.reloadCWD();
            } else {
                this.cwd.contents = this.cwd.contents.concat($newfs.contents);
                this.dedupeFolders();
            }
            this._addDirs(this.fs, this.fs);
            if($currentStep > 1 && !$alreadyLoadedSavedFS){
                this._reloadFS();
                $alreadyLoadedSavedFS = true;
            }
//            debugger;
        }.bind(this));

    },

    loadFS: function(name, cb) {
         loadFS(name, function(responseText) {
            responseText = replaceAll('redprophet', CONFIG.username, responseText);
            this.fs = JSON.parse(responseText);
            this.reloadCWD();
            this._addDirs(this.fs, this.fs); 
            cb && cb();
         }.bind(this));
    },

    //Sets cwd back, if oldcwd is null it just loads that path
    reloadCWD: function($oldcwd) {
        $oldcwd = typeof $oldcwd !== 'undefined' ? $oldcwd : this.cwd;
        if($oldcwd == undefined || $oldcwd == null){
            $cwdstr = "~";
        } else {
            if(this.cwd == undefined || this.cwd == null){
                $cwdstr = "~";
            } else {
                $cwdstr = this.dirString(this.cwd);
            }
        }
        this.cwd = this.getEntry($cwdstr, false); 
        if(this.cwd == undefined || this.cwd == null){
            debugger;
        }   
    },

      loadCommands: function(commands) {
         this.commands = commands;
         this.commands._terminal = this;
      },

      loadConfig: function(config) {
         this.config = config;
      },

      begin: function(element) {
         var parentElement = element || document.body;

         this.div = document.createElement('div');
         this.div.classList.add('jsterm');
         parentElement.appendChild(this.div);

         window.onkeydown = function(e) {
            var key = (e.which) ? e.which : e.keyCode;
            if($editActive){
                return;
            }
            if (key == 8 || key == 9 || key == 13 || key == 46 || key == 38 ||
                key == 40 || e.ctrlKey)
               e.preventDefault();
            this._handleSpecialKey(key, e);
         }.bind(this);

         window.onkeypress = function(e) {
            if($editActive){
                return;
            }
            this._typeKey((e.which) ? e.which : e.keyCode);
         }.bind(this);

         this.returnHandler = this._execute;
         this.cwd = this.fs;
         this._prompt();
         this._toggleBlinker(600);
         this._dequeue();
      },

      //Returns the path to the current directory
      getCWD: function() {
         return this.dirString(this.cwd);
      },

      // 
    dirString: function(d) {
        var $searchDir = d,
        dirStr = '';
        if(d == undefined || d == null || d.contents == undefined || d.contents == null){
            debugger;
        }
        if(d.contents.length == 0){
            return '~';
        }
        $done = false; 
        while (!$done)
        {
            $currentDir = this._dirNamed('..', $searchDir.contents);
            if($currentDir == null || $currentDir == undefined){
                //Shouldn't happen
                debugger;
            }
            $done = $currentDir.contents == $searchDir.contents;
            if($done){ break; }
            //Keep going in
            dirStr = '/' + $searchDir.name + dirStr;
            $searchDir = this._dirNamed('..', $searchDir.contents);
        }
        return '~' + dirStr;
    },

    //Gets a 'block' or entry from the system based on a path
    //If retContents is false, always returns block. Otherwise legacy behavior.
      getEntry: function(path, retContents) {
        if(retContents == undefined || retContents == null){
            retContents = true;
        }
         var entry,
             parts;

         if (!path)
            return null;

         path = path.replace(/^\s+/, '').replace(/\s+$/, '');
         if (!path.length)
            return null;

         entry = this.cwd;
         if (path[0] == '~') {
            entry = this.fs;
            path = path.substring(1, path.length);
         }

         parts = path.split('/').filter(function(x) {return x;});
         for (var i = 0; i < parts.length; ++i) {
            entry = this._dirNamed(parts[i], entry.contents, false);
            if (!entry)
               return null;
         }
         if(retContents){
             return entry.contents;
         }
         return entry;
      },

      write: function(text) {
         var output = this.stdout();

         if (!output)
            return;
         output.innerHTML += text;
      },

      defaultReturnHandler: function() {
         this.returnHandler = this._execute;
      },

      typeCommand: function(command, cb) {
         var that = this;

         (function type(i) {
            if (i == command.length) {
               that._handleSpecialKey(13);
               if (cb) cb();
            } else {
               that._typeKey(command.charCodeAt(i));
               setTimeout(function() {
                  type(i + 1);
               }, 100);
            }
         })(0);
      },

      tabComplete: function(text) {
         var parts = text.replace(/^\s+/, '').split(' '),
             matches = [];
         if (!parts.length)
            return [];

         if (parts.length == 1) {
            // TODO: Combine with below.
            var pathParts = parts[0].replace(/[\/]+/, '/').split('/'),
                last = pathParts.pop(),
                dir = (pathParts.length > 0) ? this.getEntry(pathParts.join('/'), false) : this.cwd,
                n,
                fullPath,
                last,
                dir;

            if (dir) {
               for (var i in dir.contents) {
                  n = dir.contents[i].name;
                  if (n.startswith(last) && n != '.' && n != '..'  && n != last) {
                     if (dir.contents[i].type == 'exec')
                        matches.push(n + ' ');
                  }
               }
            }
            for (var c in this.commands) {
               // Private member.
               if (c[0] == '_')
                  continue;
               if (c.startswith(parts[0]) && c != parts[0])
                  matches.push(c + ' ');
            }
         } else {
            fullPath = parts[parts.length - 1];
            pathParts = fullPath.replace(/[\/]+/, '/').split('/');
            last = pathParts.pop();
            dir = (pathParts.length > 0) ? this.getEntry(pathParts.join('/'), false) : this.cwd;

            if (!dir)
               return [];

            for (var i in dir.contents) {
               n = dir.contents[i].name;
               if (n.startswith(last) && n != '.' && n!= '..'  && n != last) {
                  if (dir.contents[i].type == 'dir')
                     matches.push(n + '/');
                  else
                     matches.push(n + ' ');
               }
            }
         }
         return matches;
      },

      enqueue: function(command) {
         this._queue.push(command);
         return this;
      },

      scroll: function() {
         window.scrollTo(0, document.body.scrollHeight);
         //$('body').scrollTo('.prompt');
      },

      parseArgs: function(argv) {
         var args = [],
             filenames = [],
             opts;

         for (var i = 0; i < argv.length; ++i) {
            if (argv[i].startswith('-')) {
               opts = argv[i].substring(1);
               for (var j = 0; j < opts.length; ++j)
                  args.push(opts.charAt(j));
            } else {
               filenames.push(argv[i]);
            }
         }
         return { 'filenames': filenames, 'args': args };
      },

      writeLink: function(e, str) {
         this.write('<span class="' + e.type + '">' + this._createLink(e, str) +
             '</span>');
      },

      stdout: function() {
         return this.div.querySelector('#stdout');
      },

      newStdout: function() {
         var stdout = this.stdout(),
             newstdout = document.createElement('span');
         $(newstdout).attr('position', 'relative');
         this._resetID('#stdout');
         newstdout.id = 'stdout';
         stdout.parentNode.insertBefore(newstdout, stdout.nextSibling);

      },

      _createLink: function(entry, str) {
         function typeLink(text, link) {
            return '<a href="javascript:void(0)" onclick="typeCommand(\'' +
                text + '\')">' + link + '</a>';
         };

         if (entry.type == 'dir' || entry.type == 'link') {
            return typeLink('ls -l ' + str, entry.name);
         } else if (entry.type == 'text') {
            return typeLink('cat ' + str, entry.name);
         } else if (entry.type == 'img') {
            return typeLink('gimp ' + str, entry.name);
         } else if (entry.type == 'exec') {
            return '<a href="' + entry.contents + '" target="_blank">' +
                entry.name + '</a>';
         }
      },

      _dequeue: function() {
         if (!this._queue.length)
            return;

         this.typeCommand(this._queue.shift(), function() {
            this._dequeue()
         }.bind(this));
      },
    
    //Does the dir have a block with that name?
    _HasBlock: function(name, dir){
        return this._FindBlock(name, dir) != null;
    },

    //Loop through the contents of dir until 
    //we find the block with that name
    //dir can be the dir, or the contents
    _FindBlock: function(name, dir){
        if(dir == undefined || dir == null){
            debugger;
        }
        if(dir.contents != undefined || dir.contents != null){
            dir = dir.contents;
        }
        for(var i in dir){
            if(dir[i].name == name){
                return dir[i];
            }
        }
        return null;
    },

    //Is this file system block a directory/link?
    _IsBlockDir: function(block){
        return block.type == 'link' || block.type == 'dir';
    },

    //Get the parent directory
    _GetParentBlock: function(block){
        $parentLink = this._dirNamed('..', block, false);
        if($parentLink == undefined || $parentLink == null){
            debugger;
        }   
        $parentBlock = $parentLink.contents;
        return $parentBlock;
    },

    //Get the index of a block with a certain name.
    //Params:
    //  - Block: where to search
    //  - Name: What we're searching for
    _GetIndexOfBlockInContent: function(block, name){
        for($inner = 0; $inner < block.contents.length; $inner++){
            $innerName = block.contents[$inner].name;
            if($innerName == $cleanBlockName){
                return $inner;
            }   
        }
        return -1; 
    },

    //Returns the 'block' of a particular name.
    //if it's a directory/link it returns it's contents.
    //if its anything else it returns itself.
    //if it's not found returns null.
    //Params:
    //if retContents is true or null (default), has legacy behavior.
    //if retContents is false, will always return block.
    _dirNamed: function(name, dir, retContents) {
        if(retContents == undefined || retContents == null){
            retContents = true;
        }
        $block = this._FindBlock(name, dir);
        if($block != null){
            if(this._IsBlockDir($block))
            {
                if(retContents){
                return $block.contents;
                } else {
                    return $block;
                }
            } else {
                return $block;
            }
        }
        return null;
     },

      //Adds the fake directories . and ..
    _addDirs: function(curDir, parentDir) {
        curDir.contents.forEach(function(entry, i, dir) {
        if (entry.type == 'dir')
            this._addDirs(entry, curDir);
        }.bind(this));

        if(!this._HasBlock('..', curDir)){
            curDir.contents.unshift({
                'name': '..',
                'type': 'link',
                'contents': parentDir
             });
        }
        if(!this._HasBlock('.', curDir)){
            curDir.contents.unshift({
               'name': '.',
               'type': 'link',
               'contents': curDir
            });
        }
    },

      _toggleBlinker: function(timeout) {
         var blinker = this.div.querySelector('#blinker'),
             stdout;

         if (blinker) {
            blinker.parentNode.removeChild(blinker);
         } else {
            stdout = this.stdout();
            if (stdout) {
               blinker = document.createElement('span');
               blinker.id = 'blinker';
               blinker.innerHTML = '&#x2588';
               stdout.parentNode.appendChild(blinker);
            }
         }

         if (timeout) {
            setTimeout(function() {
               this._toggleBlinker(timeout);
            }.bind(this), timeout);
         }
      },

      _resetID: function(query) {
         var element = this.div.querySelector(query);

         if (element)
            element.removeAttribute('id');
      },

      _prompt: function() {
         var div = document.createElement('div'),
             prompt = document.createElement('span'),
             command = document.createElement('span');

         this._resetID('#currentPrompt');
         this.div.appendChild(div);

         prompt.classList.add('prompt');
         prompt.id = 'currentPrompt';
         prompt.innerHTML = this.config.prompt(this.getCWD(), this.config.username);
         div.appendChild(prompt);

         this._resetID('#stdout');
         command.classList.add('command');
         command.id = 'stdout';
         div.appendChild(command);
         this._toggleBlinker(0);
         this.scroll();
      },

      _typeKey: function(key) {
         var stdout = this.stdout();

         if (!stdout || key < 0x20 || key > 0x7E || key == 13 || key == 9)
            return;

         stdout.innerHTML += String.fromCharCode(key);
      },

      _handleSpecialKey: function(key, e) {
         var stdout = this.stdout(),
             parts,
             pathParts;

         if (!stdout)
            return;
         // Backspace/delete.
         if (key == 8 || key == 46)
            stdout.innerHTML = stdout.innerHTML.replace(/.$/, '');
         // Enter.
         else if (key == 13)
            this.returnHandler(stdout.innerHTML);
         // Up arrow.
         else if (key == 38) {
            if (this._historyIndex < this._history.length - 1)
               stdout.innerHTML = this._history[++this._historyIndex];
         // Down arrow.
         } else if (key == 40) {
            if (this._historyIndex <= 0) {
               if (this._historyIndex == 0)
                  this._historyIndex--;
               stdout.innerHTML = '';
            }
            else if (this._history.length)
               stdout.innerHTML = this._history[--this._historyIndex];
         // Tab.
         } else if (key == 9) {
            matches = this.tabComplete(stdout.innerHTML);
            if (matches.length) {
               parts = stdout.innerHTML.split(' ');
               pathParts = parts[parts.length - 1].split('/');
               pathParts[pathParts.length - 1] = matches[0];
               parts[parts.length - 1] = pathParts.join('/');
               stdout.innerHTML = parts.join(' ');
            }
         // Ctrl+C, Ctrl+D.
         } else if ((key == 67 || key == 68) && e.ctrlKey) {
            if (key == 67)
               this.write('^C');
            this.defaultReturnHandler();
            this._prompt();
         }
      },
     
    //When page is loaded or when using cmd
    _reloadFS: function(){
        //We add 'newfs' as a hack to not make an AJAX request
        $jsonstr = $.jStorage.get("squadronfs", "");
        if($jsonstr != ""){
            this.loadFS("newfs" + $jsonstr);
        }
        $lastcwd = $.jStorage.get("squadroncwd", "~");
        entry = this.getEntry($lastcwd, false); 
        if(entry != null){
           if (entry.type == 'dir') {
              this.cwd = entry;
            } else {
                //This is a link
                this.cwd = entry.contents;
            }
        }
        //This reloads the terminal so it updates the cwd
        this.defaultReturnHandler();
        this._prompt()
    },

    _GetFSJSON: function() {
        $jsonstr = JSON.stringify(this.fs, censor);
        this._addDirs(this.fs, this.fs);
        return $jsonstr;
    },
 
    //When CMD is called
    _saveFS: function(){
        $jsonstr = this._GetFSJSON();
        $.jStorage.set("squadronfs", $jsonstr);
        $.jStorage.set("squadroncwd", this.dirString(this.cwd));
    },

    _resetFS: function() {
        $.jStorage.deleteKey("squadronfs");
        location.reload();
    },

      _execute: function(fullCommand) {
         var output = document.createElement('div'),
             stdout = document.createElement('span'),
             parts = fullCommand.split(' ').filter(function(x) { return x; }),
             command = parts[0],
             args = parts.slice(1, parts.length),
             entry = this.getEntry(fullCommand);

         this._resetID('#stdout');
         stdout.id = 'stdout';
         output.appendChild(stdout);
         this.div.appendChild(output);

         if (command && command.length) {
            if (command in this.commands) {
               this.commands[command](args, function() {
                  this.defaultReturnHandler();
                  this._prompt()
               }.bind(this));
            } else if (entry && entry.type == 'exec') {
               window.open(entry.contents, '_blank');
               this._prompt();
            } else {
               this.write(command + ': command not found');
               this._prompt();
            }
         } else {
            this._prompt()
         }
         if (fullCommand.length)
            this._history.unshift(fullCommand);
         this._historyIndex = -1;
      }
   };

   String.prototype.startswith = function(s) {
      return this.indexOf(s) == 0;
   }


   
   //Setup tutorial
   var step = '1';
   if(window.location.href.indexOf('?step=') > 0) {
       var params = window.location.href.toString().split(window.location.host)[1].split('?')[1];
       step = params.split('step=')[1];
   }

   $editActive = false;
   $alreadyLoadedSavedFS = false;
   $currentState = 0;
   $states = new Array();
   $stateFS = new Array();
   $initialState = '';
   $currentStep = parseInt(step);
   $enabledCommands = new Array();
   $enabledCommands.push("_terminal");
   $enabledCommands.push("next");
   $enabledCommands.push("previous");
   $enabledCommands.push("help");
   $enabledCommands.push("save");
   $enabledCommands.push("reload");
   $enabledCommands.push("printfs");
   $enabledCommands.push("rm");
   $enabledCommands.push("resetfs");
   $fscmd = ['squadron', 'ls', 'pwd', 'cd', 'cat', 'tree', 'mkdir', 'dir']
   $filesystem = 'json/empty.json';
   switch(step){
    case '12':
        $states.push('<iframe width="420" height="315" src="//www.youtube.com/embed/9_t-fmpfp5E?autoplay=1" frameborder="0" allowfullscreen></iframe>');
        break;
    case '11':
        $states.push('<iframe width="560" height="315" src="//www.youtube.com/embed/Kx5INl9Z1IE?autoplay=1" frameborder="0" allowfullscreen></iframe>');
        break;
    case '10':
        $states.push('lololol');
        break;
    case '9':
        $states.push('<3');
        break;
    case '8':
        $states.push('cute cute cute');
        break;
    case '7':
        $states.push(':)');
        break;
    case '6':
        $states.push('<iframe width="560" height="315" src="//www.youtube.com/embed/saJxQEreRtM?autoplay=1" frameborder="0" allowfullscreen></iframe>');
        break;
    case '5':
        $states.push("Squadron takes whatever is in the root folder of your service and deploys them. <br/>Let's take a look at how that works. <br/>Go into the directory of your service and then into root.");
        $states.push("Great, now let's create a few files. <br/>First, We'll create our robots.txt file from a template. We'll actually call it robots.txt~tpl.<br/>~ is the keyword that an extension handler will take care of it.<br/>The tpl or templating extension handler will be run through this.<br/><span class='code'>edit robots.txt~tpl</span>");
        $states.push("Enter the text below, notice the variables starting with @.<br/><span class='code'>User-agent: * <br/>\
#for @d in @disallow:<br/>\
Disallow: @d<br/>\
#end<br/>\
Allow: /humans.txt</span>");
        $states.push("Now let's do another extension handler, this one will is for git repositories. <span class='code'>edit main~git</span>");
        $states.push("The following will tell the handler to clone the repo, of the @release branch, which is a variable.<br/><span class='code'>{<br/>\
&nbsp;&nbsp;&nbsp;\"url\":\"https://github.com/cxxr/example-squadron-repo.git\",<br/>\
&nbsp;&nbsp;&nbsp;\"refspec\":\"@release\"<br/>\
}");
        $states.push("Now that we have a bunch of files with variables let's set them. Type next to check out config.");
        
        $stateFS.push('empty');
        $enabledCommands = $enabledCommands.concat($fscmd);
        $enabledCommands.push('edit');
        break;
    case '4':
        $states.push("To start describing your service type:<br/><br/><span class='code'>squadron init --service web</span>");
        $states.push("Note: in real squadron version # can be a parameter.<br/><br/>For our service let's modify the state of the system. Type <span class='code'>cat state.json</span>, normally this file is empty. Let's edit it. Type <span class='code'>edit state.json</span>.");
        $states.push("Great, now let's add the following into it. In our example service, we're going go be running a simple website, so we need apt to install apache2. This calls the 'apt' state library with the parameter apache2.<br/><span class='code'>[<br/>\
&nbsp;&nbsp;&nbsp;{<br/>\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\"name\":\"apt\",<br/>\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\"parameters\":[\"apache2\"]<br/>\
&nbsp;&nbsp;&nbsp;}<br/>\
]");
        $states.push("Let's test our changes locally. Type <span class='code'>squadron check</span>");
        $states.push("This is how we test our changes locally. Let's check out the templating system. Type next.");
        $stateFS.push('empty');
        $stateFS.push('init_service');
        $enabledCommands = $enabledCommands.concat($fscmd);
        $enabledCommands.push("edit");
        break;
    case '3':
        $states.push("We're going to setup a repository for your squadron deployment, type: <br/><br/><span class='code'>mkdir repo<br/>cd repo<br/>squadron init</span>");
        $states.push("This is what a base repository looks like, type <span class='code'>tree</span> to get a better look.<br/><br/>Next we'll describe our first service. Type next when you're ready.</span>");
        $stateFS.push('empty');
        $stateFS.push('init');
        $enabledCommands = $enabledCommands.concat($fscmd);
        break;
    case '2':
        $states.push("Now we're going to do the system setup, type: <br/><br/><span class='code'>squadron setup</span>");
        $states.push("In this tutorial, we're going to be placing everything in your home directory. <br/>In real squadron, you are prompted for the path.<br/><br/>Feel free to browse what we just created. Try for instance: <br/><span class='code'>ls -la<br/>tree<br/>cat .squadron/config</span><br/></br>You can see all commands by typing <span class='code'>help</span>.<br/>In the next section we'll setup a repository. Type next when you're ready.");
        $enabledCommands = $enabledCommands.concat($fscmd);
        $stateFS.push('empty');
        $stateFS.push('setup');
        break;
    case '1':
    default:
        
        $enabledCommands.push("pip");
        $stateFS.push('empty');
        $states.push("Welcome to Squadron's Tutorial! I'm Rawls and I'm here to help you.<br/>Let's install squadron with the following command:<br/><br/><span class='code'>pip install squadron</span>");
        $states.push("Well done! <br/><br/>Use the navigation bar below to move to the next step or type: <br/><br/><span class='code'>next</span>");
        break;
   }
 
   
    //Setup term
   $terminal_div = $(".term-squadron")[0];
   $cb_func = function() {
        term.begin($terminal_div);
    };
   var term = Object.create(Terminal);
   CONFIG.username = 'rawls';
   term.init(CONFIG, $filesystem, COMMANDS, $cb_func);

   window.typeCommand = function(command) {
      term.typeCommand(command);
   };
   $terminal = term;
   NextState(); 
     //Disable commands
    for(var key in term.commands)
    {
        if(term.commands.hasOwnProperty(key) && !$enabledCommands.hasObject(key)){
            delete term.commands[key];
        }
    }


   //Initialize nav bar
   $crums = $(".breadcrum a");
   $num = $crums.length;
   for($i = 0; $i < $num; $i++){
       $($crums[$i]).removeClass('next');
        if($currentStep-1 < $i){
            $($crums[$i]).addClass('next');
        }
        if($currentStep-1 == $i){
            $($crums[$i]).addClass('current');
        }
        if($currentStep-1 > $i){
            $($crums[$i]).addClass('done');
        }
        $($crums[$i]).attr('href', 'index.html?step='+($i+1));

   }

   //Setup binds for next and previous
   $(".next").click(function() {
        $terminal._saveFS();
   });

})();

function UpdateSpeechBubble($html){
   $(".speechbubble").html($html);
}


function NextState(){
    UpdateSpeechBubble($states[$currentState]);
    if($stateFS.length >= $currentState && $stateFS.length > 0) {
        $newState = $stateFS[$currentState];
        if($newState != undefined && $newState != null){ 
            $terminal.loadFSIntoDir('json/' + $newState + '.json');
        }
    }
    $currentState++;
}
