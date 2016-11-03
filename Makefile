build:
	make release && \
	uglifyjs bundle.js -o bundle.js -c toplevel,collapse_vars=true,reduce_vars=true -m 
dev:
	rollup index.js -o bundle.js -f cjs -e net,fs,os,process,path,child_process,util,http,querystring,buffer -w

release:
	rollup index.js -o bundle.js -f cjs -e net,fs,os,process,path,child_process,util,http,querystring,buffer && \
	chmod +x bundle.js
	
