// Run from Backend: node db/migrate_product_history.js
const pool = require('../config/db');

const quoteIdentifier = value => `\`${value.replace(/`/g, '``')}\``;

function columnDefinition(column, conn) {
  const nullable = column.Null === 'NO' ? ' NOT NULL' : ' NULL';
  const defaultValue = column.Default === null
    ? ''
    : ` DEFAULT ${
      /^(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)(\(\d+\))?$/i.test(column.Default)
        ? column.Default
        : conn.escape(column.Default)
    }`;
  const extra = (column.Extra || '').replace(/\bDEFAULT_GENERATED\b/g, '').trim();
  return `${column.Type}${nullable}${defaultValue}${extra ? ` ${extra}` : ''}`;
}

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.query('CREATE TABLE IF NOT EXISTS ProductHistory LIKE Product');
    const [columns] = await conn.query('SHOW COLUMNS FROM Product');
    const [historyColumns] = await conn.query('SHOW COLUMNS FROM ProductHistory');
    const historyColumnNames = new Set(historyColumns.map(c => c.Field));
    for (const column of columns) {
      if (!historyColumnNames.has(column.Field)) {
        await conn.query(
          `ALTER TABLE ProductHistory ADD COLUMN ${quoteIdentifier(column.Field)} ${columnDefinition(column, conn)}`
        );
      }
    }
    const names = columns.map(c => c.Field);
    const quoted = names.map(n => `\`${n}\``).join(', ');
    const assignments = names.filter(n => n !== 'ProductID').map(n => `\`${n}\` = NEW.\`${n}\``).join(', ');
    for (const event of ['INSERT', 'UPDATE']) {
      const trigger = `product_history_${event.toLowerCase()}`;
      const [found] = await conn.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = :trigger', {trigger});
      if (found.length) await conn.query(`DROP TRIGGER ${quoteIdentifier(trigger)}`);
      await conn.query(`CREATE TRIGGER ${quoteIdentifier(trigger)} AFTER ${event} ON Product FOR EACH ROW INSERT INTO ProductHistory (${quoted}) VALUES (${names.map(n => `NEW.\`${n}\``).join(', ')}) ON DUPLICATE KEY UPDATE ${assignments}`);
    }
    await conn.query(`INSERT IGNORE INTO ProductHistory (${quoted}) SELECT ${quoted} FROM Product`);
    const [fks] = await conn.query(`SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'Product'`);
    for (const fk of fks) {
      await conn.query(`ALTER TABLE ${quoteIdentifier(fk.TABLE_NAME)} DROP FOREIGN KEY ${quoteIdentifier(fk.CONSTRAINT_NAME)}, ADD CONSTRAINT ${quoteIdentifier("ph_" + fk.TABLE_NAME + "_" + fk.COLUMN_NAME)} FOREIGN KEY (${quoteIdentifier(fk.COLUMN_NAME)}) REFERENCES ProductHistory(ProductID)`);
    }
    console.log('ProductHistory ready; transaction references preserved.');
  } finally {conn.release();}
}
if (require.main === module) migrate().catch(e => {console.error(e.message); process.exitCode = 1;}).finally(() => pool.end());
module.exports = migrate;
