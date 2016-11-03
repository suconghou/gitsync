# gitsync

testing deploy for gogs

use git hook sync your code

`--repos=/tmp` set the repos path

`--port=9090` set the http listen port

`--secret=123456` set the secret

`http://ip:port/log?key=123456`  see the runing log

some variables are hardcode , should change sometimes

with branch support

`http://ip:port/gogs?key=123456` or `http://ip:port/gogs?key=123456&branch=dev`

with task support

`http://ip:port/gogs?key=123456&task=task1`

task1 file is in the repos path

`task1` file
```
 cd static/css
 for i in *.less ; do air compress $i -r;done;
```

use systemd manage
`/etc/systemd/system/gitsy.service`
```
[Unit]
Description=gitsync sync code and run task
After=network.target network-online.target

[Service]
Restart=on-failure
TimeoutStartSec=0
ExecStart=/usr/bin/gitsy

[Install]
WantedBy=multi-user.target
```

`sudo systemctl daemon-reload`
`sudo systemctl enable gitsy`
`sudo systemctl start gitsy`


