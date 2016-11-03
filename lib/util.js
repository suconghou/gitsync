import fs from 'fs';
import { Buffer } from 'buffer'
import { promisify } from 'util';
import { exec } from 'child_process';
let errorlog = [];

const readFile = promisify(fs.readFile);

export default {
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
			exec(shell, (error, stdout, stderr) => {
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
					const data = JSON.parse((Buffer.concat(buf)).toString());
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
