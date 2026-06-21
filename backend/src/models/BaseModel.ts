import { Knex } from 'knex';

export abstract class BaseModel {
  protected static tableName: string;
  protected static db: Knex;

  static setDatabase(db: Knex) {
    this.db = db;
  }

  static async findById(id: string) {
    return this.db(this.tableName).where('id', id).first();
  }

  static async create(data: any) {
    const [result] = await this.db(this.tableName).insert(data).returning('*');
    return result;
  }

  static async update(id: string, data: any) {
    const [result] = await this.db(this.tableName)
      .where('id', id)
      .update({ ...data, updated_at: new Date() })
      .returning('*');
    return result;
  }

  static async delete(id: string) {
    return this.db(this.tableName).where('id', id).del();
  }

  static async findMany(conditions: any = {}, options: any = {}) {
    let query = this.db(this.tableName);

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        query = query.whereIn(key, value);
      } else {
        query = query.where(key, value as any);
      }
    });

    // Apply ordering
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }
}
