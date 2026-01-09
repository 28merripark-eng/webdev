// run_game.js — Windows Script Host runner for Pirate Quest
// Double-click this file (or run with WScript) from the webdev folder.
var fso = new ActiveXObject("Scripting.FileSystemObject");
var sh = new ActiveXObject("WScript.Shell");
var scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName);
sh.CurrentDirectory = scriptFolder;

// Try to start a Python HTTP server in a new cmd window (py fallback to python)
var serverCmd = 'cmd /c start "Server" cmd /k "py -3 -m http.server 8000 || python -m http.server 8000"';
sh.Run(serverCmd, 1, false);

// Give the server a moment and open the game URL in default browser
WScript.Sleep(1000);
sh.Run('cmd /c start "" "http://localhost:8000/pirate-game/index.html"', 1, false);
