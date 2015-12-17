function blink(selector, interval) {
    $(selector).toggle();
    setTimeout(function() {
        blink(selector, interval);
    }, interval);
}

function validChar(keycode) {
    return (keycode > 47 && keycode < 58)   || // number keys
        keycode == 32 || keycode == 13   || // spacebar & return key(s) (if you want to allow carriage returns)
        (keycode > 32 && keycode < 126)   || // letter keys
        (keycode > 95 && keycode < 112)  || // numpad keys
        (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
        (keycode > 218 && keycode < 223);   // [\]' (in order)
}

function shouldBlockEvent(e) {
    return validChar(e.keyCode) || e.keyCode == 8 || e.keyCode == 9;
}

$(document).ready(function() {
    blink(".blink", 1000);
});

var Commands = {
    intro: function(args) {
        return [
            "Welcome to AppleDash.org!",
            "Try 'help' for help."
        ];
    },

    /*
        eval <javascript code>
     */
    eval: function(args) {
        var res = eval(args.join(" "));

        switch (res) {
            case undefined:
            case null:
                return null;
            default:
                return res.toString();
        }
    },

    /*
        ssh <website> - opens <website>
     */
    ssh: function(args) {
        if (args.length == 1) {
            return function() {
                window.location.href = "http://" + args[0];
            };
        }

        return ["usage: ssh hostname[:port]"];
    },

    /*
        pwd - prints out the current directory you are in in the virtual FS
     */
    pwd: function(args) {
        return FS.curDir.getName();
    },

    /*
        cat <file> - prints out the contents of <file> in the virtual FS
     */
    cat: function(args) {
        if (args.length == 1) {
            return null;
        }

        return "usage: cat <file>";
    },

    /*
        Make a directory in the virtual FS
     */
    mkdir: function(args) {
        if (args.length == 0) {
            return "mkdir: missing operand";
        }

        return FS.mkdir(args[0]) ? null : "mkdir: cannot create directory ' " + args[0] + "': file exists";
    },

    /*
        ls [path] - list the contents of the given path, or the current directory if none is given.
     */
    ls: function(args) {
        var path = args.length == 0 ? "" : args[0];
        var tab = FS.findPath(path);

        if (tab == null) {
            return "ls: cannot access " + path + ": No such file or directory";
        }

        return tab.list();
    },

    cd: function(args) {
        var path = args.length == 0 ? "/" : args[0];
        var tab = FS.findPath(path);

        if (tab == null) {
            return "cd: no such file or directory: " + path;
        }

        FS.chdir(tab);
    },

    touch: function(args) {
        if (!FS.touch(args[0])) {
            return "touch: cannot touch '" + args[0] + "': No such file or directory";
        }
    },

    /*
        Steam locomotive...
     */
    sl: function(args) {
        return function() {
            Console.println('<iframe width="420" height="315" src="https://www.youtube.com/embed/wkQ-bUseXNY?autoplay=1" frameborder="0" allowfullscreen></iframe>', false);
        }
    }
};

function FileTab(par, name, type) {
    return {
        type: type,
        name: name,
        par: par,
        files: {},
        contents: "",
        root: false,

        getName: function() {
            var cur = this;
            var path = "";

            if (this.root) {
                return "/";
            }

            while (cur.par != null) {
                path = cur.par.name + "/" + cur.name;
                cur = cur.par;
            }

            return path;
        },

        list: function() {
            var out = [];

            if (this.type != "dir") {
                return null;
            }

            var keys = Object.keys(this.files);

            for (var i = 0; i < keys.length; i++) {
                var f = keys[i];
                out.push(f);
            }

            return out;
        }
    };
};

var FS = {
    fileTab: FileTab(null, "", "dir"),
    curDir: null,

    init: function() {
        this.fileTab.root = true;
        this.curDir = this.fileTab;

        this.mkdir("/bin/");

        for (var c in Commands) {
            if (Commands.hasOwnProperty(c)) {
                this.touch("/bin/" + c);
            }
        }

        this.mkdir("/root/");
        this.chdir(this.findPath("/root/"));
    },

    findPath: function(path) {
        var parts = this._splitPath(path);
        var curTab = path[0] == "/" ? this.fileTab : this.curDir;

        if (path.trim() == "") {
            return curTab;
        }

        for (var i = 0; i < parts.length; i++) {
            if (parts[i] == "..") {
                if (!curTab.root) {
                    curTab = curTab.par;
                }
                continue;
            }

            if (curTab.files.hasOwnProperty(parts[i])) {
                curTab = curTab.files[parts[i]];
            } else {
                return null;
            }
        }

        return curTab;
    },

    mkdir: function(dir) {
        var parts = this._splitPath(dir);
        var curTab = this.fileTab;

        for (var i = 0; i < parts.length; i++) {
            if (typeof curTab.files[parts[i]] == "undefined") {
                curTab.files[parts[i]] = FileTab(curTab, parts[i], "dir");
            } else if (curTab.files[parts[i]].type != "dir") {
                return false;
            }
            curTab = curTab.files[parts[i]];
        }

        return true;
    },

    touch: function(path) {
        var parts = this._splitPath(path);

        if (parts.length == 0) {
            return false;
        }

        if (parts.length > 1) {
            if (!this.mkdir(parts.slice(0, -1).join("/"))) {
                return false;
            }
        }

        if (this.findPath(path) != null) {
            return true;
        }

        var parent = this.findPath(parts.slice(0, 1).join("/"));

        parent.files[parts[parts.length - 1]] = FileTab(parent, parts[parts.length - 1], "file");

        return true;
    },

    chdir: function(tab) {
        this.curDir = tab;
    },

    readFile: function(path) {
        var tab = this.findPath(path);

        if (tab.type != "file") {
            return null;
        }

        return tab.contents;
    },

    _cleanPath: function(path) {
        while (path.indexOf("//") != -1) {
            path = path.replace("//", "/");
        }

        path = path.trim();

        return path;
    },

    _splitPath: function(path) {
        var split = this._cleanPath(path).split("/");
        var out = [];

        for (var i = 0, outIdx = 0; i < split.length; i++) {
            if (split[i] != "") {
                out[outIdx] = split[i];
                outIdx++;
            }
        }

        return out;
    }
};

var Console = {
    outputting: false,
    outputQueue: [],
    history: [],
    curCommandLine: "",
    init: function(elem) {
        FS.init();
        this.elem = elem;
        var that = this;

        var $body = $(document);
        $body.unbind("keypress").bind("keypress", function(evt) {
            var prevent = true;
            if (evt.which == 13) { // Enter
                var cmd = that.curCommandLine;
                that.curCommandLine = "";
                that.update();

                that.doCommand(cmd);
            } else if (evt.which == 8) { // Backspace
                if (that.curCommandLine.length > 0) {
                    that.curCommandLine = that.curCommandLine.substring(0, that.curCommandLine.length - 1);
                }
            } else if (evt.which == 9) { // Tab
                that.curCommandLine += "\t";
            } else if (evt.which == 32) {
                that.curCommandLine += " ";
            } else if (validChar(evt.charCode)) {
                that.curCommandLine += String.fromCharCode(evt.charCode);
            } else {
                prevent = false;
            }

            that.update();

            if (prevent) {
                evt.preventDefault();
            }
        });

        (function(that) {
            setInterval(function() {
                that.doOutput();
            }, 50);
        })(this);


        that.println("you@yourbox:~$ ssh root@appledash.org");

        if (localStorage.getItem("hostKeySaved") != "yes") {
            that.println("The authenticity of host 'appledash.org (192.99.131.204)' can't be established.");
            that.println("ECDSA key fingerprint is f1:31:b1:e2:ec:4f:12:3f:aa:36:c6:f8:37:c0:03:0e.");
            that.println("Are you sure you wish to continue connecting (yes/no)? yes");
            that.println("Warning: Permanently added 'appledash.org,192.99.131.204' (ECDSA) to the list of known hosts.");
            localStorage.setItem("hostKeySaved", "yes");
        }
        that.update();
        that.doCommand("intro");
        that.update();
    },

    getPrompt: function() {
        var cwd = FS.curDir.getName();
        if (cwd == "/root") {
            cwd = "~";
        }

        return "[root@appledash.org:" + cwd + "]$";
    },

    update: function() {
        $(this.elem).find(".console-prompt").text(this.getPrompt());
        $(this.elem).find(".console-command-line").text(this.curCommandLine);
    },

    println: function(line, do_sleep) { this.outputQueue.push([line, typeof do_sleep == "undefined" ? true : do_sleep]); },
    doPrintln: function(line, is_new, should_sleep) {
        if (line == null || typeof line == "undefined") {
            return;
        }

        if (is_new) {
            $(this.elem).children(".console-line").last().after("<div class='console-line'></div>");
        }

        var $elem = $(this.elem).children(".console-line").last();
        var that = this;
        that.outputting = true;
        if (should_sleep) {
            (function(that, $elem, line) {
                var id = setInterval(function() {
                    if (line.length == 0) {
                        that.outputting = false;
                        clearInterval(id);
                        return;
                    }
                    $elem.text($elem.text() + line.substring(0, 1));
                    line = line.substring(1);
                }, 5);
            })(that, $elem, line);
        } else {
            $(this.elem).children(".console-line").last().after("<div class='console-line'>" + line + "</div>");
            that.outputting = false;
        }
    },

    doOutput: function() {
        if (this.outputQueue.length > 0 && !this.outputting) {
            var o = this.outputQueue.shift();
            this.doPrintln(o[0], true, o[1]);
            //console.log("did thing");
        }
    },

    doCommand: function(commandLine) {
        this.history.push(commandLine);
        this.println(this.getPrompt() + " " + commandLine, false);
        commandLine = commandLine.trim();

        var split = commandLine.split(" ");
        var args = [];

        for (var i = 1; i < split.length; i++) {
            args[i - 1] = split[i];
        }
        var cmd = Commands[split[0]];
        
        if (typeof cmd == "undefined") {
            this.println("adsh: command not found: " + split[0]);
            return;
        }

        var res = cmd(args);

        if (res == null || typeof res == "undefined") {
            // Nothing
        } else if (typeof res == "function") {
            res();
        } else if (typeof res == "object") {
            for (var i = 0; i < res.length; i++) {
                this.println(res[i]); 
            }
        } else {
            this.println(res);
        }
    }
};

$(document).ready(function() {
    Console.init("#console");
});
