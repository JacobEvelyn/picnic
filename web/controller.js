var fs = require('fs');
var marked = require('marked');
var sass = require('node-sass');
var uglify = require('uglifycss');

// Render the view
module.exports.index = function(req, res) {
  
  res.render("index");
  };


module.exports.plugin = function(req, res) {

  var pluginsText = getDirs(__dirname + "/../plugins");
  var plugins = [];

  pluginsText.forEach(function(value, i){
    var plugin = {
      name: value,
      install: "[installed]",
      description: "No description",
      documentation: "No documentation",
      partial: false
      };
    plugin.id = value;
    plugin.folder = __dirname + "/../plugins/" + plugin.id + "/";
    if (fs.existsSync(plugin.folder + "info.json")) {
      var info = JSON.parse(fs.readFileSync(plugin.folder + "info.json", 'utf-8'));
      plugin.name = info.name;
      plugin.description = info.description;
      plugin.install = info.install;
      plugin.dependencies = info.dependencies || false;
      plugin.partial = info.partial || false;
      plugin.doc = info.documentation ? info.documentation : "documentation.md";
      }
    
    if (fs.existsSync(plugin.folder + "description.html")) {
      plugin.description = fs.readFileSync(plugin.folder + "description.html", 'utf-8');
      }

    if (fs.existsSync(plugin.folder + plugin.doc)) {
      var docRaw = fs.readFileSync(plugin.folder + plugin.doc, 'utf-8');
      
      if (plugin.doc.split('.').pop() == "md") {
        plugin.documentation = marked(docRaw, {sanitize: false});
        }
      else {
        plugin.documentation = docRaw;
        }
      }

    if (!plugin.partial)
      plugins.push(plugin);
    });

  if (req.params.name && req.params.name.length) {
    var plugin;
    for (var key in plugins){
      if (plugins[key].id == req.params.name)
        plugin = plugins[key];
    }
    if (plugin)
      res.render("plugin", { plugin: plugin });
    else
      res.status(404).render("404", { plugin: plugin });
    }
  else {
    res.render("pluginindex", { plugins: plugins });
    }
  };


module.exports.nut = function(req, res) {
  
  var picnic = parseUrl(req.params.full);

  var newsass = "@import '../../src/" + picnic.version + "';\n\n";

  if(picnic.plugins && picnic.plugins.length > 0)
    picnic.plugins.forEach(function(plugin, index) {

      var version = 1;
      if (plugin.match('_')) {
        pluginparts = plugin.split('_');
        plugin = pluginparts.shift();
        version = pluginparts.join('_');
        }
      
      var infoFile = __dirname + "/../plugins/" + plugin + "/info.json";
      if (fs.existsSync(infoFile)) {
        var info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
        var dependencies = info.dependencies || [];
        if (dependencies.length > 0) {
          dependencies.forEach(function(dep){
            newsass += "@import '../../plugins/" + dep + "';\n";
            });
          }
        }
      else
        console.log("Couldn't find info.json, " + infoFile);


      newsass += "@import '../../plugins/" + plugin + "/v" + version + "';\n";
    });

  // Write it to a file
  fs.writeFileSync(__dirname + '/nut/' + picnic.full + '.scss', newsass);

  // nut normal one
  sass.render({

    // Compile it from the previous file
    file: __dirname + '/nut/' + picnic.full + '.scss',
    success: function(result){
      var finalCSS = result.css;

      if (picnic.minimize)
        finalCSS = uglify.processString(finalCSS);
      
      res.writeHead(200, {'Content-Type': 'text/css'});
      res.write(finalCSS);
      res.end();

      if (picnic.writeFile) {
        fs.writeFile(__dirname + '/nut/' + picnic.full, finalCSS);
        }
      },
    error: function(error) {
      // error is an object: v2 change
      console.log(error.message);
      console.log(error.code);
      console.log(error.line);
      console.log(error.column); // new in v2

      res.render(404);
      },  
    });
  };



// Render all of the tests
module.exports.test = function(req, res){

  res.render("test");
  }



// Showcase Picnic CSS with a demo
module.exports.demo = function(req, res){

  res.render("demo");
  }





function getDirs(rootDir){
  var files = fs.readdirSync(rootDir);
  var dirs = [];

  for(var key in files) {
    var file = files[key];

    if (file[0] != '.') {
      filePath = rootDir + "/" + file;
      stat = fs.statSync(filePath);
      }

    if (stat.isDirectory()) {
      dirs.push(file);
      }
    }

  return dirs;
  }



// Fetch the information of the intended file
function parseUrl(url) {

  // The object to store the information
  var picnic = {
    minimize: false,
    writeFile: true
    };

  // The full requested file
  picnic.full = url;
  var sides = picnic.full.split(".");

  // Retrieve the version to be used
  var parts = sides.shift().split("+");

  // The version of Picnic CSS
  picnic.version = parts.shift();

  // "core+modal", "min", "css"
  picnic.options = sides;

  // Parse options (post-process)
  if (picnic.options.length) {
    if (picnic.options.indexOf('min') !== -1) {
      picnic.minimize = true;
    }
    if (picnic.options.indexOf('fresh') !== -1) {
      picnic.writeFile = false;
    }
  }

  if (parts.length) {

    // Store all plugins
    picnic.plugins = parts;
    }
  return picnic;
};