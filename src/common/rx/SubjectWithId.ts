import {
  type IEmitter,
  type IObservable,
  type ISubject,
  type ISubjectWithId,
  type Listener,
} from './types'
import { type PromiseOrValue, type Unsubscribe } from 'src/common/types/common'
import { Subject } from './Subject'

/** @deprecated Not used anywhere */
export class SubjectWithId<Id, T = void> implements ISubjectWithId<Id, T> {
  readonly #subjects = new Map<Id, Subject<T>>()
  readonly #getLastEvent?: null | ((id: Id) => T)

  constructor({
    getLastEvent,
  }: { getLastEvent?: null | ((id: Id) => T) } = {}) {
    this.#getLastEvent = getLastEvent
  }

  subscribe(id: Id, listener: Listener<T>): Unsubscribe {
    let subject = this.#subjects.get(id)
    if (!subject) {
      subject = new Subject()
      this.#subjects.set(id, subject)
    }
    const unsubscribe = subject.subscribe(listener)
    if (this.#getLastEvent) {
      const lastEvent = this.#getLastEvent(id)
      listener(lastEvent)
    }
    return () => {
      unsubscribe()
      if (!subject?.hasListeners) {
        this.#subjects.delete(id)
      }
    }
  }

  emit(id: Id, event: T): PromiseOrValue<void> {
    const subject = this.#subjects.get(id)
    if (subject) {
      return subject.emit(event)
    }
  }

  forEach(callback: (emitter: IEmitter<T>, id: Id) => void): void {
    this.#subjects.forEach(callback)
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
