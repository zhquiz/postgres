import path from 'path'

import createConnectionPool, { ConnectionPool, sql } from '@databases/pg'
import { sTranslation } from '@zhquiz/zhlevel/lib/schema'
import sqlite3 from 'better-sqlite3'
import fg from 'fast-glob'

export async function makeEntry(
  db: ConnectionPool,
  source = path.resolve(__dirname, '../resource/out/entry')
) {
  process.chdir(source)

  await db.query(sql`
  ALTER TABLE "entry" DROP CONSTRAINT IF EXISTS c_entry_translation;
  ALTER TABLE "entry" ADD CONSTRAINT c_entry_translation CHECK (validate_json_schema('${sql.__dangerous__rawValue(
    JSON.stringify(sTranslation.valueOf())
  )}', "translation"))
  `)

  await db.tx(async (db) => {
    for (const filename of await fg(['**/*.db'])) {
      console.log(filename)

      const s3 = sqlite3(filename)

      const batchSize = 5000

      const lots = s3
        .prepare(
          /* sql */ `
        SELECT "data"
        FROM "entry"
        `
        )
        .all()
        .map((p) => JSON.parse(p.data))

      for (let i = 0; i < lots.length; i += batchSize) {
        await db.query(sql`
        INSERT INTO "entry" ("type", "entry", "reading", "english", "translation", "tag", "frequency", "level", "hLevel")
        VALUES ${sql.join(
          lots.slice(i, i + batchSize).map((p) => {
            return sql`(${p.type}, ${p.entry}, ${p.reading}, ${p.english}, ${p.translation}, ${p.tag}, ${p.frequency}, ${p.level}, ${p.hLevel})`
          }),
          ','
        )}
        ON CONFLICT (("entry"[1]), "type", "userId") DO UPDATE SET
          ${sql.join(
            [
              sql`"frequency"`,
              sql`"level"`,
              sql`"hLevel"`,
              sql`"translation"`
            ].map((s) => sql`${s} = EXCLUDED.${s}`),
            ','
          )},
          ${sql.join(
            [sql`"entry"`, sql`"reading"`, sql`"english"`, sql`"tag"`].map(
              (s) => sql`${s} = array_distinct("entry".${s}||EXCLUDED.${s})`
            ),
            ','
          )}
      `)
      }

      s3.close()
    }
  })
}

if (require.main === module) {
  ;(async function () {
    const db = createConnectionPool({ bigIntMode: 'number' })
    await makeEntry(db)
  })()
}
