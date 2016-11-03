import fs from 'fs';
import { promisify } from 'util';
import util from './lib/util.js';
import app from './lib/app.js';
import help from './lib/config.js';

const access = promisify(fs.access);

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
				await access(root);
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
