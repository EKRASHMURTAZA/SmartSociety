import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export interface NotificationEvent {
  userId: string;
  data: unknown;
}

@Injectable()
export class NotificationStreamService {
  readonly events$ = new Subject<NotificationEvent>();
  emit(userId: string, data: unknown) {
    this.events$.next({ userId, data });
  }
}
