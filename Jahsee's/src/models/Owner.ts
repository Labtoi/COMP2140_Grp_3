import { User } from './User';


export class Owner extends User {
  constructor (id: string, name: string, password?: string) {
    super(id, name, password);

  }
}