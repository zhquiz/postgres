import path from 'path'

import createConnectionPool, { ConnectionPool, sql } from '@databases/pg'
import { sLibrary } from '@zhquiz/zhlevel/lib/schema'
import sqlite3 from 'better-sqlite3'

export async function makeLibrary(
  db: ConnectionPool,
  srcdb = path.join(__dirname, '../source/out/library.db')
) {
  const s3 = sqlite3(srcdb, { readonly: true })

  await db.query(sql`
  ALTER TABLE "library" DROP CONSTRAINT IF EXISTS c_library_entries;
  ALTER TABLE "library" ADD CONSTRAINT c_library_entries CHECK (validate_json_schema('${sql.__dangerous__rawValue(
    JSON.stringify(sLibrary.valueOf().properties!['entries'])
  )}', "entries"))
  `)

  await db.tx(async (db) => {
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
        INSERT INTO "library" ("id", "title", "entries", "type", "tag", "createdAt", "updatedAt", "description", "isShared")
        VALUES ${sql.join(
          lots.slice(i, i + batchSize).map((p) => {
            return sql`(${p.id}, ${p.title}, ${JSON.stringify(
              p.entries
            )}::jsonb, ${p.type}, ${p.tag}, ${p.createdAt}, ${p.updatedAt}, ${
              p.description
            }, ${p.isShared})`
          }),
          ','
        )}
        ON CONFLICT ("id")
        DO UPDATE SET
          "title"       = EXCLUDED."title",
          "entries"     = EXCLUDED."entries",
          "type"        = EXCLUDED."type",
          "tag"         = EXCLUDED."tag",
          "createdAt"   = EXCLUDED."createdAt",
          "updatedAt"   = EXCLUDED."updatedAt",
          "description" = EXCLUDED."description",
          "isShared"    = EXCLUDED."isShared"
      `)
    }
  })
}

if (require.main === module) {
  ;(async function () {
    const db = createConnectionPool({ bigIntMode: 'number' })
    await makeLibrary(db)
  })()
}
