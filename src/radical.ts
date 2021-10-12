import path from 'path'

import createConnectionPool, { ConnectionPool, sql } from '@databases/pg'
import sqlite3 from 'better-sqlite3'

export async function makeRadical(
  db: ConnectionPool,
  srcdb = path.resolve(__dirname, '../resource/out/radical.db')
) {
  const s3 = sqlite3(srcdb, {
    readonly: true
  })

  await db.tx(async (db) => {
    const batchSize = 10000

    const lots = s3
      .prepare(
        /* sql */ `
    SELECT "data"
    FROM radical
    `
      )
      .all()
      .map((p) => JSON.parse(p.data))

    for (let i = 0; i < lots.length; i += batchSize) {
      console.log(i)
      await db.query(sql`
        INSERT OR REPLACE INTO "radical" ("entry", "sub", "sup", "var")
        VALUES ${sql.join(
          lots
            .slice(i, i + batchSize)
            .map((p) => sql`(${p.entry}, ${p.sub}, ${p.sup}, ${p.var})`),
          ','
        )}
      `)
    }
  })
}

if (require.main === module) {
  ;(async function () {
    const db = createConnectionPool({ bigIntMode: 'number' })
    await makeRadical(db)
  })()
}
