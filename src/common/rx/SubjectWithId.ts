import {
  type IEmitter,
  type IObservable,
  type ISubject,
  type ISubjectWithId,
  type Listener,
} from './types'
import { type PromiseOrValue, type Unsubscribe } from 'src/common/types/common'
import { Subject } from './Subject'

export class SubjectWithId<Id, T = void> implements ISubjectWithId<Id, T> {
  private readonly _subjects = new Map<Id, Subject<T>>()
  private readonly _getLastEvent?: null | ((id: Id) => T)

  constructor({
    getLastEvent,
  }: { getLastEvent?: null | ((id: Id) => T) } = {}) {
    this._getLastEvent = getLastEvent
  }

  subscribe(id: Id, listener: Listener<T>): Unsubscribe {
    let subject = this._subjects.get(id)
    if (!subject) {
      subject = new Subject()
      this._subjects.set(id, subject)
    }
    const unsubscribe = subject.subscribe(listener)
    if (this._getLastEvent) {
      const lastEvent = this._getLastEvent(id)
      listener(lastEvent)
    }
    return () => {
      unsubscribe()
      if (!subject?.hasListeners) {
        this._subjects.delete(id)
      }
    }
  }

  emit(id: Id, event: T): PromiseOrValue<void> {
    const subject = this._subjects.get(id)
    if (subject) {
      return subject.emit(event)
    }
  }

  forEach(callback: (emitter: IEmitter<T>, id: Id) => void): void {
    this._subjects.forEach(callback)
  }

  observable(id: Id): IObservable<T> {
    return {
      subscribe: listener => this.subscribe(id, listener),
    }
  }

  emitter(id: Id): IEmitter<T> {
    return {
      emit: event => this.emit(id, event),
    }
  }

  subject(id: Id): ISubject<T> {
    return {
      subscribe: listener => this.subscribe(id, listener),
      emit: event => this.emit(id, event),
    }
  }
}
