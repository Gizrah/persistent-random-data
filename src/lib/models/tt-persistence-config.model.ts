import { Injector } from '@angular/core';
import { Extractor } from '../extractor.class';
import { Generator } from '../generator.class';
import { TtPersistenceRouteMap } from '../interfaces/tt-persistence-route-map.interface';
import { TtPersistenceFormatter } from '../interfaces/shared.type';
import { TtPersistenceConfig } from '../interfaces/tt-persistence-config.interface';
import { TtPersistenceService } from '../tt-persistence.service';

/**
 * Model for use in the StateService, which is just a model representation of
 * the {@see TtPersistenceConfig} interface.
 */
export class TtPersistenceConfigModel implements TtPersistenceConfig {

  public enabled: boolean = false;

  public mapping: TtPersistenceRouteMap[] = [];

  public seeder?: (persistence: TtPersistenceService, extractor: Extractor, generator: Generator) => Promise<void>;

  public authenticator?: (injector: Injector) => Promise<void>;

  public formatter?: TtPersistenceFormatter;

  public debug?: boolean;

  public debugSplitUrlOn?: string;

}
