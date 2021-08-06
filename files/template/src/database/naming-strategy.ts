import type { NamingStrategyInterface } from 'typeorm';
import { DefaultNamingStrategy, Table } from 'typeorm';

// function camelCase(str: string, firstCapital: boolean = false): string {
// return str.replace(/^([A-Z])|[\s-_](\w)/g, (match, p1: string, p2: string, offset) => {
// if (firstCapital && offset === 0) return p1;
// if (p2) return p2.toUpperCase();
// return p1.toLowerCase();
// });
// }

// function titleCase(str: string): string {
// return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
// }

function snakeCase(str: string): string {
  return str.replace(/(?:([a-z])([A-Z]))|(?:((?!^)[A-Z])([a-z]))/g, '$1_$3$2$4').toLowerCase();
}

export class DatabaseNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ? userSpecifiedName : snakeCase(targetName);
  }

  closureJunctionTableName(originalClosureTableName: string): string {
    const name = `${originalClosureTableName}_closure`;

    return name;
  }

  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    // console.log('columnName:', propertyName, customName, embeddedPrefixes);

    let name = snakeCase(customName || propertyName);

    if (embeddedPrefixes.length) {
      name = snakeCase(embeddedPrefixes.join('_')) + name;
    }

    return name;
  }

  relationName(propertyName: string): string {
    // console.log('relationName:', propertyName);

    return propertyName;
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    // console.log('joinColumnName:', relationName, referencedColumnName);

    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    secondPropertyName: string,
  ): string {
    // console.log(firstTableName, secondTableName, firstPropertyName, secondPropertyName);

    return snakeCase(`${firstTableName}_${firstPropertyName.replace(/\./gi, '_')}_${secondTableName}`);
  }

  joinTableColumnDuplicationPrefix(columnName: string, index: number): string {
    return `${columnName}_${index}`;
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    // console.log(tableName, propertyName, columnName);

    return snakeCase(`${tableName}_${columnName ? columnName : propertyName}`);
  }

  joinTableInverseColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return this.joinTableColumnName(tableName, propertyName, columnName);
  }

  /**
	 * Adds globally set prefix to the table name.
	 * This method is executed no matter if prefix was set or not.
	 * Table name is either user's given table name, either name generated from entity target.
	 * Note that table name comes here already normalized by #tableName method.
	 */

  prefixTableName(prefix: string, tableName: string): string {
    return prefix + tableName;
  }

  eagerJoinRelationAlias(alias: string, propertyPath: string): string {
    const name = `${alias}_${propertyPath.replace('.', '_')}`;
    // console.log('eagerJoinRelationAlias:', alias, propertyPath);

    return name;
  }

  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
    const clonedColumnNames = [...columnNames].map((c) => snakeCase(c));
    clonedColumnNames.sort();

    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    const key = `${replacedTableName}__${clonedColumnNames.join('__')}`;

    return `pk_${key}`;
  }

  uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
    const clonedColumnNames = [...columnNames].map((c) => snakeCase(c));
    clonedColumnNames.sort();

    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    const key = `${replacedTableName}__${clonedColumnNames.join('__')}`;

    return `uq_${key}`;
  }

  relationConstraintName(tableOrName: Table | string, columnNames: string[], where?: string): string {
    // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
    const clonedColumnNames = [...columnNames].map((c) => snakeCase(c));
    clonedColumnNames.sort();

    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    let key = `${replacedTableName}__${clonedColumnNames.join('__')}`;

    if (where) {
      key += `__${where}`;
    }

    return `rel_${key}`;
  }

  defaultConstraintName(tableOrName: Table | string, columnName: string): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    const key = `${replacedTableName}__${snakeCase(columnName)}`;

    return `df_${key}`;
  }

  foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
    _referencedTablePath?: string,
    _referencedColumnNames?: string[],
  ): string {
    // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
    const clonedColumnNames = [...columnNames].map((c) => snakeCase(c));
    clonedColumnNames.sort();

    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    const key = `${replacedTableName}__${clonedColumnNames.join('__')}`;

    return `fk_${key}`;
  }

  indexName(tableOrName: Table | string, columnNames: string[], where?: string): string {
    // sort incoming column names to avoid issue when ["id", "name"] and ["name", "id"] arrays
    const clonedColumnNames = [...columnNames].map((c) => snakeCase(c));
    clonedColumnNames.sort();

    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    let key = `${replacedTableName}__${clonedColumnNames.join('__')}`;

    if (where) {
      key += `__${where}`;
    }

    return `idx_${key}`;
  }

  checkConstraintName(tableOrName: Table | string, expression: string): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    const key = `${replacedTableName}__${expression}`;

    return `chk_${key}`;
  }

  exclusionConstraintName(tableOrName: Table | string, expression: string): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const replacedTableName = tableName.replace('.', '_');
    const key = `${replacedTableName}__${expression}`;

    return `xcl_${key}`;
  }
}
