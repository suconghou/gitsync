'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs'));
var util$1 = require('util');
var buffer = require('buffer');
var child_process = require('child_process');
var http = _interopDefault(require('http'));
var querystring = _interopDefault(require('querystring'));
var path = _interopDefault(require('path'));

let errorlog = [];

const readFile = util$1.promisify(fs.readFile);

var util = {
	isFunction(value) {
		return typeof value === 'function';
	},
	log(msg) {
		if (errorlog.length > 1000) {
			errorlog = [];
		}
		const nowDate = new Date();
		msg = nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString() + ' ' + msg;
		errorlog.push(msg);
		console.log(msg);
	},
	getLog(glue = '\n') {
		return errorlog.join(glue);
	},
	exec(shell) {
		return new Promise((resolve, reject) => {
			child_process.exec(shell, (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else {
					resolve({ stdout, stderr });
				}
			});
		});
	},
	getParams(args) {
		const kMap = {
			'-p': 'port',
			'-d': 'root',
			'-k': 'secret',
			'-auth': 'auth',
			'--debug': 'debug'
		};
		const ret = {};
		const keys = Object.keys(kMap);
		let key;
		args.forEach(item => {
			if (keys.includes(item)) {
				if (item.substr(0, 2) == '--') {
					ret[kMap[item]] = true;
				} else {
					key = kMap[item];
				}
			} else if (key && item.toString().charAt(0) != '-') {
				ret[key] = item;
				key = null;
			} else {
				key = null;
			}
		});
		return ret;
	},

	bodyParser(req, max = 8192) {
		return new Promise((resolve, reject) => {
			let buf = [], count = 0;
			req
				.on('error', reject)
				.on('aborted', reject)
				.on('data', function (data) {
					buf.push(data);
					count += data.length;
					if (count > max) {
						reject('body too large');
					}
				}).on('end', function () {
					const data = JSON.parse((buffer.Buffer.concat(buf)).toString());
					resolve(data);
				});
		});
	},

	runTask(cwd, taskfile) {
		return new Promise(async (resolve, reject) => {
			let str;
			try {
				str = await readFile(taskfile, 'utf8');
			} catch (e) {
				reject(e);
			}
			if (str) {
				try {
					const r = await this.exec('cd ' + cwd + ' ; \n' + str);
					resolve(r.stdout + r.stderr);
				} catch (e) {
					reject(e);
				}
			} else {
				reject('empty task file');
			}
		});
	}
};

const access = util$1.promisify(fs.access);

var route = {
	GET: {
		log(request, response, args, query, cfg) {
			response.writeHead(200, { 'Content-Type': 'text/plain' });
			if (query.key == cfg.secret) {
				return response.end(util.getLog());
			}
			return response.end('not allow\n');
		},
		async run(request, response, args, query, cfg) {
			response.writeHead(200, { 'Content-Type': 'text/plain' });
			if (query.key != cfg.secret) {
				return response.end('not allow\n');
			}
			const file = args.toString();
			if (!/\w+\.sh$/.test(file)) {
				return response.end('task name error\n');
			}
			try {
				const taskfile = path.join(cfg.root, file);
				const res = await util.runTask(cfg.root, taskfile);
				response.end(res.toString());
			} catch (e) {
				response.end(e.toString());
			}
		}
	},
	POST: {
		async gogs(request, response, args, query, cfg) {
			let data;
			try {
				data = await util.bodyParser(request);
			} catch (e) {
				const msg = e.toString();
				util.log(msg);
				response.writeHead(400, { 'Content-Type': 'text/plain' });
				response.end(msg);
				return;
			}
			if (query.key != cfg.secret) {
				response.writeHead(400, { 'Content-Type': 'text/plain' });
				response.end('not allow\n');
				return;
			}

			const res = await new Promise(async (resolve, reject) => {
				const repo = data.repository.name.toLocaleLowerCase();
				const reposPath = path.join(cfg.root, repo);
				const branch = query.branch ? query.branch : 'master';
				let shell = [
					`cd ${reposPath}`,
					`git clean -fdx`,
					`git fetch --all -p`,
					`git checkout ${branch}`,
					`git reset --hard origin/${branch}`
				].join(' && ');
				try {
					await access(reposPath);
				} catch (e) {
					const cloneUrl = data.repository.clone_url.toLocaleLowerCase().replace('git.ourwill.cn', `${cfg.auth}@code.ourwill.cn`);
					shell = 'git clone ' + cloneUrl + ' ' + reposPath + ' && cd ' + reposPath + ' && git checkout ' + branch;
				}
				try {
					const res = await util.exec(shell);
					response.writeHead(200, { 'Content-Type': 'text/plain' });
					response.end(res.stderr + res.stdout);
					if (query.task) {
						const taskfile = path.join(cfg.root, query.task);
						const ret = await util.runTask(reposPath, taskfile);
						resolve(ret);
					} else {
						resolve(res.stderr + res.stdout);
					}
				} catch (e) {
					reject(e);
				}
			});
			util.log(res.toString());
		}
	},
	PUT: {},
	DELETE: {}
};

class app {
	constructor(cfg) {
		this.cfg = cfg;
	}

	start() {
		http.createServer(async (request, response) => {
			try {
				const router = route[request.method];
				if (router) {
					const [pathinfo, qs] = decodeURI(request.url).split('?');
					const [fn, ...args] = pathinfo.split('/').filter(item => item);
					const m = router[fn];
					if (util.isFunction(m)) {
						await m(request, response, args, querystring.parse(qs), this.cfg);
						return;
					}
				}
				response.writeHead(404, { 'Content-Type': 'text/plain' });
				response.end('Not Found\n');
			} catch (e) {
				const err = e.toString();
				util.log(err);
				response.writeHead(500, { 'Content-Type': 'text/plain' });
				response.end(err + '\n');
			}
		})
			.listen(this.cfg.port)
			.on('error', err => {
				console.info(err.toString());
			});
		console.log('Server running at http://127.0.0.1:%s/', this.cfg.port);
	}

	serve() {
		this.start();
	}
}

var help = `
Usage:
	gitsy [command] [flag]
Commands:
	serve		  	start http server
Flags:
	-v     			show version
	-h      		show this help information
	-p     			set server listen port
	-d     			set server document root
	-auth			git clone auth user:pass
	--debug			compress with debug mode
`;

const access$1 = util$1.promisify(fs.access);

const defaultFn = ['serve'];

const cfg = {
	port: 19090,
	secret: 123456,
	version: '0.1.7',
	auth: 'user:pass',
	root: '/data/share/runtime/'
};

class bootstrap {
	constructor(argv, cfg) {
		const [, , ...args] = argv;
		const params = util.getParams(args);
		if (args.indexOf('-v') >= 0) {
			return console.log('gitsy version: gitsy/' + cfg.version);
		} else {
			this.cfg = Object.assign({}, cfg, params);
			this.run(args.length == 0 ? defaultFn : args);
		}
	}
	async run(args) {
		try {
			const { root } = this.cfg;
			const [fn, ...arg] = args;
			const instance = new app(this.cfg);
			if (util.isFunction(instance[fn])) {
				await access$1(root);
				instance[fn].call(instance, arg);
			} else {
				this.help();
			}
		} catch (e) {
			util.log(e.toString());
		}
	}
	help() {
		console.info(help);
	}
}

new bootstrap(process.argv, cfg);
