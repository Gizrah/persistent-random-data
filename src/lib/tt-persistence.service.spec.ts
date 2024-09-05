import 'fake-indexeddb/auto';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { firstValueFrom } from 'rxjs';
import { Extractor } from './extractor.class';
import { TtPersistenceDatabaseService } from './services/tt-persistence-database.service';
import { TtPersistenceDeleteService } from './services/tt-persistence-delete.service';
import { TtPersistenceRetrieveService } from './services/tt-persistence-retrieve.service';
import { TtPersistenceStoreService } from './services/tt-persistence-store.service';
import { TtPersistenceService } from './tt-persistence.service';
import { Generator } from './generator.class';
import { TtPersistenceOptions } from './interfaces/tt-persistence-options.interface';
import { TtPersistenceResult } from './interfaces/tt-persistence-result.interface';
import { extractorData } from './test/extractor-data.mock';
import {
  persistenceObjectStore,
  persistenceSettings,
  persistenceSettingsWithMutations,
} from './test/local-storage-data.mock';

declare let indexedDB: IDBFactory;

describe('GeneratorPersistenceService', () => {
  let service: TtPersistenceService;
  let extracted: Record<string, unknown>[];

  // Private constants used in the service.
  const storageKey: string = 'persistence->objectStore';
  const settingsKey: string = 'persistence->settings';
  const idKey: string = '__pkey__';
  const storeKey: string = '__store__';
  // Default options and links for the extracted data.
  const defaultOptions: TtPersistenceOptions = {
    storeName: 'LocationMember',
    primaryKey: '@id',
    storeContent: true,
    linkedKeys: new Map(),
  };

  // Create random data.
  function generateData(): void {
    if (extracted || !service) {
      return;
    }

    const fromData: Record<string, unknown> = service.extractor.extract(
      extractorData as Record<string, unknown>,
      {
        globalKeyMap: new Map(),
        typeMap: new Map(),
      },
    ) as Record<string, unknown>;
    extracted = fromData['hydra:member'] as Record<string, unknown>[];
  }

  beforeEach(waitForAsync(() => {
    // Storage is called on construction.
    jest.spyOn(Storage.prototype, 'getItem');
    jest.spyOn(Storage.prototype, 'setItem');

    TestBed.configureTestingModule({
      providers: [
        TtPersistenceService,
        TtPersistenceDatabaseService,
        TtPersistenceRetrieveService,
        TtPersistenceStoreService,
        TtPersistenceDeleteService,
      ],
    }).compileComponents();
    service = TestBed.inject(TtPersistenceService);
    generateData();
  }));

  it('should create', () => {
    expect(Storage.prototype.getItem).toHaveBeenCalledTimes(2);
    expect(service).toBeInstanceOf(TtPersistenceService);
    expect(service.extractor).toBeInstanceOf(Extractor);
    expect(service.generator).toBeInstanceOf(Generator);
    expect(service.extractor.generator).toBe(service.generator);
    expect(extracted).toBeDefined();
  });

  describe.skip('persist', () => {
    it('should flatten and store linked PersistenceSettings', async () => {
      const result: TtPersistenceResult[] = await firstValueFrom(service.persist(extracted, defaultOptions));

      expect(Storage.prototype.setItem).toHaveBeenCalledTimes(3);
      expect(Storage.prototype.setItem).nthCalledWith(1, settingsKey, JSON.stringify(persistenceSettingsWithMutations));
      expect(Storage.prototype.setItem).nthCalledWith(2, storageKey, JSON.stringify(persistenceObjectStore));
      expect(Storage.prototype.setItem).nthCalledWith(3, settingsKey, JSON.stringify(persistenceSettings));

      expect(result.length).toBe(10);
      expect(result[0].rows).toBeGreaterThan(0);
    });

    it('should persist without storing data', async () => {
      indexedDB = new IDBFactory();

      const options: TtPersistenceOptions = {
        ...defaultOptions,
        storeContent: false,
      };
      const result: TtPersistenceResult[] = await firstValueFrom(service.persist(extracted, options));

      expect(result.length).toBe(10);
      expect(result[0].rows).toBe(0);
    });
  });
});
