#!/usr/bin/env bash

echo "shared_preload_libraries = 'pg_jieba.so'" >> /var/lib/postgresql/data/postgresql.conf
pg_ctl -o "-c listen_addresses='localhost'" -w restart

cd /app

if [[ ! -d ./resource/out ]]; then
    git clone --depth=1 https://github.com/zhquiz/resource.git
    cd resource
    yarn
    yarn start
    cd -
fi

yarn ts src/index.ts
