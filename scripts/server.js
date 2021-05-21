const connect = require("connect");
const path = require("path");
const serveStatic = require("serve-static");
const open = require("open");
const port = 8_080;

connect().use(serveStatic(path.join(__dirname, "../public"))).use(
	serveStatic(path.join(__dirname, "../dist")),
).listen(
	port,
	function() {
		console.log("dir is ", path.join(__dirname, "../public"));
		console.log(`Listing on http://localhost:${port}`);
		open(`http://localhost:${port}`);
	},
);
