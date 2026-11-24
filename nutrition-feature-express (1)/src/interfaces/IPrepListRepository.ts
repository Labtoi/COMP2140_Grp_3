//TODO Finish this interface
import { PrepItem } from "../models/PrepItem"

export interface IPreparationRepository {
    createPrep(item: string): Promise<void>
    getPrep(itemName: string): Promise<PrepItem>
    ShowAllPrep(): Promise<PrepItem[]>
    UpdatePrep(itemName: string): Promise<void>
    AddPrep(prep: PrepItem): Promise<void>
    RemovePrep(itemName: string): Promise<void>
}