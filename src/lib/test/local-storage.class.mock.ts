export class LocalStorageMock {
  public store: Map<string, string> = new Map();

  public clear: () => void = jest.fn(() => {
    this.store.clear();
  });

  public getItem: (key: string) => string | null = jest.fn((key: string) => {
    return this.store.get(key) ?? null;
  });

  public setItem: (key: string, value: string) => void = jest.fn((key: string, value: string) => {
    this.store.set(key, value);
  });

  public removeItem: (key: string) => void = jest.fn((key: string) => {
    this.store.delete(key);
  });

  public get length(): number {
    return this.store.size;
  }

  public key: (index: number) => string | null = jest.fn((index: number) => {
    return [...this.store.keys()].find((value, idx) => idx === index) ?? null;
  });
}
