import logger from "../config/logger.js";
import { sequelize } from "../config/sequelize.js";  // todo remove
import { getPagination } from "./pagination.js";



export class QueryView {
  constructor(query, queryParams = {}) {
    this.subQuery = query;
    this.query = `SELECT * FROM (${query})`;
    this.countQuery = `SELECT COUNT(*) FROM (${query})`;

    this.params = { ...queryParams };
    this.values = [];
    this.paramCounter = 1;
  }

  apply(reqParams = {}, columns = []) {
    this.params = { ...this.params, ...reqParams };
    return this.filter(this.params)
      .sort(this.params)
      .searchFromParams(this.params, columns)
      .paginate(this.params);
  }
  applyWithOutPagination(reqParams, columns = []) {
    return this.filter(reqParams)
      .sort(reqParams)
      .searchFromParams(reqParams, columns);
  }

  // Chainable filter method
  filter(reqParams) {
    if (reqParams?._filter) {
      const [column, operator, value] = reqParams._filter.split(",");
      if (column && value && operator) {
        const { processedSearchOperator, processedSearchText } =
          generateOperator(operator, value);

        const whereClause = this.query
          .replace(this.subQuery, "")
          .includes("WHERE")
          ? "AND"
          : "WHERE";
        const condition = `${column} ${processedSearchOperator} :filter_text`;

        this.query += ` ${whereClause} ${condition}`;
        this.countQuery += ` ${whereClause} ${condition}`;
        this.params.filter_text = processedSearchText;
      }
    }
    return this;
  }

  // Chainable sort method
  sort(reqParams) {
    if (reqParams?._sort) {
      const [field, type] = reqParams._sort.split(",");
      if (field && type && ["desc", "asc"].includes(type.toLowerCase())) {
        this.query += ` ORDER BY ${field} ${type.toUpperCase()}`;
      }
    }
    return this;
  }

  // Chainable pagination method
  paginate(reqParams) {
    if (reqParams?.page) {
      const { pageNum, limitNum } = getPagination(
        reqParams.page,
        reqParams.limit,
      );
      const offset = (pageNum - 1) * limitNum;

      this.query += ` LIMIT ${limitNum} OFFSET ${offset}`;
    }
    return this;
  }

