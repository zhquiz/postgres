#!/usr/bin/env bash

echo "shared_preload_libraries = 'pg_jieba.so'" >> /var/lib/postgresql/data/postgresql.conf
pg_ctl -o "-c listen_addresses='localhost'" -w restart

cd /app

if [[ ! -d ./resource/out ]]; then
    git clone --depth=1 https://github.com/zhquiz/resource.git
    cd resource
    node -e 'const pkg = require("./package.json"); delete pkg.devDependencies; require("fs").writeFileSync("./package.json", JSON.stringify(pkg))'
    yarn --frozen-lockfile
    node .
    cd -
fi

node ./lib/init.js
