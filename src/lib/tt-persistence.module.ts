import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { TtPersistenceConfig } from './interfaces/tt-persistence-config.interface';
import { TtPersistenceDatabaseService } from './services/tt-persistence-database.service';
import { TtPersistenceDeleteService } from './services/tt-persistence-delete.service';
import { TtPersistenceRetrieveService } from './services/tt-persistence-retrieve.service';
import { TtPersistenceStoreService } from './services/tt-persistence-store.service';
import { TtPersistenceStateService } from './tt-persistence-state.service';
import { TtPersistenceService } from './tt-persistence.service';
import { TtPersistenceConfigModel } from './models/tt-persistence-config.model';
import { TtPersistenceInterceptor } from './tt-persistence-interceptor.class';

@NgModule()
class TtPersistenceNoopModule {
  public static forRoot<T extends unknown>(_config: unknown): ModuleWithProviders<TtPersistenceModule> {
    return {
      ngModule: TtPersistenceNoopModule,
    };
  }
}

@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: TtPersistenceInterceptor, multi: true },
    { provide: TtPersistenceStateService, useClass: TtPersistenceStateService, multi: false },
    { provide: TtPersistenceService, useClass: TtPersistenceService, multi: false },
    { provide: TtPersistenceDatabaseService, useClass: TtPersistenceDatabaseService, multi: false },
    { provide: TtPersistenceStoreService, useClass: TtPersistenceStoreService, multi: false },
    { provide: TtPersistenceRetrieveService, useClass: TtPersistenceRetrieveService, multi: false },
    { provide: TtPersistenceDeleteService, useClass: TtPersistenceDeleteService, multi: false },
    { provide: TtPersistenceConfigModel, useClass: TtPersistenceConfigModel },
  ],
})
export class TtPersistenceModule {
  public static forRoot<T extends TtPersistenceConfig>(
    config: TtPersistenceConfig,
    ignore?: boolean,
  ): ModuleWithProviders<TtPersistenceModule> {
    config = { ... new TtPersistenceConfigModel(), ...config };

    if (ignore) {
      return {
        ngModule: TtPersistenceNoopModule,
      };
    }

    return {
      ngModule: TtPersistenceModule,
      providers: [
        { provide: TtPersistenceConfigModel, useValue: config },
        TtPersistenceService,
      ],
    };
  }
}

