import http from 'http';
import querystring from 'querystring';
import route from './route.js';
import util from './util.js';
export default class app {
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
