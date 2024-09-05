import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, debounceTime, filter, map, switchMap } from 'rxjs/operators';
import { TtPersistenceStateService } from './tt-persistence-state.service';
import { doLog, log, logEnd, logEndAll, logStart } from './functions/log.function';

@Injectable({
  providedIn: 'root',
})
export class TtPersistenceInterceptor implements HttpInterceptor {

  constructor(private stateService: TtPersistenceStateService) {}

  /**
   * Intercept the default request and return something from the persistent
   * object store related to this route. If the StateService is in seeding mode,
   * the request is paused until seeding is done.
   */
  //eslint-disable-next-line max-lines-per-function
  public intercept<T>(request: HttpRequest<T>, handler: HttpHandler): Observable<HttpEvent<T>> {
    if (!this.stateService.interceptor) {
      doLog(this.stateService.debug, log, 'INTERCEPTOR DISABLED');
      return handler.handle(request);
    }

    if (!this.stateService.hasRoute(request.url, request.method, false)) {
      return handler.handle(request);
    }

    doLog(this.stateService.debug, logEndAll);
    doLog(this.stateService.debug, logStart, 'INTERCEPTING', this.stateService.debugRoute(request.url));
    doLog(this.stateService.debug, log, 'URL:', request.url);
    doLog(this.stateService.debug, log, 'METHOD:', request.method);
    doLog(this.stateService.debug, log, 'REQUEST:', request);

    const handled: Observable<T | T[]> | null = this.stateService.handleRequest<T>(request);

    if (!handled) {
      doLog(this.stateService.debug, logEnd);
      return handler.handle(request);
    }

    return this.stateService.seeding$.pipe(
      filter((seeding) => !seeding),
      switchMap(() => handled),
      catchError((error) => {
        console.warn(error);
        doLog(this.stateService.debug, logEnd);
        return throwError(() => error);
      }),
      debounceTime(100),
      map((result: T) => {
        if (this.stateService.debug) {
          doLog(this.stateService.debug, logEnd, 'RESULT:', result);
        }
        // Convert the result to an HTTP response.
        return new HttpResponse<T>({
          body: result as T,
          headers: request.headers,
          status: result ? 200 : 404,
          statusText: result ? 'OK' : 'NOT FOUND',
          url: request.url,
        });
      }),
    );
  }
}
