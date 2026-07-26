export type D1StubCall = {
  sql: string;
  values: unknown[];
};

type D1StubOptions = {
  batchChanges?: number;
  firstResults?: unknown[];
  allResults?: unknown[][];
};

function resultMeta(changes: number): D1Meta & Record<string, unknown> {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: changes,
    last_row_id: 0,
    changed_db: changes > 0,
    changes,
  };
}

function result<T>(changes: number, results: T[] = []): D1Result<T> {
  return {
    success: true,
    meta: resultMeta(changes),
    results,
  };
}

class D1PreparedStatementStub implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly calls: D1StubCall[],
    private readonly firstResults: unknown[],
    private readonly allResults: unknown[][],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    this.calls.push({ sql: this.sql, values });
    return this;
  }

  async first<T = unknown>(columnName?: string): Promise<T | null> {
    const value = this.firstResults.shift() ?? null;
    if (
      columnName &&
      value !== null &&
      typeof value === "object" &&
      columnName in value
    ) {
      return (value as Record<string, unknown>)[columnName] as T;
    }
    return value as T | null;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return result<T>(1);
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return result<T>(0, (this.allResults.shift() ?? []) as T[]);
  }

  raw<T = unknown[]>(options: {
    columnNames: true;
  }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: {
    columnNames?: boolean;
  }): Promise<T[] | [string[], ...T[]]> {
    if (options?.columnNames) {
      return [[]];
    }
    return [];
  }
}

class D1DatabaseSessionStub implements D1DatabaseSession {
  constructor(private readonly database: D1DatabaseStub) {}

  prepare(query: string): D1PreparedStatement {
    return this.database.prepare(query);
  }

  batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    return this.database.batch<T>(statements);
  }

  getBookmark(): D1SessionBookmark | null {
    return null;
  }
}

class D1DatabaseStub implements D1Database {
  readonly calls: D1StubCall[] = [];
  private readonly firstResults: unknown[];
  private readonly allResults: unknown[][];
  private readonly batchChanges: number;

  constructor(options: D1StubOptions) {
    this.firstResults = [...(options.firstResults ?? [])];
    this.allResults = [...(options.allResults ?? [])];
    this.batchChanges = options.batchChanges ?? 1;
  }

  prepare(query: string): D1PreparedStatement {
    return new D1PreparedStatementStub(
      query,
      this.calls,
      this.firstResults,
      this.allResults,
    );
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    return statements.map(() => result<T>(this.batchChanges));
  }

  async exec(): Promise<D1ExecResult> {
    return { count: 0, duration: 0 };
  }

  withSession(): D1DatabaseSession {
    return new D1DatabaseSessionStub(this);
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}

export function createD1Stub(options: D1StubOptions = {}) {
  const db = new D1DatabaseStub(options);
  return { calls: db.calls, db };
}