  // Chainable search method - requires explicit columns
  search(searchTerm, columns) {
    if (searchTerm && Array.isArray(columns) && columns.length > 0) {
      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch) {
        const searchConditions = columns.map(
          (column) => `${column}::text ILIKE :search_term`,
        );

        const whereClause = this.query
          .replace(this.subQuery, "")
          .includes("WHERE")
          ? "AND"
          : "WHERE";
        const searchCondition = `(${searchConditions.join(" OR ")})`;

        this.query += ` ${whereClause} ${searchCondition}`;
        this.countQuery += ` ${whereClause} ${searchCondition}`;
        this.params.search_term = `%${trimmedSearch}%`;
      }
    }
    return this;
  }

  // Chainable search from request parameters
  searchFromParams(reqParams, columns) {
    if (reqParams?._search && Array.isArray(columns) && columns.length > 0) {
      return this.search(reqParams._search, columns);
    }
    return this;
  }

  // Chainable advanced search with different operators per column
  advancedSearch(searchConfig) {
    if (searchConfig && typeof searchConfig === "object") {
      const conditions = [];

      Object.entries(searchConfig).forEach(([column, searchData]) => {
        if (searchData?.value && searchData.value.trim()) {
          const operator = searchData.operator || "ilike";
          const value = searchData.value.trim();

          let condition;
          switch (operator.toLowerCase()) {
            case "ilike":
              condition = `${column}::text ILIKE $search_${column}`;
              this.params[`search_${column}`] = `%${value}%`;
              break;
            case "equals":
              condition = `${column} = $search_${column}`;
              this.params[`search_${column}`] = value;
              break;
            case "startswith":
              condition = `${column}::text ILIKE $search_${column}`;
              this.params[`search_${column}`] = `${value}%`;
              break;
            case "endswith":
              condition = `${column}::text ILIKE $search_${column}`;
              this.params[`search_${column}`] = `%${value}`;
              break;
            default:
              condition = `${column}::text ILIKE $search_${column}`;
              this.params[`search_${column}`] = `%${value}%`;
          }

          conditions.push(condition);
        }
      });

      if (conditions.length > 0) {
        const whereClause = this.query
          .replace(this.subQuery, "")
          .includes("WHERE")
          ? "AND"
          : "WHERE";
        const searchCondition = `(${conditions.join(" AND ")})`;

        this.query += ` ${whereClause} ${searchCondition}`;
        this.countQuery += ` ${whereClause} ${searchCondition}`;
      }
    }
    return this;
  }

  // Chainable custom where condition
  where(condition, params = {}) {
    if (condition) {
      const whereClause = this.query
        .replace(this.subQuery, "")
        .includes("WHERE")
        ? "AND"
        : "WHERE";

      this.query += ` ${whereClause} ${condition}`;
      this.countQuery += ` ${whereClause} ${condition}`;

      Object.entries(params).forEach(([key, value]) => {
        const cleanKey = key.startsWith("$") ? key.slice(1) : key;
        this.params[cleanKey] = value;
      });
    }
    return this;
  }

  // Prepare and execute the query
  async execute() {
    // await sequelize.query('SELECT * FROM users WHERE name LIKE :search_name', {
    // replacements: { search_name: 'ben%' },
    // type: QueryTypes.SELECT,
    // });
    // this.prepareQuery();

    try {
      const [data, metaData] = await sequelize.query(this.query, {
        replacements: this.params,
      });
      const [countData, countMetaData] = await sequelize.query(
        this.countQuery,
        {
          replacements: this.params,
        },
      );

      return {
        data: data,
        total: parseInt(countData[0].count),
        query: this.query,
        countQuery: this.countQuery,
      };
    } catch (error) {
      logger.error("Query execution error:", error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  // Helper method to prepare query with parameters
  prepareQuery() {
    this.values = [];
    this.paramCounter = 1;

    const replaceParams = (query, push = false) => {
      return query.replace(/\$(\w+)/g, (match, key) => {
        if (this.params.hasOwnProperty(key)) {
          push && this.values.push(this.params[key]);
          return `$${this.paramCounter++}`;
        }
        return match;
      });
    };

    this.query = replaceParams(this.query, true);
    this.paramCounter = 1;

    this.countQuery = replaceParams(this.countQuery);
  }

  // Static method for easy chaining
  static from(query) {
    return new QueryView(query);
  }
}

//!!!
// Simple search across specific columns
// const result = await QueryView.from('SELECT * FROM users')
//   .search('john', ['first_name', 'last_name', 'email'])
//   .execute();

// // Search from request parameters
// const result = await QueryView.from('SELECT * FROM products')
//   .searchFromParams(req.query, ['name', 'description', 'category'])
//   .execute();

// // Combined with other methods
// const result = await QueryView.from('SELECT * FROM orders')
//   .search('urgent', ['customer_name', 'notes'])
//   .filter({ _filter: 'status,eq,completed' })
//   .sort({ _sort: 'created_at,desc' })
//   .paginate({ page: 1, limit: 20 })
//   .execute();

// // Advanced search with different operators
// const result = await QueryView.from('SELECT * FROM employees')
//   .advancedSearch({
//     first_name: { value: 'John', operator: 'ilike' },
//     department: { value: 'IT', operator: 'equals' },
//     email: { value: 'company.com', operator: 'endswith' }
//   })
//   .execute();

// // Multiple search conditions
// const result = await QueryView.from('SELECT * FROM books')
//   .search('programming', ['title', 'description'])
//   .search('2023', ['published_year']) // This will add AND condition
//   .execute();




function generateOperator(searchOperator, value) {
    let processedSearchOperator = "=";
    let processedSearchText= value;
  
  
    switch (searchOperator) {
      // 🔹 String operators
      case "contains":
        processedSearchOperator = "ILIKE";
        processedSearchText = `%${value}%`;
        break;
      case "doesNotContain":
        processedSearchOperator = "NOT ILIKE";
        processedSearchText = `%${value}%`;
        break;
      case "equals":
        processedSearchOperator = "=";
        processedSearchText = `'${value}`;
        break;
      case "doesNotEqual":
        processedSearchOperator = "!=";
        processedSearchText = `${value}`;
        break;
      case "startsWith":
        processedSearchOperator = "ILIKE";
        processedSearchText = `${value}%`;
        break;
      case "endsWith":
        processedSearchOperator = "ILIKE";
        processedSearchText = `%${value}`;
        break;
      case "isEmpty":
        processedSearchOperator = "IS NULL";
        processedSearchText = null;
        break;
      case "isNotEmpty":
        processedSearchOperator = "IS NOT NULL";
        processedSearchText = null;
        break;
  
      // 🔹 Multi-value (MUI "isAnyOf")
      case "isAnyOf":
        processedSearchOperator = "IN";
        processedSearchText = `(${value.map((v) => `'${v}'`).join(", ")})`;
        break;
  
      // 🔹 Numeric / Date comparisons
      case ">":
      case "after":
      case "isAfter":
        processedSearchOperator = ">";
        processedSearchText =  `${value}`;
        break;
      case ">=":
      case "onOrAfter":
      case "isOnOrAfter":
        processedSearchOperator = ">=";
        processedSearchText =  `${value}`;
        break;
      case "<":
      case "before":
      case "isBefore":
        processedSearchOperator = "<";
        processedSearchText =  `${value}`;
        break;
      case "<=":
      case "onOrBefore":
      case "isOnOrBefore":
        processedSearchOperator = "<=";
        processedSearchText =  `${value}`;
        break;
  
      // 🔹 Boolean support
      case "isTrue":
        processedSearchOperator = "=";
        processedSearchText = "TRUE";
        break;
      case "isFalse":
        processedSearchOperator = "=";
        processedSearchText = "FALSE";
        break;
  
      default:
        processedSearchOperator = "=";
        processedSearchText = `${value}`;
        break;
    }
  
    return { processedSearchOperator, processedSearchText };
  }
  
