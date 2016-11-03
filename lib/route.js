import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import util from './util.js';

const access = promisify(fs.access);

export default {
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
